/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly WEBMENTION_API_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// GLightbox instance for dynamic reloading
interface Window {
	lightboxInstance?: {
		reload: () => void;
	};
	PagefindHighlight: new (options: { highlightParam: string }) => unknown;
}
