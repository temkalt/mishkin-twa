// HTML-страница встроенного эмулятора оплаты.
//
// Открывается вместо страницы ЮKassa, когда реквизитов нет (или включён
// YOOKASSA_MODE=mock). Позволяет пройти оба сценария — успешную оплату и
// отказ — и увидеть, как приложение реагирует на уведомление.
//
// Баннер «ЭМУЛЯТОР» намеренно крупный: страница не должна выглядеть как
// настоящая оплата ни для нас, ни для заказчика на демонстрации.

interface MockPageParams {
  paymentId: string;
  orderId: number;
  amountRub: string;
  returnUrl: string;
  status: 'PENDING' | 'PAID' | 'CANCELED' | 'UNPAID' | 'REFUNDED';
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

const SHELL_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px 16px; background: #FDFBF7;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Manrope, sans-serif;
    color: #2C2824;
    background-image:
      radial-gradient(60% 45% at 15% 0%, rgba(58,90,42,.10) 0%, transparent 60%),
      radial-gradient(50% 40% at 100% 10%, rgba(212,163,115,.14) 0%, transparent 55%);
  }
  .card {
    width: 100%; max-width: 400px; background: #fff; border-radius: 24px; padding: 24px;
    box-shadow: 0 18px 60px -20px rgba(44,40,36,.35); animation: rise .45s cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes rise { from { opacity: 0; transform: translateY(18px) scale(.97); } }
  .banner {
    display: flex; align-items: center; gap: 8px; margin: -8px -8px 18px; padding: 10px 12px;
    background: #FEF3C7; color: #92400E; border-radius: 14px; font-size: 11px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
  }
  .brand { font-size: 13px; font-weight: 800; letter-spacing: .24em; text-transform: uppercase; color: #3A5A2A; }
  .muted { color: #8C867D; font-size: 13px; margin: 2px 0 0; }
  .amount { font-size: 34px; font-weight: 800; letter-spacing: -.02em; margin: 18px 0 4px; }
  .row { display: flex; justify-content: space-between; font-size: 13px; color: #8C867D; padding: 7px 0; }
  .row + .row { border-top: 1px solid #EBE5D9; }
  .fields { margin: 18px 0 4px; display: grid; gap: 10px; }
  .field {
    padding: 13px 14px; border: 1px solid #EBE5D9; border-radius: 14px; background: #FAF8F4;
    font-size: 14px; color: #8C867D; display: flex; justify-content: space-between;
  }
  .field b { color: #2C2824; font-weight: 600; font-variant-numeric: tabular-nums; }
  button {
    width: 100%; border: 0; border-radius: 16px; padding: 16px; font-size: 15px; font-weight: 700;
    font-family: inherit; cursor: pointer; transition: transform .12s cubic-bezier(.22,1,.36,1), opacity .2s;
  }
  button:active { transform: scale(.97); }
  button[disabled] { opacity: .5; cursor: default; }
  .pay { background: #3A5A2A; color: #fff; box-shadow: 0 10px 30px -10px rgba(58,90,42,.6); margin-top: 18px; }
  .fail { background: transparent; color: #B4453C; margin-top: 6px; font-size: 13px; padding: 12px; }
  .back { background: #EBE5D9; color: #2C2824; margin-top: 14px; }
  .result { text-align: center; padding: 8px 0 0; }
  .result .icon { font-size: 46px; line-height: 1; animation: pop .5s cubic-bezier(.22,1,.36,1) both; }
  @keyframes pop { from { opacity: 0; transform: scale(.5); } }
  .result h1 { font-size: 21px; margin: 14px 0 6px; }
  .spinner {
    display: inline-block; width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.35);
    border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -3px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

function shell(body: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Оплата заказа · MISHKIN</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>${SHELL_STYLES}</style></head><body><div class="card">${body}</div></body></html>`;
}

/** Страница «оплаты»: сумма, фейковые реквизиты и две кнопки-сценария. */
export function renderMockCheckout(params: MockPageParams): string {
  const { paymentId, orderId, amountRub, returnUrl } = params;

  if (params.status === 'PAID' || params.status === 'CANCELED') {
    return renderMockResult({ ...params, outcome: params.status === 'PAID' ? 'succeeded' : 'canceled' });
  }

  return shell(`
  <div class="banner">⚠️ Эмулятор оплаты · денег не спишет</div>
  <div class="brand">Mishkin</div>
  <p class="muted">Заказ №${orderId}</p>
  <div class="amount">${escapeHtml(amountRub)} ₽</div>
  <div class="row"><span>Способ оплаты</span><span>Банковская карта</span></div>
  <div class="row"><span>Получатель</span><span>MISHKIN</span></div>
  <div class="fields">
    <div class="field"><span>Карта</span><b>4111 11•• •••• 1111</b></div>
    <div class="field"><span>Срок / CVC</span><b>12/30 · •••</b></div>
  </div>
  <button class="pay" id="pay">Оплатить ${escapeHtml(amountRub)} ₽</button>
  <button class="fail" id="fail">Смоделировать отказ банка</button>
  <script>
    var paymentId = ${JSON.stringify(paymentId)};
    function send(outcome, btn) {
      var buttons = document.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
      if (outcome === 'succeeded') btn.innerHTML = '<span class="spinner"></span> Обработка…';
      fetch('/api/payments/mock/' + encodeURIComponent(paymentId) + '/' + outcome, { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function () { location.replace(location.pathname + '?done=' + outcome); })
        .catch(function () {
          btn.textContent = 'Ошибка сети — попробуйте снова';
          for (var i = 0; i < buttons.length; i++) buttons[i].disabled = false;
        });
    }
    document.getElementById('pay').onclick = function () { send('succeeded', this); };
    document.getElementById('fail').onclick = function () { send('canceled', this); };
  </script>`);
}

/** Экран результата с возвратом в Mini App. */
export function renderMockResult(params: MockPageParams & { outcome: 'succeeded' | 'canceled' }): string {
  const ok = params.outcome === 'succeeded';
  return shell(`
  <div class="banner">⚠️ Эмулятор оплаты · денег не спишет</div>
  <div class="result">
    <div class="icon">${ok ? '✅' : '❌'}</div>
    <h1>${ok ? 'Оплата прошла' : 'Оплата не прошла'}</h1>
    <p class="muted">${ok
      ? `Заказ №${params.orderId} на ${escapeHtml(params.amountRub)} ₽ отмечен как оплаченный.`
      : 'Платёж отклонён. Заказ сохранён — можно попробовать оплатить снова.'}</p>
  </div>
  <button class="back" id="back">Вернуться в приложение</button>
  <script>
    document.getElementById('back').onclick = function () {
      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.close) { tg.close(); return; }
      location.href = ${JSON.stringify(params.returnUrl)};
    };
  </script>`);
}
