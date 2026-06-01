import {
	generateToken, generateSalt, hashPassword,
	setSessionCookie, jsonResponse
} from '../../_utils/auth.js';

export async function onRequestPost(context) {
	try {
		var body = await context.request.json();
		var username = (body.username || '').trim();
		var password = body.password || '';

		if (!username || password.length < 4) {
			return jsonResponse({ error: 'Ange användarnamn och lösenord (minst 4 tecken)' }, 400);
		}

		var existing = await context.env.DB.prepare(
			'SELECT COUNT(*) as count FROM users'
		).first();

		if (existing && existing.count > 0) {
			return jsonResponse({ error: 'En användare finns redan. Logga in istället.' }, 400);
		}

		var userId = crypto.randomUUID();
		var salt = generateSalt();
		var passwordHash = await hashPassword(password, salt);
		var now = Date.now();

		await context.env.DB.prepare(
			'INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)'
		).bind(userId, username, passwordHash, salt, now).run();

		var sessionToken = generateToken();
		var sessionExpiry = now + 30 * 24 * 60 * 60 * 1000;

		await context.env.DB.prepare(
			'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
		).bind(sessionToken, userId, sessionExpiry).run();

		var response = jsonResponse({ success: true, user: { id: userId, username: username } });
		response.headers.append('Set-Cookie', setSessionCookie(sessionToken));
		return response;
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}
