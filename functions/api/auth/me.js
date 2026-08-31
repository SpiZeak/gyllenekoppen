import { getUserIdFromSession, handler, jsonResponse } from "../../_utils/auth.js";

export const onRequestGet = handler(async (context) => {
	const userId = await getUserIdFromSession(context.request, context.env);
	if (!userId) {
		return jsonResponse({ authenticated: false, user: null });
	}

	const user = await context.env.DB.prepare(
		"SELECT id, username, created_at FROM users WHERE id = ?",
	)
		.bind(userId)
		.first();

	if (!user) {
		return jsonResponse({ authenticated: false, user: null });
	}

	return jsonResponse({ authenticated: true, user: { id: user.id, username: user.username } });
});
