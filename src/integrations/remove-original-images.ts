import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration, AstroConfig } from "astro";

/**
 * Remove original unoptimized images from the build output.
 *
 * Astro optimizes images but keeps originals in _astro/ folder.
 * This integration removes the originals after build to reduce bundle size.
 *
 * Pattern detection:
 * - Original: image.HASH.ext (8-char hash, single dot)
 * - Optimized: image.HASH_HASH.ext (underscore in hash indicates optimization)
 */
export default function removeOriginalImages(): AstroIntegration {
	let astroConfig: AstroConfig;

	// Image formats to check for removal
	const ORIGINAL_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"] as const;
	// Regex pattern: `dot exactly eight hash chars dot extension end-of-string`
	// This matches files like: image.ABC12_EF.jpg (8 chars hash at the end before extension)
	// But NOT: image.ABC12_EF_XYZ123.jpg (more chars after the 8-char hash)
	// But NOT: image_space.ABC12DEF.jpg (underscore in base name before hash is OK)
	const ORIGINAL_IMAGE_HASH_PATTERN = `\\.[a-zA-Z0-9_\\-]{8}\\.(${ORIGINAL_IMAGE_FORMATS.join("|")})$`;

	return {
		name: "remove-original-images",
		hooks: {
			"astro:config:done": ({ config }) => {
				astroConfig = config;
			},
			"astro:build:done": async ({ dir, logger }) => {
				const dirPath = fileURLToPath(dir);
				const astroAssetsDir = path.join(dirPath, astroConfig.build.assets);
				const files = await readdir(astroAssetsDir);

				let removedCount = 0;

				for (const file of files) {
					const { ext } = path.parse(file);
					// Strip `ext` of dot also for format checking
					const fileFormat = ext.slice(1);

					if (!(ORIGINAL_IMAGE_FORMATS as ReadonlyArray<string>).includes(fileFormat)) continue;

					// Match original image files by ending with single 8-char hash and extension
					// Pattern: anything.EXACTLY_8_CHARS.ext$
					const reOriginalImage = new RegExp(ORIGINAL_IMAGE_HASH_PATTERN);
					if (!reOriginalImage.test(file)) continue;

					try {
						await unlink(path.join(astroAssetsDir, file));
						removedCount++;
					} catch (err) {
						// Silently continue if file can't be deleted
					}
				}

				if (removedCount > 0) {
					logger.info(`Removed ${removedCount} original image(s) from bundle.`);
				}
			},
		},
	};
}
