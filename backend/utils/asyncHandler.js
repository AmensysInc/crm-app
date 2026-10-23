/**
 * Wraps an async route handler so rejected promises are forwarded to Express's
 * error-handling middleware instead of crashing the process. This keeps every
 * controller free of repetitive try/catch blocks.
 *
 * @param {Function} fn async (req, res, next) => {}
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
