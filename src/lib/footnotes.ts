/**
 * Footnotes Extraction System
 *
 * This module contains ALL footnote extraction logic for Webtrotion.
 * It handles:
 * - End-of-block footnotes ([^ft_a]: content at end of RichText)
 * - Start-of-child-blocks footnotes (child blocks as footnote content)
 * - Block-comments footnotes (Notion comments as footnote content)
 * - Inline LaTeX footnote command (\footnote{content} with rich text support)
 *
 * Key principles:
 * - Preserve ALL RichText formatting (bold, italic, colors, etc.)
 * - Process at BUILD-TIME only (in client.ts)
 * - Components have ZERO logic, only render pre-processed data
 */

import type {
	Block,
	RichText,
	Footnote,
	FootnotesConfig,
	FootnoteExtractionResult,
	FootnoteMarkerInfo,
	RichTextLocation,
	CommentAttachment,
} from "./interfaces";
import { downloadFile, _buildRichText } from "./notion/client";
import {
	cloneRichText,
	joinPlainText,
	splitRichTextsAtCharPosition,
	extractRichTextRange,
	getAllRichTextLocations,
	getChildrenFromBlock,
} from "../utils/richtext-utils";
import crypto from "crypto";

// ============================================================================
// Configuration and Validation
// ============================================================================
function getActiveSource(
	config: FootnotesConfig,
):
	| "end-of-block"
	| "start-of-child-blocks"
	| "block-comments"
	| "inline-latex-footnote-command"
	| null {
	const source = config["in-page-footnotes-settings"].source;
	if (source["end-of-block"]) return "end-of-block";
	if (source["start-of-child-blocks"]) return "start-of-child-blocks";
	if (source["block-comments"]) return "block-comments";
	if (source["inline-latex-footnote-command"]) return "inline-latex-footnote-command";
	return null;
}

// ============================================================================
// Marker Detection and Extraction
// ============================================================================

function findAllFootnoteMarkers(
	locations: RichTextLocation[],
	markerPrefix: string,
): FootnoteMarkerInfo[] {
	const markers: FootnoteMarkerInfo[] = [];
	// Negative lookahead (?!:) ensures we don't match [^ft_a]: (content markers in child blocks)
	// Only match [^ft_a] without a following colon (inline markers)
	const pattern = new RegExp(`\\[\\^${markerPrefix}([\\p{L}\\p{N}_\\-]+)\\](?!:)`, "gu");

	locations.forEach((location) => {
		const fullText = joinPlainText(location.richTexts);
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(fullText)) !== null) {
			const marker = match[1]; // e.g., "a" from "[^ft_a]"
			const fullMarker = match[0]; // e.g., "[^ft_a]"
			const charStart = match.index;
			const charEnd = charStart + fullMarker.length;

			// Find which RichText element this marker is in
			let currentPos = 0;
			let richTextIndex = -1;
			let shouldSkip = false;
			for (let i = 0; i < location.richTexts.length; i++) {
				const len = location.richTexts[i].PlainText.length;
				if (currentPos <= charStart && charStart < currentPos + len) {
					richTextIndex = i;
					const richText = location.richTexts[i];
					// Skip if in code, equation, or mention
					if (richText.Annotation.Code || richText.Equation || richText.Mention) {
						shouldSkip = true;
					}
					break;
				}
				currentPos += len;
			}

			if (shouldSkip) {
				continue;
			}

			if (richTextIndex >= 0) {
				markers.push({
					Marker: marker,
					FullMarker: fullMarker,
					Location: {
						BlockProperty: location.property,
						RichTextIndex: richTextIndex,
						CharStart: charStart,
						CharEnd: charEnd,
					},
				});
			}
		}
	});

	return markers;
}

