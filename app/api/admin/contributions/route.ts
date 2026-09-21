import { NextResponse } from 'next/server';
import { getAllStreetsForAdmin } from '@/db/queries';
import { db } from '@/db';
import { streets, sources, historicalNames } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allStreets = await getAllStreetsForAdmin();
    
    // Fetch sources and historical names for each street
    const streetsWithDetails = await Promise.all(
      allStreets.map(async (street) => {
        const streetSources = await db.select().from(sources).where(eq(sources.streetId, street.id));
        const streetHistNames = await db.select().from(historicalNames).where(eq(historicalNames.streetId, street.id));
        return {
          ...street,
          sources: streetSources,
          historicalNames: streetHistNames,
        };
      })
    );

    return NextResponse.json({ contributions: streetsWithDetails });
  } catch (error) {
    console.error('Error fetching admin streets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const {
      name,
      description,
      tags,
      historicalNames: rawHistoricalNames,
      sources: rawSources,
      points,
      status = 'APPROVED',
    } = await req.json();

    if (!name || !points || points.length < 2) {
      return NextResponse.json({ error: 'Name and at least 2 points are required' }, { status: 400 });
    }

    // Generate unique slug from name
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    // PostGIS MULTILINESTRING format: MULTILINESTRING((lng lat, lng lat, ...))
    const coordsStr = points.map((p: { lat: number; lng: number }) => `${p.lng} ${p.lat}`).join(', ');
    const geomString = `SRID=4326;MULTILINESTRING((${coordsStr}))`;

    const cleanedTags = Array.isArray(tags)
      ? tags.map((t: string) => t.trim().replace(/^#+/, '')).filter(Boolean)
      : [];

    const [insertedStreet] = await db.insert(streets).values({
      name,
      slug,
      description: description || null,
      tags: cleanedTags,
      geom: sql`ST_GeomFromEWKT(${geomString})`,
      status: status === 'PENDING' ? 'PENDING' : 'APPROVED',
    }).returning({ id: streets.id });

    // Insert historical names if provided
    if (Array.isArray(rawHistoricalNames) && rawHistoricalNames.length > 0) {
      const validNames = rawHistoricalNames
        .filter((h: any) => h && typeof h.name === 'string' && h.name.trim().length > 0)
        .map((h: any) => ({
          streetId: insertedStreet.id,
          name: h.name.trim(),
          validFrom: h.validFrom?.trim() || null,
          validUntil: h.validUntil?.trim() || null,
          explanation: h.explanation?.trim() || null,
          source: h.source?.trim() || null,
        }));

      if (validNames.length > 0) {
        await db.insert(historicalNames).values(validNames);
      }
    }

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

    // Revalidate public map and admin console cache
    revalidatePath('/', 'layout');
    revalidatePath('/admin');
    revalidatePath(`/street/${slug}`);

    return NextResponse.json({ success: true, id: insertedStreet.id, slug });
  } catch (error) {
    console.error('Error creating street by admin:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

