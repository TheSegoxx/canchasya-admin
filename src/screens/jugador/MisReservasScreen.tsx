import React from 'react';
import { Pantalla } from '../../components/Pantalla';
import { Proximamente } from '../../components/Proximamente';

// Pestaña "Mis reservas" del jugador: próximas, historial y la vaquita (próximos pasos)
export function MisReservasScreen() {
  return (
    <Pantalla>
      <Proximamente
        icono="agenda"
        titulo="Tus reservas"
        texto="Acá vas a ver tus turnos, pagar la seña y dividir el total con tus amigos con la vaquita."
      />
    </Pantalla>
  );
}
