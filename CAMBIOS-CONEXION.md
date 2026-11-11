# Conexión Frontend ↔ Backend (sin migraciones)

Este paquete se genera sobre el proyecto original, sin modificar `.env`, `schema.sql` ni crear migraciones.

## Endpoints existentes que utiliza
- `GET/POST /api/menus`, `GET /api/menus/:id`
- `GET/POST /api/planes-comida`, `POST /api/planes-comida/:id/confirmar`
- `GET /api/articulos`

## Ajustes mínimos para que las pantallas funcionen
- Se amplía `GET /api/menus` para incluir los ingredientes existentes de `menu_ingredientes`; no agrega tablas ni columnas.
- Se amplía `GET /api/planes-comida` para mostrar los ingredientes de cada menú; no cambia la base de datos.
- Se agregan `GET /api/lotes` y `POST /api/lotes/asignar` usando la tabla `lotes` existente. La asignación redistribuye stock disponible que no tiene lote asignado, mediante transacción. No aumenta el stock total.
- `tipo_comida` pertenece a **planes_comida**, NO a `menus`. El menú es reutilizable para cualquier tipo de comida permitido por el backend (desayuno, almuerzo, merienda).
- El endpoint de confirmar un plan **ya descuenta el stock** (FEFO). La pantalla no vuelve a descontarlo.
- Se agregan las cuatro páginas al menú de navegación de la aplicación.

## Instrucciones
1. **Haz respaldo o commit** de tus cambios locales antes de extraer el ZIP.
2. Extrae este ZIP desde la raíz de AstraLabs con `Expand-Archive ... -Force`.
3. Mantén tu `.env` local; el ZIP no lo incluye.
4. Inicia tu backend y frontend como de costumbre y prueba las cuatro pantallas con una sesión válida.
5. No se requiere ejecutar SQL ni modificar Neon.

## Commits sugeridos
```
git add Backend/src/repositories/menuRepository.js Backend/src/repositories/planComidaRepository.js Backend/src/repositories/loteRepository.js Backend/src/routes/lotes.js Backend/src/app.js
git commit -m "feat(backend): exponer datos de menus, planes y lotes existentes"
git add frontend/src/App.jsx frontend/src/data/menus.js frontend/src/services/planificacionApi.js frontend/src/services/inventarioApi.js frontend/src/pages/Menus/Menus.jsx frontend/src/pages/Lotes/Lotes.jsx frontend/src/pages/PlanificadorComidas/PlanificadorComidas.jsx frontend/src/pages/PlanesComida/PlanesComida.jsx
git commit -m "feat(frontend): conectar menus, lotes y planes con API"
git add CAMBIOS-CONEXION.md
git commit -m "docs: documentar integracion sin cambios en BD"
git push origin HEAD
```

## Limitaciones de validación
No se probó el flujo end-to-end con Neon desde este entorno. Hay que probarlo en la aplicación para confirmar permisos, datos y el esquema real desplegado; las consultas del paquete se basan en las tablas y columnas usadas por el backend original.
