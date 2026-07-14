import "@pagefind/component-ui";
import { getInstanceManager } from "@pagefind/component-ui";
import type {
	FilterSelection,
	PagefindRawResult,
	PagefindResultData,
	PagefindSearchResult,
	PagefindSubResult,
} from "@pagefind/component-ui";
import { getSvgIcon } from "@/utils/style-helpers";

const SEARCH_INSTANCE = "webtrotion-search";

interface GotoEntry {
	t: string;
	u: string;
	k?: string;
	e?: string;
	ie?: string;
	im?: string;
}

export interface SearchRuntime {
	open(): void;
	openFromUrl(): void;
}

class WebtrotionSearchNavigation extends HTMLElement {
	private links: Array<{
		href: string;
		label: string;
		iconEmoji: string;
		iconImage: string;
	}> = [];
	private pinnedPost: {
		title: string;
		url: string;
		collection: string;
		excerpt: string;
		iconEmoji: string;
		iconImage: string;
	} | null = null;
	private eventRoot: Element | null = null;
	private gotoIndexUrl = "";
	private gotoIndex: GotoEntry[] | null = null;
	private gotoLoading = false;
	private onInput = (event: Event) => {
		const input = event.target;
		if (input instanceof HTMLInputElement && input.matches(".pf-input")) {
			this.render(input.value);
		}
	};

	connectedCallback() {
		this.links = Array.from(
			document.querySelectorAll<HTMLAnchorElement>("#navigation-menu a[href]"),
		)
			.map((link) => ({
				href: link.href,
				label: link.textContent?.trim() || "",
				iconEmoji: link.dataset.pageIconEmoji || "",
				iconImage: link.dataset.pageIconImage || "",
			}))
			.filter((link) => link.label);
		const title = this.dataset.pinnedTitle || "";
		const url = this.dataset.pinnedUrl || "";
		this.pinnedPost =
			title && url
				? {
						title,
						url,
						collection: this.dataset.pinnedCollection || "",
						excerpt: this.dataset.pinnedExcerpt || "",
						iconEmoji: this.dataset.pinnedIconEmoji || "",
						iconImage: this.dataset.pinnedIconImage || "",
					}
				: null;
		this.eventRoot = this.closest("site-search") || this.parentElement;
		this.gotoIndexUrl = this.dataset.gotoIndexUrl || "";
		this.eventRoot?.addEventListener("input", this.onInput);
		const instance = getInstanceManager().getInstance(SEARCH_INSTANCE);
		instance.on(
			"results",
			() => {
				const input = this.eventRoot?.querySelector<HTMLInputElement>(".pf-input");
				this.render(input?.value || "");
			},
			this,
		);
		this.render("");
	}

	disconnectedCallback() {
		this.eventRoot?.removeEventListener("input", this.onInput);
	}

