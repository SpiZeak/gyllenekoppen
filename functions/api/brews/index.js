export async function onRequestGet(context) {
	const { env } = context;
	try {
		const { results } = await env.DB.prepare(
			'SELECT * FROM brews ORDER BY created_at DESC'
		).all();
		return new Response(JSON.stringify({ entries: results }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message, entries: [] }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function onRequestPost(context) {
	const { request, env } = context;
	try {
		const body = await request.json();

		const {
			id, date, beanName, roaster, roastDate, grind,
			dose, water, ratio, temperature, brewMethod, brewTime,
			equipment, tasteNotes, rating, notes, createdAt
		} = body;

		if (!id || !date || !beanName || !brewMethod) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		await env.DB.prepare(
			`INSERT INTO brews (id, date, bean_name, roaster, roast_date, grind, dose, water, ratio, temperature, brew_method, brew_time, equipment, taste_notes, rating, notes, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(
			id, date, beanName, roaster || '', roastDate || '', grind || '',
			dose || 0, water || 0, ratio || 0, temperature || 0,
			brewMethod, brewTime || 0, equipment || '', tasteNotes || '',
			rating || 0, notes || '', createdAt || Date.now()
		).run();

		return new Response(JSON.stringify({ success: true, id }), {
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
	const { env, request } = context;
	try {
		const url = new URL(request.url);
		if (url.searchParams.get('all') === 'true') {
			await env.DB.prepare('DELETE FROM brews').run();
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify({ error: 'Use DELETE /api/brews/:id for single delete' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
