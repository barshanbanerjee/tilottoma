import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/tilottoma";
const sql = postgres(connectionString, { prepare: false });

async function runMigration() {
  console.log('Starting migration on:', connectionString.replace(/:[^:@]+@/, ':***@'));

  try {
    // 1. Enums
    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ user_role enum ready');

    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE contributor_request_status AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ contributor_request_status enum ready');

    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE recommendation_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ recommendation_status enum ready');

    // 2. Users table
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'USER',
        contributor_request_status contributor_request_status NOT NULL DEFAULT 'NONE',
        contributor_bio TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ users table ready');

    // 3. Streets table columns
    await sql.unsafe(`
      ALTER TABLE streets ADD COLUMN IF NOT EXISTS contributed_by_id UUID REFERENCES users(id);
      ALTER TABLE streets ADD COLUMN IF NOT EXISTS contributor_name VARCHAR(255);
      ALTER TABLE streets ADD COLUMN IF NOT EXISTS tags JSONB;
      ALTER TABLE streets ADD COLUMN IF NOT EXISTS images JSONB;
      ALTER TABLE streets ADD COLUMN IF NOT EXISTS blog_links JSONB;
    `);
    console.log('✓ streets columns ready');

    // 4. Recommendations table
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        street_id UUID REFERENCES streets(id),
        zone VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        address TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        status recommendation_status NOT NULL DEFAULT 'PENDING',
        contributed_by_id UUID REFERENCES users(id),
        contributor_name VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ recommendations table ready');

    console.log('\n✅ All migrations executed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
