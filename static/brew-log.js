(() => {
	let entries = [];
	let editingId = null;

	const els = {};

	const qs = (id) => document.getElementById(id);

	function init() {
		els.form = qs("brew-entry-form");
		els.formTitle = qs("form-title");
		els.formContainer = qs("entry-form-container");
		els.entryList = qs("brew-entry-list");
		els.emptyState = qs("brew-empty-state");
		els.loadingState = qs("brew-loading-state");
		els.errorState = qs("brew-error-state");
		els.clearSection = qs("brew-clear-section");
		els.statsTotal = qs("stat-total");
		els.statsMethod = qs("stat-method");
		els.statsRatio = qs("stat-ratio");
		els.statsBest = qs("stat-best");
		els.ratioDisplay = qs("field-ratio-display");
		els.clearConfirm = qs("clear-confirm");
		els.journalSection = qs("journal-section");
		els.authSection = qs("auth-section");
		els.setupSection = qs("setup-section");
		els.authBar = qs("auth-bar");
		els.authUsername = qs("auth-username");
		els.modal = qs("app-modal");
		els.modalTitle = qs("modal-title");
		els.modalMessage = qs("modal-message");
		els.modalConfirm = qs("modal-confirm");
		els.modalCancel = qs("modal-cancel");

		els.fieldDate = qs("field-date");
		els.fieldBean = qs("field-bean");
		els.fieldRoaster = qs("field-roaster");
		els.fieldRoastDate = qs("field-roast-date");
		els.fieldGrind = qs("field-grind");
		els.fieldDose = qs("field-dose");
		els.fieldWater = qs("field-water");
		els.fieldTemp = qs("field-temp");
		els.fieldMethod = qs("field-method");
		els.fieldBrewTime = qs("field-brew-time");
		els.fieldEquipment = qs("field-equipment");
		els.fieldTaste = qs("field-taste");
		els.fieldRating = qs("field-rating");
		els.fieldNotes = qs("field-notes");
		els.filterMethod = qs("filter-method");
		els.sortBy = qs("sort-by");

		bindEvents();
		checkAuth();
	}

	// ── Generic modal (replaces blocking alert/confirm) ──

	const MODAL_FOCUSABLE =
		"a[href], button:not([disabled]), input:not([disabled]), select, textarea";

	function trapTab(container, e) {
		const items = Array.from(container.querySelectorAll(MODAL_FOCUSABLE));
		if (items.length === 0) return;
		e.preventDefault();
		const idx = items.indexOf(document.activeElement);
		const next = e.shiftKey
			? idx <= 0
				? items.length - 1
				: idx - 1
			: idx === items.length - 1 || idx === -1
				? 0
				: idx + 1;
		items[next].focus();
	}

	function openModal({ title, message, confirmText, cancelText, danger }) {
		return new Promise((resolve) => {
			const previouslyFocused = document.activeElement;
			els.modalTitle.textContent = title;
			els.modalMessage.textContent = message;
			els.modalConfirm.textContent = confirmText || "OK";
			const showCancel = Boolean(cancelText);
			els.modalCancel.textContent = cancelText || "";
			els.modalCancel.classList.toggle("hidden", !showCancel);
			els.modalConfirm.className = showCancel
				? "px-5 py-2 rounded-full font-semibold text-white text-xs tracking-wider uppercase transition-all " +
					(danger ? "bg-red-500 hover:bg-red-400" : "bg-gold-500 hover:bg-gold-400")
				: "px-5 py-2 rounded-full font-semibold text-white text-xs tracking-wider uppercase bg-gold-500 hover:bg-gold-400 transition-all";
			els.modal.classList.remove("hidden");
			els.modal.classList.add("flex");
			els.modalConfirm.focus();

			const close = (result) => {
				els.modal.classList.add("hidden");
				els.modal.classList.remove("flex");
				els.modalConfirm.removeEventListener("click", onConfirm);
				els.modalCancel.removeEventListener("click", onCancel);
				els.modal.removeEventListener("click", onBackdrop);
				document.removeEventListener("keydown", onKeydown);
				if (previouslyFocused) previouslyFocused.focus?.();
				resolve(result);
			};
			const onConfirm = () => close(true);
			const onCancel = () => close(false);
			const onBackdrop = (e) => {
				if (e.target === els.modal) close(false);
			};
			const onKeydown = (e) => {
				if (e.key === "Escape") close(false);
				if (e.key === "Enter") {
					// Enter on the Cancel button must cancel, not confirm.
					close(document.activeElement !== els.modalCancel);
				}
				if (e.key === "Tab") trapTab(els.modal, e);
			};

			els.modalConfirm.addEventListener("click", onConfirm);
			els.modalCancel.addEventListener("click", onCancel);
			els.modal.addEventListener("click", onBackdrop);
			document.addEventListener("keydown", onKeydown);
		});
	}

	const confirmDialog = (title, message, confirmText) =>
		openModal({ title, message, confirmText, cancelText: "Avbryt", danger: true });
	const alertDialog = (title, message) => openModal({ title, message });

	// ── Visibility helpers ──

	function show(element) {
		if (element) element.classList.remove("hidden");
	}

	function hide(element) {
		if (element) element.classList.add("hidden");
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
		const errEl = el.querySelector("#login-error") || el.querySelector("#setup-error");
		if (errEl) {
			errEl.textContent = msg;
			show(errEl);
		}
	}

	function hideAuthError(el) {
		const errEl = el.querySelector("#login-error") || el.querySelector("#setup-error");
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
		hideLoading();
		hide(els.authSection);
		hide(els.setupSection);
		show(els.authBar);
		show(els.journalSection);
		if (els.authUsername) els.authUsername.textContent = user.username;

		// On load failure the error state stays up alone; the list and
		// empty state must not render behind it.
		loadEntries().then((ok) => {
			if (!ok) return;
			populateMethodFilter();
			renderAll();
		});
	}

	function showBrewError(msg) {
		if (els.errorState) {
			show(els.errorState);
			const msgEl = els.errorState.querySelector("[data-error-msg]");
			if (msgEl) msgEl.textContent = msg;
		}
		hide(els.emptyState);
		hide(els.entryList);
	}

	function hideBrewError() {
		hide(els.errorState);
	}

	// ── API client ──

	async function apiFetch(url, options) {
		const opts = options || {};
		const headers = opts.headers || {};
		headers["Content-Type"] = "application/json";
		headers.Accept = "application/json";

		const resp = await fetch(url, { ...opts, headers });
		if (!resp.ok) {
			const body = await resp.json().catch(() => ({}));
			throw new Error(body.error || `Ett fel uppstod (${resp.status})`);
		}
		return resp.json();
	}

	async function checkAuth() {
		showLoading();
		try {
			const data = await apiFetch("/api/auth/me");
			if (data.authenticated && data.user) {
				showJournal(data.user);
			} else {
				hideLoading();
				showLoginForm();
			}
		} catch {
			hideLoading();
			showLoginForm();
		}
	}

	async function handleLogin(username, password) {
		hideAuthError(els.authSection);
		try {
			const data = await apiFetch("/api/auth/login", {
				method: "POST",
				body: JSON.stringify({ username, password }),
			});
			showJournal(data.user);
		} catch (e) {
			showAuthError(els.authSection, e.message);
		}
	}

	async function handleSetup(username, password) {
		hideAuthError(els.setupSection);
		try {
			const data = await apiFetch("/api/auth/setup", {
				method: "POST",
				body: JSON.stringify({ username, password }),
			});
			showJournal(data.user);
		} catch (e) {
			showAuthError(els.setupSection, e.message);
		}
	}

	async function handleLogout() {
		try {
			await apiFetch("/api/auth/logout", { method: "POST" });
		} catch {
			// Logging out locally even if the API call fails
		}
		entries = [];
		hide(els.authBar);
		hide(els.journalSection);
		showLoginForm();
	}

	async function loadEntries() {
		hideBrewError();
		try {
			const data = await apiFetch("/api/brews");
			entries = data.entries || [];
			return true;
		} catch (e) {
			entries = [];
			showBrewError(`Kunde inte ladda bryggningar: ${e.message}`);
			return false;
		}
	}

	async function createEntry(data) {
		return apiFetch("/api/brews", { method: "POST", body: JSON.stringify(data) });
	}

	async function updateEntry(id, data) {
		await apiFetch(`/api/brews/${encodeURIComponent(id)}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async function deleteEntryFromApi(id) {
		await apiFetch(`/api/brews/${encodeURIComponent(id)}`, { method: "DELETE" });
	}

	async function clearAllEntriesFromApi() {
		await apiFetch("/api/brews?all=true", { method: "DELETE" });
	}

	// ── Filtering / sorting / stats ──

	function getFilteredAndSorted() {
		const method = els.filterMethod.value;
		const sort = els.sortBy.value;
		let result = entries.slice();

		if (method) {
			result = result.filter((e) => e.brewMethod === method);
		}

		const [field, dir = "desc"] = sort.split("-");

		result.sort((a, b) => {
			let va;
			let vb;
			if (field === "date") {
				va = new Date(a.date || 0).getTime();
				vb = new Date(b.date || 0).getTime();
			} else {
				va = a.rating || 0;
				vb = b.rating || 0;
			}
			return dir === "desc" ? vb - va : va - vb;
		});

		return result;
	}

	function populateMethodFilter() {
		const methods = {};
		for (const e of entries) {
			if (e.brewMethod) methods[e.brewMethod] = true;
		}
		els.filterMethod.innerHTML = "";
		els.filterMethod.appendChild(new Option("Alla metoder", ""));
		for (const m of Object.keys(methods).sort()) {
			els.filterMethod.appendChild(new Option(m, m));
		}
	}

	function renderAll() {
		renderStats();
		renderEntries();
		updateClearSection();
	}

	function renderStats() {
		const total = entries.length;
		els.statsTotal.textContent = String(total);

		if (total === 0) {
			els.statsMethod.textContent = "—";
			els.statsRatio.textContent = "—";
			els.statsBest.textContent = "—";
			return;
		}

		const methodCounts = {};
		let bestEntry = null;
		let ratioSum = 0;
		let ratioCount = 0;

		for (const e of entries) {
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
		}

		const topMethod =
			Object.keys(methodCounts).sort((a, b) => methodCounts[b] - methodCounts[a])[0] || "—";
		els.statsMethod.textContent = topMethod;

		const avgRatio = ratioCount > 0 ? ratioSum / ratioCount : 0;
		els.statsRatio.textContent = avgRatio > 0 ? `1:${avgRatio.toFixed(1)}` : "—";

		els.statsBest.textContent = bestEntry?.beanName || "—";
	}

	// ── Entry rendering ──

	function esc(value) {
		if (value === null || value === undefined) return "";
		const d = document.createElement("div");
		d.textContent = String(value);
		return d.innerHTML;
	}

	function formatBrewTime(seconds) {
		if (!seconds) return "—";
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return m > 0 ? `${m} min ${s} s` : `${s} s`;
	}

	function formatDate(dateStr) {
		if (!dateStr) return "—";
		return new Date(`${dateStr}T12:00:00`).toLocaleDateString("sv-SE", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	function renderStars(rating) {
		let html = "";
		for (let i = 1; i <= 5; i++) {
			html += i <= rating ? "&#9733;" : "&#9734;";
		}
		return html;
	}

	function detailGrid(entriesList) {
		return entriesList.filter(Boolean).join("");
	}

	function renderTasteTags(text) {
		if (!text) return "";
		return text
			.split(",")
			.map(
				(t) =>
					`<span class="inline-block bg-parchment-100 dark:bg-espresso-600/50 px-2.5 py-1 rounded-full text-xs text-parchment-600 dark:text-parchment-300 font-medium">${esc(t.trim())}</span>`,
			)
			.join("");
	}

	function detailCell(label, value) {
		return (
			`<div class="text-sm"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block">${label}</span>` +
			`<span class="font-medium text-espresso-700 dark:text-parchment-200">${value}</span></div>`
		);
	}

	function renderEntryCard(entry, idx) {
		const card = document.createElement("div");
		card.className =
			"glass-card rounded-2xl border border-parchment-200/50 dark:border-espresso-600/30 hover:border-gold-300/60 dark:hover:border-gold-600/30 transition-all duration-300 animate-fade-in-up";
		card.style.animationDelay = `${idx * 50}ms`;

		const roaster =
			entry.roaster && entry.roaster !== "—"
				? `<span class="text-parchment-400 dark:text-parchment-500 text-xs">· ${esc(entry.roaster)}</span>`
				: "";

		card.innerHTML = `
			<button type="button" class="entry-toggle w-full text-left p-5 sm:p-6 cursor-pointer" aria-expanded="false">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="flex-1 min-w-0">
						<div class="flex flex-wrap items-center gap-2 mb-1.5">
							<h3 class="font-serif font-bold text-lg text-espresso-800 dark:text-parchment-100 truncate">${esc(entry.beanName) || "Okänd böna"}</h3>
							${roaster}
						</div>
						<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-parchment-500 dark:text-parchment-400">
							<span>${esc(formatDate(entry.date))}</span>
							${entry.brewMethod ? `<span class="inline-flex items-center gap-1"><span class="text-gold-500">&#9749;</span> ${esc(entry.brewMethod)}</span>` : ""}
							${entry.ratio ? `<span>1:${esc(entry.ratio)}</span>` : ""}
							${entry.grind ? `<span>${esc(entry.grind)}</span>` : ""}
						</div>
					</div>
					<div class="flex items-center gap-3 shrink-0">
						<span class="text-gold-500 text-lg">${renderStars(entry.rating || 0)}</span>
						<svg class="toggle-chevron size-4 text-parchment-300 dark:text-espresso-500 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
					</div>
				</div>
			</button>
			<div class="entry-details hidden border-t border-parchment-100 dark:border-espresso-600/30 px-5 sm:px-6 pb-5 sm:pb-6 pt-4">
				<div class="gap-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 mb-4">
					${detailGrid([
						entry.dose ? detailCell("Kaffe", `${esc(entry.dose)} g`) : "",
						entry.water ? detailCell("Vatten", `${esc(entry.water)} g`) : "",
						entry.temperature ? detailCell("Temp", `${esc(entry.temperature)} °C`) : "",
						entry.brewTime
							? detailCell("Bryggtid", formatBrewTime(entry.brewTime))
							: "",
						entry.roastDate ? detailCell("Rostdatum", esc(entry.roastDate)) : "",
						entry.equipment ? detailCell("Utrustning", esc(entry.equipment)) : "",
					])}
				</div>
				${
					entry.tasteNotes
						? `<div class="mb-3"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block mb-1">Smaknoteringar</span><div class="flex flex-wrap gap-1.5">${renderTasteTags(entry.tasteNotes)}</div></div>`
						: ""
				}
				${
					entry.notes
						? `<div class="mb-4"><span class="text-parchment-400 dark:text-parchment-500 text-[10px] uppercase tracking-wider block mb-1">Anteckningar</span><p class="text-sm text-parchment-600 dark:text-parchment-300 leading-relaxed">${esc(entry.notes)}</p></div>`
						: ""
				}
				<div class="flex items-center gap-3 pt-3 border-t border-parchment-100 dark:border-espresso-600/30">
					<button type="button" class="btn-edit px-3 py-1.5 rounded-lg font-medium text-gold-600 dark:text-gold-400 text-xs hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-all" data-id="${esc(entry.id)}">Redigera</button>
					<button type="button" class="btn-delete px-3 py-1.5 rounded-lg font-medium text-red-500 hover:text-red-400 text-xs hover:bg-red-50 dark:hover:bg-red-900/10 transition-all" data-id="${esc(entry.id)}">Radera</button>
				</div>
			</div>`;

		const toggle = card.querySelector(".entry-toggle");
		const details = card.querySelector(".entry-details");
		const chevron = card.querySelector(".toggle-chevron");
		toggle.addEventListener("click", () => {
			const isOpen = !details.classList.contains("hidden");
			details.classList.toggle("hidden");
			chevron.classList.toggle("rotate-180");
			toggle.setAttribute("aria-expanded", String(!isOpen));
		});

		card.querySelector(".btn-edit").addEventListener("click", (e) => {
			e.stopPropagation();
			startEdit(e.currentTarget.getAttribute("data-id"));
		});

		card.querySelector(".btn-delete").addEventListener("click", (e) => {
			e.stopPropagation();
			deleteEntry(e.currentTarget.getAttribute("data-id"));
		});

		return card;
	}

	function renderEntries() {
		if (entries.length === 0) {
			hide(els.entryList);
			show(els.emptyState);
			return;
		}

		hide(els.emptyState);
		show(els.entryList);
		els.entryList.innerHTML = "";

		const filtered = getFilteredAndSorted();
		const fragment = document.createDocumentFragment();
		filtered.forEach((entry, idx) => {
			fragment.appendChild(renderEntryCard(entry, idx));
		});
		els.entryList.appendChild(fragment);
	}

	// ── Form ──

	const RATIO_CLASS_SET =
		"w-full px-4 py-2.5 rounded-xl text-sm bg-parchment-50 dark:bg-espresso-700 border border-gold-300 dark:border-gold-600 text-espresso-800 dark:text-gold-300 font-medium";
	const RATIO_CLASS_EMPTY =
		"w-full px-4 py-2.5 rounded-xl text-sm bg-parchment-100 dark:bg-espresso-700 border border-parchment-200 dark:border-espresso-600 text-parchment-500 dark:text-parchment-400";

	function calculateRatio() {
		const dose = Number.parseFloat(els.fieldDose.value);
		const water = Number.parseFloat(els.fieldWater.value);
		if (dose > 0 && water > 0) {
			const ratio = (water / dose).toFixed(1);
			els.ratioDisplay.textContent = `1:${ratio}`;
			els.ratioDisplay.className = RATIO_CLASS_SET;
			return Number.parseFloat(ratio);
		}
		els.ratioDisplay.textContent = "—";
		els.ratioDisplay.className = RATIO_CLASS_EMPTY;
		return null;
	}

	function todayStr() {
		return new Date().toISOString().split("T")[0];
	}

	function getFormData() {
		return {
			date: els.fieldDate.value || todayStr(),
			beanName: els.fieldBean.value.trim(),
			roaster: els.fieldRoaster.value.trim(),
			roastDate: els.fieldRoastDate.value,
			grind: els.fieldGrind.value,
			dose: Number.parseFloat(els.fieldDose.value) || 0,
			water: Number.parseFloat(els.fieldWater.value) || 0,
			ratio: calculateRatio(),
			temperature: Number.parseFloat(els.fieldTemp.value) || 0,
			brewMethod: els.fieldMethod.value.trim(),
			brewTime: Number.parseInt(els.fieldBrewTime.value, 10) || 0,
			equipment: els.fieldEquipment.value.trim(),
			tasteNotes: els.fieldTaste.value.trim(),
			rating: Number.parseInt(els.fieldRating.value, 10) || 0,
			notes: els.fieldNotes.value.trim(),
		};
	}

	function fillForm(entry) {
		els.fieldDate.value = entry.date || todayStr();
		els.fieldBean.value = entry.beanName || "";
		els.fieldRoaster.value = entry.roaster || "";
		els.fieldRoastDate.value = entry.roastDate || "";
		els.fieldGrind.value = entry.grind || "";
		els.fieldDose.value = entry.dose || "";
		els.fieldWater.value = entry.water || "";
		els.fieldTemp.value = entry.temperature || 93;
		els.fieldMethod.value = entry.brewMethod || "";
		els.fieldBrewTime.value = entry.brewTime || "";
		els.fieldEquipment.value = entry.equipment || "";
		els.fieldTaste.value = entry.tasteNotes || "";
		els.fieldRating.value = entry.rating || 0;
		els.fieldNotes.value = entry.notes || "";
		updateStarDisplay(entry.rating || 0);
		calculateRatio();
	}

	function resetForm() {
		editingId = null;
		els.formTitle.textContent = "Nytt brygginlägg";
		els.form.reset();
		els.fieldDate.value = todayStr();
		els.fieldRating.value = 0;
		els.fieldTemp.value = 93;
		updateStarDisplay(0);
		els.ratioDisplay.textContent = "—";
		els.ratioDisplay.className = RATIO_CLASS_EMPTY;
	}

	function showForm() {
		show(els.formContainer);
		els.formContainer.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function hideForm() {
		hide(els.formContainer);
		resetForm();
	}

	function startEdit(id) {
		const entry = entries.find((e) => e.id === id);
		if (!entry) return;
		editingId = id;
		els.formTitle.textContent = "Redigera inlägg";
		fillForm(entry);
		showForm();
	}

	async function addEntry(data) {
		hideBrewError();
		try {
			if (editingId) {
				await updateEntry(editingId, data);
				const original = entries.find((e) => e.id === editingId);
				const updated = {
					...data,
					id: editingId,
					createdAt: original ? original.createdAt : Date.now(),
				};
				entries = entries.map((e) => (e.id === editingId ? updated : e));
			} else {
				const result = await createEntry(data);
				entries.unshift(result.entry);
			}
			populateMethodFilter();
			renderAll();
			hideForm();
		} catch (e) {
			showBrewError(`Kunde inte spara inlägg: ${e.message}`);
		}
	}

	async function deleteEntry(id) {
		const confirmed = await confirmDialog(
			"Radera inlägg",
			"Är du säker på att du vill radera detta inlägg?",
			"Radera",
		);
		if (!confirmed) return;
		hideBrewError();
		try {
			await deleteEntryFromApi(id);
			entries = entries.filter((e) => e.id !== id);
			populateMethodFilter();
			renderAll();
		} catch (e) {
			showBrewError(`Kunde inte radera inlägg: ${e.message}`);
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
			showBrewError(`Kunde inte radera alla inlägg: ${e.message}`);
		}
	}

	function exportEntries() {
		const blob = new Blob([JSON.stringify({ entries }, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `gyllene-koppen-bryggdagbok-${todayStr()}.json`;
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
		document.querySelectorAll(".star-btn").forEach((btn) => {
			const val = Number.parseInt(btn.getAttribute("data-value"), 10);
			if (val <= rating) {
				btn.classList.remove("text-parchment-300", "dark:text-espresso-500");
				btn.classList.add("text-gold-500");
				btn.setAttribute("aria-checked", "true");
			} else {
				btn.classList.remove("text-gold-500");
				btn.classList.add("text-parchment-300", "dark:text-espresso-500");
				btn.setAttribute("aria-checked", "false");
			}
		});
	}

	function bindEvents() {
		qs("login-form").addEventListener("submit", (e) => {
			e.preventDefault();
			const username = qs("login-username").value.trim();
			const password = qs("login-password").value;
			if (username && password) handleLogin(username, password);
		});

		qs("setup-form").addEventListener("submit", (e) => {
			e.preventDefault();
			const username = qs("setup-username").value.trim();
			const password = qs("setup-password").value;
			if (username && password.length >= 8) handleSetup(username, password);
			else showAuthError(els.setupSection, "Lösenordet måste vara minst 8 tecken");
		});

		qs("btn-show-setup").addEventListener("click", showSetupForm);
		qs("btn-show-login").addEventListener("click", showLoginForm);
		qs("btn-logout").addEventListener("click", handleLogout);

		qs("btn-add-entry").addEventListener("click", () => {
			resetForm();
			showForm();
		});
		qs("btn-empty-add").addEventListener("click", () => {
			resetForm();
			showForm();
		});

		qs("btn-cancel-form").addEventListener("click", hideForm);

		qs("btn-retry-load").addEventListener("click", () => {
			hideBrewError();
			loadEntries().then((ok) => {
				if (!ok) return;
				populateMethodFilter();
				renderAll();
			});
		});

		els.form.addEventListener("submit", (e) => {
			e.preventDefault();
			const data = getFormData();
			if (!data.beanName || !data.brewMethod || !data.dose || !data.water) {
				alertDialog(
					"Ofullständigt formulär",
					"Fyll i alla obligatoriska fält: datum, bönans namn, bryggmetod, kaffe (g) och vatten (g).",
				);
				return;
			}
			addEntry(data);
		});

		els.fieldDose.addEventListener("input", calculateRatio);
		els.fieldWater.addEventListener("input", calculateRatio);

		document.querySelectorAll(".star-btn").forEach((btn) => {
			btn.addEventListener("click", () => {
				const val = Number.parseInt(btn.getAttribute("data-value"), 10);
				els.fieldRating.value = val;
				updateStarDisplay(val);
			});
			btn.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					const val = Number.parseInt(btn.getAttribute("data-value"), 10);
					els.fieldRating.value = val;
					updateStarDisplay(val);
				}
			});
		});

		els.filterMethod.addEventListener("change", renderEntries);
		els.sortBy.addEventListener("change", renderEntries);

		qs("btn-export").addEventListener("click", exportEntries);

		qs("btn-clear-all").addEventListener("click", () => {
			els.clearConfirm.classList.toggle("hidden");
		});
		qs("btn-confirm-clear").addEventListener("click", async () => {
			const confirmed = await confirmDialog(
				"Radera alla inlägg",
				"Alla bryggningar raderas permanent. Det går inte att ångra.",
				"Ja, radera allt",
			);
			if (confirmed) clearAllEntries();
			else hide(els.clearConfirm);
		});
		qs("btn-cancel-clear").addEventListener("click", () => {
			hide(els.clearConfirm);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
