import { NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@/lib/auth';
import { db } from '@/db';
import { users, streets, recommendations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !isAdmin(session.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { role, contributorRequestStatus } = body;

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (role && ['USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN'].includes(role)) {
      updates.role = role;
    }

    if (contributorRequestStatus && ['NONE', 'REQUESTED', 'APPROVED', 'REJECTED'].includes(contributorRequestStatus)) {
      updates.contributorRequestStatus = contributorRequestStatus;
      // If approving contributor request and user is USER, promote them to CONTRIBUTOR
      if (contributorRequestStatus === 'APPROVED' && (!role || role === 'USER')) {
        updates.role = 'CONTRIBUTOR';
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        contributorRequestStatus: users.contributorRequestStatus,
        updatedAt: users.updatedAt,
      });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !isAdmin(session.role)) {
      return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent deleting own account
    if (session.id === id) {
      return NextResponse.json({ error: 'You cannot delete your own active administrator account.' }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Safely detach user reference from any streets and recommendations they contributed
    await db
      .update(streets)
      .set({ contributedById: null })
      .where(eq(streets.contributedById, id));

    await db
      .update(recommendations)
      .set({ contributedById: null })
      .where(eq(recommendations.contributedById, id));

    // Delete user
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ success: true, message: `User ${existing.email} deleted successfully` });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

