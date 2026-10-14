export class CheckoutRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "CheckoutRequestError";
  }
}
