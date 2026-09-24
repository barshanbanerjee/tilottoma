import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, hashPassword, signSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { ADMIN_COOKIE_NAME, getExpectedAdminToken } from '@/constants/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || 'admin';

    // 1. Super Admin bootstrap & quick login
    if ((cleanEmail === 'admin' || cleanEmail === 'admin@tilottoma.org') && password === adminPass) {
      let [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, 'admin@tilottoma.org'))
        .limit(1);

      if (!adminUser) {
        // Bootstrap admin account
        const [createdAdmin] = await db
          .insert(users)
          .values({
            name: 'Administrator',
            email: 'admin@tilottoma.org',
            passwordHash: hashPassword(adminPass),
            role: 'ADMIN',
            contributorRequestStatus: 'APPROVED',
          })
          .returning();
        adminUser = createdAdmin;
      }

      const sessionUser = {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: 'ADMIN' as const,
        contributorRequestStatus: 'APPROVED' as const,
      };

      const token = await signSessionToken(sessionUser);
      const response = NextResponse.json({ success: true, user: sessionUser });

      // Set standard session cookie
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      // Also set legacy admin token
      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: getExpectedAdminToken(),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      return response;
    }

    // 2. Standard user / contributor / moderator login
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      contributorRequestStatus: user.contributorRequestStatus,
    };

    const token = await signSessionToken(sessionUser);
    const response = NextResponse.json({ success: true, user: sessionUser });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    // If moderator or admin, set legacy admin cookie as well
    if (['ADMIN', 'MODERATOR'].includes(user.role)) {
      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: getExpectedAdminToken(),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during login' }, { status: 500 });
  }
}
