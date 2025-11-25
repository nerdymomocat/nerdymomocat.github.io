import type { ShikiHighlighter, ShikiHighlighterHighlightOptions } from "@astrojs/markdown-remark";
import { createShikiHighlighter } from "@astrojs/markdown-remark";

const DEFAULT_THEME = "github-dark-dimmed";

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

async function getHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = createShikiHighlighter({
			theme: DEFAULT_THEME,
		});
	}

	return highlighterPromise;
}

export interface HighlightCodeOptions extends ShikiHighlighterHighlightOptions {
	code: string;
	lang: string;
}

export async function highlightCodeToHtml({
	code,
	lang,
	...options
}: HighlightCodeOptions): Promise<string> {
	const highlighter = await getHighlighter();

	try {
		return await highlighter.codeToHtml(code, lang, options);
	} catch (error) {
		console.warn(`[shiki] Falling back to plaintext for "${lang}".`, error);
		return highlighter.codeToHtml(code, "plaintext", options);
	}
}
