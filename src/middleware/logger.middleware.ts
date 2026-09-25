import { Request, Response, NextFunction } from 'express';
import pc from 'picocolors';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });

  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Tentukan warna berdasarkan status code
    let statusFormatted = pc.bold(pc.green(statusCode.toString()));
    if (statusCode >= 500) {
      statusFormatted = pc.bold(pc.red(statusCode.toString()));
    } else if (statusCode >= 400) {
      statusFormatted = pc.bold(pc.yellow(statusCode.toString()));
    } else if (statusCode >= 300) {
      statusFormatted = pc.bold(pc.cyan(statusCode.toString()));
    }

    // Tentukan warna berdasarkan HTTP Method
    let methodFormatted = pc.bold(pc.cyan(`[${req.method}]`));
    if (req.method === 'POST') methodFormatted = pc.bold(pc.green(`[${req.method}]`));
    if (req.method === 'PUT' || req.method === 'PATCH') methodFormatted = pc.bold(pc.yellow(`[${req.method}]`));
    if (req.method === 'DELETE') methodFormatted = pc.bold(pc.red(`[${req.method}]`));

    const logMessage = `${pc.gray(`[${timestamp}]`)} ${methodFormatted} ${pc.white(req.originalUrl)} ${pc.gray('➜')} ${statusFormatted} ${pc.gray(`(${duration}ms)`)}`;

    console.log(logMessage);

    // Tampilkan payload body untuk non-GET jika ada
    if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.password) sanitizedBody.password = '******';
      console.log(`  ${pc.gray('└─ Payload:')}`, JSON.stringify(sanitizedBody));
    }
  });

  next();
};
