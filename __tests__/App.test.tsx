/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Sin token guardado, la app debe mostrar el login (debajo de la pantalla de carga, que después se va)
test('muestra el login cuando no hay sesión', async () => {
  jest.useFakeTimers();
  let arbol: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    arbol = ReactTestRenderer.create(<App />);
  });
  expect(arbol!.root.findAllByProps({ children: 'Ingresar' }).length).toBeGreaterThan(0);

  // La pantalla de carga termina su animación y se quita
  // (de a pasos: cada parte de la animación arranca cuando termina la anterior)
  for (let i = 0; i < 20; i++) {
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(250);
    });
  }
  expect(arbol!.root.findAllByProps({ accessibilityLabel: 'Cargando CanchasYa Admin' })).toHaveLength(0);

  ReactTestRenderer.act(() => arbol!.unmount());
  jest.useRealTimers();
});
