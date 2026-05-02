import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface ErrorResponse {
  error: string;
  statusCode: number;
  details?: string;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: err.message,
      statusCode: err.statusCode,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  const body: ErrorResponse = {
    error: 'Internal Server Error',
    statusCode: 500,
  };

  res.status(500).json(body);
}