	private render(query: string) {
		const raw = query ?? "";
		const shell = this.closest<HTMLElement>(".webtrotion-search-shell");
		// A leading "/" switches the popup into path/title "go to page" mode, which
		// is resolved entirely client-side against a static index — Pagefind's
		// content search is never involved (and its surface is hidden via CSS).
		if (raw.trimStart().startsWith("/")) {
			shell?.setAttribute("data-goto-mode", "");
			this.renderGoto(raw.trimStart().slice(1));
			return;
		}
		shell?.removeAttribute("data-goto-mode");

		const normalizedQuery = query.trim().toLocaleLowerCase();
		const instance = getInstanceManager().getInstance(SEARCH_INSTANCE);
		const hasFilters = Object.values(instance.searchFilters || {}).some((values) => values.length);
		const matches = this.links.filter((link) =>
			normalizedQuery ? link.label.toLocaleLowerCase().includes(normalizedQuery) : true,
		);
		this.hidden = hasFilters || !matches.length;
		this.replaceChildren();
		if (hasFilters || !matches.length) return;

		const label = document.createElement("p");
		label.className = "webtrotion-search-navigation-label";
		label.textContent = "Navigate";
		const list = document.createElement("ul");
		list.className = "webtrotion-search-navigation-list";
		for (const item of matches) {
			const listItem = document.createElement("li");
			const link = document.createElement("a");
			link.className = "webtrotion-search-navigation-link";
			link.href = item.href;
			const icon = document.createElement("span");
			icon.className = "webtrotion-search-navigation-icon";
			icon.setAttribute("aria-hidden", "true");
			if (item.iconEmoji) {
				icon.textContent = item.iconEmoji;
			} else if (item.iconImage) {
				const img = document.createElement("img");
				img.src = item.iconImage;
				img.alt = "";
				img.loading = "lazy";
				icon.append(img);
			} else {
				icon.classList.add("is-default");
				icon.innerHTML = getSvgIcon("bookmark-outline");
			}
			const label = document.createElement("span");
			label.className = "webtrotion-search-navigation-text";
			label.textContent = item.label;
			link.append(icon, label);
			listItem.append(link);
			list.append(listItem);
		}
		this.append(label, list);

		if (!normalizedQuery && this.pinnedPost) {
			const pinned = document.createElement("section");
			pinned.className = "webtrotion-search-pinned";
			const pinnedLabel = document.createElement("p");
			pinnedLabel.className = "webtrotion-search-pinned-label";
			pinnedLabel.textContent = "Pinned";
			const pinnedLink = document.createElement("a");
			pinnedLink.className = "webtrotion-search-pinned-link";
			pinnedLink.href = this.pinnedPost.url;
			const marker = document.createElement("span");
			marker.className = "webtrotion-search-pinned-marker";
			marker.setAttribute("aria-hidden", "true");
			marker.innerHTML =
				'<svg viewBox="0 0 24 24" focusable="false"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" /></svg>';
			const icon = document.createElement("span");
			icon.className = "webtrotion-search-pinned-icon";
			icon.setAttribute("aria-hidden", "true");
			if (this.pinnedPost.iconEmoji) {
				icon.textContent = this.pinnedPost.iconEmoji;
			} else if (this.pinnedPost.iconImage) {
				const iconImg = document.createElement("img");
				iconImg.src = this.pinnedPost.iconImage;
				iconImg.alt = "";
				iconImg.loading = "lazy";
				icon.append(iconImg);
			} else {
				icon.innerHTML =
					'<svg viewBox="0 0 24 24" focusable="false"><path d="M6 3.75h8.4L19 8.35v11.9H6z" /><path d="M14.25 4v4.6h4.5" /><path d="M8.75 12h6.5M8.75 15h5M8.75 18h3.75" /></svg>';
			}
			const pinnedContent = document.createElement("span");
			pinnedContent.className = "webtrotion-search-pinned-content";
			const title = document.createElement("span");
			title.className = "webtrotion-search-pinned-title";
			title.textContent = this.pinnedPost.title;
			const detail = document.createElement("span");
			detail.className = "webtrotion-search-pinned-detail";
			detail.textContent = [this.pinnedPost.collection, this.pinnedPost.excerpt]
				.filter(Boolean)
				.join(" - ");
			pinnedContent.append(title);
			if (detail.textContent) pinnedContent.append(detail);
			pinnedLink.append(marker, icon, pinnedContent);
			pinned.append(pinnedLabel, pinnedLink);
			this.append(pinned);
		}
	}

	private async loadGotoIndex() {
		if (this.gotoLoading || this.gotoIndex || !this.gotoIndexUrl) return;
		this.gotoLoading = true;
		try {
			const res = await fetch(this.gotoIndexUrl, { headers: { Accept: "application/json" } });
			this.gotoIndex = res.ok ? await res.json() : [];
		} catch {
			this.gotoIndex = [];
		}
		this.gotoLoading = false;
		// Re-render with whatever the query is now — the user may have kept typing.
		const input = this.eventRoot?.querySelector<HTMLInputElement>(".pf-input");
		const value = input?.value ?? "";
		if (value.trimStart().startsWith("/")) this.render(value);
	}

