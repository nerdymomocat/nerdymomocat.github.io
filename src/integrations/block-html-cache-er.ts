import type { AstroIntegration } from "astro";
import * as fs from "fs/promises";
import * as path from "path";
import { parseDocument } from "htmlparser2";
import { DomUtils } from "htmlparser2";
import { render } from "dom-serializer";
import { getAllPosts, getAllPages } from "../lib/notion/client";
import { getInterlinkedContentInPage } from "../lib/blog-helpers";
import { LAST_BUILD_TIME, HOME_PAGE_SLUG, BUILD_FOLDER_PATHS } from "../constants";

const blocksHtmlCacher = (): AstroIntegration => {
	return {
		name: "blocks-html-cache-er",
		hooks: {
			"astro:build:done": async () => {
				const distDir = "dist";
				const tmpBlocksCacheDir = BUILD_FOLDER_PATHS["blocksHtmlCache"];
				const tmpInterlinkedContentCacheDir = BUILD_FOLDER_PATHS["interlinkedContentHtmlCache"];

				// console.log("Starting blocks-html-cache and interlinked-content-html-cache");
				const posts = await getAllPosts();
				const pages = await getAllPages();
				const allEntries = [...posts, ...pages];
				const allPostsMap = Object.fromEntries(posts.map((p) => [p.PageId, p]));

				for (const entry of allEntries) {
					if (entry.IsExternal) {
						continue;
					}
					const slug = entry.Slug;
					let filePath: string;

					// Special case: if slug is the home page, map it directly to dist/index.html
					if (slug === HOME_PAGE_SLUG) {
						filePath = path.join(distDir, "index.html");
					} else {
						// Determine file path based on whether the entry is a post or a page.
						filePath =
							posts.find((p) => p.Slug === slug) !== undefined
								? path.join(distDir, "posts", slug, "index.html")
								: path.join(distDir, slug, "index.html");
					}

					const blocksCacheFilePath = path.join(tmpBlocksCacheDir, `${slug}.html`);
					const staticInterlinkedContentCacheFilePath = path.join(
						tmpInterlinkedContentCacheDir,
						`${slug}-static.html`,
					);
					const postLastUpdatedBeforeLastBuild = LAST_BUILD_TIME
						? entry.LastUpdatedTimeStamp < LAST_BUILD_TIME
						: false;

					// Check linked pages' timestamps
					const interlinkedContentInPage = getInterlinkedContentInPage(entry.PageId);
					const linkedPageIdsSet = new Set<string>();
					if (interlinkedContentInPage) {
						interlinkedContentInPage.forEach((ref) => {
							if (ref.link_to_pageid) linkedPageIdsSet.add(ref.link_to_pageid);
							if (ref.other_pages) {
								ref.other_pages.forEach((richText) => {
									if (richText.InternalHref?.PageId)
										linkedPageIdsSet.add(richText.InternalHref.PageId);
									else if (richText.Mention?.Page?.PageId)
										linkedPageIdsSet.add(richText.Mention.Page.PageId);
								});
							}
						});
					}
					const linkedPageIds = Array.from(linkedPageIdsSet);
					const linkedPostsUpdated =
						!LAST_BUILD_TIME ||
						(linkedPageIds.length > 0 &&
							linkedPageIds.some((pageId) => {
								const linkedPost = allPostsMap[pageId];
								return linkedPost && linkedPost.LastUpdatedTimeStamp > LAST_BUILD_TIME;
							}));
					const shouldUseCache = postLastUpdatedBeforeLastBuild && !linkedPostsUpdated;

					// Skip caching if shouldUseCache would be false
					let blocksNeedsUpdate = true;
					let staticInterlinkedContentNeedsUpdate = true;
					if (shouldUseCache) {
						try {
							await fs.access(blocksCacheFilePath);
							// console.log(`Skipping blocks for ${slug} (no update and cache exists)`);
							blocksNeedsUpdate = false;
						} catch {}
						try {
							await fs.access(staticInterlinkedContentCacheFilePath);
							// console.log(`Skipping static interlinked content for ${slug} (no update and cache exists)`);
							staticInterlinkedContentNeedsUpdate = false;
						} catch {}
					}

					if (!blocksNeedsUpdate && !staticInterlinkedContentNeedsUpdate) continue;

					try {
						const htmlContent = await fs.readFile(filePath, "utf-8");
						const document = parseDocument(htmlContent);

						// Extract blocks HTML
						if (blocksNeedsUpdate) {
							const divPostBody = DomUtils.findOne(
								(elem) =>
									elem.type === "tag" &&
									elem.name === "div" &&
									!!elem.attribs?.class &&
									elem.attribs.class.split(" ").includes("post-body"),
								document.children,
								true,
							);
							if (divPostBody) {
								const extractedHtml = render(divPostBody.children);
								await fs.writeFile(blocksCacheFilePath, extractedHtml, "utf-8");
								// console.log(`Cached blocks for ${slug} to ${blocksCacheFilePath}`);
							} else {
								console.warn(`No <div class="post-body"> found for ${slug}`);
							}
						}

						// Extract static interlinked content HTML
						if (staticInterlinkedContentNeedsUpdate) {
							const divStaticInterlinkedContent = DomUtils.findOne(
								(elem) =>
									elem.type === "tag" &&
									elem.name === "div" &&
									!!elem.attribs?.class &&
									elem.attribs.class.split(" ").includes("static-interlinked-content"),
								document.children,
								true,
							);
							if (divStaticInterlinkedContent) {
								const staticHtml = render(divStaticInterlinkedContent.children);
								await fs.writeFile(staticInterlinkedContentCacheFilePath, staticHtml, "utf-8");
								// console.log(
								// 	`Cached static interlinked content for ${slug} to ${staticInterlinkedContentCacheFilePath}`,
								// );
							} else {
								console.warn(`No <div class="static-interlinked-content"> found for ${slug}`);
							}
						}
					} catch (error) {
						console.error(`Error processing ${slug}:`, error);
					}
				}
			},
		},
	};
};

export default blocksHtmlCacher;
