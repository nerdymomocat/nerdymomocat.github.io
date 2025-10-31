import {
	computePosition,
	offset,
	shift,
	flip,
	autoUpdate,
} from "https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.7.4/+esm";

document.addEventListener("DOMContentLoaded", () => {
	// State variables for popovers

	const smBreakpointQuery = window.matchMedia("(max-width: 639px)");
	const lgBreakpointQuery = window.matchMedia("(min-width: 1024px)");

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
		if (popoverEl) {
			popoverEl.style.visibility = "hidden";
			popoverEl.classList.add("hidden");
			popoverEl.style.opacity = "0";
			popoverEl.style.top = "0px";
			popoverEl.style.left = "0px";

			const cleanup = cleanupAutoUpdate.get(popoverEl);
			if (cleanup) {
				cleanup();
				cleanupAutoUpdate.delete(popoverEl);
			}
			const openPopoverIndex = openPopovers.indexOf(popoverEl);
			if (openPopoverIndex !== -1) {
				openPopovers.splice(openPopoverIndex, 1);
			}
		}
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
		});

		openPopovers.push(popoverEl);
		cleanupAutoUpdate.set(popoverEl, autoUpdate(triggerEl, popoverEl, update));
	};

	const handleHover = (event) => {
		if (smBreakpointQuery.matches) return; // No hover on small screens

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

			if (href && !smBreakpointQuery.matches) {
				window.location.href = href;
				return;
			}

			if (smBreakpointQuery.matches) {
				event.preventDefault();
				showPopover(triggerEl);
				return;
			}
		}

		const popoverLink = event.target.closest("[data-popover-link]");
		if (popoverLink) {
			hideAllPopovers(-1);
		} else if (!triggerEl) {
			hideAllPopovers(-1);
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			hideAllPopovers(-1);
		}
	});
});
