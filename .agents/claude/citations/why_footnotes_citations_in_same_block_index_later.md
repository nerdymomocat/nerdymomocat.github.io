# Why Citations in Footnotes Get Later Indices (And Why That's Okay)

This document explains the citation and footnote indexing behavior in Webtrotion, specifically why citations that appear in footnote content receive later indices than citations in the main text, even when the footnote marker appears earlier.

## TL;DR

**Example:** Parent text `"hello [@cite1] is [^ft_x] saying [@cite3]"` with footnote content `"says [@cite2] is good"`

**Indices assigned:**
- cite1 → Index 1
- cite3 → Index 2
- cite2 → Index 3 (even though the footnote marker appears before [@cite3])

**Why:** Citations are indexed in the order they're encountered during depth-first tree traversal: parent blocks first, then footnote content blocks.

**Design Decision:** This behavior is **intentional and acceptable** because:
1. Footnotes are supplementary content - readers expect them at the end
2. Fixing this would require significant architectural changes (two-pass system)
3. The trade-off between "perfect reading order" vs. "implementation complexity" favors simplicity
4. Behavior is consistent and predictable across all three footnote source types

---

## Two-Stage Processing Architecture

The system processes blocks and extracts citations/footnotes in two distinct stages:

### Stage 1: Per-Block Extraction (client.ts)

**Location:** `src/lib/notion/client.ts`, function `getAllBlocksByBlockId()` (lines 657-779)

**For EACH block, does:**

1. **Fetch children first** (lines 706-727) - Recursively fetches child blocks
2. **Extract citations** (lines 732-747) - BEFORE footnotes
3. **Extract footnotes** (lines 749-776) - AFTER citations

**What gets created:**
```typescript
block.Citations = [
    { Key: "cite1", FormattedEntry: "...", SourceBlockIds: [] }  // NO Index yet
]
block.Footnotes = [
    { Marker: "ft_x", Content: {...} }  // NO Index yet, NO SourceBlockId yet
]
```

**Important:** At this stage:
- Citations have **NO `Index` property**
- Citations have **empty `SourceBlockIds` array**
- Footnotes have **NO `Index` property**
- Footnotes have **NO `SourceBlockId` property**

### Stage 2: Page-Level Indexing (blog-helpers.ts)

**Location:** `src/lib/blog-helpers.ts`, function `extractPageContent()` (lines 751-900)

**Called after all blocks are fetched:**
```typescript
blocks = await getAllBlocksByBlockId(post.PageId);  // Stage 1 complete

const extracted = extractPageContent(post.PageId, blocks, {  // Stage 2
    extractFootnotes: true,
    extractCitations: true,
    extractInterlinkedContent: true,
});
```

**What it does:**

Traverses the entire block tree ONCE using recursive `processBlock()` function (lines 773-876):

1. **Process footnotes** (lines 774-788) - Assigns sequential indices
2. **Process citations** (lines 790-831) - Assigns indices, de-duplicates by Key
3. **Recurse into children** (lines 839-857) - Depth-first traversal
4. **Process footnote content blocks** (lines 868-875) - Citations in footnote content

**What gets added:**
```typescript
// MUTATES Citation objects:
citation.Index = 1  // or 2, 3, etc.
citation.SourceBlockIds = ["block-id-1", "block-id-2"]

// MUTATES Footnote objects:
footnote.Index = 1  // or 2, 3, etc.
footnote.SourceBlockId = "block-id"
```

---

## Example: Why cite2 Gets Index 3

### Scenario

**Parent block text:**
```
"hello [@cite1] is [^ft_x] saying [@cite3]"
```

**Footnote content:**
```
"says [@cite2] is good"
```

### Stage 1: Extraction (client.ts)

#### Parent Block Processing:

**Step 1A - Extract citations (line 738):**
```typescript
// Finds [@cite1] and [@cite3] in parent text
block.Citations = [
    { Key: "cite1", SourceBlockIds: [] },
    { Key: "cite3", SourceBlockIds: [] }
]
```

**Step 1B - Extract footnotes (line 761):**
```typescript
// Finds [^ft_x] marker and extracts content
block.Footnotes = [
    {
        Marker: "x",
        Content: { Type: "rich_text", RichTexts: [{ PlainText: "says [@cite2] is good" }] }
    }
]
```

