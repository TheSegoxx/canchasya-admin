import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MetodoManual, NOMBRE_METODO } from '../../api/cobros';
import { CATEGORIAS, dashboardApi, TipoMovimiento } from '../../api/dashboard';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { Pantalla } from '../../components/Pantalla';
import { SelectorDia } from '../../components/SelectorDia';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';
import { hoyISO } from '../../utils/fechas';
import { leerPesos } from '../../utils/formato';

type Props = NativeStackScreenProps<RutasApp, 'Movimiento'>;

// Cargar un gasto (sueldos, luz, compras...) u otro ingreso que no viene de un turno
export function MovimientoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const [tipo, setTipo] = useState<TipoMovimiento>(route.params.tipo ?? 'egreso');
  const [categoria, setCategoria] = useState(CATEGORIAS[route.params.tipo ?? 'egreso'][0].clave);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoManual>('efectivo');
  const [fecha, setFecha] = useState(hoyISO());
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cambiarTipo = (nuevo: TipoMovimiento) => {
    setTipo(nuevo);
    setCategoria(CATEGORIAS[nuevo][0].clave);
  };

  const guardar = async () => {
    if (guardando) {
      return;
    }
    const importe = leerPesos(monto);
    if (importe === null || importe <= 0) {
      setError('Escribí el monto solo con números (por ejemplo, 18000).');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await dashboardApi.crearMovimiento({
        tipo,
        categoria,
        descripcion: descripcion.trim() || null,
        monto: importe,
        metodo,
        fecha,
      });
      navigation.goBack();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <View style={estilos.chips}>
        <Chip texto="Gasto" seleccionado={tipo === 'egreso'} onPress={() => cambiarTipo('egreso')} />
        <Chip texto="Otro ingreso" seleccionado={tipo === 'ingreso'} onPress={() => cambiarTipo('ingreso')} />
      </View>
      {tipo === 'ingreso' && (
        <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
          Lo que cobrás por los turnos se suma solo: acá va lo que entra por otro lado.
        </Text>
      )}

      <Text style={[estilos.seccion, { color: colores.texto }]}>Categoría</Text>
      <View style={estilos.chips}>
        {CATEGORIAS[tipo].map(c => (
          <Chip key={c.clave} texto={c.nombre} seleccionado={categoria === c.clave} onPress={() => setCategoria(c.clave)} />
        ))}
      </View>

      <CampoTexto etiqueta="Monto ($)" value={monto} onChangeText={setMonto} keyboardType="numeric" placeholder="18000" />

      <Text style={[estilos.seccion, { color: colores.texto }]}>{tipo === 'egreso' ? 'Lo pagaste con' : 'Lo recibiste en'}</Text>
      <View style={estilos.chips}>
        {(['efectivo', 'transferencia'] as MetodoManual[]).map(m => (
          <Chip key={m} texto={NOMBRE_METODO[m]} seleccionado={metodo === m} onPress={() => setMetodo(m)} />
        ))}
      </View>

      <SelectorDia etiqueta="Fecha" fecha={fecha} onCambiar={setFecha} />
      <CampoTexto
        etiqueta="Detalle (opcional)"
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder={tipo === 'egreso' ? 'Factura de luz de septiembre' : 'Cumpleaños del sábado'}
        maxLength={100}
      />

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo={tipo === 'egreso' ? 'Guardar gasto' : 'Guardar ingreso'} onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  ayuda: { fontSize: 14, lineHeight: 20, marginBottom: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
