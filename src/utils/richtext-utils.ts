/**
 * RichText Utilities
 *
 * Shared utility functions for manipulating Notion RichText objects.
 * These functions are used across footnotes, citations, and content extraction.
 *
 * Key principles:
 * - Preserve ALL formatting (bold, italic, colors, etc.)
 * - Perform safe splitting and cloning
 * - Optimize for performance (minimal allocations)
 */

import type { Block, RichText, RichTextLocation } from "../lib/interfaces";

// ============================================================================
// Text Extraction Utilities
// ============================================================================

// Joins plain text from RichText array without adding separators
// Spaces are already included in each RichText.PlainText from Notion
export function joinPlainText(richTexts: RichText[]): string {
	return richTexts.map((rt) => rt.PlainText).join("");
}

// Strips a leading shortcode marker from a RichText array in place (may span
// multiple segments) and returns whether one was found.
export function extractLeadingMarker(
	richTexts: RichText[] | undefined | null,
	marker: string | undefined | null,
): boolean {
	if (!richTexts || richTexts.length === 0 || !marker) return false;
	const joined = joinPlainText(richTexts);
	const leadingWs = joined.length - joined.trimStart().length;
	if (!joined.slice(leadingWs).startsWith(marker)) return false;

	let remaining = leadingWs + marker.length;
	for (const rt of richTexts) {
		if (remaining <= 0) break;
		const pt = rt.PlainText ?? "";
		const take = Math.min(remaining, pt.length);
		rt.PlainText = pt.slice(take);
		if (rt.Text && typeof rt.Text.Content === "string") {
			rt.Text.Content = rt.Text.Content.slice(take);
		}
		remaining -= take;
	}

	// Drop a single leading space left behind on the first non-empty segment.
	for (const rt of richTexts) {
		if (rt.PlainText && rt.PlainText.length) {
			rt.PlainText = rt.PlainText.replace(/^\s+/, "");
			if (rt.Text && typeof rt.Text.Content === "string") {
				rt.Text.Content = rt.Text.Content.replace(/^\s+/, "");
			}
			break;
		}
	}
	return true;
}

// Caches the marker result on `owner` so repeated renders of the same shared
// block (main + popover + clones) agree despite the in-place strip.
export function resolveLeadingMarker(
	owner: any,
	richTexts: RichText[] | undefined | null,
	marker: string | undefined | null,
	cacheKey: string,
): boolean {
	if (owner && typeof owner[cacheKey] === "boolean") {
		return owner[cacheKey] as boolean;
	}
	const result = extractLeadingMarker(richTexts, marker);
	if (owner) owner[cacheKey] = result;
	return result;
}

// ============================================================================
// RichText Cloning
// ============================================================================

/**
 * Deep clones a RichText object, preserving all annotation properties
 * CRITICAL: Must preserve Bold, Italic, Color, Code, etc.
 */
export function cloneRichText(richText: RichText): RichText {
	const text = richText.Text
		? {
				...richText.Text,
				...(richText.Text.Link ? { Link: { ...richText.Text.Link } } : {}),
			}
		: undefined;
	const mention = richText.Mention
		? {
				...richText.Mention,
				...(richText.Mention.Page ? { Page: { ...richText.Mention.Page } } : {}),
				...(richText.Mention.LinkMention
					? { LinkMention: { ...richText.Mention.LinkMention } }
					: {}),
				...(richText.Mention.CustomEmoji
					? { CustomEmoji: { ...richText.Mention.CustomEmoji } }
					: {}),
			}
		: undefined;

	return {
		...richText,
		Annotation: { ...richText.Annotation },
		...(text ? { Text: text } : {}),
		...(richText.Equation ? { Equation: { ...richText.Equation } } : {}),
		...(mention ? { Mention: mention } : {}),
		...(richText.InternalHref ? { InternalHref: { ...richText.InternalHref } } : {}),
	};
}

// ============================================================================
// RichText Splitting and Range Extraction
// ============================================================================

/**
 * Splits a RichText array at a specific character position
 * Returns the part before and after the split point
 *
 * @param richTexts - Array to split
 * @param splitCharPos - Character position in the concatenated string
 * @returns { before, after } arrays
 *
 * OPTIMIZATIONS:
 * - Uses currentPos directly instead of separate rtStart variable
 * - Uses &&= operator for cleaner Text.Content updates
 * - Reuses rtEnd to avoid recalculation
 */
