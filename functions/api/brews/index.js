import {
	getRequiredUserId,
	HttpError,
	handler,
	jsonResponse,
	readJsonBody,
} from "../../_utils/auth.js";

function toNumber(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function sanitizeEntry(body) {
	return {
		date: String(body.date || "").trim(),
		beanName: String(body.beanName || "").trim(),
		roaster: String(body.roaster || "").trim(),
		roastDate: String(body.roastDate || "").trim(),
		grind: String(body.grind || "").trim(),
		dose: toNumber(body.dose),
		water: toNumber(body.water),
		ratio: toNumber(body.ratio),
		temperature: toNumber(body.temperature),
		brewMethod: String(body.brewMethod || "").trim(),
		brewTime: Math.trunc(toNumber(body.brewTime)),
		equipment: String(body.equipment || "").trim(),
		tasteNotes: String(body.tasteNotes || "").trim(),
		rating: Math.trunc(toNumber(body.rating)),
		notes: String(body.notes || "").trim(),
	};
}

// DB rows are snake_case; the client expects camelCase.
function toEntry(row) {
	return {
		id: row.id,
		userId: row.user_id,
		date: row.date,
		beanName: row.bean_name,
		roaster: row.roaster,
		roastDate: row.roast_date,
		grind: row.grind,
		dose: row.dose,
		water: row.water,
		ratio: row.ratio,
		temperature: row.temperature,
		brewMethod: row.brew_method,
		brewTime: row.brew_time,
		equipment: row.equipment,
		tasteNotes: row.taste_notes,
		rating: row.rating,
		notes: row.notes,
		createdAt: row.created_at,
	};
}

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

	if (!entry.date || !entry.beanName || !entry.brewMethod) {
		throw new HttpError(400, "Datum, bönans namn och bryggmetod krävs");
	}

	// id and created_at are generated server-side so a client cannot
	// cause primary-key collisions or backdate entries.
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	await context.env.DB.prepare(
		`INSERT INTO brews (id, user_id, date, bean_name, roaster, roast_date, grind, dose, water, ratio, temperature, brew_method, brew_time, equipment, taste_notes, rating, notes, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			id,
			userId,
			entry.date,
			entry.beanName,
			entry.roaster,
			entry.roastDate,
			entry.grind,
			entry.dose,
			entry.water,
			entry.ratio,
			entry.temperature,
			entry.brewMethod,
			entry.brewTime,
			entry.equipment,
			entry.tasteNotes,
			entry.rating,
			entry.notes,
			createdAt,
		)
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
