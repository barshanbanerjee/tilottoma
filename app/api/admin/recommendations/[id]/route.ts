import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession, canModerate, canContribute } from '@/lib/auth';
import { db } from '@/db';
import { recommendations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || (!canModerate(session.role) && !canContribute(session.role))) {
      return NextResponse.json({ error: 'Forbidden. Contributor or Moderator access required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, title, category, description, address, zone, lat, lng, streetId } = body;

    const updates: Partial<typeof recommendations.$inferInsert> = {
      updatedAt: new Date(),
    };

    // If user is a Contributor (not Moderator/Admin), edits ALWAYS go to PENDING for admin review
    if (!canModerate(session.role)) {
      updates.status = 'PENDING';
      if (session.name || session.email) {
        updates.contributorName = session.name || session.email;
      }
    } else {
      if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
        updates.status = status;
      }
    }
    if (title) updates.title = title.trim();
    if (category) updates.category = category;
    if (description) updates.description = description.trim();
    if (address !== undefined) updates.address = address ? address.trim() : null;
    if (zone) updates.zone = zone;
    if (lat !== undefined) updates.lat = lat !== null && lat !== '' ? parseFloat(lat) : null;
    if (lng !== undefined) updates.lng = lng !== null && lng !== '' ? parseFloat(lng) : null;
    if (streetId !== undefined) updates.streetId = streetId || null;

    const [updated] = await db
      .update(recommendations)
      .set(updates)
      .where(eq(recommendations.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    revalidatePath('/', 'layout');
    revalidatePath('/admin');

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating recommendation:', error);
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !canModerate(session.role)) {
      return NextResponse.json({ error: 'Forbidden. Moderator access required.' }, { status: 403 });
    }

    const { id } = await params;
    await db.delete(recommendations).where(eq(recommendations.id, id));

    revalidatePath('/', 'layout');
    revalidatePath('/admin');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    return NextResponse.json({ error: 'Failed to delete recommendation' }, { status: 500 });
  }
}
