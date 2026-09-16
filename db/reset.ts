import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(connectionString, { max: 1 });

async function reset() {
  console.log("🧹 Resetting public schema...");
  await sql.unsafe(`DROP SCHEMA public CASCADE;`);
  await sql.unsafe(`CREATE SCHEMA public;`);
  
  console.log("🌍 Enabling PostGIS...");
  await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS postgis;`);
  
  console.log("✅ Database reset successfully.");
  process.exit(0);
}

reset().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
