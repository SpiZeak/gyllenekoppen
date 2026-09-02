import { describe, expect, it } from "vitest";
import { hashPassword } from "../functions/_utils/auth.js";
import { onRequestPost as login } from "../functions/api/auth/login.js";
import { onRequestPost as logout } from "../functions/api/auth/logout.js";
import { onRequestGet as me } from "../functions/api/auth/me.js";
import { onRequestPost as setup } from "../functions/api/auth/setup.js";
import { MockDB, makeContext } from "./helpers/mock-d1.js";

const IP = { "CF-Connecting-IP": "203.0.113.10" };

function postBody(payload) {
	return JSON.stringify(payload);
}

describe("POST /api/auth/setup", () => {
	it("creates the first user and sets a session cookie", async () => {
		const db = new MockDB()
			.enqueue(() => ({ meta: { changes: 1 } })) // INSERT user
			.enqueue(() => ({ meta: { changes: 0 } })) // delete expired sessions
			.enqueue(() => ({ meta: { changes: 1 } })); // INSERT session
		const context = makeContext({
			method: "POST",
			body: postBody({ username: "kaffe", password: "bryggaren123" }),
			db,
			url: "https://x.com/api/auth/setup",
		});
		Object.assign(context.request, {});
		context.request.headers.set("CF-Connecting-IP", IP["CF-Connecting-IP"]);

		const resp = await setup(context);
		expect(resp.status).toBe(200);
		const body = await resp.json();
		expect(body.success).toBe(true);
		expect(body.user.username).toBe("kaffe");
		expect(resp.headers.get("Set-Cookie")).toContain("gk_session=");
	});

	it("rejects the second user via the atomic NOT EXISTS insert", async () => {
		const db = new MockDB().enqueue(() => ({ meta: { changes: 0 } }));
		const context = makeContext({
			method: "POST",
			body: postBody({ username: "annan", password: "bryggaren123" }),
			db,
			url: "https://x.com/api/auth/setup",
		});
		context.request.headers.set("CF-Connecting-IP", IP["CF-Connecting-IP"]);

		const resp = await setup(context);
		expect(resp.status).toBe(400);
		expect((await resp.json()).error).toContain("finns redan");
	});

	it("requires an 8 character password", async () => {
		const context = makeContext({
			method: "POST",
			body: postBody({ username: "kaffe", password: "kort" }),
			db: new MockDB(),
			url: "https://x.com/api/auth/setup",
		});
		context.request.headers.set("CF-Connecting-IP", IP["CF-Connecting-IP"]);
		const resp = await setup(context);
		expect(resp.status).toBe(400);
		expect((await resp.json()).error).toContain("8 tecken");
	});

	it("rejects invalid JSON with 400", async () => {
		const context = makeContext({
			method: "POST",
			body: "not json at all",
			db: new MockDB(),
			url: "https://x.com/api/auth/setup",
		});
		context.request.headers.set("CF-Connecting-IP", IP["CF-Connecting-IP"]);
		const resp = await setup(context);
		expect(resp.status).toBe(400);
	});
});

describe("POST /api/auth/login", () => {
	it("logs in with correct credentials", async () => {
		const salt = "abcd";
		const passwordHash = await hashPassword("bryggaren123", salt);
		const db = new MockDB()
			.enqueue(() => ({
				id: "u1",
				username: "kaffe",
				salt,
				password_hash: passwordHash,
			}))
			.enqueue(() => ({ meta: { changes: 1 } })) // delete expired
			.enqueue(() => ({ meta: { changes: 1 } })); // insert session
		const context = makeContext({
			method: "POST",
			body: postBody({ username: "kaffe", password: "bryggaren123" }),
			db,
			url: "https://x.com/api/auth/login",
		});
		context.request.headers.set("CF-Connecting-IP", IP["CF-Connecting-IP"]);

		const resp = await login(context);
		expect(resp.status).toBe(200);
		expect((await resp.json()).user.username).toBe("kaffe");
		expect(resp.headers.get("Set-Cookie")).toContain("gk_session=");
	});

	it("returns the same generic error for wrong password", async () => {
		const salt = "abcd";
		const passwordHash = await hashPassword("bryggaren123", salt);
		const db = new MockDB().enqueue(() => ({
			id: "u1",
			username: "kaffe",
			salt,
			password_hash: passwordHash,
		}));
		const context = makeContext({
			method: "POST",
			body: postBody({ username: "kaffe", password: "fellosenord" }),
			db,
			url: "https://x.com/api/auth/login",
		});
		context.request.headers.set("CF-Connecting-IP", IP["CF-Connecting-IP"]);

		const resp = await login(context);
		expect(resp.status).toBe(401);
		expect((await resp.json()).error).toBe("Fel användarnamn eller lösenord");
	});

	it("returns the same generic error for unknown user", async () => {
		const db = new MockDB().enqueue(() => null);
		const context = makeContext({
			method: "POST",
			body: postBody({ username: "ghost", password: "vadsomhelst1" }),
			db,
			url: "https://x.com/api/auth/login",
		});
		context.request.headers.set("CF-Connecting-IP", IP["CF-Connecting-IP"]);

		const resp = await login(context);
		expect(resp.status).toBe(401);
		expect((await resp.json()).error).toBe("Fel användarnamn eller lösenord");
	});
});

describe("POST /api/auth/logout", () => {
	it("deletes the session and clears the cookie", async () => {
		const db = new MockDB().enqueue(() => ({ meta: { changes: 1 } }));
		const context = makeContext({
			method: "POST",
			db,
			url: "https://x.com/api/auth/logout",
			cookie: "gk_session=tok",
		});

		const resp = await logout(context);
		expect(resp.status).toBe(200);
		expect(resp.headers.get("Set-Cookie")).toContain("Max-Age=0");
		const del = db.calls.find((c) => c.sql.startsWith("DELETE FROM sessions"));
		expect(del).toBeTruthy();
		// The deleted id must be the SHA-256 of the cookie token, not the
		// raw token itself.
		expect(del.params[0]).toMatch(/^[0-9a-f]{64}$/);
		expect(del.params[0]).not.toBe("tok");
	});
});

describe("GET /api/auth/me", () => {
	it("returns the user for a valid session", async () => {
		const db = new MockDB().enqueue(() => ({
			user_id: "u1",
			username: "kaffe",
			expires_at: Date.now() + 20 * 24 * 3600 * 1000,
		}));
		const context = makeContext({
			db,
			url: "https://x.com/api/auth/me",
			cookie: "gk_session=tok",
		});

		const body = await (await me(context)).json();
		expect(body.authenticated).toBe(true);
		expect(body.user.username).toBe("kaffe");
		// Session + user resolved in one JOIN, no follow-up query.
		expect(db.calls).toHaveLength(1);
	});

	it("reports unauthenticated without a session cookie", async () => {
		const context = makeContext({ db: new MockDB(), url: "https://x.com/api/auth/me" });
		const body = await (await me(context)).json();
		expect(body.authenticated).toBe(false);
		expect(body.user).toBeNull();
	});
});
