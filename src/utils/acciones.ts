import { Alert, Linking } from 'react-native';
import type { Ubicacion } from '../api/complejo';
import { linkWhatsApp, numeroInternacional } from './telefono';

// Link de Google Maps al punto (abre la app de mapas o el navegador)
export const linkMapa = (u: Ubicacion) => `https://www.google.com/maps/search/?api=1&query=${u.latitud},${u.longitud}`;

export async function abrirMapa(ubicacion: Ubicacion): Promise<void> {
  try {
    await Linking.openURL(linkMapa(ubicacion));
  } catch {
    Alert.alert('No se pudo abrir el mapa', 'Este celular no pudo abrir Google Maps ni el navegador.');
  }
}

// Abre WhatsApp con el chat del cliente y el mensaje ya escrito (el dueño solo toca enviar)
export async function abrirWhatsApp(telefono: string, mensaje: string): Promise<void> {
  try {
    await Linking.openURL(linkWhatsApp(telefono, mensaje));
  } catch {
    Alert.alert('No se pudo abrir WhatsApp', 'Revisá que WhatsApp esté instalado en este celular.');
  }
}

// Abre WhatsApp con el mensaje escrito para elegir a quién mandárselo (un amigo o el grupo).
// Directo a la app; si no abre, por el link web (que pregunta con qué abrirlo)
export async function compartirPorWhatsApp(mensaje: string): Promise<void> {
  const texto = encodeURIComponent(mensaje);
  try {
    await Linking.openURL(`whatsapp://send?text=${texto}`);
  } catch {
    abrirLinkWeb(`https://wa.me/?text=${texto}`);
  }
}

async function abrirLinkWeb(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('No se pudo abrir WhatsApp', 'Revisá que WhatsApp esté instalado en este celular.');
  }
}

export async function llamar(telefono: string): Promise<void> {
  try {
    await Linking.openURL(`tel:+${numeroInternacional(telefono)}`);
  } catch {
    Alert.alert('No se pudo llamar', 'Este celular no pudo abrir el marcador de teléfono.');
  }
}
