declare global {
	interface Window {
		__heroBgSwapInit?: boolean;
	}
}

function swapHeroBackgrounds() {
	document.querySelectorAll<HTMLElement>(".cover-hero-image[data-bg-full]").forEach((el) => {
		const full = el.dataset.bgFull;
		if (!full || el.dataset.bgApplied === full) return;

		const applyFull = () => {
			el.style.backgroundImage = `url("${full}")`;
			el.dataset.bgApplied = full;
			el.dataset.bgState = "full";
		};

		const img = new Image();
		img.onload = applyFull;
		img.onerror = applyFull;
		img.src = full;
	});
}

export function initHeroBackgroundSwap() {
	if (typeof window === "undefined") return;
	if (window.__heroBgSwapInit) return;
	window.__heroBgSwapInit = true;

	const runOnce = (() => {
		let ran = false;
		return () => {
			if (ran) return;
			ran = true;
			swapHeroBackgrounds();
		};
	})();

	const scheduleIdle = () => {
		if (typeof window.requestIdleCallback === "function") {
			window.requestIdleCallback(() => runOnce());
		}
	};

	const scheduleAfterLoad = () => {
		const fireAfterLoad = () => window.setTimeout(runOnce, 250);
		if (document.readyState === "complete") {
			fireAfterLoad();
		} else {
			window.addEventListener("load", fireAfterLoad, { once: true });
		}
	};

	scheduleIdle();
	scheduleAfterLoad();
}

if (typeof window !== "undefined") {
	initHeroBackgroundSwap();
}
