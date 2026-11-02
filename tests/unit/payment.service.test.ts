import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentService } from '../../src/services/payment.service.js';
import { pembayaranRepository } from '../../src/repositories/pembayaran.repository.js';
import fs from 'fs/promises';

describe('PaymentService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitPaymentProof validation', () => {
    it('should throw error if file is missing', async () => {
      await expect(
        paymentService.submitPaymentProof(1, 10, 'REF123', 'BCA 123456', undefined)
      ).rejects.toThrow('Berkas bukti transfer wajib diunggah.');
    });

    it('should unlink uploaded file if repository call fails', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'bukti',
        originalname: 'struk.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: './storage/uploads',
        filename: 'test-uuid.jpg',
        path: './storage/uploads/test-uuid.jpg',
        buffer: Buffer.from('')
      } as any;

      const unlinkSpy = vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);

      vi.spyOn(pembayaranRepository, 'submitPaymentProof').mockRejectedValue(
        new Error('Database procedure failed')
      );

      await expect(
        paymentService.submitPaymentProof(1, 10, 'REF123', 'BCA 123456', mockFile)
      ).rejects.toThrow('Database procedure failed');

      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });

    it('should call repository submitPaymentProof on valid input', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'bukti',
        originalname: 'struk.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: './storage/uploads',
        filename: 'test-uuid.jpg',
        path: './storage/uploads/test-uuid.jpg',
        buffer: Buffer.from('')
      } as any;

      const repoSpy = vi.spyOn(pembayaranRepository, 'submitPaymentProof').mockResolvedValue();

      await paymentService.submitPaymentProof(
        1,
        10,
        'REF123',
        'BCA 123456',
        mockFile
      );

      expect(repoSpy).toHaveBeenCalledWith(1, 10, 'REF123', 'BCA 123456', 'test-uuid.jpg');
    });
  });

  describe('verifyPayment', () => {
    it('should call repository.verifyPayment with correct parameters', async () => {
      const verifySpy = vi.spyOn(pembayaranRepository, 'verifyPayment').mockResolvedValue();

      await paymentService.verifyPayment(50, 2, true, '');

      expect(verifySpy).toHaveBeenCalledWith(50, 2, true, '');
    });
  });
});
