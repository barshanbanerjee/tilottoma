import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export type UserRole = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'ADMIN';
export type ContributorRequestStatus = 'NONE' | 'REQUESTED' | 'APPROVED' | 'REJECTED';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  contributorRequestStatus: ContributorRequestStatus;
}

export const SESSION_COOKIE_NAME = 'tilottoma_session';

const getJwtSecret = () => {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || 'tilottoma_kolkata_heritage_archive_secret_key_2026';
  return new TextEncoder().encode(secret);
};

export async function signSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    contributorRequestStatus: user.contributorRequestStatus,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      contributorRequestStatus: (payload.contributorRequestStatus as ContributorRequestStatus) || 'NONE',
    };
  } catch {
    return null;
  }
}

import { ADMIN_COOKIE_NAME, getExpectedAdminToken } from '@/constants/auth';

export async function getServerSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const legacyAdminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    const isMasterAdmin = Boolean(legacyAdminCookie && legacyAdminCookie === getExpectedAdminToken());

    let user: SessionUser | null = null;
    if (token) {
      user = await verifySessionToken(token);
    }

    if (isMasterAdmin) {
      if (user) {
        return { ...user, role: 'ADMIN' };
      }
      return {
        id: 'master-admin',
        name: 'System Admin',
        email: 'admin@tilottoma.org',
        role: 'ADMIN',
        contributorRequestStatus: 'APPROVED',
      };
    }

    return user;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const legacyAdminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isMasterAdmin = Boolean(legacyAdminCookie && legacyAdminCookie === getExpectedAdminToken());

  let user: SessionUser | null = null;
  if (token) {
    user = await verifySessionToken(token);
  }

  if (isMasterAdmin) {
    if (user) {
      return { ...user, role: 'ADMIN' };
    }
    return {
      id: 'master-admin',
      name: 'System Admin',
      email: 'admin@tilottoma.org',
      role: 'ADMIN',
      contributorRequestStatus: 'APPROVED',
    };
  }

  return user;
}

export function canContribute(role?: UserRole | string): boolean {
  return ['CONTRIBUTOR', 'MODERATOR', 'ADMIN'].includes(role || '');
}

export function canModerate(role?: UserRole | string): boolean {
  return ['MODERATOR', 'ADMIN'].includes(role || '');
}

export function isAdmin(role?: UserRole | string): boolean {
  return role === 'ADMIN';
}
