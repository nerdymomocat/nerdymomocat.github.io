import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { parseDocument } from "htmlparser2";
import { DomUtils } from "htmlparser2";
import type { AnyNode, Element as ElementNode } from "domhandler";
import { Element as DomElement, Text as DomText } from "domhandler";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import superjson from "superjson";
import {
	MARKDOWN_EXPORT_ENABLED,
	BUILD_FOLDER_PATHS,
	HOME_PAGE_SLUG,
	AUTHOR,
	LAST_BUILD_TIME,
	BIBTEX_CITATIONS_ENABLED,
	BIBLIOGRAPHY_STYLE,
	CITATIONS,
} from "../constants";
import { getAllPosts, getAllPages } from "../lib/notion/client";
import type { Post, Citation, Footnote } from "../lib/interfaces";

type FootnoteDefinition = {
	marker: string;
	index: number;
	html: string;
};

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
	bulletListMarker: "-",
});
turndown.keep(["details", "summary"]);
turndown.use(gfm);

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

const markdownExporter = (): AstroIntegration => {
	let siteUrl = "http://localhost:4321/";

	return {
		name: "markdown-exporter",
		hooks: {
			"astro:config:done": ({ config }) => {
				if (config.site) {
					siteUrl = config.site.toString();
				}
			},
			"astro:build:done": async ({ dir }) => {
				if (!MARKDOWN_EXPORT_ENABLED) {
					return;
				}

				const distDir = fileURLToPath(dir);
				const markdownCacheDir = BUILD_FOLDER_PATHS["markdownCache"];
				const posts = await getAllPosts();
				const pages = await getAllPages();
				const postIdSet = new Set(posts.map((post) => post.PageId));
				const entries = [...posts, ...pages];
				const lastBuildTime = LAST_BUILD_TIME ? new Date(LAST_BUILD_TIME) : null;
				const citationsSectionEnabled =
					BIBTEX_CITATIONS_ENABLED &&
					CITATIONS?.["extract-and-process-bibtex-citations"]?.["generate-bibliography-section"] ===
						true;

				for (const entry of entries) {
					if (entry.IsExternal) continue;
					const isPost = postIdSet.has(entry.PageId);
					const slug = entry.Slug || "";
					const safeSlug = (slug || HOME_PAGE_SLUG).replace(/\//g, "__");

					const cacheKey = `${isPost ? "post" : "page"}-${safeSlug}`;
					const cachePath = path.join(markdownCacheDir, `${cacheKey}.json`);

					let htmlPath: string;
					let mdPath: string;
					let pageUrl: string;

					if (isPost) {
						htmlPath = path.join(distDir, "posts", slug, "index.html");
						mdPath = path.join(distDir, "posts", slug, "index.html.md");
						pageUrl = new URL(path.posix.join("posts", `${slug}/`), siteUrl).toString();
					} else if (slug === HOME_PAGE_SLUG) {
						htmlPath = path.join(distDir, "index.html");
						mdPath = path.join(distDir, "index.html.md");
						pageUrl = siteUrl;
					} else {
						htmlPath = path.join(distDir, slug, "index.html");
						mdPath = path.join(distDir, slug, "index.html.md");
						pageUrl = new URL(path.posix.join(slug, "/"), siteUrl).toString();
					}

					const entryTimestamp = entry.LastUpdatedTimeStamp
						? new Date(entry.LastUpdatedTimeStamp)
						: null;
					const canUseCache =
						lastBuildTime && entryTimestamp ? entryTimestamp <= lastBuildTime : false;

					let finalMarkdown: string | null = null;

					if (canUseCache) {
						try {
							const cached = JSON.parse(await fs.readFile(cachePath, "utf-8"));
							if (typeof cached?.markdown === "string") {
								finalMarkdown = cached.markdown;
							}
						} catch {
							// cache miss
						}
					}

					if (!finalMarkdown) {
						let htmlContent: string;
						try {
							htmlContent = await fs.readFile(htmlPath, "utf-8");
						} catch {
							continue;
						}

						const contentRoot = findContentRoot(htmlContent);
						if (!contentRoot) {
							continue;
						}

						const citations = await loadCitationsForEntry(entry);
						const footnotesData = await loadFootnotesForEntry(entry);
						const processed = processContentNode(contentRoot, pageUrl, siteUrl, footnotesData);
						const { sanitizedHtml, footnotes: extractedFootnotes } = processed;
						const articleMarkdown = normalizeFootnoteReferences(turndown.turndown(sanitizedHtml));
						const footnotesMarkdown = renderFootnotesMarkdown(extractedFootnotes);
						let markdownOutput = articleMarkdown;

						if (footnotesMarkdown) {
							markdownOutput = `${markdownOutput.trimEnd()}\n\n${footnotesMarkdown}`;
						}

						if (
							BIBTEX_CITATIONS_ENABLED &&
							!citationsSectionEnabled &&
							Array.isArray(citations) &&
							citations.length > 0
						) {
							const citationsMarkdown = renderCitationsMarkdown(citations);
							if (citationsMarkdown) {
								markdownOutput = `${markdownOutput.trimEnd()}\n\n${citationsMarkdown}`;
							}
						}

						const metadata = buildMarkdownMetadata({
							entry,
							pageUrl,
							slug,
						});
						const frontmatter = renderYamlFrontmatter(metadata);
						finalMarkdown = `${frontmatter}\n${markdownOutput}`;

						await fs.writeFile(
							cachePath,
							JSON.stringify({ markdown: finalMarkdown }, null, 2),
							"utf-8",
						);
					}

					if (!finalMarkdown) {
						continue;
					}

					await fs.writeFile(mdPath, finalMarkdown, "utf-8");
				}
			},
		},
	};
};

function findContentRoot(html: string): ElementNode | null {
	const document = parseDocument(html);
	const postBody = DomUtils.findOne(
		(elem) => elem.type === "tag" && hasClass(elem as ElementNode, "post-body"),
		document.children,
		true,
	) as ElementNode | null;

	if (postBody) {
		return postBody;
	}

	return DomUtils.findOne(
		(elem) => elem.type === "tag" && (elem as ElementNode).name === "article",
		document.children,
		true,
	) as ElementNode | null;
}

function processContentNode(
	target: ElementNode,
	pageUrl: string,
	siteUrl: string,
	fallbackFootnotes?: Footnote[] | null,
): {
	sanitizedHtml: string;
	footnotes: FootnoteDefinition[];
} {
	const footnotesInfo = collectFootnotes(target, fallbackFootnotes);
	sanitizeNode(target, {
		pageUrl,
		siteUrl,
		footnoteIndexMap: footnotesInfo.indexMap,
	});

	const sanitizedHtml = DomUtils.getInnerHTML(target);

	return {
		sanitizedHtml,
		footnotes: footnotesInfo.definitions,
	};
}

function renderFootnotesMarkdown(footnotes: FootnoteDefinition[]): string {
	if (!footnotes.length) return "";

	const lines: string[] = [];
	for (const footnote of footnotes) {
		const converted = turndown.turndown(footnote.html).trim();
		if (!converted) continue;

		const formatted = converted
			.split("\n")
			.map((line, idx) => (idx === 0 ? line : `    ${line}`))
			.join("\n");

		lines.push(`[^${footnote.index}]: ${formatted}`);
	}

	return lines.join("\n");
}

function renderCitationsMarkdown(citations: Citation[]): string {
	if (!Array.isArray(citations) || citations.length === 0) {
		return "";
	}

	const entries = citations.map((citation, index) => {
		const formatted = citation.FormattedEntry
			? turndown.turndown(citation.FormattedEntry).trim()
			: "";
		const base = formatted || citation.Key || `Citation ${index + 1}`;
		const urlSuffix = citation.Url ? ` (${citation.Url})` : "";

		if (BIBLIOGRAPHY_STYLE === "simplified-ieee") {
			return `${index + 1}. ${base}${urlSuffix}`;
		}

		return `- ${base}${urlSuffix}`;
	});

	return `## Bibliography\n\n${entries.join("\n")}`;
}

function normalizeFootnoteReferences(markdown: string): string {
	return markdown.replace(/\\\[\^(\d+)\\\]/g, "[^$1]");
}

function collectFootnotes(
	root: ElementNode,
	fallbackFootnotes?: Footnote[] | null,
): {
	definitions: FootnoteDefinition[];
	indexMap: Map<string, number>;
} {
	const definitions: FootnoteDefinition[] = [];
	const indexMap = new Map<string, number>();

	const footnotesSection = DomUtils.findOne(
		(elem) =>
			elem.type === "tag" &&
			(elem as ElementNode).name === "section" &&
			getClassList(elem as ElementNode).includes("footnotes-section"),
		[root],
		true,
	) as ElementNode | null;

	if (!footnotesSection) {
		if (fallbackFootnotes?.length) {
			const fallbackDefs = collectFootnotesFromTemplates(root, fallbackFootnotes);
			fallbackDefs.forEach((definition) => {
				definitions.push(definition);
				indexMap.set(definition.marker, definition.index);
			});
		}

		return { definitions, indexMap };
	}

	const list = DomUtils.findOne(
		(elem) => elem.type === "tag" && (elem as ElementNode).name === "ol",
		footnotesSection.children,
		true,
	) as ElementNode | null;

	if (list) {
		const items = DomUtils.findAll(
			(elem) => elem.type === "tag" && (elem as ElementNode).name === "li",
			list.children,
		) as ElementNode[];
		items.forEach((item, idx) => {
			const idAttr = item.attribs?.id ?? "";
			const match = idAttr.match(/^footnote-def-(.+)$/);
			const marker = match ? match[1] : `${idx + 1}`;
			const contentDiv = DomUtils.findOne(
				(elem) =>
					elem.type === "tag" &&
					(elem as ElementNode).name === "div" &&
					getClassList(elem as ElementNode).includes("flex-1"),
				item.children,
				true,
			) as ElementNode | null;
			const html = contentDiv ? DomUtils.getInnerHTML(contentDiv) : DomUtils.getInnerHTML(item);
			const index = idx + 1;
			definitions.push({ marker, index, html });
			indexMap.set(marker, index);
		});
	}

	DomUtils.removeElement(footnotesSection);

	if (!definitions.length && fallbackFootnotes?.length) {
		const fallbackDefs = collectFootnotesFromTemplates(root, fallbackFootnotes);
		fallbackDefs.forEach((definition) => {
			definitions.push(definition);
			indexMap.set(definition.marker, definition.index);
		});
	}

	return { definitions, indexMap };
}

function collectFootnotesFromTemplates(
	root: ElementNode,
	fallbackFootnotes: Footnote[],
): FootnoteDefinition[] {
	const templatesByMarker = indexFootnoteTemplates(root);
	if (!templatesByMarker.size) {
		return [];
	}

	const definitions: FootnoteDefinition[] = [];
	const processedMarkers = new Set<string>();

	fallbackFootnotes.forEach((footnote, idx) => {
		const marker = footnote.Marker;
		if (!marker || processedMarkers.has(marker)) {
			return;
		}

		const templateNode = templatesByMarker.get(marker);
		if (!templateNode) {
			return;
		}

		const html = extractFootnoteHtmlFromTemplate(templateNode);
		if (!html) {
			return;
		}

		const index =
			typeof footnote.Index === "number" && Number.isFinite(footnote.Index)
				? footnote.Index
				: definitions.length + 1;

		definitions.push({ marker, index, html });
		processedMarkers.add(marker);
	});

	return definitions;
}

function indexFootnoteTemplates(root: ElementNode): Map<string, ElementNode> {
	const templates = DomUtils.findAll(
		(node) =>
			node.type === "tag" &&
			(node as ElementNode).name === "template" &&
			typeof (node as ElementNode).attribs?.id === "string" &&
			(node as ElementNode).attribs.id.startsWith("template-popover-description-footnote-"),
		[root],
		true,
	) as ElementNode[];

	const templateMap = new Map<string, ElementNode>();
	for (const template of templates) {
		const idAttr = template.attribs?.id || "";
		const marker = extractMarkerFromTemplateId(idAttr);
		if (marker && !templateMap.has(marker)) {
			templateMap.set(marker, template);
		}
	}

	return templateMap;
}

function extractMarkerFromTemplateId(idAttr: string): string | null {
	if (!idAttr) return null;
	const parts = idAttr.split("-");
	if (!parts.length) return null;
	return parts[parts.length - 1] || null;
}

function extractFootnoteHtmlFromTemplate(template: ElementNode): string {
	const popoverNode = DomUtils.findOne(
		(node) => node.type === "tag" && !!(node as ElementNode).attribs?.["data-popover"],
		template.children,
		true,
	) as ElementNode | null;

	const contentNode = popoverNode
		? DomUtils.findOne(
				(node) => node.type === "tag" && getClassList(node as ElementNode).includes("space-y-2"),
				popoverNode.children,
				true,
			)
		: null;

	const targetNode = (contentNode || popoverNode || template) as ElementNode;
	return DomUtils.getInnerHTML(targetNode).trim();
}

function sanitizeNode(
	node: AnyNode,
	context: { pageUrl: string; siteUrl: string; footnoteIndexMap: Map<string, number> },
): void {
	if (node.type === "text") {
		return;
	}

	if (node.type === "tag") {
		const element = node as ElementNode;

		if (shouldRemoveElement(element)) {
			DomUtils.removeElement(element);
			return;
		}

		if (isDecorativeIcon(element)) {
			DomUtils.removeElement(element);
			return;
		}

		if (element.name === "details") {
			normalizeDetails(element);
		}

		if (isFootnoteMarker(element)) {
			const marker = extractFootnoteRef(element);
			if (marker) {
				const index = context.footnoteIndexMap.get(marker);
				if (index) {
					element.attribs = {};
					element.children = [
						{
							data: `[^${index}]`,
							type: "text",
							parent: element,
						},
					];
				}
			}
		}

		removePopoverAttributes(element);
		convertAttributesToAbsolute(element, context.pageUrl, context.siteUrl);
	}

	if ("children" in node && node.children) {
		// clone array to avoid mutation issues
		const children = [...node.children];
		for (const child of children) {
			sanitizeNode(child, context);
		}
	}
}

function shouldRemoveElement(element: ElementNode): boolean {
	if (["script", "style", "template", "noscript"].includes(element.name)) {
		return true;
	}

	const classList = getClassList(element);
	if (
		classList.includes("sr-only") ||
		classList.includes("popoverEl") ||
		classList.includes("copy-markdown-trigger")
	) {
		return true;
	}

	if (Object.prototype.hasOwnProperty.call(element.attribs || {}, "data-copy-md-root")) {
		return true;
	}

	if (element.attribs?.["data-popover"]) {
		return true;
	}

	return false;
}

function isFootnoteMarker(element: ElementNode): boolean {
	const target = element.attribs?.["data-popover-target"];
	const margin = element.attribs?.["data-margin-note"];
	return Boolean(
		(target && target.includes("popover-description-footnote-")) ||
			(margin && margin.startsWith("footnote-")),
	);
}

function extractFootnoteRef(element: ElementNode): string | null {
	const target = element.attribs?.["data-popover-target"];
	if (target && target.startsWith("popover-description-footnote-")) {
		const uniqueId = target.replace("popover-description-", "");
		const lastIndex = uniqueId.lastIndexOf("-");
		return lastIndex >= 0 ? uniqueId.slice(lastIndex + 1) : null;
	}
	const margin = element.attribs?.["data-margin-note"];
	if (margin && margin.startsWith("footnote-")) {
		const lastIndex = margin.lastIndexOf("-");
		return lastIndex >= 0 ? margin.slice(lastIndex + 1) : null;
	}
	return null;
}

function removePopoverAttributes(element: ElementNode) {
	const attrsToRemove = [
		"data-popover",
		"data-popover-target",
		"data-popover-placement",
		"data-popover-link",
		"data-href",
		"data-margin-note",
	];
	for (const attr of attrsToRemove) {
		if (attr in element.attribs) {
			delete element.attribs[attr];
		}
	}
}

function convertAttributesToAbsolute(element: ElementNode, pageUrl: string, siteUrl: string) {
	const attributeNames = ["href", "src"];
	for (const attr of attributeNames) {
		const value = element.attribs?.[attr];
		if (!value) continue;
		const resolved = resolveUrl(value, pageUrl, siteUrl);
		if (resolved && resolved !== value) {
			element.attribs[attr] = resolved;
		}
	}
}

function resolveUrl(value: string, pageUrl: string, siteUrl: string): string | null {
	if (
		!value ||
		ABSOLUTE_URL_REGEX.test(value) ||
		value.startsWith("mailto:") ||
		value.startsWith("#")
	) {
		return value;
	}

	if (value.startsWith("//")) {
		return `https:${value}`;
	}

	const base = value.startsWith("/") ? siteUrl : pageUrl;
	try {
		return new URL(value, base).toString();
	} catch {
		return value;
	}
}

function getClassList(element: ElementNode): string[] {
	if (!element.attribs?.class) return [];
	return element.attribs.class
		.split(" ")
		.map((c) => c.trim())
		.filter(Boolean);
}

function buildMarkdownMetadata({
	entry,
	pageUrl,
	slug,
}: {
	entry: Post;
	pageUrl: string;
	slug: string;
}): Record<string, unknown> {
	const normalizedSlug = slug || HOME_PAGE_SLUG;
	const tags = (entry.Tags || []).map((tag) => tag.name).filter(Boolean);

	return {
		title: entry.Title || normalizedSlug || "Untitled",
		slug: normalizedSlug,
		canonical_url: pageUrl,
		collection: entry.Collection || undefined,
		published_at: normalizeDate(entry.Date),
		updated_at: normalizeDate(entry.LastUpdatedDate) || normalizeDate(entry.LastUpdatedTimeStamp),
		tags,
		excerpt: entry.Excerpt || undefined,
		author: AUTHOR || "Unknown Author",
		external_url: entry.ExternalUrl || undefined,
	};
}

function renderYamlFrontmatter(metadata: Record<string, unknown>): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(metadata)) {
		if (shouldOmitValue(value)) continue;
		lines.push(`${key}: ${formatYamlValue(value, 0)}`);
	}
	return `---\n${lines.join("\n")}\n---\n`;
}

