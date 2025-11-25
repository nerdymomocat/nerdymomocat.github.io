document.addEventListener("DOMContentLoaded", () => {
	// Handle Headings Copy Link
	const headings = document.querySelectorAll(".hasId");
	headings.forEach((heading) => {
		heading.addEventListener("click", (e) => {
			const el = e.currentTarget as HTMLElement;
			const id = el.id;
			if (!id) return;

			const fullUrl = `${window.location.origin}${window.location.pathname}#${id}`;
			navigator.clipboard.writeText(fullUrl);
			window.history.pushState(null, "", fullUrl);
			el.scrollIntoView({ behavior: "smooth" });
		});
	});

	// Handle Code Copy
	const copyButtons = document.querySelectorAll<HTMLButtonElement>(".code button[data-code]");
	copyButtons.forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const button = e.currentTarget as HTMLButtonElement;
			const code = button.getAttribute("data-code");
			if (!code) return;

			navigator.clipboard.writeText(code);

			const svgBefore = button.querySelector(".copy-icon-before");
			const svgAfter = button.querySelector(".copy-icon-done");

			if (svgBefore && svgAfter) {
				svgBefore.classList.toggle("hidden");
				svgAfter.classList.toggle("hidden");
				setTimeout(() => {
					svgBefore.classList.toggle("hidden");
					svgAfter.classList.toggle("hidden");
				}, 1000);
			}
		});
	});

	// Handle Bibliography back-to-citation buttons
	const citationButtons = document.querySelectorAll<HTMLButtonElement>("[data-back-to-citation]");
	citationButtons.forEach((button) => {
		button.addEventListener("click", (e) => {
			e.preventDefault();
			const listItem = button.closest("li");
			if (!(listItem instanceof HTMLElement)) return;

			const blockId = listItem.dataset.backToBlock;
			if (!blockId) return;

			window.location.hash = `#${blockId}`;
			document.getElementById(blockId)?.scrollIntoView({ behavior: "smooth" });

			delete listItem.dataset.showBackButton;
			delete listItem.dataset.backToBlock;
		});
	});

	// Handle "Jump to bibliography" links
	const jumpLinks = document.querySelectorAll<HTMLAnchorElement>("[data-jump-to-bibliography]");
	jumpLinks.forEach((link) => {
		link.addEventListener("click", (event) => {
			event.preventDefault();

			const targetId = link.getAttribute("data-target-id");
			const originBlock = link.getAttribute("data-origin-block");
			if (!targetId || !originBlock) return;

			document.querySelectorAll<HTMLElement>("li[data-show-back-button]").forEach((li) => {
				li.dataset.showBackButton = "";
				li.dataset.backToBlock = "";
				delete li.dataset.showBackButton;
				delete li.dataset.backToBlock;
			});

			const target = document.getElementById(targetId);
			if (target) {
				target.dataset.showBackButton = "true";
				target.dataset.backToBlock = originBlock;
				window.location.hash = `#${targetId}`;
				target.scrollIntoView({ behavior: "smooth" });
			}
		});
	});
});
