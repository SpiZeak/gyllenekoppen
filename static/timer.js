(function () {
	'use strict';

	var timerEl = null;
	var overlay = null;
	var display = null;
	var startBtn = null;
	var resetBtn = null;
	var closeBtn = null;
	var presetBtns = null;

	var totalSeconds = 0;
	var remainingSeconds = 0;
	var isRunning = false;
	var intervalId = null;
	var audioCtx = null;

	var PRESETS = [
		{ label: 'Espresso', seconds: 30 },
		{ label: 'Pour-over', seconds: 180 },
		{ label: 'French press', seconds: 240 },
		{ label: 'Aeropress', seconds: 90 },
		{ label: 'Kallbryggd', seconds: 720 }
	];

	function init() {
		if (document.getElementById('brew-timer')) return;

		// Floating button
		timerEl = document.createElement('div');
		timerEl.id = 'brew-timer';
		timerEl.innerHTML =
			'<button id="timer-fab" aria-label="Öppna bryggtimer" class="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gold-500 hover:bg-gold-400 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center cursor-pointer animate-timer-pulse" style="filter:drop-shadow(0 4px 12px rgba(196,132,46,0.35))">' +
			'<svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
			'<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />' +
			'</svg>' +
			'</button>';

		// Overlay
		overlay = document.createElement('div');
		overlay.id = 'timer-overlay';
		overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm hidden';
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', 'Bryggtimer');
		overlay.innerHTML =
			'<div class="glass-card rounded-3xl p-8 sm:p-10 max-w-sm w-full mx-4 border border-parchment-200/50 dark:border-espresso-600/30 shadow-2xl">' +
			'<div class="flex justify-between items-center mb-6">' +
			'<h2 class="font-serif font-bold text-2xl text-espresso-800 dark:text-parchment-100">&#9202; Timer</h2>' +
			'<button id="timer-close" aria-label="Stäng timer" class="p-2 rounded-lg text-parchment-400 dark:text-parchment-500 hover:text-parchment-600 dark:hover:text-parchment-300 hover:bg-parchment-100 dark:hover:bg-espresso-700 transition-all cursor-pointer">' +
			'<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>' +
			'</button>' +
			'</div>' +
			'<div class="text-center mb-6">' +
			'<div id="timer-display" class="font-serif font-bold text-6xl sm:text-7xl text-espresso-800 dark:text-parchment-100 tracking-tight tabular-nums">0:00</div>' +
			'<p id="timer-status" class="mt-2 text-parchment-400 dark:text-parchment-500 text-sm">Tryck start</p>' +
			'</div>' +
			'<div class="flex justify-center gap-4 mb-6">' +
			'<button id="timer-start" class="px-8 py-3 rounded-full font-semibold text-white text-sm tracking-wide uppercase bg-gold-500 hover:bg-gold-400 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">Start</button>' +
			'<button id="timer-reset" class="px-6 py-3 rounded-full font-medium text-parchment-600 dark:text-parchment-300 text-sm tracking-wide uppercase border border-parchment-200 dark:border-espresso-600 hover:border-gold-300 dark:hover:border-gold-600 hover:text-gold-600 dark:hover:text-gold-400 transition-all cursor-pointer">Nollställ</button>' +
			'</div>' +
			'<div class="pt-4 border-t border-parchment-100 dark:border-espresso-600/30">' +
			'<p class="text-xs font-medium text-parchment-400 dark:text-parchment-500 uppercase tracking-wider mb-3">Snabba val</p>' +
			'<div class="flex flex-wrap gap-2" id="timer-presets"></div>' +
			'</div>' +
			'</div>';

		document.body.appendChild(timerEl);
		document.body.appendChild(overlay);

		display = overlay.querySelector('#timer-display');
		startBtn = overlay.querySelector('#timer-start');
		resetBtn = overlay.querySelector('#timer-reset');
		closeBtn = overlay.querySelector('#timer-close');
		presetBtns = overlay.querySelector('#timer-presets');

		// Build presets
		PRESETS.forEach(function (p) {
			var btn = document.createElement('button');
			btn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-parchment-100 dark:bg-espresso-700 text-parchment-600 dark:text-parchment-300 hover:bg-gold-50 dark:hover:bg-gold-900/10 hover:text-gold-600 dark:hover:text-gold-400 border border-parchment-200 dark:border-espresso-600 hover:border-gold-300 dark:hover:border-gold-600 transition-all cursor-pointer';
			btn.textContent = p.label + ' (' + formatTime(p.seconds) + ')';
			btn.addEventListener('click', function () {
				setTimer(p.seconds);
			});
			presetBtns.appendChild(btn);
		});

		bindEvents();
		updateDisplay();
	}

	function bindEvents() {
		document.getElementById('timer-fab').addEventListener('click', function () {
			overlay.classList.remove('hidden');
			document.addEventListener('keydown', handleKeydown);
		});

		closeBtn.addEventListener('click', closeOverlay);
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) closeOverlay();
		});

		startBtn.addEventListener('click', toggleTimer);
		resetBtn.addEventListener('click', resetTimer);

		document.addEventListener('visibilitychange', function () {
			if (document.hidden && isRunning) {
				// Keep running in background
			}
		});
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') {
			closeOverlay();
		}
		if (e.key === ' ' || e.key === 'Space') {
			e.preventDefault();
			toggleTimer();
		}
	}

	function closeOverlay() {
		overlay.classList.add('hidden');
		document.removeEventListener('keydown', handleKeydown);
	}

	function setTimer(seconds) {
		totalSeconds = seconds;
		remainingSeconds = seconds;
		stopTimer();
		updateDisplay();
		updateStatus();
	}

	function toggleTimer() {
		if (remainingSeconds <= 0 && !isRunning) {
			resetTimer();
			return;
		}
		if (isRunning) {
			stopTimer();
		} else {
			startTimer();
		}
	}

	function startTimer() {
		if (remainingSeconds <= 0) return;
		isRunning = true;
		startBtn.textContent = 'Pausa';
		startBtn.classList.remove('bg-gold-500', 'hover:bg-gold-400');
		startBtn.classList.add('bg-amber-600', 'hover:bg-amber-500');
		updateStatus();

		intervalId = setInterval(function () {
			remainingSeconds--;
			updateDisplay();
			if (remainingSeconds <= 0) {
				remainingSeconds = 0;
				stopTimer();
				playBeep();
				startBtn.textContent = 'Klart!';
				startBtn.classList.remove('bg-amber-600', 'hover:bg-amber-500');
				startBtn.classList.add('bg-green-600', 'hover:bg-green-500');
				updateStatus('Tiden är ute!');
			}
		}, 1000);
	}

	function stopTimer() {
		isRunning = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		startBtn.textContent = 'Start';
		startBtn.classList.remove('bg-amber-600', 'hover:bg-amber-500', 'bg-green-600', 'hover:bg-green-500');
		startBtn.classList.add('bg-gold-500', 'hover:bg-gold-400');
		updateStatus();
	}

	function resetTimer() {
		stopTimer();
		remainingSeconds = totalSeconds;
		updateDisplay();
		updateStatus();
	}

	function updateDisplay() {
		display.textContent = formatTime(Math.max(0, remainingSeconds));
	}

	function updateStatus(msg) {
		var status = overlay.querySelector('#timer-status');
		if (msg) {
			status.textContent = msg;
		} else if (isRunning) {
			status.textContent = 'Pågår...';
		} else {
			status.textContent = 'Pausad';
		}
	}

	function formatTime(seconds) {
		var m = Math.floor(seconds / 60);
		var s = seconds % 60;
		return m + ':' + (s < 10 ? '0' : '') + s;
	}

	function playBeep() {
		try {
			if (!audioCtx) {
				audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			}
			var osc = audioCtx.createOscillator();
			var gain = audioCtx.createGain();
			osc.connect(gain);
			gain.connect(audioCtx.destination);
			osc.frequency.value = 880;
			osc.type = 'sine';
			gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
			osc.start(audioCtx.currentTime);
			osc.stop(audioCtx.currentTime + 0.5);

			// Second beep
			var osc2 = audioCtx.createOscillator();
			var gain2 = audioCtx.createGain();
			osc2.connect(gain2);
			gain2.connect(audioCtx.destination);
			osc2.frequency.value = 880;
			osc2.type = 'sine';
			gain2.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.6);
			gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);
			osc2.start(audioCtx.currentTime + 0.6);
			osc2.stop(audioCtx.currentTime + 1.0);
		} catch (e) {
			// Web Audio not available
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
