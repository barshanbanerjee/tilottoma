import 'dotenv/config';
import postgres from 'postgres';
import { hashPassword } from '../lib/password';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/tilottoma";
const sql = postgres(connectionString, { prepare: false });

async function seedRichHistory() {
  console.log('Seeding rich history, admin user, and recommendations...');

  // 1. Super Admin User
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  const adminHash = hashPassword(adminPass);

  const [adminUser] = await sql`
    INSERT INTO users (name, email, password_hash, role, contributor_request_status, contributor_bio)
    VALUES (
      'Administrator',
      'admin@tilottoma.org',
      ${adminHash},
      'ADMIN',
      'APPROVED',
      'Chief Cartographic Archivist & Super Administrator'
    )
    ON CONFLICT (email) DO UPDATE SET
      role = 'ADMIN',
      contributor_request_status = 'APPROVED'
    RETURNING id, name, email, role;
  `;
  console.log('✓ Admin user ready:', adminUser.email);

  // 2. Sample Contributor User
  const contribPass = hashPassword('contributor123');
  const [sampleContrib] = await sql`
    INSERT INTO users (name, email, password_hash, role, contributor_request_status, contributor_bio)
    VALUES (
      'Radharaman Archive Circle',
      'contributor@tilottoma.org',
      ${contribPass},
      'CONTRIBUTOR',
      'APPROVED',
      'Local Kolkata street historian researching Calcutta Municipal Gazettes and colonial municipal records.'
    )
    ON CONFLICT (email) DO UPDATE SET
      role = 'CONTRIBUTOR',
      contributor_request_status = 'APPROVED'
    RETURNING id, name, email, role;
  `;
  console.log('✓ Sample Contributor ready:', sampleContrib.email);

  // 3. Find Park Street
  const [parkStreet] = await sql`
    SELECT id, name FROM streets
    WHERE name ILIKE '%Park Street%'
    LIMIT 1;
  `;

  if (parkStreet) {
    console.log('Found Park Street:', parkStreet.id);

    // Update Park Street tags, contributor, and description
    await sql`
      UPDATE streets
      SET
        description = 'Historically one of the most prominent thoroughfares in Calcutta, connecting Chowringhee to Park Circus. Originally an earthen track through dense woods leading to the English burial grounds, it transformed throughout the 19th and 20th centuries into the cosmopolitan entertainment, dining, and jazz capital of British India.',
        contributed_by_id = ${adminUser.id},
        contributor_name = 'Radharaman Archive Circle',
        tags = ${JSON.stringify(["Colonial Heritage", "Jazz Age", "Historic Eateries", "Burying Ground"])}::jsonb,
        images = ${JSON.stringify([
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Park_Street%2C_Calcutta_c1890.jpg/1280px-Park_Street%2C_Calcutta_c1890.jpg",
            caption: "Park Street looking East towards the South Park Cemetery, circa 1890",
            credit: "Bourne & Shepherd"
          },
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Park_Street_Kolkata.jpg/1280px-Park_Street_Kolkata.jpg",
            caption: "Park Street evening view",
            credit: "Wikimedia Commons"
          }
        ])}::jsonb,
        blog_links = ${JSON.stringify([
          {
            title: "From Burial Ground Road to Queen of Nightlife: The History of Park Street",
            url: "https://en.wikipedia.org/wiki/Park_Street,_Kolkata",
            author: "Calcutta Heritage Society"
          }
        ])}::jsonb
      WHERE id = ${parkStreet.id};
    `;

    // Clear old historical names for clean seed
    await sql`DELETE FROM historical_names WHERE street_id = ${parkStreet.id}`;

    // Insert Park Street historical names progression
    await sql`
      INSERT INTO historical_names (street_id, name, valid_from, valid_until, explanation, source)
      VALUES
        (
          ${parkStreet.id},
          'Burial Ground Road',
          '1760',
          '1780',
          'Originally a secluded muddy path connecting Chowringhee with the South Park Street Cemetery established in 1767 for the colonial English population.',
          'Calcutta Gazette (1784)'
        ),
        (
          ${parkStreet.id},
          'Park Street',
          '1780',
          '2004',
          'Named after the grand 400-acre estate and private deer park of Sir Elijah Impey, the first Chief Justice of the Supreme Court of Judicature at Fort William.',
          'P. Thankappan Nair, A History of Calcutta Streets'
        ),
        (
          ${parkStreet.id},
          'Mother Teresa Sarani',
          '2004',
          'Present',
          'Officially renamed by the Kolkata Municipal Corporation in honor of Nobel Laureate Saint Mother Teresa of Kolkata.',
          'Kolkata Municipal Corporation Gazette Notification'
        );
    `;
    console.log('✓ Park Street historical timeline seeded');

    // Clear old recommendations for clean seed
    await sql`DELETE FROM recommendations WHERE street_id = ${parkStreet.id}`;

    // Insert Park Street Recommendations
    await sql`
      INSERT INTO recommendations (street_id, zone, title, category, description, address, status, contributor_name)
      VALUES
        (
          ${parkStreet.id},
          'Park Street & Chowringhee',
          'Flurys Tea Room',
          'Food & Adda',
          'Legendary European confectionery tearoom established in 1927 by Joseph and Frieda Flury. Famed for its English breakfast, rum balls, and old-world elegance.',
          '18 Park Street, Kolkata 700016',
          'APPROVED',
          'Heritage Foodies Kolkata'
        ),
        (
          ${parkStreet.id},
          'Park Street & Chowringhee',
          'Peter Cat',
          'Food & Adda',
          'Iconic vintage restaurant renowned for its legendary Chelo Kebab served with a dollop of butter, poached egg, and grilled tomatoes.',
          '18A Park Street, Kolkata 700016',
          'APPROVED',
          'Food Guild'
        ),
        (
          ${parkStreet.id},
          'Park Street & Chowringhee',
          'South Park Street Cemetery',
          'Heritage Sites',
          'Opened in 1767, this is one of the earliest non-church cemeteries in the world. Features magnificent Gothic and Indo-Saracenic tombs of colonial pioneers.',
          '52 Park Street, Kolkata 700016',
          'APPROVED',
          'ASI Bengal Circle'
        ),
        (
          ${parkStreet.id},
          'Park Street & Chowringhee',
          'Oxford Bookstore & Cha Bar',
          'Culture & Books',
          'Established in 1919, an intellectual landmark for bibliophiles on Park Street featuring an extensive literary collection and artisanal teas.',
          '17 Park Street, Kolkata 700016',
          'APPROVED',
          'Boi Para Adda'
        );
    `;
    console.log('✓ Park Street recommendations seeded');
  }

  // 4. Shakespeare Sarani
  const [theatreRoad] = await sql`
    SELECT id, name FROM streets
    WHERE name ILIKE '%Shakespeare Sarani%'
    LIMIT 1;
  `;

  if (theatreRoad) {
    await sql`
      UPDATE streets
      SET
        description = 'A major east-west thoroughfare originally known as Theatre Road. In the 19th century, it was the social centre of theatrical arts in British Calcutta.',
        contributor_name = 'Radharaman Archive Circle',
        tags = ${JSON.stringify(["Theatre Heritage", "Colonial Gentry", "Shakespeare Centenary"])}::jsonb
      WHERE id = ${theatreRoad.id};
    `;

    await sql`DELETE FROM historical_names WHERE street_id = ${theatreRoad.id}`;
    await sql`
      INSERT INTO historical_names (street_id, name, valid_from, valid_until, explanation, source)
      VALUES
        (
          ${theatreRoad.id},
          'Theatre Road',
          '1813',
          '1964',
          'Named after the historic Chowringhee Theatre that stood at the corner of Theatre Road and Chowringhee from 1813 until it burned down in 1839.',
          'Radharaman Mitra, Kalikata Darpan'
        ),
        (
          ${theatreRoad.id},
          'Shakespeare Sarani',
          '1964',
          'Present',
          'Renamed on the 400th birth anniversary of the Bard of Avon, William Shakespeare, reflecting Kolkata’s deep love for English dramatic literature.',
          'KMC Gazette 1964'
        );
    `;
    console.log('✓ Shakespeare Sarani timeline seeded');
  }

  console.log('\n✅ Rich seed data completed successfully!');
  await sql.end();
}

seedRichHistory().catch(e => {
  console.error('Seed error:', e);
  process.exit(1);
});
