import { NextResponse } from 'next/server';
import { db } from '@/db';
import { streets, sources } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getServerSession, canContribute } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Login is mandatory to contribute streets.' }, { status: 401 });
    }

    if (!canContribute(session.role)) {
      return NextResponse.json(
        { error: 'Verified Contributor status is required to submit street contributions. Please request Contributor status.' },
        { status: 403 }
      );
    }

    const { name, description, sources: rawSources, points, tags, images, blogLinks } = await req.json();

    if (!name || !points || points.length < 2) {
      return NextResponse.json({ error: 'Name and at least 2 points are required' }, { status: 400 });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    // Format points to MULTILINESTRING format
    const coordsStr = points.map((p: { lat: number; lng: number }) => `${p.lng} ${p.lat}`).join(', ');
    const geomString = `SRID=4326;MULTILINESTRING((${coordsStr}))`;

    // Insert street with contributor attribution
    const [insertedStreet] = await db.insert(streets).values({
      name,
      slug,
      description,
      geom: sql`ST_GeomFromEWKT(${geomString})`,
      status: 'PENDING',
      contributedById: session.id,
      contributorName: session.name,
      tags: tags || [],
      images: images || [],
      blogLinks: blogLinks || [],
    }).returning({ id: streets.id });

    // Insert sources if any
    if (rawSources) {
      const sourceLines = rawSources.split('\n').filter((s: string) => s.trim().length > 0);
      if (sourceLines.length > 0) {
        await db.insert(sources).values(
          sourceLines.map((line: string) => ({
            streetId: insertedStreet.id,
            title: line.substring(0, 250), // simple parsing for now
            sourceType: line.startsWith('http') ? 'Link' : 'Text',
            url: line.startsWith('http') ? line : null,
          }))
        );
      }
    }

    // Revalidate admin page so the pending street shows up immediately
    revalidatePath('/admin');

    return NextResponse.json({ success: true, id: insertedStreet.id });
  } catch (error) {
    console.error('Error submitting contribution:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
