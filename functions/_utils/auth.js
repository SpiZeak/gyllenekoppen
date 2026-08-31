const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
// OWASP recommends 600k iterations for PBKDF2-HMAC-SHA256, but each
// invocation costs CPU time inside the Workers runtime; 100k is a
// deliberate compromise for this application's threat model.
const PBKDF2_ITERATIONS = 100000;

export class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

// Wraps a Pages Function handler: HttpError becomes its JSON response,
// anything unexpected is logged and turned into a generic 500 so that
// internal error messages never reach the client.
export function handler(fn) {
	return async (context) => {
		try {
			return await fn(context);
		} catch (e) {
			if (e instanceof HttpError) {
				return jsonResponse({ error: e.message }, e.status);
			}
			console.error("Unhandled error:", e);
			return jsonResponse({ error: "Ett internt fel uppstod. Försök igen senare." }, 500);
		}
	};
}

async function sha256Hex(text) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function randomHex(bytes) {
	const arr = new Uint8Array(bytes);
	crypto.getRandomValues(arr);
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function getSessionToken(request) {
	const cookie = request.headers.get("Cookie") || "";
	const match = cookie.match(/(?:^|;\s*)gk_session=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : null;
}

export function setSessionCookie(token) {
	return (
		"gk_session=" +
		encodeURIComponent(token) +
		"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" +
		SESSION_DURATION_MS / 1000
	);
}

export function clearSessionCookie() {
	return "gk_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

export async function createSession(env, userId) {
	const token = randomHex(32);
	// Only the SHA-256 hash of the token is stored, so a database leak
	// cannot be replayed as valid sessions.
	const id = await sha256Hex(token);
	await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
		.bind(id, userId, Date.now() + SESSION_DURATION_MS)
		.run();
	return token;
}

export async function deleteSession(env, request) {
	const token = getSessionToken(request);
	if (!token) return;
	const id = await sha256Hex(token);
	await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}

export async function deleteExpiredSessions(env) {
	await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()).run();
}

export async function getUserIdFromSession(request, env) {
	const token = getSessionToken(request);
	if (!token) return null;
	try {
		const id = await sha256Hex(token);
		const session = await env.DB.prepare(
			"SELECT user_id, expires_at FROM sessions WHERE id = ?",
		)
			.bind(id)
			.first();
		if (!session || session.expires_at <= Date.now()) return null;
		// Sliding expiry, but only rewritten when close to expiring so a
		// normal request stream does not turn into one D1 write per call.
		if (session.expires_at - Date.now() < RENEW_THRESHOLD_MS) {
			await env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?")
				.bind(Date.now() + SESSION_DURATION_MS, id)
				.run();
		}
		return session.user_id;
	} catch (e) {
		console.error("Session lookup failed:", e);
		return null;
	}
}

export async function getRequiredUserId(context) {
	const userId = await getUserIdFromSession(context.request, context.env);
	if (!userId) {
		throw new HttpError(401, "Du måste vara inloggad");
	}
	return userId;
}

export function generateSalt() {
	return randomHex(16);
}

export async function hashPassword(password, salt) {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: encoder.encode(salt),
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		256,
	);
	return btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));
}

async function sha256Bytes(text) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return new Uint8Array(digest);
}

// Constant-time comparison of the two derived hashes so the login
// endpoint does not leak how many leading bytes matched.
export async function verifyPassword(candidate, expected) {
	const a = await sha256Bytes(candidate);
	const b = await sha256Bytes(expected);
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

// Best-effort brute-force protection, tracked per isolate. Cloudflare
// may restart isolates at any time, so treat this as friction rather
// than a hard guarantee; a durable limit would need D1 or a Durable
// Object keyed writes budget.
const rateBuckets = new Map();

export function enforceRateLimit(context, scope, max, windowMs) {
	const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
	const key = `${scope}:${ip}`;
	const now = Date.now();
	let bucket = rateBuckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		bucket = { count: 0, resetAt: now + windowMs };
		rateBuckets.set(key, bucket);
		if (rateBuckets.size > 10000) {
			rateBuckets.clear();
		}
	}
	bucket.count += 1;
	if (bucket.count > max) {
		throw new HttpError(429, "För många försök. Vänta en stund och försök igen.");
	}
}

export function jsonResponse(data, status) {
	return new Response(JSON.stringify(data), {
		status: status || 200,
		headers: { "Content-Type": "application/json" },
	});
}

export async function readJsonBody(request) {
	try {
		return await request.json();
	} catch {
		throw new HttpError(400, "Ogiltig förfrågan");
	}
}