function splitRichTextWithMarkers(
	location: RichTextLocation,
	markers: FootnoteMarkerInfo[],
): RichText[] {
	// Get markers for this specific location, sorted by position (descending for safe splitting)
	const locationMarkers = markers
		.filter((m) => m.Location.BlockProperty === location.property)
		.sort((a, b) => b.Location.CharStart - a.Location.CharStart);

	if (locationMarkers.length === 0) {
		return location.richTexts;
	}

	let result = [...location.richTexts];

	// Split from right to left to avoid position shift issues
	for (const marker of locationMarkers) {
		const { before, after } = splitRichTextsAtCharPosition(result, marker.Location.CharStart);
		const { after: afterMarker } = splitRichTextsAtCharPosition(after, marker.FullMarker.length);

		// Create fresh marker with default formatting (like citations does)
		const markerRichText: RichText = {
			PlainText: marker.FullMarker,
			Text: { Content: marker.FullMarker },
			Annotation: {
				Bold: false,
				Italic: false,
				Strikethrough: false,
				Underline: false,
				Code: false,
				Color: "default",
			},
			IsFootnoteMarker: true,
			FootnoteRef: marker.Marker,
		};

		result = [...before, markerRichText, ...afterMarker];
	}

	return result;
}

// ============================================================================
// End-of-Block Extraction
// ============================================================================

