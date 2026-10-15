// A small hook adapter for exercising real event handlers and async effects without a DOM.
function hookRuntime() {
  const slots = [], effects = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback: callback => callback,
    useMemo: callback => callback(),
    createContext: () => ({ Provider: () => null }),
    useContext: () => null,
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
      }
    },
  };
  return { react, render(component, props) { cursor = 0; return component(props); }, async flush() { for (const effect of effects.splice(0)) effect(); await new Promise(resolve => setImmediate(resolve)); } };
}
function findElement(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (Array.isArray(tree)) { for (const child of tree) { const found = findElement(child, predicate); if (found) return found; } return null; }
  return predicate(tree) ? tree : findElement(tree.props?.children, predicate);
}
module.exports = { hookRuntime, findElement };