export function splitRichTextsAtCharPosition(
	richTexts: RichText[],
	splitCharPos: number,
): { before: RichText[]; after: RichText[] } {
	const before: RichText[] = [];
	const after: RichText[] = [];
	let currentPos = 0;

	for (const richText of richTexts) {
		const length = richText.PlainText.length;
		const rtEnd = currentPos + length;

		if (splitCharPos <= currentPos) {
			// Entirely after split point
			after.push(richText);
		} else if (splitCharPos >= rtEnd) {
			// Entirely before split point
			before.push(richText);
		} else {
			// Split occurs within this RichText
			const splitOffset = splitCharPos - currentPos;

			// First part (before split)
			if (splitOffset > 0) {
				const beforePart = cloneRichText(richText);
				beforePart.PlainText = richText.PlainText.substring(0, splitOffset);
				beforePart.Text &&= { ...beforePart.Text, Content: beforePart.PlainText };
				before.push(beforePart);
			}

			// Second part (after split)
			if (splitOffset < length) {
				const afterPart = cloneRichText(richText);
				afterPart.PlainText = richText.PlainText.substring(splitOffset);
				afterPart.Text &&= { ...afterPart.Text, Content: afterPart.PlainText };
				after.push(afterPart);
			}
		}

		currentPos = rtEnd;
	}

	return { before, after };
}

/**
 * Extracts a character range from RichText array, preserving all annotations
 * This is the KEY function that maintains formatting in footnote content
 *
 * @param richTexts - Source array
 * @param startChar - Start position (inclusive)
 * @param endChar - End position (exclusive)
 * @returns New RichText array with the extracted range
 *
 * OPTIMIZATIONS:
 * - Uses currentPos directly in overlap check
 * - Uses &&= operator for Text updates
 * - Uses falsy check instead of explicit length comparison
 */
export function extractRichTextRange(
	richTexts: RichText[],
	startChar: number,
	endChar: number,
): RichText[] {
	const result: RichText[] = [];
	let currentPos = 0;

	for (const richText of richTexts) {
		const length = richText.PlainText.length;
		const rtEnd = currentPos + length;

		// Check if this RichText overlaps with the target range
		if (rtEnd > startChar && currentPos < endChar) {
			const sliceStart = Math.max(0, startChar - currentPos);
			const sliceEnd = Math.min(length, endChar - currentPos);
			const slicedText = richText.PlainText.substring(sliceStart, sliceEnd);

			if (slicedText) {
				const slicedRichText = cloneRichText(richText);
				slicedRichText.PlainText = slicedText;
				slicedRichText.Text &&= { ...slicedRichText.Text, Content: slicedText };
				result.push(slicedRichText);
			}
		}

		currentPos = rtEnd;
	}

	// Trim whitespace from first/last elements
	if (result.length) {
		const first = result[0];
		if (first) {
			first.PlainText = first.PlainText.trimStart();
			first.Text &&= { ...first.Text, Content: first.Text.Content.trimStart() };
		}

		const last = result[result.length - 1];
		if (last) {
			last.PlainText = last.PlainText.trimEnd();
			last.Text &&= { ...last.Text, Content: last.Text.Content.trimEnd() };
		}
	}

	return result;
}

// ============================================================================
// Block Utilities
// ============================================================================

/**
 * Gets all RichText array locations within a block
 * This includes content, captions, table cells, etc.
 *
 * OPTIMIZATIONS:
 * - Uses optional chaining with short-circuit AND for captions
 * - Compact helper function
 * - Grouped by block type for better readability
 */
