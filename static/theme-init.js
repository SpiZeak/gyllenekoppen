(() => {
	// Must run before first paint to avoid a light/dark flash. Included
	// synchronously (no defer) from base.html and 404.html.
	const saved = localStorage.getItem("theme");
	if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
		document.documentElement.classList.add("dark");
	}
})();
