import { getAllPosts, getAllPages, getAllTags } from "@/lib/notion/client";
import { resolvePostHref, getPostLink, getNotionImage } from "@/lib/blog-helpers";
import { getImage } from "astro:assets";
import { HIDE_UNDERSCORE_SLUGS_IN_LISTS } from "@/constants";
import { getCollections, slugify } from "@/utils";
import type { Post, FileObject, Emoji } from "@/lib/interfaces";

// Static "go-to" index consumed by the search popup's "/" path-search mode.
// It lists every navigable page — posts, pages, collection indexes and tag
// pages — so the runtime can match on title AND path without touching the
// Pagefind content index. Each entry is intentionally small:
//   { t: title, u: url, k: kind, e?: excerpt, ie?: iconEmoji, im?: iconImage }
// Pages render a generic bookmark glyph; posts carry their own Notion icon;
// tags/collections carry none. Excerpt (when present) is shown as the subtext.
type GotoKind = "page" | "post" | "tag" | "collection";
interface GotoItem {
	t: string;
	u: string;
	k: GotoKind;
	e?: string;
	ie?: string;
	im?: string;
}

const resolveIcon = async (
	icon: FileObject | Emoji | null,
): Promise<{ ie?: string; im?: string }> => {
	if (!icon) return {};
	if ("Emoji" in icon && icon.Emoji) return { ie: icon.Emoji };
	if ("Url" in icon && icon.Url) {
		try {
			const downloaded = await getNotionImage(new URL(icon.Url));
			if (!downloaded) return { im: icon.Url };
			// Reference an emitted asset, not the raw original `.src`. Raster
			// originals (.png/.jpg) are never written to the build output, so
			// `downloaded.src` would 404. Use the SAME width:48 params as
			// PagefindIconMetadata so both resolve to the identical hashed
			// variant — that component emits it into each post's HTML, which is
			// what the image-cache cleaner scans, so the file is preserved in
			// dist and this JSON reference stays valid.
			try {
				return { im: (await getImage({ src: downloaded, width: 48 })).src };
			} catch {
				return { im: downloaded.src || icon.Url };
			}
		} catch {
			return { im: icon.Url };
		}
	}
	return {};
};

export const GET = async () => {
	const [posts, pages, collections, tags] = await Promise.all([
		getAllPosts(),
		getAllPages(),
		getCollections(),
		getAllTags(),
	]);

	const filterEntries = (entries: Post[]) => {
		const filtered = HIDE_UNDERSCORE_SLUGS_IN_LISTS
			? entries.filter((entry) => !entry.Slug.startsWith("_"))
			: entries;
		return filtered.filter((entry) => !entry.IsExternal || !!entry.ExternalContent);
	};

	// Posts keep their own Notion icon (downloaded at build time); pages fall back
	// to the generic bookmark glyph, so we only resolve icons for posts.
	const postItems: GotoItem[] = await Promise.all(
		filterEntries(posts).map(async (entry): Promise<GotoItem> => ({
			t: entry.Title,
			u: resolvePostHref(entry, { forceIsRoot: false }),
			k: "post",
			...(entry.Excerpt ? { e: entry.Excerpt } : {}),
			...(await resolveIcon(entry.Icon)),
		})),
	);

	const pageItems: GotoItem[] = filterEntries(pages).map((entry) => ({
		t: entry.Title,
		u: resolvePostHref(entry, { forceIsRoot: true }),
		k: "page",
		...(entry.Excerpt ? { e: entry.Excerpt } : {}),
	}));

	const collectionItems: GotoItem[] = collections!.map((name) => ({
		t: name,
		u: getPostLink(`collections/${slugify(name)}`, true),
		k: "collection",
	}));

	const tagItems: GotoItem[] = tags.map((tag) => ({
		t: tag.name,
		u: getPostLink(`tags/${slugify(tag.name)}`, true),
		k: "tag",
	}));

	const items = [...postItems, ...pageItems, ...collectionItems, ...tagItems].filter(
		(item) => item.t && item.u,
	);

	const seen = new Set<string>();
	const deduped = items.filter((item) => {
		if (seen.has(item.u)) return false;
		seen.add(item.u);
		return true;
	});

	return new Response(JSON.stringify(deduped), {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