function extractFootnoteDefinitionsFromRichText(
	richTexts: RichText[],
	markerPrefix: string,
	cachedFullText?: string,
): {
	cleanedRichTexts: RichText[];
	footnoteDefinitions: Map<string, RichText[]>;
} {
	const fullText = cachedFullText || joinPlainText(richTexts);

	// Find the start of footnote definitions section
	// Pattern: \n\n[^
	const firstDefMatch = fullText.match(/\n\n\[\^/);

	if (!firstDefMatch || firstDefMatch.index === undefined) {
		return { cleanedRichTexts: richTexts, footnoteDefinitions: new Map() };
	}

	const splitPoint = firstDefMatch.index;

	// Split at the first definition
	const { before: mainContent, after: definitionsSection } = splitRichTextsAtCharPosition(
		richTexts,
		splitPoint,
	);

	// Parse individual footnote definitions from the definitions section
	const definitionsText = fullText.substring(splitPoint);
	const footnoteDefinitions = parseFootnoteDefinitionsFromRichText(
		definitionsSection,
		markerPrefix,
		definitionsText,
	);

	return { cleanedRichTexts: mainContent, footnoteDefinitions };
}

/**
 * Parses individual footnote definitions from the definitions section
 * Format: [^ft_a]: content\n\n[^ft_b]: more content
 */
function parseFootnoteDefinitionsFromRichText(
	definitionsRichTexts: RichText[],
	markerPrefix: string,
	definitionsText: string,
): Map<string, RichText[]> {
	const definitions = new Map<string, RichText[]>();
	const pattern = new RegExp(`\\n\\n\\[\\^${markerPrefix}([\\p{L}\\p{N}_\\-]+)\\]:\\s*`, "gu");

	const matches: Array<{ marker: string; start: number; end: number; matchIndex: number }> = [];
	let match: RegExpExecArray | null;

	// Find all definition starts
	while ((match = pattern.exec(definitionsText)) !== null) {
		matches.push({
			marker: match[1],
			start: match.index + match[0].length, // After the "[^ft_a]: " part
			matchIndex: match.index, // Start of "\n\n[^ft_a]:"
			end: -1, // Will be set later
		});
	}

	// Set end positions (before the next "\n\n[^" starts)
	for (let i = 0; i < matches.length; i++) {
		if (i < matches.length - 1) {
			// End at the position where next footnote marker starts (before the \n\n)
			matches[i].end = matches[i + 1].matchIndex;
		} else {
			matches[i].end = definitionsText.length;
		}
	}

	// Extract RichText ranges for each definition
	matches.forEach((m) => {
		const contentRichTexts = extractRichTextRange(definitionsRichTexts, m.start, m.end);

		// Skip empty content (edge case handling - silent skip)
		if (contentRichTexts.length === 0 || joinPlainText(contentRichTexts).trim() === "") {
			return;
		}

		definitions.set(m.marker, contentRichTexts);
	});

	return definitions;
}

/**
 * Extracts footnotes from end-of-block format
 * Main entry point for end-of-block source type
 */
function extractEndOfBlockFootnotes(
	block: Block,
	config: FootnotesConfig,
): FootnoteExtractionResult {
	const locations = getAllRichTextLocations(block);
	const footnotes: Footnote[] = [];
	const markerPrefix = config["in-page-footnotes-settings"]["marker-prefix"];

	// Find all markers first
	const markers = findAllFootnoteMarkers(locations, markerPrefix);
	if (markers.length === 0) {
		return {
			footnotes: [],
			hasProcessedRichTexts: false,
			hasProcessedChildren: false,
		};
	}

	// Performance: Cache fullText for each location
	const fullTextCache = new Map<string, string>();
	locations.forEach((loc) => {
		fullTextCache.set(loc.property, joinPlainText(loc.richTexts));
	});

	// Process each location
	locations.forEach((location) => {
		const cachedText = fullTextCache.get(location.property);

		// Extract footnote definitions as RichText arrays (not strings!)
		const { cleanedRichTexts, footnoteDefinitions } = extractFootnoteDefinitionsFromRichText(
			location.richTexts,
			markerPrefix,
			cachedText,
		);

		// Create Footnote objects from extracted definitions
		footnoteDefinitions.forEach((contentRichTexts, marker) => {
			const hasMarker = markers.some((m) => m.Marker === marker);
			// Only create footnote if there's a marker in the text (silent skip orphaned definitions)
			if (hasMarker) {
				footnotes.push({
					Marker: marker,
					FullMarker: `[^${markerPrefix}${marker}]`,
					Content: {
						Type: "rich_text",
						RichTexts: contentRichTexts,
					},
					SourceLocation: location.property.includes("Caption")
						? "caption"
						: location.property.includes("Table")
							? "table"
							: "content",
				});
			}
		});

		// Update the location with cleaned RichTexts (definitions removed)
		location.setter(cleanedRichTexts);

		// Split markers in the cleaned RichTexts
		const splitRichTexts = splitRichTextWithMarkers(
			{ ...location, richTexts: cleanedRichTexts },
			markers,
		);
		location.setter(splitRichTexts);
	});

	return { footnotes, hasProcessedRichTexts: true, hasProcessedChildren: false };
}

// ============================================================================
// Start-of-Child-Blocks Extraction
// ============================================================================

/**
 * Creates a regex pattern to match footnote content markers
 * Pattern: ^\[^ft_(\w+)\]:\s* matches [^ft_a]: at line start and captures "a"
 */
function createContentPattern(markerPrefix: string): RegExp {
	const escapedPrefix = markerPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`^\\[\\^${escapedPrefix}([\\p{L}\\p{N}_\\-]+)\\]:\\s*`, "gmu");
}

// Sets children array in a block
function setChildrenInBlock(block: Block, children: Block[]): void {
	if (block.Paragraph) block.Paragraph.Children = children;
	else if (block.Heading1) block.Heading1.Children = children;
	else if (block.Heading2) block.Heading2.Children = children;
	else if (block.Heading3) block.Heading3.Children = children;
	else if (block.Quote) block.Quote.Children = children;
	else if (block.Callout) block.Callout.Children = children;
	else if (block.Toggle) block.Toggle.Children = children;
	else if (block.BulletedListItem) block.BulletedListItem.Children = children;
	else if (block.NumberedListItem) block.NumberedListItem.Children = children;
	else if (block.ToDo) block.ToDo.Children = children;
	else if (block.SyncedBlock) block.SyncedBlock.Children = children;
}

/**
 * Removes marker prefix from start of RichText array
 * Used to clean [^ft_a]: prefix from child block content
 */
