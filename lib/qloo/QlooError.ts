import { AppError } from "../domain/errors";

/** Safe errors cross the API boundary; upstream bodies and credentials never do. */
export class QlooError extends AppError {
  constructor(message: string, code: string, status = 502) {
    super(message, status, code);
    this.name = "QlooError";
  }
}
