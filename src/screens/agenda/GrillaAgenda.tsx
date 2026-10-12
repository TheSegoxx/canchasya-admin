import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Agenda, Bloqueo, CanchaAgenda, Turno } from '../../api/agenda';
import { Icono } from '../../components/Icono';
import { Colores, espaciado, useTema } from '../../theme/tema';
import { PASO_MINUTOS, turnoActivo } from '../../utils/agenda';
import { aHora, aMinutos, minutosAhora } from '../../utils/horas';

type Props = {
  agenda: Agenda;
  esHoy: boolean;
  // En días pasados no se pueden cargar turnos: los casilleros libres no responden
  esPasado: boolean;
  onLibre: (canchaId: number, hora: string) => void;
  onTurno: (turno: Turno) => void;
  onBloqueo: (bloqueo: Bloqueo, cancha: CanchaAgenda) => void;
};

const ALTO_CASILLERO = 44; // 30 minutos
const PX_POR_MINUTO = ALTO_CASILLERO / PASO_MINUTOS;
const ANCHO_HORAS = 52;
const ANCHO_MINIMO_COLUMNA = 116;
const MARGEN = 10; // para que la etiqueta de la primera hora no quede cortada

// Semáforo: sin pagar = rojo, señado = amarillo, pagado = azul
export function colorDeTurno(turno: Turno, colores: Colores): string {
  if (turno.estado === 'cancelado') {
    return colores.inactivo;
  }
  return turno.estadoPago === 'pagado' ? colores.pagado : turno.estadoPago === 'senado' ? colores.senado : colores.ocupada;
}

