const test = require('node:test');
const assert = require('node:assert/strict');
const sourceLoader = require('./fixtures/load-source.cjs');

// Exercise the real client callbacks/effect cleanup without a DOM or a server.
function client(t, file, props = {}) {
  let cursor = 0;
  const hooks = [], effects = [], requests = [], posts = [], timers = new Set();
  const changed = (a, b) => !a || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return hooks[index] ??= { current: initial };
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (changed(hooks[index]?.deps, deps)) hooks[index] = { callback, deps };
      return hooks[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (changed(hooks[index]?.deps, deps)) effects.push(() => {
        hooks[index]?.cleanup?.();
        hooks[index] = { deps, cleanup: effect() };
      });
    },
    useId: () => 'test-panel',
  };
  const browser = { hidden: false, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  const previousDocument = global.document, previousWindow = global.window;
  global.document = browser;
  global.window = { ...browser, setInterval: callback => { timers.add(callback); return callback; } };
  t.mock.method(global, 'setInterval', callback => { timers.add(callback); return callback; });
  t.mock.method(global, 'clearInterval', callback => timers.delete(callback));
  const empty = () => null;
  const load = sourceLoader({
    react,
    axios: { get: (url, options) => new Promise((resolve, reject) => requests.push({ url, ...options, resolve, reject })),
      post: async (...args) => { posts.push(args); return { data: { unread: 0 } }; }, isAxiosError: () => false },
    'next/link': empty, 'next/image': empty, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/app/components/Pagination': empty, '@/app/admin/components/AdminPagination': empty,
    './SupportThreadClient': empty, './SupportHours': empty,
  });
  const Component = load(file).default;
  const render = (nextProps = props) => {
    props = nextProps;
    cursor = 0;
    const tree = Component(props);
    effects.splice(0).forEach(effect => effect());
    return tree;
  };
  const unmount = () => hooks.forEach(hook => hook?.cleanup?.());
  t.after(() => { unmount(); global.document = previousDocument; global.window = previousWindow; });
  return { render, unmount, requests, posts, poll: () => [...timers].forEach(callback => callback()) };
}

function find(tree, predicate) {
  if (Array.isArray(tree)) return tree.map(node => find(node, predicate)).find(Boolean);
  if (!tree || typeof tree !== 'object') return;
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}
const flush = () => new Promise(resolve => setImmediate(resolve));

for (const [name, file, label, selected, param, payload] of [
  ['support requests', 'app/components/support/SupportTicketListClient.tsx', 'Support request filter', 'ACTIVE', 'state', { items: [], total: 0, totalPages: 1 }],
  ['admin inbox', 'app/admin/support/SupportInboxClient.tsx', 'Support inbox filter', 'MINE', 'filter', { conversations: [], total: 0, totalPages: 1 }],
  ['notifications', 'app/components/notifications/NotificationsClient.tsx', 'Notification filter', 'UNREAD', 'filter', { items: [], unread: 0, through: 0, hasOlder: false }],
]) {
  test(`${name}: changing a filter while loading fetches the new selection and ignores late failures`, async t => {
    const f = client(t, file);
    const first = f.render();
    find(first, node => node.props?.['aria-label'] === label).props.onChange({ target: { value: selected } });
    f.render();
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[0].signal.aborted, true);
    assert.equal(f.requests[1].params[param], selected);
    f.poll();
    assert.equal(f.requests.length, 2, 'polling must not cancel the new filter request');
    f.requests[0].reject(Error('late failure from previous filter'));
    await flush();
    assert.ok(find(f.render(), node => node.props?.role === 'status'), 'old completion must not clear the new loading indicator');
    f.requests[1].resolve({ data: payload });
    await flush();
    const settled = f.render();
    assert.equal(find(settled, node => node.props?.role === 'status'), undefined);
    assert.equal(find(settled, node => node.props?.role === 'alert'), undefined);
  });
}

test('switching a support ticket cannot display the previous ticket when its response arrives late', async t => {
  const f = client(t, 'app/components/support/SupportTicketDetailClient.tsx', { id: 'old-ticket' });
  f.render();
  f.render({ id: 'new-ticket' });
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[0].signal.aborted, true);
  f.requests[1].resolve({ data: { ticket: { reference: 'NEW', actions: [], state: 'OPEN', category: 'OTHER' } } });
  await flush();
  f.requests[0].resolve({ data: { ticket: { reference: 'OLD', actions: [], state: 'OPEN', category: 'OTHER' } } });
  await flush();
  assert.equal(find(f.render(), node => node.type === 'h1').props.children, 'NEW');
});

test('closing the chat cancels its pending history and cannot mark unseen messages read', async t => {
  const f = client(t, 'app/components/support/SupportThreadClient.tsx');
  f.render();
  f.render({ enabled: false });
  assert.equal(f.requests[0].signal.aborted, true);
  f.requests[0].resolve({ data: { messages: [{ sequence: 12 }], conversation: { unread: 1 } } });
  await flush();
  assert.equal(f.posts.length, 0);
  f.render({ enabled: true });
  assert.equal(f.requests.length, 2, 'reopening must start a fresh request');
});

test('unmounted notification views cancel network work and ignore a late response', async t => {
  const f = client(t, 'app/components/notifications/NotificationsClient.tsx');
  f.render();
  f.unmount();
  assert.equal(f.requests[0].signal.aborted, true);
  f.requests[0].resolve({ data: { items: [], unread: 9, through: 9, hasOlder: false } });
  await flush();
  f.poll();
  assert.equal(f.requests.length, 1);
});

for (const [name, file, payload] of [
  ['support requests', 'app/components/support/SupportTicketListClient.tsx', { items: [], total: 11, totalPages: 2 }],
  ['admin inbox', 'app/admin/support/SupportInboxClient.tsx', { conversations: [], total: 11, totalPages: 2 }],
]) {
  test(`${name}: pagination takes priority over an in-flight background refresh`, async t => {
    const f = client(t, file);
    f.render();
    f.requests[0].resolve({ data: payload });
    await flush();
    const ready = f.render();
    f.poll();
    find(ready, node => typeof node.props?.onPageChange === 'function').props.onPageChange(2);
    f.render();
    assert.equal(f.requests.length, 3);
    assert.equal(f.requests[1].signal.aborted, true);
    assert.equal(f.requests[2].params.page, 2);
    f.requests[2].resolve({ data: payload });
    await flush();
    f.requests[1].resolve({ data: { ...payload, total: 999 } });
    await flush();
    const pager = find(f.render(), node => typeof node.props?.onPageChange === 'function');
    assert.equal(pager.props.currentPage, 2);
    assert.equal(pager.props.totalItems, 11);
  });
}

test('marking notifications read replaces stale polling instead of restoring the old unread state', async t => {
  const f = client(t, 'app/components/notifications/NotificationsClient.tsx');
  const payload = { items: [], unread: 1, through: 1, hasOlder: false };
  f.render();
  f.requests[0].resolve({ data: payload });
  await flush();
  const ready = f.render();
  f.poll();
  find(ready, node => node.type === 'button' && node.props.children === 'Mark all as read').props.onClick();
  await flush();
  assert.equal(f.requests.length, 3);
  assert.equal(f.requests[1].signal.aborted, true);
  assert.equal(f.posts[0][1].action, 'READ_ALL');
  f.requests[2].resolve({ data: { ...payload, unread: 0 } });
  await flush();
  f.requests[1].resolve({ data: payload });
  await flush();
  assert.equal(find(f.render(), node => node.type === 'button' && node.props.children === 'Mark all as read').props.disabled, true);
});
