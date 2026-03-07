export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayISODate(): string {
  return toISODate(new Date());
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(parseISODate(value));
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(parseISODate(value));
}

export function getWeekRange(reference: Date = new Date()) {
  const start = new Date(reference);
  const dayOfWeek = (reference.getDay() + 6) % 7;
  start.setDate(reference.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { end, start };
}

export function getMonthRange(reference: Date = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { end, start };
}

export function getYearRange(reference: Date = new Date()) {
  const start = new Date(reference.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(reference.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);

  return { end, start };
}

export function isDateWithinRange(value: string, start: Date, end: Date): boolean {
  const current = parseISODate(value).getTime();
  return current >= start.getTime() && current <= end.getTime();
}

