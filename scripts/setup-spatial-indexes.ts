import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/tilottoma";
const sql = postgres(connectionString, { prepare: false });

async function setupSpatial() {
  console.log('Setting up PostGIS spatial indexes and coordinates...');

  // 1. GiST index on streets.geom
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_streets_geom_gist ON streets USING GIST (geom);
  `);
  console.log('✓ GiST index on streets.geom ready');

  // 2. Functional GiST index on recommendations (lng, lat)
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_recommendations_point_gist 
    ON recommendations USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326))
    WHERE lat IS NOT NULL AND lng IS NOT NULL;
  `);
  console.log('✓ Functional GiST index on recommendations point ready');

  // 3. Update existing recommendations with coordinates
  await sql`
    UPDATE recommendations
    SET lat = 22.5531, lng = 88.3524
    WHERE title ILIKE '%Flurys%';
  `;

  await sql`
    UPDATE recommendations
    SET lat = 22.5533, lng = 88.3526
    WHERE title ILIKE '%Peter Cat%';
  `;

  await sql`
    UPDATE recommendations
    SET lat = 22.5484, lng = 88.3618
    WHERE title ILIKE '%South Park Street Cemetery%';
  `;

  await sql`
    UPDATE recommendations
    SET lat = 22.5535, lng = 88.3520
    WHERE title ILIKE '%Oxford Bookstore%';
  `;
  console.log('✓ Exact coordinates populated for Park Street recommendations');

  // 4. Test spatial binding query
  const testResults = await sql`
    WITH target_street AS (
      SELECT id, geom FROM streets WHERE name ILIKE '%Park Street%' LIMIT 1
    )
    SELECT 
      r.title,
      r.category,
      ROUND(ST_Distance(s.geom::geography, ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography)) AS distance_meters
    FROM recommendations r
    CROSS JOIN target_street s
    WHERE ST_DWithin(s.geom::geography, ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography, 450)
    ORDER BY distance_meters ASC;
  `;

  console.log('\nSpatial Binding Test Results for Park Street:');
  console.table(testResults);

  await sql.end();
}

setupSpatial().catch((e) => {
  console.error('Spatial setup failed:', e);
  process.exit(1);
});
