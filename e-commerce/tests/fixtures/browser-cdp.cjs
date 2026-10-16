class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const waiter = this.pending.get(message.id);
        if (waiter) {
          this.pending.delete(message.id);
          clearTimeout(waiter.timer);
          if (message.error) waiter.reject(new Error(message.error.message));
          else waiter.resolve(message.result);
        }
      } else {
        this.listeners.get(message.method)?.(message.params);
      }
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Browser command timed out: " + method));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, ...args) {
    if (typeof expression !== "string" && typeof expression !== "function") {
      throw new TypeError("Browser evaluation needs a JavaScript expression or function.");
    }
    if (typeof expression === "string" && args.length) {
      throw new TypeError("Browser evaluation arguments require a function.");
    }
    // CDP accepts source text; JSON.stringify would otherwise omit a function.
    const source = typeof expression === "function"
      ? `(${expression.toString()})(...${JSON.stringify(args)})`
      : expression;
    const result = await this.send("Runtime.evaluate", {
      expression: source,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error("Browser evaluation failed");
    return result.result.value;
  }
  async wait(expression) {
    const start = Date.now();
    while (Date.now() - start < 45000) {
      try {
        if (await this.evaluate("document.readyState !== 'loading' && !!document.body && (" + expression + ")")) return;
      } catch (error) {
        if (!/Execution context was destroyed|Cannot find context with specified id/.test(error.message)) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Timed out waiting for UI");
  }
  close() {
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("Browser closed"));
    }
    this.pending.clear();
    this.socket.close();
  }
}
module.exports = { CDP };
