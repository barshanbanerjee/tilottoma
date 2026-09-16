import { NextResponse } from 'next/server';
import { getAllStreetsForAdmin } from '@/db/queries';
import { db } from '@/db';
import { streets, sources } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const allStreets = await getAllStreetsForAdmin();
    
    // Fetch sources for each street
    const streetsWithSources = await Promise.all(
      allStreets.map(async (street) => {
        const streetSources = await db.select().from(sources).where(eq(sources.streetId, street.id));
        return {
          ...street,
          sources: streetSources,
        };
      })
    );

    return NextResponse.json({ contributions: streetsWithSources });
  } catch (error) {
    console.error('Error fetching admin streets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description, sources: rawSources, points, status = 'APPROVED' } = await req.json();

    if (!name || !points || points.length < 2) {
      return NextResponse.json({ error: 'Name and at least 2 points are required' }, { status: 400 });
    }

    // Generate unique slug from name
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    // PostGIS MULTILINESTRING format: MULTILINESTRING((lng lat, lng lat, ...))
    const coordsStr = points.map((p: { lat: number; lng: number }) => `${p.lng} ${p.lat}`).join(', ');
    const geomString = `SRID=4326;MULTILINESTRING((${coordsStr}))`;

    const [insertedStreet] = await db.insert(streets).values({
      name,
      slug,
      description: description || null,
      geom: sql`ST_GeomFromEWKT(${geomString})`,
      status: status === 'PENDING' ? 'PENDING' : 'APPROVED',
    }).returning({ id: streets.id });

    if (rawSources) {
      const sourceLines = typeof rawSources === 'string'
        ? rawSources.split('\n').filter((s: string) => s.trim().length > 0)
        : Array.isArray(rawSources) ? rawSources : [];

      if (sourceLines.length > 0) {
        await db.insert(sources).values(
          sourceLines.map((line: any) => {
            const title = typeof line === 'string' ? line.substring(0, 250) : (line.title || '');
            const url = typeof line === 'string' && line.startsWith('http') ? line : (line.url || null);
            return {
              streetId: insertedStreet.id,
              title,
              sourceType: url ? 'Link' : 'Text',
              url,
            };
          })
        );
      }
    }

    return NextResponse.json({ success: true, id: insertedStreet.id });
  } catch (error) {
    console.error('Error creating street by admin:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
