window.addEventListener("load", function () {
	// Load GLightbox script
	const script = document.createElement("script");
	script.src = "https://cdn.jsdelivr.net/gh/mcstudios/glightbox/dist/js/glightbox.min.js";
	script.onload = initLightbox;
	document.head.appendChild(script);
});

function initLightbox() {
	const lightbox = GLightbox({
		selector: ".mediaglightbox, .fileglightbox, .embedglightbox",
	});

	// Store globally so margin-notes.ts can reload after creating dynamic content
	window.lightboxInstance = lightbox;
}
