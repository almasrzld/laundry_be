import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';
import { ENV } from '../config/env';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('[Unhandled Error]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan internal pada server';

  sendError(res, message, statusCode, ENV.NODE_ENV === 'development' ? err.stack : undefined);
};
