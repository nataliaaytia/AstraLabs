/**
 * Seed de datos de prueba — AstraLabs (Casa Amandita del Adulto Mayor).
 * Idempotente: se puede correr varias veces sin duplicar filas.
 *
 * Uso:
 *   cd Backend
 *   npm run seed
 */
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");

const USUARIOS_SEED = [
  {
    nombre: "Administradora Demo",
    email: "admin@amandita.test",
    password: "Admin123!",
    rol: "Administradora",
  },
  {
    nombre: "Recepción Demo",
    email: "recepcion@amandita.test",
    password: "Recepcion123!",
    rol: "Recepcion",
  },
  {
    nombre: "Almacén y Cocina Demo",
    email: "almacen@amandita.test",
    password: "Almacen123!",
    rol: "Almacen_Cocina",
  },
];

const ARTICULOS_SEED = [
  {
    nombre: "Arroz",
    categoria: "Alimentos",
    unidad_medida: "kg",
    es_perecedero: false,
    stock_minimo: 20,
    lote: {
      numero_lote: "SEED-ARROZ-1",
      cantidad_inicial: 80,
      fecha_vencimiento: null,
    },
  },
  {
    nombre: "Leche en polvo",
    categoria: "Alimentos",
    unidad_medida: "kg",
    es_perecedero: true,
    stock_minimo: 10,
    lote: {
      numero_lote: "SEED-LECHE-1",
      cantidad_inicial: 25,
      fecha_vencimiento: "2026-12-31",
    },
  },
  {
    nombre: "Paracetamol",
    categoria: "Medicinas",
    unidad_medida: "caja",
    es_perecedero: true,
    stock_minimo: 5,
    lote: {
      numero_lote: "SEED-PARAC-1",
      cantidad_inicial: 15,
      fecha_vencimiento: "2027-03-15",
    },
  },
];

const DONANTE_SEED = {
  nombre: "Banco de Alimentos Bolivia",
  tipo: "empresa",
  contacto: "Juana Pérez",
  telefono: "70000000",
  email: "contacto@bancodealimentos.test",
};

async function seedRoles() {
  const { rows } = await pool.query(`SELECT id, nombre FROM roles`);
  const mapa = {};
  rows.forEach((r) => (mapa[r.nombre] = r.id));
  return mapa;
}

async function seedUsuarios(rolesPorNombre) {
  const idsPorEmail = {};
  for (const u of USUARIOS_SEED) {
    const rolId = rolesPorNombre[u.rol];
    if (!rolId) {
      throw new Error(
        `El rol '${u.rol}' no existe en la tabla roles. ¿Corriste schema.sql?`,
      );
    }
    const passwordHash = await bcrypt.hash(u.password, 10);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, rol_id = EXCLUDED.rol_id
       RETURNING id`,
      [u.nombre, u.email, passwordHash, rolId],
    );
    idsPorEmail[u.email] = rows[0].id;
    console.log(`✓ usuario listo: ${u.email} / ${u.password} (${u.rol})`);
  }
  return idsPorEmail;
}

async function seedDonante() {
  const existente = await pool.query(
    `SELECT id FROM donantes WHERE nombre = $1`,
    [DONANTE_SEED.nombre],
  );
  if (existente.rows[0]) return existente.rows[0].id;

  const { rows } = await pool.query(
    `INSERT INTO donantes (nombre, tipo, contacto, telefono, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      DONANTE_SEED.nombre,
      DONANTE_SEED.tipo,
      DONANTE_SEED.contacto,
      DONANTE_SEED.telefono,
      DONANTE_SEED.email,
    ],
  );
  console.log(`✓ donante listo: ${DONANTE_SEED.nombre}`);
  return rows[0].id;
}

async function seedArticulosConLotes(usuarioRecepcionId, donanteId) {
  for (const art of ARTICULOS_SEED) {
    const categoria = await pool.query(
      `SELECT id FROM categorias WHERE nombre = $1`,
      [art.categoria],
    );
    if (!categoria.rows[0]) {
      throw new Error(
        `La categoría '${art.categoria}' no existe. ¿Corriste schema.sql?`,
      );
    }
    const categoriaId = categoria.rows[0].id;

    const { rows: articuloRows } = await pool.query(
      `INSERT INTO articulos (nombre, categoria_id, unidad_medida, es_perecedero, stock_minimo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (nombre, categoria_id)
       DO UPDATE SET unidad_medida = EXCLUDED.unidad_medida
       RETURNING id`,
      [
        art.nombre,
        categoriaId,
        art.unidad_medida,
        art.es_perecedero,
        art.stock_minimo,
      ],
    );
    const articuloId = articuloRows[0].id;
    console.log(`✓ artículo listo: ${art.nombre} (id=${articuloId})`);

    // Idempotencia del lote: si ya existe ese numero_lote para este artículo, no se vuelve a crear.
    const loteExistente = await pool.query(
      `SELECT id FROM lotes WHERE articulo_id = $1 AND numero_lote = $2`,
      [articuloId, art.lote.numero_lote],
    );
    if (loteExistente.rows[0]) {
      console.log(`  (lote ${art.lote.numero_lote} ya existía, se omite)`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: loteRows } = await client.query(
        `INSERT INTO lotes (articulo_id, numero_lote, fecha_vencimiento, donante_id, cantidad_inicial)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          articuloId,
          art.lote.numero_lote,
          art.lote.fecha_vencimiento,
          donanteId,
          art.lote.cantidad_inicial,
        ],
      );
      const loteId = loteRows[0].id;

      const { rows: movRows } = await client.query(
        `INSERT INTO movimientos (tipo, articulo_id, cantidad_total, usuario_id, donante_id)
         VALUES ('entrada', $1, $2, $3, $4)
         RETURNING id`,
        [articuloId, art.lote.cantidad_inicial, usuarioRecepcionId, donanteId],
      );

      // El trigger fn_actualizar_stock_lote() es el único que debe sumar a
      // cantidad_disponible — se dispara aquí, al insertar en movimiento_lotes.
      await client.query(
        `INSERT INTO movimiento_lotes (movimiento_id, lote_id, cantidad) VALUES ($1, $2, $3)`,
        [movRows[0].id, loteId, art.lote.cantidad_inicial],
      );

      await client.query("COMMIT");
      console.log(
        `  ✓ lote ${art.lote.numero_lote} + entrada de ${art.lote.cantidad_inicial} ${art.unidad_medida}`,
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

async function main() {
  console.log("Sembrando datos de prueba en la base de datos...\n");

  const rolesPorNombre = await seedRoles();
  const idsPorEmail = await seedUsuarios(rolesPorNombre);
  const donanteId = await seedDonante();
  await seedArticulosConLotes(
    idsPorEmail["recepcion@amandita.test"],
    donanteId,
  );

  console.log("\nListo. Usuarios de prueba:");
  USUARIOS_SEED.forEach((u) =>
    console.log(`  - ${u.email} / ${u.password} (${u.rol})`),
  );

  await pool.end();
}

main().catch((err) => {
  console.error("Error al sembrar datos:", err);
  pool.end();
  process.exit(1);
});