	private buildGotoStatus(message: string) {
		const status = document.createElement("p");
		status.className = "webtrotion-search-navigation-empty";
		status.setAttribute("aria-live", "polite");
		status.textContent = message;
		return status;
	}

	private renderGoto(afterSlash: string) {
		this.hidden = false;
		this.replaceChildren();

		if (!this.gotoIndex) {
			this.append(this.buildGotoStatus("Loading pages…"));
			void this.loadGotoIndex();
			return;
		}

		const label = document.createElement("p");
		label.className = "webtrotion-search-navigation-label";
		label.textContent = "Go to page";
		this.append(label);

		const term = afterSlash.trim().toLocaleLowerCase();
		const scored: Array<{ item: GotoEntry; score: number }> = [];
		for (const item of this.gotoIndex) {
			const title = (item.t || "").toLocaleLowerCase();
			const url = (item.u || "").toLocaleLowerCase();
			if (!term) {
				scored.push({ item, score: 0 });
				continue;
			}
			let score = -1;
			if (title.startsWith(term)) score = 0;
			else if (title.includes(term)) score = 1;
			else if (url.includes(term)) score = 2;
			if (score >= 0) scored.push({ item, score });
		}
		scored.sort((a, b) => a.score - b.score || a.item.t.localeCompare(b.item.t));
		const capped = scored.slice(0, 50);

		if (!capped.length) {
			this.append(this.buildGotoStatus("No pages match that path or title."));
			return;
		}

		const list = document.createElement("ul");
		list.className = "webtrotion-search-navigation-list";
		for (const { item } of capped) {
			const listItem = document.createElement("li");
			const link = document.createElement("a");
			link.className = "webtrotion-search-navigation-link is-goto";
			link.href = item.u;

			// Icon rules: pages get a generic bookmark; posts show their own Notion
			// icon when they have one; tags/collections (and iconless posts) show none.
			const icon = this.buildGotoIcon(item);
			if (icon) {
				link.append(icon);
			} else {
				link.classList.add("is-iconless");
			}

			const body = document.createElement("span");
			body.className = "webtrotion-search-navigation-body";
			const title = document.createElement("span");
			title.className = "webtrotion-search-navigation-text";
			title.textContent = item.t;
			body.append(title);
			if (item.e) {
				const snippet = document.createElement("span");
				snippet.className = "webtrotion-search-navigation-snippet";
				snippet.textContent = item.e;
				body.append(snippet);
			}
			link.append(body);
			listItem.append(link);
			list.append(listItem);
		}
		this.append(list);
	}

	private buildGotoIcon(item: GotoEntry): HTMLSpanElement | null {
		if (item.k === "page") {
			const icon = document.createElement("span");
			icon.className = "webtrotion-search-navigation-icon is-default";
			icon.setAttribute("aria-hidden", "true");
			icon.innerHTML = getSvgIcon("bookmark-outline");
			return icon;
		}
		if (item.ie) {
			const icon = document.createElement("span");
			icon.className = "webtrotion-search-navigation-icon";
			icon.setAttribute("aria-hidden", "true");
			icon.textContent = item.ie;
			return icon;
		}
		if (item.im) {
			const icon = document.createElement("span");
			icon.className = "webtrotion-search-navigation-icon";
			icon.setAttribute("aria-hidden", "true");
			const img = document.createElement("img");
			img.src = item.im;
			img.alt = "";
			img.loading = "lazy";
			icon.append(img);
			return icon;
		}
		return null;
	}
}

class WebtrotionSearchPreview extends HTMLElement {
	private instanceName = SEARCH_INSTANCE;
	private resultDataByUrl = new Map<string, PagefindResultData>();
	private latestResults: PagefindRawResult[] = [];
	private eventRoot: Element | null = null;
	private currentPreviewUrl: string | null = null;

