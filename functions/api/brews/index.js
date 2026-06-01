import { requireUserId, jsonResponse } from '../../_utils/auth.js';

export async function onRequestGet(context) {
	var userId = await requireUserId(context);
	if (userId instanceof Response) return userId;

	try {
		var { results } = await context.env.DB.prepare(
			'SELECT * FROM brews WHERE user_id = ? ORDER BY created_at DESC'
		).bind(userId).all();
		return jsonResponse({ entries: results });
	} catch (e) {
		return jsonResponse({ error: e.message, entries: [] }, 500);
	}
}

export async function onRequestPost(context) {
	var userId = await requireUserId(context);
	if (userId instanceof Response) return userId;

	try {
		var body = await context.request.json();

		var {
			id, date, beanName, roaster, roastDate, grind,
			dose, water, ratio, temperature, brewMethod, brewTime,
			equipment, tasteNotes, rating, notes, createdAt
		} = body;

		if (!id || !date || !beanName || !brewMethod) {
			return jsonResponse({ error: 'Missing required fields' }, 400);
		}

		await context.env.DB.prepare(
			`INSERT INTO brews (id, user_id, date, bean_name, roaster, roast_date, grind, dose, water, ratio, temperature, brew_method, brew_time, equipment, taste_notes, rating, notes, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(
			id, userId, date, beanName, roaster || '', roastDate || '', grind || '',
			dose || 0, water || 0, ratio || 0, temperature || 0,
			brewMethod, brewTime || 0, equipment || '', tasteNotes || '',
			rating || 0, notes || '', createdAt || Date.now()
		).run();

		return jsonResponse({ success: true, id });
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}

export async function onRequestDelete(context) {
	var userId = await requireUserId(context);
	if (userId instanceof Response) return userId;

	try {
		var url = new URL(context.request.url);
		if (url.searchParams.get('all') === 'true') {
			await context.env.DB.prepare(
				'DELETE FROM brews WHERE user_id = ?'
			).bind(userId).run();
			return jsonResponse({ success: true });
		}
		return jsonResponse(
			{ error: 'Use DELETE /api/brews/:id for single delete' }, 400
		);
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}
