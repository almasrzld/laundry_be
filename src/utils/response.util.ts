import { Response } from 'express';
import { CryptoUtil } from './crypto.util';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): Response => {
  const transformedData = CryptoUtil.transformResponse(data);
  const response: ApiResponse<T> = {
    success: true,
    message,
    data: transformedData,
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string = 'Terjadi kesalahan',
  statusCode: number = 500,
  error?: any
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(error ? { error } : {}),
  };
  return res.status(statusCode).json(response);
};
