import { NextResponse } from 'next/server';
import { db } from '@/db';
import { streets, historicalNames, sources } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { status, name, description, points } = await req.json();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (status && !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Explicitly select columns to avoid raw PostGIS geometry deserialization error
    const [existing] = await db.select({
      id: streets.id,
      name: streets.name,
      slug: streets.slug,
      status: streets.status,
    }).from(streets).where(eq(streets.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Street not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (typeof description === 'string') {
      updateData.description = description.trim();
    }

    if (Array.isArray(points) && points.length >= 2) {
      const coordsStr = points.map((p: { lat: number; lng: number }) => `${p.lng} ${p.lat}`).join(', ');
      const geomString = `SRID=4326;MULTILINESTRING((${coordsStr}))`;
      updateData.geom = sql`ST_GeomFromEWKT(${geomString})`;
    }

    // Explicitly return safe columns to avoid Drizzle's Unsupported geometry type error
    const [updated] = await db.update(streets)
      .set(updateData)
      .where(eq(streets.id, id))
      .returning({
        id: streets.id,
        name: streets.name,
        slug: streets.slug,
        status: streets.status,
      });

    // Trigger instant cache revalidation across the deployment
    revalidatePath('/', 'layout');
    revalidatePath('/admin');
    if (updated?.slug) {
      revalidatePath(`/street/${updated.slug}`);
    }

    return NextResponse.json({ success: true, street: updated });
  } catch (error) {
    console.error('Error updating contribution status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Explicitly select id and slug to avoid geometry deserialization error
    const [existing] = await db.select({
      id: streets.id,
      slug: streets.slug,
    }).from(streets).where(eq(streets.id, id));

    await db.delete(historicalNames).where(eq(historicalNames.streetId, id));
    await db.delete(sources).where(eq(sources.streetId, id));
    await db.delete(streets).where(eq(streets.id, id));

    // Trigger instant cache revalidation across the deployment
    revalidatePath('/', 'layout');
    revalidatePath('/admin');
    if (existing?.slug) {
      revalidatePath(`/street/${existing.slug}`);
    }

    return NextResponse.json({ success: true, message: 'Street deleted permanently' });
  } catch (error) {
    console.error('Error deleting street:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