**Note:** For end-of-block source, the full text including `[^ft_x]: says [@cite2] is good` is processed as one RichText array, so **ALL citations are discovered together** before the footnote definition is split out.

For start-of-child-blocks or block-comments, the child/comment is processed separately.

### Stage 2: Indexing (blog-helpers.ts)

#### Tree Traversal Order:

The `processBlock()` function processes blocks in this order:

```typescript
function processBlock(block) {
    // 1. Process footnotes (lines 774-788)
    // 2. Process citations (lines 790-831)  ← Parent citations indexed here
    // 3. Process children (lines 839-857)
    // 4. Process footnote content blocks (lines 868-875)  ← Footnote citations indexed here
}
```

#### Step 2A - Process Parent Block:

**Process footnotes (lines 774-788):**
```typescript
block.Footnotes.forEach((footnote) => {
    footnote.Index = ++footnoteIndex;  // Assigns 1
    footnote.SourceBlockId = block.Id;
});
```

**Process citations (lines 790-831):**
```typescript
// cite1 - first appearance
firstAppearanceCounter++;  // = 1
citation.Index = 1;
keyToIndex.set("cite1", 1);

// cite3 - first appearance
firstAppearanceCounter++;  // = 2
citation.Index = 2;
keyToIndex.set("cite3", 2);
```

**Current state:**
- cite1 → Index 1
- cite3 → Index 2
- footnote "x" → Index 1

#### Step 2B - Process Footnote Content (lines 868-875):

```typescript
block.Footnotes.forEach((footnote) => {
    if (footnote.Content.Type === "rich_text") {
        // For end-of-block, Content.Type === "rich_text"
        // Citations already processed in Stage 1
        // cite2 was discovered during parent's citation extraction
        // So it's ALREADY in block.Citations with Index 3
    }

    if (footnote.Content.Type === "blocks") {
        // For start-of-child-blocks
        footnote.Content.Blocks.forEach(processBlock);  // Recurse
    }
});
```

**For start-of-child-blocks specifically:**

The child block (footnote content) is processed recursively:
```typescript
// Child block has: block.Citations = [{ Key: "cite2", SourceBlockIds: [] }]

// Process child block's citations:
firstAppearanceCounter++;  // = 3
citation.Index = 3;
keyToIndex.set("cite2", 3);
```

**Final indices:**
- cite1 → Index 1
- cite3 → Index 2
- cite2 → Index 3

---

## Why This Happens for All Three Footnote Sources

### 1. End-of-Block Source

**Full text:** `"hello [@cite1] is [^ft_x] saying [@cite3]\n\n[^ft_x]: says [@cite2] is good"`

**Citation extraction (client.ts line 738):**
- Processes the ENTIRE text (including footnote definition)
- Discovers citations left-to-right: cite1, cite3, cite2
- All added to `block.Citations` in that order

**Indexing (blog-helpers.ts lines 790-831):**
- Iterates through `block.Citations` array
- Assigns indices in order: cite1=1, cite3=2, cite2=3

**Result:** cite2 comes last because it appears last in the source text.

### 2. Start-of-Child-Blocks Source

**Parent:** `"hello [@cite1] is [^ft_x] saying [@cite3]"`
**Child (footnote):** `"says [@cite2] is good"`

**Citation extraction:**
- Child block fetched recursively (line 706-727)
- Child's citations: `[{ Key: "cite2" }]`
- Parent's citations: `[{ Key: "cite1" }, { Key: "cite3" }]`

**Indexing (depth-first traversal):**
- Parent processed first (lines 790-831): cite1=1, cite3=2
- Then recurse into footnote content blocks (lines 868-875): cite2=3

**Result:** cite2 comes last due to depth-first tree traversal order.

### 3. Block-Comments Source

**Parent:** `"hello [@cite1] is [^ft_x] saying [@cite3]"`
**Comment:** `"says [@cite2] is good"`

**Citation extraction:**
- Parent citations extracted (line 738): cite1, cite3
- Comment fetched from Notion API (line 761)
- Comment citations extracted (footnotes.ts line 964)
- **Comment citations APPENDED to parent.Citations** (footnotes.ts line 977):
  ```typescript
  block.Citations.push(...citationResult.citations);
  // Now: block.Citations = [cite1, cite3, cite2]
  ```