function removeMarkerPrefix(richTexts: RichText[], prefixLength: number): RichText[] {
	if (richTexts.length === 0 || prefixLength === 0) {
		return richTexts;
	}

	const result = [...richTexts];
	let remaining = prefixLength;

	for (let i = 0; i < result.length && remaining > 0; i++) {
		const richText = result[i];
		const length = richText.PlainText.length;

		if (length <= remaining) {
			// Remove this entire RichText
			result.splice(i, 1);
			remaining -= length;
			i--; // Adjust index after splice
		} else {
			// Truncate this RichText
			const truncated = cloneRichText(richText);
			if (truncated.Text) {
				truncated.Text = {
					...truncated.Text,
					Content: truncated.Text.Content.substring(remaining),
				};
			}
			truncated.PlainText = truncated.PlainText.substring(remaining);
			result[i] = truncated;
			remaining = 0;
		}
	}

	return result;
}

/**
 * Extracts footnotes from start-of-child-blocks format
 * Child blocks at the start are footnote content
 *
 * Format: If block has markers [^ft_a] and [^ft_b], first 2 child blocks
 * should start with [^ft_a]: and [^ft_b]: respectively
 */
function extractStartOfChildBlocksFootnotes(
	block: Block,
	config: FootnotesConfig,
): FootnoteExtractionResult {
	const locations = getAllRichTextLocations(block);
	const footnotes: Footnote[] = [];
	const markerPrefix = config["in-page-footnotes-settings"]["marker-prefix"];

	// Find all markers
	const markers = findAllFootnoteMarkers(locations, markerPrefix);

	if (markers.length === 0) {
		return {
			footnotes: [],
			hasProcessedRichTexts: false,
			hasProcessedChildren: false,
		};
	}

	// Count how many markers we found
	const markerCount = markers.length;

	// Get children blocks
	const children = getChildrenFromBlock(block);

	// Scan children to find which ones are footnote blocks (start with [^marker]:)
	// We only check up to markerCount children, but not all may be footnote blocks
	const contentPattern = createContentPattern(markerPrefix);
	const childrenToCheck = children ? children.slice(0, Math.max(markerCount, children.length)) : [];
	const footnoteBlockIndices: number[] = [];
	const remainingChildren: Block[] = [];

	childrenToCheck.forEach((child, index) => {
		const blockLocations = getAllRichTextLocations(child);

		if (blockLocations.length === 0) {
			remainingChildren.push(child);
			return;
		}

		const blockText = joinPlainText(blockLocations[0].richTexts);

		// Reset regex state before each exec
		contentPattern.lastIndex = 0;
		const match = contentPattern.exec(blockText);

		if (!match) {
			remainingChildren.push(child);
			return;
		}

		const marker = match[1];

		// Remove the [^marker]: prefix from the block
		const cleanedRichTexts = removeMarkerPrefix(blockLocations[0].richTexts, match[0].length);
		blockLocations[0].setter(cleanedRichTexts);

		// Create footnote with the entire block (and its descendants) as content
		footnotes.push({
			Marker: marker,
			FullMarker: `[^${markerPrefix}${marker}]`,
			Content: {
				Type: "blocks",
				Blocks: [child],
			},
			SourceLocation: "content",
		});

		footnoteBlockIndices.push(index);
	});

	// Add any remaining children beyond the first markerCount
	if (children && children.length > markerCount) {
		remainingChildren.push(...children.slice(markerCount));
	}

	// Update children to remove footnote blocks
	setChildrenInBlock(block, remainingChildren);

	// Split markers in RichTexts
	locations.forEach((location) => {
		const splitRichTexts = splitRichTextWithMarkers(location, markers);
		location.setter(splitRichTexts);
	});

	return {
		footnotes,
		hasProcessedRichTexts: true,
		hasProcessedChildren: true,
	};
}

