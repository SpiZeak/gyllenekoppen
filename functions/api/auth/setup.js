import {
	createSession,
	enforceRateLimit,
	generateSalt,
	HttpError,
	handler,
	hashPassword,
	jsonResponse,
	readJsonBody,
	setSessionCookie,
	verifyTurnstile,
} from "../../_utils/auth.js";

export const onRequestPost = handler(async (context) => {
	enforceRateLimit(context, "setup", 10, 15 * 60 * 1000);

	const body = await readJsonBody(context.request);
	if (!(await verifyTurnstile(context.env, body.turnstileToken))) {
		throw new HttpError(
			400,
			"Captcha-verifiering misslyckades. Ladda om sidan och försök igen.",
		);
	}

	const username = String(body.username || "").trim();
	const password = String(body.password || "");

	if (!username || password.length < 8) {
		throw new HttpError(400, "Ange användarnamn och lösenord (minst 8 tecken)");
	}

	const userId = crypto.randomUUID();
	const salt = generateSalt();
	const passwordHash = await hashPassword(password, salt);

	// INSERT ... WHERE NOT EXISTS is a single atomic statement, so two
	// concurrent setup requests cannot both create the first user.
	const { meta } = await context.env.DB.prepare(
		`INSERT INTO users (id, username, password_hash, salt, created_at)
		 SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
	)
		.bind(userId, username, passwordHash, salt, Date.now())
		.run();

	if (meta.changes === 0) {
		throw new HttpError(400, "En användare finns redan. Logga in istället.");
	}

	const token = await createSession(context.env, userId);

	const response = jsonResponse({ success: true, user: { id: userId, username } });
	response.headers.append("Set-Cookie", setSessionCookie(token, context.request));
	return response;
});
