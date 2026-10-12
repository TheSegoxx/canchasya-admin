/**
 * Teléfonos de clientes. La API los guarda normalizados: un celular argentino
 * queda en 10 cifras (código de área + número, sin 0 ni 15).
 */

// "1155551234" -> "11 5555-1234"; "3515123456" -> "351 512-3456"
export function formatearTelefono(telefono: string): string {
  if (telefono.length !== 10) {
    return telefono;
  }
  const area = telefono.startsWith('11') ? 2 : 3;
  const numero = telefono.slice(area);
  return `${telefono.slice(0, area)} ${numero.slice(0, -4)}-${numero.slice(-4)}`;
}

// WhatsApp necesita el número internacional: 54 + 9 (celular) + las 10 cifras
export function numeroInternacional(telefono: string): string {
  return telefono.length === 10 ? `549${telefono}` : telefono;
}

export function linkWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${numeroInternacional(telefono)}?text=${encodeURIComponent(mensaje)}`;
}
