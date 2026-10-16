const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { CDP } = require("./fixtures/browser-cdp.cjs");

function browser(context = {}) {
  const commands = [];
  const client = Object.create(CDP.prototype);
  client.send = async (method, params) => {
    commands.push({ method, params });
    assert.equal(method, "Runtime.evaluate");
    assert.equal(typeof params.expression, "string");
    assert.equal(params.returnByValue, true);
    assert.equal(params.awaitPromise, true);
    const value = await vm.runInNewContext(params.expression, context);
    return { result: { value: value === undefined ? undefined : JSON.parse(JSON.stringify(value)) } };
  };
  return { client, commands };
}

test("browser evaluation keeps existing expression strings and awaits their results", async () => {
  const { client, commands } = browser();
  assert.deepEqual(await client.evaluate("Promise.resolve({ ready: true, quantity: 1 })"), { ready: true, quantity: 1 });
  assert.equal(commands[0].params.expression, "Promise.resolve({ ready: true, quantity: 1 })");
});

test("return offer browser callback serializes and awaits its URL and SKU arguments", async () => {
  const requests = [];
  const url = '/api/admin/returns/abc?note="quoted"&line=one\ntwo';
  const variantId = 'SKU-"quoted"-\\-\u2028';
  const { client } = browser({
    fetch: async (requestUrl, options) => {
      requests.push({ url: requestUrl, options });
      return options
        ? { status: 200 }
        : { json: async () => ({ case: { version: 7 } }) };
    },
  });
  const result = await client.evaluate(async (endpoint, sku) => {
    const current = await (await fetch(endpoint)).json();
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ action: "EXCHANGE_RESERVE", version: current.case.version, variantId: sku }),
    });
    return response.status === 200;
  }, url, variantId);
  assert.equal(result, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, url);
  assert.equal(requests[1].url, url);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    action: "EXCHANGE_RESERVE", version: 7, variantId,
  });
});

test("invalid evaluation inputs fail before sending a malformed browser command", async () => {
  const { client, commands } = browser();
  await assert.rejects(client.evaluate(undefined), /needs a JavaScript expression or function/);
  await assert.rejects(client.evaluate("location.pathname", "ignored argument"), /arguments require a function/);
  assert.equal(commands.length, 0);
});

test("a browser-side exception still fails the check", async () => {
  const client = Object.create(CDP.prototype);
  client.send = async () => ({ exceptionDetails: { text: "Uncaught" } });
  await assert.rejects(client.evaluate(() => missingBrowserVariable), /Browser evaluation failed/);
});
