import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  req: Request;
  clientIp?: string | null;
  location?: string | null;
  userAgent?: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

/**
 * Helper untuk mendeteksi IP Address klien (HP / Komputer) tanpa port
 */
export const extractClientIp = (req: Request): string => {
  let ip = '127.0.0.1';

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0]?.trim();
    if (rawIp) ip = rawIp.replace(/^::ffff:/, '');
  } else {
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      ip = realIp.trim().replace(/^::ffff:/, '');
    } else {
      const sockAddr = req.socket?.remoteAddress || req.ip || '127.0.0.1';
      ip = sockAddr.replace(/^::ffff:/, '');
    }
  }

  // Normalisasi IPv6 localhost ke 127.0.0.1
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }

  // Jika ip berisi port (misal "192.168.1.10:54321"), ambil hanya bagian IP
  if (ip.includes(':') && !ip.includes('::') && ip.split(':').length === 2) {
    ip = ip.split(':')[0];
  }

  return ip;
};

/**
 * Helper untuk mendeteksi lokasi GPS user real-time
 */
export const extractClientLocation = (req: Request): string | null => {
  // 1. Cek Header GPS Latitude & Longitude dari browser/mobile client
  const lat = req.headers['x-latitude'] || req.headers['x-client-latitude'] || (req.body && req.body.latitude);
  const lng = req.headers['x-longitude'] || req.headers['x-client-longitude'] || (req.body && req.body.longitude);

  if (lat && lng && String(lat).trim() !== '' && String(lng).trim() !== '') {
    const parsedLat = parseFloat(String(lat));
    const parsedLng = parseFloat(String(lng));
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      return `GPS (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)})`;
    }
  }

  // 2. Cek Custom header x-client-location / x-client-gps
  const customGps = req.headers['x-client-location'] || req.headers['x-client-gps'] || req.headers['x-app-location'];
  if (typeof customGps === 'string' && customGps.trim()) {
    return customGps.trim();
  }

  // 3. Cek koordinat dari pickup / delivery address di body (jika ada)
  if (req.body && typeof req.body === 'object') {
    if (req.body.pickup_latitude && req.body.pickup_longitude) {
      const pLat = parseFloat(String(req.body.pickup_latitude));
      const pLng = parseFloat(String(req.body.pickup_longitude));
      if (!isNaN(pLat) && !isNaN(pLng)) {
        return `GPS (${pLat.toFixed(5)}, ${pLng.toFixed(5)})`;
      }
    }
  }

  return null;
};

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = extractClientIp(req);
  const location = extractClientLocation(req);
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';

  requestContext.run(
    {
      req,
      clientIp,
      location,
      userAgent,
    },
    () => {
      next();
    }
  );
};
