export interface AppErrorOptions {
  statusCode?: number;
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
  }
}

export class AppConfigurationError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { ...options, statusCode: options.statusCode ?? 500 });
    this.name = "AppConfigurationError";
  }
}
