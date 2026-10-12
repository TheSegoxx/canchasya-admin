import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TurnoDetalle } from '../../api/agenda';
import { cobrosApi, NOMBRE_METODO } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { Icono } from '../../components/Icono';
import { mensajeDeError } from '../../context/SesionContext';
import { espaciado, radio, useTema } from '../../theme/tema';
import { fechaCorta } from '../../utils/fechas';
import { formatearPesos } from '../../utils/formato';

type Props = {
  turno: TurnoDetalle;
  onCambio: (turno: TurnoDetalle) => void;
  onCobrar: () => void;
  onAgregarExtra: () => void;
};

// Cuenta del turno: precio + extras, los pagos recibidos y lo que falta cobrar
export function CuentaTurno({ turno, onCambio, onCobrar, onAgregarExtra }: Props) {
  const { colores } = useTema();
  const saldo = Math.round((turno.total - turno.pagado) * 100) / 100;
  const cancelado = turno.estado === 'cancelado';

  // Borrar un extra o un pago cargado por error, con confirmación
  const borrar = (titulo: string, detalle: string, accion: () => Promise<{ turno: TurnoDetalle }>) =>
    Alert.alert(titulo, detalle, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            onCambio((await accion()).turno);
          } catch (e) {
            Alert.alert('No se pudo borrar', mensajeDeError(e));
          }
        },
      },
    ]);

  const botonBorrar = (etiqueta: string, onPress: () => void) =>
    cancelado ? null : (
      <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} onPress={onPress} hitSlop={8} style={estilos.borrar}>
        <Icono nombre="borrar" color={colores.error} tamano={18} />
      </Pressable>
    );

  type Opciones = { fuerte?: boolean; color?: string; extra?: React.ReactNode; clave?: string };
  const linea = (texto: string, monto: string, opciones: Opciones = {}) => (
    <View key={opciones.clave} style={estilos.linea}>
      <Text style={[estilos.texto, { color: colores.texto }, opciones.fuerte && estilos.fuerte]}>{texto}</Text>
      <Text style={[estilos.monto, { color: opciones.color ?? colores.texto }, opciones.fuerte && estilos.fuerte]}>{monto}</Text>
      {opciones.extra ?? <View style={estilos.borrar} />}
    </View>
  );

  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <Text style={[estilos.titulo, { color: colores.texto }]}>Cuenta</Text>

      {linea('Turno', formatearPesos(turno.precio))}
      {turno.consumos.map(c =>
        linea(c.cantidad > 1 ? `${c.cantidad} × ${c.descripcion}` : c.descripcion, formatearPesos(c.subtotal), {
          clave: `c${c.id}`,
          extra: botonBorrar(`Borrar ${c.descripcion}`, () =>
            borrar('Borrar extra', `${c.descripcion}: ${formatearPesos(c.subtotal)}`, () => cobrosApi.borrarConsumo(c.id)),
          ),
        }),
      )}
      <View style={[estilos.separador, { backgroundColor: colores.borde }]} />
      {linea('Total', formatearPesos(turno.total), { fuerte: true })}

      {turno.pagos.map(p =>
        linea(
          `${NOMBRE_METODO[p.metodo]} · ${p.fecha === turno.fecha ? '' : `${fechaCorta(p.fecha)} `}${p.hora}`,
          `−${formatearPesos(p.monto)}`,
          {
            clave: `p${p.id}`,
            color: colores.pagado,
            extra: botonBorrar(`Borrar pago de ${formatearPesos(p.monto)}`, () =>
              borrar(
                'Borrar pago',
                `${NOMBRE_METODO[p.metodo]} de ${formatearPesos(p.monto)}. Solo si se cargó por error: también sale de la caja.`,
                () => cobrosApi.borrarPago(p.id),
              ),
            ),
          },
        ),
      )}
      <View style={[estilos.separador, { backgroundColor: colores.borde }]} />
      {saldo > 0
        ? linea('Falta cobrar', formatearPesos(saldo), { fuerte: true, color: colores.ocupada })
        : linea('Pagado', '✓', { fuerte: true, color: colores.pagado })}

      {!cancelado && (
        <View style={estilos.botones}>
          {saldo > 0 && (
            <>
              <Boton titulo={turno.pagado > 0 ? 'Cobrar el saldo' : 'Cobrar'} onPress={onCobrar} />
              <View style={estilos.espacio} />
            </>
          )}
          <Boton titulo="+ Agregar extra" variante="secundario" onPress={onAgregarExtra} />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { padding: espaciado.m, borderRadius: radio, borderWidth: 1, marginTop: espaciado.l },
  titulo: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  linea: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  texto: { flex: 1, fontSize: 15 },
  monto: { fontSize: 15, fontVariant: ['tabular-nums'] },
  fuerte: { fontSize: 17, fontWeight: '700' },
  borrar: { width: 36, alignItems: 'flex-end', justifyContent: 'center' },
  separador: { height: StyleSheet.hairlineWidth, marginVertical: espaciado.xs },
  botones: { marginTop: espaciado.m },
  espacio: { height: espaciado.s },
});
