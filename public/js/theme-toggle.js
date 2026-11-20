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
  const isInitialDark = document.documentElement.classList.contains('dark');
  toggleBtns.forEach((btn) => updateIcon(btn, isInitialDark));

  toggleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        cancelAnimationFrame(transitionFrame);
        root.classList.add('theme-switching');
        const isDark = root.classList.toggle('dark');

        // Let the browser paint the new theme before restoring hover transitions.
        transitionFrame = requestAnimationFrame(() => {
          transitionFrame = requestAnimationFrame(() => {
            root.classList.remove('theme-switching');
          });
        });

        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateIcon(btn, isDark);
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
