import type { AstroIntegration } from "astro";
import {
	downloadFile,
	getAllEntries,
	generateFilePath,
	getPostContentByPostId,
	createInterlinkedContentToThisEntry,
	isImageTypeForAstro,
} from "../lib/notion/client";
import { COVER_AS_HERO_BACKGROUND_ENABLED, LAST_BUILD_TIME, LISTING_VIEW } from "../constants";
import fs from "node:fs";
import path from "path";

export default (): AstroIntegration => ({
	name: "entry-cache-er",
	hooks: {
		"astro:build:start": async () => {
			const entries = await getAllEntries();

			const interlinkedContentInEntries = await Promise.all(
				entries.map(async (entry) => {
					let tasks = [];

					// Download Cover image for overlay (only to src/assets/notion)
					if (COVER_AS_HERO_BACKGROUND_ENABLED && entry.Cover && entry.Cover.Url) {
						try {
							const url = new URL(entry.Cover.Url);
							const isImage =
								isImageTypeForAstro(url.pathname) ||
								(url.hostname.includes("unsplash") &&
									url.searchParams.has("fm") &&
									url.searchParams.get("fm") !== "gif");

							if (isImage) {
								const assetsPath = generateFilePath(url, true);
								const needsAssetsDownload =
									!LAST_BUILD_TIME ||
									entry.LastUpdatedTimeStamp > LAST_BUILD_TIME ||
									!fs.existsSync(assetsPath);

								if (needsAssetsDownload) {
									tasks.push(downloadFile(url, true));
								}
							}
						} catch (err) {
							console.log("Invalid Cover URL");
						}
					}

					// Download FeaturedImage if it exists
					if (entry.FeaturedImage && entry.FeaturedImage.Url) {
						let url;
						try {
							url = new URL(entry.FeaturedImage.Url);

							// Check if we need to download to public/notion (for OG images)
							const publicPath = (() => {
								const base = generateFilePath(url, false);
								const ext = path.extname(base).toLowerCase();
								if ([".jpg", ".jpeg", ".png"].includes(ext)) return base;
								// Replicate downloadFile's PNG conversion naming logic
								const dir = path.dirname(base);
								const name = path.parse(base).name;
								return path.join(dir, name + ".png");
							})();
							const needsPublicDownload =
								!LAST_BUILD_TIME ||
								entry.LastUpdatedTimeStamp > LAST_BUILD_TIME ||
								!fs.existsSync(publicPath);

							if (needsPublicDownload) {
								tasks.push(downloadFile(url, false, false, true));
							}

							// For gallery view, also download to src/assets/notion for optimized images
							if (LISTING_VIEW === "gallery") {
								const assetsPath = generateFilePath(url, true);
								const needsAssetsDownload =
									!LAST_BUILD_TIME ||
									entry.LastUpdatedTimeStamp > LAST_BUILD_TIME ||
									!fs.existsSync(assetsPath);

								if (needsAssetsDownload) {
									tasks.push(downloadFile(url, true));
								}
							}
						} catch (err) {
							console.log("Invalid FeaturedImage URL");
						}
					}

					// Get post content (which now handles all file downloads internally)
					const postContentPromise = entry.IsExternal
						? Promise.resolve({
								interlinkedContentInPage: null,
								entryId: entry.PageId,
							})
						: getPostContentByPostId(entry).then((result) => {
								return {
									interlinkedContentInPage: result.interlinkedContentInPage,
									entryId: entry.PageId,
								};
							});
					tasks.push(postContentPromise);

					// Wait for all tasks for this entry to complete
					await Promise.all(tasks);

					// Return only the interlinkedContentInPage
					return postContentPromise;
				}),
			);

			// Once all entries are processed, call createInterlinkedContentToThisEntry
			createInterlinkedContentToThisEntry(interlinkedContentInEntries);
		},
	},
});
