import {
	generateToken, hashPassword,
	setSessionCookie, jsonResponse
} from '../../_utils/auth.js';

export async function onRequestPost(context) {
	try {
		var body = await context.request.json();
		var username = (body.username || '').trim();
		var password = body.password || '';

		if (!username || !password) {
			return jsonResponse({ error: 'Ange användarnamn och lösenord' }, 400);
		}

		var user = await context.env.DB.prepare(
			'SELECT * FROM users WHERE username = ?'
		).bind(username).first();

		if (!user) {
			return jsonResponse({ error: 'Fel användarnamn eller lösenord' }, 401);
		}

		var passwordHash = await hashPassword(password, user.salt);

		if (passwordHash !== user.password_hash) {
			return jsonResponse({ error: 'Fel användarnamn eller lösenord' }, 401);
		}

		var sessionToken = generateToken();
		var now = Date.now();
		var sessionExpiry = now + 30 * 24 * 60 * 60 * 1000;

		await context.env.DB.prepare(
			'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
		).bind(sessionToken, user.id, sessionExpiry).run();

		var response = jsonResponse({ success: true, user: { id: user.id, username: user.username } });
		response.headers.append('Set-Cookie', setSessionCookie(sessionToken));
		return response;
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}
