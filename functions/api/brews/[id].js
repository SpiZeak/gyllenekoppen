import { requireUserId, jsonResponse } from '../../_utils/auth.js';

export async function onRequestGet(context) {
	var userId = await requireUserId(context);
	if (userId instanceof Response) return userId;

	try {
		var result = await context.env.DB.prepare(
			'SELECT * FROM brews WHERE id = ? AND user_id = ?'
		).bind(context.params.id, userId).first();
		if (!result) {
			return jsonResponse({ error: 'Not found' }, 404);
		}
		return jsonResponse(result);
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}

export async function onRequestPut(context) {
	var userId = await requireUserId(context);
	if (userId instanceof Response) return userId;

	try {
		var body = await context.request.json();

		var {
			date, beanName, roaster, roastDate, grind,
			dose, water, ratio, temperature, brewMethod, brewTime,
			equipment, tasteNotes, rating, notes
		} = body;

		await context.env.DB.prepare(
			`UPDATE brews SET date=?, bean_name=?, roaster=?, roast_date=?, grind=?, dose=?, water=?, ratio=?, temperature=?, brew_method=?, brew_time=?, equipment=?, taste_notes=?, rating=?, notes=?
			 WHERE id=? AND user_id=?`
		).bind(
			date, beanName, roaster || '', roastDate || '', grind || '',
			dose || 0, water || 0, ratio || 0, temperature || 0,
			brewMethod, brewTime || 0, equipment || '', tasteNotes || '',
			rating || 0, notes || '', context.params.id, userId
		).run();

		return jsonResponse({ success: true });
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}

export async function onRequestDelete(context) {
	var userId = await requireUserId(context);
	if (userId instanceof Response) return userId;

	try {
		await context.env.DB.prepare(
			'DELETE FROM brews WHERE id = ? AND user_id = ?'
		).bind(context.params.id, userId).run();
		return jsonResponse({ success: true });
	} catch (e) {
		return jsonResponse({ error: e.message }, 500);
	}
}
