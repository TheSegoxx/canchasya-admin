import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Agenda, agendaApi, Cliente, NuevoTurno } from '../../api/agenda';
import { NOMBRE_DEPORTE } from '../../api/canchas';
import { MetodoPago, NOMBRE_METODO } from '../../api/cobros';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/CampoTexto';
import { Chip } from '../../components/Chip';
import { ErrorCarga } from '../../components/ErrorCarga';
import { FilaInterruptor } from '../../components/FilaInterruptor';
import { Icono } from '../../components/Icono';
import { Pantalla } from '../../components/Pantalla';
import { SelectorDia } from '../../components/SelectorDia';
import { mensajeDeError, useEsDueno } from '../../context/SesionContext';
import type { RutasApp } from '../../navigation/AppNavigator';
import { espaciado, radio, useTema } from '../../theme/tema';
import { horariosLibres, precioPara } from '../../utils/agenda';
import { diaEnPlural, diaSemana, hoyISO } from '../../utils/fechas';
import { leerPesos, pesosParaEditar } from '../../utils/formato';
import { minutosAhora, sumarMinutos } from '../../utils/horas';
import { formatearTelefono } from '../../utils/telefono';

type Props = NativeStackScreenProps<RutasApp, 'NuevoTurno'>;

// Reservar un turno: cancha, horario libre, cliente, precio y si se repite cada semana
export function NuevoTurnoScreen({ route, navigation }: Props) {
  const { colores } = useTema();
  const esDueno = useEsDueno();
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(route.params.fecha < hoy ? hoy : route.params.fecha);
  const [canchaId, setCanchaId] = useState(route.params.canchaId);
  const [hora, setHora] = useState(route.params.hora);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [errorCarga, setErrorCarga] = useState('');

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [clienteNuevo, setClienteNuevo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const [precio, setPrecio] = useState('');
  const [precioEditado, setPrecioEditado] = useState(false);
  const [fijo, setFijo] = useState(false);
  const [conSena, setConSena] = useState(false);
  const [sena, setSena] = useState('');
  const [metodoSena, setMetodoSena] = useState<MetodoPago>('transferencia');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const pedida = useRef(fecha);

  const cargar = useCallback(async (dia: string) => {
    pedida.current = dia;
    setErrorCarga('');
    try {
      const datos = await agendaApi.dia(dia);
      if (pedida.current === dia) {
        setAgenda(datos);
      }
    } catch (e) {
      if (pedida.current === dia) {
        setErrorCarga(mensajeDeError(e));
      }
    }
  }, []);

  useEffect(() => {
    cargar(fecha);
  }, [cargar, fecha]);

  // Búsqueda de clientes mientras se escribe (espera a que se deje de tipear)
  useEffect(() => {
    const texto = busqueda.trim();
    if (texto.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const espera = setTimeout(async () => {
      try {
        const { clientes } = await agendaApi.buscarClientes(texto);
        if (vigente) {
          setResultados(clientes.slice(0, 5));
        }
      } catch {
        // Si falla la búsqueda se puede cargar como cliente nuevo
      } finally {
        if (vigente) {
          setBuscando(false);
        }
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busqueda]);

  const delDia = agenda?.fecha === fecha ? agenda : null;
  const canchas = delDia?.canchas.filter(c => c.habilitada) ?? [];
  const cancha = canchas.find(c => c.id === canchaId) ?? canchas[0];
  const libres =
    delDia && cancha
      ? horariosLibres(cancha, {
          apertura: delDia.complejo.horaApertura,
          cierre: delDia.complejo.horaCierre,
          turnos: delDia.turnos,
          bloqueos: delDia.bloqueos,
          minutosAhora: fecha === hoy ? minutosAhora() : undefined,
        })
      : [];
  // Si el horario elegido no está libre en esta cancha (o no entra el turno), no queda elegido
  const horaElegida = hora && libres.includes(hora) ? hora : null;
  const precioCalculado = cancha && horaElegida ? precioPara(cancha, horaElegida) : null;
  const textoPrecio = precioEditado ? precio : precioCalculado !== null ? pesosParaEditar(precioCalculado) : '';

  const empezarClienteNuevo = () => {
    const texto = busqueda.trim();
    // Lo que ya se escribió en la búsqueda pasa al campo que corresponde
    if (/\d/.test(texto)) {
      setTelefono(texto);
    } else {
      setNombre(texto);
    }
    setClienteNuevo(true);
  };

  const guardar = async () => {
    if (guardando || !cancha) {
      return;
    }
    if (!horaElegida) {
      setError('Elegí un horario libre.');
      return;
    }
    if (!cliente && !clienteNuevo) {
      setError('Buscá el cliente o cargalo como cliente nuevo.');
      return;
    }
    if (clienteNuevo && (!nombre.trim() || telefono.replace(/\D/g, '').length < 8)) {
      setError('Completá el nombre y el celular del cliente con código de área.');
      return;
    }
    const monto = leerPesos(textoPrecio);
    if (monto === null) {
      setError('Escribí el precio solo con números (por ejemplo, 24000).');
      return;
    }
    const montoSena = conSena ? leerPesos(sena) : null;
    if (conSena && (montoSena === null || montoSena <= 0 || montoSena > monto)) {
      setError('La seña tiene que ser un número mayor a cero y no puede superar el precio.');
      return;
    }
    setError('');
    setGuardando(true);

    const datos: NuevoTurno = {
      canchaId: cancha.id,
      fecha,
      horaInicio: horaElegida,
      fijo,
      // Solo se manda si el dueño lo cambió: si no, la API usa el de la franja
      ...(monto !== precioCalculado ? { precio: monto } : {}),
      ...(montoSena !== null ? { sena: { monto: montoSena, metodo: metodoSena } } : {}),
      ...(cliente ? { clienteId: cliente.id } : { cliente: { nombre: nombre.trim(), telefono } }),
    };
    try {
      const { turno, aviso } = await agendaApi.crearTurno(datos);
      if (aviso) {
        Alert.alert('Turno fijo guardado', aviso);
      }
      navigation.replace('Turno', { id: turno.id, recienCreado: true });
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
      // Puede que otro haya reservado ese horario: se actualizan los libres
      cargar(fecha);
    }
  };

  if (!delDia) {
    return errorCarga ? (
      <ErrorCarga mensaje={errorCarga} onReintentar={() => cargar(fecha)} />
    ) : (
      <View style={[estilos.cargando, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  if (!cancha) {
    return (
      <ErrorCarga
        mensaje="No hay canchas habilitadas para cargar turnos."
        onReintentar={() => cargar(fecha)}
        accion={{ titulo: 'Volver', onPress: () => navigation.goBack() }}
      />
    );
  }

  return (
    <Pantalla>
      <SelectorDia etiqueta="Día" fecha={fecha} onCambiar={setFecha} minimo={hoy} />

      <Text style={[estilos.seccion, { color: colores.texto }]}>Cancha</Text>
      <View style={estilos.chips}>
        {canchas.map(c => (
          <Chip key={c.id} texto={c.nombre} seleccionado={c.id === cancha.id} onPress={() => setCanchaId(c.id)} />
        ))}
      </View>
      <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
        {NOMBRE_DEPORTE[cancha.deporte]} · turnos de {cancha.duracionMin} minutos
      </Text>

      <Text style={[estilos.seccion, { color: colores.texto }]}>Horario</Text>
      {libres.length === 0 ? (
        <Text style={[estilos.ayuda, { color: colores.error }]}>
          No quedan horarios libres en esta cancha este día.
        </Text>
      ) : (
        <View style={estilos.horas}>
          {libres.map(h => {
            const elegida = h === horaElegida;
            return (
              <Pressable
                key={h}
                accessibilityRole="radio"
                accessibilityState={{ checked: elegida }}
                accessibilityLabel={`${h} a ${sumarMinutos(h, cancha.duracionMin)}`}
                onPress={() => setHora(h)}
                style={[
                  estilos.hora,
                  {
                    backgroundColor: elegida ? colores.primario : colores.superficie,
                    borderColor: elegida ? colores.primario : colores.borde,
                  },
                ]}>
                <Text style={[estilos.textoHora, { color: elegida ? colores.textoSobrePrimario : colores.texto }]}>{h}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {horaElegida && (
        <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>
          De {horaElegida} a {sumarMinutos(horaElegida, cancha.duracionMin)}
        </Text>
      )}

      <Text style={[estilos.seccion, { color: colores.texto }]}>Cliente</Text>
      {cliente ? (
        <View style={[estilos.cliente, { backgroundColor: colores.superficie, borderColor: colores.primario }]}>
          <Icono nombre="persona" color={colores.primario} />
          <View style={estilos.datosCliente}>
            <Text style={[estilos.nombreCliente, { color: colores.texto }]}>{cliente.nombre}</Text>
            <Text style={[estilos.telefonoCliente, { color: colores.textoSecundario }]}>
              {formatearTelefono(cliente.telefono)}
            </Text>
          </View>
          <Boton titulo="Cambiar" variante="texto" onPress={() => setCliente(null)} />
        </View>
      ) : clienteNuevo ? (
        <>
          <CampoTexto etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Juan Pérez" maxLength={100} />
          <CampoTexto
            etiqueta="Celular con código de área"
            value={telefono}
            onChangeText={setTelefono}
            placeholder="11 5555 1234"
            keyboardType="phone-pad"
            maxLength={30}
          />
          <Boton titulo="Buscar un cliente ya cargado" variante="texto" onPress={() => setClienteNuevo(false)} />
        </>
      ) : (
        <>
          <CampoTexto
            etiqueta="Buscar por nombre o teléfono"
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Juan o 1155…"
            autoCorrect={false}
          />
          {resultados.map(c => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() => {
                setCliente(c);
                setBusqueda('');
              }}
              style={({ pressed }) => [
                estilos.resultado,
                { backgroundColor: colores.superficie, borderColor: colores.borde, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Text style={[estilos.nombreCliente, { color: colores.texto }]}>{c.nombre}</Text>
              <Text style={[estilos.telefonoCliente, { color: colores.textoSecundario }]}>
                {formatearTelefono(c.telefono)}
              </Text>
            </Pressable>
          ))}
          {busqueda.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <Text style={[estilos.ayuda, { color: colores.textoSecundario }]}>No hay clientes que coincidan.</Text>
          )}
          <Boton titulo="+ Cliente nuevo" variante="secundario" onPress={empezarClienteNuevo} />
          <View style={estilos.espacio} />
        </>
      )}

      <CampoTexto
        etiqueta="Precio ($)"
        value={textoPrecio}
        onChangeText={texto => {
          setPrecio(texto);
          setPrecioEditado(true);
        }}
        keyboardType="numeric"
        placeholder="Elegí un horario"
        // El encargado cobra el precio de la cancha: no lo puede cambiar
        editable={esDueno}
      />
      {precioEditado && precioCalculado !== null && (
        <Boton
          titulo={`Volver al precio de la cancha (${pesosParaEditar(precioCalculado)})`}
          variante="texto"
          onPress={() => setPrecioEditado(false)}
        />
      )}

      <FilaInterruptor
        titulo="Recibí una seña"
        descripcion={conSena ? 'Queda registrada en la caja de hoy' : 'Si ya te pagó una parte'}
        valor={conSena}
        onCambiar={setConSena}
      />
      {conSena && (
        <>
          <CampoTexto
            etiqueta="Monto de la seña ($)"
            value={sena}
            onChangeText={setSena}
            keyboardType="numeric"
            placeholder={precioCalculado ? String(Math.round(precioCalculado / 2)) : '10000'}
          />
          <View style={estilos.chips}>
            {(['transferencia', 'efectivo'] as MetodoPago[]).map(m => (
              <Chip key={m} texto={NOMBRE_METODO[m]} seleccionado={metodoSena === m} onPress={() => setMetodoSena(m)} />
            ))}
          </View>
          <View style={estilos.espacio} />
        </>
      )}

      <FilaInterruptor
        titulo="Turno fijo"
        descripcion={`Se repite todos los ${diaEnPlural(diaSemana(fecha))}${horaElegida ? ` a las ${horaElegida}` : ''}`}
        valor={fijo}
        onCambiar={setFijo}
      />

      {!!error && (
        <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: colores.error }]}>
          {error}
        </Text>
      )}
      <Boton titulo="Reservar turno" onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espaciado.s },
  ayuda: { fontSize: 14, marginBottom: espaciado.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  horas: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espaciado.s },
  hora: {
    width: 72,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radio - 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: espaciado.s,
    marginBottom: espaciado.s,
  },
  textoHora: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cliente: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: espaciado.m,
    borderWidth: 1.5,
    borderRadius: radio,
    marginBottom: espaciado.m,
  },
  datosCliente: { flex: 1, marginLeft: espaciado.m, paddingVertical: espaciado.s },
  nombreCliente: { fontSize: 16, fontWeight: '700' },
  telefonoCliente: { fontSize: 14, marginTop: 2 },
  resultado: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: espaciado.m,
    borderWidth: 1,
    borderRadius: radio,
    marginBottom: espaciado.s,
  },
  espacio: { height: espaciado.m },
  error: { fontSize: 14, marginBottom: espaciado.m },
});
