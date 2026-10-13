import React, { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/Texto';
import { BarChart } from 'react-native-gifted-charts';
import type { Resumen } from '../../api/dashboard';
import { espaciado, FUENTE, useTema } from '../../theme/tema';
import { formatearPesos } from '../../utils/formato';
import { etiquetaDeClave, etiquetaLarga, montoCompacto, Periodo, topeRedondo } from '../../utils/periodos';

type Props = { serie: Resumen['serie']; periodo: Periodo };

// Ancho de cada barra según cuántos grupos hay (nunca más de 24 px)
const ANCHO_BARRA: Record<Periodo, number> = { semana: 14, mes: 8, anio: 10 };
const SEPARACION_GRUPO: Record<Periodo, number> = { semana: 18, mes: 10, anio: 12 };
const ANCHO_EJE = 40;
const SECCIONES = 4;

// Ingresos y egresos por día (semana, mes) o por mes (año): dos barras por grupo.
// Tocar un grupo muestra sus montos debajo; también se puede ver como tabla.
export function GraficoBalance({ serie, periodo }: Props) {
  const { colores } = useTema();
  const { width } = useWindowDimensions();
  const [elegido, setElegido] = useState<number | null>(null);
  const [comoTabla, setComoTabla] = useState(false);

  const hayDatos = serie.some(p => p.ingresos > 0 || p.egresos > 0);
  const barra = ANCHO_BARRA[periodo];
  // En el mes se rotulan algunos días para que las etiquetas no se pisen
  const conEtiqueta = (clave: string) =>
    periodo !== 'mes' || [1, 5, 10, 15, 20, 25, 30].includes(Number(clave.slice(8)));
  // Al elegir un grupo, los demás se atenúan
  const color = (base: string, i: number) => (elegido === null || elegido === i ? base : base + '55');

  const datos = serie.flatMap((p, i) => [
    {
      value: p.ingresos,
      frontColor: color(colores.serieIngresos, i),
      spacing: 2,
      label: conEtiqueta(p.clave) ? etiquetaDeClave(p.clave, periodo) : '',
      labelWidth: barra * 2 + 2 + SEPARACION_GRUPO[periodo],
      labelTextStyle: [estilos.etiqueta, { color: colores.textoSecundario }],
      onPress: () => setElegido(actual => (actual === i ? null : i)),
    },
    {
      value: p.egresos,
      frontColor: color(colores.serieEgresos, i),
      spacing: SEPARACION_GRUPO[periodo],
      onPress: () => setElegido(actual => (actual === i ? null : i)),
    },
  ]);

  const detalle = elegido !== null ? serie[elegido] : null;

  return (
    <View>
      {/* Leyenda: el color va en la muestra, el texto queda en color de texto */}
      <View style={estilos.leyenda}>
        <Muestra color={colores.serieIngresos} texto="Ingresos" />
        <Muestra color={colores.serieEgresos} texto="Egresos" />
        <Pressable
          accessibilityRole="button"
          onPress={() => setComoTabla(t => !t)}
          hitSlop={8}
          style={estilos.alternar}>
          <Text style={[estilos.textoAlternar, { color: colores.primario }]}>{comoTabla ? 'Ver gráfico' : 'Ver tabla'}</Text>
        </Pressable>
      </View>

      {!hayDatos ? (
        <Text style={[estilos.vacio, { color: colores.textoSecundario }]}>
          No hay ingresos ni egresos en este período.
        </Text>
      ) : comoTabla ? (
        <View>
          <View style={[estilos.filaTabla, { borderBottomColor: colores.borde }]}>
            <Text style={[estilos.celdaFecha, estilos.encabezado, { color: colores.textoSecundario }]}>Fecha</Text>
            <Text style={[estilos.celda, estilos.encabezado, { color: colores.textoSecundario }]}>Ingresos</Text>
            <Text style={[estilos.celda, estilos.encabezado, { color: colores.textoSecundario }]}>Egresos</Text>
          </View>
          {serie
            .filter(p => p.ingresos > 0 || p.egresos > 0)
            .map(p => (
              <View key={p.clave} style={[estilos.filaTabla, { borderBottomColor: colores.borde }]}>
                <Text style={[estilos.celdaFecha, { color: colores.texto }]}>{etiquetaLarga(p.clave)}</Text>
                <Text style={[estilos.celda, { color: colores.texto }]}>{formatearPesos(p.ingresos)}</Text>
                <Text style={[estilos.celda, { color: colores.texto }]}>{formatearPesos(p.egresos)}</Text>
              </View>
            ))}
        </View>
      ) : (
        <>
          <BarChart
            data={datos}
            height={180}
            width={width - espaciado.m * 4 - ANCHO_EJE}
            barWidth={barra}
            initialSpacing={8}
            endSpacing={8}
            noOfSections={SECCIONES}
            maxValue={topeRedondo(Math.max(...serie.flatMap(p => [p.ingresos, p.egresos])), SECCIONES)}
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
            yAxisLabelWidth={ANCHO_EJE}
            formatYLabel={etiqueta => montoCompacto(Number(etiqueta))}
            yAxisTextStyle={[estilos.etiqueta, { color: colores.textoSecundario }]}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={colores.borde}
            rulesType="solid"
            rulesColor={colores.borde}
            rulesThickness={1}
            disableScroll={periodo !== 'mes'}
            showScrollIndicator={false}
          />
          <Text accessibilityLiveRegion="polite" style={[estilos.detalle, { color: colores.texto }]}>
            {detalle
              ? `${etiquetaLarga(detalle.clave)}: ingresos ${formatearPesos(detalle.ingresos)} · egresos ${formatearPesos(detalle.egresos)}`
              : `Tocá ${periodo === 'anio' ? 'un mes' : 'un día'} para ver los montos.`}
          </Text>
        </>
      )}
    </View>
  );
}

function Muestra({ color, texto }: { color: string; texto: string }) {
  const { colores } = useTema();
  return (
    <View style={estilos.muestra}>
      <View style={[estilos.cuadrito, { backgroundColor: color }]} />
      <Text style={[estilos.textoMuestra, { color: colores.texto }]}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  leyenda: { flexDirection: 'row', alignItems: 'center', marginBottom: espaciado.m },
  muestra: { flexDirection: 'row', alignItems: 'center', marginRight: espaciado.m },
  cuadrito: { width: 12, height: 12, borderRadius: 3, marginRight: espaciado.xs },
  textoMuestra: { fontSize: 14 },
  alternar: { marginLeft: 'auto' },
  textoAlternar: { fontSize: 14, fontWeight: '700' },
  etiqueta: { fontSize: 11, fontFamily: FUENTE },
  vacio: { fontSize: 15, paddingVertical: espaciado.l, textAlign: 'center' },
  detalle: { fontSize: 14, marginTop: espaciado.s },
  filaTabla: { flexDirection: 'row', minHeight: 36, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  encabezado: { fontSize: 13, fontWeight: '700' },
  celdaFecha: { flex: 1.2, fontSize: 14 },
  celda: { flex: 1, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
