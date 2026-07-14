import { getAllPages, getDataSource } from "@/lib/notion/client";

import { MENU_PAGES_COLLECTION, HOME_PAGE_SLUG } from "@/constants";
import { slugify } from "@/utils/slugify";
import { getNavLink, getNotionImage } from "@/lib/blog-helpers";
export {
	getFormattedDate,
	getFormattedDateWithTime,
	getCalendarDateParts,
	getCalendarDateString,
	getDateObject,
	getDateTimeValue,
	getMachineDateISOString,
	areDifferentDates,
} from "@/utils/date";
export { generateToc, buildHeadings } from "@/utils/generateToc";
export type { TocItem } from "@/utils/generateToc";
export { getWebmentionsForUrl } from "@/utils/webmentions";
export { slugify } from "@/utils/slugify";
export {
	numberToAlphabet,
	getSymbolForLinkedContent,
	LINKED_CONTENT_SYMBOLS,
} from "@/utils/numbering";

export async function getCollections() {
	const { propertiesRaw } = await getDataSource();

	return propertiesRaw.Collection.select!.options.map(({ name }) => name).filter(
		(name) => name !== MENU_PAGES_COLLECTION,
	);
}

export async function getCollectionsWDesc() {
	const { propertiesRaw } = await getDataSource();

	return propertiesRaw.Collection.select!.options.filter(
		({ name }) => name !== MENU_PAGES_COLLECTION,
	).map(({ name, description }) => ({ name, description }));
}

export type MenuIcon = { emoji?: string; image?: string };

export async function getMenu(): Promise<
	{
		title: string;
		path: string;
		icon?: MenuIcon;
		children?: { title: string; path: string }[];
	}[]
> {
	const withTrailingSlash = (path: string) => {
		if (path === "/") return "/";
		return path.endsWith("/") ? path : `${path}/`;
	};
	const resolveIcon = async (
		icon: { Emoji?: string; Url?: string } | null | undefined,
	): Promise<MenuIcon | undefined> => {
		if (!icon) return undefined;
		if ("Emoji" in icon && icon.Emoji) return { emoji: icon.Emoji };
		if ("Url" in icon && icon.Url) {
			try {
				const downloaded = await getNotionImage(new URL(icon.Url));
				return { image: downloaded?.src || icon.Url };
			} catch {
				return { image: icon.Url };
			}
		}
		return undefined;
	};
	const pages = await getAllPages();
	const collections = await getCollections();
	const collectionLinks = collections.map((name) => ({
		title: name,
		path: withTrailingSlash(getNavLink("/collections/" + slugify(name))),
	}));

	const rankedPages = pages
		.map((page) => ({
			...page,
			// Assign rank -1 to homePageSlug and 99 to pages with no rank
			Rank:
				page.Slug === HOME_PAGE_SLUG
					? -1
					: page.Rank === undefined || page.Rank === null
						? 99
						: page.Rank,
		}))
		.sort((a, b) => a.Rank - b.Rank);

	const pageLinks = await Promise.all(
		rankedPages.map(async (page) => ({
			title: page.Title,
			path: withTrailingSlash(getNavLink(page.Slug === HOME_PAGE_SLUG ? "/" : "/" + page.Slug)),
			icon: await resolveIcon(page.Icon),
		})),
	);

	return [...pageLinks, ...collectionLinks];
}
