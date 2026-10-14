import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export interface ProcessedImageResult {
  fileName: string;
  filePath: string;
  relativeUrl: string;
  fileSizeBytes: number;
  format: string;
}

export class ImageUtil {
  private static readonly MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/pjpeg',
    'image/x-png',
    'image/webp',
    'application/octet-stream',
  ];
  private static readonly ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

  /**
   * Validasi format file foto (Hanya JPG, JPEG, dan PNG yang diizinkan)
   */
  static validateImageFormat(mimeType?: string, originalName?: string): void {
    const mime = (mimeType || '').toLowerCase();
    const ext = originalName ? path.extname(originalName).toLowerCase() : '';

    const isMimeValid = mime ? this.ALLOWED_MIME_TYPES.includes(mime) : true;
    const isExtValid = ext ? this.ALLOWED_EXTENSIONS.includes(ext) : true;

    if (!isMimeValid && !isExtValid) {
      throw new Error('Format file tidak valid. Hanya file gambar dengan format JPG, JPEG, atau PNG yang diizinkan.');
    }
  }

  /**
   * Mengonversi gambar ke WebP dan memastikan ukuran file maksimal 1MB
   */
  static async processAndSavePaymentProof(
    buffer: Buffer,
    orderId: string | number,
    originalName?: string,
    mimeType?: string
  ): Promise<ProcessedImageResult> {
    this.validateImageFormat(mimeType, originalName);

    // Verifikasi format asli dari binary metadata menggunakan sharp
    let imageMetadata;
    try {
      imageMetadata = await sharp(buffer).metadata();
    } catch (err: any) {
      throw new Error(`Data gambar rusak atau tidak valid: ${err.message}`);
    }

    const detectedFormat = (imageMetadata.format || '').toLowerCase();
    const supportedFormats = ['jpeg', 'jpg', 'png', 'webp'];
    if (!supportedFormats.includes(detectedFormat)) {
      throw new Error(
        `Format gambar ${detectedFormat.toUpperCase()} tidak didukung. Hanya file JPG, JPEG, dan PNG yang diperbolehkan.`
      );
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'payment_proofs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uuid = crypto.randomUUID();
    const fileName = `${uuid}.webp`;
    const fullFilePath = path.join(uploadDir, fileName);
    const relativeUrl = `/uploads/payment_proofs/${fileName}`;

    // Mulai proses sharp: resize ke resolusi optimal (max width/height 1600px) dan convert ke WebP
    let quality = 85;
    let webpBuffer = await sharp(buffer)
      .rotate() // Auto-orient berdasarkan EXIF orientation
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();

    // Jika ukuran masih > 1MB, turunkan quality secara bertahap hingga <= 1MB
    while (webpBuffer.length > this.MAX_FILE_SIZE_BYTES && quality > 30) {
      quality -= 15;
      webpBuffer = await sharp(buffer)
        .rotate()
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();
    }

    // Tulis buffer final ke disk
    await fs.promises.writeFile(fullFilePath, webpBuffer);

    return {
      fileName,
      filePath: fullFilePath,
      relativeUrl,
      fileSizeBytes: webpBuffer.length,
      format: 'webp',
    };
  }
}