	private previewFor(target: Element | null) {
		const link = target?.closest<HTMLAnchorElement>(
			".webtrotion-search-result-link, .webtrotion-search-subresult-link",
		);
		if (!link) return;
		this.renderForUrl(link.getAttribute("href") || "");
	}

	private onFocusIn = (event: Event) => {
		const target = event.target as Element | null;
		// Returning focus to the query box collapses the preview so the panel does not
		// keep showing a stale result while the user edits their search.
		if (target instanceof HTMLInputElement && target.matches(".pf-input")) {
			if (this.hasAttribute("data-preview-active")) {
				this.renderEmpty(
					this.latestResults.length
						? "Select a result or matching section to preview it"
						: "No preview available",
				);
			}
			return;
		}
		this.previewFor(target);
	};

	// Hover previews are driven by pointermove rather than pointerover: when the
	// results re-render under a stationary cursor the browser emits a synthetic
	// pointerover that would auto-open a preview the user never pointed at. pointermove
	// only fires on genuine movement, so a still cursor never opens a preview.
	private onPointerMove = (event: Event) => {
		this.previewFor(event.target as Element | null);
	};

	connectedCallback() {
		if (this.hasAttribute("instance")) {
			this.instanceName = this.getAttribute("instance") || SEARCH_INSTANCE;
		}

		this.renderEmpty();
		queueMicrotask(() => {
			// The preview is a pointer-hover affordance with no purpose on touch / no-hover
			// devices, where tapping a result simply navigates. Skip wiring it up there
			// (the slot itself is hidden via a matching hover media query in the CSS).
			if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
			// Bind to the whole modal (not just the body) so focus landing on the header
			// search input is observed here and collapses the preview.
			this.eventRoot =
				this.closest("pagefind-modal") || this.closest("pagefind-modal-body") || this.parentElement;
			this.eventRoot?.addEventListener("focusin", this.onFocusIn);
			this.eventRoot?.addEventListener("pointermove", this.onPointerMove);
		});

		const instance = getInstanceManager().getInstance(this.instanceName);
		instance.on(
			"loading",
			() => {
				this.latestResults = [];
				this.resultDataByUrl.clear();
				this.renderLoading();
			},
			this,
		);
		instance.on(
			"results",
			(results) => {
				const searchResults = results as PagefindSearchResult;
				this.latestResults = searchResults.results || [];
				this.resultDataByUrl.clear();
				this.renderEmpty(
					this.latestResults.length
						? "Select a result or matching section to preview it"
						: "No preview available",
				);
			},
			this,
		);
	}

	disconnectedCallback() {
		this.eventRoot?.removeEventListener("focusin", this.onFocusIn);
		this.eventRoot?.removeEventListener("pointermove", this.onPointerMove);
	}

	private normalizeUrl(url: string) {
		try {
			const parsed = new URL(url, window.location.origin);
			parsed.searchParams.delete("highlight");
			return parsed.pathname + parsed.search + parsed.hash;
		} catch {
			return url;
		}
	}

	private async renderForUrl(url: string) {
		const normalized = this.normalizeUrl(url);
		if (normalized === this.currentPreviewUrl && this.hasAttribute("data-preview-active")) return;
		this.currentPreviewUrl = normalized;
		const cached = this.resultDataByUrl.get(normalized);
		if (cached) {
			const cachedSubresult = cached.sub_results?.find(
				(sub: PagefindSubResult) => this.normalizeUrl(sub.url) === normalized,
			);
			if (cachedSubresult) {
				this.renderSubResult(cached, cachedSubresult);
				return;
			}
			this.renderResult(cached);
			return;
		}

		for (const rawResult of this.latestResults) {
			const data = await rawResult.data();
			this.cacheResult(data);
			if (this.normalizeUrl(data.meta?.url || data.url) === normalized) {
				this.renderResult(data);
				return;
			}
			const subresult = data.sub_results?.find(
				(sub: PagefindSubResult) => this.normalizeUrl(sub.url) === normalized,
			);
			if (subresult) {
				this.renderSubResult(data, subresult);
				return;
			}
		}
	}

