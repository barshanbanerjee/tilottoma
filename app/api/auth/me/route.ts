import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    // Always fetch latest role and contributor status from DB
    const [latest] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        contributorRequestStatus: users.contributorRequestStatus,
      })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!latest) {
      return NextResponse.json({ user: session });
    }

    return NextResponse.json({ user: latest });
  } catch (error) {
    console.error('Auth /me error:', error);
    return NextResponse.json({ user: null });
  }
}
