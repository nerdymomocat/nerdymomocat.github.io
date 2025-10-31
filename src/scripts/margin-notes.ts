/**
 * Initializes Tufte-style margin notes for footnotes
 *
 * LAYOUT STRATEGY:
 * - Main already expands to 125% on large screens via lg:w-[125%]
 * - This creates ~172px of space to the right of .post-body (708px)
 * - Footnotes positioned absolutely relative to .post-body, overflowing into this space
 * - No need to modify article/body widths - space already exists!
 *
 * BEHAVIOR:
 * - Desktop (≥1024px): Always visible margin notes (Tufte style)
 * - Mobile (<1024px): Falls back to Base.astro popover system
 * - Hover marker or note: Highlights both
 * - Overlapping notes: Automatically stacked with gaps
 */

/**
 * Positions margin notes if on large screen
 */
function initializeMarginNotes() {
	if (window.matchMedia("(min-width: 1024px)").matches) {
		// Clean up any existing margin notes before repositioning
		document.querySelectorAll(".footnote-margin-note").forEach((n) => n.remove());
		positionMarginNotes();
	}
}

/**
 * Initialize margin notes progressively:
 * 1. First when DOM is ready (fast but potentially wrong positions)
 * 2. Then after images load (correct positions)
 */
async function setupMarginNotes() {
	// Quick first render when DOM is ready
	if (document.readyState === "loading") {
		await new Promise((resolve) => {
			document.addEventListener("DOMContentLoaded", resolve, { once: true });
		});
	}
	initializeMarginNotes();

	// Reposition after all images load for accurate positions
	if (document.readyState === "loading" || document.readyState === "interactive") {
		await new Promise((resolve) => {
			window.addEventListener("load", resolve, { once: true });
		});
	}
	initializeMarginNotes();
}

// Start progressive initialization
setupMarginNotes();

// Handle window resize
let resizeTimeout;
window.addEventListener("resize", () => {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(async () => {
		const isLargeScreen = window.matchMedia("(min-width: 1024px)").matches;

		if (isLargeScreen) {
			// Wait for fonts to be ready before repositioning
			await document.fonts.ready;

			// Switched to large screen - remove margin notes and recreate them
			document.querySelectorAll(".footnote-margin-note").forEach((n) => n.remove());
			positionMarginNotes();

			// Hide any open popovers for footnote markers and mark them as non-interactive
			document.querySelectorAll("[data-margin-note]").forEach((marker) => {
				const popoverId = marker.getAttribute("data-popover-target");
				if (popoverId) {
					const popover = document.getElementById(popoverId);
					if (popover) {
						popover.style.display = "none";
						popover.style.visibility = "hidden";
						popover.classList.add("hidden");
					}
				}
			});
		} else {
			// Switched to small screen - remove margin notes and reinitialize popover listeners for footnotes only
			document.querySelectorAll(".footnote-margin-note").forEach((n) => n.remove());

			// Re-enable popovers for footnote markers by fully resetting their state
			document.querySelectorAll("[data-margin-note]").forEach((marker) => {
				const popoverId = marker.getAttribute("data-popover-target");
				if (popoverId) {
					const popover = document.getElementById(popoverId);
					if (popover) {
						// Reset all styles that were set when hiding popovers on large screens
						popover.style.display = "";
						popover.style.visibility = "";
						popover.classList.remove("hidden");
					}
				}
			});
		}
	}, 250);
});

function positionMarginNotes() {
	const markers = document.querySelectorAll("[data-margin-note]");

	markers.forEach((markerEl) => {
		const footnoteId = markerEl.getAttribute("data-margin-note");
		if (!footnoteId) return;

		const template = document.getElementById(`template-margin-${footnoteId}`);
		if (!template) return;

		const postBody = markerEl.closest(".post-body");
		if (!postBody) return;

		// Skip if inside a post-preview-full-container (collection full preview pages)
		if (postBody.classList.contains("post-preview-full-container")) return;

		if (getComputedStyle(postBody).position === "static") {
			postBody.style.position = "relative";
		}

		const marginNote = document.createElement("aside");
		marginNote.className =
			"footnote-margin-note absolute left-full ml-8 w-32 xl:ml-12 xl:w-48 text-sm leading-relaxed text-textColor/60 transition-opacity duration-200 pointer-events-auto";
		marginNote.dataset.noteId = footnoteId;

		const content = template.content.cloneNode(true);
		marginNote.appendChild(content);

		const postBodyRect = postBody.getBoundingClientRect();
		const markerRect = markerEl.getBoundingClientRect();
		const topOffset = markerRect.top - postBodyRect.top + postBody.scrollTop;

		marginNote.style.top = `${topOffset}px`;

		postBody.appendChild(marginNote);

		setupHoverHighlight(markerEl, marginNote);
	});

	// After all notes are created, stack them globally to prevent overlaps
	stackAllMarginNotesGlobally();
}

function setupHoverHighlight(marker, note) {
	marker.addEventListener("mouseenter", () => {
		marker.classList.add("highlighted");
		note.classList.add("highlighted");
	});

	marker.addEventListener("mouseleave", () => {
		marker.classList.remove("highlighted");
		note.classList.remove("highlighted");
	});

	note.addEventListener("mouseenter", () => {
		marker.classList.add("highlighted");
		note.classList.add("highlighted");
	});

	note.addEventListener("mouseleave", () => {
		marker.classList.remove("highlighted");
		note.classList.remove("highlighted");
	});
}

/**
 * Stacks all margin notes globally to prevent overlaps across different blocks
 * This ensures that even if Block 1 has a very long footnote, it won't overlap
 * with footnotes from Block 2
 */
function stackAllMarginNotesGlobally() {
	// Find all margin notes in the document
	const allNotes = Array.from(document.querySelectorAll(".footnote-margin-note"));

	if (allNotes.length === 0) return;

	// Sort by initial top position
	allNotes.sort((a, b) => {
		const aTop = parseInt(a.style.top) || 0;
		const bTop = parseInt(b.style.top) || 0;
		return aTop - bTop;
	});

	// Stack with minimum gap of 8px
	for (let i = 1; i < allNotes.length; i++) {
		const prevNote = allNotes[i - 1];
		const currNote = allNotes[i];

		const prevTop = parseInt(prevNote.style.top) || 0;
		const prevBottom = prevTop + prevNote.offsetHeight;
		const currTop = parseInt(currNote.style.top) || 0;

		// If current note would overlap with previous note, push it down
		if (currTop < prevBottom + 8) {
			currNote.style.top = `${prevBottom + 8}px`;
		}
	}
}
