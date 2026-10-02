export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(401, 'unauthorized', message);
  }

  static forbidden(message = 'Not permitted'): AppError {
    return new AppError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(404, 'not_found', message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(409, 'conflict', message, details);
  }

  static notImplemented(message: string): AppError {
    return new AppError(501, 'not_implemented', message);
  }

  static badGateway(message: string, details?: unknown): AppError {
    return new AppError(502, 'bad_gateway', message, details);
  }

  static unavailable(message: string): AppError {
    return new AppError(503, 'service_unavailable', message);
  }

  static timeout(message: string): AppError {
    return new AppError(504, 'timeout', message);
  }
}
