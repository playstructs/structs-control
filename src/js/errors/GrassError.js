export class GrassError extends Error {
  constructor(message) {
    super(message);
    this.name = "GrassError";
  }
}
