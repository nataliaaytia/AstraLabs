# API Backend — AstraLabs (Casa Amandita del Adulto Mayor)

Contrato de la API del módulo de Inventario: qué pedir y qué esperar de vuelta.
Base URL en desarrollo:

```
http://localhost:3000
```

Para probarla sin escribir código, importa `AstraLabs.postman_collection.json`
(misma carpeta), haz login con el rol que quieras y usa las demás carpetas.

## Índice

1. [Autenticación y roles](#autenticación-y-roles)
2. [Permisos por endpoint](#permisos-por-endpoint)
3. [Errores comunes](#errores-comunes)
4. [Filtros de los listados](#filtros-de-los-listados)
5. [Endpoints](#endpoints)
6. [Registro de uso de filtros](#registro-de-uso-de-filtros)
7. [Usuarios de prueba](#usuarios-de-prueba)
8. [Pendiente de conectar en el frontend](#pendiente-de-conectar-en-el-frontend)

---

## Autenticación y roles

**Todo requiere token, excepto `GET /health` y `POST /api/auth/login`.**
El token se manda en cada petición:

```
Authorization: Bearer <token>
```

Se obtiene con `POST /api/auth/login` y expira a las **8 horas**.

Roles válidos (tabla `roles`, RF-26):

| Rol              | Qué hace                                                      |
| ---------------- | ------------------------------------------------------------- |
| `Administradora` | Administra el sistema, consulta reportes y configura umbrales |
| `Recepcion`      | Registra donaciones y asigna lotes                            |
| `Almacen_Cocina` | Registra salidas, mermas y planes de comidas                  |

No existen `admin`/`personal`/`visitante`: son nombres del mock del frontend
(`usuariosDemo.js`) y deben reemplazarse por estos tres.

**El usuario que registra un movimiento sale del token.** Entradas, salidas,
mermas, excedentes y planes de comida ya **no** reciben `usuarioId` en el body;
si se manda, se ignora.

---

## Permisos por endpoint

| Endpoint                                                                    | Quién puede                    |
| --------------------------------------------------------------------------- | ------------------------------ |
| `GET /health`, `POST /api/auth/login`                                       | Público                        |
| `GET /api/usuarios`, `PATCH /api/usuarios/:id/rol`                          | Administradora                 |
| `GET /api/categorias`, `GET /api/articulos`, `GET /api/articulos/:id/stock` | Cualquier usuario autenticado  |
| `POST /api/articulos`                                                       | Cualquier usuario autenticado  |
| `GET /api/lotes`                                                            | Cualquier usuario autenticado  |
| `POST /api/lotes/asignar`                                                   | Administradora, Recepcion      |
| `POST /api/entradas`                                                        | Administradora, Recepcion      |
| `GET /api/donantes`                                                         | Cualquier usuario autenticado  |
| `POST /api/donantes`                                                        | Administradora, Recepcion      |
| `POST /api/salidas`, `POST /api/mermas`, `POST /api/excedentes`             | Administradora, Almacen_Cocina |
| `GET /api/excedentes`                                                       | Cualquier usuario autenticado  |
| `GET /api/menus`, `GET /api/menus/:id`                                      | Cualquier usuario autenticado  |
| `POST /api/menus`                                                           | Administradora, Recepcion      |
| `GET /api/planes-comida`                                                    | Cualquier usuario autenticado  |
| `POST /api/planes-comida`, `POST /api/planes-comida/:id/confirmar`          | Administradora, Almacen_Cocina |
| `GET /api/reportes/necesidades-criticas`                                    | Administradora                 |

---

## Errores comunes

| Código | Cuándo                                                  | Cuerpo                                                                               |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 400    | Datos inválidos, stock insuficiente, filtro mal formado | `{ "error": "mensaje" }`                                                             |
| 401    | Falta el token, es inválido o expiró                    | `{ "error": "Token no proporcionado" }` / `{ "error": "Token inválido o expirado" }` |
| 403    | El token es válido pero el rol no tiene permiso         | `{ "error": "No tienes permisos para esta acción" }`                                 |
| 404    | Recurso inexistente (p. ej. artículo o menú)            | `{ "error": "mensaje" }`                                                             |

---

## Filtros de los listados

Todos los filtros son **opcionales** y se **combinan** (AND). Sin filtros, cada
listado devuelve lo mismo que antes. La búsqueda de texto (`q`) no distingue
mayúsculas ni minúsculas y busca coincidencias parciales.

| Listado                  | Parámetros                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/articulos`     | `q` (nombre), `categoria_id`, `bajo_minimo=true` (stock actual menor al mínimo)                                           |
| `GET /api/lotes`         | `articuloId`, `q` (código de lote), `estado` = `vencido` \| `por_vencer` (próximos 30 días) \| `vigente` \| `sin_asignar` |
| `GET /api/donantes`      | `q` (nombre o contacto), `tipo` = `persona` \| `empresa`                                                                  |
| `GET /api/menus`         | `q` (nombre)                                                                                                              |
| `GET /api/planes-comida` | `fecha`, `desde`, `hasta`, `tipo_comida`, `estado`                                                                        |
| `GET /api/excedentes`    | `desde`, `hasta`, `q` (nombre del artículo o destino)                                                                     |
| `GET /api/usuarios`      | `q` (nombre o correo), `rol`                                                                                              |

Las fechas van en formato `YYYY-MM-DD`; una fecha mal escrita responde 400
con `"desde debe tener formato YYYY-MM-DD"` (o el parámetro que corresponda).
En `GET /api/lotes`, un `articuloId` que no sea entero positivo o un `estado`
fuera de la lista también responde 400.

Ejemplos:

```
GET /api/articulos?q=arroz&bajo_minimo=true
GET /api/lotes?articuloId=183&estado=por_vencer
GET /api/planes-comida?desde=2026-11-01&hasta=2026-11-30&estado=confirmado
GET /api/excedentes?desde=2026-11-01&q=leche
```

---

## Endpoints

### `GET /health`

Disponibilidad del servicio. Público.

```json
{ "status": "ok", "servicio": "API Inventario - AstraLabs" }
```

### `POST /api/auth/login`

RF-25. Devuelve un token JWT.

```json
{ "email": "admin@amandita.test", "password": "Admin123!" }
```

**200**

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

**401** `{ "error": "Credenciales inválidas" }` — es el mismo mensaje exista o no
el correo, a propósito, para no revelar qué correos están registrados.

### `GET /api/usuarios`

RF-26. Usuarios activos, para la pantalla de Gestión de Roles.
Filtros: `q`, `rol`.

```json
[
  {
    "id": 1,
    "nombre": "Administradora Demo",
    "email": "admin@amandita.test",
    "rol": "Administradora"
  }
]
```

### `PATCH /api/usuarios/:id/rol`

RF-26. Cambia el rol de un usuario.

```json
{ "rol": "Recepcion" }
```

**200** `{ "id": 2, "nombre": "Recepción Demo", "email": "recepcion@amandita.test" }`

**400** si el rol no es válido (`"rol debe ser uno de: Administradora, Recepcion, Almacen_Cocina (RF-26)"`)
o si intentas cambiar tu propio rol (`"No puedes modificar tu propio rol"`).

### `GET /api/categorias`

```json
[{ "id": 1, "nombre": "Alimentos" }]
```

### `GET /api/articulos`

RF-01, RF-07. Artículos activos con su stock actual. Filtros: `q`,
`categoria_id`, `bajo_minimo`.

```json
[
  {
    "id": 1,
    "nombre": "Arroz",
    "categoria_id": 1,
    "categoria": "Alimentos",
    "unidad_medida": "kg",
    "es_perecedero": false,
    "stock_minimo": "20.00",
    "created_at": "2026-11-01T12:00:00.000Z",
    "stock_actual": "76.80"
  }
]
```

**400** si `categoria_id` no es un entero positivo.

### `POST /api/articulos`

```json
{
  "nombre": "Lentejas",
  "categoriaId": 1,
  "unidadMedida": "kg",
  "esPerecedero": false,
  "stockMinimo": 10
}
```

**201** el artículo creado. **400** si faltan datos o ya existe uno con ese
nombre en la categoría.

### `GET /api/articulos/:id/stock`

RF-05. Stock actual de un artículo (suma de sus lotes).

```json
{
  "articulo_id": 1,
  "articulo": "Arroz",
  "stock_minimo": "20.00",
  "stock_actual": "76.80"
}
```

**404** si el artículo no existe.

### `POST /api/entradas`

RF-02. Registra una donación: crea el lote y el movimiento de entrada en una
sola transacción. Rol: Administradora, Recepcion.

```json
{
  "articuloId": 1,
  "cantidad": 20,
  "donanteId": 3,
  "fecha": "2026-11-20",
  "fechaVencimiento": "2027-06-30",
  "numeroLote": "L-2026-11"
}
```

Obligatorios: `articuloId` y `cantidad`. Los demás son opcionales.
Una entrada **sin** `numeroLote` ni `fechaVencimiento` queda como stock
"sin asignar", que luego se reparte con `POST /api/lotes/asignar`.

**201**

```json
{ "movimientoId": 31, "loteId": 18, "articuloId": 1, "cantidadTotal": 20 }
```

### `GET /api/lotes`

Lotes con su stock. Filtros: `articuloId`, `q`, `estado`.

```json
[
  {
    "id": 18,
    "articuloId": 1,
    "codigo": "L-2026-11",
    "fechaVencimiento": "2027-06-30",
    "cantidadDisponible": "20.00"
  }
]
```

Un lote sin código aparece como `"codigo": "SIN-ASIGNAR"`.

### `POST /api/lotes/asignar`

Reparte stock "sin asignar" de un artículo en un lote con código y
vencimiento. **No crea stock nuevo**: resta de los lotes sin asignar y crea el
lote nuevo por la misma cantidad. Rol: Administradora, Recepcion.

```json
{
  "articuloId": 1,
  "codigo": "L-ASIGNADO-1",
  "cantidad": 5,
  "fechaVencimiento": "2099-12-31"
}
```

**201** el lote creado. **400** si no hay suficiente stock sin asignar, el
código ya existe para ese artículo, la fecha es anterior a hoy, o la cantidad
tiene más de 2 decimales.

### `GET /api/donantes`

RF-14. Filtros: `q`, `tipo`.

```json
[
  {
    "id": 1,
    "nombre": "Banco de Alimentos Bolivia",
    "tipo": "empresa",
    "contacto": null,
    "telefono": null,
    "email": null,
    "created_at": "2026-11-01T12:00:00.000Z"
  }
]
```

### `POST /api/donantes`

Rol: Administradora, Recepcion.

```json
{
  "nombre": "Panadería San José",
  "tipo": "empresa",
  "contacto": "María Pérez",
  "telefono": "70000000",
  "email": "contacto@sanjose.test"
}
```

`tipo` es `persona` o `empresa`; `contacto`, `telefono` y `email` son opcionales.
**201** el donante creado. **400** si faltan datos o `tipo` no es válido.

### `POST /api/salidas`

RF-03, RF-05, RF-20. Registra una salida y descuenta stock por **FEFO**
(primero vence, primero sale). Rol: Administradora, Almacen_Cocina.

```json
{ "articuloId": 1, "cantidad": 10, "destino": "Cocina - almuerzo" }
```

`destino` es obligatorio.

**201** `{ "movimientoId": 15, "articuloId": 1, "cantidadTotal": 10 }`
**400** stock insuficiente, falta `destino`, u otros datos inválidos.

### `POST /api/mermas`

RF-06. Igual que una salida pero con `motivo` en vez de `destino`.
Rol: Administradora, Almacen_Cocina.

```json
{ "articuloId": 2, "cantidad": 3, "motivo": "vencimiento" }
```

`motivo`: `vencimiento`, `deterioro` o `perdida`.
**201** `{ "movimientoId": 16, "articuloId": 2, "cantidadTotal": 3 }`

### `POST /api/excedentes`

RF-09. Registra un excedente (descuenta por FEFO).
Rol: Administradora, Almacen_Cocina.

```json
{
  "articuloId": 1,
  "cantidad": 3,
  "destino": "Donación - Casa Hermana",
  "observaciones": "Sobrante de campaña"
}
```

**201** `{ "movimientoId": 20, "articuloId": 1, "cantidadTotal": 3 }`

### `GET /api/excedentes`

Historial de excedentes, el más reciente primero. Filtros: `desde`, `hasta`, `q`.

```json
[
  {
    "id": 259,
    "articulo_id": 15,
    "articulo": "Leche en polvo",
    "unidad_medida": "kg",
    "cantidad": "1.00",
    "destino": "Donación a otra institución",
    "observaciones": null,
    "fecha": "2026-11-11T12:33:29.267Z"
  }
]
```

### `GET /api/menus` y `GET /api/menus/:id`

Menús activos con sus ingredientes. Filtro del listado: `q`. **404** si el id no existe.

```json
[
  {
    "id": 28,
    "nombre": "Menu Prueba",
    "descripcion": null,
    "ingredientes": [
      { "articuloId": 14, "cantidadPorPorcion": 0.2 },
      { "articuloId": 183, "cantidadPorPorcion": 0.15 }
    ]
  }
]
```

### `POST /api/menus`

Crea un menú con sus ingredientes en una sola transacción.
Rol: Administradora, Recepcion.

```json
{
  "nombre": "Sopa de verduras",
  "descripcion": "Almuerzo",
  "ingredientes": [{ "articuloId": 14, "cantidadPorPorcion": 0.2 }]
}
```

**201** el menú creado. **400** si faltan datos, hay un ingrediente repetido
o un artículo no existe.

### `GET /api/planes-comida`

Planes de comida con su menú e ingredientes. Filtros: `fecha`, `desde`,
`hasta`, `tipo_comida`, `estado`.

```json
[
  {
    "id": 56,
    "fecha": "2026-11-11",
    "tipo_comida": "almuerzo",
    "comensales": 1,
    "estado": "confirmado",
    "menu_id": 28,
    "menu": "Menu Prueba",
    "descripcion": null,
    "ingredientes": [{ "articuloId": 14, "cantidadPorPorcion": 0.2 }]
  }
]
```

### `POST /api/planes-comida`

Programa una comida. Rol: Administradora, Almacen_Cocina.

```json
{
  "fecha": "2026-11-25",
  "tipoComida": "almuerzo",
  "menuId": 28,
  "comensales": 20
}
```

Solo puede haber un plan por fecha y tipo de comida (**400** si ya existe).
**201** el plan creado.

### `POST /api/planes-comida/:id/confirmar`

Confirma el plan y **descuenta el stock de todos sus ingredientes por FEFO**
(`cantidadPorPorcion × comensales`). Es atómico: si falta stock de un solo
ingrediente, no se descuenta nada y el plan sigue sin confirmar.
Rol: Administradora, Almacen_Cocina.

**200** el plan confirmado. **400** stock insuficiente o plan ya confirmado.

### `GET /api/reportes/necesidades-criticas`

Artículos en necesidad crítica (stock por debajo del mínimo). Parámetro
opcional `limite` (cantidad máxima de resultados). Rol: Administradora.

---

## Registro de uso de filtros

Cada `GET` que usa filtros agrega una línea JSON a `Backend/logs/filtros.log`
(carpeta fuera de git), con fecha, usuario, rol, ruta, filtros y código de
respuesta:

```json
{
  "fecha": "2026-11-22T06:50:00.000Z",
  "usuarioId": 1,
  "rol": "Administradora",
  "ruta": "/api/articulos",
  "filtros": { "q": "arroz" },
  "status": 200
}
```

Sirve para entender qué filtros usa cada perfil. Los valores se recortan a 100
caracteres y el log no se escribe durante los tests.

---

## Usuarios de prueba

Ver `Backend/src/scripts/seed.js`.

| Email                   | Password      | Rol            |
| ----------------------- | ------------- | -------------- |
| admin@amandita.test     | Admin123!     | Administradora |
| recepcion@amandita.test | Recepcion123! | Recepcion      |
| almacen@amandita.test   | Almacen123!   | Almacen_Cocina |

`npm run seed` dentro de `Backend/` los crea o actualiza.

---

## Pendiente de conectar en el frontend

- Reemplazar `usuariosDemo.js` / `localStorage` en `iniciarSesion()` por una
  llamada a `POST /api/auth/login` y guardar el `token`.
- Mandar `Authorization: Bearer <token>` en **todas** las peticiones (salvo login).
- Dejar de mandar `usuarioId` en entradas, salidas, mermas, excedentes y planes.
- Reemplazar `ROLES.ADMIN/PERSONAL/VISITANTE` por los 3 roles reales.
- Configurar la URL de la API (`VITE_API_URL`) en vez de `localhost:3000` fijo.
- Incluir en cada pantalla los filtros de [Filtros de los listados](#filtros-de-los-listados),
  adaptados al usuario mayor (letra grande, pasos simples).
