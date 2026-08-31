// Minimal D1 stub: each queued handler is invoked with (op, sql, params)
// and returns the value expected by that operation (row, { results },
// or { meta: { changes } }).

export class MockDB {
	constructor() {
		this.queue = [];
		this.calls = [];
	}

	enqueue(...handlers) {
		this.queue.push(...handlers);
		return this;
	}

	prepare(sql) {
		const statement = {
			sql,
			params: [],
			bind(...args) {
				this.params = args;
				return this;
			},
		};
		const consume = (op) => {
			this.calls.push({ op, sql, params: statement.params });
			const handler = this.queue.shift();
			if (!handler) throw new Error(`Unexpected DB ${op}: ${sql}`);
			return handler(op, sql, statement.params);
		};
		statement.first = async () => consume("first");
		statement.all = async () => consume("all");
		statement.run = async () => consume("run");
		return statement;
	}

	async batch(statements) {
		const results = [];
		for (const statement of statements) {
			results.push(await statement.run());
		}
		return results;
	}
}

export function makeContext({ url, method = "GET", body, cookie, db, params = {} }) {
	const headers = new Headers();
	if (cookie) headers.set("Cookie", cookie);
	if (body !== undefined) headers.set("Content-Type", "application/json");
	return {
		request: new Request(url || "https://example.com/api", { method, headers, body }),
		env: { DB: db },
		params,
	};
}
