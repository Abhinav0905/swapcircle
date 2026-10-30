/** A domain rejection safe to describe to the person changing an exchange. */
export class ExchangeError extends Error {
  readonly status = 400;

  constructor(message: string, readonly code = "invalid_exchange") {
    super(message);
    this.name = "ExchangeError";
  }
}
