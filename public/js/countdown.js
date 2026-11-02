// Real-time sticky countdown timer for order expiry
document.addEventListener('DOMContentLoaded', () => {
  const timerEl = document.querySelector('[data-expires-at]');
  if (!timerEl) return;

  const expiresAtStr = timerEl.getAttribute('data-expires-at');
  if (!expiresAtStr) return;

  const targetTime = new Date(expiresAtStr).getTime();
  const displayEl = timerEl.querySelector('.countdown-display') || timerEl;

  function tick() {
    const now = Date.now();
    const diff = Math.floor((targetTime - now) / 1000);

    if (diff <= 0) {
      displayEl.textContent = '00:00 (Waktu Pembayaran Habis)';
      displayEl.classList.add('text-red-600', 'font-bold');
      return;
    }

    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    displayEl.textContent = formatted;
  }

  tick();
  const timer = setInterval(() => {
    tick();
    if (Date.now() >= targetTime) {
      clearInterval(timer);
    }
  }, 1000);
});

