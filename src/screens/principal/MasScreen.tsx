import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Boton } from '../../components/Boton';
import { Icono, NombreIcono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { useEsDueno, useSesion } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { guardarPreferenciaTema, leerPreferenciaTema, PreferenciaTema } from '../../theme/preferencia';
import { espaciado, radio, useTema } from '../../theme/tema';

type Opcion = {
  titulo: string;
  icono: NombreIcono;
  ruta: 'Complejo' | 'Empleados' | 'Torneos' | 'TurnosFijos' | 'Clientes' | 'Productos';
  soloDueno?: boolean;
};

// El encargado no ve los datos del complejo, los empleados ni los productos
const OPCIONES: Opcion[] = [
  { titulo: 'Datos del complejo', icono: 'complejo', ruta: 'Complejo', soloDueno: true },
  { titulo: 'Empleados', icono: 'empleados', ruta: 'Empleados', soloDueno: true },
  { titulo: 'Torneos y ligas', icono: 'torneos', ruta: 'Torneos' },
  { titulo: 'Turnos fijos', icono: 'turnosFijos', ruta: 'TurnosFijos' },
  { titulo: 'Clientes', icono: 'clientes', ruta: 'Clientes' },
  { titulo: 'Productos y extras', icono: 'productos', ruta: 'Productos', soloDueno: true },
];

const TEMAS: { preferencia: PreferenciaTema; titulo: string; icono: NombreIcono }[] = [
  { preferencia: 'claro', titulo: 'Claro', icono: 'temaClaro' },
  { preferencia: 'oscuro', titulo: 'Oscuro', icono: 'temaOscuro' },
  { preferencia: 'sistema', titulo: 'Celular', icono: 'temaDispositivo' },
];

export function MasScreen() {
  const { colores } = useTema();
  const navigation = useNavigation<NativeStackNavigationProp<RutasApp>>();
  const { usuario, cerrarSesion } = useSesion();
  const esDueno = useEsDueno();
  const [saliendo, setSaliendo] = useState(false);
  const [tema, setTema] = useState<PreferenciaTema>('sistema');

  useEffect(() => {
    leerPreferenciaTema().then(setTema);
  }, []);

  const elegirTema = (preferencia: PreferenciaTema) => {
    setTema(preferencia);
    guardarPreferenciaTema(preferencia);
  };

  const confirmarSalida = () =>
    Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta en este celular?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          setSaliendo(true);
          await cerrarSesion();
        },
      },
    ]);

  if (!usuario) {
    return null;
  }

  const opciones = OPCIONES.filter(o => esDueno || !o.soloDueno);

  return (
    <Pantalla>
      <View style={[estilos.tarjeta, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {usuario.foto ? (
          <Image source={{ uri: usuario.foto }} style={estilos.foto} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[estilos.foto, estilos.inicial, { backgroundColor: colores.primario + '1F' }]}>
            <Text style={[estilos.letra, { color: colores.primario }]}>{usuario.nombre.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={estilos.datos}>
          <Text style={[estilos.nombre, { color: colores.texto }]}>{usuario.nombre}</Text>
          <Text style={[estilos.email, { color: colores.textoSecundario }]}>{usuario.email}</Text>
          {!!usuario.complejo && (
            <Text style={[estilos.email, { color: colores.textoSecundario }]}>
              {esDueno ? 'Dueño' : 'Encargado'} de {usuario.complejo}
            </Text>
          )}
        </View>
      </View>

      <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Gestión</Text>
      <View style={[estilos.grupo, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {opciones.map((opcion, i) => (
          <Pressable
            key={opcion.ruta}
            accessibilityRole="button"
            onPress={() => navigation.navigate(opcion.ruta)}
            style={({ pressed }) => [
              estilos.fila,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colores.borde },
              pressed && { backgroundColor: colores.borde + '66' },
            ]}>
            <Icono nombre={opcion.icono} color={colores.texto} acento={colores.acento} tamano={22} />
            <Text style={[estilos.textoFila, { color: colores.texto }]}>{opcion.titulo}</Text>
            <Icono nombre="siguiente" color={colores.inactivo} tamano={18} />
          </Pressable>
        ))}
      </View>

      <Text style={[estilos.seccion, { color: colores.textoSecundario }]}>Tema</Text>
      <View
        accessibilityRole="radiogroup"
        style={[estilos.selector, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        {TEMAS.map(t => {
          const elegido = tema === t.preferencia;
          return (
            <Pressable
              key={t.preferencia}
              accessibilityRole="radio"
              accessibilityState={{ checked: elegido }}
              accessibilityLabel={t.preferencia === 'sistema' ? 'Según el celular' : t.titulo}
              onPress={() => elegirTema(t.preferencia)}
              style={[estilos.opcionTema, elegido && { backgroundColor: colores.primario + '1F' }]}>
              <Icono
                nombre={t.icono}
                color={elegido ? colores.primario : colores.textoSecundario}
                acento={elegido ? colores.acento : colores.textoSecundario}
                tamano={20}
              />
              <Text
                style={[
                  estilos.textoTema,
                  { color: elegido ? colores.primario : colores.textoSecundario, fontWeight: elegido ? '600' : '500' },
                ]}>
                {t.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={estilos.salir}>
        <Boton titulo="Cerrar sesión" variante="texto" color={colores.error} onPress={confirmarSalida} cargando={saliendo} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: espaciado.m,
    borderRadius: radio,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: espaciado.l,
  },
  foto: { width: 52, height: 52, borderRadius: 26 },
  inicial: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontSize: 22, fontWeight: '600' },
  datos: { flex: 1, marginLeft: espaciado.m },
  nombre: { fontSize: 17, fontWeight: '600' },
  email: { fontSize: 13, marginTop: 2 },
  seccion: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: espaciado.s,
    marginLeft: espaciado.xs,
  },
  grupo: { borderRadius: radio, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: espaciado.l },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: espaciado.m },
  textoFila: { flex: 1, fontSize: 15, fontWeight: '500', marginLeft: 14 },
  selector: {
    flexDirection: 'row',
    borderRadius: radio,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    marginBottom: espaciado.l,
  },
  opcionTema: {
    flex: 1,
    minHeight: 48,
    borderRadius: radio - 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  textoTema: { fontSize: 14, marginLeft: 6 },
  salir: { alignItems: 'center' },
});
