import { getSessionToken, jsonResponse, clearSessionCookie } from '../../_utils/auth.js';

export async function onRequestPost(context) {
	try {
		var token = getSessionToken(context.request);
		if (token) {
			await context.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
		}
		var response = jsonResponse({ success: true });
		response.headers.append('Set-Cookie', clearSessionCookie());
		return response;
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}