export function getAllRichTextLocations(block: Block): RichTextLocation[] {
	const locations: RichTextLocation[] = [];

	const addLocation = (
		property: string,
		richTexts: RichText[],
		setter: (newRichTexts: RichText[]) => void,
	) => {
		if (richTexts?.length) {
			locations.push({ property, richTexts, setter });
		}
	};

	// Block content
	if (block.Paragraph) {
		addLocation(
			"Paragraph.RichTexts",
			block.Paragraph.RichTexts,
			(rt) => (block.Paragraph!.RichTexts = rt),
		);
	}
	if (block.Heading1) {
		addLocation(
			"Heading1.RichTexts",
			block.Heading1.RichTexts,
			(rt) => (block.Heading1!.RichTexts = rt),
		);
	}
	if (block.Heading2) {
		addLocation(
			"Heading2.RichTexts",
			block.Heading2.RichTexts,
			(rt) => (block.Heading2!.RichTexts = rt),
		);
	}
	if (block.Heading3) {
		addLocation(
			"Heading3.RichTexts",
			block.Heading3.RichTexts,
			(rt) => (block.Heading3!.RichTexts = rt),
		);
	}
	if (block.Heading4) {
		addLocation(
			"Heading4.RichTexts",
			block.Heading4.RichTexts,
			(rt) => (block.Heading4!.RichTexts = rt),
		);
	}
	if (block.BulletedListItem) {
		addLocation(
			"BulletedListItem.RichTexts",
			block.BulletedListItem.RichTexts,
			(rt) => (block.BulletedListItem!.RichTexts = rt),
		);
	}
	if (block.NumberedListItem) {
		addLocation(
			"NumberedListItem.RichTexts",
			block.NumberedListItem.RichTexts,
			(rt) => (block.NumberedListItem!.RichTexts = rt),
		);
	}
	if (block.ToDo) {
		addLocation("ToDo.RichTexts", block.ToDo.RichTexts, (rt) => (block.ToDo!.RichTexts = rt));
	}
	if (block.Quote) {
		addLocation("Quote.RichTexts", block.Quote.RichTexts, (rt) => (block.Quote!.RichTexts = rt));
	}
	if (block.Callout) {
		addLocation(
			"Callout.RichTexts",
			block.Callout.RichTexts,
			(rt) => (block.Callout!.RichTexts = rt),
		);
	}
	if (block.Toggle) {
		addLocation("Toggle.RichTexts", block.Toggle.RichTexts, (rt) => (block.Toggle!.RichTexts = rt));
	}

	// Captions
	block.Code?.Caption &&
		addLocation("Code.Caption", block.Code.Caption, (rt) => (block.Code!.Caption = rt));
	block.NImage?.Caption &&
		addLocation("NImage.Caption", block.NImage.Caption, (rt) => (block.NImage!.Caption = rt));
	block.Video?.Caption &&
		addLocation("Video.Caption", block.Video.Caption, (rt) => (block.Video!.Caption = rt));
	block.NAudio?.Caption &&
		addLocation("NAudio.Caption", block.NAudio.Caption, (rt) => (block.NAudio!.Caption = rt));
	block.File?.Caption &&
		addLocation("File.Caption", block.File.Caption, (rt) => (block.File!.Caption = rt));
	block.Embed?.Caption &&
		addLocation("Embed.Caption", block.Embed.Caption, (rt) => (block.Embed!.Caption = rt));
	block.Bookmark?.Caption &&
		addLocation("Bookmark.Caption", block.Bookmark.Caption, (rt) => (block.Bookmark!.Caption = rt));
	block.LinkPreview?.Caption &&
		addLocation(
			"LinkPreview.Caption",
			block.LinkPreview.Caption,
			(rt) => (block.LinkPreview!.Caption = rt),
		);

	// Tables
	block.Table?.Rows?.forEach((row, rowIndex) => {
		row.Cells.forEach((cell, cellIndex) => {
			addLocation(`Table.Rows[${rowIndex}].Cells[${cellIndex}]`, cell.RichTexts, (rt) => {
				const targetRow = block.Table?.Rows?.[rowIndex];
				const targetCell = targetRow?.Cells[cellIndex];
				if (targetCell) targetCell.RichTexts = rt;
			});
		});
	});

	return locations;
}

/**
 * Gets children array from a block (various block types have children)
 *
 * OPTIMIZATION: Uses OR chaining instead of if-return ladder
 * Functionally identical but more compact
 */
export function getChildrenFromBlock(block: Block): Block[] | null {
	return (
		block.Tab?.Children ||
		block.Paragraph?.Children ||
		block.Heading1?.Children ||
		block.Heading2?.Children ||
		block.Heading3?.Children ||
		block.Heading4?.Children ||
		block.Quote?.Children ||
		block.Callout?.Children ||
		block.Toggle?.Children ||
		block.BulletedListItem?.Children ||
		block.NumberedListItem?.Children ||
		block.ToDo?.Children ||
		block.SyncedBlock?.Children ||
		null
	);
}
