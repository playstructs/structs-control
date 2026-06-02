export class NotImplementedError extends Error {
  constructor(method = "method") {
    super(`Not implemented: ${method}`);
    this.name = "NotImplementedError";
  }
}
