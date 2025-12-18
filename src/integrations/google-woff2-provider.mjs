import { providers } from "unifont";

const googleOriginal = providers.google;

const urlLooksLike = (value, extension) => {
	if (!value) return false;
	if (value instanceof URL) {
		return value.pathname.toLowerCase().endsWith(extension);
	}
	if (typeof value === "string") {
		// Strip query/hash so `.woff?x=y` still matches.
		const cleaned = value.split("#")[0].split("?")[0].toLowerCase();
		return cleaned.endsWith(extension);
	}
	return false;
};

const sourceIsWoff = (source) => {
	if (!source) return false;
	if (typeof source === "string" || source instanceof URL) return urlLooksLike(source, ".woff");
	// Ignore local/font-name entries.
	if (typeof source === "object" && "name" in source) return false;
	if (typeof source === "object") {
		if (source.format === "woff") return true;
		return urlLooksLike(source.url, ".woff");
	}
	return false;
};

const sourceIsWoff2 = (source) => {
	if (!source) return false;
	if (typeof source === "string" || source instanceof URL) return urlLooksLike(source, ".woff2");
	// Ignore local/font-name entries.
	if (typeof source === "object" && "name" in source) return false;
	if (typeof source === "object") {
		if (source.format === "woff2") return true;
		return urlLooksLike(source.url, ".woff2");
	}
	return false;
};

export const provider = (options) => {
	const googleProviderInstance = googleOriginal(options);

	return async (ctx) => {
		const initializedProvider = await googleProviderInstance(ctx);
		if (!initializedProvider) return undefined;

		const originalResolveFont = initializedProvider.resolveFont;

		initializedProvider.resolveFont = async (family, opts) => {
			const result = await originalResolveFont(family, opts);
			if (!result || !result.fonts) return result;

			// Unifont's Google provider fetches multiple "priorities" (modern + legacy UAs).
			// If the result contains ANY woff2 sources, we treat woff as legacy fallback and
			// drop it entirely (including separate woff-only font-face entries).
			const anyWoff2 = result.fonts.some(
				(font) => Array.isArray(font.src) && font.src.some(sourceIsWoff2),
			);

			if (anyWoff2) {
				result.fonts = result.fonts
					.map((font) => ({
						...font,
						src: (font.src || []).filter((s) => !sourceIsWoff(s)),
					}))
					// Keep only font-face entries that still have a usable source.
					// (For Google fonts this means woff2; local() sources are also OK.)
					.filter(
						(font) =>
							Array.isArray(font.src) &&
							font.src.length > 0 &&
							(font.src.some(sourceIsWoff2) ||
								font.src.some((s) => typeof s === "object" && s && "name" in s)),
					);
			} else {
				// No woff2 anywhere: do not remove woff (it's the only usable format).
				// Leave `result.fonts` untouched.
			}
			return result;
		};

		return initializedProvider;
	};
};
