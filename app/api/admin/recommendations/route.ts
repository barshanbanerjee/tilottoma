import { NextResponse } from 'next/server';
import { getServerSession, canModerate } from '@/lib/auth';
import { db } from '@/db';
import { recommendations, streets } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !canModerate(session.role)) {
      return NextResponse.json({ error: 'Forbidden. Moderator access required.' }, { status: 403 });
    }

    const items = await db
      .select({
        id: recommendations.id,
        streetId: recommendations.streetId,
        streetName: streets.name,
        zone: recommendations.zone,
        title: recommendations.title,
        category: recommendations.category,
        description: recommendations.description,
        address: recommendations.address,
        lat: recommendations.lat,
        lng: recommendations.lng,
        status: recommendations.status,
        contributedById: recommendations.contributedById,
        contributorName: recommendations.contributorName,
        createdAt: recommendations.createdAt,
      })
      .from(recommendations)
      .leftJoin(streets, eq(recommendations.streetId, streets.id))
      .orderBy(desc(recommendations.createdAt));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching admin recommendations:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || !canModerate(session.role)) {
      return NextResponse.json({ error: 'Forbidden. Moderator or admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      category,
      zone,
      description,
      address,
      streetId,
      lat,
      lng,
      status = 'APPROVED',
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Place title is required' }, { status: 400 });
    }
    if (!category || !category.trim()) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }
    if (!zone || !zone.trim()) {
      return NextResponse.json({ error: 'Zone is required' }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const validStatus = ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : 'APPROVED';
    const validStreetId = streetId && UUID_REGEX.test(streetId) ? streetId : null;
    const validUserId = session.id && UUID_REGEX.test(session.id) ? session.id : null;

    const parsedLat = typeof lat === 'number' ? lat : lat ? parseFloat(lat) : null;
    const parsedLng = typeof lng === 'number' ? lng : lng ? parseFloat(lng) : null;

    const [newItem] = await db
      .insert(recommendations)
      .values({
        title: title.trim(),
        category: category.trim(),
        zone: zone.trim(),
        description: description.trim(),
        address: address ? address.trim() : null,
        streetId: validStreetId,
        lat: Number.isFinite(parsedLat) ? parsedLat : null,
        lng: Number.isFinite(parsedLng) ? parsedLng : null,
        status: validStatus as any,
        contributedById: validUserId,
        contributorName: session.name || 'System Curator',
      })
      .returning();

    // If attached to a street, fetch street name for UI display
    let streetName: string | null = null;
    if (validStreetId) {
      const [streetRecord] = await db
        .select({ name: streets.name, slug: streets.slug })
        .from(streets)
        .where(eq(streets.id, validStreetId));
      if (streetRecord) {
        streetName = streetRecord.name;
        revalidatePath(`/street/${streetRecord.slug}`);
      }
    }

    revalidatePath('/', 'layout');
    revalidatePath('/admin');

    return NextResponse.json({
      ...newItem,
      streetName,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating place recommendation:', error);
    return NextResponse.json({ error: 'Failed to create recommendation' }, { status: 500 });
  }
}

