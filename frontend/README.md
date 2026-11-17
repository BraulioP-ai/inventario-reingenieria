# Frontend — Sistema de Inventario

Interfaz en React + Vite. Consume la API de `../backend`.

    npm install
    npm run dev      # http://localhost:5173 (las llamadas a /api van al backend en el puerto 3000)
    npm run build    # genera dist/, que el backend sirve en http://localhost:3000

Pantallas: login, dashboard, productos, movimientos (entradas y salidas), reportes con exportación a Excel (CSV), categorías y marcas, y usuarios. El menú y los botones cambian según el rol (Admin / Almacén).

    src/
      api.js          cliente de la API (token, errores, descargas)
      auth.jsx        sesión y rol del usuario
      components.jsx  piezas comunes (modal, alertas, tablas)
      pages/          una pantalla por archivo
