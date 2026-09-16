import { db } from './index';
import { streets, historicalNames, sources } from './schema';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log("🌱 Seeding database...");

  // Clean existing data for a fresh seed
  await db.delete(sources);
  await db.delete(historicalNames);
  await db.delete(streets);

  // Seed Park Street
  const [parkStreet] = await db.insert(streets).values({
    name: "Park Street",
    slug: "park-street",
    description: "Park Street is a famous thoroughfare in Kolkata, India. It is known as the Food Street and the Street that Never Sleeps.",
    // Use raw SQL to insert EWKT format for PostGIS
    geom: sql`ST_GeomFromEWKT('SRID=4326;MULTILINESTRING((88.3512 22.5539, 88.3619 22.5501))')`, 
    status: 'APPROVED',
  }).returning({ id: streets.id });

  await db.insert(historicalNames).values({
    streetId: parkStreet.id,
    name: "Burial Ground Road",
    validFrom: "18th Century",
    validUntil: "19th Century",
    explanation: "Named because it led to the South Park Street Cemetery.",
  });

  await db.insert(sources).values({
    streetId: parkStreet.id,
    title: "Calcutta: The Living City",
    author: "Sukanta Chaudhuri",
    sourceType: "Book",
  });

  console.log("✅ Seed complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seeding failed:", e);
  process.exit(1);
});
