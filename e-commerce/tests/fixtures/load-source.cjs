const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

module.exports = function sourceLoader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const filename = path.resolve(__dirname, '../..', file);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename }).outputText;
    const loaded = { exports: {} };
    cache.set(file, loaded.exports);
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })((name) => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), loaded, loaded.exports);
    cache.set(file, loaded.exports);
    return loaded.exports;
  }
  return load;
};