	private cacheResult(data: PagefindResultData) {
		this.resultDataByUrl.set(this.normalizeUrl(data.meta?.url || data.url), data);
		for (const subresult of data.sub_results || []) {
			this.resultDataByUrl.set(this.normalizeUrl(subresult.url), data);
		}
	}

	private renderEmpty(message = "Start typing to preview a result") {
		this.removeAttribute("data-preview-active");
		this.currentPreviewUrl = null;
		this.innerHTML = `<aside class="webtrotion-search-preview-card" aria-label="Search preview">
			<p class="webtrotion-search-preview-empty">${message}</p>
		</aside>`;
	}

	private renderLoading() {
		this.removeAttribute("data-preview-active");
		this.currentPreviewUrl = null;
		this.innerHTML = `<aside class="webtrotion-search-preview-card" aria-label="Search preview" aria-busy="true">
			<div class="webtrotion-search-preview-skeleton title"></div>
			<div class="webtrotion-search-preview-skeleton line"></div>
			<div class="webtrotion-search-preview-skeleton line short"></div>
		</aside>`;
	}

	private renderResult(data: PagefindResultData) {
		this.setAttribute("data-preview-active", "");
		const title = this.escapeHtml(data.meta?.title || "Untitled");
		const excerpt = data.excerpt || "";
		const subResults = (data.sub_results || []).slice(0, 4);

		this.innerHTML = `<aside class="webtrotion-search-preview-card" aria-label="Search preview">
			<h2 class="webtrotion-search-preview-title">${title}</h2>
			${excerpt ? `<p class="webtrotion-search-preview-excerpt">${excerpt}</p>` : ""}
			${
				subResults.length
					? `<ul class="webtrotion-search-preview-sections">${subResults
							.map(
								(sub: PagefindSubResult) =>
									`<li><span>${this.escapeHtml(sub.title || "Section")}</span>${
										sub.excerpt ? `<p>${sub.excerpt}</p>` : ""
									}</li>`,
							)
							.join("")}</ul>`
					: ""
			}
		</aside>`;
	}

	private renderSubResult(data: PagefindResultData, subresult: PagefindSubResult) {
		this.renderResult({
			...data,
			excerpt: subresult.excerpt || data.excerpt,
			meta: {
				...data.meta,
				title: subresult.title || data.meta?.title || "Untitled",
				url: subresult.url || data.meta?.url || data.url,
			},
		});
	}

	private escapeHtml(value: string) {
		return value.replace(/[&<>"']/g, (char) => {
			switch (char) {
				case "&":
					return "&amp;";
				case "<":
					return "&lt;";
				case ">":
					return "&gt;";
				case '"':
					return "&quot;";
				case "'":
					return "&#39;";
				default:
					return char;
			}
		});
	}
}

function readUrlFilters(queryParams: URLSearchParams): FilterSelection {
	const filters: FilterSelection = {};
	const aliases: Record<string, string[]> = {
		collections: ["collections", "collection"],
		tags: ["tags", "tag"],
	};

	for (const [filter, names] of Object.entries(aliases)) {
		const values = names.flatMap((name) =>
			queryParams
				.getAll(name)
				.flatMap((value) => value.split(","))
				.map((value) => value.trim())
				.filter(Boolean),
		);
		if (values.length) filters[filter] = [...new Set(values)];
	}

	return filters;
}

function defineRuntimeElements() {
	if (!customElements.get("webtrotion-search-navigation")) {
		customElements.define("webtrotion-search-navigation", WebtrotionSearchNavigation);
	}
	if (!customElements.get("webtrotion-search-preview")) {
		customElements.define("webtrotion-search-preview", WebtrotionSearchPreview);
	}
}

