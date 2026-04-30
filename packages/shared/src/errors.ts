// Typed application errors for consistent error handling across bot and API

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      404,
      'NOT_FOUND',
    );
    this.name = 'NotFoundError';
  }
}

export class InsufficientFundsError extends AppError {
  constructor(userId: string, required: number, available: number) {
    super(
      `Insufficient funds for user ${userId}: required ${required}, available ${available}`,
      400,
      'INSUFFICIENT_FUNDS',
    );
    this.name = 'InsufficientFundsError';
  }
}

export class CooldownError extends AppError {
  public readonly remainingMs: number;

  constructor(userId: string, type: string, remainingMs: number) {
    super(
      `Cooldown active for user ${userId} (${type}): ${Math.ceil(remainingMs / 1000)}s remaining`,
      429,
      'COOLDOWN_ACTIVE',
    );
    this.name = 'CooldownError';
    this.remainingMs = remainingMs;
  }
}

export class ValidationError extends AppError {
  constructor(field: string, reason: string) {
    super(`Validation failed: ${field} — ${reason}`, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class LockContentionError extends AppError {
  constructor(resource: string) {
    super(`Lock contention on ${resource}`, 429, 'LOCK_CONTENTION');
    this.name = 'LockContentionError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}
