/**
 * Citations Extraction System
 *
 * This module contains ALL citation extraction logic for Webtrotion.
 * It handles:
 * - Fetching BibTeX files from GitHub, Dropbox, Google Drive
 * - Parsing BibTeX entries using citation-js
 * - Extracting citations from text ([@key], \cite{key}, #cite(key))
 * - Formatting citations as APA or IEEE
 * - Generating bibliographies
 *
 * Key principles:
 * - Preserve ALL RichText formatting (bold, italic, colors, etc.)
 * - Process at BUILD-TIME only (in client.ts)
 * - Components have ZERO logic, only render pre-processed data
 * - Cache BibTeX files with timestamp checking
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-csl";
import type {
	Block,
	RichText,
	Citation,
	CitationsConfig,
	BibSourceInfo,
	CitationExtractionResult,
	ParsedCitationEntry,
	Footnote,
} from "./interfaces";
import {
	getAllRichTextLocations,
	cloneRichText,
	joinPlainText,
	getChildrenFromBlock,
	splitRichTextsAtCharPosition,
} from "../utils/richtext-utils";
import { BUILD_FOLDER_PATHS, LAST_BUILD_TIME, BIBLIOGRAPHY_STYLE } from "../constants";

// ============================================================================
// URL Normalization and Source Detection
// ============================================================================

/**
 * Converts a share link to a direct-download URL and provides timestamp checking info
 *
 * Supports:
 * - GitHub Gist: https://gist.github.com/user/id
 * - GitHub Repo: https://github.com/user/repo/blob/branch/path/file.bib
 * - Dropbox: https://www.dropbox.com/scl/fi/.../file.bib?dl=0
 * - Google Drive: https://drive.google.com/file/d/FILE_ID/view
 */
export function get_bib_source_info(url: string): BibSourceInfo {
	// GitHub Gist
	const gistMatch = url.match(/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)/);
	if (gistMatch) {
		const [, username, gistId] = gistMatch;
		return {
			source: "github-gist",
			download_url: `https://gist.githubusercontent.com/${username}/${gistId}/raw`,
			updated_url: `https://api.github.com/gists/${gistId}`,
			updated_instructions: `curl -s <updated_url> | jq '.updated_at'`,
		};
	}

	// GitHub Repo File
	const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/);
	if (repoMatch) {
		const [, owner, repo, branch, filePath] = repoMatch;
		return {
			source: "github-repo",
			download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
			updated_url: `https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}`,
			updated_instructions: `curl -s <updated_url> | jq '.[0].commit.committer.date'`,
		};
	}

	// Dropbox
	if (url.includes("dropbox.com")) {
		return {
			source: "dropbox",
			download_url: url.replace("dl=0", "dl=1"),
			updated_url: null,
			updated_instructions: "Dropbox shared links do not expose public timestamps",
		};
	}

	// Google Drive
	const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
	if (driveMatch) {
		const [, fileId] = driveMatch;
		return {
			source: "google-drive",
			download_url: `https://drive.google.com/uc?export=download&id=${fileId}`,
			updated_url: null,
			updated_instructions: "Google Drive shared links do not expose public timestamps",
		};
	}

	// Unknown source - return as-is
	return {
		source: "unknown",
		download_url: url,
		updated_url: null,
		updated_instructions: null,
	};
}

// ============================================================================
// BibTeX File Fetching with Caching
// ============================================================================

/**
 * Gets last-updated timestamp for a GitHub source
 * Returns null if unavailable or on error
 */
async function getGitHubLastUpdated(updatedUrl: string): Promise<string | null> {
	try {
		const response = await axios.get(updatedUrl, { timeout: 5000 });
		if (updatedUrl.includes("/gists/")) {
			// Gist API response
			return response.data?.updated_at || null;
		} else {
			// Repo commits API response
			return response.data?.[0]?.commit?.committer?.date || null;
		}
	} catch (error) {
		console.warn(`Failed to get last-updated timestamp from ${updatedUrl}:`, error);
		return null;
	}
}

/**
 * Fetches a BibTeX file with intelligent caching
 *
 * Strategy:
 * - Check if cached file exists
 * - For GitHub: Check last-updated timestamp, skip fetch if unchanged
 * - For Dropbox/Drive: Fetch every time (no public timestamp) unless within same build
 * - Save to cache with metadata
 */
