// Formatos argentinos: "$ 24.000" o "$ 24.000,50"
export function formatearPesos(monto: number): string {
  const [entero, decimales] = Math.abs(monto).toFixed(2).split('.');
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const signo = monto < 0 ? '-' : '';
  return `${signo}$ ${conPuntos}${decimales === '00' ? '' : `,${decimales}`}`;
}

// Interpreta lo que escribe el dueño: "24000", "24.000", "$ 24.000,50" o "24000.50".
// El punto es de miles solo si separa grupos de 3 cifras; si no, es la coma decimal
// que pone el teclado numérico. Devuelve null si no es un importe válido.
export function leerPesos(texto: string): number | null {
  const limpio = texto.replace(/[$\s]/g, '');
  let numero: string;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpio)) {
    numero = limpio.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+([.,]\d{1,2})?$/.test(limpio)) {
    numero = limpio.replace(',', '.');
  } else {
    return null;
  }
  return Number(numero);
}

// Para precargar un campo de precio al editar: 24000 -> "24000", 24000.5 -> "24000,50"
export function pesosParaEditar(monto: number): string {
  return Number.isInteger(monto) ? String(monto) : monto.toFixed(2).replace('.', ',');
}
