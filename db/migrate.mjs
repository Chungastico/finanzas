// Aplica db/schema.sql (idempotente). Uso: npm run db:migrate
import { readFileSync } from "node:fs";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await client.connect();
await client.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
console.log("Esquema fin aplicado");
await client.end();
