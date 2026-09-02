import { clearSessionCookie, deleteSession, handler, jsonResponse } from "../../_utils/auth.js";

export const onRequestPost = handler(async (context) => {
	await deleteSession(context.env, context.request);
	const response = jsonResponse({ success: true });
	response.headers.append("Set-Cookie", clearSessionCookie(context.request));
	return response;
});