function formatYamlValue(value: unknown, indent: number): string {
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	if (typeof value === "string") {
		if (!value.length) return '""';
		if (/^[A-Za-z0-9_/.:+-]+$/.test(value)) return value;
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "[]";
		}
		const childIndent = indent + 2;
		return `\n${value
			.map((item) => `${" ".repeat(childIndent)}- ${formatYamlValue(item, childIndent)}`)
			.join("\n")}`;
	}

	if (value && typeof value === "object") {
		const entries = Object.entries(value).filter(([, v]) => !shouldOmitValue(v));
		if (entries.length === 0) {
			return "{}";
		}
		const childIndent = indent + 2;
		return `\n${entries
			.map(([key, val]) => `${" ".repeat(childIndent)}${key}: ${formatYamlValue(val, childIndent)}`)
			.join("\n")}`;
	}

	return "null";
}

function shouldOmitValue(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value === "string") return value.trim().length === 0;
	if (typeof value === "object" && !Array.isArray(value)) {
		return Object.keys(value as Record<string, unknown>).length === 0;
	}
	return false;
}

function normalizeDate(value: string | Date | null | undefined): string | null {
	if (!value) return null;
	const date = typeof value === "string" ? new Date(value) : value;
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		return null;
	}
	return date.toISOString();
}

