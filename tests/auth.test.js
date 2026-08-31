import { describe, expect, it } from "vitest";
import {
	clearSessionCookie,
	createSession,
	enforceRateLimit,
	getUserIdFromSession,
	HttpError,
	handler,
	hashPassword,
	setSessionCookie,
	verifyPassword,
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
		const db = new MockDB().enqueue(() => ({ meta: { changes: 1 } }));
		const token = await createSession({ DB: db }, "user-1");
		const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO sessions"));
		expect(insert).toBeTruthy();
		expect(insert.params[0]).toMatch(/^[0-9a-f]{64}$/);
		expect(insert.params[0]).not.toEqual(token);
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
		expect(setSessionCookie("tok")).toContain("HttpOnly");
		expect(setSessionCookie("tok")).toContain("Secure");
		expect(setSessionCookie("tok")).toContain("SameSite=Lax");
		expect(clearSessionCookie()).toContain("Max-Age=0");
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
