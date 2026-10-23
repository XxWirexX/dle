// Doit rester identique à server/utils/daily.ts#getTodayDateString — sert
// uniquement à détecter côté client qu'on a changé de jour (onglet resté
// ouvert), jamais à calculer la cible du défi elle-même.
const DAILY_TIMEZONE = 'Europe/Paris'

export function getParisDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DAILY_TIMEZONE }).format(new Date())
}
