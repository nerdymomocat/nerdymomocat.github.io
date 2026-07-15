window.addEventListener("load", function () {
	// Load floating-ui core first, then dom
	const coreScript = document.createElement("script");
	coreScript.src = "https://cdn.jsdelivr.net/npm/@floating-ui/core@1.7.3";
	coreScript.onload = function () {
		// Load dom after core is loaded
		const domScript = document.createElement("script");
		domScript.src = "https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.7.4";
		domScript.onload = initPopovers;
		document.head.appendChild(domScript);
	};
	document.head.appendChild(coreScript);
});

function initPopovers() {
	const { computePosition, offset, shift, flip, autoUpdate } = window.FloatingUIDOM;

	// State variables for popovers
	const smBreakpointQuery = window.matchMedia("(max-width: 639px)");
	const lgBreakpointQuery = window.matchMedia("(min-width: 1024px)");
	// Interaction mode is decided by input capability, not viewport width: touch
	// devices (phones AND tablets) must not hover-preview or navigate on the
	// first tap — otherwise a tap flashes the popover and immediately follows the
	// link. Only genuine mouse/trackpad pointers get hover + click-to-navigate.
	const canHoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

	// Create the selector based on the device type
	function getPopoverSelector() {
		if (lgBreakpointQuery.matches) {
			// Enable popovers for footnotes in collection stream pages (no margin notes there)
			// Disable popovers for footnotes elsewhere (margin notes handle them)
			return "[data-popover-target]:not([data-margin-note]), .post-preview-full-container [data-margin-note][data-popover-target]";
		}

		if (smBreakpointQuery.matches) {
			// Disable popovers for link mentions on small screens
			return '[data-popover-target]:not([data-popover-type-lm="true"])';
		}

		return "[data-popover-target]";
	}

	let openPopovers = [];
	let cleanupAutoUpdate = new Map();
	let hoverTimeouts = new Map();
	// Popovers pending their final display:none after an exit fade. Tracked so a
	// re-show (or re-hide) during the fade can cancel the deferred teardown.
	let pendingHide = new Map();

	// A popover that currently hosts another OPEN popover must not clip its
	// overflow — otherwise the nested (absolutely-positioned) child is cropped to
	// the parent's box and forces a scrollbar. Mark every ancestor of each open
	// popover so the height cap is lifted only while a child is open, then
	// restored once it closes.
	const refreshPopoverClipping = () => {
		document
			.querySelectorAll(".notion-popover.popover-has-nested")
			.forEach((el) => el.classList.remove("popover-has-nested"));
		openPopovers.forEach((child) => {
			let ancestor = child.parentElement ? child.parentElement.closest(".notion-popover") : null;
			while (ancestor) {
				ancestor.classList.add("popover-has-nested");
				ancestor = ancestor.parentElement
					? ancestor.parentElement.closest(".notion-popover")
					: null;
			}
		});
	};

	const getPopoverLevel = (el) => {
		let level = 0;
		while (el && el.closest("[data-popover-target]")) {
			level++;
			el = el.parentElement;
		}
		return level - 1;
	};

	const hideAllPopovers = (level = 0) => {
		openPopovers.forEach((popoverEl) => {
			if (getPopoverLevel(popoverEl) >= level) {
				hidePopover(popoverEl);
			}
		});
	};

	const hidePopover = (popoverEl) => {
		if (!popoverEl) return;

		// Cancel any teardown already scheduled for this popover so we don't
		// finalize twice (and so a fresh hide restarts the fade cleanly).
		const alreadyPending = pendingHide.get(popoverEl);
		if (alreadyPending) {
			clearTimeout(alreadyPending);
			pendingHide.delete(popoverEl);
		}

		// Treat it as closed immediately for open/close bookkeeping and stop the
		// position autoupdate — the popover stays put while it fades out.
		const openPopoverIndex = openPopovers.indexOf(popoverEl);
		if (openPopoverIndex !== -1) {
			openPopovers.splice(openPopoverIndex, 1);
		}
		const cleanup = cleanupAutoUpdate.get(popoverEl);
		if (cleanup) {
			cleanup();
			cleanupAutoUpdate.delete(popoverEl);
		}

		// Play the exit: reverse of the enter (fade out + settle back up/in). The
		// display:none teardown is deferred so this transition can actually run;
		// under reduced motion the global policy keeps opacity-only and clamps it.
		popoverEl.style.opacity = "0";
		popoverEl.style.transform = "translateY(-4px) scale(0.98)";

		const finalize = () => {
			pendingHide.delete(popoverEl);
			popoverEl.style.visibility = "hidden";
			popoverEl.classList.add("hidden");
			popoverEl.style.transform = "";
			// Re-clip any ancestor that no longer hosts an open child popover.
			refreshPopoverClipping();
		};
		// Slightly longer than the 200ms enter/exit transition (150ms under
		// reduced motion) so the fade completes before we remove it from flow.
		const timeoutId = setTimeout(finalize, 240);
		pendingHide.set(popoverEl, timeoutId);
	};

	const addLeaveListeners = (triggerEl, popoverEl) => {
		triggerEl.addEventListener("mouseleave", () => {
			const timeoutId = setTimeout(() => {
				hidePopover(popoverEl);
			}, 100);
			hoverTimeouts.set(popoverEl, timeoutId);
		});

		popoverEl.addEventListener("mouseenter", () => {
			const timeoutId = hoverTimeouts.get(popoverEl);
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		});

		popoverEl.addEventListener("mouseleave", () => {
			hidePopover(popoverEl);
		});

		triggerEl.addEventListener("blur", () => {
			hidePopover(popoverEl);
		});
	};

	const createPopover = (triggerEl) => {
		const popoverID = triggerEl.dataset.popoverTarget;
		const template = document.getElementById(`template-${popoverID}`);
		if (!template) return null;
		const popoverEl = template.content.firstElementChild.cloneNode(true);

		// Remove data-margin-note from footnotes inside popovers so they use popover behavior instead
		popoverEl.querySelectorAll("[data-margin-note]").forEach((footnote) => {
			footnote.removeAttribute("data-margin-note");
		});

		triggerEl.parentNode.insertBefore(popoverEl, triggerEl.nextSibling);
		addLeaveListeners(triggerEl, popoverEl);
		return popoverEl;
	};

	const showPopover = (triggerEl) => {
		const level = getPopoverLevel(triggerEl);
		hideAllPopovers(level);

		let popoverEl = document.getElementById(triggerEl.dataset.popoverTarget);

		if (!popoverEl) {
			popoverEl = createPopover(triggerEl);
		}
		if (!popoverEl) return;

		// If this popover is mid-exit-fade, cancel the deferred teardown so we
		// reverse straight back into view instead of snapping to display:none.
		const pending = pendingHide.get(popoverEl);
		if (pending) {
			clearTimeout(pending);
			pendingHide.delete(popoverEl);
		}

		const update = () => {
			computePosition(triggerEl, popoverEl, {
				middleware: [offset(6), shift({ padding: 3 }), flip({ padding: 3 })],
			}).then(({ x, y }) => {
				Object.assign(popoverEl.style, {
					left: `${x}px`,
					top: `${y}px`,
					position: "absolute",
				});
			});
		};

		update();
		popoverEl.classList.remove("hidden");
		requestAnimationFrame(() => {
			popoverEl.style.visibility = "visible";
			popoverEl.style.opacity = "1";
			popoverEl.style.transform = "translateY(0) scale(1)";
		});

		openPopovers.push(popoverEl);
		cleanupAutoUpdate.set(popoverEl, autoUpdate(triggerEl, popoverEl, update));
		// Lift the height cap on any ancestor now hosting this nested popover.
		refreshPopoverClipping();
	};

	const handleHover = (event) => {
		if (!canHoverQuery.matches) return; // Hover previews only for mouse/trackpad pointers

		const selector = getPopoverSelector();
		const triggerEl = event.target.closest(selector);
		if (triggerEl) {
			showPopover(triggerEl);
		}
	};

	document.addEventListener("mouseover", handleHover);
	document.addEventListener("focusin", handleHover);

	document.addEventListener("click", (event) => {
		const selector = getPopoverSelector();
		const triggerEl = event.target.closest(selector);

		if (triggerEl) {
			const href = triggerEl.dataset.href;

			if (canHoverQuery.matches) {
				// Mouse/trackpad: the preview already showed on hover, so a click is
				// a deliberate request to follow the link to its source.
				if (href) {
					window.location.href = href;
					return;
				}
			} else {
				// Touch / no-hover: the first tap opens the preview instead of
				// navigating. Navigation happens by tapping the preview card or its
				// "Read more" link. This prevents the tap-flash-then-leave bug on
				// tablets and touch laptops (any non-small touch screen).
				event.preventDefault();
				showPopover(triggerEl);
				return;
			}
		}

		const popoverLink = event.target.closest("[data-popover-link]");
		if (popoverLink) {
			hideAllPopovers(-1);
			return;
		}

		const popoverCardLink = event.target.closest("[data-popover-card-link]");
		if (popoverCardLink && !event.target.closest("a, button, input, select, textarea")) {
			const href = popoverCardLink.dataset.href;
			if (href) {
				window.location.href = href;
				return;
			}
		} else if (!triggerEl) {
			hideAllPopovers(-1);
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			hideAllPopovers(-1);
			return;
		}

		if (event.key === "Enter" || event.key === " ") {
			const popoverCardLink = event.target.closest("[data-popover-card-link]");
			if (popoverCardLink && event.target === popoverCardLink) {
				event.preventDefault();
				const href = popoverCardLink.dataset.href;
				if (href) {
					window.location.href = href;
				}
			}
		}
	});
}
