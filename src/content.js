(function () {
  'use strict';

  let observer = null;
  let isProcessing = false;

  function parseMoney(text) {
    if (!text) return 0;
    const cleanText = text.replace(/[\s\u00a0₴]/g, '').replace(',', '.');
    const value = parseFloat(cleanText);
    return isNaN(value) ? 0 : value;
  }

  function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('.');
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }

  // Розрахунок та підсвічування ТОП картки
  function highlightTopCard() {
    const cards = Array.from(document.querySelectorAll('.investment-unit[data-ovdz-yield]'));
    if (cards.length === 0) return;

    // Шукаємо максимальну дохідність
    let maxYield = -1;
    cards.forEach((card) => {
      const y = parseFloat(card.dataset.ovdzYield || '0');
      if (y > maxYield) maxYield = y;
    });

    if (maxYield <= 0) return;

    cards.forEach((card) => {
      const y = parseFloat(card.dataset.ovdzYield || '0');
      const isTop = Math.abs(y - maxYield) < 0.001;

      if (isTop) {
        if (!card.classList.contains('ovdz-top-card')) {
          card.classList.add('ovdz-top-card');
        }
        const wrapper = card.querySelector('.wrapper') || card;
        // Додаємо плашку тільки якщо її ще немає
        if (!wrapper.querySelector('.ovdz-top-badge')) {
          const badge = document.createElement('div');
          badge.className = 'ovdz-top-badge';
          badge.innerHTML = '<span>🔥</span> ТОП ДОХІДНІСТЬ';
          wrapper.appendChild(badge);
        }
      } else {
        // Якщо картка більше не ТОП (наприклад, змінилися фільтри) — знімаємо позначку
        if (card.classList.contains('ovdz-top-card')) {
          card.classList.remove('ovdz-top-card');
          const badge = card.querySelector('.ovdz-top-badge');
          if (badge) badge.remove();
        }
      }
    });
  }

  function processOvdpCards() {
    // Якщо процес вже йде, не запускаємо повторно
    if (isProcessing) return;
    isProcessing = true;

    // Тимчасово вимикаємо спостереження, щоб наші власні зміни в DOM не викликали рекурсію
    if (observer) observer.disconnect();

    try {
      const cards = document.querySelectorAll('.investment-unit');

      cards.forEach((card) => {
        // Вартість купівлі
        let purchasePrice = 0;
        const valuesWrapper = card.querySelectorAll('.unit-values-wrapper, .unit-values');
        valuesWrapper.forEach((el) => {
          if (el.textContent.includes('Вартість купівлі')) {
            const strong = el.querySelector('strong');
            if (strong) purchasePrice = parseMoney(strong.textContent);
          }
        });

        // Дата погашення
        let maturityDate = null;
        valuesWrapper.forEach((el) => {
          if (el.textContent.includes('Дата погашення')) {
            const strong = el.querySelector('strong');
            if (strong) maturityDate = parseDate(strong.textContent);
          }
        });

        // Сумуємо майбутні виплати
        let totalPayout = 0;
        const paymentRows = card.querySelectorAll('.details-wrapper .payment .value');
        paymentRows.forEach((row) => {
          totalPayout += parseMoney(row.textContent);
        });

        if (!purchasePrice || !maturityDate || !totalPayout) return;

        // Розрахунки
        const today = new Date();
        const diffTime = maturityDate.getTime() - today.getTime();
        const daysToMaturity = Math.max(1, Math.ceil(diffTime / (1000 * 3600 * 24)));
        const yearsToMaturity = daysToMaturity / 365.25;

        const totalProfitUah = totalPayout - purchasePrice;
        const totalReturnPercent = (totalProfitUah / purchasePrice) * 100;
        const annualYieldPercent = (totalReturnPercent / daysToMaturity) * 365.25;

        card.dataset.ovdzYield = annualYieldPercent.toFixed(4);

        // Вставляємо розрахунок тільки якщо його ще немає в цієї картки
        if (!card.querySelector('.ovdz-calc-container')) {
          const targetContainer = card.querySelector('.unit-body .disp_col');
          if (targetContainer) {
            const calcBlock = document.createElement('div');
            calcBlock.className = 'ovdz-calc-container';
            calcBlock.innerHTML = `
              <div class="ovdz-calc-divider">Розрахунок інвестора</div>

              <div class="unit-values disp_row_between unit-values-wrapper ovdz-highlight">
                <span class="center_col up_case"><strong>Реальна річна дохідність:</strong></span>
                <span class="center_col"><strong class="ovdz-green">${annualYieldPercent.toFixed(2)}% річних</strong></span>
              </div>

              <div class="unit-values disp_row_between unit-values-wrapper">
                <span class="center_col up_case">Прибуток за весь час (₴):</span>
                <span class="center_col"><strong>+${totalProfitUah.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴</strong></span>
              </div>

              <div class="unit-values disp_row_between unit-values-wrapper">
                <span class="center_col up_case">Прибуток за весь час (%):</span>
                <span class="center_col"><strong>+${totalReturnPercent.toFixed(2)}%</strong></span>
              </div>

              <div class="unit-values disp_row_between unit-values-wrapper">
                <span class="center_col up_case">Термін утримання:</span>
                <span class="center_col"><strong>${daysToMaturity} днів (~${yearsToMaturity.toFixed(1)} р.)</strong></span>
              </div>
            `;
            targetContainer.appendChild(calcBlock);
          }
        }
      });

      // Виділяємо кращу картку
      highlightTopCard();
    } finally {
      // Відновлюємо спостереження після завершення всіх маніпуляцій
      if (observer) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      isProcessing = false;
    }
  }

  // Налаштовуємо MutationObserver
  observer = new MutationObserver(() => {
    processOvdpCards();
  });

  // Первинний запуск
  processOvdpCards();
})();
