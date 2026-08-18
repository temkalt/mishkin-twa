// Маска и проверка российского телефона.
//
// Раньше поле было свободным: в заказ попадало что угодно, включая номера, по
// которым невозможно перезвонить. Теперь ввод нормализуется на лету.

/** Только цифры, приведённые к формату 7XXXXXXXXXX (11 цифр). */
export function phoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // 8 (495)… и 495… приводим к 7…
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  else if (digits.length > 0 && !digits.startsWith('7')) digits = `7${digits}`;

  return digits.slice(0, 11);
}

/** 79161234567 → +7 (916) 123-45-67 */
export function formatPhone(raw: string): string {
  const digits = phoneDigits(raw);
  if (digits.length <= 1) return digits ? '+7 ' : '';

  const rest = digits.slice(1);
  const parts = [
    rest.slice(0, 3),
    rest.slice(3, 6),
    rest.slice(6, 8),
    rest.slice(8, 10),
  ].filter(Boolean);

  let out = '+7';
  if (parts[0]) out += ` (${parts[0]}`;
  if (parts[0] && parts[0].length === 3) out += ')';
  if (parts[1]) out += ` ${parts[1]}`;
  if (parts[2]) out += `-${parts[2]}`;
  if (parts[3]) out += `-${parts[3]}`;

  return out;
}

/** Полный номер: 7 + 10 цифр. */
export function isValidPhone(raw: string): boolean {
  return phoneDigits(raw).length === 11;
}

/** То, что уходит на сервер. */
export function phoneToE164(raw: string): string {
  const digits = phoneDigits(raw);
  return digits.length === 11 ? `+${digits}` : raw.trim();
}

/** Индекс России — ровно 6 цифр (пустой допустим). */
export function isValidPostal(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length === 0 || /^\d{6}$/.test(trimmed);
}
