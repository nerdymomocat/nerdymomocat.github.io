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
 * @param limit - Optional limit on number of notes to position (for initial fast render)
 */
function initializeMarginNotes(limit?: number) {
	if (window.matchMedia("(min-width: 1024px)").matches) {
		// Clean up any existing margin notes before repositioning
		document.querySelectorAll(".footnote-margin-note").forEach((n) => n.remove());
		positionMarginNotes(limit);
	}
}

/**
 * Initialize margin notes progressively:
 * 1. First when DOM is ready - render only first 4 notes (fast, viewport-likely)
 * 2. Then after images load - render all notes (correct positions)
 */
async function setupMarginNotes() {
	// Quick first render when DOM is ready - only position first 10 notes for speed
	if (document.readyState === "loading") {
		await new Promise((resolve) => {
			document.addEventListener("DOMContentLoaded", resolve, { once: true });
		});
	}
	initializeMarginNotes(10); // Limit to 10 notes on fast initial render
	// Reload lightbox to register any images in the first batch of margin notes
	window.lightboxInstance?.reload();

	// Reposition after all images load for accurate positions - render ALL notes
	if (document.readyState === "loading" || document.readyState === "interactive") {
		await new Promise((resolve) => {
			window.addEventListener("load", resolve, { once: true });
		});
	}
	//Wait for fonts and layout to settle completely
	await document.fonts.ready;
	await new Promise((resolve) => requestAnimationFrame(resolve));
	await new Promise((resolve) => setTimeout(resolve, 100)); // Extra delay to ensure layout stability
	initializeMarginNotes(); // No limit - render all notes with correct positions
	// Reload lightbox to register all images in margin notes
	window.lightboxInstance?.reload();
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
			// Reload lightbox to register images in newly created margin notes
			window.lightboxInstance?.reload();

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

function positionMarginNotes(limit?: number) {
	const markers = document.querySelectorAll("[data-margin-note]");
	let positioned = 0;
	const processedCitationKeys = new Set<string>();

	markers.forEach((markerEl) => {
		// Stop after reaching limit (if specified)
		if (limit !== undefined && positioned >= limit) return;
		const footnoteId = markerEl.getAttribute("data-margin-note");
		if (!footnoteId) return;

		const template = document.getElementById(`template-margin-${footnoteId}`);
		if (!template) return;

		//Deduplicate citations based on citation key to avoid multiple margin notes for same citation in same block in a page.
		const citationKey = markerEl.getAttribute("data-citation-key");
		if (citationKey) {
			// Skip if this citation key has already been processed
			if (processedCitationKeys.has(citationKey)) {
				markerEl.removeAttribute("data-margin-note");
				template.remove(); // Remove unused template
				return;
			}
			processedCitationKeys.add(citationKey);
		}

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

		// Check if there are nested citation markers in the cloned content
		// Query marginNote (not content) since content is now empty after appendChild
		const nestedCitationMarkers = marginNote.querySelectorAll('[data-margin-note^="citation-"]');

		nestedCitationMarkers.forEach((citationMarker) => {
			const citationId = citationMarker.getAttribute("data-margin-note");
			if (!citationId) return;

			// Find the citation's margin template (search in marginNote)
			const citationTemplate = marginNote.querySelector(`#template-margin-${citationId}`);
			if (!citationTemplate) return;

			const nestedCitationKey = citationMarker.getAttribute("data-citation-key");
			if (nestedCitationKey) {
				// Skip if this citation key has already been processed
				if (processedCitationKeys.has(nestedCitationKey)) {
					citationMarker.removeAttribute("data-margin-note");
					citationTemplate.remove(); // Remove unused template
					return;
				}
				processedCitationKeys.add(nestedCitationKey);
			}

			// Remove interactive attributes from the nested citation marker
			// since it's rendered inline in the margin note (no cursor, aria-label, or underline needed on large screens)
			citationMarker.removeAttribute("aria-label");
			citationMarker.classList.remove("cursor-pointer");

			// Remove underline from parent span if it exists
			const parentSpan = citationMarker.parentElement;
			if (parentSpan && parentSpan.tagName === "SPAN") {
				parentSpan.classList.remove(
					"decoration-quote/40",
					"underline",
					"decoration-dotted",
					"underline-offset-2",
				);
			}

			// Clone the citation template content and append to margin note
			const citationContent = citationTemplate.content.cloneNode(true);
			marginNote.appendChild(citationContent);

			citationTemplate.remove(); // Remove the citation template from the content
		});

		const postBodyRect = postBody.getBoundingClientRect();
		const markerRect = markerEl.getBoundingClientRect();
		const topOffset = markerRect.top - postBodyRect.top + postBody.scrollTop;

		marginNote.style.top = `${topOffset}px`;

		postBody.appendChild(marginNote);

		setupHoverHighlight(markerEl, marginNote);

		// Increment counter after successfully positioning a note
		positioned++;
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
