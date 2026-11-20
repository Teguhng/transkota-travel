// Hallmark Dual-Theme Switcher (Nordic Slate & Ocean Blue)
(function () {
  const storedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  window.addEventListener('DOMContentLoaded', () => {
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    const root = document.documentElement;
    let transitionFrame;

    // Sinkronkan ikon dengan tema awal
    const isInitialDark = root.classList.contains('dark');
    toggleBtns.forEach((btn) => updateIcon(btn, isInitialDark));

    toggleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        cancelAnimationFrame(transitionFrame);
        root.classList.add('theme-switching');
        // Pastikan aturan transition: none !important sudah terhitung sebelum kelas .dark berubah
        void window.getComputedStyle(root).color;

        const isDark = root.classList.toggle('dark');
        // Flush style tema baru selagi transisi masih nonaktif agar tidak ada komponen yang tertinggal
        void window.getComputedStyle(root).color;

        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        toggleBtns.forEach((toggleBtn) => updateIcon(toggleBtn, isDark));

        // Kembalikan hover transitions setelah browser selesai mengecat tema baru
        transitionFrame = requestAnimationFrame(() => {
          transitionFrame = requestAnimationFrame(() => {
            root.classList.remove('theme-switching');
          });
        });
      });
    });

    function updateIcon(btn, isDark) {
      const sunIcon = btn.querySelector('.sun-icon');
      const moonIcon = btn.querySelector('.moon-icon');
      if (sunIcon && moonIcon) {
        if (isDark) {
          sunIcon.classList.remove('hidden');
          moonIcon.classList.add('hidden');
        } else {
          sunIcon.classList.add('hidden');
          moonIcon.classList.remove('hidden');
        }
      }
    }
  });
})();
