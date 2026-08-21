// Единственный источник прав администратора — переменная ADMIN_IDS.
//
// Колонка User.isAdmin в схеме есть, но сознательно не читается: права,
// живущие в базе, меняются через ту же админку, которую они защищают, и один
// компромисс аккаунта закрепляется навсегда. ADMIN_IDS правится только в
// панели хостинга.
//
// Раньше этот разбор был скопирован в семь мест (isAdmin, orders ×2, payments,
// paymentService, bot, users) и расходился в деталях: где-то отсекался
// нулевой id, где-то нет. Теперь одна реализация.

/** Telegram id администраторов. Пустые значения и нули отбрасываются. */
export function adminIds(): number[] {
  return (process.env.ADMIN_IDS || '')
    .replace(/["']/g, '')
    .split(',')
    .map((raw) => parseInt(raw.trim(), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/**
 * Админ ли этот Telegram id.
 *
 * Гость браузерного демо приходит с id = 0 (см. validateTelegram) — поэтому
 * ноль отбрасывается: иначе ADMIN_IDS с лишней запятой или нулём открыл бы
 * админку любому анониму.
 */
export function isAdminId(telegramId: number | bigint | undefined | null): boolean {
  if (telegramId === undefined || telegramId === null) return false;
  const id = Number(telegramId);
  if (!Number.isFinite(id) || id <= 0) return false;
  return adminIds().includes(id);
}
