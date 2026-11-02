// Operator Receipt Zoom & Rotate Utility
document.addEventListener('DOMContentLoaded', () => {
  const img = document.querySelector('#receipt-preview-img');
  const rotateBtn = document.querySelector('#btn-rotate-receipt');
  const zoomInBtn = document.querySelector('#btn-zoom-in');
  const zoomOutBtn = document.querySelector('#btn-zoom-out');
  const resetBtn = document.querySelector('#btn-reset-preview');

  if (!img) return;

  let currentRotation = 0;
  let currentScale = 1;

  function applyTransform() {
    img.style.transform = `rotate(${currentRotation}deg) scale(${currentScale})`;
  }

  if (rotateBtn) {
    rotateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      currentRotation = (currentRotation + 90) % 360;
      applyTransform();
    });
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentScale < 3) {
        currentScale += 0.25;
        applyTransform();
      }
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentScale > 0.5) {
        currentScale -= 0.25;
        applyTransform();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      currentRotation = 0;
      currentScale = 1;
      applyTransform();
    });
  }
});

