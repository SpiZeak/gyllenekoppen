(() => {
	let overlay = null;
	let display = null;
	let startBtn = null;

	let durationMs = 0;
	let remainingMs = 0;
	let deadline = 0;
	let isRunning = false;
	let intervalId = null;
	let audioCtx = null;
	let lastFocused = null;

	const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select, textarea";

	const PRESETS = [
		{ label: "Espresso", seconds: 30 },
		{ label: "Pour-over", seconds: 180 },
		{ label: "French press", seconds: 240 },
		{ label: "Aeropress", seconds: 90 },
		{ label: "Kallbryggd", seconds: 720 },
	];

	function init() {
		if (document.getElementById("brew-timer")) return;

		const timerEl = document.createElement("div");
		timerEl.id = "brew-timer";
		timerEl.innerHTML =
			'<button id="timer-fab" aria-label="Öppna bryggtimer" class="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gold-500 hover:bg-gold-400 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center cursor-pointer animate-timer-pulse" style="filter:drop-shadow(0 4px 12px rgba(196,132,46,0.35))">' +
			'<svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
			'<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />' +
			"</svg>" +
			"</button>";

		overlay = document.createElement("div");
		overlay.id = "timer-overlay";
		// hidden/flex are toggled together in openOverlay/closeOverlay so
		// the display classes never depend on Tailwind's rule order.
		overlay.className =
			"fixed inset-0 z-[60] items-center justify-center bg-black/40 backdrop-blur-sm hidden";
		overlay.setAttribute("role", "dialog");
		overlay.setAttribute("aria-modal", "true");
		overlay.setAttribute("aria-label", "Bryggtimer");
		overlay.innerHTML =
			'<div class="glass-card bg-parchment-50 dark:bg-espresso-800 rounded-3xl p-8 sm:p-10 max-w-sm w-full mx-4 border border-parchment-200/50 dark:border-espresso-600/30 shadow-2xl">' +
			'<div class="flex justify-between items-center mb-6">' +
			'<h2 class="font-serif font-bold text-2xl text-espresso-800 dark:text-parchment-100">&#9202; Timer</h2>' +
			'<button id="timer-close" aria-label="Stäng timer" class="p-2 rounded-lg text-parchment-400 dark:text-parchment-500 hover:text-parchment-600 dark:hover:text-parchment-300 hover:bg-parchment-100 dark:hover:bg-espresso-700 transition-all cursor-pointer">' +
			'<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>' +
			"</button>" +
			"</div>" +
			'<div class="text-center mb-6">' +
			'<div id="timer-display" class="font-serif font-bold text-6xl sm:text-7xl text-espresso-800 dark:text-parchment-100 tracking-tight tabular-nums">0:00</div>' +
			'<p id="timer-status" class="mt-2 text-parchment-400 dark:text-parchment-500 text-sm">Tryck start</p>' +
			"</div>" +
			'<div class="flex justify-center gap-4 mb-6">' +
			'<button id="timer-start" class="px-8 py-3 rounded-full font-semibold text-white text-sm tracking-wide uppercase bg-gold-500 hover:bg-gold-400 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">Start</button>' +
			'<button id="timer-reset" class="px-6 py-3 rounded-full font-medium text-parchment-600 dark:text-parchment-300 text-sm tracking-wide uppercase border border-parchment-200 dark:border-espresso-600 hover:border-gold-300 dark:hover:border-gold-600 hover:text-gold-600 dark:hover:text-gold-400 transition-all cursor-pointer">Nollställ</button>' +
			"</div>" +
			'<div class="pt-4 border-t border-parchment-100 dark:border-espresso-600/30">' +
			'<p class="text-xs font-medium text-parchment-400 dark:text-parchment-500 uppercase tracking-wider mb-3">Snabba val</p>' +
			'<div class="flex flex-wrap gap-2" id="timer-presets"></div>' +
			"</div>" +
			"</div>";

		document.body.appendChild(timerEl);
		document.body.appendChild(overlay);

		display = overlay.querySelector("#timer-display");
		startBtn = overlay.querySelector("#timer-start");
		const resetBtn = overlay.querySelector("#timer-reset");
		const closeBtn = overlay.querySelector("#timer-close");
		const presetBtns = overlay.querySelector("#timer-presets");

		for (const p of PRESETS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className =
				"px-3 py-1.5 rounded-lg text-xs font-medium bg-parchment-100 dark:bg-espresso-700 text-parchment-600 dark:text-parchment-300 hover:bg-gold-50 dark:hover:bg-gold-900/10 hover:text-gold-600 dark:hover:text-gold-400 border border-parchment-200 dark:border-espresso-600 hover:border-gold-300 dark:hover:border-gold-600 transition-all cursor-pointer";
			btn.textContent = `${p.label} (${formatTime(p.seconds)})`;
			btn.addEventListener("click", () => {
				setTimer(p.seconds);
			});
			presetBtns.appendChild(btn);
		}

		document.getElementById("timer-fab").addEventListener("click", () => {
			lastFocused = document.activeElement;
			openOverlay();
			startBtn.focus();
		});

		closeBtn.addEventListener("click", closeOverlay);
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) closeOverlay();
		});
		startBtn.addEventListener("click", toggleTimer);
		resetBtn.addEventListener("click", resetTimer);

		setTimer(PRESETS[0].seconds);
	}

	function openOverlay() {
		overlay.classList.remove("hidden");
		overlay.classList.add("flex");
		document.addEventListener("keydown", handleKeydown);
	}

	function closeOverlay() {
		overlay.classList.add("hidden");
		overlay.classList.remove("flex");
		document.removeEventListener("keydown", handleKeydown);
		if (lastFocused) lastFocused.focus?.();
	}

	function handleKeydown(e) {
		if (e.key === "Escape") {
			closeOverlay();
		}
		if (e.key === " " || e.code === "Space") {
			e.preventDefault();
			toggleTimer();
		}
		if (e.key === "Tab") {
			const items = Array.from(overlay.querySelectorAll(FOCUSABLE));
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
	}

	function setTimer(seconds) {
		durationMs = seconds * 1000;
		remainingMs = durationMs;
		stopTimer();
		updateDisplay();
		updateStatus();
	}

	function toggleTimer() {
		if (isRunning) {
			stopTimer();
		} else {
			startTimer();
		}
	}

	function startTimer() {
		if (remainingMs <= 0) {
			resetTimer();
			return;
		}
		isRunning = true;
		// The countdown is anchored to wall-clock time so throttled
		// background tabs cannot make the timer drift or stall.
		deadline = Date.now() + remainingMs;
		startBtn.textContent = "Pausa";
		startBtn.classList.remove("bg-gold-500", "hover:bg-gold-400");
		startBtn.classList.add("bg-amber-600", "hover:bg-amber-500");
		updateStatus();

		intervalId = setInterval(() => {
			remainingMs = deadline - Date.now();
			if (remainingMs <= 0) {
				remainingMs = 0;
				stopTimer();
				playBeep();
				startBtn.textContent = "Klart!";
				startBtn.classList.remove("bg-amber-600", "hover:bg-amber-500");
				startBtn.classList.add("bg-green-600", "hover:bg-green-500");
				updateStatus("Tiden är ute!");
			}
			updateDisplay();
		}, 250);
		updateDisplay();
	}

	function stopTimer() {
		if (isRunning) {
			remainingMs = Math.max(0, deadline - Date.now());
		}
		isRunning = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		startBtn.textContent = "Start";
		startBtn.classList.remove(
			"bg-amber-600",
			"hover:bg-amber-500",
			"bg-green-600",
			"hover:bg-green-500",
		);
		startBtn.classList.add("bg-gold-500", "hover:bg-gold-400");
		if (remainingMs > 0 || durationMs > 0) updateStatus();
	}

	function resetTimer() {
		stopTimer();
		remainingMs = durationMs;
		updateDisplay();
		updateStatus();
	}

	function updateDisplay() {
		const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
		display.textContent = formatTime(seconds);
	}

	function updateStatus(msg) {
		const status = overlay.querySelector("#timer-status");
		if (msg) {
			status.textContent = msg;
		} else if (isRunning) {
			status.textContent = "Pågår...";
		} else if (remainingMs <= 0 && durationMs > 0) {
			status.textContent = "Tryck start";
		} else {
			status.textContent = "Pausad";
		}
	}

	function formatTime(seconds) {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s < 10 ? "0" : ""}${s}`;
	}

	function playBeep() {
		try {
			if (!audioCtx) {
				audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			}
			const beep = (offset) => {
				const osc = audioCtx.createOscillator();
				const gain = audioCtx.createGain();
				osc.connect(gain);
				gain.connect(audioCtx.destination);
				osc.frequency.value = 880;
				osc.type = "sine";
				gain.gain.setValueAtTime(0.3, audioCtx.currentTime + offset);
				gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + offset + 0.4);
				osc.start(audioCtx.currentTime + offset);
				osc.stop(audioCtx.currentTime + offset + 0.4);
			};
			beep(0);
			beep(0.6);
		} catch {
			// Web Audio not available
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
