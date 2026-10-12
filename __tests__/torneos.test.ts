import type { DetalleTorneo, Partido } from '../src/api/torneos';
import { esLibre, nombreRonda, textoProgramacion, textoRonda } from '../src/utils/torneos';

const partido = (datos: Partial<Partido>): Partido => ({
  id: 1,
  ronda: 1,
  orden: 0,
  localId: 1,
  visitanteId: 2,
  resultadoLocal: null,
  resultadoVisitante: null,
  ganadorId: null,
  canchaId: null,
  canchaNombre: null,
  fecha: null,
  hora: null,
  ...datos,
});

test('nombres de las rondas', () => {
  expect(nombreRonda('liga', 3, 5)).toBe('Fecha 3');
  expect(nombreRonda('eliminacion', 3, 3)).toBe('Final');
  expect(nombreRonda('eliminacion', 2, 3)).toBe('Semifinal');
  expect(nombreRonda('eliminacion', 1, 3)).toBe('Cuartos de final');
  expect(nombreRonda('eliminacion', 1, 6)).toBe('Ronda 1');
});

test('libre: primera ronda con un solo equipo', () => {
  expect(esLibre(partido({ visitanteId: null }))).toBe(true);
  expect(esLibre(partido({}))).toBe(false);
  // En la ronda 2 un lugar vacío es "a definir", no libre
  expect(esLibre(partido({ ronda: 2, visitanteId: null }))).toBe(false);
});

test('texto para compartir una fecha', () => {
  const detalle: DetalleTorneo = {
    torneo: { id: 1, nombre: 'Liga Primavera', deporte: 'futbol5', formato: 'liga', estado: 'en_curso', equipos: 2 },
    equipos: [
      { id: 1, nombre: 'Los Pibes', integrantes: null, telefono: null },
      { id: 2, nombre: 'La Banda', integrantes: null, telefono: null },
    ],
    partidos: [partido({ resultadoLocal: 3, resultadoVisitante: 1, fecha: '2026-10-17', hora: '20:00', canchaNombre: 'Cancha 1' })],
    tabla: null,
    campeonId: null,
  };
  expect(textoProgramacion(detalle.partidos[0])).toBe('sáb 17/10 20:00 · Cancha 1');
  expect(textoRonda(detalle, 1)).toBe('🏆 Liga Primavera — Fecha 1\n• Los Pibes vs La Banda 3-1 (sáb 17/10 20:00 · Cancha 1)');
});
