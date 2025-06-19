/**
 * Base error class for custom errors
 */
class BaseError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.isOperational = isOperational // Distinguish between operational and programming errors
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 404 Not Found Error
 */
class NotFoundError extends BaseError {
  constructor(message = 'Resource not found') {
    super(message, 404)
  }
}

/**
 * 400 Bad Request Error
 */
class BadRequestError extends BaseError {
  constructor(message = 'Bad request') {
    super(message, 400)
  }
}

/**
 * 401 Unauthorized Error
 */
class UnauthorizedError extends BaseError {
  constructor(message = 'Unauthorized') {
    super(message, 401)
  }
}

/**
 * 403 Forbidden Error
 */
class ForbiddenError extends BaseError {
  constructor(message = 'Forbidden') {
    super(message, 403)
  }
}

/**
 * 409 Conflict Error
 */
class ConflictError extends BaseError {
  constructor(message = 'Conflict') {
    super(message, 409)
  }
}

/**
 * 422 Unprocessable Entity Error
 */
class ValidationError extends BaseError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 422)
    this.errors = errors
  }
}

/**
 * 500 Internal Server Error
 */
class InternalServerError extends BaseError {
  constructor(message = 'Internal server error') {
    super(message, 500)
  }
}

export {
  BaseError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  InternalServerError,
}
