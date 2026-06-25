import { fileURLToPath } from "node:url";
import { defineMdastPlugin } from "satteri";
import type { MdxJsxAttributeUnion, MdxJsxFlowElement, MdxJsxTextElement } from "satteri";
import { isRelativePath, toDeployablePublicUrl, toPublicUrl } from "./external-content-utils";

const REWRITTEN_ATTRIBUTES = new Set(["src", "href", "poster", "data-src", "dataSrc"]);

function getFolderName(fileUrl: URL | undefined): string | null {
	if (!fileUrl) return null;
	const normalized = fileURLToPath(fileUrl).replace(/\\/g, "/");
	const match = normalized.match(/\/src\/external-posts\/([^/]+)\/index\.mdx$/);
	return match?.[1] || null;
}

function rewriteIfRelative(value: unknown, folderName: string): unknown {
	if (typeof value !== "string" || !isRelativePath(value)) return value;
	return toDeployablePublicUrl(toPublicUrl(value, { type: "mdx", sourceId: "external", folderName }));
}

function rewriteAttributes(
	node: Readonly<MdxJsxFlowElement | MdxJsxTextElement>,
	folderName: string,
): MdxJsxAttributeUnion[] | null {
	let changed = false;
	const attributes = node.attributes.map((attribute) => {
		if (
			attribute.type !== "mdxJsxAttribute" ||
			!REWRITTEN_ATTRIBUTES.has(attribute.name) ||
			typeof attribute.value !== "string"
		) {
			return attribute;
		}

		const value = rewriteIfRelative(attribute.value, folderName);
		if (value === attribute.value) return attribute;

		changed = true;
		return { ...attribute, value };
	});

	return changed ? attributes : null;
}

const satteriExternalMdxAssets = defineMdastPlugin({
	name: "external-mdx-assets",
	image(node, context) {
		const folderName = getFolderName(context.fileURL);
		if (!folderName) return;
		context.setProperty(node, "url", rewriteIfRelative(node.url, folderName) as string);
	},
	link(node, context) {
		const folderName = getFolderName(context.fileURL);
		if (!folderName) return;
		context.setProperty(node, "url", rewriteIfRelative(node.url, folderName) as string);
	},
	definition(node, context) {
		const folderName = getFolderName(context.fileURL);
		if (!folderName) return;
		context.setProperty(node, "url", rewriteIfRelative(node.url, folderName) as string);
	},
	mdxJsxFlowElement(node, context) {
		const folderName = getFolderName(context.fileURL);
		if (!folderName) return;
		const attributes = rewriteAttributes(node, folderName);
		if (attributes) context.setProperty(node, "attributes", attributes);
	},
	mdxJsxTextElement(node, context) {
		const folderName = getFolderName(context.fileURL);
		if (!folderName) return;
		const attributes = rewriteAttributes(node, folderName);
		if (attributes) context.setProperty(node, "attributes", attributes);
	},
});

export default satteriExternalMdxAssets;
