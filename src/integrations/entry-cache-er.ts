import type { AstroIntegration } from "astro";
import {
	downloadFile,
	getAllEntries,
	generateFilePath,
	getPostContentByPostId,
	createInterlinkedContentToThisEntry,
} from "../lib/notion/client";
import { LAST_BUILD_TIME } from "../constants";
import fs from "node:fs";

export default (): AstroIntegration => ({
	name: "entry-cache-er",
	hooks: {
		"astro:build:start": async () => {
			const entries = await getAllEntries();

			const interlinkedContentInEntries = await Promise.all(
				entries.map(async (entry) => {
					let tasks = [];

					// Conditionally add the downloadFile task for featured images
					if (
						entry.FeaturedImage &&
						entry.FeaturedImage.Url &&
						!(
							LAST_BUILD_TIME &&
							entry.LastUpdatedTimeStamp < LAST_BUILD_TIME &&
							!fs.existsSync(generateFilePath(new URL(entry.FeaturedImage.Url)))
						)
					) {
						let url;
						try {
							url = new URL(entry.FeaturedImage.Url);
							tasks.push(downloadFile(url, false));
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
