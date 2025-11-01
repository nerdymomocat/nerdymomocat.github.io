window.addEventListener("load", async () => {
	// Dynamically import GLightbox to avoid blocking initial page load
	await import("https://cdn.jsdelivr.net/gh/mcstudios/glightbox/dist/js/glightbox.min.js");

	const lightbox = GLightbox({
		selector: ".mediaglightbox, .fileglightbox, .embedglightbox",
	});
});
