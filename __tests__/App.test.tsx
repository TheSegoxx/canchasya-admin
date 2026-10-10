/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Sin token guardado, la app debe mostrar el login
test('muestra el login cuando no hay sesión', async () => {
  let arbol: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    arbol = ReactTestRenderer.create(<App />);
  });
  expect(arbol!.root.findAllByProps({ children: 'Ingresar' }).length).toBeGreaterThan(0);
});