// ============================================================================
// Block-Comments Extraction
// ============================================================================

/**
 * Extracts footnotes from Notion block comments
 *
 * PERFORMANCE OPTIMIZATION: Only calls Comments API if markers are found in block.
 * This avoids expensive API calls for blocks without footnote markers.
 */
async function extractBlockCommentsFootnotes(
	block: Block,
	config: FootnotesConfig,
	notionClient?: any,
): Promise<FootnoteExtractionResult> {
	const locations = getAllRichTextLocations(block);
	const footnotes: Footnote[] = [];
	const markerPrefix = config["in-page-footnotes-settings"]["marker-prefix"];

	// Find all markers in the block
	const markers = findAllFootnoteMarkers(locations, markerPrefix);

	// OPTIMIZATION: Skip API call if no markers found in this block
	if (markers.length === 0) {
		return {
			footnotes: [],
			hasProcessedRichTexts: false,
			hasProcessedChildren: false,
		};
	}

	// Ensure we have a Notion client
	if (!notionClient || !notionClient.comments) {
		console.warn("Footnotes: Comments API requested but Notion client not available");
		return {
			footnotes: [],
			hasProcessedRichTexts: false,
			hasProcessedChildren: false,
		};
	}

	try {
		// Only fetch comments if we found footnote markers
		// This saves expensive API calls for blocks without footnotes
		const response: any = await notionClient.comments.list({
			block_id: block.Id,
		});

		const comments = response.results || [];
		const contentPattern = createContentPattern(markerPrefix);

		// Process each comment (using for loop to support async/await)
		for (const comment of comments) {
			const richTextArray = comment.rich_text || [];

			if (richTextArray.length === 0) {
				continue;
			}

			// Check if this comment is a footnote (starts with [^marker]:)
			const firstText = richTextArray[0]?.plain_text || "";
			const match = contentPattern.exec(firstText);

			if (!match) {
				continue; // Not a footnote comment
			}

			const marker = match[1];

			// Convert Notion comment rich_text to our RichText format
			const contentRichTexts = await Promise.all(richTextArray.map(_buildRichText));

			// Remove the [^marker]: prefix from first RichText
			const cleanedRichTexts = removeMarkerPrefix(contentRichTexts, match[0].length);

			// Handle attachments (ALL TYPES) - download and convert to local paths

			const attachments: CommentAttachment[] = [];

			if (comment.attachments && comment.attachments.length > 0) {
				for (const attachment of comment.attachments) {
					if (attachment.file?.url) {
						const originalUrl = attachment.file.url;

						const isImage = attachment.category === "image";

						// Download the file, with optimization enabled only for images

						await downloadFile(new URL(originalUrl), isImage);

						const fileName = new URL(originalUrl).pathname.split("/").pop() || "download";

						attachments.push({
							Category: attachment.category,

							Url: originalUrl,

							Name: fileName,

							ExpiryTime: attachment.file.expiry_time,
						});
					}
				}
			}

			footnotes.push({
				Marker: marker,
				FullMarker: `[^${markerPrefix}${marker}]`,
				Content: {
					Type: "comment",
					RichTexts: cleanedRichTexts,
					CommentAttachments: attachments.length > 0 ? attachments : undefined,
				},
				SourceLocation: "comment",
			});
		}

		// Split markers in RichTexts
		locations.forEach((location) => {
			const splitRichTexts = splitRichTextWithMarkers(location, markers);
			location.setter(splitRichTexts);
		});

		return {
			footnotes,
			hasProcessedRichTexts: true,
			hasProcessedChildren: false,
		};
	} catch (error: any) {
		// Check if this is a permission error (403)
		if (error?.status === 403 || error?.code === "restricted_resource") {
			console.warn(
				"Footnotes: block-comments source is enabled but Comments API permission is not available. " +
					"Please grant comment permissions to your Notion integration, or switch to end-of-block, inline-latex-footnote-command or start-of-child-blocks as the source.",
			);
		} else {
			console.error(`Footnotes: Error fetching comments for block ${block.Id}:`, error);
		}
		// Continue without footnotes rather than failing
		return {
			footnotes: [],
			hasProcessedRichTexts: false,
			hasProcessedChildren: false,
		};
	}
}