export async function fetchBibTeXFile(url: string): Promise<string> {
	const sourceInfo = get_bib_source_info(url);
	const urlHash = crypto.createHash("md5").update(url).digest("hex");
	const cacheDir = BUILD_FOLDER_PATHS.bibFilesCache;
	const parsedFilePath = path.join(cacheDir, `parsed_${urlHash}.json`);

	// Ensure cache directory exists
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}

	const isCached = fs.existsSync(parsedFilePath);

	// Determine if we should refetch
	let shouldRefetch = !isCached;

	if (isCached) {
		// Dropbox/Drive: ALWAYS refetch (no public timestamp API to verify changes)
		if (!sourceInfo.updated_url) {
			console.log(`BibTeX file ${url} from Dropbox/Drive, re-fetching (cannot verify changes)...`);
			shouldRefetch = true;
		}
		// GitHub sources: Can check remote timestamp
		else {
			// If LAST_BUILD_TIME is not available, we have to be safe and refetch
			if (!LAST_BUILD_TIME) {
				console.log(`LAST_BUILD_TIME not available, re-fetching ${url}...`);
				shouldRefetch = true;
			} else {
				const remoteLastUpdated = await getGitHubLastUpdated(sourceInfo.updated_url);
				if (remoteLastUpdated && new Date(remoteLastUpdated) > LAST_BUILD_TIME) {
					console.log(`BibTeX file ${url} has been updated remotely, re-fetching...`);
					shouldRefetch = true;
				} else {
					console.log(`BibTeX file ${url} is up-to-date (cached)`);
					shouldRefetch = false;
				}
			}
		}
	}

	if (!shouldRefetch) {
		console.log(`Using cached parsed citations for ${url}`);
		return "cached";
	}

	// Fetch from remote
	console.log(`Fetching BibTeX file from ${sourceInfo.download_url}...`);
	try {
		const response = await axios.get(sourceInfo.download_url, { timeout: 10000 });
		const content = response.data;

		// Parse and save citations
		const parsedCitations = parseAndFormatBibTeXContent(content);
		saveParsedCitations(urlHash, parsedCitations);

		console.log(`✓ Fetched, parsed, and cached ${parsedCitations.size} citations from ${url}`);
		return "success";
	} catch (error) {
		console.error(`Failed to fetch BibTeX file from ${url}:`, error);
		if (isCached) {
			console.log(`Using cached parsed citations as fallback`);
			return "cached-fallback";
		}
		throw error;
	}
}

// ============================================================================
// BibTeX Parsing and Formatting
// ============================================================================

/**
 * Formats a BibTeX entry using citation-js
 */
function formatBibEntry(
	entry: any,
	template: "apa" | "ieee",
	authors: string,
	year: string,
): string {
	try {
		const entryForFormatting = { ...entry };
		delete entryForFormatting.URL;
		const cite = new Cite([entryForFormatting]);
		const formatted = cite.format("bibliography", {
			format: "html",
			template,
			lang: "en-US",
		});
		return formatted.replace(/<div[^>]*>|<\/div>/g, "").trim();
	} catch (error) {
		console.warn(`Failed to format ${template.toUpperCase()} citation for ${entry.id}:`, error);
		const title = entry.title || "Untitled";
		return `${authors} (${year}). ${title}.`;
	}
}

function parseAndFormatBibTeXContent(content: string): Map<string, ParsedCitationEntry> {
	const parsed = new Cite(content);
	const entries = new Map<string, ParsedCitationEntry>();

	for (const entry of parsed.data) {
		const key = entry.id || entry["citation-key"];
		if (!key) continue;

		// Extract year
		const year = entry.issued?.["date-parts"]?.[0]?.[0]?.toString() || entry.year || "n.d.";

		// Extract URL
		const url = entry.URL;

		// Extract and format authors
		let authors = "Unknown";
		if (entry.author && entry.author.length > 0) {
			const authorList = entry.author;
			if (authorList.length === 1) {
				const author = authorList[0];
				authors = author.family || author.literal || "Unknown";
			} else if (authorList.length === 2) {
				authors = `${authorList[0].family || authorList[0].literal} & ${authorList[1].family || authorList[1].literal}`;
			} else {
				// Cap at 8 authors, then "et al."
				const displayCount = Math.min(8, authorList.length);
				if (authorList.length > 8) {
					const firstAuthors = authorList
						.slice(0, displayCount)
						.map((a: any) => a.family || a.literal)
						.join(", ");
					authors = `${firstAuthors}, et al.`;
				} else {
					const allButLast = authorList
						.slice(0, -1)
						.map((a: any) => a.family || a.literal)
						.join(", ");
					const last =
						authorList[authorList.length - 1].family || authorList[authorList.length - 1].literal;
					authors = `${allButLast} & ${last}`;
				}
			}
		}

		const ieeeFormatted = formatBibEntry(entry, "ieee", authors, year);
		const apaFormatted = formatBibEntry(entry, "apa", authors, year);

		entries.set(key, {
			key,
			authors,
			year,
			url,
			ieee_formatted: ieeeFormatted,
			apa_formatted: apaFormatted,
		});
	}

	return entries;
}

