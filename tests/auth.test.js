import { describe, expect, it } from "vitest";
import {
	clearSessionCookie,
	createSession,
	enforceRateLimit,
	getSessionToken,
	getUserFromSession,
	getUserIdFromSession,
	HttpError,
	handler,
	hashPassword,
	setSessionCookie,
	verifyPassword,
	verifyTurnstile,
} from "../functions/_utils/auth.js";
import { MockDB, makeContext } from "./helpers/mock-d1.js";

describe("hashPassword / verifyPassword", () => {
	it("roundtrips a correct password", async () => {
		const hash = await hashPassword("korrekthästar", "salty");
		expect(await verifyPassword(hash, hash)).toBe(true);
	});

	it("rejects a mismatching pair in constant time", async () => {
		const a = await hashPassword("password1", "salt");
		const b = await hashPassword("password2", "salt");
		expect(await verifyPassword(a, b)).toBe(false);
	});

	it("produces different hashes for the same password and salt", async () => {
		const a = await hashPassword("same", "salt1");
		const b = await hashPassword("same", "salt2");
		expect(a).not.toEqual(b);
	});
});

describe("sessions", () => {
	it("stores only a hash of the token, never the token itself", async () => {
		const db = new MockDB()
			.enqueue(() => ({ meta: { changes: 0 } })) // batched expiry sweep
			.enqueue(() => ({ meta: { changes: 1 } })); // INSERT session
		const token = await createSession({ DB: db }, "user-1");
		const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO sessions"));
		expect(insert).toBeTruthy();
		expect(insert.params[0]).toMatch(/^[0-9a-f]{64}$/);
		expect(insert.params[0]).not.toEqual(token);
	});

	it("sweeps expired sessions in the same batch as the insert", async () => {
		const db = new MockDB()
			.enqueue(() => ({ meta: { changes: 0 } }))
			.enqueue(() => ({ meta: { changes: 1 } }));
		await createSession({ DB: db }, "user-1");
		expect(db.calls[0].sql).toMatch(/^DELETE FROM sessions WHERE expires_at/);
		expect(db.calls[1].sql).toMatch(/^INSERT INTO sessions/);
	});

	it("returns the user id for a valid session without renewing it", async () => {
		const db = new MockDB().enqueue(() => ({
			user_id: "user-1",
			expires_at: Date.now() + 20 * 24 * 60 * 60 * 1000,
		}));
		const userId = await getUserIdFromSession(
			new Request("https://x.com", { headers: { Cookie: "gk_session=abc" } }),
			{ DB: db },
		);
		expect(userId).toBe("user-1");
		expect(db.calls.filter((c) => c.op === "run")).toHaveLength(0);
	});

	it("renews a session that is close to expiring", async () => {
		const db = new MockDB()
			.enqueue(() => ({ user_id: "user-1", expires_at: Date.now() + 1000 }))
			.enqueue(() => ({ meta: { changes: 1 } }));
		const userId = await getUserIdFromSession(
			new Request("https://x.com", { headers: { Cookie: "gk_session=abc" } }),
			{ DB: db },
		);
		expect(userId).toBe("user-1");
		expect(db.calls.filter((c) => c.op === "run")).toHaveLength(1);
	});

	it("rejects an expired session", async () => {
		const db = new MockDB().enqueue(() => ({ user_id: "user-1", expires_at: Date.now() - 1 }));
		const userId = await getUserIdFromSession(
			new Request("https://x.com", { headers: { Cookie: "gk_session=abc" } }),
			{ DB: db },
		);
		expect(userId).toBeNull();
	});

	it("marks cookies HttpOnly, Secure and SameSite=Lax", () => {
		const https = new Request("https://x.com/");
		expect(setSessionCookie("tok", https)).toContain("__Host-gk_session=");
		expect(setSessionCookie("tok", https)).toContain("HttpOnly");
		expect(setSessionCookie("tok", https)).toContain("Secure");
		expect(setSessionCookie("tok", https)).toContain("SameSite=Lax");
		expect(clearSessionCookie(https)).toContain("Max-Age=0");
	});

	it("falls back to the unprefixed cookie name over plain http (local dev)", () => {
		const http = new Request("http://localhost:8788/");
		expect(setSessionCookie("tok", http)).not.toContain("__Host-");
		expect(setSessionCookie("tok", http)).not.toContain("Secure");
		expect(clearSessionCookie(http)).toContain("gk_session=; ");
	});

	it("reads both the __Host- prefixed and plain cookie names", () => {
		const prefixed = new Request("https://x.com", {
			headers: { Cookie: "__Host-gk_session=abc" },
		});
		const plain = new Request("https://x.com", { headers: { Cookie: "gk_session=abc" } });
		expect(getSessionToken(prefixed)).toBe("abc");
		expect(getSessionToken(plain)).toBe("abc");
	});
});

