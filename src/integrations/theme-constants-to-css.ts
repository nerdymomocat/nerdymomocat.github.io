import fs from "node:fs";
import type { AstroIntegration } from "astro";
import JSON5 from "json5";

const configContent = fs.readFileSync("./constants-config.json5", "utf8");
const config = JSON5.parse(configContent);
const key_value_from_json = { ...config };
const theme_config = key_value_from_json["theme"];

// Helper function that normalizes a color string to hex format
function normalizeColor(value: string): string {
	// If it's already a hex color (3 or 6 digits), return it directly.
	if (/^#([0-9A-F]{3}){1,2}$/i.test(value)) {
		return value;
	}
	// Otherwise assume it's a space-separated RGB string
	const parts = value.trim().split(/\s+/).map(Number);
	if (parts.length >= 3) {
		const toHex = (num: number): string => {
			const hex = num.toString(16);
			return hex.length === 1 ? "0" + hex : hex;
		};
		return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`;
	}
	// If the format is unexpected, return the original value as a fallback
	return value;
}

export default (): AstroIntegration => ({
	name: "theme-constants-to-css",
	hooks: {
		"astro:build:start": async () => {
			// Use CSS variables that will be populated by Astro's Font API
			// If Font API isn't configured, fall back to system fonts
			const fontSans = "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)";
			const fontSerif = "var(--font-serif, ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif)";
			const fontMono = "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace)";

			const isMarkdownEnabled = key_value_from_json["block-rendering"]?.["process-content-to-markdown"] === true;
			const tocContainerBottom = isMarkdownEnabled ? "bottom-52" : "bottom-40";
			const bottomTocButtonBottom = isMarkdownEnabled ? "bottom-20" : "bottom-8";
			const toTopBtnBottom = isMarkdownEnabled ? "bottom-32" : "bottom-20";
			const copyBtnPosition = isMarkdownEnabled ? "end-4 bottom-8" : "start-4 bottom-8";

			const customColors = {
				ngray: {
					"txt-light": "#787774",
					"txt-dark": "#9B9B9B",
					"bg-light": "#F1F1EF",
					"bg-dark": "#2F2F2F",
					"bg-tag-light": "#E3E2E0",
					"bg-tag-dark": "#5A5A5A",
					"table-header-bg-light": "#F7F6F3",
					"table-header-bg-dark": "#FFFFFF",
					"callout-border-light": "#DFDFDE",
					"callout-border-dark": "#373737",
				},
				nlgray: {
					"bg-tag-light": "#F1F1F0",
					"bg-tag-dark": "#373737",
				},
				nbrown: {
					"txt-light": "#9F6B53",
					"txt-dark": "#BA856F",
					"bg-light": "#F4EEEE",
					"bg-dark": "#4A3228",
					"bg-tag-light": "#EEE0DA",
					"bg-tag-dark": "#603B2C",
				},
				norange: {
					"txt-light": "#D9730D",
					"txt-dark": "#C77D48",
					"bg-light": "#FBECDD",
					"bg-dark": "#5C3B23",
					"bg-tag-light": "#FADEC9",
					"bg-tag-dark": "#854C1D",
				},
				nyellow: {
					"txt-light": "#CB912F",
					"txt-dark": "#CA9849",
					"bg-light": "#FBEDD6",
					"bg-dark": "#56452F",
					"bg-tag-light": "#F9E4BC",
					"bg-tag-dark": "#835E33",
				},
				ngreen: {
					"txt-light": "#448361",
					"txt-dark": "#529E72",
					"bg-light": "#EDF3EC",
					"bg-dark": "#243D30",
					"bg-tag-light": "#DBEDDB",
					"bg-tag-dark": "#2B593F",
				},
				nblue: {
					"txt-light": "#337EA9",
					"txt-dark": "#5E87C9",
					"bg-light": "#E7F3F8",
					"bg-dark": "#143A4E",
					"bg-tag-light": "#D3E5EF",
					"bg-tag-dark": "#28456C",
				},
				npurple: {
					"txt-light": "#9065B0",
					"txt-dark": "#9D68D3",
					"bg-light": "#F7F3F8",
					"bg-dark": "#3C2D49",
					"bg-tag-light": "#E8DEEE",
					"bg-tag-dark": "#492F64",
				},
				npink: {
					"txt-light": "#C14C8A",
					"txt-dark": "#9D68D3",
					"bg-light": "#FBF2F5",
					"bg-dark": "#4E2C3C",
					"bg-tag-light": "#F5E0E9",
					"bg-tag-dark": "#69314C",
				},
				nred: {
					"txt-light": "#D44C47",
					"txt-dark": "#DF5452",
					"bg-light": "#FDEBEC",
					"bg-dark": "#522E2A",
					"bg-tag-light": "#FFE2DD",
					"bg-tag-dark": "#6E3630",
				},
			};

			let colorDefinitions = "";
			for (const [group, shades] of Object.entries(customColors)) {
				for (const [shade, value] of Object.entries(shades)) {
					colorDefinitions += `  --color-${group}-${shade}: ${value};\n`;
				}
			}

			const createCssVariables = (theme) => {
				let cssContent = "";
				let bgHex = "#ffffff";

				for (const key in theme_config.colors) {
					let color = theme_config.colors[key][theme];
					let cssValue;
					// If no color is defined, use defaults in hex format
					if (!color) {
						cssValue = key.includes("bg")
							? theme === "light" ? "#ffffff" : "#000000"
							: theme === "light" ? "#000000" : "#ffffff";
					} else {
						// Normalize the provided color value to hex
						cssValue = normalizeColor(color);
					}

					if (key === "bg") bgHex = cssValue;

					cssContent += `    --theme-${key}: ${cssValue};\n`;
				}

				// Compute popover-bg based on bg color
				const refHex =
					parseInt(bgHex.slice(5, 7), 16) > parseInt(bgHex.slice(1, 3), 16)
						? theme === "light" ? "#D2E7F7" : "#acd5e7" // cool
						: theme === "light" ? "#FBE4CE" : "#F3C699"; // warm

				const mix = (v1: string, v2: string) =>
					Math.round(0.9 * parseInt(v1, 16) + 0.1 * parseInt(v2, 16))
						.toString(16)
						.padStart(2, "0");

				const popoverHex = `#${mix(bgHex.slice(1, 3), refHex.slice(1, 3))}${mix(bgHex.slice(3, 5), refHex.slice(3, 5))}${mix(bgHex.slice(5, 7), refHex.slice(5, 7))}`;
				cssContent += `    --theme-popover-bg: ${popoverHex};`;

				return cssContent;
			};

			const cssContent = `@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: ${fontSans};
  --font-serif: ${fontSerif};
  --font-mono: ${fontMono};
  --color-bgColor: var(--theme-bg);
  --color-textColor: var(--theme-text);
  --color-link: var(--theme-link);
  --color-accent: var(--theme-accent);
  --color-accent-2: var(--theme-accent-2);
  --color-quote: var(--theme-quote);
  --color-popover-bg: var(--theme-popover-bg);
${colorDefinitions}
}

@layer base {
  :root {
    color-scheme: light;
${createCssVariables("light")}
  }

  :root.dark {
    color-scheme: dark;
${createCssVariables("dark")}
  }

  html {
    @apply scroll-smooth;
    font-size: 14px;

    @variant sm {
      font-size: 16px;
    }
  }

  html body {
    @apply mx-auto flex min-h-screen max-w-3xl flex-col bg-bgColor px-8 pt-8 text-textColor antialiased overflow-x-hidden;
  }

  * {
    @apply scroll-mt-10
  }

  pre {
    @apply rounded-md p-4 font-mono;
  }

  /* Common styles for pre elements */
  pre.has-diff,
  pre.has-focused,
  pre.has-highlighted,
  pre.has-diff code,
  pre.has-focused code,
  pre.has-highlighted code {
    @apply inline-block min-w-full;
  }

  /* Styles for diff lines */
  pre.has-diff .line.diff,
  pre.has-highlighted .line.highlighted.error,
  pre.has-highlighted .line.highlighted.warning {
    @apply inline-block w-max min-w-[calc(100%+2rem)] -ml-8 pl-8 pr-4 box-border relative z-0;
  }

  pre.has-diff .line.diff::before {
    @apply content-[''] absolute left-4 top-0 bottom-0 w-4 flex items-center justify-center text-gray-400;
  }

  pre.has-diff .line.diff.remove {
    @apply bg-red-500/20;
  }

  pre.has-diff .line.diff.remove::before {
    @apply content-['-'];
  }

  pre.has-diff .line.diff.add {
    @apply bg-blue-500/20;
  }

  pre.has-diff .line.diff.add::before {
    @apply content-['+'];
  }

  /* Styles for focused lines */
  pre.has-focused .line {
    @apply inline-block w-max min-w-[calc(100%+2rem)] -ml-4 pl-4 pr-4 box-border transition-all duration-300 ease-in-out;
  }

  pre.has-focused .line:not(.focused) {
    @apply blur-[1px] opacity-50;
  }

  pre.has-focused:hover .line:not(.focused) {
    @apply blur-none opacity-100;
  }

  /* Styles for highlighted lines */
  pre.has-highlighted .line.highlighted {
    @apply inline-block w-max min-w-[calc(100%+2rem)] -ml-4 pl-4 pr-4 box-border bg-gray-500/20;
  }

  /* Styles for highlighted words */
  .highlighted-word {
    @apply bg-gray-500/20 rounded px-1 -mx-[2px];
  }

  pre.has-highlighted .line.highlighted.error::before,
  pre.has-highlighted .line.highlighted.warning::before {
    @apply content-[''] absolute left-4 top-0 bottom-0 w-4 flex items-center justify-center text-gray-400;
  }

  pre.has-highlighted .line.highlighted.error {
    @apply bg-red-500/30;
  }

  pre.has-highlighted .line.highlighted.error::before {
    @apply content-['x'];
  }

  pre.has-highlighted .line.highlighted.warning {
    @apply bg-yellow-500/20;
  }

  pre.has-highlighted .line.highlighted.warning::before {
    @apply content-['!'];
  }
}

@layer components {
  .site-page-link {
    @apply underline decoration-wavy decoration-from-font decoration-accent-2/40 hover:decoration-accent-2/60 underline-offset-2;
  }

  .title {
    @apply text-3xl font-bold text-accent-2;
  }

  .notion-h1 {
    @apply mt-8 mb-1 cursor-pointer text-2xl font-semibold;
  }

  .notion-h2 {
    @apply mt-6 mb-1 cursor-pointer text-xl font-semibold;
  }

  .notion-h3 {
    @apply mt-4 mb-1 cursor-pointer text-lg font-semibold;
  }

  .notion-text {
    @apply my-1 min-h-7;
  }

  .notion-list-ul {
    @apply list-outside list-disc space-y-1 pl-6;
  }

  .notion-list-ol {
    @apply list-outside space-y-1 pl-6;
  }

  .notion-list-item-colored {
    @apply rounded-sm px-1;
  }

  /* Column List */
  .notion-column-list {
    @apply mx-auto my-4 block w-full max-w-full flex-wrap gap-x-4 sm:flex md:flex-nowrap;
  }

  .notion-column-list > .ncolumns {
    @apply w-full max-w-full min-w-0 flex-1 basis-44 sm:w-44 md:w-auto;
  }

  /* Divider */
  .divider {
    @apply bg-accent/30 mx-auto my-4 h-0.5 w-full rounded-sm border-none;
  }

  .notion-divider {
    @apply bg-accent-2/10 mx-auto my-4 h-0.5 w-full rounded-sm border-none;
  }

  /* Table */
  .ntable {
    @apply relative max-w-full table-auto overflow-x-auto pb-2;
  }

  .ntable table {
    @apply w-full text-left text-sm text-textColor/90;
  }

  .ntable th {
    @apply bg-ngray-table-header-bg-light text-textColor/90 dark:bg-ngray-table-header-bg-dark/[.03] p-2 text-xs font-semibold uppercase border-b border-gray-200/90 dark:border-gray-700/90;
  }

  .ntable table.datatable th {
    @apply font-bold;
  }

  .ntable .table-row-header {
    @apply whitespace-nowrap;
  }

  .ntable td {
    @apply p-2;
  }

  .ntable tr {
     @apply border-b border-gray-200/90 dark:border-gray-700/90;
  }

  /* Bookmark */
  .bookmark {
    @apply pb-2;
  }

  .bookmark-link-container {
    @apply flex w-full max-w-full overflow-hidden text-sm;
  }

  .bookmark-card {
    @apply flex w-full max-w-full min-w-0 grow items-stretch overflow-hidden rounded-sm border border-gray-200 no-underline select-none dark:border-gray-800;
  }

  .bookmark-text {
    @apply text-textColor/90 overflow-hidden p-3 text-left flex-[4_1_180px];
  }

  .bookmark-title {
    @apply mb-0.5 h-6 truncate overflow-hidden leading-5 whitespace-nowrap;
  }

  .bookmark-description {
    @apply h-8 overflow-hidden text-xs leading-4 opacity-80;
  }

  .bookmark-caption-container {
     @apply mt-1.5 flex max-w-full items-baseline;
  }

  .bookmark-icon-container {
    @apply mr-1.5 h-4 w-4 min-w-4;
  }

  .bookmark-link {
    @apply truncate overflow-hidden text-xs leading-4 whitespace-nowrap;
  }

  .bookmark-image-container {
    @apply relative hidden sm:block flex-[1_1_180px];
  }

  /* Code */
  .code {
    @apply relative z-0 mb-1 w-full max-w-full text-sm;
  }

  .code-scroll {
     @apply max-h-[340px] overflow-scroll print:max-h-full min-w-0;
  }

  .code-mermaid {
     @apply overflow-x-scroll max-h-none min-w-0;
  }

  .code button[data-code] {
    @apply absolute top-0 right-0 z-10 cursor-pointer border-none p-2 text-gray-500 sm:opacity-100 md:opacity-0 md:transition-opacity md:duration-200 md:group-hover:opacity-100 print:hidden;
  }

  /* Quote */
  .nquote {
    @apply my-4 border-s-4 border-gray-600 px-2! dark:border-gray-300;
  }

  .quote-children {
    @apply p-1;
  }

  /* Callout */
  .callout {
    @apply mx-auto my-2 flex w-full max-w-full rounded px-3 py-4 leading-6;
  }

  .callout-icon {
    @apply m-0 mr-2 leading-6;
  }

  .callout-content {
    @apply m-0 min-w-0 leading-6;
  }

  .callout-content.simple > :first-child {
    @apply mt-0;
  }

  /* Toggle */
  .toggle {
    @apply my-1;
  }

  .toggle-colored {
    @apply rounded-sm px-1;
  }

  .toggle-summary {
    @apply flex max-w-full cursor-pointer list-none list-image-none gap-2;
  }

  .toggle-summary::-webkit-details-marker {
    display: none;
  }

  details.toggle[open] .toggle-icon-box > .rotate-svg {
    @apply rotate-90;
  }

  /* ToDo */
  .to-do {
    @apply pl-2 leading-7;
  }

  .todo-container {
     @apply gap-2;
  }

  .todo-item {
    @apply flex max-w-full items-start;
  }

  .todo-item-colored {
    @apply rounded-sm px-1;
  }

  .todo-checkbox-wrapper {
    @apply mt-1 pr-2;
  }

  .todo-text {
    @apply min-w-0 flex-1;
  }

  .todo-checkbox-icon {
    @apply text-textColor/50 h-5 w-5;
  }


  /* Tags */
  .notion-tag {
    @apply inline-block rounded-md px-1 text-sm;
  }

  /* Count Badge (for tags and authors) */
  .count-badge {
    @apply ml-2 rounded-sm bg-gray-100 px-2 py-0.5 text-rose-800 dark:bg-gray-800 dark:text-rose-300;
  }

  /* Image */
  .notion-image-figure {
    @apply mx-auto mt-1 max-w-full;
  }

  .notion-image-container {
    @apply mx-auto min-w-0;
  }

  .notion-image {
    @apply block max-w-full rounded-md;
  }

  /* File */
  .notion-file-container {
    @apply border-accent-2/20 hover:border-accent/40 inline-flex max-w-full rounded-lg border p-1;
  }

  .notion-file-link {
    @apply underline decoration-wavy decoration-from-font decoration-accent-2/40 hover:decoration-accent-2/60 underline-offset-2 text-link inline-flex max-w-full items-center justify-center rounded-lg text-sm;
  }

  .notion-file-preview {
    @apply decoration-accent-2/20 hover:decoration-accent/40 ml-2 inline-flex max-w-full items-center justify-center text-sm underline decoration-wavy hidden sm:inline;
  }

  /* TOC */
  .toc-container {
    @apply fixed top-auto right-4 ${tocContainerBottom} z-10 block sm:top-40 sm:bottom-auto print:hidden;
  }

  .visual-container {
    @apply bg-bgColor absolute top-6 right-0 hidden w-8 flex-col items-end space-y-2 overflow-hidden p-2 transition-opacity duration-500 sm:flex;
  }

  .toc-content {
    @apply border-accent/10 bg-bgColor shadow-accent/5 absolute right-1 bottom-0 max-h-[55vh] w-60 overflow-y-auto rounded-xl border p-2 shadow-xl transition-all duration-200 sm:top-0 sm:bottom-auto sm:max-h-[68vh];
  }

  .bottom-toc-button {
    @apply fixed end-4 ${bottomTocButtonBottom} z-30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-transparent bg-zinc-200 text-3xl transition-all duration-300 hover:border-zinc-400 sm:hidden dark:bg-zinc-700 print:hidden;
  }

  /* Social List */
  .social-link {
    @apply sm:hover:text-link inline-block p-1;
  }

  /* Post Preview */
  a[aria-label="Visit external site"] {
    @apply border-quote/60 text-quote hover:border-quote/80 hover:text-quote mr-2 inline-flex items-center gap-1 rounded border px-2 py-[2px] text-[11px] font-semibold tracking-wider uppercase transition;
  }

  [aria-label="Pinned Post"] {
    @apply me-1 inline-block h-6 w-6;
  }

  /* To-Top Button */
  .to-top-btn {
    @apply fixed end-4 ${toTopBtnBottom} z-30 flex h-10 w-10 translate-y-28 cursor-pointer items-center justify-center rounded-full border-2 border-transparent bg-zinc-200 text-3xl opacity-0 transition-all duration-300 hover:border-zinc-400 data-[show=true]:translate-y-0 data-[show=true]:opacity-100 sm:end-8 sm:bottom-8 sm:h-12 sm:w-12 dark:bg-zinc-700 print:hidden;
  }

  /* Copy Markdown Button */
  .copy-floating-btn {
    @apply fixed z-40 flex items-center justify-center print:hidden ${copyBtnPosition};
  }

  @variant sm {
    .copy-floating-btn {
      @apply h-auto w-auto bottom-auto left-auto right-4 top-[7.5rem];
    }
  }

  .copy-markdown-btn {
    @apply inline-flex items-center gap-1 transition disabled:opacity-60 disabled:cursor-not-allowed h-10 w-10 rounded-full border border-accent/30 bg-bgColor/90 text-textColor shadow-lg flex items-center justify-center hover:border-accent/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60 cursor-pointer backdrop-blur-md dark:bg-bgColor/80 dark:border-accent/25;
  }

  .copy-markdown-btn[data-copy-state="success"] {
    @apply border-green-500/60 dark:border-green-400/60;
  }

  .copy-markdown-btn[data-copy-state="error"] {
    @apply border-red-500/50 dark:border-red-400/60;
  }

  /* Theme Icon */
  .theme-toggle-btn {
    @apply hover:text-accent hover:ring-accent relative h-10 w-10 cursor-pointer rounded-md p-2 transition-all hover:ring-2;
  }

  .theme-icon {
    @apply absolute top-1/2 left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 scale-0 opacity-0 transition-all;
  }

  /* Annotations */
  .anchor-link-dashed {
    @apply text-link decoration-accent-2/40 underline decoration-dashed underline-offset-2;
  }

  /* Author Byline */
  .author-name-link {
    @apply text-link underline decoration-wavy decoration-from-font decoration-accent-2/40 hover:decoration-accent-2/80 underline-offset-2 transition-all;
  }

  .author-icon-link {
    @apply text-link inline-flex items-center transition-all hover:scale-110 hover:text-accent;
  }

  .annotation-code {
    @apply rounded-sm border-none px-1 font-mono;
  }

  .annotation-code.bg-default {
    @apply bg-gray-100 dark:bg-gray-800;
  }

  .annotation-code.text-default {
    @apply text-rose-800 dark:text-rose-300;
  }

  /* Recent Posts */
  #auto-recent-posts {
    @apply relative mt-8 mb-4 cursor-pointer text-2xl font-normal;
  }

  #auto-recent-posts::before {
    content: "#";
    position: absolute;
    color: color-mix(in srgb, var(--color-accent) 50%, transparent);
    margin-left: -1.5rem;
    display: inline-block;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  #auto-recent-posts:hover::before {
    opacity: 1;
  }

  #auto-recent-posts + section ul {
    @apply space-y-4 text-start;
  }

  #auto-recent-posts + section ul li {
    @apply flex max-w-full flex-col flex-wrap gap-1.5 [&_q]:basis-full;
  }

  /* Auto-generated Section Headers & Dividers */
  .auto-imported-section {
    @apply mt-12;
  }

  .auto-imported-section > hr {
    @apply bg-accent/30 mx-auto my-4 h-0.5 w-full rounded-sm border-none;
  }

  .non-toggle-h2 {
    @apply relative mb-4 cursor-pointer text-2xl font-normal;
  }

  .non-toggle-h2::before {
    content: "#";
    position: absolute;
    color: color-mix(in srgb, var(--color-accent) 50%, transparent);
    margin-left: -1.5rem;
    display: inline-block;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .non-toggle-h2:hover::before {
    opacity: 1;
  }

  /* Anchor Links (hasId) */
  .hasId {
    @apply relative;
  }

  .hasId::before {
    content: "#";
    position: absolute;
    color: color-mix(in srgb, var(--color-accent) 50%, transparent);
    margin-left: -1.5rem;
    display: inline-block;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .hasId:hover::before {
    opacity: 1;
  }

  .hasId.toggle-heading::before {
    margin-left: -2.5rem;
  }

  .noId::before {
    display: none;
  }

  /* Toggles */
  .toggle > summary::-webkit-details-marker {
    display: none;
  }

  details.toggle[open] > summary > div > .rotate-svg {
    @apply rotate-90;
  }

  .toggle-heading-1 {
    @apply mt-8 mb-0;
  }

  .toggle-heading-2 {
    @apply mt-6 mb-1;
  }

  .toggle-heading-3 {
    @apply mt-4 mb-1;
  }

  /* Pagination */
  .pagination-nav {
    @apply mt-8 flex items-center gap-x-4;
  }

  .pagination-nav > a {
    @apply text-link py-2 no-underline hover:underline hover:underline-offset-4;
  }

  .pagination-nav > .prev-link {
    @apply me-auto;
  }

  .pagination-nav > .next-link {
    @apply ms-auto;
  }

  /* TOC Visibility for Auto-generated Sections */
  #-tocid--autogenerated-footnotes,
  #-vistocid--autogenerated-footnotes,
  #-tocid--autogenerated-bibliography,
  #-vistocid--autogenerated-bibliography,
  #-tocid--autogenerated-interlinked-content,
  #-vistocid--autogenerated-interlinked-content,
  #-tocid--autogenerated-cite-this-page,
  #-vistocid--autogenerated-cite-this-page {
    @apply !block;
  }

  #-bottomtocid--autogenerated-footnotes,
  #-bottomtocid--autogenerated-bibliography,
  #-bottomtocid--autogenerated-interlinked-content,
  #-bottomtocid--autogenerated-cite-this-page {
    @apply !inline;
  }

  .footnote-content {
    @apply inline;
  }

  /* CSS counter for IEEE style numbering */
  .bibliography-ieee {
    counter-reset: citation-counter;
  }

  .bibliography-ieee li {
    @apply flex items-baseline;
    counter-increment: citation-counter;
  }

  .bibliography-ieee li::before {
    content: "[" counter(citation-counter) "] ";
    font-weight: 400;
    margin-right: 0.5rem;
    font-family: monospace;
    flex-shrink: 0;
  }

  /* Footnotes Internal */
  .footnote-list {
    @apply list-none;
  }
  .footnote-item {
    @apply flex items-baseline gap-2;
  }
  .footnote-marker {
    @apply text-accent-2/60 shrink-0 font-mono text-sm;
  }

  /* Bibliography Internal */
  .bibliography-list {
    @apply space-y-2 list-none;
  }
  .bibliography-item {
    @apply relative;
  }
  .citation-back-btn {
    @apply absolute left-0 -translate-x-full -ml-2 top-0 opacity-0 pointer-events-none w-4 h-4 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center transition-all duration-200 cursor-pointer;
  }
  li[data-show-back-button="true"] .citation-back-btn {
    @apply opacity-100 pointer-events-auto;
  }
  .citation-entry {
    @apply inline;
  }
  .citation-backlinks {
    @apply ml-1;
  }

  /* Header */
  .site-header {
    @apply relative mb-8 flex w-full items-center justify-between sm:ps-[4.5rem] lg:-ml-[25%] lg:w-[150%];
  }
  .nav-menu {
    @apply bg-bgColor/90 text-accent absolute -inset-x-4 top-14 hidden flex-col items-end rounded-md py-2 text-base shadow-sm backdrop-blur-sm group-[.menu-open]:z-50 group-[.menu-open]:flex sm:static sm:z-auto sm:-ms-4 sm:mt-1 sm:flex sm:flex-row sm:items-center sm:rounded-none sm:py-0 sm:text-sm sm:shadow-none sm:backdrop-blur-none lg:text-base print:hidden;
  }
  .nav-link {
    @apply sm:hover:decoration-accent-2/40 w-full px-4 py-4 text-right underline-offset-4 sm:w-auto sm:py-0 sm:text-left sm:hover:underline sm:hover:decoration-wavy;
  }

  /* Footer */
  .site-footer {
    @apply text-accent-2 mt-auto flex w-full flex-col items-center justify-center gap-y-2 pt-20 pb-4 text-center align-top text-sm sm:flex-row sm:justify-between lg:-ml-[25%] lg:w-[150%];
  }
  .footer-nav {
    @apply flex flex-wrap gap-x-2 rounded-sm border-t-2 border-b-2 border-gray-200 sm:gap-x-0 sm:divide-x sm:divide-gray-300 sm:border-none dark:border-gray-700 dark:sm:divide-gray-700 print:hidden;
  }
  .footer-link {
    @apply sm:hover:text-accent-2 px-4 py-2 underline-offset-4 sm:px-2 sm:py-0 sm:hover:underline;
  }

  /* Equation */
  .equation {
    @apply max-w-full overflow-x-auto overscroll-none text-center;
  }

  /* Caption */
  .caption {
    @apply text-textColor/70 min-w-0 pt-1 text-sm;
  }

  /* Search */
  .search-btn {
    @apply hover:text-accent hover:ring-accent flex h-10 w-10 cursor-pointer items-center justify-center rounded-md transition-all hover:ring-2;
  }

  .search-dialog {
    @apply bg-bgColor/80 h-full max-h-full w-full max-w-full border border-zinc-400 shadow-sm backdrop:backdrop-blur-sm sm:mx-auto sm:mt-16 sm:mb-auto sm:h-max sm:max-h-[calc(100%-8rem)] sm:min-h-[15rem] sm:w-5/6 sm:max-w-[48rem] sm:rounded-lg;
  }

  .search-frame {
    @apply flex flex-col gap-4 p-6 pt-12 sm:pt-6;
  }

  .search-close-btn {
    @apply ms-auto cursor-pointer rounded-md bg-zinc-200 p-2 font-semibold dark:bg-zinc-700;
  }

  /* Code Render/Inject */
  .code-rendered {
    @apply mb-1 w-full max-w-full;
  }

  .code-injected {
    @apply mb-1 max-w-full;
  }

  .code-iframe {
    @apply h-[340px] w-full max-w-full rounded-lg border-none print:max-h-full;
  }

  .code .mermaid {
    @apply max-w-full rounded-sm p-4 font-mono;
  }

  /* External MDX Content */
  .mdx-notion {
    @apply max-w-none;
  }

  .mdx-notion h1,
  .mdx-notion h2,
  .mdx-notion h3 {
    @apply font-bold text-textColor tracking-[-0.01em] mt-5 mb-3;
  }

  .mdx-notion h1 {
    font-size: clamp(1.8rem, 2.6vw, 2.05rem);
    line-height: 1.2;
  }

  .mdx-notion h2 {
    font-size: clamp(1.45rem, 2.3vw, 1.8rem);
    line-height: 1.25;
  }

  .mdx-notion h3 {
    font-size: clamp(1.2rem, 2vw, 1.55rem);
    line-height: 1.3;
  }

  .mdx-notion p {
    @apply mt-0 ml-0 mb-[0.9rem] text-base leading-[1.75] text-textColor;
  }

  .mdx-notion ul,
  .mdx-notion ol {
    @apply my-[0.2rem] mb-[1rem] ms-[1.25rem] ps-[1.25rem] leading-[1.65] list-outside;
  }

  .mdx-notion ul {
    @apply list-disc;
  }

  .mdx-notion ol {
    @apply list-decimal;
  }

  .mdx-notion li {
    @apply my-[0.1rem] ps-[0.1rem];
  }

  .mdx-notion blockquote {
    @apply my-[1.1rem] px-4 py-3 rounded-r-lg;
    border-left: 4px solid var(--theme-quote);
    background-color: color-mix(in srgb, var(--theme-quote) 8%, transparent);
  }

  .mdx-notion code {
    /* Match Notion inline code styling */
    @apply font-mono rounded-sm px-1 py-[0.15rem] text-[0.95rem] bg-gray-100 text-rose-800 dark:bg-gray-800 dark:text-rose-300;
  }

  .mdx-notion pre {
    @apply font-mono px-4 py-4 rounded-2xl overflow-x-auto my-[1.1rem];
  }

  /* Keep block code un-tinted while preserving inline styling */
  .mdx-notion pre code {
    @apply bg-transparent p-0 rounded-none;
  }

  .mdx-notion a {
    @apply text-accent underline decoration-wavy decoration-1 underline-offset-[3px] transition-colors duration-200;
  }

  .mdx-notion a:hover {
    @apply text-accent-2;
  }
}

  /* Pagefind Overrides */
  :root {
    --pagefind-ui-font: inherit;
  }

  #webtrotion__search .pagefind-ui__search-clear {
    @apply p-0 bg-transparent overflow-hidden;
    width: calc(60px * var(--pagefind-ui-scale));
  }
  #webtrotion__search .pagefind-ui__search-clear:focus {
    outline: 1px solid var(--color-accent-2);
  }
  #webtrotion__search .pagefind-ui__search-clear::before {
    content: "";
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'  %3E%3Cpath d='M6 5v.18L8.82 8h2.4l-.72 1.68l2.1 2.1L14.21 8H20V5H6M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21L18 19.73L3.55 5.27L3.27 5Z'%3E%3C/path%3E%3C/svg%3E") center / 60% no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' %3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 5v.18L8.82 8h2.4l-.72 1.68l2.1 2.1L14.21 8H20V5H6M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21L18 19.73L3.55 5.27L3.27 5Z'%3E%3C/path%3E%3C/svg%3E") center / 60% no-repeat;
    background-color: var(--color-accent);
    display: block;
    width: 100%;
    height: 100%;
  }

  #webtrotion__search .pagefind-ui__result {
    @apply p-3 border-0 overflow-x-hidden;
  }
  @media (max-width: 640px) {
    #webtrotion__search .pagefind-ui__drawer {
      @apply !gap-3;
    }
  }

  #webtrotion__search .pagefind-ui__result-link {
    background-size: 100% 6px;
    background-position: bottom;
    background-repeat: repeat-x;
    background-image: linear-gradient(transparent, transparent 5px, var(--color-textColor) 5px, var(--color-textColor));
  }

  #webtrotion__search .pagefind-ui__result-link:hover {
    @apply no-underline;
    background-image: linear-gradient(transparent, transparent 4px, var(--color-link) 4px, var(--color-link));
  }

  #webtrotion__search mark {
    @apply text-quote bg-transparent font-semibold;
  }

  #webtrotion__search {
    --pagefind-ui-primary: var(--color-accent);
    --pagefind-ui-text: var(--color-textColor);
    --pagefind-ui-background: var(--color-bgColor);
    --pagefind-ui-border: var(--color-zinc-400);
    --pagefind-ui-border-width: 1px;
  }

@utility transition-height {
  @apply transition-[height];
}



.popoverEl {
  @apply left-0 top-0 max-w-[calc(100vw-10px)];
}

.footnote-margin-note.highlighted {
  @apply opacity-100 text-textColor;
}

[data-margin-note].highlighted {
  background-color: color-mix(in srgb, var(--color-accent) 20%, transparent);
  @apply rounded px-[2px] -mx-[2px];
  /* This prevents the padding from shifting surrounding text */
}

.footnote-margin-note> :first-child > :nth-child(2) {
  @apply !inline !mt-0;
}

.footnote-margin-note.highlighted > :first-child > :first-child {
  background-color: color-mix(in srgb, var(--color-accent) 20%, transparent);
  @apply rounded px-[2px] -mx-[2px];
  /* Prevents padding from shifting text */
  color: var(--color-quote);
  /* Keep the quote color for the number */
}

@media (max-width: 1023px) {
  .footnote-margin-note {
    @apply hidden;
  }
}

@media (min-width: 1024px) {
  .footnote-margin-note {
    @apply block;
  }

  .post-body {
    @apply relative;
  }
}

.post-preview-full-container .footnote-margin-note,
.post-preview-full-container .cite-this-page-section,
.post-preview-full-container .bibliography-section,
.post-preview-full-container .footnotes-section,
.post-preview-full-container .jump-to-bibliography {
  @apply !hidden
}

.datatable-input {
  @apply w-full box-border rounded-md border border-[#ccc] px-[6px] py-[3px] text-sm transition-all duration-300 ease-in-out;
}

.datatable-input:focus {
  @apply border-[#007bff] outline-none ring-[0.2rem] ring-[rgba(0,123,255,0.25)];
}

.filter-toggle {
  @apply bg-none border-none text-[20px] cursor-pointer px-[10px] transition-all duration-300 ease-in-out;
}

.filter-toggle:hover {
  @apply opacity-70;
}

.filter-row,
.search-inputs {
  @apply transition-all duration-300 ease-in-out max-h-[50px] opacity-100 overflow-hidden;
}

.filter-row.hide,
.search-inputs.hide {
  @apply max-h-0 hidden opacity-0 pt-0 pb-0 mt-0 mb-0;
}

.datatable-top {
  @apply flex flex-wrap justify-between items-center p-1 mb-[10px];
}

.datatable-top-left {
  @apply flex items-center flex-grow;
}

.datatable-info {
  @apply text-sm font-mono transition-all duration-300 ease-in-out whitespace-nowrap;
}

.datatable-sorter {
  @apply relative pr-4 bg-transparent;
  /* Reserve enough space for the sort icons */
}

.datatable-sorter::after {
  border-bottom-color: var(--color-accent) !important;
  top: -2px !important;
}

.datatable-sorter::before {
  border-top-color: var(--color-accent) !important;
}

.datatable-table>tbody>tr>td,
.datatable-table>tbody>tr>th,
.datatable-table>tfoot>tr>td,
.datatable-table>tfoot>tr>th,
.datatable-table>thead>tr>td,
.datatable-table>thead>tr>th {
  padding: calc(var(--spacing) * 2);
}

html.dark :not(.datatable-ascending):not(.datatable-descending)>.datatable-sorter::after,
html.dark :not(.datatable-ascending):not(.datatable-descending)>.datatable-sorter::before {
  opacity: 0.3 !important;
}

.datatable-wrapper .datatable-container {
  border: none !important;
}

.datatable-table>thead>tr>th {
  border-bottom-color: rgba(229, 231, 235, 0.9);
}

.dark .datatable-table>thead>tr>th {
  border-bottom-color: rgba(55, 65, 81, 0.9);
}

@media (max-width: 640px) {
  .datatable-top {
    @apply flex-nowrap;
  }

  .datatable-top-left {
    @apply w-auto mb-0;
  }

  .datatable-info {
    @apply pl-2;
  }

  .datatable-top.filter-active {
    @apply flex-col items-stretch;
  }

  .datatable-top.filter-active .datatable-top-left {
    @apply w-full mb-2;
  }

  .datatable-top.filter-active .datatable-info {
    @apply w-full pr-2 text-right;
  }
}

/* Gallery Grid Layout - 1 col sm, 2 cols md, 3 cols lg */
.gallery-grid {
  @apply grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3;
}

/* Post Card for Gallery View */
.post-card {
  @apply relative overflow-hidden rounded-lg border bg-bgColor transition-[box-shadow,transform,border-color] duration-200 ease-in-out;
  border-color: color-mix(in srgb, var(--color-textColor) 10%, transparent);
}

.post-card:hover {
  @apply -translate-y-[2px];
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-textColor) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
}

/* Card link - covers entire card */
.post-card-link {
  @apply block no-underline text-inherit;
}

/* Image container with 3:2 aspect ratio */
.post-card-image-container {
  @apply relative overflow-hidden aspect-[3/2];
}

.post-card-image {
  @apply h-full w-full object-cover transition-transform duration-300 ease-in-out;
}

.post-card:hover .post-card-image {
  @apply scale-105;
}

.post-card-placeholder {
  @apply flex h-full w-full items-center justify-center;
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent), color-mix(in srgb, var(--color-accent) 20%, transparent));
}

.post-card-placeholder span {
  @apply text-[2.5rem] font-bold;
  color: color-mix(in srgb, var(--color-accent) 50%, transparent);
}

/* Tags section - positioned at bottom, allows separate clicks */
.post-card-tags {
  @apply flex flex-wrap items-baseline gap-1 px-3 pb-3;
}

/* Authors section - positioned above tags, allows separate clicks */
.post-card-authors {
  @apply px-3 pb-1;
}

/* Hero Background (formerly Cover Overlay) for Hero and Stream */
.cover-hero-container {
  @apply grid relative w-full overflow-hidden min-h-[150px] rounded-lg mb-4;
  grid-template-areas: "stack";
  @apply isolate;
}

.cover-hero-image {
  grid-area: stack;
  @apply absolute inset-0 bg-cover bg-center opacity-40 pointer-events-none transition-[filter,transform,opacity] duration-200 ease-in-out;
}

.cover-hero-tint {
  grid-area: stack;
  @apply absolute inset-0 pointer-events-none;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--color-bgColor) 70%, transparent),
    color-mix(in srgb, var(--color-bgColor) 50%, transparent)
  );
}

.cover-hero-content {
  grid-area: stack;
  @apply relative z-10 min-h-[150px] p-6 flex flex-col justify-center;
}

.cover-hero-image[data-bg-state="placeholder"] {
  @apply blur-[14px] scale-[1.02];
}

.cover-hero-image[data-bg-state="full"] {
	@apply filter-none transform-none;
}

.glightbox-clean .gslide-description {
  background: var(--color-bgColor);
}`;

			const cssOutputPath = "src/styles/global.css";
			fs.writeFileSync(cssOutputPath, cssContent);
		},
	},
});
