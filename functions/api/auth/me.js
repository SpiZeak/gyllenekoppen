import { getUserFromSession, handler, jsonResponse } from "../../_utils/auth.js";

export const onRequestGet = handler(async (context) => {
	// Single JOIN: session lookup and user fetch in one D1 round trip.
	const user = await getUserFromSession(context.request, context.env);
	if (!user) {
		return jsonResponse({ authenticated: false, user: null });
	}
	return jsonResponse({ authenticated: true, user });
});
