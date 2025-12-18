import { readdir, readFile, copyFile, unlink } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration, AstroConfig } from "astro";
import { glob } from "glob";

const ASTRO_ASSETS_CACHE = "./tmp/.astro/assets";
const ORIGINAL_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"] as const;
const ORIGINAL_IMAGE_HASH_PATTERN = `\\.[\\p{L}\\p{N}_\\-]{8}\\.(${ORIGINAL_IMAGE_FORMATS.join("|")})$`;

export default function astroImageCacheCleanerCopier(): AstroIntegration {
	let astroConfig: AstroConfig;

	return {
		name: "astro-image-cache-cleaner-copier",
		hooks: {
			"astro:config:done": ({ config }) => {
				astroConfig = config;
			},
			"astro:build:done": async ({ dir, logger }) => {
				const dirPath = fileURLToPath(dir);
				const destDir = path.join(dirPath, astroConfig.build.assets);

				if (!existsSync(ASTRO_ASSETS_CACHE)) {
					logger.info("No Astro image cache found, skipping...");
					return;
				}

				if (!existsSync(destDir)) {
					mkdirSync(destDir, { recursive: true });
				}

				logger.info("Scanning HTML for used _astro images...");

				// Step 1: Find all HTML files and get all available cache images in parallel
				const [htmlFiles, cacheFiles] = await Promise.all([
					glob("**/*.html", { cwd: dirPath, absolute: true, nodir: true }),
					readdir(ASTRO_ASSETS_CACHE, { withFileTypes: true }),
				]);

				const availableImages = cacheFiles
					.filter((file) => !file.isDirectory())
					.map((file) => file.name);

				// Step 2: Scan ALL HTML files in parallel to find used images
				const usedImagesSet = new Set<string>();
				await Promise.all(
					htmlFiles.map(async (htmlFile) => {
						const content = await readFile(htmlFile, "utf-8");
						// Match _astro images in: src, srcset, href (for lightbox)
						// Only match relative paths, not absolute URLs
						const astroImageRegex =
							/_astro\/([\p{L}\p{N}_\-\.\(\)\[\]@,']+\.(?:jpg|jpeg|png|webp|avif|gif|svg))/gu;
						let match;
						while ((match = astroImageRegex.exec(content)) !== null) {
							// Check if this match is part of an absolute URL by looking backwards
							const matchIndex = match.index;
							const contextBefore = content.substring(Math.max(0, matchIndex - 100), matchIndex);

							// Skip if this is an absolute URL (has :// before /_astro/ without a quote in between)
							const lastQuote = Math.max(
								contextBefore.lastIndexOf('"'),
								contextBefore.lastIndexOf("'"),
							);
							const lastProtocol = contextBefore.lastIndexOf("://");

							// If there's a protocol marker and no quote after it, this is an absolute URL - skip it
							if (lastProtocol !== -1 && lastProtocol > lastQuote) {
								continue;
							}

							usedImagesSet.add(match[1]);
						}
					}),
				);

				logger.info(`Found ${usedImagesSet.size} unique _astro image(s) referenced in HTML`);

				// Step 3: Determine which images to copy and which to delete from cache
				const imagesToCopy: string[] = [];
				const unusedCacheImages: string[] = [];

				for (const imageName of availableImages) {
					if (usedImagesSet.has(imageName)) {
						imagesToCopy.push(imageName);
					} else {
						unusedCacheImages.push(imageName);
					}
				}

				// Step 4: Parallelize copy operations AND cache cleanup
				const operations = await Promise.allSettled([
					// Copy used images in parallel
					...imagesToCopy.map((imageName) => {
						const srcPath = path.join(ASTRO_ASSETS_CACHE, imageName);
						const destPath = path.join(destDir, imageName);
						return existsSync(destPath) ? Promise.resolve() : copyFile(srcPath, destPath);
					}),
					// Delete unused images from cache in parallel
					...unusedCacheImages.map((imageName) => unlink(path.join(ASTRO_ASSETS_CACHE, imageName))),
				]);

				const copyCount = operations
					.slice(0, imagesToCopy.length)
					.filter((r) => r.status === "fulfilled").length;
				const cacheDeleteCount = operations
					.slice(imagesToCopy.length)
					.filter((r) => r.status === "fulfilled").length;

				logger.info(
					`Copied ${copyCount}/${imagesToCopy.length} used image(s) to dist/${astroConfig.build.assets}/`,
				);
				if (unusedCacheImages.length > 0) {
					logger.info(
						`Deleted ${cacheDeleteCount}/${unusedCacheImages.length} unused image(s) from cache`,
					);
				}

				// Step 5: Delete unreferenced original-looking images from dist in parallel
				const distFiles = await readdir(destDir);
				const reOriginalImage = new RegExp(ORIGINAL_IMAGE_HASH_PATTERN, "u");
				const unreferencedOriginals = distFiles.filter((file) => {
					const { ext } = path.parse(file);
					const fileFormat = ext.slice(1);
					if (!(ORIGINAL_IMAGE_FORMATS as ReadonlyArray<string>).includes(fileFormat)) return false;
					if (!reOriginalImage.test(file)) return false;
					return !usedImagesSet.has(file);
				});

				const deleteResults = await Promise.allSettled(
					unreferencedOriginals.map((file) => unlink(path.join(destDir, file))),
				);

				const deletedCount = deleteResults.filter((r) => r.status === "fulfilled").length;
				if (deletedCount > 0) {
					logger.info(`Removed ${deletedCount} unreferenced original image(s) from dist bundle`);
				} else {
					logger.info("No unreferenced original images found in dist bundle");
				}

				logger.info(
					`✓ Image optimization complete: ${copyCount} copied, ${cacheDeleteCount} cache cleaned, ${deletedCount} originals removed`,
				);

				// Step 6: Final verification
				const finalDistFiles = await readdir(destDir);
				logger.info(
					`Found ${finalDistFiles.length} total files in dist/${astroConfig.build.assets}/`,
				);

				const finalDistImagesSet = new Set(finalDistFiles);
				const missingImages = [...usedImagesSet].filter((img) => !finalDistImagesSet.has(img));

				if (missingImages.length > 0) {
					logger.warn(
						`Verification failed! ${missingImages.length} referenced images are missing from the final build directory:`,
					);
					logger.warn(missingImages.join("\n"));
				} else {
					logger.info(
						"✓ Verification complete: All referenced images exist in the final build directory.",
					);
				}
			},
		},
	};
}
