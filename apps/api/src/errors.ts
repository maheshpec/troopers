/**
 * Typed application errors. Keeps a clean trust boundary: handlers throw
 * these, the central error handler maps them to status codes and a safe
 * JSON body that never leaks stack traces or internals (OWASP A05).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string, code = "bad_request") =>
  new AppError(400, code, msg);
export const unauthorized = (msg = "Authentication required") =>
  new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "Insufficient permissions") =>
  new AppError(403, "forbidden", msg);
export const notFound = (msg = "Not found") =>
  new AppError(404, "not_found", msg);