async function loadCitationsForEntry(entry: Post): Promise<Citation[] | null> {
	const citationsDir = BUILD_FOLDER_PATHS["citationsInPage"];
	if (!citationsDir) {
		return null;
	}

	const filePath = path.join(citationsDir, `${entry.PageId}.json`);
	try {
		const raw = await fs.readFile(filePath, "utf-8");
		const parsed = superjson.parse<Citation[]>(raw);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return parsed;
		}
	} catch {
		// ignore missing cache
	}

	return null;
}

async function loadFootnotesForEntry(entry: Post): Promise<Footnote[] | null> {
	const footnotesDir = BUILD_FOLDER_PATHS["footnotesInPage"];
	if (!footnotesDir) {
		return null;
	}

	const filePath = path.join(footnotesDir, `${entry.PageId}.json`);
	try {
		const raw = await fs.readFile(filePath, "utf-8");
		const parsed = superjson.parse<Footnote[]>(raw);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return parsed;
		}
	} catch {
		// ignore missing cache
	}

	return null;
}

export default markdownExporter;
function hasClass(element: ElementNode, className: string): boolean {
	return getClassList(element).includes(className);
}

function isDecorativeIcon(element: ElementNode): boolean {
	const ariaHidden = (element.attribs?.["aria-hidden"] || "").toLowerCase();
	const focusable = (element.attribs?.["focusable"] || "").toLowerCase();
	if (ariaHidden !== "true" || (focusable !== "false" && focusable !== "0")) {
		return false;
	}
	return ["svg", "span", "i"].includes(element.name);
}

function normalizeDetails(element: ElementNode) {
	const summaryNode = element.children?.find(
		(child) => child.type === "tag" && (child as ElementNode).name === "summary",
	) as ElementNode | undefined;

	if (!summaryNode) {
		return;
	}

	const summaryText = DomUtils.textContent(summaryNode).trim() || "Toggle section";
	element.children = element.children?.filter((child) => child !== summaryNode) || [];

	const summaryParagraph = createElement("p", [
		createElement("strong", [createTextNode(summaryText)]),
	]);

	element.name = "div";
	delete element.attribs?.open;
	element.attribs = element.attribs || {};
	summaryParagraph.parent = element;
	element.children.unshift(summaryParagraph);
}

function createElement(
	name: string,
	children: AnyNode[] = [],
	attribs: Record<string, string> = {},
) {
	const el = new DomElement(name, attribs);
	el.children = children;
	children.forEach((child) => {
		if (child && typeof child === "object") {
			child.parent = el;
		}
	});
	return el;
}

function createTextNode(text: string): DomText {
	return new DomText(text);
}
