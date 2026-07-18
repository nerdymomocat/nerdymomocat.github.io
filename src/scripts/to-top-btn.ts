document.addEventListener("DOMContentLoaded", function () {
	const scrollBtn = document.getElementById("to-top-btn");
	const targetHeader = document.getElementById("main-header");

	function callback(entries: IntersectionObserverEntry[]) {
		entries.forEach((entry) => {
			if (scrollBtn) scrollBtn.dataset.show = (!entry.isIntersecting).toString();
		});
	}

	scrollBtn?.addEventListener("click", () => {
		document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
	});

	const observer = new IntersectionObserver(callback);
	if (targetHeader) observer.observe(targetHeader);
});
