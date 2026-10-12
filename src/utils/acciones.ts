import { Alert, Linking } from 'react-native';
import { linkWhatsApp, numeroInternacional } from './telefono';

// Abre WhatsApp con el chat del cliente y el mensaje ya escrito (el dueño solo toca enviar)
export async function abrirWhatsApp(telefono: string, mensaje: string): Promise<void> {
  try {
    await Linking.openURL(linkWhatsApp(telefono, mensaje));
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
