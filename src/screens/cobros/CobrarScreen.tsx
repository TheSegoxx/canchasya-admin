import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { agendaApi, TurnoDetalle } from '../../api/agenda';
import { cobrosApi, MetodoPago, NOMBRE_METODO } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearPesos, leerPesos, pesosParaEditar } from '../../utils/formato';

type Props = NativeStackScreenProps<RutasApp, 'Cobrar'>;

const centavos = (monto: number) => Math.round(monto * 100) / 100;

// Registrar un pago del turno: la seña, el saldo o todo junto
export function CobrarScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const { turnoId } = route.params;
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [pagaCon, setPagaCon] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      const { turno: datos } = await agendaApi.obtenerTurno(turnoId);
      setTurno(datos);
      setMonto(pesosParaEditar(centavos(datos.total - datos.pagado)));
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, [turnoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!turno) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const saldo = centavos(turno.total - turno.pagado);
  const mitad = Math.round(turno.total / 2);
  const importe = leerPesos(monto);
  const efectivoRecibido = leerPesos(pagaCon);
  const vuelto =
    metodo === 'efectivo' && importe !== null && efectivoRecibido !== null && efectivoRecibido > importe
      ? centavos(efectivoRecibido - importe)
      : null;

  const guardar = async () => {
    if (guardando) {
      return;
    }
    if (importe === null || importe <= 0) {
      setError('Escribí el monto solo con números (por ejemplo, 12000).');
      return;
    }
    if (importe > saldo) {
      setError(`No puede ser más de lo que falta cobrar (${formatearPesos(saldo)}).`);
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await cobrosApi.pagar(turno.id, importe, metodo);
      navigation.goBack();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <Text style={[estilos.cliente, { color: colores.texto }]}>{turno.cliente.nombre}</Text>
      <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
        {turno.cancha.nombre} · {turno.horaInicio} a {turno.horaFin}
      </Text>

      <View style={[estilos.saldo, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        <Text style={[estilos.etiqueta, { color: colores.textoSecundario }]}>Falta cobrar</Text>
        <Text style={[estilos.importe, { color: colores.ocupada }]}>{formatearPesos(saldo)}</Text>
        {turno.pagado > 0 && (
          <Text style={[estilos.detalle, { color: colores.textoSecundario }]}>
            Total {formatearPesos(turno.total)} · ya pagó {formatearPesos(turno.pagado)}
          </Text>
        )}
      </View>

      <CampoTexto etiqueta="Monto que cobrás ($)" value={monto} onChangeText={setMonto} keyboardType="numeric" />
      <View style={estilos.chips}>
        <Chip texto={`Todo: ${formatearPesos(saldo)}`} seleccionado={importe === saldo} onPress={() => setMonto(pesosParaEditar(saldo))} />
        {turno.pagado === 0 && mitad < saldo && (
          <Chip texto={`Seña 50%: ${formatearPesos(mitad)}`} seleccionado={importe === mitad} onPress={() => setMonto(String(mitad))} />
        )}
      </View>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Medio de pago</Text>
      <View style={estilos.chips}>
        {(['efectivo', 'transferencia'] as MetodoPago[]).map(m => (
          <Chip key={m} texto={NOMBRE_METODO[m]} seleccionado={metodo === m} onPress={() => setMetodo(m)} />
        ))}
      </View>

      {metodo === 'efectivo' && (
        <>
          <CampoTexto
            etiqueta="Paga con (opcional, para calcular el vuelto)"
            value={pagaCon}
            onChangeText={setPagaCon}
            keyboardType="numeric"
            placeholder="20000"
          />
          {vuelto !== null && (
            <Text accessibilityLiveRegion="polite" style={[estilos.vuelto, { color: colores.texto }]}>
              Vuelto: {formatearPesos(vuelto)}
            </Text>
          )}
        </>
      )}

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton
        titulo={importe !== null && importe > 0 ? `Registrar cobro de ${formatearPesos(importe)}` : 'Registrar cobro'}
        onPress={guardar}
        cargando={guardando}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cliente: { fontSize: 20, fontWeight: '700' },
  detalle: { fontSize: 14, marginTop: 2 },
  saldo: { alignItems: 'center', padding: espaciado.m, borderRadius: radio, borderWidth: 1, marginVertical: espaciado.l },
  etiqueta: { fontSize: 14, fontWeight: '600' },
  importe: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], marginVertical: espaciado.xs },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  vuelto: { fontSize: 18, fontWeight: '700', marginBottom: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
