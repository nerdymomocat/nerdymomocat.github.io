import { parseDocument, DomUtils } from "htmlparser2";
import type { Document, Element } from "domhandler";
import type { ExternalContentDescriptor, ExternalContentType } from "@/lib/interfaces";
import type { Heading } from "@/types";
import { slugify } from "../../utils/slugify";
import path from "node:path";
import { EXTERNAL_CONTENT_CONFIG } from "../../constants";

export const RELATIVE_PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z0-9+\-.]*:/;

export function isRelativePath(value: string): boolean {
	if (!value) return false;
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return false;
	if (trimmed.startsWith("//")) return false;
	if (trimmed.startsWith("data:") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) {
		return false;
	}
	return !RELATIVE_PROTOCOL_REGEX.test(trimmed);
}

export function toPublicUrl(
	relativePath: string,
	descriptor: Pick<ExternalContentDescriptor, "folderName">,
): string {
	if (!relativePath) return relativePath;
	const [pathPart, suffix] = relativePath.split(/(?=[?#])/);
	const normalized = path.posix.normalize(pathPart.replace(/^.\//, ""));
	const joined = path.posix.join("/external-posts", descriptor.folderName, normalized);
	return suffix ? `${joined}${suffix}` : joined;
}

export function extractHeadingsFromDocument(root: Document | Element): Heading[] {
	const headingTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
	const headingElements = DomUtils.findAll(
		(elem) => elem.type === "tag" && headingTags.has(elem.name),
		(root as Document).children || [root as Element],
		true,
	);

	return headingElements
		.map((elem) => {
			const depth = parseInt(elem.name.replace("h", ""), 10);
			const text = DomUtils.textContent(elem).trim();
			if (!text) return null;
			const existingId = elem.attribs?.id;
			const headingSlug = existingId || slugify(text);
			elem.attribs = {
				...elem.attribs,
				id: headingSlug,
			};
			return { text, slug: headingSlug, depth };
		})
		.filter(Boolean) as Heading[];
}

export function extractHeadingsFromHtml(html: string): Heading[] {
	const document = parseDocument(html);
	return extractHeadingsFromDocument(document);
}

// Ensures that there is a blank line after imports/exports in the MDX source.
// This prevents issues where some MDX parsers fail if content immediately follows imports.
export function ensureBlankLineAfterImports(source: string): string {
	const lines = source.split(/\r?\n/);
	let idx = 0;
	let sawImport = false;

	while (idx < lines.length) {
		const trimmed = lines[idx].trim();
		if (!trimmed) {
			if (!sawImport) {
				idx += 1;
				continue;
			}
			break;
		}
		if (/^(import|export)\s/.test(trimmed)) {
			sawImport = true;
			idx += 1;
			continue;
		}
		break;
	}

	if (!sawImport) return source;
	if (idx >= lines.length) return source;
	if (lines[idx].trim() === "") return source;

	lines.splice(idx, 0, "");
	return lines.join("\n");
}

const KNOWN_EXTERNAL_TYPES: ExternalContentType[] = ["html", "markdown", "mdx"];

function normalizePrefix(prefix: string): string {
	return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function extractFolderName(externalUrl: string, prefix: string): string | null {
	const trimmed = externalUrl.slice(prefix.length).replace(/^\/+/, "");
	if (!trimmed) return null;
	const [folderName] = trimmed.split(/[\\/]/);
	return folderName?.trim() || null;
}

export function resolveExternalContentDescriptor(
	externalUrl: string | null,
): ExternalContentDescriptor | null {
	if (!externalUrl || !EXTERNAL_CONTENT_CONFIG.enabled) {
		return null;
	}

	for (const source of EXTERNAL_CONTENT_CONFIG.sources) {
		const prefix = normalizePrefix(source.externalUrlPrefix);
		if (!externalUrl.startsWith(prefix)) {
			continue;
		}
		const folderName = extractFolderName(externalUrl, prefix);
		if (!folderName) {
			console.warn(
				`[external-content] Could not determine folder name from External URL "${externalUrl}". Expected a folder after "${source.externalUrlPrefix}".`,
			);
			return null;
		}

		const type = source.id as ExternalContentType;
		if (!KNOWN_EXTERNAL_TYPES.includes(type)) {
			return null;
		}

		return {
			type,
			sourceId: source.id,
			folderName,
		};
	}

	return null;
}