export function createSearchRuntime(host: HTMLElement): SearchRuntime {
	defineRuntimeElements();

	const modalElement = host.querySelector("pagefind-modal") as
		| (HTMLElement & { open?: () => void })
		| null;
	const emptyStateElement = host.querySelector<HTMLElement>(".webtrotion-search-empty-state");

	const onModalKeydown = (event: KeyboardEvent) => {
		const target = event.target;
		if (
			event.key === "Escape" &&
			target instanceof HTMLElement &&
			target.matches(".pf-dropdown-trigger.open")
		) {
			const dropdown = target.closest("pagefind-filter-dropdown") as
				| (HTMLElement & {
						close?: () => void;
				  })
				| null;
			dropdown?.close?.();
			event.preventDefault();
			event.stopImmediatePropagation();
			return;
		}

		// Clear the query (⌘/Ctrl+Backspace) without closing the modal. Handled here in
		// the capture phase so the browser's default word-delete never runs.
		if (
			(event.metaKey || event.ctrlKey) &&
			!event.altKey &&
			(event.key === "Backspace" || event.key === "Delete")
		) {
			const input = host.querySelector<HTMLInputElement>(".pf-input");
			if (input) {
				event.preventDefault();
				event.stopImmediatePropagation();
				if (input.value !== "") {
					input.value = "";
					input.dispatchEvent(new Event("input", { bubbles: true }));
				}
				input.focus({ preventScroll: true });
			}
			return;
		}

		// "/" jumps focus back to the search box from a result. Capturing here and
		// preventing the default stops the "/" character from being typed into the input.
		if (event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
			const input = host.querySelector<HTMLInputElement>(".pf-input");
			if (input && event.target !== input) {
				event.preventDefault();
				event.stopImmediatePropagation();
				input.focus({ preventScroll: true });
				const end = input.value.length;
				input.setSelectionRange?.(end, end);
				return;
			}
		}

		if (
			event.defaultPrevented ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey ||
			event.key !== "ArrowDown" ||
			!(target instanceof HTMLInputElement) ||
			!target.matches(".pf-input")
		) {
			return;
		}

		const firstLink = host.querySelector<HTMLAnchorElement>(
			".webtrotion-search-navigation-link, .webtrotion-search-pinned-link, .webtrotion-search-result-link",
		);
		if (!firstLink) return;

		event.preventDefault();
		event.stopImmediatePropagation();
		firstLink.focus({ preventScroll: true });
		firstLink.scrollIntoView({ behavior: "smooth", block: "nearest" });
	};

	const onResultsKeydown = (event: KeyboardEvent) => {
		if (
			event.defaultPrevented ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey
		) {
			return;
		}

		const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
			".webtrotion-search-navigation-link, .webtrotion-search-pinned-link, .webtrotion-search-result-link, .webtrotion-search-subresult-link",
		);
		if (!link || !modalElement?.contains(link)) return;
		if (event.key === "Enter") {
			event.preventDefault();
			event.stopImmediatePropagation();
			link.click();
			return;
		}

		const mainLinks = Array.from(
			host.querySelectorAll<HTMLAnchorElement>(".webtrotion-search-result-link"),
		);
		const navigationLinks = Array.from(
			host.querySelectorAll<HTMLAnchorElement>(
				".webtrotion-search-navigation-link, .webtrotion-search-pinned-link",
			),
		);
		const navigationIndex = navigationLinks.indexOf(link);
		let destination: HTMLAnchorElement | undefined;

		if (navigationIndex !== -1) {
			if (event.key === "ArrowDown")
				destination = navigationLinks[navigationIndex + 1] || mainLinks[0];
			if (event.key === "ArrowUp") {
				destination = navigationLinks[navigationIndex - 1];
				if (!destination) {
					const input = host.querySelector<HTMLInputElement>(".pf-input");
					if (!input) return;
					event.preventDefault();
					input.focus({ preventScroll: true });
					return;
				}
			}
			if (!destination) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			destination.focus({ preventScroll: true });
			destination.scrollIntoView({
				behavior: event.repeat ? "auto" : "smooth",
				block: "nearest",
			});
			return;
		}

		const result = link.closest<HTMLElement>(".webtrotion-search-result");
		if (!result) return;
		const mainLink = result.querySelector<HTMLAnchorElement>(".webtrotion-search-result-link");
		if (!mainLink) return;

		const resultIndex = mainLinks.indexOf(mainLink);
		const subLinks = Array.from(
			result.querySelectorAll<HTMLAnchorElement>(".webtrotion-search-subresult-link"),
		);
		const subIndex = subLinks.indexOf(link);
		const isSubResult = subIndex !== -1;
		if (!isSubResult) {
			// Up/Down stay on the main-result axis and skip over sections entirely.
			if (event.key === "ArrowDown") destination = mainLinks[resultIndex + 1];
			if (event.key === "ArrowUp")
				destination = mainLinks[resultIndex - 1] || navigationLinks.at(-1);
			// Right steps into this result's sections.
			if (event.key === "ArrowRight") destination = subLinks[0];
		} else {
			// Within sections, Left/Right move between them; Left off the first returns to
			// the main result. Up/Down leave sections and continue on the main-result axis.
			if (event.key === "ArrowRight") destination = subLinks[subIndex + 1];
			if (event.key === "ArrowLeft") destination = subLinks[subIndex - 1] || mainLink;
			if (event.key === "ArrowDown") destination = mainLinks[resultIndex + 1];
			if (event.key === "ArrowUp") destination = mainLink;
		}

		if (!destination && event.key === "ArrowUp" && !isSubResult) {
			const input = host.querySelector<HTMLInputElement>(".pf-input");
			if (!input) return;
			event.preventDefault();
			input.focus({ preventScroll: true });
			return;
		}

		if (!destination) return;

		event.preventDefault();
		event.stopImmediatePropagation();
		destination.focus({ preventScroll: true });
		const scrollTarget =
			destination.closest<HTMLElement>(".webtrotion-search-subresults li") ||
			destination.closest<HTMLElement>(".webtrotion-search-result") ||
			destination;
		scrollTarget.scrollIntoView({
			behavior: event.repeat ? "auto" : "smooth",
			block: "nearest",
		});
	};

	modalElement?.addEventListener("keydown", onModalKeydown, true);
	modalElement?.addEventListener("keydown", onResultsKeydown, true);

	const instance = getInstanceManager().getInstance(SEARCH_INSTANCE);
	instance.on(
		"loading",
		() => {
			if (emptyStateElement) emptyStateElement.hidden = true;
		},
		host,
	);
	instance.on(
		"results",
		(results) => {
			const searchResults = results as PagefindSearchResult;
			const hasQuery = Boolean(instance.searchTerm?.trim());
			const hasFilters = Object.values(instance.searchFilters || {}).some(
				(values) => values.length,
			);
			if (emptyStateElement) {
				emptyStateElement.hidden =
					Boolean(searchResults.results?.length) || !(hasQuery || hasFilters);
			}
		},
		host,
	);

	const openModal = () => {
		if (customElements.get("pagefind-modal")) {
			modalElement?.open?.();
			return;
		}
		customElements.whenDefined("pagefind-modal").then(() => modalElement?.open?.());
	};

	return {
		open: openModal,
		openFromUrl: () => {
			const queryParams = new URLSearchParams(window.location.search);
			const searchTerm = queryParams.get("q") || "";
			const searchFilters = readUrlFilters(queryParams);
			const run = () => {
				modalElement?.open?.();
				const input = host.querySelector<HTMLInputElement>(".pf-input");
				if (input) input.value = searchTerm;
				instance.triggerSearchWithFilters(searchTerm, searchFilters);
			};
			if (customElements.get("pagefind-modal")) {
				run();
				return;
			}
			customElements.whenDefined("pagefind-modal").then(run);
		},
	};
}
