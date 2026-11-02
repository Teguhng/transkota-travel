import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookingService } from '../../src/services/booking.service.js';
import { pemesananRepository } from '../../src/repositories/pemesanan.repository.js';
import { userRepository } from '../../src/repositories/user.repository.js';
import { pembayaranRepository } from '../../src/repositories/pembayaran.repository.js';

describe('BookingService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createOnlineBooking validation', () => {
    it('should throw an error if no seats are selected', async () => {
      await expect(
        bookingService.createOnlineBooking(1, 10, [], ['Budi'], ['08123456789'])
      ).rejects.toThrow('Harap pilih minimal 1 kursi.');
    });

    it('should throw an error if seat count differs from passenger count', async () => {
      await expect(
        bookingService.createOnlineBooking(1, 10, [1, 2], ['Budi'], ['08123456789'])
      ).rejects.toThrow('Jumlah nama penumpang harus sesuai dengan jumlah kursi yang dipilih.');
    });

    it('should call repository.createBooking when valid', async () => {
      const mockResult = {
        id_pemesanan: 99,
        kode_booking: 'BK-TEST99',
        total: 100000,
        jatuh_tempo: new Date(Date.now() + 15 * 60 * 1000)
      };

      vi.spyOn(pemesananRepository, 'createBooking').mockResolvedValue(mockResult);

      const res = await bookingService.createOnlineBooking(
        1,
        10,
        [1],
        ['Budi Santoso'],
        ['081234567890']
      );

      expect(res.kode_booking).toBe('BK-TEST99');
      expect(pemesananRepository.createBooking).toHaveBeenCalledTimes(1);
    });
  });

  describe('processWalkinBooking validation', () => {
    it('should provision user if not exists and process cash payment', async () => {
      vi.spyOn(userRepository, 'findMemberByPhone').mockResolvedValue(null);
      vi.spyOn(userRepository, 'createMember').mockResolvedValue(77);
      vi.spyOn(pemesananRepository, 'createBooking').mockResolvedValue({
        id_pemesanan: 101,
        kode_booking: 'WLK-101',
        total: 75000,
        jatuh_tempo: new Date()
      });
      vi.spyOn(pembayaranRepository, 'processCashPayment').mockResolvedValue();

      const booking = await bookingService.processWalkinBooking(
        2, // operator id
        10,
        3,
        'Walk-in Customer',
        '081299991111'
      );

      expect(booking.kode_booking).toBe('WLK-101');
      expect(userRepository.createMember).toHaveBeenCalled();
      expect(pembayaranRepository.processCashPayment).toHaveBeenCalledWith(101, 2);
    });
  });
});
