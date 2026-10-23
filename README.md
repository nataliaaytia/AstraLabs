# API Backend — AstraLabs (Casa Amandita del Adulto Mayor)

Contrato de la API del módulo de Inventario, para que el equipo de frontend
sepa exactamente qué pedir y qué esperar de vuelta. Base URL en desarrollo:

```
http://localhost:3000
```

## Autenticación

Todos los endpoints marcados como **protegido** requieren el header:

```
Authorization: Bearer <token>
```

El `token` se obtiene al hacer login (`POST /api/auth/login`) y expira a las
8 horas. Los endpoints marcados **Administradora** además exigen que el rol
del usuario autenticado sea exactamente ese.

Roles válidos en el sistema (tabla `roles`, RF-26): `Administradora`,
`Recepcion`, `Almacen_Cocina`. No existen `admin`/`personal`/`visitante` —
esos nombres son únicamente del mock de frontend (`usuariosDemo.js`) y deben
reemplazarse por estos tres al conectar con el backend real.

---

## `GET /health`

Chequeo de disponibilidad del servicio. No requiere autenticación.

**Respuesta 200**

```json
{ "status": "ok", "servicio": "API Inventario - AstraLabs" }
```

---

## `POST /api/auth/login`

RF-25. Inicia sesión y devuelve un token JWT.

**Request**

```json
{ "email": "admin@amandita.test", "password": "Admin123!" }
```

**Respuesta 200**

```json
{
  "token": "eyJhbGciOi...",
  "usuario": {
    "id": 1,
    "nombre": "Administradora Demo",
    "email": "admin@amandita.test",
    "rol": "Administradora"
  }
}
```

**Respuesta 401** (email no existe, contraseña incorrecta, o faltan campos)

```json
{ "error": "Credenciales inválidas" }
```

> El mensaje de error es siempre el mismo, exista o no el email, a propósito
> (evita que alguien use el login para averiguar qué correos están
> registrados).

---

## `GET /api/usuarios`

RF-26. Lista los usuarios activos del sistema, para la pantalla de Gestión
de Roles. **Protegido — Administradora.**

**Respuesta 200**

```json
[
  {
    "id": 1,
    "nombre": "Administradora Demo",
    "email": "admin@amandita.test",
    "rol": "Administradora"
  },
  {
    "id": 2,
    "nombre": "Recepción Demo",
    "email": "recepcion@amandita.test",
    "rol": "Recepcion"
  }
]
```

**Respuesta 401** — falta el token o es inválido/expiró.
**Respuesta 403** — el token es válido pero el rol no es `Administradora`.

---

## `PATCH /api/usuarios/:id/rol`

RF-26. Cambia el rol de un usuario. **Protegido — Administradora.**

**Request**

```json
{ "rol": "Recepcion" }
```

**Respuesta 200**

```json
{ "id": 2, "nombre": "Recepción Demo", "email": "recepcion@amandita.test" }
```

**Respuesta 400**

```json
{
  "error": "rol debe ser uno de: Administradora, Recepcion, Almacen_Cocina (RF-26)"
}
```

```json
{ "error": "No puedes modificar tu propio rol" }
```

---

## `GET /api/articulos/:id/stock`

RF-05. Devuelve el stock actual de un artículo (suma de todos sus lotes con
`cantidad_disponible > 0`).

**Respuesta 200**

```json
{
  "articulo_id": 1,
  "articulo": "Arroz",
  "stock_minimo": 20,
  "stock_actual": 80
}
```

---

## `POST /api/salidas`

RF-03, RF-05, RF-20. Registra una salida de inventario, descontando stock
automáticamente por FEFO (primero vence, primero sale) entre los lotes
disponibles del artículo.

**Request**

```json
{
  "articuloId": 1,
  "cantidad": 10,
  "usuarioId": 3,
  "destino": "Cocina - almuerzo"
}
```

`destino` es obligatorio (RF-03).

**Respuesta 201**

```json
{ "movimientoId": 15, "articuloId": 1, "cantidadTotal": 10 }
```

**Respuesta 400** — stock insuficiente, falta `destino`, u otros datos inválidos.

---

## `POST /api/mermas`

RF-06. Registra una merma (pérdida de inventario), igual que una salida pero
con `motivo` obligatorio en vez de `destino`.

**Request**

```json
{
  "articuloId": 2,
  "cantidad": 3,
  "usuarioId": 3,
  "motivo": "vencimiento"
}
```

`motivo` debe ser uno de: `vencimiento`, `deterioro`, `perdida` (validado
tanto en el servicio como con un `CHECK` constraint en la base de datos).

**Respuesta 201**

```json
{ "movimientoId": 16, "articuloId": 2, "cantidadTotal": 3 }
```

**Respuesta 400** — motivo inválido o stock insuficiente.

---

## Usuarios de prueba (ver `Backend/src/scripts/seed.js`)

| Email                   | Password      | Rol            |
| ----------------------- | ------------- | -------------- |
| admin@amandita.test     | Admin123!     | Administradora |
| recepcion@amandita.test | Recepcion123! | Recepcion      |
| almacen@amandita.test   | Almacen123!   | Almacen_Cocina |

Correr `npm run seed` dentro de `Backend/` para crearlos (o actualizarlos) en
la base de datos.

## Pendiente de conectar en el frontend

- Reemplazar `usuariosDemo.js` / `localStorage` en `iniciarSesion()` por un
  `fetch`/`axios` a `POST /api/auth/login`, guardando el `token` recibido
  (en vez de solo el objeto `usuario`).
- Mandar `Authorization: Bearer <token>` en cada petición a `/api/usuarios/*`.
- Reemplazar `ROLES.ADMIN/PERSONAL/VISITANTE` por los 3 roles reales
  (`Administradora`, `Recepcion`, `Almacen_Cocina`) en todas las
  comparaciones de rol (`esAdmin`, navegación condicional, etc.).
- Configurar una URL base de la API (ej. `VITE_API_URL`) en vez de
  hardcodear `localhost:3000`.
