import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, setSessionCookie, clearSessionCookie } from '../auth/session.js';
import { validateAuthInput } from '../domain/validation.js';

const router = Router();
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });

router.post('/register', async (request, response, next) => {
  try {
    const { name, email, password } = validateAuthInput(request.body, { registering: true });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash],
    );
    setSessionCookie(response, result.rows[0].id);
    return response.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } });
    }
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: { code: error.code, message: error.message } });
    }
    return next(error);
  }
});

router.post('/login', async (request, response, next) => {
  try {
    const { email, password } = validateAuthInput(request.body);
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    const user = result.rows[0];
    const matches = user && await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    }
    setSessionCookie(response, user.id);
    return response.json({ user: publicUser(user) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: { code: error.code, message: error.message } });
    }
    return next(error);
  }
});

router.post('/logout', (_request, response) => {
  clearSessionCookie(response);
  return response.status(204).end();
});

router.get('/me', requireAuth, async (request, response, next) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [request.userId]);
    if (!result.rows[0]) return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please log in to continue.' } });
    return response.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

export default router;
