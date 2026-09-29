import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { sendError } from '../utils/response.util';
import { UserCodeUtil } from '../utils/user-code.util';
import { AuthRepository } from '../modules/auth/auth.repository';

const authRepository = new AuthRepository();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string | number;
    email: string;
    name: string;
    role?: string;
    role_code?: string;
    session_id?: string;
    user_code?: string | number;
    created_at?: Date | string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token && req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    sendError(res, 'Token autentikasi tidak ditemukan atau format salah', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    req.user = decoded;

    // Single active session check (1 akun = 1 sesi aktif di seluruh perangkat)
    if (decoded && decoded.id && decoded.session_id) {
      const activeSession = await authRepository.getActiveSession(decoded.id);
      if (activeSession && activeSession !== decoded.session_id) {
        sendError(
          res,
          'Sesi Anda telah berakhir karena akun telah masuk di perangkat lain.',
          401,
          { code: 'CONCURRENT_LOGIN' }
        );
        return;
      }
    }

    if (req.user && !req.user.user_code) {
      const code = await UserCodeUtil.resolveUserCodeAsync(req.user);
      if (code) {
        req.user.user_code = String(code);
      }
    }

    next();
  } catch (error) {
    sendError(res, 'Token tidak valid atau telah kedaluwarsa', 401);
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
      if (decoded && decoded.id && decoded.session_id) {
        const activeSession = await authRepository.getActiveSession(decoded.id);
        if (activeSession && activeSession !== decoded.session_id) {
          req.user = undefined;
          next();
          return;
        }
      }
      req.user = decoded;
      if (req.user && !req.user.user_code) {
        const code = await UserCodeUtil.resolveUserCodeAsync(req.user);
        if (code) {
          req.user.user_code = String(code);
        }
      }
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  next();
};
