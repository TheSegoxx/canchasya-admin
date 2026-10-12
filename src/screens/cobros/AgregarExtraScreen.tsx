import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cobrosApi, NuevoConsumo, Producto } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { ErrorCarga } from '../../components/ErrorCarga';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError, useEsDueno } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { formatearPesos, leerPesos } from '../../utils/formato';

type Props = NativeStackScreenProps<RutasApp, 'AgregarExtra'>;

// "otro" = algo que no está en el catálogo (se escribe nombre y precio)
type Eleccion = number | 'otro' | null;

// Sumar a la cuenta del turno algo del catálogo (paletas, pelotas, bebidas) o un extra suelto
export function AgregarExtraScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const esDueno = useEsDueno();
  const { turnoId } = route.params;
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [eleccion, setEleccion] = useState<Eleccion>(null);
  const [cantidad, setCantidad] = useState(1);
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setErrorCarga('');
    try {
      setProductos((await cobrosApi.productos()).productos.filter(p => p.activo));
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    }
  }, []);

  // Se recarga al volver de administrar los productos
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (!productos) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={cargar} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  const producto = typeof eleccion === 'number' ? productos.find(p => p.id === eleccion) : undefined;
  const precioUnitario = producto ? producto.precio : eleccion === 'otro' ? leerPesos(precio) : null;
  const subtotal = precioUnitario !== null ? precioUnitario * cantidad : null;

  const guardar = async () => {
    if (guardando) {
      return;
    }
    let consumo: NuevoConsumo;
    if (producto) {
      consumo = { productoId: producto.id, cantidad };
    } else if (eleccion === 'otro') {
      if (!descripcion.trim() || precioUnitario === null) {
        setError('Escribí qué es y su precio (solo números).');
        return;
      }
      consumo = { descripcion: descripcion.trim(), precioUnitario, cantidad };
    } else {
      setError('Elegí qué querés agregar.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await cobrosApi.agregarConsumo(turnoId, consumo);
      navigation.goBack();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  const opcion = (clave: Eleccion, titulo: string, detalle: string) => {
    const elegida = eleccion === clave;
    return (
      <Pressable
        key={String(clave)}
        accessibilityRole="radio"
        accessibilityState={{ checked: elegida }}
        onPress={() => setEleccion(clave)}
        style={[
          estilos.opcion,
          {
            backgroundColor: elegida ? colores.primario : colores.superficie,
            borderColor: elegida ? colores.primario : colores.borde,
          },
        ]}>
        <Text numberOfLines={2} style={[estilos.nombre, { color: elegida ? colores.textoSobrePrimario : colores.texto }]}>
          {titulo}
        </Text>
        <Text style={[estilos.precio, { color: elegida ? colores.textoSobrePrimario : colores.textoSecundario }]}>{detalle}</Text>
      </Pressable>
    );
  };

  const botonCantidad = (signo: string, delta: number, habilitado: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'Uno más' : 'Uno menos'}
      disabled={!habilitado}
      onPress={() => setCantidad(c => c + delta)}
      style={[estilos.botonCantidad, { borderColor: colores.borde }, !habilitado && estilos.inhabilitado]}>
      <Text style={[estilos.signo, { color: colores.primario }]}>{signo}</Text>
    </Pressable>
  );

  return (
    <Pantalla>
      {productos.length === 0 && (
        <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
          {esDueno
            ? 'Todavía no cargaste productos. Agregalos en "Administrar productos" para elegirlos con un toque.'
            : 'Todavía no hay productos cargados. Pedile al dueño que los agregue.'}
        </Text>
      )}
      <View style={estilos.opciones}>
        {productos.map(p => opcion(p.id, p.nombre, formatearPesos(p.precio)))}
        {esDueno && opcion('otro', 'Otro', 'Escribir a mano')}
      </View>

      {eleccion === 'otro' && (
        <>
          <CampoTexto etiqueta="¿Qué es?" value={descripcion} onChangeText={setDescripcion} placeholder="Grip" maxLength={60} />
          <CampoTexto etiqueta="Precio ($)" value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholder="3000" />
        </>
      )}

      <Text style={[estilos.seccion, { color: colores.texto }]}>Cantidad</Text>
      <View style={[estilos.cantidad, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {botonCantidad('−', -1, cantidad > 1)}
        <Text accessibilityLiveRegion="polite" style={[estilos.numero, { color: colores.texto }]}>
          {cantidad}
        </Text>
        {botonCantidad('+', 1, cantidad < 99)}
      </View>

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton
        titulo={subtotal !== null ? `Agregar a la cuenta (${formatearPesos(subtotal)})` : 'Agregar a la cuenta'}
        onPress={guardar}
        cargando={guardando}
      />
      {esDueno && (
        <>
          <View style={estilos.espacio} />
          <Boton titulo="Administrar productos" variante="texto" onPress={() => navigation.navigate('Productos')} />
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ayuda: { fontSize: 15, lineHeight: 21, marginBottom: espaciado.m },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: espaciado.s },
  opcion: {
    width: '48.5%',
    minHeight: 72,
    padding: espaciado.m,
    borderWidth: 1,
    borderRadius: radio,
    marginBottom: espaciado.s,
    justifyContent: 'center',
  },
  nombre: { fontSize: 16, fontWeight: '700' },
  precio: { fontSize: 14, marginTop: 2 },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  cantidad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radio,
    padding: espaciado.xs,
    marginBottom: espaciado.l,
  },
  botonCantidad: { width: 48, height: 48, borderRadius: radio - 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  inhabilitado: { opacity: 0.35 },
  signo: { fontSize: 26, fontWeight: '600' },
  numero: { fontSize: 22, fontWeight: '700' },
  error: { fontSize: 14, marginBottom: espaciado.m },
  espacio: { height: espaciado.s },
});
