import {
	createSession,
	enforceRateLimit,
	HttpError,
	handler,
	hashPassword,
	jsonResponse,
	readJsonBody,
	setSessionCookie,
	verifyPassword,
	verifyTurnstile,
} from "../../_utils/auth.js";

export const onRequestPost = handler(async (context) => {
	enforceRateLimit(context, "login", 10, 15 * 60 * 1000);

	const body = await readJsonBody(context.request);
	if (!(await verifyTurnstile(context.env, body.turnstileToken))) {
		throw new HttpError(
			400,
			"Captcha-verifiering misslyckades. Ladda om sidan och försök igen.",
		);
	}

	const username = String(body.username || "").trim();
	const password = String(body.password || "");

	if (!username || !password) {
		throw new HttpError(400, "Ange användarnamn och lösenord");
	}

	const user = await context.env.DB.prepare("SELECT * FROM users WHERE username = ?")
		.bind(username)
		.first();

	if (!user) {
		// Burn a comparable PBKDF2 derivation so response timing does not
		// reveal whether the username exists.
		await hashPassword(password, "timing-equalizer-salt");
		throw new HttpError(401, "Fel användarnamn eller lösenord");
	}

	const passwordHash = await hashPassword(password, user.salt);
	if (!(await verifyPassword(passwordHash, user.password_hash))) {
		throw new HttpError(401, "Fel användarnamn eller lösenord");
	}

	const token = await createSession(context.env, user.id);

	const response = jsonResponse({
		success: true,
		user: { id: user.id, username: user.username },
	});
	response.headers.append("Set-Cookie", setSessionCookie(token, context.request));
	return response;
});
