(function () {
	'use strict';

	var entries = [];
	var editingId = null;
	var currentUser = null;

	var els = {};

	function qs(id) { return document.getElementById(id); }

	function init() {
		els.form = qs('brew-entry-form');
		els.formTitle = qs('form-title');
		els.formContainer = qs('entry-form-container');
		els.entryList = qs('brew-entry-list');
		els.emptyState = qs('brew-empty-state');
		els.loadingState = qs('brew-loading-state');
		els.errorState = qs('brew-error-state');
		els.clearSection = qs('brew-clear-section');
		els.statsTotal = qs('stat-total');
		els.statsMethod = qs('stat-method');
		els.statsRatio = qs('stat-ratio');
		els.statsBest = qs('stat-best');
		els.ratioDisplay = qs('field-ratio-display');
		els.clearConfirm = qs('clear-confirm');
		els.journalSection = qs('journal-section');
		els.authSection = qs('auth-section');
		els.setupSection = qs('setup-section');
		els.authBar = qs('auth-bar');
		els.authUsername = qs('auth-username');

		els.fieldBean = qs('field-bean');
		els.fieldRoaster = qs('field-roaster');
		els.fieldRoastDate = qs('field-roast-date');
		els.fieldGrind = qs('field-grind');
		els.fieldDose = qs('field-dose');
		els.fieldWater = qs('field-water');
		els.fieldTemp = qs('field-temp');
		els.fieldMethod = qs('field-method');
		els.fieldBrewTime = qs('field-brew-time');
		els.fieldEquipment = qs('field-equipment');
		els.fieldTaste = qs('field-taste');
		els.fieldRating = qs('field-rating');
		els.fieldNotes = qs('field-notes');
		els.filterMethod = qs('filter-method');
		els.sortBy = qs('sort-by');

		bindEvents();
		checkAuth();
	}

	function show(element) {
		if (element) element.classList.remove('hidden');
	}

	function hide(element) {
		if (element) element.classList.add('hidden');
	}

	function showLoading() {
		hide(els.authSection);
		hide(els.setupSection);
		hide(els.journalSection);
		hide(els.authBar);
		hide(els.errorState);
		show(els.loadingState);
	}

	function hideLoading() {
		hide(els.loadingState);
	}

	function showAuthError(el, msg) {
		var errEl = el.querySelector('#login-error') || el.querySelector('#setup-error');
		if (errEl) {
			errEl.textContent = msg;
			show(errEl);
		}
	}

	function hideAuthError(el) {
		var errEl = el.querySelector('#login-error') || el.querySelector('#setup-error');
		if (errEl) hide(errEl);
	}

	function showLoginForm() {
		hideLoading();
		hide(els.journalSection);
		hide(els.authBar);
		hide(els.setupSection);
		show(els.authSection);
		hideAuthError(els.authSection);
	}

	function showSetupForm() {
		hideLoading();
		hide(els.journalSection);
		hide(els.authBar);
		hide(els.authSection);
		show(els.setupSection);
		hideAuthError(els.setupSection);
	}

	function showJournal(user) {
		currentUser = user;
		hideLoading();
		hide(els.authSection);
		hide(els.setupSection);
		show(els.authBar);
		show(els.journalSection);
		if (els.authUsername) els.authUsername.textContent = user.username;

		loadEntries().then(function () {
			populateMethodFilter();
			renderAll();
		});
	}

	function showBrewError(msg) {
		if (els.errorState) {
			show(els.errorState);
			var msgEl = els.errorState.querySelector('[data-error-msg]');
			if (msgEl) msgEl.textContent = msg;
		}
		hide(els.emptyState);
		hide(els.entryList);
	}

	function hideBrewError() {
		hide(els.errorState);
	}

	async function apiFetch(url, options) {
		var opts = options || {};
		var headers = opts.headers || {};
		headers['Content-Type'] = 'application/json';
		headers['Accept'] = 'application/json';

		var resp = await fetch(url, {
			headers: headers,
			...opts
		});

		if (!resp.ok) {
			var body = await resp.json().catch(function () { return {}; });
			throw new Error(body.error || 'Ett fel uppstod (' + resp.status + ')');
		}
		return resp.json();
	}

	async function checkAuth() {
		showLoading();
		try {
			var data = await apiFetch('/api/auth/me');
			if (data.authenticated && data.user) {
				showJournal(data.user);
			} else {
				hideLoading();
				showLoginForm();
			}
		} catch (e) {
			hideLoading();
			showLoginForm();
		}
	}

	async function handleLogin(username, password) {
		hideAuthError(els.authSection);
		try {
			var data = await apiFetch('/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ username: username, password: password })
			});
			showJournal(data.user);
		} catch (e) {
			var msg = e.message;
			if (msg.indexOf('Inloggning') !== -1 || msg.indexOf('användarnamn') !== -1 || msg.indexOf('lösenord') !== -1) {
				showAuthError(els.authSection, msg);
			} else {
				showAuthError(els.authSection, 'Fel användarnamn eller lösenord');
			}
		}
	}

	async function handleSetup(username, password) {
		hideAuthError(els.setupSection);
		try {
			var data = await apiFetch('/api/auth/setup', {
				method: 'POST',
				body: JSON.stringify({ username: username, password: password })
			});
			showJournal(data.user);
		} catch (e) {
			showAuthError(els.setupSection, e.message);
		}
	}

	async function handleLogout() {
		try {
			await apiFetch('/api/auth/logout', { method: 'POST' });
		} catch (e) {
			// ignore
		}
		currentUser = null;
		entries = [];
		hide(els.authBar);
		hide(els.journalSection);
		showLoginForm();
	}

	async function loadEntries() {
		hideBrewError();
		try {
			var data = await apiFetch('/api/brews');
			entries = data.entries || [];
		} catch (e) {
			entries = [];
			showBrewError('Kunde inte ladda bryggningar: ' + e.message);
		}
	}

	async function createEntry(data) {
		await apiFetch('/api/brews', {
			method: 'POST',
			body: JSON.stringify(data)
		});
	}

	async function updateEntry(id, data) {
		await apiFetch('/api/brews/' + encodeURIComponent(id), {
			method: 'PUT',
			body: JSON.stringify(data)
		});
	}

	async function deleteEntryFromApi(id) {
		await apiFetch('/api/brews/' + encodeURIComponent(id), {
			method: 'DELETE'
		});
	}

	async function clearAllEntriesFromApi() {
		await apiFetch('/api/brews?all=true', {
			method: 'DELETE'
		});
	}

	function generateId() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
	}

	function getFilteredAndSorted() {
		var method = els.filterMethod.value;
		var sort = els.sortBy.value;
		var result = entries.slice();

		if (method) {
			result = result.filter(function (e) { return e.brewMethod === method; });
		}

		var parts = sort.split('-');
		var field = parts[0];
		var dir = parts[1] || 'desc';

		result.sort(function (a, b) {
			var va, vb;
			if (field === 'date') {
				va = new Date(a.date || 0).getTime();
				vb = new Date(b.date || 0).getTime();
			} else if (field === 'rating') {
				va = a.rating || 0;
				vb = b.rating || 0;
			}
			if (dir === 'desc') return vb - va;
			return va - vb;
		});

		return result;
	}

	function populateMethodFilter() {
		var methods = {};
		entries.forEach(function (e) {
			if (e.brewMethod) methods[e.brewMethod] = true;
		});
		var keys = Object.keys(methods).sort();
		els.filterMethod.innerHTML = '<option value="">Alla metoder</option>';
		keys.forEach(function (m) {
			var opt = document.createElement('option');
			opt.value = m;
			opt.textContent = m;
			els.filterMethod.appendChild(opt);
		});
	}

	function renderAll() {
		renderStats();
		renderEntries();
		updateClearSection();
	}

	function renderStats() {
		var total = entries.length;
		els.statsTotal.textContent = total;

		if (total === 0) {
			els.statsMethod.textContent = '—';
			els.statsRatio.textContent = '—';
			els.statsBest.textContent = '—';
			return;
		}

		var methodCounts = {};
		var bestEntry = null;
		var ratioSum = 0;
		var ratioCount = 0;

		entries.forEach(function (e) {
			if (e.brewMethod) {
				methodCounts[e.brewMethod] = (methodCounts[e.brewMethod] || 0) + 1;
			}
			if (e.ratio && e.ratio > 0) {
				ratioSum += e.ratio;
				ratioCount++;
			}
			if (!bestEntry || (e.rating || 0) > (bestEntry.rating || 0)) {
				bestEntry = e;
			}
		});

		var topMethod = Object.keys(methodCounts).sort(function (a, b) {
			return methodCounts[b] - methodCounts[a];
		})[0] || '—';
		els.statsMethod.textContent = topMethod;

		var avgRatio = ratioCount > 0 ? (ratioSum / ratioCount) : 0;
		els.statsRatio.textContent = avgRatio > 0 ? '1:' + avgRatio.toFixed(1) : '—';

		els.statsBest.textContent = bestEntry && bestEntry.beanName ? bestEntry.beanName : '—';
	}

	function renderEntries() {
		var filtered = getFilteredAndSorted();

		if (entries.length === 0) {
			hide(els.entryList);
			show(els.emptyState);
			return;
		}

		hide(els.emptyState);
		show(els.entryList);
		els.entryList.innerHTML = '';

		filtered.forEach(function (entry, idx) {
			var card = document.createElement('div');
			card.className = 'glass-card rounded-2xl border border-parchment-200/50 dark:border-espresso-600/30 hover:border-gold-300/60 dark:hover:border-gold-600/30 transition-all duration-300 animate-fade-in-up';
			card.style.animationDelay = (idx * 50) + 'ms';

			var dateStr = entry.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
			var ratingStars = renderStars(entry.rating || 0);

			card.innerHTML =
				'<button class="entry-toggle w-full text-left p-5 sm:p-6 cursor-pointer" aria-expanded="false">' +
				'<div class="flex flex-wrap items-start justify-between gap-4">' +
				'<div class="flex-1 min-w-0">' +
				'<div class="flex flex-wrap items-center gap-2 mb-1.5">' +
				'<h3 class="font-serif font-bold text-lg text-espresso-800 dark:text-parchment-100 truncate">' +
				escapeHtml(entry.beanName || 'Okänd böna') +
				'</h3>' +
				(entry.roaster ? '<span class="text-parchment-400 dark:text-parchment-500 text-xs">· ' + escapeHtml(entry.roaster) + '</span>' : '') +
				'</div>' +
				'<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-parchment-500 dark:text-parchment-400">' +
				'<span>' + dateStr + '</span>' +
				(entry.brewMethod ? '<span class="inline-flex items-center gap-1"><span class="text-gold-500">&#9749;</span> ' + escapeHtml(entry.brewMethod) + '</span>' : '') +
				(entry.ratio ? '<span>1:' + entry.ratio + '</span>' : '') +
				(entry.grind ? '<span>' + escapeHtml(entry.grind) + '</span>' : '') +
				'</div>' +
				'</div>' +
				'<div class="flex items-center gap-3 shrink-0">' +
				'<span class="text-gold-500 text-lg">' + ratingStars + '</span>' +
				'<svg class="toggle-chevron size-4 text-parchment-300 dark:text-espresso-500 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>' +
				'</div>' +
				'</div>' +
				'</button>' +
				'<div class="entry-details hidden border-t border-parchment-100 dark:border-espresso-600/30 px-5 sm:px-6 pb-5 sm:pb-6 pt-4">' +
				'<div class="gap-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 mb-4">' +
				(entry.dose ? '<div class="text-sm"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block">Kaffe</span><span class="font-medium text-espresso-700 dark:text-parchment-200">' + entry.dose + ' g</span></div>' : '') +
				(entry.water ? '<div class="text-sm"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block">Vatten</span><span class="font-medium text-espresso-700 dark:text-parchment-200">' + entry.water + ' g</span></div>' : '') +
				(entry.temperature ? '<div class="text-sm"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block">Temp</span><span class="font-medium text-espresso-700 dark:text-parchment-200">' + entry.temperature + ' °C</span></div>' : '') +
				(entry.brewTime ? '<div class="text-sm"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block">Bryggtid</span><span class="font-medium text-espresso-700 dark:text-parchment-200">' + formatBrewTime(entry.brewTime) + '</span></div>' : '') +
				(entry.roastDate ? '<div class="text-sm"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block">Rostdatum</span><span class="font-medium text-espresso-700 dark:text-parchment-200">' + entry.roastDate + '</span></div>' : '') +
				(entry.equipment ? '<div class="text-sm"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block">Utrustning</span><span class="font-medium text-espresso-700 dark:text-parchment-200">' + escapeHtml(entry.equipment) + '</span></div>' : '') +
				'</div>' +
				(entry.tasteNotes ? '<div class="mb-3"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block mb-1">Smaknoteringar</span><div class="flex flex-wrap gap-1.5">' + renderTasteTags(entry.tasteNotes) + '</div></div>' : '') +
				(entry.notes ? '<div class="mb-4"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block mb-1">Anteckningar</span><p class="text-sm text-parchment-600 dark:text-parchment-300 leading-relaxed">' + escapeHtml(entry.notes) + '</p></div>' : '') +
				'<div class="flex items-center gap-3 pt-3 border-t border-parchment-100 dark:border-espresso-600/30">' +
				'<button class="btn-edit px-3 py-1.5 rounded-lg font-medium text-gold-600 dark:text-gold-400 text-xs hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-all" data-id="' + entry.id + '">Redigera</button>' +
				'<button class="btn-delete px-3 py-1.5 rounded-lg font-medium text-red-500 hover:text-red-400 text-xs hover:bg-red-50 dark:hover:bg-red-900/10 transition-all" data-id="' + entry.id + '">Radera</button>' +
				'</div>' +
				'</div>';

			els.entryList.appendChild(card);

			var toggle = card.querySelector('.entry-toggle');
			var details = card.querySelector('.entry-details');
			var chevron = card.querySelector('.toggle-chevron');
			toggle.addEventListener('click', function () {
				var isOpen = !details.classList.contains('hidden');
				details.classList.toggle('hidden');
				chevron.classList.toggle('rotate-180');
				toggle.setAttribute('aria-expanded', String(!isOpen));
			});

			card.querySelector('.btn-edit').addEventListener('click', function (e) {
				e.stopPropagation();
				startEdit(this.getAttribute('data-id'));
			});

			card.querySelector('.btn-delete').addEventListener('click', function (e) {
				e.stopPropagation();
				deleteEntry(this.getAttribute('data-id'));
			});
		});
	}

	function renderStars(rating) {
		var html = '';
		for (var i = 1; i <= 5; i++) {
			html += i <= rating ? '&#9733;' : '&#9734;';
		}
		return html;
	}

	function renderTasteTags(text) {
		if (!text) return '';
		return text.split(',').map(function (t) {
			return '<span class="inline-block bg-parchment-100 dark:bg-espresso-600/50 px-2.5 py-1 rounded-full text-xs text-parchment-600 dark:text-parchment-300 font-medium">' + escapeHtml(t.trim()) + '</span>';
		}).join('');
	}

	function formatBrewTime(seconds) {
		if (!seconds) return '—';
		var m = Math.floor(seconds / 60);
		var s = seconds % 60;
		if (m > 0) return m + ' min ' + s + ' s';
		return s + ' s';
	}

	function escapeHtml(text) {
		if (!text) return '';
		var d = document.createElement('div');
		d.textContent = text;
		return d.innerHTML;
	}

	function calculateRatio() {
		var dose = parseFloat(els.fieldDose.value);
		var water = parseFloat(els.fieldWater.value);
		if (dose > 0 && water > 0) {
			var ratio = (water / dose).toFixed(1);
			els.ratioDisplay.textContent = '1:' + ratio;
			els.ratioDisplay.className = 'w-full px-4 py-2.5 rounded-xl text-sm bg-parchment-50 dark:bg-espresso-700 border border-gold-300 dark:border-gold-600 text-espresso-800 dark:text-gold-300 font-medium';
			return parseFloat(ratio);
		}
		els.ratioDisplay.textContent = '—';
		els.ratioDisplay.className = 'w-full px-4 py-2.5 rounded-xl text-sm bg-parchment-100 dark:bg-espresso-700 border border-parchment-200 dark:border-espresso-600 text-parchment-500 dark:text-parchment-400';
		return null;
	}

	function getFormData() {
		return {
			id: editingId || generateId(),
			date: new Date().toISOString().split('T')[0],
			beanName: els.fieldBean.value.trim(),
			roaster: els.fieldRoaster.value.trim(),
			roastDate: els.fieldRoastDate.value,
			grind: els.fieldGrind.value,
			dose: parseFloat(els.fieldDose.value) || 0,
			water: parseFloat(els.fieldWater.value) || 0,
			ratio: calculateRatio(),
			temperature: parseFloat(els.fieldTemp.value) || 0,
			brewMethod: els.fieldMethod.value.trim(),
			brewTime: parseInt(els.fieldBrewTime.value, 10) || 0,
			equipment: els.fieldEquipment.value.trim(),
			tasteNotes: els.fieldTaste.value.trim(),
			rating: parseInt(els.fieldRating.value, 10) || 0,
			notes: els.fieldNotes.value.trim(),
			createdAt: Date.now()
		};
	}

	function fillForm(entry) {
		els.fieldBean.value = entry.beanName || '';
		els.fieldRoaster.value = entry.roaster || '';
		els.fieldRoastDate.value = entry.roastDate || '';
		els.fieldGrind.value = entry.grind || '';
		els.fieldDose.value = entry.dose || '';
		els.fieldWater.value = entry.water || '';
		els.fieldTemp.value = entry.temperature || 93;
		els.fieldMethod.value = entry.brewMethod || '';
		els.fieldBrewTime.value = entry.brewTime || '';
		els.fieldEquipment.value = entry.equipment || '';
		els.fieldTaste.value = entry.tasteNotes || '';
		els.fieldRating.value = entry.rating || 0;
		els.fieldNotes.value = entry.notes || '';
		updateStarDisplay(entry.rating || 0);
		calculateRatio();
	}

	function resetForm() {
		editingId = null;
		els.formTitle.textContent = 'Nytt brygginlägg';
		els.form.reset();
		els.fieldRating.value = 0;
		els.fieldTemp.value = 93;
		updateStarDisplay(0);
		els.ratioDisplay.textContent = '—';
		els.ratioDisplay.className = 'w-full px-4 py-2.5 rounded-xl text-sm bg-parchment-100 dark:bg-espresso-700 border border-parchment-200 dark:border-espresso-600 text-parchment-500 dark:text-parchment-400';
	}

	function showForm() {
		hide(els.formContainer);
		show(els.formContainer);
		els.formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function hideForm() {
		hide(els.formContainer);
		resetForm();
	}

	function startEdit(id) {
		var entry = null;
		for (var i = 0; i < entries.length; i++) {
			if (entries[i].id === id) { entry = entries[i]; break; }
		}
		if (!entry) return;
		editingId = id;
		els.formTitle.textContent = 'Redigera inlägg';
		fillForm(entry);
		showForm();
	}

	async function addEntry(data) {
		hideBrewError();
		try {
			if (editingId) {
				await updateEntry(editingId, data);
				for (var i = 0; i < entries.length; i++) {
					if (entries[i].id === editingId) { entries[i] = data; break; }
				}
			} else {
				await createEntry(data);
				entries.unshift(data);
			}
			populateMethodFilter();
			renderAll();
			hideForm();
		} catch (e) {
			showBrewError('Kunde inte spara inlägg: ' + e.message);
		}
	}

	async function deleteEntry(id) {
		if (!confirm('Radera detta inlägg?')) return;
		hideBrewError();
		try {
			await deleteEntryFromApi(id);
			entries = entries.filter(function (e) { return e.id !== id; });
			populateMethodFilter();
			renderAll();
		} catch (e) {
			showBrewError('Kunde inte radera inlägg: ' + e.message);
		}
	}

	async function clearAllEntries() {
		hideBrewError();
		try {
			await clearAllEntriesFromApi();
			entries = [];
			populateMethodFilter();
			renderAll();
			hide(els.clearConfirm);
		} catch (e) {
			showBrewError('Kunde inte radera alla inlägg: ' + e.message);
		}
	}

	function exportEntries() {
		var blob = new Blob([JSON.stringify({ entries: entries }, null, 2)], { type: 'application/json' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = 'gyllene-koppen-bryggdagbok-' + new Date().toISOString().split('T')[0] + '.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function updateClearSection() {
		if (entries.length > 0) {
			show(els.clearSection);
		} else {
			hide(els.clearSection);
		}
	}

	function updateStarDisplay(rating) {
		document.querySelectorAll('.star-btn').forEach(function (btn) {
			var val = parseInt(btn.getAttribute('data-value'), 10);
			if (val <= rating) {
				btn.classList.remove('text-parchment-300', 'dark:text-espresso-500');
				btn.classList.add('text-gold-500');
				btn.setAttribute('aria-checked', 'true');
			} else {
				btn.classList.remove('text-gold-500');
				btn.classList.add('text-parchment-300', 'dark:text-espresso-500');
				btn.setAttribute('aria-checked', 'false');
			}
		});
	}

	function bindEvents() {
		// Login form
		qs('login-form').addEventListener('submit', function (e) {
			e.preventDefault();
			var username = qs('login-username').value.trim();
			var password = qs('login-password').value;
			if (username && password) handleLogin(username, password);
		});

		// Setup form
		qs('setup-form').addEventListener('submit', function (e) {
			e.preventDefault();
			var username = qs('setup-username').value.trim();
			var password = qs('setup-password').value;
			if (username && password.length >= 4) handleSetup(username, password);
			else showAuthError(els.setupSection, 'Lösenordet måste vara minst 4 tecken');
		});

		// Switch between login / setup
		qs('btn-show-setup').addEventListener('click', showSetupForm);
		qs('btn-show-login').addEventListener('click', showLoginForm);

		// Logout
		qs('btn-logout').addEventListener('click', handleLogout);

		// Add entry buttons
		qs('btn-add-entry').addEventListener('click', function () {
			resetForm();
			showForm();
		});
		qs('btn-empty-add').addEventListener('click', function () {
			resetForm();
			showForm();
		});

		// Cancel form
		qs('btn-cancel-form').addEventListener('click', hideForm);

		// Retry
		qs('btn-retry-load').addEventListener('click', function () {
			hideBrewError();
			loadEntries().then(function () {
				populateMethodFilter();
				renderAll();
			});
		});

		// Form submit
		els.form.addEventListener('submit', function (e) {
			e.preventDefault();
			var data = getFormData();
			if (!data.beanName || !data.brewMethod || !data.dose || !data.water) {
				alert('Fyll i alla obligatoriska fält: bönans namn, bryggmetod, kaffe (g) och vatten (g).');
				return;
			}
			addEntry(data);
		});

		// Auto-calculate ratio
		els.fieldDose.addEventListener('input', calculateRatio);
		els.fieldWater.addEventListener('input', calculateRatio);

		// Star rating
		document.querySelectorAll('.star-btn').forEach(function (btn) {
			btn.addEventListener('click', function () {
				var val = parseInt(this.getAttribute('data-value'), 10);
				els.fieldRating.value = val;
				updateStarDisplay(val);
			});
			btn.addEventListener('keydown', function (e) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					var val = parseInt(this.getAttribute('data-value'), 10);
					els.fieldRating.value = val;
					updateStarDisplay(val);
				}
			});
		});

		// Filter / sort
		els.filterMethod.addEventListener('change', renderEntries);
		els.sortBy.addEventListener('change', renderEntries);

		// Export
		qs('btn-export').addEventListener('click', exportEntries);

		// Clear all
		qs('btn-clear-all').addEventListener('click', function () {
			els.clearConfirm.classList.toggle('hidden');
		});
		qs('btn-confirm-clear').addEventListener('click', clearAllEntries);
		qs('btn-cancel-clear').addEventListener('click', function () {
			hide(els.clearConfirm);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
