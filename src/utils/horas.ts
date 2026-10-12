/**
 * Horas como texto "HH:MM" (igual que la API). "24:00" es la medianoche al final del día.
 */

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

export const sumarMinutos = (hora: string, minutos: number) => aHora(aMinutos(hora) + minutos);

// Hora actual del celular en minutos desde las 00:00
export function minutosAhora(): number {
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes();
}

// Dos rangos se pisan si cada uno empieza antes de que termine el otro
export function seSuperponen(inicioA: string, finA: string, inicioB: string, finB: string): boolean {
  return aMinutos(inicioA) < aMinutos(finB) && aMinutos(finA) > aMinutos(inicioB);
}
