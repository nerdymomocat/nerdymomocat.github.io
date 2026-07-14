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
		const [red, green, blue] = parts as [number, number, number, ...number[]];
		const toHex = (num: number): string => {
			const hex = num.toString(16);
			return hex.length === 1 ? "0" + hex : hex;
		};
		return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
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

				const createCssVariables = (theme: "light" | "dark") => {
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

  @media print {
    @page {
      background: var(--color-bgColor);
    }

    html,
    body {
      background: var(--color-bgColor) !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
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
    @apply inline-block w-max min-w-[calc(100%+2rem)] -ml-4 pl-4 pr-4 box-border transition-[filter,opacity] duration-200 ease-out;
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

  .notion-h4 {
    @apply mt-3 mb-1 cursor-pointer text-base font-semibold;
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

  @media print {
    .divider,
    .notion-divider {
      height: 0;
      background: transparent !important;
      border: 0 !important;
      border-top: 1px solid color-mix(in srgb, var(--color-textColor) 24%, transparent) !important;
      border-radius: 0;
    }
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

  .ntable table.no-column-header tbody tr:first-child {
    @apply border-t border-gray-200/90 dark:border-gray-700/90;
  }

  @media print {
    .ntable {
      @apply max-w-full overflow-visible pb-0;
    }

    .ntable table {
      @apply w-full;
      table-layout: fixed;
    }

    .ntable th,
    .ntable td {
      @apply whitespace-normal;
      overflow-wrap: anywhere;
    }
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
    @apply max-w-full list-image-none;
  }

  .toggle-summary::-webkit-details-marker {
    display: none;
  }

  .toggle-icon-box {
    @apply inline-flex h-6 w-6 shrink-0 items-center justify-center;
  }

  .rotate-svg {
    @apply h-6 w-6 shrink-0 transition-transform duration-200 ease-out;
  }

  details.toggle[open] .toggle-icon-box > .rotate-svg {
    @apply rotate-90;
  }

  @media print {
    details.toggle[open] .rotate-svg {
      transform: rotate(90deg) !important;
    }
  }

  /* Tab */
  .notion-tab-block {
    @apply my-4 overflow-hidden rounded border;
    border-color: color-mix(in srgb, var(--color-accent-2) 18%, var(--color-bgColor));
    background-color: color-mix(in srgb, var(--color-bgColor) 91%, var(--color-popover-bg));
  }

  .notion-tab-header {
    @apply relative px-3 pb-2 pt-3;
  }

  .notion-tab-list {
    @apply m-0 flex gap-1 overflow-x-auto scroll-smooth;
    scrollbar-width: none;
  }

  .notion-tab-list::-webkit-scrollbar {
    display: none;
  }

  .notion-tab-button {
    @apply inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full bg-transparent px-3 py-2 text-sm font-semibold shadow-none outline-none transition focus-visible:ring-2 focus-visible:ring-accent/30;
    appearance: none;
    -webkit-appearance: none;
    border: none;
    color: color-mix(
      in srgb,
      var(--color-textColor) 72%,
      var(--color-accent) 6%,
      var(--color-accent-2) 8%,
      var(--color-bgColor)
    );
  }

  .notion-tab-button:hover {
    border: none;
    color: color-mix(
      in srgb,
      var(--color-textColor) 86%,
      var(--color-accent-2) 12%,
      var(--color-bgColor) 2%
    );
    background-color: color-mix(
      in srgb,
      var(--color-accent-2) 8%,
      var(--color-bgColor)
    );
  }

  .notion-tab-button.is-active {
    border: none;
    color: color-mix(
      in srgb,
      var(--color-textColor) 90%,
      var(--color-accent) 12%,
      var(--color-bgColor) 2%
    );
    background-color: color-mix(
      in srgb,
      var(--color-accent) 8%,
      var(--color-bgColor)
    );
    box-shadow: none;
  }

  .notion-tab-button-text {
    @apply inline-flex min-w-0 items-center gap-2 overflow-hidden text-ellipsis;
  }

  .notion-tab-button a {
    color: inherit;
    text-decoration: none;
  }

  .notion-tab-button img,
  .notion-tab-button svg {
    @apply h-[1.1rem] w-[1.1rem] shrink-0;
  }

  .notion-tab-edge {
    position: absolute;
    top: 0.85rem;
    bottom: 0.55rem;
    width: 1.6rem;
    pointer-events: none;
    opacity: 0;
    transition: opacity 160ms ease;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .notion-tab-edge-left {
    left: 0.75rem;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-bgColor) 92%, transparent) 0%,
      color-mix(in srgb, var(--color-bgColor) 70%, transparent) 58%,
      transparent 100%
    );
  }

  .notion-tab-edge-right {
    right: 0.75rem;
    background: linear-gradient(
      270deg,
      color-mix(in srgb, var(--color-bgColor) 92%, transparent) 0%,
      color-mix(in srgb, var(--color-bgColor) 70%, transparent) 58%,
      transparent 100%
    );
  }

  .notion-tab-header[data-can-scroll-left="true"] .notion-tab-edge-left,
  .notion-tab-header[data-can-scroll-right="true"] .notion-tab-edge-right {
    opacity: 1;
  }

  .notion-tab-panel {
    @apply px-4 pb-4 pt-1;
  }

  .notion-tab-panel[hidden] {
    display: none;
  }

  @media print {
    .notion-tab-block {
      @apply overflow-visible border-0 bg-transparent;
      break-inside: auto;
    }

    .notion-tab-header {
      @apply hidden;
    }

    .notion-tab-print-label {
      @apply mb-1 mt-4 text-base font-semibold;
      break-after: avoid;
    }

    .notion-tab-print-label::before {
      content: "Tab: ";
      font-weight: 600;
    }

    .notion-tab-panel,
    .notion-tab-panel[hidden] {
      @apply block! px-0 pb-4 pt-0;
      break-inside: auto;
      border-bottom: 1px solid color-mix(in srgb, var(--color-textColor) 14%, transparent);
    }

    #autogenerated-post-comments .tabs {
      @apply hidden;
    }

    #autogenerated-post-comments .tab-pane,
    #autogenerated-post-comments .tab-pane[hidden] {
      @apply block!;
    }
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
    @apply bg-bgColor absolute top-6 right-0 hidden w-8 flex-col items-end space-y-2 overflow-hidden p-2 transition-opacity duration-200 sm:flex;
  }

  .toc-content {
    @apply border-accent/10 bg-bgColor shadow-accent/5 absolute right-1 bottom-0 max-h-[55vh] w-76 overflow-y-auto rounded-xl border p-2 shadow-xl transition-[opacity,transform] duration-200 ease-out sm:top-0 sm:bottom-auto sm:max-h-[68vh];
  }

  .bottom-toc-button {
    @apply fixed end-4 ${bottomTocButtonBottom} z-30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border text-3xl transition-[color,background-color,border-color,transform,opacity] duration-200 ease-out sm:hidden print:hidden;
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
    @apply fixed end-4 ${toTopBtnBottom} z-30 flex h-10 w-10 translate-y-28 cursor-pointer items-center justify-center rounded-full border text-3xl opacity-0 transition-[color,background-color,border-color,transform,opacity] duration-200 ease-out data-[show=true]:translate-y-0 data-[show=true]:opacity-100 sm:end-8 sm:bottom-8 sm:h-12 sm:w-12 print:hidden;
  }

  .bottom-toc-button,
  .to-top-btn,
  .copy-markdown-btn {
    background-color: color-mix(in srgb, var(--color-accent-2) 12%, var(--color-bgColor));
    border-color: color-mix(in srgb, var(--color-accent-2) 40%, var(--color-bgColor));
    color: color-mix(in srgb, var(--color-accent-2) 80%, var(--color-bgColor));
  }

  .bottom-toc-button svg,
  .to-top-btn svg,
  .copy-markdown-btn svg {
    opacity: 0.75;
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
    @apply inline-flex items-center gap-1 transition disabled:opacity-60 disabled:cursor-not-allowed h-10 w-10 rounded-full border shadow-lg flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer backdrop-blur-md print:hidden;
  }


  .copy-markdown-btn[data-copy-state="success"] {
    @apply border-green-500/60 dark:border-green-400/60;
  }

  .copy-markdown-btn[data-copy-state="error"] {
    @apply border-red-500/50 dark:border-red-400/60;
  }

  /* Theme Icon */
  .theme-toggle-btn {
    @apply hover:text-accent relative h-10 w-10 cursor-pointer rounded-md p-2 transition-colors;
  }

  .theme-icon {
    @apply absolute top-1/2 left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 scale-75 opacity-0 transition-[transform,opacity] duration-200 ease-out;
  }

  /* Annotations */
  .anchor-link-dashed {
    @apply text-link decoration-accent-2/40 underline decoration-dashed underline-offset-2;
  }

  .ann-bg-c {
    background-color: var(--abc, transparent);
    @apply rounded-sm px-1;
  }

  :root.dark .ann-bg-c {
    background-color: var(--abc-dark, var(--abc, transparent));
  }

  .annotation-underline {
    @apply underline;
  }

  .annotation-strikethrough {
    @apply line-through decoration-slate-500/50;
  }

  /* Author Byline */
  .author-name-link {
    @apply text-link underline decoration-wavy decoration-from-font decoration-accent-2/40 hover:decoration-accent-2/80 underline-offset-2 transition-colors;
  }

  .author-icon-link {
    @apply text-link inline-flex items-center transition-[color,transform] duration-200 ease-out hover:scale-110 hover:text-accent;
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
    transition: opacity 0.15s ease;
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
    transition: opacity 0.15s ease;
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
    transition: opacity 0.15s ease;
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

  .toggle > summary {
    @apply flex cursor-pointer list-none items-start gap-2;
  }

  .toggle > summary .toggle-heading {
    display: inline !important;
    margin: 0 !important;
  }

  .toggle-icon-box {
    @apply inline-flex h-6 w-6 shrink-0 items-center justify-center;
  }

  details.toggle[open] .toggle-icon-box > .rotate-svg {
    @apply rotate-90;
  }

  @media print {
    .rotate-svg {
      @apply transition-none!;
    }

    details.toggle[open] .rotate-svg {
      rotate: 0deg !important;
      transform: rotate(90deg) !important;
    }
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

  .toggle-heading-4 {
    @apply mt-3 mb-1;
  }

  /* Interlinked content: title links in the auto-generated "External Links" list. */
  #autogenerated-external-links a {
    @apply text-link no-underline hover:decoration-accent-2 hover:underline hover:underline-offset-4;
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
    @apply absolute left-0 -translate-x-full -ml-2 top-0 opacity-0 pointer-events-none w-4 h-4 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center transition-[background-color,opacity,transform] duration-200 ease-out cursor-pointer;
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
    @apply bg-bgColor/90 text-accent absolute -inset-x-4 top-14 hidden flex-col items-end rounded-md py-2 text-base shadow-sm backdrop-blur-sm group-[.menu-open]:z-50 group-[.menu-open]:flex sm:static sm:z-auto sm:-ms-4 sm:mt-1 sm:flex sm:flex-row sm:items-center sm:rounded-none sm:py-0 sm:text-sm sm:shadow-none sm:backdrop-blur-none lg:text-base print:hidden gap-y-3 sm:gap-y-0 lg:gap-x-4;
  }
  .nav-link {
    @apply relative z-0 w-fit self-end px-3 py-1 text-right sm:w-auto sm:self-auto sm:py-0 sm:text-left;
  }
  .nav-link::before {
    content: "";
    position: absolute;
    left: 0.08em;
    right: 0.08em;
    bottom: 0;
    height: 0.42em;
    border-radius: 0.4em 0.2em;
    background-image:
      linear-gradient(
        to right,
        color-mix(in srgb, var(--color-accent) 4%, transparent),
        color-mix(in srgb, var(--color-accent) 10%, transparent) 6%,
        color-mix(in srgb, var(--color-accent) 5%, transparent)
      );
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 200ms ease;
    z-index: -1;
  }
  .dark .nav-link::before {
    background-image: linear-gradient(
      to right,
      color-mix(in srgb, var(--color-accent) 6%, transparent),
      color-mix(in srgb, var(--color-accent) 14%, transparent) 6%,
      color-mix(in srgb, var(--color-accent) 7%, transparent)
    );
  }
  .nav-link:hover::before,
  .nav-link:focus-visible::before {
    transform: scaleX(1);
  }
  .nav-link[aria-current="page"]::before {
    transform: scaleX(1);
    height: 0.62em;
    background-image: linear-gradient(
      to right,
      color-mix(in srgb, var(--color-accent-2) 8%, transparent),
      color-mix(in srgb, var(--color-accent-2) 20%, transparent) 6%,
      color-mix(in srgb, var(--color-accent-2) 10%, transparent)
    );
  }

  /* Footer */
  .site-footer {
    @apply text-accent mt-auto flex w-full flex-col items-center justify-center gap-y-2 pt-20 pb-4 text-center align-top text-sm sm:flex-row sm:justify-between lg:-ml-[25%] lg:w-[150%];
  }
  .footer-nav {
    @apply flex flex-wrap gap-x-2 rounded-sm border-t-2 border-b-2 border-gray-200 sm:gap-x-2 sm:border-none dark:border-gray-700 print:hidden;
  }
  .footer-separator {
    @apply flex items-center text-accent/45;
  }
  .footer-link {
    @apply relative z-0 px-4 py-2 sm:px-2 sm:py-0;
  }
  .footer-link + .footer-link {
    @apply sm:pl-0;
  }
  .footer-link::before {
    content: "";
    position: absolute;
    left: 0.08em;
    right: 0.08em;
    bottom: 0.05em;
    height: 0.5em;
    border-radius: 0.4em 0.2em;
    background-image:
      linear-gradient(
        to right,
        color-mix(in srgb, var(--color-accent) 4%, transparent),
        color-mix(in srgb, var(--color-accent) 10%, transparent) 6%,
        color-mix(in srgb, var(--color-accent) 5%, transparent)
      );
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 200ms ease;
    z-index: -1;
  }
  .dark .footer-link::before {
    background-image: linear-gradient(
      to right,
      color-mix(in srgb, var(--color-accent) 6%, transparent),
      color-mix(in srgb, var(--color-accent) 14%, transparent) 6%,
      color-mix(in srgb, var(--color-accent) 7%, transparent)
    );
  }
  .footer-link:hover::before,
  .footer-link:focus-visible::before {
    transform: scaleX(1);
  }
  .footer-link[aria-current="page"]::before {
    transform: scaleX(1);
    height: 0.7em;
    background-image: linear-gradient(
      to right,
      color-mix(in srgb, var(--color-accent-2) 8%, transparent),
      color-mix(in srgb, var(--color-accent-2) 20%, transparent) 6%,
      color-mix(in srgb, var(--color-accent-2) 10%, transparent)
    );
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
    @apply hover:text-accent flex h-10 w-10 cursor-pointer items-center justify-center rounded-md transition-colors;
  }

  /* Code Render/Inject */
  .code-rendered {
	@apply relative mb-1 w-full max-w-full overflow-hidden rounded-lg;
	height: var(--html-frame-height, clamp(22.5rem, 65dvh, 45rem));
	min-height: min(18rem, 100dvh);
	max-height: 100dvh;
	resize: vertical;
  }

  .code-rendered-aspect {
	height: auto;
	aspect-ratio: var(--html-frame-aspect-ratio);
  }

  .code-injected {
    @apply mb-1 max-w-full;
  }

  .code-iframe {
	@apply h-full w-full max-w-full rounded-lg border-none print:max-h-full;
  }

  .html-frame-lightbox-trigger {
    @apply bg-bgColor/85 text-textColor hover:text-accent focus-visible:ring-accent absolute top-2 right-2 z-10 flex cursor-pointer items-center justify-center rounded-full no-underline shadow-md backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-none;
    width: 44px;
    height: 44px;
  }

  .html-frame-lightbox-content {
    width: 100vw;
    height: 100dvh;
    max-width: 100vw;
    background: var(--color-bgColor);
  }

  .html-frame-lightbox-content .code-iframe {
    border-radius: 0;
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

  /* Pagefind Component UI */
  site-search {
    --pf-font: inherit;
    --pf-primary: var(--color-accent);
    --pf-text: var(--color-textColor);
    --pf-background: var(--color-bgColor);
    --pf-border: color-mix(in srgb, var(--color-textColor) 16%, transparent);
    --pf-border-radius: 0.4rem;
    --pf-shadow: 0 18px 56px color-mix(in srgb, #000 12%, transparent);
    --pf-highlight-background: color-mix(in srgb, var(--color-accent) 16%, transparent);
    --pf-highlight-text: var(--color-textColor);
    --pf-muted: color-mix(in srgb, var(--color-textColor) 58%, transparent);
    --pf-hover: color-mix(in srgb, var(--color-accent) 5%, transparent);
    --pf-focus: color-mix(in srgb, var(--color-accent) 10%, transparent);
    --webtrotion-search-rule: color-mix(in srgb, var(--color-textColor) 11%, transparent);
    --webtrotion-search-surface: var(--color-bgColor);
    --webtrotion-search-row-padding: 0.5rem 0.6rem;
    /* Fixed column widths so text never reflows while the preview is revealed. */
    --wt-results-col: min(33rem, calc(100vw - 3rem));
    --wt-preview-col: 22rem;
    /* Half the preview width — used to pin the modal's left edge while the preview
       drawer opens, so the results column never slides sideways as width grows. */
    --wt-preview-shift: calc(var(--wt-preview-col) / 2);
    --wt-modal-tx: 0px;
    /* Heights snap between states (no transition) for a crisp command-palette feel. */
    --wt-height-compact: min(32rem, calc(100vh - 5rem));
    --wt-height-results: min(40rem, calc(100vh - 4rem));
    /* Motion tokens — strong curves per Emil Kowalski's standards. */
    --wt-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --wt-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
    --webtrotion-search-ease: var(--wt-ease-out);
    /* Consistent type scale across the whole search surface. */
    --wt-fs-title: 0.9rem;
    --wt-fs-body: 0.82rem;
    --wt-fs-meta: 0.75rem;
    --wt-fs-label: 0.68rem;
    /* Multi-token palette so the UI isn't one flat accent:
       - accent    → active/selected/match affordances (focus, selection, highlight)
       - accent-2  → neutral strong glyphs (default page/doc icons read crisp, not tinted)
       - link      → section/passage indicators (semantically link-like wayfinding) */
    --wt-icon-default-tint: color-mix(in srgb, var(--color-accent-2) 62%, var(--pf-muted));
    --wt-sub-tint: color-mix(in srgb, var(--color-link) 80%, var(--pf-muted));
    /* Retint pagefind's built-in focus ring (defaults to GitHub blue #0969da) to
       the site accent so every focus/selection affordance is theme-driven. */
    --pf-outline-focus: var(--color-accent);
    --pf-border-focus: var(--color-accent);
  }

  site-search .search-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

  site-search .search-btn svg {
    @apply block;
    fill: currentColor;
  }

  /* Hide the inert modal until @pagefind/component-ui lazily upgrades it. */
  site-search pagefind-modal:not(:defined) {
    display: none !important;
  }

  /* First-open loading placeholder: pops instantly on click while the ~186KB Pagefind
     runtime downloads, then hands off seamlessly to the real modal. Mirrors the real
     modal's frame via the same theme variables so the swap is invisible. */
  site-search .search-loading-modal {
    @apply fixed inset-0 overflow-hidden p-0;
    margin: var(--pf-modal-top, 10dvh) auto;
    width: var(--wt-results-col);
    max-width: calc(100vw - 3rem);
    height: var(--wt-height-compact);
    max-height: calc(100vh - 4rem);
    border: 1px solid var(--webtrotion-search-rule);
    border-radius: 0.85rem;
    background: var(--webtrotion-search-surface);
    color: var(--color-textColor);
    box-shadow: var(--pf-shadow);
  }

  site-search .search-loading-modal[open] {
    @apply flex flex-col;
    opacity: 1;
    transform: scale(1) translateY(0);
    transition:
      opacity 190ms var(--wt-ease-out),
      transform 190ms var(--wt-ease-out);
  }

  @starting-style {
    site-search .search-loading-modal[open] {
      opacity: 0;
      transform: scale(0.97) translateY(6px);
    }
  }

  site-search .search-loading-modal::backdrop {
    background: color-mix(in srgb, #000 10%, transparent);
    backdrop-filter: blur(3px);
  }

  site-search .search-loading-header {
    @apply flex-none;
    padding: 0.7rem 0.8rem;
    border-bottom: 1px solid var(--webtrotion-search-rule);
    background: var(--webtrotion-search-surface);
  }

  site-search .search-loading-input {
    @apply flex items-center gap-2;
    height: 2.9rem;
    padding-inline: 0.85rem;
    border: 1px solid var(--pf-border);
    border-radius: 0.35rem;
    background: color-mix(in srgb, var(--color-bgColor) 94%, var(--color-textColor) 2%);
    color: color-mix(in srgb, var(--color-textColor) 42%, transparent);
    font-size: 1rem;
  }

  site-search .search-loading-input-icon {
    @apply h-[1.15rem] w-[1.15rem] shrink-0;
    color: var(--pf-muted);
    fill: currentColor;
  }

  site-search .search-loading-body {
    @apply flex flex-auto items-center justify-center;
  }

  site-search .search-loading-spinner {
    @apply h-[1.6rem] w-[1.6rem] rounded-full;
    border: 2px solid color-mix(in srgb, var(--color-textColor) 15%, transparent);
    border-top-color: var(--color-accent);
    animation: webtrotion-search-spin 0.7s linear infinite;
  }

  @keyframes webtrotion-search-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Seamless hand-off: skip the real modal's entrance animation on first open so it
     snaps in exactly where the placeholder was. */
  site-search[data-search-handoff] .pf-modal[open] {
    transition: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    site-search .search-loading-modal[open] {
      transition: none;
    }
    site-search .search-loading-spinner {
      animation-duration: 1.4s !important;
    }
  }

  site-search .pf-modal {
    width: var(--wt-results-col) !important;
    max-width: calc(100vw - 3rem) !important;
    height: var(--wt-height-compact) !important;
    max-height: calc(100vh - 4rem) !important;
    flex-direction: column !important;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--webtrotion-search-rule);
    border-radius: 0.85rem;
    background: var(--webtrotion-search-surface);
    color: var(--color-textColor);
    box-shadow: var(--pf-shadow);
    transform-origin: center;
    transition:
      width 240ms var(--wt-ease-out),
      transform 240ms var(--wt-ease-out),
      opacity 180ms var(--wt-ease-out),
      box-shadow 220ms ease;
  }

  /* Subtle, fast entrance — transform + opacity only (modal is centered → origin: center). */
  @starting-style {
    site-search .pf-modal[open] {
      opacity: 0;
      transform: translateX(0px) scale(0.97) translateY(6px);
    }
  }

  site-search .pf-modal[open] {
    opacity: 1;
    transform: translateX(var(--wt-modal-tx, 0px)) scale(1) translateY(0);
  }

  /* Grow taller once real results exist. Height snaps (not in the transition list). */
  site-search .pf-modal:has(.webtrotion-search-result) {
    height: var(--wt-height-results) !important;
  }

  /* No-results: centre the message block in the pane so there is no dead space.
     Only when the navigation is hidden too, so a query that also matches a nav
     label doesn't get shoved to the vertical centre. */
  site-search
    .pf-modal:has(.webtrotion-search-empty-state:not([hidden])):has(
        webtrotion-search-navigation[hidden]
      )
    .webtrotion-search-results-pane {
    @apply flex flex-col justify-center;
    padding-block: 1rem;
  }

  /* No-results: the friendly empty-state block is the single focal message; hide
     the raw pagefind summary line so it doesn't float redundantly above it. */
  site-search
    .pf-modal:has(.webtrotion-search-empty-state:not([hidden]))
    .pf-summary {
    display: none !important;
  }

  /* Never show the "no results" block while the Navigate list is visible below —
     matches on nav labels are real results, so the empty state would be a lie. */
  site-search
    .webtrotion-search-results-pane:has(webtrotion-search-navigation:not([hidden]))
    .webtrotion-search-empty-state {
    display: none !important;
  }

  /* Reveal the preview column by growing width to the right only: the modal is
     centred, so we translate it by half the preview width to pin its left edge,
     keeping the results column perfectly still while the drawer opens. width and
     transform share the same duration/easing so the left edge stays fixed. */
  site-search .pf-modal:has(webtrotion-search-preview[data-preview-active]) {
    width: calc(var(--wt-results-col) + var(--wt-preview-col)) !important;
    --wt-modal-tx: var(--wt-preview-shift);
    box-shadow: 0 24px 64px color-mix(in srgb, #000 18%, transparent);
  }

  site-search .pf-modal::backdrop {
    background: color-mix(in srgb, #000 10%, transparent);
    backdrop-filter: blur(3px);
  }

  site-search pagefind-modal-header {
    @apply flex-none;
    padding: 0.7rem 0.8rem;
    border-bottom: 1px solid var(--webtrotion-search-rule);
    background: var(--webtrotion-search-surface);
  }

  site-search .pf-input-wrapper {
    position: relative;
  }

  site-search .pf-input {
    height: 2.9rem !important;
    min-height: 2.9rem !important;
    padding-inline: 2.55rem 2.5rem !important;
    border: 1px solid var(--pf-border) !important;
    border-radius: 0.35rem !important;
    background: color-mix(in srgb, var(--color-bgColor) 94%, var(--color-textColor) 2%) !important;
    color: var(--color-textColor);
    font: inherit;
    font-size: 1rem !important;
    box-shadow: inset 0 0 0 1px transparent;
  }

  site-search .pf-input:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent);
    outline: none;
  }

  site-search .pf-input::placeholder {
    color: color-mix(in srgb, var(--color-textColor) 42%, transparent);
  }

  site-search .pf-input-icon {
    inset-inline-start: 0.8rem;
    color: var(--pf-muted);
  }

  site-search .pf-clear-button {
    inset-inline-end: 0.65rem;
    color: var(--pf-muted);
  }

  site-search pagefind-modal-body {
    @apply flex-auto! overflow-hidden p-0;
    min-height: 0;
  }

  .webtrotion-search-shell {
    @apply flex h-full min-h-0 flex-col;
  }

  .webtrotion-search-filters {
    @apply flex flex-wrap items-center;
    gap: 0.4rem;
    padding: 0.5rem 0.7rem;
  }

  .webtrotion-search-filters-icon {
    @apply block flex-none;
    width: 0.95rem;
    height: 0.95rem;
    margin-inline-end: 0.05rem;
  }

  .webtrotion-search-filters-icon svg {
    @apply block h-full w-full;
    fill: var(--pf-muted);
  }

  site-search pagefind-filter-dropdown {
    @apply min-w-0;
  }

  site-search .pf-dropdown-trigger {
    @apply inline-flex items-center;
    gap: 0.35rem;
    height: 1.9rem !important;
    min-height: 1.9rem !important;
    padding-inline: 0.7rem !important;
    border: 1px solid var(--pf-border) !important;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-bgColor) 94%, var(--color-textColor) 2%);
    color: var(--color-textColor);
    font: inherit;
    font-size: 0.76rem !important;
    transition:
      background-color 130ms ease,
      border-color 130ms ease,
      color 130ms ease;
  }

  site-search .pf-dropdown-trigger:hover,
  site-search .pf-dropdown-trigger.open {
    background: var(--pf-hover);
    border-color: color-mix(in srgb, var(--color-accent) 36%, var(--pf-border));
  }

  /* Active filter — trigger picks up an accent tint while any value is selected. */
  site-search .pf-dropdown-trigger:has(.pf-dropdown-selected-badge:not([data-pf-hidden])) {
    border-color: color-mix(in srgb, var(--color-accent) 45%, transparent) !important;
    background: color-mix(in srgb, var(--color-accent) 10%, transparent) !important;
    color: var(--color-accent) !important;
  }

  site-search .pf-dropdown-selected-badge {
    height: 1.05rem !important;
    min-width: 1.05rem !important;
    padding: 0 0.32rem !important;
    border-radius: 999px !important;
    background: var(--color-accent) !important;
    color: var(--color-bgColor) !important;
    font-size: 0.66rem !important;
    font-weight: 600 !important;
    font-variant-numeric: tabular-nums;
  }

  site-search .pf-dropdown-arrow {
    opacity: 0.6;
  }

  site-search .pf-dropdown-menu {
    max-height: min(18rem, 48vh) !important;
    overflow-y: auto !important;
    border: 1px solid var(--pf-border) !important;
    border-radius: 0.55rem !important;
    background: var(--color-bgColor) !important;
    box-shadow: 0 12px 32px color-mix(in srgb, #000 12%, transparent) !important;
    padding: 0.25rem !important;
  }

  site-search .pf-dropdown-option,
  site-search .pf-filter-checkbox {
    color: var(--color-textColor);
    min-height: 2rem !important;
    padding: 0.4rem 0.5rem !important;
    border-radius: 0.4rem !important;
    font-size: 0.8rem !important;
  }

  site-search .pf-dropdown-option:hover,
  site-search .pf-filter-checkbox:hover {
    background: var(--pf-hover);
  }

  /* Selected option — clear accent affordance. */
  site-search .pf-dropdown-option[aria-selected="true"],
  site-search .pf-filter-checkbox:has(.pf-checkbox-input:checked) {
    background: color-mix(in srgb, var(--color-accent) 12%, transparent) !important;
    color: var(--color-accent) !important;
    font-weight: 550 !important;
  }

  site-search .pf-filter-checkbox:has(.pf-checkbox-input:checked) .pf-checkbox-input,
  site-search .pf-checkbox-input:checked {
    accent-color: var(--color-accent);
    border-color: var(--color-accent) !important;
    background-color: var(--color-accent) !important;
  }

  /* Custom checkbox glyph (this build renders a .pf-dropdown-checkbox span rather
     than a native input): tint the checked box with the accent colour. */
  site-search .pf-dropdown-option[aria-selected="true"] .pf-dropdown-checkbox {
    background: var(--color-accent) !important;
    border-color: var(--color-accent) !important;
  }

  /* Facet counts as quiet monospace "code" chips — distinct from the accent
     affordances, using the mono font + a neutral tint rather than more accent. */
  site-search .pf-dropdown-option-count {
    margin-inline-start: auto;
    padding: 0 0.32rem;
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--color-accent-2) 8%, transparent);
    color: var(--pf-muted);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.35;
  }

  site-search .pf-dropdown-option[aria-selected="true"] .pf-dropdown-option-count {
    background: color-mix(in srgb, var(--color-accent) 16%, transparent);
    color: var(--color-accent);
  }

  .webtrotion-search-content {
    @apply flex min-h-0 flex-1 p-0;
  }

  .webtrotion-search-results-pane {
    flex: 0 0 var(--wt-results-col);
    @apply min-w-0 min-h-0 overflow-auto;
    padding: 0.4rem 0;
  }

  webtrotion-search-navigation {
    @apply block;
    padding: 0.3rem 0.5rem 0.15rem;
  }

  .webtrotion-search-navigation-label,
  .webtrotion-search-pinned-label {
    margin: 0.35rem 0.6rem 0.28rem;
    color: color-mix(in srgb, var(--color-textColor) 45%, transparent);
    font-size: var(--wt-fs-label);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .webtrotion-search-navigation-list {
    @apply flex flex-col m-0 p-0 list-none;
    gap: 0.06rem;
  }

  .webtrotion-search-navigation-link {
    @apply flex items-center no-underline font-medium;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem;
    border-radius: 0.55rem;
    color: var(--color-textColor);
    font-size: var(--wt-fs-title);
    line-height: 1.3;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .webtrotion-search-navigation-icon {
    @apply inline-flex flex-none items-center justify-center leading-none;
    width: 1.05rem;
    height: 1.05rem;
    font-size: 0.92rem;
    transition: color 120ms ease;
  }

  .webtrotion-search-navigation-text {
    @apply min-w-0 truncate;
  }

  .webtrotion-search-navigation-icon img {
    @apply block h-full w-full object-contain;
    border-radius: 0.2rem;
  }

  /* Default (no page icon): a theme-tinted bookmark glyph, distinct from posts. */
  .webtrotion-search-navigation-icon.is-default svg {
    @apply block h-full w-full;
    fill: var(--wt-icon-default-tint);
    transition: fill 120ms ease;
  }

  .webtrotion-search-navigation-link:hover,
  .webtrotion-search-navigation-link:focus-visible {
    background: color-mix(in srgb, var(--color-textColor) 6%, transparent);
    color: var(--color-accent);
    outline: 0;
  }

  .webtrotion-search-navigation-link:hover .webtrotion-search-navigation-icon.is-default svg,
  .webtrotion-search-navigation-link:focus-visible .webtrotion-search-navigation-icon.is-default svg {
    fill: var(--color-accent);
  }

  /* Go-to (path/title jump) mode: two-line link with a muted excerpt subtext. */
  .webtrotion-search-navigation-link.is-goto {
    @apply items-start;
    padding: 0.45rem 0.6rem;
  }

  .webtrotion-search-navigation-link.is-goto .webtrotion-search-navigation-icon {
    margin-top: 0.1rem;
  }

  .webtrotion-search-navigation-body {
    @apply flex min-w-0 flex-col;
    gap: 0.1rem;
  }

  .webtrotion-search-navigation-snippet {
    @apply block min-w-0 truncate;
    color: color-mix(in srgb, var(--color-textColor) 50%, transparent);
    font-size: var(--wt-fs-label);
    font-weight: 400;
    transition: color 120ms ease;
  }

  .webtrotion-search-navigation-link.is-goto:hover .webtrotion-search-navigation-snippet,
  .webtrotion-search-navigation-link.is-goto:focus-visible .webtrotion-search-navigation-snippet {
    color: color-mix(in srgb, var(--color-textColor) 70%, transparent);
  }

  .webtrotion-search-navigation-empty {
    margin: 0.6rem 0.7rem;
    color: color-mix(in srgb, var(--color-textColor) 55%, transparent);
    font-size: var(--wt-fs-title);
  }

  /* When the query starts with "/", the popup is a pure client-side page jumper —
     hide every Pagefind-owned surface and keep only the navigation list. */
  .webtrotion-search-shell[data-goto-mode] .webtrotion-search-filters,
  .webtrotion-search-shell[data-goto-mode] pagefind-summary,
  .webtrotion-search-shell[data-goto-mode] .pagefind-summary,
  .webtrotion-search-shell[data-goto-mode] pagefind-results,
  .webtrotion-search-shell[data-goto-mode] .pagefind-results,
  .webtrotion-search-shell[data-goto-mode] .webtrotion-search-empty-state,
  .webtrotion-search-shell[data-goto-mode] .webtrotion-search-preview-slot {
    display: none !important;
  }

  .webtrotion-search-pinned {
    margin-top: 0.35rem;
    padding: 0 0.5rem;
  }

  .webtrotion-search-pinned-link {
    @apply grid items-start no-underline;
    grid-template-columns: 0.85rem 1.1rem minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.55rem 0.6rem;
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--color-textColor) 4%, transparent);
    color: var(--color-textColor);
    transition: background-color 120ms ease;
  }

  .webtrotion-search-pinned-marker {
    @apply inline-flex flex-none items-center justify-center;
    width: 0.85rem;
    height: 1.1rem;
    color: color-mix(in srgb, var(--color-accent) 70%, transparent);
  }

  .webtrotion-search-pinned-marker svg {
    @apply block;
    width: 0.8rem;
    height: 0.8rem;
    fill: currentColor;
  }

  .webtrotion-search-pinned-icon {
    @apply inline-flex flex-none items-center justify-center leading-none;
    width: 1.1rem;
    height: 1.1rem;
    margin-top: 0.08rem;
    font-size: 0.95rem;
  }

  .webtrotion-search-pinned-icon img {
    @apply block h-full w-full object-contain;
    border-radius: 0.2rem;
  }

  /* Default (Pinned post without its own icon): a document glyph, matching results. */
  .webtrotion-search-pinned-icon svg {
    @apply block h-full w-full;
    fill: none;
    stroke: var(--wt-icon-default-tint);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }

  .webtrotion-search-pinned-content {
    @apply grid min-w-0;
    gap: 0.14rem;
  }

  .webtrotion-search-pinned-link:hover,
  .webtrotion-search-pinned-link:focus-visible {
    background: color-mix(in srgb, var(--color-accent) 9%, transparent);
    color: inherit;
    outline: 0;
  }

  .webtrotion-search-pinned-link:hover .webtrotion-search-pinned-marker,
  .webtrotion-search-pinned-link:focus-visible .webtrotion-search-pinned-marker {
    color: var(--color-accent);
  }

  .webtrotion-search-pinned-title {
    font-size: var(--wt-fs-title);
    font-weight: 600;
    line-height: 1.35;
  }

  .webtrotion-search-pinned-detail {
    @apply truncate;
    color: var(--pf-muted);
    font-size: var(--wt-fs-meta);
    line-height: 1.35;
  }

  site-search .pf-summary {
    margin: 0 0 0.45rem !important;
    padding-inline: 1.1rem;
    color: var(--pf-muted);
    font-size: var(--wt-fs-meta) !important;
  }

  site-search .pf-results {
    @apply flex flex-col m-0 p-0;
    gap: 0 !important;
  }

  .webtrotion-search-result {
    @apply list-none;
    scroll-margin-block: 5rem;
  }

  .webtrotion-search-result-card {
    position: relative;
    margin: 0 0.5rem;
    padding: var(--webtrotion-search-row-padding);
    border-radius: 0.6rem;
    transition: background-color 120ms ease;
  }

  .webtrotion-search-result-card:hover {
    background: color-mix(in srgb, var(--color-textColor) 5%, transparent);
  }

  .webtrotion-search-result-card:has(.webtrotion-search-result-link:focus-visible) {
    background: color-mix(in srgb, var(--color-accent) 13%, transparent);
    box-shadow: none;
  }

  site-search .webtrotion-search-result-link:focus-visible,
  site-search .webtrotion-search-subresult-link:focus-visible {
    outline: none;
  }

  .webtrotion-search-result-main {
    @apply min-w-0;
  }

  .webtrotion-search-result-heading {
    @apply flex items-start min-w-0;
    gap: 0.4rem;
  }

  .webtrotion-search-result-icon {
    @apply inline-flex items-center justify-center leading-none;
    flex: 0 0 1rem;
    width: 1rem;
    height: 1rem;
    margin-top: 0.12rem;
    color: var(--pf-muted);
    font-size: 0.9rem;
  }

  .webtrotion-search-result-icon img,
  .webtrotion-search-result-icon svg {
    @apply block h-full w-full;
  }

  .webtrotion-search-result-icon img {
    @apply object-contain;
  }

  .webtrotion-search-result-icon svg {
    fill: none;
    stroke: var(--wt-icon-default-tint);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }

  .webtrotion-search-result-link {
    @apply block min-w-0 no-underline;
    color: var(--color-textColor);
    font-size: var(--wt-fs-title);
    font-weight: 650;
    line-height: 1.3;
  }

  .webtrotion-search-result-link:hover,
  .webtrotion-search-result-link:focus-visible {
    color: var(--color-accent);
  }

  .webtrotion-search-result-excerpt {
    @apply line-clamp-1;
    margin: 0.18rem 0 0;
    color: var(--pf-muted);
    line-height: 1.45;
    overflow-wrap: anywhere;
    font-size: var(--wt-fs-body);
  }

  .webtrotion-search-subresults {
    @apply grid list-none p-0;
    gap: 0.1rem;
    margin: 0.15rem 0.5rem 0.35rem 1.35rem;
    border: 0;
  }

  .webtrotion-search-subresults li {
    @apply block p-0;
    border: 0;
  }

  .webtrotion-search-subresult-link {
    @apply flex items-start no-underline;
    gap: 0.5rem;
    padding: 0.32rem 0.5rem;
    border-radius: 0.45rem;
    transition: background-color 110ms ease;
  }

  .webtrotion-search-subresult-icon {
    @apply block flex-none;
    width: 0.72rem;
    height: 0.72rem;
    margin-top: 0.2rem;
  }

  .webtrotion-search-subresult-icon svg {
    @apply block h-full w-full;
    fill: var(--wt-sub-tint);
    transition: fill 110ms ease;
  }

  .webtrotion-search-subresult-body {
    @apply grid min-w-0;
    gap: 0.08rem;
  }

  .webtrotion-search-subresult-title {
    @apply truncate;
    color: color-mix(in srgb, var(--color-textColor) 82%, transparent);
    font-size: var(--wt-fs-body);
    font-weight: 550;
    line-height: 1.35;
    transition: color 110ms ease;
  }

  .webtrotion-search-subresult-excerpt {
    @apply line-clamp-1;
    color: var(--pf-muted);
    font-size: var(--wt-fs-meta);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .webtrotion-search-subresult-link:hover,
  .webtrotion-search-subresult-link:focus-visible {
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    outline: 0;
  }

  .webtrotion-search-subresult-link:hover .webtrotion-search-subresult-title,
  .webtrotion-search-subresult-link:focus-visible .webtrotion-search-subresult-title {
    color: var(--color-accent);
  }

  .webtrotion-search-subresult-link:hover .webtrotion-search-subresult-icon svg,
  .webtrotion-search-subresult-link:focus-visible .webtrotion-search-subresult-icon svg {
    fill: var(--color-accent);
  }

  /* Clean underline highlight (no blocky chip) so long matched tokens read well. */
  site-search mark,
  .pagefind-highlight {
    background: none;
    color: inherit;
    padding: 0;
    border-radius: 0;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
    text-decoration-thickness: 0.12em;
    text-underline-offset: 0.16em;
    text-decoration-skip-ink: none;
  }

  .webtrotion-search-preview-slot {
    @apply min-w-0 overflow-auto;
    flex: 0 0 var(--wt-preview-col);
    border-inline-start: 1px solid var(--webtrotion-search-rule);
    opacity: 0;
    pointer-events: none;
    transform: translateX(0.5rem);
    transition:
      opacity 200ms var(--wt-ease-out) 20ms,
      transform 240ms var(--wt-ease-out) 20ms;
  }

  .webtrotion-search-content:has(webtrotion-search-preview[data-preview-active])
    .webtrotion-search-preview-slot {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
  }

  webtrotion-search-preview {
    @apply block;
  }

  .webtrotion-search-preview-card {
    padding: 0.85rem 0.9rem;
  }

  .webtrotion-search-preview-title {
    margin: 0;
    color: var(--color-textColor);
    font-size: 1rem;
    font-weight: 650;
    line-height: 1.3;
  }

  .webtrotion-search-preview-empty,
  .webtrotion-search-preview-excerpt {
    color: var(--pf-muted);
  }

  .webtrotion-search-preview-excerpt {
    @apply line-clamp-5;
    margin: 0.7rem 0 0;
    font-size: 0.82rem;
    line-height: 1.48;
    overflow-wrap: anywhere;
  }

  .webtrotion-search-preview-sections {
    @apply grid p-0 list-none;
    gap: 0.15rem;
    margin: 0.85rem 0 0;
  }

  .webtrotion-search-preview-sections li {
    padding: 0.4rem 0.5rem;
    border-radius: 0.45rem;
    background: color-mix(in srgb, var(--color-textColor) 3.5%, transparent);
  }

  .webtrotion-search-preview-sections span {
    color: var(--color-textColor);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .webtrotion-search-preview-sections p {
    @apply line-clamp-3;
    margin: 0.22rem 0 0;
    color: var(--pf-muted);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .webtrotion-search-skeleton,
  .webtrotion-search-preview-skeleton {
    @apply block;
    border-radius: 0.1rem;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-textColor) 8%, transparent),
      color-mix(in srgb, var(--color-textColor) 14%, transparent),
      color-mix(in srgb, var(--color-textColor) 8%, transparent)
    );
    background-size: 220% 100%;
    animation: webtrotion-search-shimmer 1.2s ease-in-out infinite;
  }

  .webtrotion-search-skeleton-title,
  .webtrotion-search-preview-skeleton.title {
    width: 70%;
    height: 1rem;
  }

  .webtrotion-search-skeleton-line,
  .webtrotion-search-preview-skeleton.line {
    width: 96%;
    height: 0.75rem;
    margin-top: 0.7rem;
  }

  .webtrotion-search-skeleton-line.short,
  .webtrotion-search-preview-skeleton.short {
    width: 58%;
  }

  @keyframes webtrotion-search-shimmer {
    from {
      background-position: 140% 0;
    }
    to {
      background-position: -80% 0;
    }
  }

  site-search pagefind-modal-footer {
    @apply flex items-center flex-none;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--webtrotion-search-rule);
    background: var(--webtrotion-search-surface);
    font-size: 0.75rem;
  }

  .webtrotion-search-navigation-hints {
    @apply hidden items-center flex-nowrap w-full overflow-hidden;
    gap: 0.45rem;
    color: color-mix(in srgb, var(--color-textColor) 58%, transparent);
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.01em;
  }

  @media (min-width: 768px) {
    .webtrotion-search-navigation-hints {
      @apply flex;
    }
  }

  @media (max-width: 767px) {
    site-search pagefind-modal-footer {
      display: none !important;
    }
  }

  .webtrotion-search-navigation-hints span {
    @apply inline-flex items-center whitespace-nowrap flex-none;
    gap: 0.26rem;
  }

  .webtrotion-search-navigation-hints kbd {
    @apply inline-flex items-center justify-center leading-none;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.28rem;
    border: 1px solid color-mix(in srgb, var(--color-textColor) 20%, transparent);
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--color-textColor) 4%, transparent);
    color: color-mix(in srgb, var(--color-textColor) 75%, transparent);
    font-family: var(--font-mono);
    font-size: 0.66rem;
  }

  .webtrotion-search-empty-state {
    @apply flex flex-col items-center text-center;
    gap: 0.55rem;
    margin: 0.5rem 0.8rem;
    color: var(--pf-muted);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .webtrotion-search-empty-state-icon {
    @apply block;
    width: 1.9rem;
    height: 1.9rem;
  }

  .webtrotion-search-empty-state-icon svg {
    @apply block h-full w-full;
    fill: currentColor;
    opacity: 0.55;
  }

  @media (max-width: 1023px) {
    site-search .pf-modal {
      width: min(34rem, calc(100vw - 1.5rem)) !important;
      max-width: calc(100vw - 1.5rem) !important;
      height: var(--wt-height-compact) !important;
    }

    site-search .pf-modal:has(.webtrotion-search-result) {
      height: var(--wt-height-results) !important;
    }

    /* No width growth on tablet — the preview stacks below as a drawer. */
    site-search .pf-modal:has(webtrotion-search-preview[data-preview-active]) {
      width: min(34rem, calc(100vw - 1.5rem)) !important;
      --wt-modal-tx: 0px;
    }

    .webtrotion-search-content {
      @apply flex-col;
    }

    .webtrotion-search-results-pane {
      @apply flex-auto;
    }

    /* Inactive on tablet: collapse fully so the pane uses all vertical space
       (no stray divider line, no dead gap below the nav/pinned list). */
    .webtrotion-search-preview-slot {
      @apply flex-none;
      max-height: 0;
      border-inline-start: 0;
      border-top: 0;
      transform: translateY(0.6rem);
      transition:
        opacity 180ms var(--wt-ease-out) 40ms,
        max-height 240ms var(--wt-ease-out),
        transform 220ms var(--wt-ease-out) 40ms;
    }

    .webtrotion-search-content:has(webtrotion-search-preview[data-preview-active])
      .webtrotion-search-preview-slot {
      max-height: 42%;
      border-top: 1px solid var(--webtrotion-search-rule);
      transform: translateY(0);
    }
  }

  @media (max-width: 640px) {
    /* Keep the pop-up feel on phones: a centred rounded card with slim margins,
       not an edge-to-edge full-screen sheet. Heights use dvh so the mobile
       browser chrome never clips the card, and shrink a touch vs. tablet. */
    site-search {
      /* Keep the card in the upper portion of the screen so the on-screen keyboard
         (which the auto-focused input raises) always has clear room below it. Heights
         are a proportion of the dynamic viewport so this holds across phone sizes. */
      --wt-modal-top-m: max(2rem, 5dvh);
      --wt-height-compact: min(20rem, 45dvh);
      --wt-height-results: min(27rem, 53dvh);
    }

    site-search .pf-modal,
    site-search .pf-modal:has(.webtrotion-search-result),
    site-search .pf-modal:has(webtrotion-search-preview[data-preview-active]) {
      /* Override Pagefind's high-specificity full-screen mobile rule
         (border-radius:0; margin:0; top:0; left:0; height:100dvh) — !important is
         required to beat its :is()-boosted specificity. inset:0 + auto side margins
         centre horizontally; a fixed top margin pins the card below the top edge so
         it reads as a floating pop-up that grows downward, matching desktop. */
      inset: 0 !important;
      margin: var(--wt-modal-top-m) auto !important;
      width: calc(100vw - 1.4rem) !important;
      max-width: calc(100vw - 1.4rem) !important;
      height: var(--wt-height-compact) !important;
      max-height: calc(100dvh - var(--wt-modal-top-m) - 1.5rem) !important;
      padding: 0 !important;
      border: 1px solid var(--webtrotion-search-rule) !important;
      border-radius: 0.9rem !important;
      --wt-modal-tx: 0px;
    }

    site-search .pf-modal:has(.webtrotion-search-result) {
      height: var(--wt-height-results) !important;
    }

    /* Match the first-open loading placeholder to the real card so the hand-off
       doesn't visibly resize or jump — same size, same top-anchored position. */
    site-search .search-loading-modal {
      margin: var(--wt-modal-top-m) auto;
      width: calc(100vw - 1.4rem);
      max-width: calc(100vw - 1.4rem);
      height: var(--wt-height-compact);
      max-height: calc(100dvh - var(--wt-modal-top-m) - 1.5rem);
      border-radius: 0.9rem;
    }

    site-search pagefind-modal-header {
      padding: 0.65rem;
    }

    site-search .pf-input {
      min-height: 2.85rem;
      padding-inline: 2.4rem 2.35rem;
      font-size: 0.95rem;
    }

    .webtrotion-search-filters {
      @apply flex-nowrap overflow-visible relative;
      padding: 0.45rem 0.65rem;
      z-index: 2;
    }

    site-search pagefind-filter-dropdown {
      @apply min-w-0;
    }

    site-search .pf-dropdown-menu {
      inset-inline-start: 0 !important;
      left: 0 !important;
      width: min(18rem, calc(100vw - 1.3rem)) !important;
      max-width: min(18rem, calc(100vw - 1.3rem)) !important;
      transform: none !important;
    }

    site-search pagefind-filter-dropdown:nth-child(2) .pf-dropdown-menu {
      width: min(15rem, calc(100vw - 9.4rem)) !important;
      max-width: min(15rem, calc(100vw - 9.4rem)) !important;
    }

    .webtrotion-search-content {
      @apply p-0;
    }

    webtrotion-search-navigation {
      margin-bottom: 0.4rem;
      padding-inline: 0.55rem;
    }

    .webtrotion-search-result-card {
      margin-inline: 0.35rem;
    }

    site-search pagefind-modal-footer {
      display: none !important;
    }
  }

  @media (hover: none), (pointer: coarse) {
    /* No hover pointer means the preview has no trigger, so drop the pane entirely and
       let the results use the full width. The runtime skips wiring it up here too. */
    .webtrotion-search-preview-slot {
      display: none !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    /* Modal: width/transform snap instantly (no transition), only opacity fades.
       The left-edge pin (--wt-modal-tx) still applies statically, so revealing the
       preview never jumps the results column sideways — it just appears. */
    site-search .pf-modal,
    site-search .pf-modal[open] {
      animation: none;
      transition: opacity 160ms ease;
    }

    .webtrotion-search-content,
    .webtrotion-search-preview-slot,
    .webtrotion-search-result-card,
    .webtrotion-search-skeleton,
    .webtrotion-search-preview-skeleton {
      animation: none;
      transition: opacity 160ms ease;
      transform: none !important;
    }
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

@media print {
  .print-footnote {
    @apply my-2 pl-3 text-sm leading-relaxed;
    color: color-mix(in srgb, var(--color-textColor) 76%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--color-textColor) 18%, transparent);
    break-inside: avoid;
  }

  .print-footnote > *,
  .print-footnote > * > * {
    @apply m-0 inline;
  }

  .footnote-margin-note,
  .popoverEl,
  .jump-to-bibliography,
  [data-back-to-citation] {
    @apply hidden!;
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
  @apply w-full box-border rounded-md border border-[#ccc] px-[6px] py-[3px] text-sm transition-[border-color,box-shadow] duration-200 ease-out;
}

.datatable-input:focus {
  @apply border-[#007bff] outline-none ring-[0.2rem] ring-[rgba(0,123,255,0.25)];
}

.filter-toggle {
  @apply bg-none border-none text-[20px] cursor-pointer px-[10px] transition-opacity duration-200 ease-out;
}

.filter-toggle:hover {
  @apply opacity-70;
}

.filter-row,
.search-inputs {
  @apply transition-[max-height,opacity] duration-300 ease-out max-h-[50px] opacity-100 overflow-hidden;
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
  @apply text-sm font-mono transition-colors duration-200 ease-out whitespace-nowrap;
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

@media print {
  .datatable-top,
  .filter-row,
  .search-inputs {
    @apply hidden!;
  }

  .datatable-wrapper .datatable-container {
    @apply overflow-visible!;
  }

  .datatable-table tr {
    @apply table-row!;
  }
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
  @apply relative overflow-hidden rounded-lg bg-bgColor transition-[box-shadow,transform] duration-200 ease-in-out;
}

.post-card:hover {
  @apply translate-y-0;
}

/* Card link - covers entire card */
.post-card-link {
  @apply block no-underline text-inherit;
}

/* Image container with 3:2 aspect ratio */
.post-card-image-container {
  @apply relative overflow-hidden rounded-lg border aspect-[3/2];
  border-color: color-mix(in srgb, var(--color-textColor) 6%, transparent);
}

.post-card-image {
  @apply h-full w-full object-cover rounded-lg transition-transform duration-300 ease-out;
}

.post-card:hover .post-card-image {
  @apply scale-105;
}

.post-card-placeholder {
  @apply flex h-full w-full items-center justify-center rounded-lg;
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent), color-mix(in srgb, var(--color-accent) 20%, transparent));
  transition: transform 300ms ease, filter 300ms ease;
}

.post-card-placeholder span {
  @apply text-[2.5rem] font-bold;
  color: color-mix(in srgb, var(--color-accent) 50%, transparent);
}

.post-card:hover .post-card-placeholder {
  transform: scale(1.05);
  filter: brightness(1.03);
}

/* Tags section - positioned at bottom, allows separate clicks */
.post-card-tags {
  @apply flex flex-wrap items-baseline gap-1 px-0 pb-3;
}

/* Authors section - positioned above tags, allows separate clicks */
.post-card-authors {
  @apply -mt-1 px-0 pb-1;
}

/* Hero Background (formerly Cover Overlay) for Hero and Stream */
.cover-hero-container {
  @apply grid relative w-full overflow-hidden min-h-[150px] rounded-lg mb-4;
  grid-template-areas: "stack";
  @apply isolate;
}

.cover-hero-image {
  grid-area: stack;
  @apply absolute inset-0 bg-cover bg-center opacity-40 pointer-events-none;
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

.glightbox-clean .gslide-description {
  background: var(--color-bgColor);
}

/* Site-wide reduced-motion policy. Unlayered + !important so it overrides every
   layered transition/animation regardless of specificity. Movement (transform,
   size, position) is dropped from the transition list so it snaps instantly,
   while opacity/colour fades are kept and clamped short. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-property: opacity, color, background-color, border-color, fill,
      stroke, box-shadow, text-decoration-color !important;
    transition-duration: 150ms !important;
    transition-delay: 0ms !important;
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    scroll-behavior: auto !important;
  }
}

@media print {
  html details.toggle[open] .rotate-svg {
    rotate: initial !important;
    transform: rotate(90deg) !important;
  }
}`;

			const cssOutputPath = "src/styles/global.css";
			fs.writeFileSync(cssOutputPath, cssContent);
		},
	},
});
