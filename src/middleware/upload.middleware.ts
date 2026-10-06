import multer from 'multer';
import { Request } from 'express';
import path from 'path';

// Simpan file di memori terlebih dahulu agar dapat langsung divalidasi & dikonversi oleh sharp
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/pjpeg',
  'image/x-png',
  'image/webp',
  'application/octet-stream',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mime);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);

  // Izinkan jika MIME type sesuai, atau ekstensi file merupakan gambar yang didukung
  if (isMimeAllowed || isExtAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung! Hanya JPG, JPEG, dan PNG yang diperbolehkan.'));
  }
};

const multerUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // Izinkan upload raw hingga 15MB sebelum di-convert & dikompresi ke WebP <= 1MB
  },
  fileFilter,
}).fields([
  { name: 'proof', maxCount: 1 },
  { name: 'proof_image', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

export const uploadPaymentProofMiddleware = (req: Request, res: any, next: any) => {
  multerUpload(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
      const filesMap = req.files as Record<string, Express.Multer.File[]>;
      req.file = filesMap.proof?.[0] || filesMap.proof_image?.[0] || filesMap.image?.[0];
    }
    next();
  });
};

