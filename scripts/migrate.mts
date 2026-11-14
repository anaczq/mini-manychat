// Aplica as migrations em ./drizzle com o papel dono (DATABASE_URL_UNPOOLED).
import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
  console.log("migrations aplicadas");
} finally {
  await pool.end();
}
