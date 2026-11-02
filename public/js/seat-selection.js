// Interactive Minibus 5-Seats Cabin Controller - Wayfind Transit System
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('#minibus-cabin');
  if (!container) return;

  const seatButtons = container.querySelectorAll('.seat-btn[data-status="tersedia"]');
  const selectedSeatsInput = document.querySelector('#selected-seats-container');
  const passengerFormsContainer = document.querySelector('#passenger-forms');
  const totalPriceDisplay = document.querySelector('#total-price-display');
  const submitBtn = document.querySelector('#submit-booking-btn');
  const seatPrice = Number(container.getAttribute('data-price') || 0);

  const selectedSeats = new Map(); // seatId -> seatNumber

  seatButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSeat(btn);
    });

    // Keyboard Accessibility (WCAG 2.1 AAA)
    btn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleSeat(btn);
      }
    });
  });

  function toggleSeat(btn) {
    const seatId = btn.getAttribute('data-seat-id');
    const seatNo = btn.getAttribute('data-seat-no');

    if (selectedSeats.has(seatId)) {
      selectedSeats.delete(seatId);
      btn.classList.remove('bg-ink', 'text-paper', 'border-ink', 'ring-2', 'ring-accent');
      btn.classList.add('bg-paper-3', 'text-ink', 'border-rule');
      btn.setAttribute('aria-pressed', 'false');
    } else {
      selectedSeats.set(seatId, seatNo);
      btn.classList.remove('bg-paper-3', 'text-ink', 'border-rule');
      btn.classList.add('bg-ink', 'text-paper', 'border-ink', 'ring-2', 'ring-accent');
      btn.setAttribute('aria-pressed', 'true');
    }

    renderSelection();
  }

  function renderSelection() {
    if (!selectedSeatsInput || !passengerFormsContainer) return;

    selectedSeatsInput.innerHTML = '';
    passengerFormsContainer.innerHTML = '';

    const count = selectedSeats.size;
    if (submitBtn) {
      submitBtn.disabled = count === 0;
    }

    if (totalPriceDisplay) {
      const total = count * seatPrice;
      totalPriceDisplay.textContent = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
      }).format(total);
    }

    let idx = 0;
    selectedSeats.forEach((seatNo, seatId) => {
      // Hidden input
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'kursi_ids[]';
      input.value = seatId;
      selectedSeatsInput.appendChild(input);

      // Passenger Name Form Item (Wayfind Transit Box)
      const formCard = document.createElement('div');
      formCard.className = 'p-4 border-bar border-rule bg-paper-3 mb-3';
      formCard.innerHTML = `
        <div class="flex items-center justify-between mb-3 border-b-hair border-rule pb-2">
          <span class="text-xs font-bold uppercase text-accent">Kursi No. ${seatNo}</span>
          <span class="text-xs font-bold text-muted">Penumpang #${idx + 1}</span>
        </div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold uppercase text-ink mb-1">Nama Lengkap Penumpang *</label>
            <input type="text" name="penumpang_nama[]" required placeholder="Nama sesuai identitas KTP/SIM"
                   class="w-full px-3 py-2 text-xs font-bold border-bar border-rule bg-paper text-ink focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-ink mb-1">Nomor Telepon (WhatsApp)</label>
            <input type="tel" name="penumpang_telepon[]" placeholder="08xxxxxxxxxx"
                   class="w-full px-3 py-2 text-xs font-bold border-bar border-rule bg-paper text-ink focus:outline-none focus:border-accent" />
          </div>
        </div>
      `;
      passengerFormsContainer.appendChild(formCard);
      idx++;
    });

    if (count === 0) {
      passengerFormsContainer.innerHTML = `
        <div class="text-center py-10 border-bar border-dashed border-rule text-muted text-xs font-bold uppercase">
          Silakan pilih minimal 1 kursi pada denah kabin.
        </div>
      `;
    }
  }
});
