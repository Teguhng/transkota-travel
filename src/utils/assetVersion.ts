import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function getAssetVersion(relativePublicPath: string): string {
  try {
    const filePath = path.resolve(process.cwd(), 'public', relativePublicPath);
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
  } catch {
    return '1';
  }
}
