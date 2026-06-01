export async function onRequestGet(context) {
	const { env, params } = context;
	try {
		const result = await env.DB.prepare('SELECT * FROM brews WHERE id = ?').bind(params.id).first();
		if (!result) {
			return new Response(JSON.stringify({ error: 'Not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify(result), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function onRequestPut(context) {
	const { request, env, params } = context;
	try {
		const body = await request.json();

		const {
			date, beanName, roaster, roastDate, grind,
			dose, water, ratio, temperature, brewMethod, brewTime,
			equipment, tasteNotes, rating, notes
		} = body;

		await env.DB.prepare(
			`UPDATE brews SET date=?, bean_name=?, roaster=?, roast_date=?, grind=?, dose=?, water=?, ratio=?, temperature=?, brew_method=?, brew_time=?, equipment=?, taste_notes=?, rating=?, notes=? WHERE id=?`
		).bind(
			date, beanName, roaster || '', roastDate || '', grind || '',
			dose || 0, water || 0, ratio || 0, temperature || 0,
			brewMethod, brewTime || 0, equipment || '', tasteNotes || '',
			rating || 0, notes || '', params.id
		).run();

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function onRequestDelete(context) {
	const { env, params } = context;
	try {
		await env.DB.prepare('DELETE FROM brews WHERE id = ?').bind(params.id).run();
		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
