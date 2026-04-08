function getIsoWeekParts(inputDate) {
  const date = new Date(inputDate);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;

  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);

  return {
    year: utcDate.getUTCFullYear(),
    week
  };
}

export function getWeeklyPeriodKey(inputDate = new Date()) {
  const { year, week } = getIsoWeekParts(inputDate);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
