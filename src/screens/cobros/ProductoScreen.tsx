import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../../components/Texto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { cobrosApi } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { FilaInterruptor } from '../../components/FilaInterruptor';
import { Pantalla } from '../../components/Pantalla';
import { mensajeDeError } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, useTema } from '../../theme/tema';
import { leerPesos, pesosParaEditar } from '../../utils/formato';

type Props = NativeStackScreenProps<RutasApp, 'Producto'>;

// Alta (sin producto) o edición de un producto del catálogo
export function ProductoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const existente = route.params.producto;
  const [nombre, setNombre] = useState(existente?.nombre ?? '');
  const [precio, setPrecio] = useState(existente ? pesosParaEditar(existente.precio) : '');
  const [activo, setActivo] = useState(existente?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: existente ? 'Editar producto' : 'Nuevo producto' });
  }, [existente, navigation]);

  const guardar = async () => {
    if (guardando) {
      return;
    }
    const monto = leerPesos(precio);
    if (!nombre.trim()) {
      setError('Poné un nombre (por ejemplo, "Tubo de pelotas").');
      return;
    }
    if (monto === null) {
      setError('Escribí el precio solo con números (por ejemplo, 9000).');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      if (existente) {
        await cobrosApi.editarProducto(existente.id, { nombre: nombre.trim(), precio: monto, activo });
      } else {
        await cobrosApi.crearProducto({ nombre: nombre.trim(), precio: monto });
      }
      navigation.goBack();
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  };

  return (
    <Pantalla>
      <CampoTexto etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Alquiler de paleta" maxLength={60} />
      <CampoTexto etiqueta="Precio ($)" value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholder="3000" />
      {existente && (
        <FilaInterruptor
          titulo="Activo"
          descripcion={activo ? 'Aparece al agregar extras a un turno' : 'No aparece para agregar (las cuentas viejas no cambian)'}
          valor={activo}
          onCambiar={setActivo}
        />
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo={existente ? 'Guardar cambios' : 'Agregar producto'} onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  error: { fontSize: 14, marginBottom: espaciado.m },
});
