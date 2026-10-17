import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MetodoManual, NOMBRE_METODO } from '../../api/cobros';
import { CATEGORIAS, dashboardApi, nombreCategoria, TipoMovimiento } from '../../api/dashboard';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { Pantalla } from '../../components/Pantalla';
import { SelectorDia } from '../../components/SelectorDia';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';
import { hoyISO } from '../../utils/fechas';
import { formatearPesos, leerPesos } from '../../utils/formato';

type Props = NativeStackScreenProps<RutasApp, 'Movimiento'>;

/**
 * Cargar un gasto (sueldos, luz, compras...) u otro ingreso que no viene de un turno.
 * Se pueden elegir varias categorías: con una sola se escribe el monto; con varias,
 * cuánto va a cada una (el total es la suma).
 */
export function MovimientoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const [tipo, setTipo] = useState<TipoMovimiento>(route.params.tipo ?? 'egreso');
  // En el orden en que se eligieron
  const [categorias, setCategorias] = useState<string[]>([CATEGORIAS[route.params.tipo ?? 'egreso'][0].clave]);
  const [monto, setMonto] = useState('');
  // Monto de cada categoría cuando hay más de una
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [metodo, setMetodo] = useState<MetodoManual>('efectivo');
  const [fecha, setFecha] = useState(hoyISO());
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cambiarTipo = (nuevo: TipoMovimiento) => {
    setTipo(nuevo);
    setCategorias([CATEGORIAS[nuevo][0].clave]);
    setMontos({});
  };

  const alternarCategoria = (clave: string) => {
    if (categorias.includes(clave)) {
      // Siempre queda al menos una
      if (categorias.length > 1) {
        const quedan = categorias.filter(c => c !== clave);
        // Al volver a una sola, su monto pasa al campo de monto
        if (quedan.length === 1 && montos[quedan[0]]) {
          setMonto(montos[quedan[0]]);
        }
        setCategorias(quedan);
      }
      return;
    }
    // Al pasar de una a dos, lo que ya se escribió queda como el monto de la primera
    if (categorias.length === 1 && monto && !montos[categorias[0]]) {
      setMontos({ ...montos, [categorias[0]]: monto });
    }
    setCategorias([...categorias, clave]);
  };

  const varias = categorias.length > 1;
  const importes = categorias.map(c => leerPesos(varias ? montos[c] ?? '' : monto));
  const total = importes.every(i => i !== null) ? (importes as number[]).reduce((a, b) => a + b, 0) : null;

  const guardar = async () => {
    if (guardando) {
      return;
    }
    if (importes.some(i => i === null || i <= 0)) {
      setError(
        varias
          ? 'Escribí cuánto va a cada categoría, solo con números (por ejemplo, 18000).'
          : 'Escribí el monto solo con números (por ejemplo, 18000).',
      );
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await dashboardApi.crearMovimiento({
        tipo,
        categorias: categorias.map((categoria, i) => ({ categoria, monto: importes[i] as number })),
        descripcion: descripcion.trim() || null,
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

      <Text style={[estilos.seccion, { color: colores.texto }]}>Categorías</Text>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        Podés elegir varias si el {tipo === 'egreso' ? 'gasto' : 'ingreso'} es de más de una cosa.
      </Text>
      <View style={estilos.chips}>
        {CATEGORIAS[tipo].map(c => (
          <Chip
            key={c.clave}
            texto={c.nombre}
            seleccionado={categorias.includes(c.clave)}
            onPress={() => alternarCategoria(c.clave)}
          />
        ))}
      </View>

      {varias ? (
        <>
          {categorias.map(c => (
            <CampoTexto
              key={c}
              etiqueta={`${nombreCategoria(tipo, c)} ($)`}
              value={montos[c] ?? ''}
              onChangeText={texto => setMontos({ ...montos, [c]: texto })}
              keyboardType="numeric"
              placeholder="18000"
            />
          ))}
          <Text accessibilityLiveRegion="polite" style={[estilos.total, { color: colores.texto }]}>
            Total: {total !== null ? formatearPesos(total) : '—'}
          </Text>
        </>
      ) : (
        <CampoTexto etiqueta="Monto ($)" value={monto} onChangeText={setMonto} keyboardType="numeric" placeholder="18000" />
      )}

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
  total: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.m },
});
