const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const { Pool } = require("pg");

/**
 * Pool de conexiones a PostgreSQL.
 * Usa DATABASE_URL si está definida (Neon, producción, CI);
 * si no, cae a variables sueltas con valores por defecto para desarrollo local.
 */
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Neon exige SSL
      }
    : {
        host: process.env.PGHOST || "localhost",
        port: process.env.PGPORT || 5432,
        database: process.env.PGDATABASE || "astralabs",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "postgres",
      },
);

module.exports = pool;
