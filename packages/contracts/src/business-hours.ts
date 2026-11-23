/**
 * Horario de atención de Via Vinilo, en hora de Salta (D-073): lunes a viernes de 8 a 19 y sábados
 * de 8 a 13. Sirve para medir tiempos "hábiles": lo que pasa de noche o el domingo no cuenta.
 * TODO(spec): confirmar el horario con Verónica; hoy es el mismo que usa el bot para decir "fuera de horario".
 */
const SALTA_OFFSET_MS = -3 * 3_600_000; // Salta no cambia la hora en todo el año.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Horas [desde, hasta) de cada día de la semana (0 = domingo). null = cerrado. */
const SCHEDULE: (readonly [number, number] | null)[] = [null, [8, 19], [8, 19], [8, 19], [8, 19], [8, 19], [8, 13]];

/** Milisegundos dentro del horario de atención entre dos momentos. */
export function businessMsBetween(from: Date, to: Date): number {
  // Se trabaja en "hora de Salta" corriendo los dos momentos y usando el reloj UTC.
  const start = from.getTime() + SALTA_OFFSET_MS;
  const end = to.getTime() + SALTA_OFFSET_MS;
  if (!(end > start)) return 0;
  let total = 0;
  for (let day = Math.floor(start / DAY) * DAY; day < end; day += DAY) {
    const hours = SCHEDULE[new Date(day).getUTCDay()];
    if (!hours) continue;
    const open = Math.max(start, day + hours[0] * HOUR);
    const close = Math.min(end, day + hours[1] * HOUR);
    if (close > open) total += close - open;
  }
  return total;
}

/** Tiempo entre dos momentos: corrido, o solo dentro del horario de atención. */
export function elapsedMs(from: Date, to: Date, businessOnly: boolean): number {
  return businessOnly ? businessMsBetween(from, to) : Math.max(0, to.getTime() - from.getTime());
}
