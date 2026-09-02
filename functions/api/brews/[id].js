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
	sanitizeEntry,
	toEntry,
	UPDATE_SQL,
} from "../../_utils/brews.js";

function notFound() {
	throw new HttpError(404, "Inlägget hittades inte");
}

export const onRequestGet = handler(async (context) => {
	const userId = await getRequiredUserId(context);
	const result = await context.env.DB.prepare("SELECT * FROM brews WHERE id = ? AND user_id = ?")
		.bind(context.params.id, userId)
		.first();
	if (!result) notFound();
	return jsonResponse(toEntry(result));
});

export const onRequestPut = handler(async (context) => {
	const userId = await getRequiredUserId(context);
	const body = await readJsonBody(context.request);
	const entry = sanitizeEntry(body);
	assertEntryValid(entry);

	const { meta } = await context.env.DB.prepare(UPDATE_SQL)
		.bind(...entryValues(entry), context.params.id, userId)
		.run();

	if (meta.changes === 0) notFound();
	return jsonResponse({ success: true });
});

export const onRequestDelete = handler(async (context) => {
	const userId = await getRequiredUserId(context);
	const { meta } = await context.env.DB.prepare("DELETE FROM brews WHERE id = ? AND user_id = ?")
		.bind(context.params.id, userId)
		.run();
	if (meta.changes === 0) notFound();
	return jsonResponse({ success: true });
});
