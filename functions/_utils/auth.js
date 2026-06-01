var SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;

export function getSessionToken(request) {
	var cookie = request.headers.get('Cookie') || '';
	var match = cookie.match(/(?:^|;\s*)gk_session=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : null;
}

export function setSessionCookie(token) {
	return 'gk_session=' + encodeURIComponent(token) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + (SESSION_DURATION / 1000);
}

export function clearSessionCookie() {
	return 'gk_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export async function getUserIdFromSession(request, env) {
	var token = getSessionToken(request);
	if (!token) return null;
	try {
		var result = await env.DB.prepare(
			'SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?'
		).bind(token, Date.now()).first();
		if (result) {
			// Extend session on activity
			var newExpiry = Date.now() + SESSION_DURATION;
			await env.DB.prepare(
				'UPDATE sessions SET expires_at = ? WHERE id = ?'
			).bind(newExpiry, token).run();
			return result.user_id;
		}
	} catch (e) {
		// DB unavailable
	}
	return null;
}

export async function requireUserId(context) {
	var userId = await getUserIdFromSession(context.request, context.env);
	if (!userId) {
		return new Response(JSON.stringify({ error: 'Du måste vara inloggad' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	return userId;
}

export function generateToken() {
	var arr = new Uint8Array(32);
	crypto.getRandomValues(arr);
	return btoa(String.fromCharCode.apply(null, arr));
}

export async function hashPassword(password, salt) {
	var encoder = new TextEncoder();
	var keyMaterial = await crypto.subtle.importKey(
		'raw', encoder.encode(password),
		{ name: 'PBKDF2' }, false, ['deriveBits']
	);
	var bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
		keyMaterial, 256
	);
	return btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));
}

export function generateSalt() {
	var arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	return btoa(String.fromCharCode.apply(null, arr));
}

export function jsonResponse(data, status) {
	return new Response(JSON.stringify(data), {
		status: status || 200,
		headers: { 'Content-Type': 'application/json' }
	});
}
