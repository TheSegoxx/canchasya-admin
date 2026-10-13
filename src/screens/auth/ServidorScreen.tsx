import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfigurarServidor } from '../../components/ConfigurarServidor';
import type { RutasAuth } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RutasAuth, 'Servidor'>;

// Desde el login: cambiar la dirección de la computadora con XAMPP
export function ServidorScreen({ navigation }: Props) {
  return <ConfigurarServidor alGuardar={() => navigation.goBack()} />;
}
