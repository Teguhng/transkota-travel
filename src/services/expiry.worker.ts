import { jadwalRepository } from '../repositories/jadwal.repository.js';

let intervalHandle: NodeJS.Timeout | null = null;

export async function runHoldSeatCleanup(): Promise<void> {
  try {
    const expiredScheduleIds = await jadwalRepository.findSchedulesWithExpiredHolds();
    if (expiredScheduleIds.length > 0) {
      console.log(`[Expiry Worker] Menemukan ${expiredScheduleIds.length} jadwal dengan kursi tertahan kedaluwarsa...`);
      for (const id of expiredScheduleIds) {
        try {
          await jadwalRepository.releaseExpiredHolds(id);
          console.log(`[Expiry Worker] Sukses melepaskan kursi kedaluwarsa untuk Jadwal ID ${id}`);
        } catch (scheduleErr) {
          console.error(`[Expiry Worker] Gagal memproses jadwal ID ${id}:`, scheduleErr);
        }
      }
    }
  } catch (err) {
    console.error('[Expiry Worker Error]:', err);
  }
}

export function startExpiryWorker(intervalMs: number = 5 * 60 * 1000): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }
  console.log(`[Expiry Worker] Background worker diaktifkan (interval: ${intervalMs / 1000} detik).`);
  // Jalankan segera saat pertama kali start
  runHoldSeatCleanup();
  intervalHandle = setInterval(runHoldSeatCleanup, intervalMs);
}

export function stopExpiryWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[Expiry Worker] Background worker dihentikan.');
  }
}