// Grilla del día: una columna por cancha y una fila cada 30 minutos.
// Tocar un casillero libre carga un turno ahí; tocar un turno lo abre.
export function GrillaAgenda({ agenda, esHoy, esPasado, onLibre, onTurno, onBloqueo }: Props) {
  const { colores } = useTema();
  const { width } = useWindowDimensions();
  const vertical = useRef<ScrollViewInstance>(null);
  const cabecera = useRef<ScrollViewInstance>(null);
  const [ahora, setAhora] = useState(minutosAhora);

  const canchas = agenda.canchas.filter(c => c.habilitada);
  const apertura = aMinutos(agenda.complejo.horaApertura);
  const cierre = aMinutos(agenda.complejo.horaCierre);
  const filas = Math.ceil((cierre - apertura) / PASO_MINUTOS);
  const alto = filas * ALTO_CASILLERO;
  const anchoColumna = Math.max(ANCHO_MINIMO_COLUMNA, Math.floor((width - ANCHO_HORAS) / Math.max(canchas.length, 1)));
  const posicion = (hora: string) => (aMinutos(hora) - apertura) * PX_POR_MINUTO;

  // La línea de "ahora" se mueve sola cada minuto
  useEffect(() => {
    if (!esHoy) {
      return;
    }
    const intervalo = setInterval(() => setAhora(minutosAhora()), 60000);
    return () => clearInterval(intervalo);
  }, [esHoy]);

  // Hoy se abre mostrando la hora actual (con una hora de margen arriba)
  useEffect(() => {
    if (esHoy) {
      const y = Math.max(0, (minutosAhora() - apertura - 60) * PX_POR_MINUTO);
      requestAnimationFrame(() => vertical.current?.scrollTo({ y, animated: false }));
    }
  }, [esHoy, apertura, agenda.fecha]);

  if (canchas.length === 0) {
    return (
      <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
        No hay canchas habilitadas. Cargalas o habilitalas desde la pestaña Canchas.
      </Text>
    );
  }

  const horasEnPunto: number[] = [];
  for (let m = Math.ceil(apertura / 60) * 60; m <= cierre; m += 60) {
    horasEnPunto.push(m);
  }
  const lineaAhora = esHoy && ahora >= apertura && ahora <= cierre ? (ahora - apertura) * PX_POR_MINUTO : null;

  return (
    <View style={estilos.flex}>
      {/* Nombres de las canchas: se desplazan de costado junto con la grilla */}
      <View style={[estilos.cabecera, { backgroundColor: colores.superficie, borderBottomColor: colores.borde }]}>
        <View style={{ width: ANCHO_HORAS }} />
        <ScrollView ref={cabecera} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          {canchas.map(c => (
            <View key={c.id} style={[estilos.nombreCancha, { width: anchoColumna }]}>
              <Icono nombre={c.deporte} color={colores.primario} tamano={18} />
              <Text numberOfLines={1} style={[estilos.textoCancha, { color: colores.texto }]}>
                {c.nombre}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView ref={vertical} contentContainerStyle={estilos.contenido}>
        <View style={estilos.fila}>
          <View style={{ width: ANCHO_HORAS, height: alto }}>
            {horasEnPunto.map(m => (
              <Text
                key={m}
                style={[estilos.hora, { top: (m - apertura) * PX_POR_MINUTO - 8, color: colores.textoSecundario }]}>
                {aHora(m)}
              </Text>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={e => cabecera.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })}>
            <View style={[estilos.fila, { height: alto }]}>
              {canchas.map(cancha => (
                <View
                  key={cancha.id}
                  style={[estilos.columna, { width: anchoColumna, height: alto, borderLeftColor: colores.borde }]}>
                  {Array.from({ length: filas }, (_, i) => {
                    const hora = aHora(apertura + i * PASO_MINUTOS);
                    const enPunto = (apertura + i * PASO_MINUTOS) % 60 === 0;
                    return (
                      <Pressable
                        key={hora}
                        accessibilityRole="button"
                        accessibilityLabel={`${cancha.nombre}, ${hora}, libre`}
                        disabled={esPasado}
                        onPress={() => onLibre(cancha.id, hora)}
                        style={({ pressed }) => [
                          estilos.casillero,
                          {
                            // Las medias horas con una línea más tenue
                            borderTopColor: enPunto ? colores.borde : colores.borde + '66',
                            backgroundColor: pressed ? colores.primario + '22' : 'transparent',
                          },
                        ]}
                      />
                    );
                  })}

                  {agenda.bloqueos
                    .filter(b => b.canchaId === cancha.id)
                    .map(b => (
                      <Pressable
                        key={`b${b.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${cancha.nombre} bloqueada de ${b.horaDesde} a ${b.horaHasta}: ${b.motivo}`}
                        onPress={() => onBloqueo(b, cancha)}
                        style={[
                          estilos.bloque,
                          {
                            top: Math.max(0, posicion(b.horaDesde)),
                            height: Math.min(alto, posicion(b.horaHasta)) - Math.max(0, posicion(b.horaDesde)) - 2,
                            backgroundColor: colores.inactivo + '40',
                            borderLeftColor: colores.inactivo,
                          },
                        ]}>
                        <View style={estilos.filaBloque}>
                          <Icono nombre="candado" color={colores.textoSecundario} tamano={14} />
                          <Text numberOfLines={2} style={[estilos.motivo, { color: colores.textoSecundario }]}>
                            {b.motivo}
                          </Text>
                        </View>
                      </Pressable>
                    ))}

                  {agenda.turnos
                    .filter(t => t.canchaId === cancha.id && turnoActivo(t))
                    .map(t => {
                      const color = colorDeTurno(t, colores);
                      const altoTurno = posicion(t.horaFin) - posicion(t.horaInicio) - 2;
                      return (
                        <Pressable
                          key={t.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.horaInicio} a ${t.horaFin}, ${t.cliente.nombre}`}
                          onPress={() => onTurno(t)}
                          style={({ pressed }) => [
                            estilos.bloque,
                            {
                              top: posicion(t.horaInicio),
                              height: altoTurno,
                              backgroundColor: color + '2E',
                              borderLeftColor: color,
                              opacity: pressed ? 0.7 : t.estado === 'jugado' ? 0.55 : 1,
                            },
                          ]}>
                          <View style={estilos.filaBloque}>
                            <Text numberOfLines={1} style={[estilos.cliente, { color: colores.texto }]}>
                              {t.cliente.nombre}
                            </Text>
                            {t.turnoFijoId !== null && <Icono nombre="repetir" color={colores.textoSecundario} tamano={13} />}
                          </View>
                          {altoTurno >= 40 && (
                            <Text style={[estilos.horario, { color: colores.textoSecundario }]}>
                              {t.horaInicio} a {t.horaFin}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                </View>
              ))}

              {lineaAhora !== null && (
                <View pointerEvents="none" style={[estilos.ahora, { top: lineaAhora, backgroundColor: colores.error }]} />
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  vacio: { fontSize: 15, textAlign: 'center', padding: espaciado.l },
  cabecera: { flexDirection: 'row', borderBottomWidth: 1 },
  nombreCancha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espaciado.s,
    paddingHorizontal: espaciado.xs,
  },
  textoCancha: { fontSize: 14, fontWeight: '700', marginLeft: espaciado.xs, flexShrink: 1 },
  contenido: { paddingVertical: MARGEN, paddingBottom: 96 },
  fila: { flexDirection: 'row' },
  hora: { position: 'absolute', right: 6, fontSize: 12, fontVariant: ['tabular-nums'] },
  columna: { borderLeftWidth: 1 },
  casillero: { height: ALTO_CASILLERO, borderTopWidth: 1 },
  bloque: {
    position: 'absolute',
    left: 3,
    right: 3,
    borderRadius: 6,
    borderLeftWidth: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  filaBloque: { flexDirection: 'row', alignItems: 'center' },
  cliente: { flex: 1, fontSize: 13, fontWeight: '700' },
  horario: { fontSize: 12, marginTop: 1 },
  motivo: { flex: 1, fontSize: 12, fontWeight: '600', marginLeft: 4 },
  ahora: { position: 'absolute', left: 0, right: 0, height: 2 },
});
