import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/tilottoma";
const sql = postgres(connectionString, { prepare: false });

async function check() {
  const approvedStreets = await sql`SELECT id, name, slug, status, contributor_name, tags FROM streets WHERE status = 'APPROVED'`;
  console.log('Approved streets:', approvedStreets);

  const histNames = await sql`SELECT street_id, name, valid_from, valid_until, explanation FROM historical_names`;
  console.log('Historical names count:', histNames.length);

  const users = await sql`SELECT id, name, email, role, contributor_request_status FROM users`;
  console.log('Users count:', users.length);

  const recs = await sql`SELECT id, title, category, zone, status FROM recommendations`;
  console.log('Recommendations count:', recs.length);

  await sql.end();
}

check();
