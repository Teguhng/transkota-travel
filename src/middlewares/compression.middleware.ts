import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';

const COMPRESSIBLE_CONTENT_TYPE =
  /text\/|application\/(json|javascript|xml)|image\/svg\+xml/i;
const MIN_COMPRESS_BYTES = 1024;

export function compressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'HEAD') {
    next();
    return;
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (!/\bgzip\b/i.test(acceptEncoding)) {
    next();
    return;
  }

  const originalSend = res.send.bind(res);

  res.send = function compressedSend(body?: any): Response {
    if (
      res.headersSent ||
      res.getHeader('Content-Encoding') ||
      body === undefined ||
      body === null
    ) {
      return originalSend(body);
    }

    if (typeof body !== 'string' && !Buffer.isBuffer(body)) {
      return originalSend(body);
    }

    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    if (buffer.byteLength < MIN_COMPRESS_BYTES) {
      return originalSend(body);
    }

    const existingType = res.getHeader('Content-Type');
    const inferredType =
      existingType !== undefined
        ? String(existingType)
        : typeof body === 'string'
          ? 'text/html; charset=utf-8'
          : '';

    if (!COMPRESSIBLE_CONTENT_TYPE.test(inferredType)) {
      return originalSend(body);
    }

    if (!existingType && typeof body === 'string') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }

    const compressed = zlib.gzipSync(buffer, {
      level: zlib.constants.Z_BEST_SPEED,
    });

    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(compressed.byteLength));

    const varyHeader = String(res.getHeader('Vary') || '');
    if (!/\baccept-encoding\b/i.test(varyHeader)) {
      res.setHeader(
        'Vary',
        varyHeader ? `${varyHeader}, Accept-Encoding` : 'Accept-Encoding'
      );
    }

    return originalSend(compressed);
  };

  next();
}
