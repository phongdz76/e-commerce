// One foreground request owns the view. Polling must not replace it, and
// cancelled responses must not update data, errors or loading indicators.
export function createRequestScope() {
  let current: AbortController | null = null;

  return {
    get pending() {
      return current !== null;
    },
    begin(replace = false) {
      if (current && !replace) return null;
      current?.abort();
      const request = new AbortController();
      current = request;
      return request;
    },
    finish(request: AbortController) {
      if (current !== request) return false;
      current = null;
      return true;
    },
    cancel() {
      current?.abort();
      current = null;
    },
  };
}