/**
 * Saves parsed citations to a file
 */
function saveParsedCitations(urlHash: string, entries: Map<string, ParsedCitationEntry>): void {
	const cacheDir = BUILD_FOLDER_PATHS.bibFilesCache;
	const parsedPath = path.join(cacheDir, `parsed_${urlHash}.json`);

	const entriesObject = Object.fromEntries(entries);
	fs.writeFileSync(parsedPath, JSON.stringify(entriesObject, null, 2), "utf-8");
	console.log(`✓ Saved ${entries.size} parsed citations to parsed_${urlHash}.json`);
}

/**
 * Loads parsed citations from a file
 */
function loadParsedCitations(urlHash: string): Map<string, ParsedCitationEntry> | null {
	const cacheDir = BUILD_FOLDER_PATHS.bibFilesCache;
	const parsedPath = path.join(cacheDir, `parsed_${urlHash}.json`);

	if (!fs.existsSync(parsedPath)) {
		return null;
	}

	try {
		const content = fs.readFileSync(parsedPath, "utf-8");
		const entriesObject = JSON.parse(content);
		const entries = new Map<string, ParsedCitationEntry>(Object.entries(entriesObject));
		return entries;
	} catch (error) {
		console.warn(`Failed to load parsed citations from parsed_${urlHash}.json:`, error);
		return null;
	}
}

/**
 * Saves combined BibTeX entries to cache
 */
function saveCombinedEntries(entries: Map<string, ParsedCitationEntry>): void {
	const cacheDir = BUILD_FOLDER_PATHS.bibFilesCache;
	const combinedPath = path.join(cacheDir, "combined-entries.json");

	// Convert Map to object for JSON serialization
	const entriesObject = Object.fromEntries(entries);

	fs.writeFileSync(combinedPath, JSON.stringify(entriesObject, null, 2), "utf-8");
	console.log(`✓ Saved ${entries.size} combined entries to cache`);
}

/**
 * Parses multiple BibTeX files and merges into a single map
 * Always recombines from individual parsed_{md5}.json files (fast operation)
 */
export async function parseBibTeXFiles(urls: string[]): Promise<Map<string, ParsedCitationEntry>> {
	// Always combine from individual parsed_{md5}.json files
	// This is a fast operation (just reading and merging JSON files)
	console.log("Combining parsed BibTeX files...");
	const allEntries = new Map<string, ParsedCitationEntry>();

	for (const url of urls) {
		try {
			// First, ensure the BibTeX file is fetched (this will create parsed_{md5}.json if needed)
			await fetchBibTeXFile(url);

			// Now load the parsed citations
			const urlHash = crypto.createHash("md5").update(url).digest("hex");
			const parsedCitations = loadParsedCitations(urlHash);

			if (parsedCitations) {
				// Merge into allEntries (later entries override earlier ones if same key)
				for (const [key, entry] of parsedCitations) {
					allEntries.set(key, entry);
				}
				console.log(`  Added ${parsedCitations.size} citations from ${url}`);
			} else {
				console.warn(`  No parsed citations found for ${url} - file may need to be fetched`);
			}
		} catch (error) {
			console.error(`Failed to load citations from ${url}:`, error);
		}
	}

	console.log(`\nTotal unique citations loaded: ${allEntries.size}`);

	// Save to combined cache
	saveCombinedEntries(allEntries);

	return allEntries;
}

// ============================================================================
// Citation Formatting
// ============================================================================

/**
 * Formats a citation entry for display using pre-formatted data
 *
 * @param entry - ParsedCitationEntry with pre-formatted bibliography
 * @param style - "apa" or "simplified-ieee"
 * @returns Object with formatted strings
 */
