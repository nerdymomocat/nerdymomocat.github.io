import type { MarkdownHeading } from "astro";
import type { Block } from "@/lib/interfaces";
import type { Heading } from "@/types";
import { slugify } from "@/utils/slugify";
import { joinPlainText } from "@/utils/richtext-utils";

const HEADING_BLOCKS = ["heading_1", "heading_2", "heading_3", "heading_4"];

export interface TocItem extends MarkdownHeading {
	subheadings: Array<TocItem>;
}

export function generateToc(headings: ReadonlyArray<MarkdownHeading>) {
	const toc: Array<TocItem> = [];
	const stack: TocItem[] = [];

	headings.forEach((h) => {
		const heading: TocItem = { ...h, subheadings: [] };
		if (heading.depth <= 1) {
			toc.push(heading);
			stack.length = 0;
			stack.push(heading);
			return;
		}

		while (stack.length && stack[stack.length - 1]!.depth >= heading.depth) {
			stack.pop();
		}

		const parent = stack[stack.length - 1];
		if (!parent) {
			// If the document skips heading levels, attach to the nearest available top level.
			toc.push(heading);
			stack.length = 0;
			stack.push(heading);
		} else {
			parent.subheadings.push(heading);
			stack.push(heading);
		}
	});

	return toc;
}

function cleanHeading(heading: Block): Heading {
	let text = "";
	let depth = 0;
	if (heading.Type === "heading_1" && heading.Heading1) {
		text = joinPlainText(heading.Heading1.RichTexts);
		depth = 1;
	}
	if (heading.Type === "heading_2" && heading.Heading2) {
		text = joinPlainText(heading.Heading2.RichTexts);
		depth = 2;
	}
	if (heading.Type === "heading_3" && heading.Heading3) {
		text = joinPlainText(heading.Heading3.RichTexts);
		depth = 3;
	}
	if (heading.Type === "heading_4" && heading.Heading4) {
		text = joinPlainText(heading.Heading4.RichTexts);
		depth = 4;
	}

	return { text, slug: slugify(text), depth };
}

export function buildHeadings(blocks: Block[]): Heading[] | [] | null {
	const headingBlocks: Block[] = [];

	blocks.forEach((block) => {
		// Extract page-level headings
		if (HEADING_BLOCKS.includes(block.Type)) {
			headingBlocks.push(block);
		}

		// Extract headings that are direct children (1 level deep) of special blocks
		// This includes headings inside toggles, callouts, columns, and toggleable headings
		// Note: Only direct children are extracted, NOT nested deeper than 1 level
		if (
			block.Type === "toggle" ||
			block.Type === "tab" ||
			block.Type === "column_list" ||
			block.Type === "callout" ||
			(block.Type === "heading_1" && block.Heading1?.IsToggleable) ||
			(block.Type === "heading_2" && block.Heading2?.IsToggleable) ||
			(block.Type === "heading_3" && block.Heading3?.IsToggleable) ||
			(block.Type === "heading_4" && block.Heading4?.IsToggleable)
		) {
			const childHeadings = getChildHeadings(block);
			headingBlocks.push(...childHeadings);
		}
	});

	return headingBlocks.map(cleanHeading);
}

/**
 * Extracts headings that are DIRECT CHILDREN (1 level deep) of special container blocks.
 *
 * Examples:
 * ✅ Page → Callout → Heading (direct child, INCLUDED)
 * ✅ Page → Toggle → Heading (direct child, INCLUDED)
 * ❌ Page → Callout → Toggle → Heading (2 levels deep, NOT INCLUDED)
 * ❌ Page → Toggle → Callout → Heading (2 levels deep, NOT INCLUDED)
 *
 * This function uses .filter() on the Children array to find only direct heading children,
 * ensuring it does NOT recurse into nested structures.
 */
function getChildHeadings(block: Block): Block[] {
	const childHeadings: Block[] = [];

	if (block.Type === "tab" && block.Tab?.Children) {
		block.Tab.Children.forEach((tabItem) => {
			if (tabItem.Type === "paragraph" && tabItem.Paragraph?.Children) {
				childHeadings.push(
					...tabItem.Paragraph.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
				);
			}
		});
	} else if (block.Type === "toggle" && block.Toggle?.Children) {
		// Extract headings that are direct children of toggle blocks
		childHeadings.push(
			...block.Toggle.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
		);
	} else if (block.Type === "column_list" && block.ColumnList?.Columns) {
		// Extract headings that are direct children of each column
		block.ColumnList.Columns.forEach((column) => {
			if (column.Children) {
				childHeadings.push(
					...column.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
				);
			}
		});
	} else if (block.Type === "callout" && block.Callout?.Children) {
		// Extract headings that are direct children of callout blocks
		childHeadings.push(
			...block.Callout.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
		);
	} else if (
		block.Type === "heading_1" &&
		block.Heading1?.IsToggleable &&
		block.Heading1.Children
	) {
		// Extract headings that are direct children of toggleable H1 headings
		childHeadings.push(
			...block.Heading1.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
		);
	} else if (
		block.Type === "heading_2" &&
		block.Heading2?.IsToggleable &&
		block.Heading2.Children
	) {
		// Extract headings that are direct children of toggleable H2 headings
		childHeadings.push(
			...block.Heading2.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
		);
	} else if (
		block.Type === "heading_3" &&
		block.Heading3?.IsToggleable &&
		block.Heading3.Children
	) {
		// Extract headings that are direct children of toggleable H3 headings
		childHeadings.push(
			...block.Heading3.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
		);
	} else if (
		block.Type === "heading_4" &&
		block.Heading4?.IsToggleable &&
		block.Heading4.Children
	) {
		childHeadings.push(
			...block.Heading4.Children.filter((child) => HEADING_BLOCKS.includes(child.Type)),
		);
	}

	return childHeadings;
}
