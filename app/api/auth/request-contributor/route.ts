import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required. Please log in first.' }, { status: 401 });
    }

    const { bio } = await req.json();

    if (!bio || !bio.trim()) {
      return NextResponse.json({ error: 'Please describe your connection to Kolkata heritage or streets.' }, { status: 400 });
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        contributorRequestStatus: 'REQUESTED',
        contributorBio: bio.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        contributorRequestStatus: users.contributorRequestStatus,
      });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Request contributor error:', error);
    return NextResponse.json({ error: 'Failed to submit contributor request.' }, { status: 500 });
  }
}