export function formatCitation(
	entry: ParsedCitationEntry,
	style: "apa" | "simplified-ieee",
): {
	inText: string;
	bibliography: string;
	authors: string;
	year: string;
} {
	// Select the appropriate pre-formatted bibliography
	const bibliography = style === "apa" ? entry.apa_formatted : entry.ieee_formatted;

	// In-text format
	let inText = "";
	if (style === "apa") {
		inText = `${entry.authors}, ${entry.year}`;
	} else {
		// simplified-ieee uses numbers, but Index is assigned later
		inText = "[?]"; // Placeholder, will be replaced with actual number
	}

	return {
		inText,
		bibliography,
		authors: entry.authors,
		year: entry.year,
	};
}

// ============================================================================
// Citation Extraction from Block
// ============================================================================

/**
 * Extracts citations from a single RichText array
 * Splits RichTexts at citation positions into [before, marker, after]
 * Markers are tagged with IsCitationMarker and CitationRef
 */
function extractCitationsFromRichTextArray(
	richTexts: RichText[],
	citationFormat: string,
	bibEntries: Map<string, ParsedCitationEntry>,
	isInFootnoteContent: boolean = false,
): { modifiedRichTexts: RichText[]; citations: Citation[] } {
	const citations: Citation[] = [];
	const fullText = joinPlainText(richTexts);
	const matches: { key: string; start: number; end: number; fullMatch: string }[] = [];

	// Build regex based on format
	let pattern: RegExp;
	if (citationFormat === "[@key]") {
		pattern = /\[@([\p{L}\p{N}_\-:]+)\]/gu;
	} else if (citationFormat === "\\cite{key}") {
		pattern = /\\cite\{([\p{L}\p{N}_\-:]+)\}/gu;
	} else if (citationFormat === "#cite(key)") {
		pattern = /#cite\(([\p{L}\p{N}_\-:]+)\)/gu;
	} else {
		console.warn(`Unknown citation format: ${citationFormat}`);
		return { modifiedRichTexts: richTexts, citations: [] };
	}

	// Find all matches
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(fullText)) !== null) {
		const charStart = match.index;

		// Check if citation is inside code, equation, or mention (skip if so)
		let currentPos = 0;
		let shouldSkip = false;
		for (const richText of richTexts) {
			const rtEnd = currentPos + richText.PlainText.length;
			if (charStart >= currentPos && charStart < rtEnd) {
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

		matches.push({
			key: match[1],
			start: match.index,
			end: match.index + match[0].length,
			fullMatch: match[0],
		});
	}

	if (matches.length === 0) {
		return { modifiedRichTexts: richTexts, citations: [] };
	}

	// Replace matches with citation markers
	// Process in reverse order to maintain positions
	matches.reverse();

	let newRichTexts = [...richTexts];
	for (const m of matches) {
		// Look up citation key in bibEntries
		const entry = bibEntries.get(m.key);
		if (!entry) {
			console.warn(`Citation key "${m.key}" not found in BibTeX entries`);
			continue;
		}

		// Format citation
		const formatted = formatCitation(entry, BIBLIOGRAPHY_STYLE as "apa" | "simplified-ieee");

		// Create Citation object
		const citation: Citation = {
			Key: m.key,
			FormattedEntry: formatted.bibliography,
			Authors: formatted.authors,
			Year: formatted.year,
			Url: entry.url,
			SourceBlockIds: [], // Will be populated later
			IsInFootnoteContent: isInFootnoteContent,
		};
		citations.push(citation);

		// Split RichTexts at match boundaries
		const { before, after } = splitRichTextsAtCharPosition(newRichTexts, m.start);
		const { after: afterMarker } = splitRichTextsAtCharPosition(after, m.end - m.start);

		// Create marker RichText
		const markerText: RichText = {
			PlainText: m.fullMatch,
			Text: {
				Content: m.fullMatch,
			},
			Annotation: {
				Bold: false,
				Italic: false,
				Strikethrough: false,
				Underline: false,
				Code: false,
				Color: "default",
			},
			IsCitationMarker: true,
			CitationRef: m.key,
		};

		// Reconstruct RichTexts
		newRichTexts = [...before, markerText, ...afterMarker];
	}

	return { modifiedRichTexts: newRichTexts, citations };
}

/**
 * Recursively extracts citations from a block and all its descendants
 * Used for start-of-child-blocks footnote content
 */
function extractCitationsFromBlockRecursive(
	block: Block,
	citationFormat: string,
	bibEntries: Map<string, ParsedCitationEntry>,
	isInFootnoteContent: boolean,
): Citation[] {
	const citations: Citation[] = [];
	const locations = getAllRichTextLocations(block);

	// Extract from this block's RichTexts
	for (const location of locations) {
		const result = extractCitationsFromRichTextArray(
			location.richTexts,
			citationFormat,
			bibEntries,
			isInFootnoteContent,
		);
		if (result.citations.length > 0) {
			citations.push(...result.citations);
			location.setter(result.modifiedRichTexts);
		}
	}

	// Recursively process children
	const children = getChildrenFromBlock(block);
	if (children) {
		for (const child of children) {
			const childCitations = extractCitationsFromBlockRecursive(
				child,
				citationFormat,
				bibEntries,
				isInFootnoteContent,
			);
			citations.push(...childCitations);
		}
	}

	return citations;
}

/**
 * Extracts citations from footnote content
 * Handles all three content types: rich_text, comment, blocks
 */
function extractCitationsFromFootnote(
	footnote: Footnote,
	citationFormat: string,
	bibEntries: Map<string, ParsedCitationEntry>,
): Citation[] {
	const citations: Citation[] = [];

	// Handle rich_text and comment types (both have RichTexts)
	if (
		(footnote.Content.Type === "rich_text" || footnote.Content.Type === "comment") &&
		footnote.Content.RichTexts
	) {
		const result = extractCitationsFromRichTextArray(
			footnote.Content.RichTexts,
			citationFormat,
			bibEntries,
			true, // isInFootnoteContent = true
		);
		citations.push(...result.citations);
		footnote.Content.RichTexts = result.modifiedRichTexts; // Update with citation markers
	} else if (footnote.Content.Type === "blocks" && footnote.Content.Blocks) {
		// Handle blocks type (start-of-child-blocks) - extract recursively
		for (const childBlock of footnote.Content.Blocks) {
			const childCitations = extractCitationsFromBlockRecursive(
				childBlock,
				citationFormat,
				bibEntries,
				true, // isInFootnoteContent = true
			);
			citations.push(...childCitations);
		}
	}

	return citations;
}

/**
 * Extracts citations from a block's RichText arrays
 *
 * Supports three formats:
 * - [@key] (pandoc)
 * - \cite{key} (LaTeX)
 * - #cite(key) (typst)
 *
 * Returns citations with empty SourceBlockIds (populated later by extractCitationsInPage)
 */
export function extractCitationsFromBlock(
	block: Block,
	config: CitationsConfig,
	bibEntries: Map<string, ParsedCitationEntry>,
): CitationExtractionResult {
	const citations: Citation[] = [];
	const locations = getAllRichTextLocations(block);

	if (locations.length === 0) {
		return { citations: [], processedRichTexts: false };
	}

	const citationFormat = config["extract-and-process-bibtex-citations"]["in-text-citation-format"];

	let processedAny = false;

	// Process each RichText location in the block
	for (const location of locations) {
		// FIRST: Check for footnote markers and extract citations from footnote content
		for (const rt of location.richTexts) {
			if (rt.IsFootnoteMarker && rt.FootnoteRef && block.Footnotes) {
				const footnote = block.Footnotes.find((fn) => fn.Marker === rt.FootnoteRef);
				if (footnote) {
					const footnoteCitations = extractCitationsFromFootnote(
						footnote,
						citationFormat,
						bibEntries,
					);
					if (footnoteCitations.length > 0) {
						processedAny = true;
						citations.push(...footnoteCitations);
					}
				}
			}
		}

		// THEN: Process main content citations normally
		const result = extractCitationsFromRichTextArray(
			location.richTexts,
			citationFormat,
			bibEntries,
			false, // isInFootnoteContent = false (main content)
		);

		if (result.citations.length > 0) {
			processedAny = true;
			citations.push(...result.citations);
			location.setter(result.modifiedRichTexts); // Update block's RichTexts
		}
	}

	return { citations, processedRichTexts: processedAny };
}

// ============================================================================
// Prepare Bibliography
// ============================================================================

/**
 * Sorts citations for bibliography display
 *
 * - IEEE: By Index (order of first appearance) - [1], [2], [3]...
 * - APA: Alphabetically by Authors field
 */
export function prepareBibliography(citations: Citation[]): Citation[] {
	const sorted = [...citations];

	if (BIBLIOGRAPHY_STYLE === "simplified-ieee") {
		// Sort by Index (first appearance order)
		sorted.sort((a, b) => (a.Index || 0) - (b.Index || 0));
	} else {
		// APA: Sort alphabetically by authors
		sorted.sort((a, b) => a.Authors.localeCompare(b.Authors));
	}

	return sorted;
}
