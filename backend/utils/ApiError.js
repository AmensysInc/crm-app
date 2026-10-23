/**
 * Lightweight operational error carrying an HTTP status code.
 * Throw this from controllers/services to return clean, predictable responses.
 */
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
