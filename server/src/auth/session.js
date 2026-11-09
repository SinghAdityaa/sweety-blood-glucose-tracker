import jwt from 'jsonwebtoken';

export const cookieName = process.env.COOKIE_NAME || 'sweety_session';
const maxAgeSeconds = 60 * 60 * 24 * 7;

function cookieOptions() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function setSessionCookie(response, userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) throw new Error('JWT_SECRET must be configured with at least 24 characters.');
  const token = jwt.sign({ sub: userId }, secret, { expiresIn: maxAgeSeconds });
  response.setHeader('Set-Cookie', `${cookieName}=${token}; ${cookieOptions()}`);
}

export function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export function readSessionToken(request) {
  const raw = request.headers.cookie || '';
  const cookie = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : null;
}

export function requireAuth(request, response, next) {
  const token = readSessionToken(request);
  if (!token) return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please log in to continue.' } });
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    request.userId = claims.sub;
    return next();
  } catch {
    clearSessionCookie(response);
    return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Your session has expired. Please log in again.' } });
  }
}
