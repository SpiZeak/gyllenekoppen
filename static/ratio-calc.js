(() => {
	function init(container) {
		if (!container) return;
		if (container.classList.contains("ratio-calc-initialized")) return;
		container.classList.add("ratio-calc-initialized");

		container.innerHTML = `
			<div class="glass-card p-5 rounded-2xl border border-parchment-200/50 dark:border-espresso-600/30">
				<h4 class="font-serif font-bold text-lg text-espresso-800 dark:text-parchment-100 mb-3 flex items-center gap-2">
					<span>&#9878;&#65039;</span> Kvotkalkylator</h4>
				<div class="space-y-4">
					<div>
						<label class="block mb-1 text-xs font-medium text-parchment-500 dark:text-parchment-400 uppercase tracking-wider">Läge</label>
						<select id="rc-mode" class="w-full px-3 py-2 rounded-xl text-sm bg-parchment-50 dark:bg-espresso-800 border border-parchment-200 dark:border-espresso-600 text-parchment-700 dark:text-parchment-200 focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 outline-none transition-all">
							<option value="water">Beräkna vatten (från dos + kvot)</option>
							<option value="ratio">Beräkna kvot (från dos + vatten)</option>
						</select>
					</div>
					<div id="rc-mode-water">
						<div class="gap-3 grid grid-cols-2 mb-3">
							<div>
								<label class="block mb-1 text-xs font-medium text-parchment-500 dark:text-parchment-400">Kaffe (g)</label>
								<input type="number" id="rc-dose" step="0.1" min="1" value="18" class="w-full px-3 py-2 rounded-xl text-sm bg-parchment-50 dark:bg-espresso-800 border border-parchment-200 dark:border-espresso-600 text-parchment-700 dark:text-parchment-200 focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 outline-none transition-all" />
							</div>
							<div>
								<label class="block mb-1 text-xs font-medium text-parchment-500 dark:text-parchment-400">Önskad kvot (1:X)</label>
								<input type="number" id="rc-target" step="0.5" min="1" value="15" class="w-full px-3 py-2 rounded-xl text-sm bg-parchment-50 dark:bg-espresso-800 border border-parchment-200 dark:border-espresso-600 text-parchment-700 dark:text-parchment-200 focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 outline-none transition-all" />
							</div>
						</div>
						<div class="bg-parchment-100 dark:bg-espresso-700 rounded-xl px-4 py-3 text-center">
							<span class="text-parchment-400 dark:text-parchment-500 text-xs uppercase tracking-wider block mb-1">Vatten</span>
							<span id="rc-water-result" class="font-serif font-bold text-2xl text-gold-600 dark:text-gold-400">270 g</span>
						</div>
					</div>
					<div id="rc-mode-ratio" class="hidden">
						<div class="gap-3 grid grid-cols-2 mb-3">
							<div>
								<label class="block mb-1 text-xs font-medium text-parchment-500 dark:text-parchment-400">Kaffe (g)</label>
								<input type="number" id="rc-dose2" step="0.1" min="1" value="18" class="w-full px-3 py-2 rounded-xl text-sm bg-parchment-50 dark:bg-espresso-800 border border-parchment-200 dark:border-espresso-600 text-parchment-700 dark:text-parchment-200 focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 outline-none transition-all" />
							</div>
							<div>
								<label class="block mb-1 text-xs font-medium text-parchment-500 dark:text-parchment-400">Vatten (g)</label>
								<input type="number" id="rc-water" step="1" min="1" value="270" class="w-full px-3 py-2 rounded-xl text-sm bg-parchment-50 dark:bg-espresso-800 border border-parchment-200 dark:border-espresso-600 text-parchment-700 dark:text-parchment-200 focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 outline-none transition-all" />
							</div>
						</div>
						<div class="bg-parchment-100 dark:bg-espresso-700 rounded-xl px-4 py-3 text-center">
							<span class="text-parchment-400 dark:text-parchment-500 text-xs uppercase tracking-wider block mb-1">Faktisk kvot</span>
							<span id="rc-ratio-result" class="font-serif font-bold text-2xl text-gold-600 dark:text-gold-400">1:15.0</span>
						</div>
					</div>
				</div>
			</div>`;

		const mode = container.querySelector("#rc-mode");
		const modeWater = container.querySelector("#rc-mode-water");
		const modeRatio = container.querySelector("#rc-mode-ratio");

		function calcWater() {
			const dose = Number.parseFloat(container.querySelector("#rc-dose").value) || 0;
			const target = Number.parseFloat(container.querySelector("#rc-target").value) || 0;
			const result = container.querySelector("#rc-water-result");
			result.textContent = dose > 0 && target > 0 ? `${(dose * target).toFixed(0)} g` : "—";
		}

		function calcRatio() {
			const dose = Number.parseFloat(container.querySelector("#rc-dose2").value) || 0;
			const water = Number.parseFloat(container.querySelector("#rc-water").value) || 0;
			const result = container.querySelector("#rc-ratio-result");
			result.textContent = dose > 0 && water > 0 ? `1:${(water / dose).toFixed(1)}` : "—";
		}

		mode.addEventListener("change", function () {
			const val = this.value;
			modeWater.classList.toggle("hidden", val !== "water");
			modeRatio.classList.toggle("hidden", val !== "ratio");
		});

		container.querySelector("#rc-dose").addEventListener("input", calcWater);
		container.querySelector("#rc-target").addEventListener("input", calcWater);
		container.querySelector("#rc-dose2").addEventListener("input", calcRatio);
		container.querySelector("#rc-water").addEventListener("input", calcRatio);

		calcWater();
		calcRatio();
	}

	const containers = document.querySelectorAll(".ratio-calc-container");
	for (const c of containers) {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => init(c));
		} else {
			init(c);
		}
	}
})();
