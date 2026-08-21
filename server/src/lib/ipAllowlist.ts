// Проверка, что уведомление действительно пришло от ЮKassa.
// Список адресов: https://yookassa.ru/developers/using-api/webhooks
//
// Это вторая линия защиты. Первая и главная — перезапрос статуса платежа
// через API (см. paymentService.syncPaymentStatus): подделать уведомление
// можно, а ответ api.yookassa.ru — нет.

const V4_RANGES: Array<{ base: string; bits: number }> = [
  { base: '185.71.76.0', bits: 27 },
  { base: '185.71.77.0', bits: 27 },
  { base: '77.75.153.0', bits: 25 },
  { base: '77.75.156.11', bits: 32 },
  { base: '77.75.156.35', bits: 32 },
  { base: '77.75.154.128', bits: 25 },
];

const V6_PREFIXES = ['2a02:5180:'];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8) | n;
  }
  return value >>> 0;
}

/** Нормализуем адрес: Express может отдать ::ffff:185.71.76.1 или ::1. */
function normalize(raw: string): string {
  let ip = raw.trim();
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'));
  if (ip.toLowerCase().startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

export function isYooKassaIp(rawIp: string | undefined): boolean {
  if (!rawIp) return false;
  const ip = normalize(rawIp);

  const asInt = ipv4ToInt(ip);
  if (asInt !== null) {
    return V4_RANGES.some(({ base, bits }) => {
      const baseInt = ipv4ToInt(base);
      if (baseInt === null) return false;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (asInt & mask) === (baseInt & mask);
    });
  }

  const lower = ip.toLowerCase();
  return V6_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

// Адрес отправителя берём из req.ip, а не разбираем X-Forwarded-For сами.
// Здесь был свой разбор, который брал ЛЕВОЕ значение заголовка, — то есть то,
// что подставил сам клиент: достаточно было прислать
// «X-Forwarded-For: 185.71.76.1», и запрос выглядел как уведомление ЮKassa.
// Express с trust proxy: 1 отбрасывает один хоп прокси справа и отдаёт
// настоящий адрес.
