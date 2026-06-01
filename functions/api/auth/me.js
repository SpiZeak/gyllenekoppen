import { getUserIdFromSession, jsonResponse } from '../../_utils/auth.js';

export async function onRequestGet(context) {
	try {
		var userId = await getUserIdFromSession(context.request, context.env);
		if (!userId) {
			return jsonResponse({ authenticated: false, user: null });
		}

		var user = await context.env.DB.prepare(
			'SELECT id, username, created_at FROM users WHERE id = ?'
		).bind(userId).first();

		if (!user) {
			return jsonResponse({ authenticated: false, user: null });
		}

		return jsonResponse({ authenticated: true, user: { id: user.id, username: user.username } });
	} catch (e) {
		return jsonResponse({ error: e.message, authenticated: false }, 500);
	}
}
