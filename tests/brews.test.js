import { describe, expect, it } from "vitest";
import {
	onRequestDelete as deleteBrew,
	onRequestPut as updateBrew,
} from "../functions/api/brews/[id].js";
import { onRequestPost as createBrew } from "../functions/api/brews/index.js";
import { MockDB, makeContext } from "./helpers/mock-d1.js";

const COOKIE = { Cookie: "gk_session=valid-token" };

function authedContext(db, { method = "POST", body, url, params } = {}) {
	const context = makeContext({ method, body, db, url, params });
	context.request.headers.set("Cookie", COOKIE.Cookie);
	return context;
}

describe("POST /api/brews", () => {
	it("rejects unauthenticated requests with 401", async () => {
		const context = makeContext({
			method: "POST",
			body: JSON.stringify({}),
			db: new MockDB().enqueue(() => null),
			url: "https://x.com/api/brews",
		});
		const resp = await createBrew(context);
		expect(resp.status).toBe(401);
	});

	it("generates id and created_at server-side", async () => {
		const db = new MockDB()
			.enqueue(() => ({ user_id: "u1", expires_at: Date.now() + 20 * 24 * 3600 * 1000 }))
			.enqueue(() => ({ meta: { changes: 1 } }));
		const context = authedContext(db, {
			body: JSON.stringify({
				id: "client-supplied-id",
				createdAt: 1,
				date: "2026-08-31",
				beanName: "Etiopisk Guji",
				brewMethod: "Pour-over",
			}),
			url: "https://x.com/api/brews",
		});

		const resp = await createBrew(context);
		expect(resp.status).toBe(201);
		const body = await resp.json();
		expect(body.entry.id).not.toBe("client-supplied-id");
		expect(body.entry.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.entry.createdAt).toBeGreaterThan(1);

		const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO brews"));
		expect(insert.params[0]).toBe(body.entry.id);
	});

	it("coerces malicious strings in numeric fields to numbers", async () => {
		const db = new MockDB()
			.enqueue(() => ({ user_id: "u1", expires_at: Date.now() + 20 * 24 * 3600 * 1000 }))
			.enqueue(() => ({ meta: { changes: 1 } }));
		const context = authedContext(db, {
			body: JSON.stringify({
				date: "2026-08-31",
				beanName: "Böna",
				brewMethod: "Espresso",
				dose: "<img src=x onerror=alert(1)>",
				water: { evil: true },
				temperature: "not-a-number",
				rating: "5; DROP TABLE users",
			}),
			url: "https://x.com/api/brews",
		});

		const resp = await createBrew(context);
		expect(resp.status).toBe(201);
		const { entry } = await resp.json();
		expect(entry.dose).toBe(0);
		expect(entry.water).toBe(0);
		expect(entry.temperature).toBe(0);
		expect(entry.rating).toBe(0);
	});

	it("requires date, bean name and brew method", async () => {
		const db = new MockDB().enqueue(() => ({
			user_id: "u1",
			expires_at: Date.now() + 20 * 24 * 3600 * 1000,
		}));
		const context = authedContext(db, {
			body: JSON.stringify({ beanName: "Bara bönor" }),
			url: "https://x.com/api/brews",
		});
		const resp = await createBrew(context);
		expect(resp.status).toBe(400);
	});
});

describe("PUT /api/brews/:id", () => {
	it("returns 404 when no row was updated", async () => {
		const db = new MockDB()
			.enqueue(() => ({ user_id: "u1", expires_at: Date.now() + 20 * 24 * 3600 * 1000 }))
			.enqueue(() => ({ meta: { changes: 0 } }));
		const context = authedContext(db, {
			method: "PUT",
			body: JSON.stringify({ date: "2026-08-31", beanName: "B", brewMethod: "M" }),
			url: "https://x.com/api/brews/saknas",
			params: { id: "saknas" },
		});
		const resp = await updateBrew(context);
		expect(resp.status).toBe(404);
	});

	it("succeeds when the row belongs to the user", async () => {
		const db = new MockDB()
			.enqueue(() => ({ user_id: "u1", expires_at: Date.now() + 20 * 24 * 3600 * 1000 }))
			.enqueue(() => ({ meta: { changes: 1 } }));
		const context = authedContext(db, {
			method: "PUT",
			body: JSON.stringify({ date: "2026-08-30", beanName: "B", brewMethod: "M", dose: 18 }),
			url: "https://x.com/api/brews/finns",
			params: { id: "finns" },
		});
		const resp = await updateBrew(context);
		expect(resp.status).toBe(200);
	});
});

describe("DELETE /api/brews/:id", () => {
	it("returns 404 when nothing was deleted", async () => {
		const db = new MockDB()
			.enqueue(() => ({ user_id: "u1", expires_at: Date.now() + 20 * 24 * 3600 * 1000 }))
			.enqueue(() => ({ meta: { changes: 0 } }));
		const context = authedContext(db, {
			method: "DELETE",
			url: "https://x.com/api/brews/saknas",
			params: { id: "saknas" },
		});
		const resp = await deleteBrew(context);
		expect(resp.status).toBe(404);
	});
});