describe("enforceRateLimit", () => {
	it("throws HttpError 429 once the limit is exceeded", () => {
		const context = {
			request: new Request("https://x.com", { headers: { "CF-Connecting-IP": "1.2.3.4" } }),
		};
		for (let i = 0; i < 3; i++) {
			expect(() => enforceRateLimit(context, "test", 3, 60_000)).not.toThrow();
		}
		expect(() => enforceRateLimit(context, "test", 3, 60_000)).toThrowError(HttpError);
		try {
			enforceRateLimit(context, "test", 3, 60_000);
		} catch (e) {
			expect(e.status).toBe(429);
		}
	});
});

describe("handler wrapper", () => {
	it("maps HttpError to a JSON response with its status", async () => {
		const fn = handler(async () => {
			throw new HttpError(404, "Inlägget hittades inte");
		});
		const resp = await fn({});
		expect(resp.status).toBe(404);
		expect((await resp.json()).error).toBe("Inlägget hittades inte");
	});

	it("hides internal error details behind a generic 500", async () => {
		const fn = handler(async () => {
			throw new Error("D1_INTERNAL_LEAK: secret connection string");
		});
		const resp = await fn(makeContext({ db: new MockDB() }));
		expect(resp.status).toBe(500);
		const body = await resp.json();
		expect(body.error).not.toContain("D1_INTERNAL_LEAK");
		expect(body.error).toBe("Ett internt fel uppstod. Försök igen senare.");
	});
});

describe("getUserFromSession", () => {
	it("resolves session and user in a single JOIN query", async () => {
		const db = new MockDB().enqueue(() => ({
			user_id: "user-1",
			username: "kaffe",
			expires_at: Date.now() + 20 * 24 * 60 * 60 * 1000,
		}));
		const user = await getUserFromSession(
			new Request("https://x.com", { headers: { Cookie: "gk_session=abc" } }),
			{ DB: db },
		);
		expect(user).toEqual({ id: "user-1", username: "kaffe" });
		expect(db.calls).toHaveLength(1);
		expect(db.calls[0].sql).toContain("JOIN users");
	});

	it("returns null when the session exists but the user was deleted", async () => {
		// The JOIN yields no row, so the session is treated as invalid.
		const db = new MockDB().enqueue(() => null);
		const user = await getUserFromSession(
			new Request("https://x.com", { headers: { Cookie: "gk_session=abc" } }),
			{ DB: db },
		);
		expect(user).toBeNull();
	});
});

describe("verifyTurnstile", () => {
	it("is a no-op when TURNSTILE_SECRET is not configured", async () => {
		expect(await verifyTurnstile({}, undefined)).toBe(true);
	});

	it("rejects a missing token when the secret is configured", async () => {
		expect(await verifyTurnstile({ TURNSTILE_SECRET: "s3cr3t" }, undefined)).toBe(false);
	});

	it("accepts and rejects based on the siteverify response", async () => {
		const originalFetch = globalThis.fetch;
		const calls = [];
		globalThis.fetch = async (url, init) => {
			const payload = JSON.parse(init.body);
			calls.push({ url, body: payload });
			return new Response(JSON.stringify({ success: payload.response === "good-token" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		try {
			const env = { TURNSTILE_SECRET: "s3cr3t" };
			expect(await verifyTurnstile(env, "good-token")).toBe(true);
			expect(await verifyTurnstile(env, "bad-token")).toBe(false);
			expect(calls[0].body).toEqual({ secret: "s3cr3t", response: "good-token" });
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("fails closed when siteverify cannot be reached", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => {
			throw new Error("network down");
		};
		try {
			expect(await verifyTurnstile({ TURNSTILE_SECRET: "s3cr3t" }, "tok")).toBe(false);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
