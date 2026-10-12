import { api } from './cliente';

export type Foto = { id: number; ruta: string };

export type ArchivoFoto = { uri: string; tipo: string; nombre: string };

// Endpoints /fotos de la API
export const fotosApi = {
  // Sin canchaId es una foto del complejo
  subir: (archivo: ArchivoFoto, canchaId?: number) => {
    const formulario = new FormData();
    formulario.append('foto', { uri: archivo.uri, type: archivo.tipo, name: archivo.nombre } as unknown as Blob);
    if (canchaId !== undefined) {
      formulario.append('canchaId', String(canchaId));
    }
    return api<{ foto: Foto }>('/fotos', 'POST', formulario);
  },
  borrar: (id: number) => api<null>(`/fotos/${id}`, 'DELETE'),
};

export const MAXIMO_FOTOS_COMPLEJO = 6;
export const MAXIMO_FOTOS_CANCHA = 3;
