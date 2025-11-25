import { parseDocument, DomUtils } from "htmlparser2";
import type { Document, Element } from "domhandler";
import type { ExternalContentDescriptor } from "@/lib/interfaces";
import type { Heading } from "@/types";
import { isRelativePath, toPublicUrl, extractHeadingsFromDocument } from "./external-content-utils";

export type HtmlTransformResult = {
	html: string;
	headings: Heading[];
};

export { isRelativePath, toPublicUrl };

const ASSET_ATTRS: Record<string, string[]> = {
	img: ["src", "data-src", "data-large-src"],
	source: ["src", "srcset"],
	video: ["src", "poster"],
	audio: ["src"],
	script: ["src"],
	iframe: ["src"],
	link: ["href"],
};

function rewriteSrcset(value: string, descriptor: ExternalContentDescriptor): string {
	return value
		.split(",")
		.map((entry) => {
			const trimmed = entry.trim();
			if (!trimmed) return trimmed;
			const [url, descriptorPart] = trimmed.split(/\s+/, 2);
			const rewritten = isRelativePath(url) ? toPublicUrl(url, descriptor) : url;
			return descriptorPart ? `${rewritten} ${descriptorPart}` : rewritten;
		})
		.join(", ");
}

function rewriteAssets(root: Document | Element, descriptor: ExternalContentDescriptor) {
	const elements = DomUtils.findAll(
		(elem) => elem.type === "tag" && !!ASSET_ATTRS[elem.name],
		(root as Document).children || [root as Element],
		true,
	);

	for (const elem of elements) {
		const targetAttrs = ASSET_ATTRS[elem.name] || [];
		for (const attrName of targetAttrs) {
			const value = elem.attribs?.[attrName];
			if (!value) continue;

			if (attrName === "srcset") {
				elem.attribs[attrName] = rewriteSrcset(value, descriptor);
				continue;
			}

			if (isRelativePath(value)) {
				elem.attribs[attrName] = toPublicUrl(value, descriptor);
			}
		}
	}
}

export function transformExternalHtml(
	rawHtml: string,
	descriptor: ExternalContentDescriptor,
	options?: { preferBodyContent?: boolean },
): HtmlTransformResult {
	const document = parseDocument(rawHtml);
	rewriteAssets(document, descriptor);
	const headings = extractHeadingsFromDocument(document);
	const preferBodyContent = options?.preferBodyContent !== false;
	if (preferBodyContent) {
		const bodyElement = DomUtils.findOne(
			(elem) => elem.type === "tag" && elem.name === "body",
			document.children,
			true,
		);
		const html = bodyElement ? DomUtils.getInnerHTML(bodyElement) : DomUtils.getOuterHTML(document);
		return { html, headings };
	}

	return { html: DomUtils.getOuterHTML(document), headings };
}
