import { codeToHtml, type BundledLanguage } from "shiki";

const DEFAULT_THEME = "github-dark-dimmed";

type CodeToHtmlOptions = Parameters<typeof codeToHtml>[1];

export interface HighlightCodeOptions extends Omit<CodeToHtmlOptions, "lang" | "theme"> {
	code: string;
	lang: string;
	defaultColor?: "light" | "dark";
}

export async function highlightCodeToHtml({
	code,
	lang,
	...options
}: HighlightCodeOptions): Promise<string> {
	try {
		return await codeToHtml(code, {
			...options,
			lang: lang as BundledLanguage,
			theme: DEFAULT_THEME,
		} as CodeToHtmlOptions);
	} catch (error) {
		console.warn(`[shiki] Falling back to plaintext for "${lang}".`, error);
		return codeToHtml(code, {
			...options,
			lang: "plaintext",
			theme: DEFAULT_THEME,
		} as CodeToHtmlOptions);
	}
}