// ============================================================================
// Inline LaTeX Footnote Command Extraction
// ============================================================================

/**
 * Finds the matching closing brace for an opening brace, handling escaped braces
 * Escaped braces (\{ and \}) are treated as literal characters, not structural braces
 * This allows content to be copied to LaTeX documents while preserving escapes
 */
function findMatchingClosingBrace(text: string, startPos: number): number {
	let depth = 1;
	let pos = startPos;

	while (depth > 0 && pos < text.length) {
		const char = text[pos];
		const prevChar = pos > 0 ? text[pos - 1] : "";

		// Check if this brace is escaped (preceded by backslash)
		const isEscaped = prevChar === "\\";

		if (!isEscaped) {
			if (char === "{") {
				depth++;
			} else if (char === "}") {
				depth--;
			}
		}

		if (depth > 0) {
			pos++;
		}
	}

	return depth === 0 ? pos : -1;
}

/**
 * Extracts footnotes from inline LaTeX-style command: \footnote{content}
 * Supports rich text formatting inside braces
 * Escaped braces (\{ and \}) are treated as literals for LaTeX compatibility
 *
 * Main entry point for inline-latex-footnote-command source type
 */
function extractInlineLatexFootnotes(
	block: Block,
	config: FootnotesConfig,
): FootnoteExtractionResult {
	const locations = getAllRichTextLocations(block);
	const footnotes: Footnote[] = [];
	let autoMarkerCounter = 0;

	// Generate hash of block ID for unique markers across blocks
	const blockHash = crypto.createHash("md5").update(block.Id).digest("hex").substring(0, 8);

	// Process each location
	locations.forEach((location) => {
		const fullText = joinPlainText(location.richTexts);

		// Find all \footnote{ patterns
		const pattern = /\\footnote\{/g;
		const matches: Array<{
			marker: string;
			fullMarker: string;
			commandStart: number;
			commandEnd: number;
			contentStart: number;
			contentEnd: number;
		}> = [];

		let match: RegExpExecArray | null;
		while ((match = pattern.exec(fullText)) !== null) {
			const commandStart = match.index;
			const openBracePos = match.index + match[0].length - 1; // Position of {
			const contentStart = openBracePos + 1; // Position after {

			// Check if this match is inside code, equation, or mention (skip if so)
			let currentPos = 0;
			let shouldSkip = false;
			for (const richText of location.richTexts) {
				const rtEnd = currentPos + richText.PlainText.length;
				if (currentPos <= commandStart && commandStart < rtEnd) {
					// Skip if in code, equation, or mention
					if (richText.Annotation.Code || richText.Equation || richText.Mention) {
						shouldSkip = true;
					}
					break;
				}
				currentPos = rtEnd;
			}

			if (shouldSkip) {
				continue;
			}

			// Find matching closing brace
			const closeBracePos = findMatchingClosingBrace(fullText, contentStart);

			if (closeBracePos === -1) {
				// No matching brace found - skip this marker
				console.warn(
					`Footnotes: Unmatched brace in \\footnote command at position ${commandStart} in block ${block.Id}`,
				);
				continue;
			}

			const contentEnd = closeBracePos;
			const commandEnd = closeBracePos + 1; // Position after }

			// Generate auto marker with block hash for uniqueness
			const autoMarker = `inline_auto_${blockHash}_${++autoMarkerCounter}`;
			const fullMarker = `\\footnote{...}`; // Display marker

			matches.push({
				marker: autoMarker,
				fullMarker,
				commandStart,
				commandEnd,
				contentStart,
				contentEnd,
			});
		}

		if (matches.length === 0) {
			return; // No footnotes in this location
		}

		// Process matches from right to left to avoid position shifts
		const reversedMatches = [...matches].reverse();
		let modifiedRichTexts = [...location.richTexts];

		reversedMatches.forEach((m) => {
			// Extract footnote content (between braces)
			const contentRichTexts = extractRichTextRange(
				location.richTexts,
				m.contentStart,
				m.contentEnd,
			);

			// Unescape braces in content for display (but source preserves \{ and \})
			// Only unescape text elements, not equations or mentions
			const unescapedContent = contentRichTexts.map((rt) => {
				// Skip unescaping for equations and mentions
				if (rt.Equation || rt.Mention) {
					return rt;
				}
				const unescaped = cloneRichText(rt);
				unescaped.PlainText = rt.PlainText.replaceAll("\\{", "{").replaceAll("\\}", "}");
				if (unescaped.Text) {
					unescaped.Text.Content = rt.Text.Content.replaceAll("\\{", "{").replaceAll("\\}", "}");
				}
				return unescaped;
			});

			// Skip empty content
			if (unescapedContent.length === 0 || joinPlainText(unescapedContent).trim() === "") {
				console.warn(
					`Footnotes: Empty content in \\footnote command at position ${m.commandStart} in block ${block.Id}`,
				);
				return;
			}

			// Create footnote object
			footnotes.unshift({
				// unshift to maintain left-to-right order
				Marker: m.marker,
				FullMarker: m.fullMarker,
				Content: {
					Type: "rich_text",
					RichTexts: unescapedContent,
				},
				SourceLocation: location.property.includes("Caption")
					? "caption"
					: location.property.includes("Table")
						? "table"
						: "content",
			});

			// Replace \footnote{content} with marker in RichText
			const { before, after } = splitRichTextsAtCharPosition(modifiedRichTexts, m.commandStart);
			const { after: afterCommand } = splitRichTextsAtCharPosition(
				after,
				m.commandEnd - m.commandStart,
			);

			// Create fresh marker with default formatting (like citations does)
			const markerRichText: RichText = {
				PlainText: m.fullMarker,
				Text: { Content: m.fullMarker },
				Annotation: {
					Bold: false,
					Italic: false,
					Strikethrough: false,
					Underline: false,
					Code: false,
					Color: "default",
				},
				IsFootnoteMarker: true,
				FootnoteRef: m.marker,
			};

			modifiedRichTexts = [...before, markerRichText, ...afterCommand];
		});

		// Update location with modified RichTexts
		location.setter(modifiedRichTexts);
	});

	return {
		footnotes,
		hasProcessedRichTexts: true,
		hasProcessedChildren: false,
	};
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Extract footnotes from a block with support for all footnote sources
 *
 * Supports four modes based on configuration:
 * - "end-of-block": Inline footnotes like ^[text]
 * - "start-of-child-blocks": Child blocks as footnote content
 * - "block-comments": Footnotes from Notion Comments API
 * - "inline-latex-footnote-command": LaTeX-style \footnote{content} commands
 *
 * Called from client.ts during block fetching (getAllBlocksByBlockId)
 */
export async function extractFootnotesFromBlock(
	block: Block,
	config: FootnotesConfig,
	notionClient?: any,
): Promise<FootnoteExtractionResult> {
	const source = getActiveSource(config);

	switch (source) {
		case "end-of-block":
			return extractEndOfBlockFootnotes(block, config);
		case "start-of-child-blocks":
			return extractStartOfChildBlocksFootnotes(block, config);
		case "block-comments":
			return await extractBlockCommentsFootnotes(block, config, notionClient);
		case "inline-latex-footnote-command":
			return extractInlineLatexFootnotes(block, config);
		default:
			return {
				footnotes: [],
				hasProcessedRichTexts: false,
				hasProcessedChildren: false,
			};
	}
}