**Indexing:**
- Iterates through parent.Citations array
- Assigns indices in order: cite1=1, cite3=2, cite2=3

**Result:** cite2 comes last because it's appended to the Citations array.

---

## RichText Array Modifications

Both citation and footnote extraction **modify the RichText arrays** by splitting them and adding marker properties.

### Citation Extraction (citations.ts lines 612-639)

**BEFORE:**
```typescript
[
  { PlainText: "hello [@cite1] world" }
]
```

**AFTER:**
```typescript
[
  { PlainText: "hello " },
  {
    PlainText: "[@cite1]",
    IsCitationMarker: true,    // ← Added
    CitationRef: "cite1"       // ← Added
  },
  { PlainText: " world" }
]
```

### Footnote Extraction (footnotes.ts lines 421-436)

**BEFORE:**
```typescript
[
  { PlainText: "hello [^ft_x] world" }
]
```

**AFTER:**
```typescript
[
  { PlainText: "hello " },
  {
    PlainText: "[^ft_x]",
    IsFootnoteMarker: true,    // ← Added
    FootnoteRef: "x"           // ← Added
  },
  { PlainText: " world" }
]
```

### Complete Transformation

**Initial:**
```typescript
[{ PlainText: "hello [@cite1] is [^ft_x] saying [@cite3]" }]
```

**After both extractions:**
```typescript
[
  { PlainText: "hello " },
  { PlainText: "[@cite1]", IsCitationMarker: true, CitationRef: "cite1" },
  { PlainText: " is " },
  { PlainText: "[^ft_x]", IsFootnoteMarker: true, FootnoteRef: "x" },
  { PlainText: " saying " },
  { PlainText: "[@cite3]", IsCitationMarker: true, CitationRef: "cite3" }
]
```

**Why this matters:** Components render these markers as superscript numbers or clickable footnote indicators.

---

## How Citations Handle De-duplication

Unlike footnotes (which are unique by marker), **citations can appear multiple times** with the same Key.

### Example: Multiple References

**Block A:** `"hello [@cite1] world"`
**Block B:** `"goodbye [@cite1] again"`

**After Stage 1 (client.ts):**
```typescript
blockA.Citations = [{ Key: "cite1", SourceBlockIds: [] }]
blockB.Citations = [{ Key: "cite1", SourceBlockIds: [] }]
```

**After Stage 2 (blog-helpers.ts):**

```typescript
// Process Block A
citation.Index = 1;
citation.SourceBlockIds = ["block-a-id"];
keyToIndex.set("cite1", 1);
citationMap.set("cite1", citation);

// Process Block B
// Key "cite1" already exists!
citation.Index = 1;  // Reuse existing index
const existing = citationMap.get("cite1");
existing.SourceBlockIds.push("block-b-id");  // Add to array
// existing.SourceBlockIds = ["block-a-id", "block-b-id"]
```

**Result:** Only ONE citation entry in the bibliography, with multiple source blocks tracked.

This is why Stage 2 is necessary - it provides **page-level awareness** for de-duplication.

---

## Why Logical Ordering Would Be Complex

### What "Logical Order" Would Mean

**Current behavior:**
- cite1 (main text) → Index 1
- cite3 (main text) → Index 2
- cite2 (footnote) → Index 3

**Desired "logical" behavior:**
- cite1 (main text) → Index 1
- cite2 (footnote for marker appearing after cite1) → Index 2
- cite3 (main text after footnote marker) → Index 3

### Why It's Hard to Implement

#### Option 1: Two-Pass System

**Pass 1:** Discover all citations (as currently done)
**Pass 2:** Sort by logical position and assign indices

**Problems:**
1. Need to track "logical position" for each citation (parent block order + footnote order)
2. Complex sorting logic for mixed parent/footnote content
3. Must handle all three footnote source types differently:
   - End-of-block: Citations discovered together (complex to split)
   - Start-of-child-blocks: Child processed before parent (need to reorder)
   - Block-comments: Comments fetched late (need to insert in middle)

**Implementation complexity:** High - requires significant refactoring of blog-helpers.ts

#### Option 2: Change Tree Traversal

**Current order:**
1. Process block's footnotes (markers)
2. Process block's citations
3. Process children
4. Process footnote content blocks

