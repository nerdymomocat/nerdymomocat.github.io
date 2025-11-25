import fs from "node:fs";
import path from "node:path";
import { EXTERNAL_CONTENT_PATHS } from "../../constants";
import { ensureBlankLineAfterImports } from "../external-content/external-content-utils";

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function writeMdxSnippet(options: {
	pageId: string;
	blockId: string;
	slug: string;
	content: string;
}) {
	const tmpDir = EXTERNAL_CONTENT_PATHS.mdxSnippetsCache;
	const destDir = EXTERNAL_CONTENT_PATHS.mdxSnippets;
	ensureDir(tmpDir);
	ensureDir(destDir);

	const filename = `${options.slug}.mdx`;
	const tmpPath = path.join(tmpDir, filename);
	const destPath = path.join(destDir, filename);
	const normalized = ensureBlankLineAfterImports(options.content);

	fs.writeFileSync(tmpPath, normalized, "utf-8");
	fs.writeFileSync(destPath, normalized, "utf-8");

	return { tmpPath, destPath };
}
