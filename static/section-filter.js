// Client-side card filter for section listing pages. Debounces input and
// toggles [data-filter-card] elements by text match.
(() => {
	const input = document.getElementById("section-filter");
	if (!input) return;
	const cards = document.querySelectorAll("[data-filter-card]");
	let timer;
	input.addEventListener("input", () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const q = input.value.toLowerCase().trim();
			for (const card of cards) {
				const text = card.textContent.toLowerCase();
				card.style.display = q === "" || text.includes(q) ? "" : "none";
			}
		}, 200);
	});
})();
