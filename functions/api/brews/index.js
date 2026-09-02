import {
	getRequiredUserId,
	HttpError,
	handler,
	jsonResponse,
	readJsonBody,
} from "../../_utils/auth.js";
import {
	assertEntryValid,
	entryValues,
	INSERT_SQL,
	sanitizeEntry,
	toEntry,
} from "../../_utils/brews.js";

export const onRequestGet = handler(async (context) => {
	const userId = await getRequiredUserId(context);
	const { results } = await context.env.DB.prepare(
		"SELECT * FROM brews WHERE user_id = ? ORDER BY created_at DESC",
	)
		.bind(userId)
		.all();
	return jsonResponse({ entries: results.map(toEntry) });
});

export const onRequestPost = handler(async (context) => {
	const userId = await getRequiredUserId(context);
	const body = await readJsonBody(context.request);
	const entry = sanitizeEntry(body);
	assertEntryValid(entry);

	// id and created_at are generated server-side so a client cannot
	// cause primary-key collisions or backdate entries.
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	await context.env.DB.prepare(INSERT_SQL)
		.bind(id, userId, ...entryValues(entry), createdAt)
		.run();

	return jsonResponse({ success: true, entry: { id, userId, createdAt, ...entry } }, 201);
});

export const onRequestDelete = handler(async (context) => {
	const userId = await getRequiredUserId(context);
	const url = new URL(context.request.url);
	if (url.searchParams.get("all") !== "true") {
		throw new HttpError(400, "Use DELETE /api/brews/:id for single delete");
	}
	await context.env.DB.prepare("DELETE FROM brews WHERE user_id = ?").bind(userId).run();
	return jsonResponse({ success: true });
});
