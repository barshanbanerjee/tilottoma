export const ADMIN_COOKIE_NAME = 'tilottoma_admin_session';

export function getExpectedAdminToken(): string {
  const secret = process.env.ADMIN_PASSWORD || 'admin';
  return btoa(`authenticated:${secret}`);
}