**New order:**
1. Process block's footnotes (markers)
2. **For each footnote, immediately process its content**
3. Process block's citations
4. Process children

**Problems:**
1. Breaks the clean depth-first traversal
2. Requires interleaving citation processing with footnote processing
3. De-duplication becomes more complex (need to track partial state)
4. Different logic needed for each footnote source type

**Implementation complexity:** Very high - fundamental restructuring

### The Trade-off

**Cost:**
- 2-3 weeks of development time
- High risk of bugs (complex state management)
- Increased maintenance burden

**Benefit:**
- Citations appear in "perfect" reading order
- But footnotes are **supplementary content** - readers don't expect perfect ordering

**Decision:** Not worth the complexity.

---

## Why Current Behavior Is Acceptable

### 1. Footnotes Are "Less Important"

Footnotes are **supplementary content** by nature. They're meant to be read after the main text. Readers don't expect footnote citations to be numbered in strict reading order.

### 2. Behavior Is Consistent and Predictable

All three footnote source types produce the same indexing behavior:
- Main text citations come first
- Footnote citations come after
- No surprises or edge cases

### 3. Bibliographies Are Still Correct

The bibliography correctly lists all citations, and each citation marker links to the correct entry. The only "issue" is the numbering order, which is cosmetic.

### 4. Alternative Citation Styles Don't Have This Problem

**APA style:** Citations show (Author, Year) - no numbers involved!
```
Main text: "hello (Smith, 2020) is saying (Jones, 2021)"
Footnote: "says (Brown, 2019) is good"
```

Order doesn't matter because there are no sequential numbers.

**IEEE style with logical ordering** would require significantly more complexity for minimal benefit.

### 5. Simplicity Is a Feature

The current architecture is:
- Easy to understand (two clear stages)
- Easy to debug (linear flow)
- Easy to maintain (no complex sorting logic)

---

## Design Decision Summary

### Current Implementation

**Indices assigned in tree traversal order:**
1. Parent blocks first
2. Children blocks second
3. Footnote content blocks last

**Result:** cite1=1, cite3=2, cite2=3

### Alternative Implementation

**Indices assigned in logical reading order:**
1. Parse all blocks to determine reading order
2. Sort citations by position
3. Assign indices

**Result:** cite1=1, cite2=2, cite3=3

### Decision: Keep Current Implementation

**Rationale:**
- Footnotes are supplementary - readers expect them at the end
- Implementation complexity is too high for marginal benefit
- Current behavior is consistent and predictable
- Alternative citation styles (APA) don't have this issue
- Simplicity is valuable for maintenance

**Accepted trade-off:** Slightly non-intuitive numbering in exchange for clean, maintainable code.

---

## Related Code Locations

### Stage 1: Extraction
- `src/lib/notion/client.ts` lines 657-779 (`getAllBlocksByBlockId()`)
  - Line 732-747: Citation extraction
  - Line 749-776: Footnote extraction

### Stage 2: Indexing
- `src/lib/blog-helpers.ts` lines 751-900 (`extractPageContent()`)
  - Line 767-769: Initialize tracking variables
  - Line 774-788: Process footnotes
  - Line 790-831: Process citations
  - Line 839-857: Recurse into children
  - Line 868-875: Process footnote content blocks

### Citation Extraction
- `src/lib/citations.ts`
  - Lines 654-686: `extractCitationsFromBlock()`
  - Lines 529-642: `extractCitationsFromRichTextArray()`

### Footnote Extraction
- `src/lib/footnotes.ts`
  - Lines 1075-1104: `extractFootnotesFromBlock()`
  - Lines 545-613: `extractEndOfBlockFootnotes()`
  - Lines 709-799: `extractStartOfChildBlocksFootnotes()`
  - Lines 891-1041: `extractBlockCommentsFootnotes()`

---

## Conclusion

The current indexing behavior - where citations in footnote content receive later indices than main text citations - is **intentional and acceptable**. While it doesn't match perfect "logical reading order," it represents a pragmatic trade-off between simplicity and perfection.

The architecture is clean, the behavior is predictable, and the system works correctly. Changing it would require significant complexity for minimal practical benefit.

**Bottom line:** Footnote citations coming last is fine because footnotes themselves come last.
