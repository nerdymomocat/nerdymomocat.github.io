import fs from "node:fs";
import path from "node:path";
import type { ExternalContentDescriptor } from "@/lib/interfaces";
import type { Heading } from "@/types";
import { EXTERNAL_CONTENT_PATHS } from "../../constants";
import { extractHeadingsFromHtml } from "./external-content-utils";

export { extractHeadingsFromHtml };

type FolderMeta = {
	version: string;
	fetchedAt?: string;
	remotePath?: string;
};

type RenderCacheMeta = {
	version: string;
	headings?: Heading[];
};

type RenderCacheEntry = {
	html: string;
	meta: RenderCacheMeta;
};

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function commitMetaPath(sourceId: string, folderName: string) {
	return path.join(EXTERNAL_CONTENT_PATHS.commitMetadata, sourceId, `${folderName}.json`);
}

function renderCachePaths(descriptor: ExternalContentDescriptor) {
	const baseDir = path.join(
		EXTERNAL_CONTENT_PATHS.renderCache,
		descriptor.sourceId,
		descriptor.folderName,
	);
	return {
		baseDir,
		html: path.join(baseDir, "index.html"),
		meta: path.join(baseDir, "meta.json"),
	};
}

export function writeExternalFolderVersion(
	sourceId: string,
	folderName: string,
	version: string,
	remotePath?: string,
) {
	if (!version) return;
	const metaDir = path.join(EXTERNAL_CONTENT_PATHS.commitMetadata, sourceId);
	ensureDir(metaDir);
	const payload: FolderMeta = {
		version,
		fetchedAt: new Date().toISOString(),
	};
	if (remotePath) payload.remotePath = remotePath;
	fs.writeFileSync(commitMetaPath(sourceId, folderName), JSON.stringify(payload, null, 2), "utf-8");
}

export function readExternalFolderVersion(descriptor: ExternalContentDescriptor): string | null {
	const file = commitMetaPath(descriptor.sourceId, descriptor.folderName);
	if (!fs.existsSync(file)) return null;
	try {
		const meta = JSON.parse(fs.readFileSync(file, "utf-8")) as FolderMeta;
		return meta.version || null;
	} catch {
		return null;
	}
}

export function saveExternalRenderCache(
	descriptor: ExternalContentDescriptor,
	version: string,
	html: string,
	headings?: Heading[],
) {
	const paths = renderCachePaths(descriptor);
	ensureDir(paths.baseDir);
	fs.writeFileSync(paths.html, html, "utf-8");
	const meta: RenderCacheMeta = { version };
	if (headings) meta.headings = headings;
	fs.writeFileSync(paths.meta, JSON.stringify(meta), "utf-8");
}

export function loadExternalRenderCache(
	descriptor: ExternalContentDescriptor,
	expectedVersion?: string | null,
): RenderCacheEntry | null {
	const paths = renderCachePaths(descriptor);
	if (!fs.existsSync(paths.meta) || !fs.existsSync(paths.html)) return null;
	try {
		const meta = JSON.parse(fs.readFileSync(paths.meta, "utf-8")) as RenderCacheMeta;
		if (expectedVersion && meta.version !== expectedVersion) return null;
		const html = fs.readFileSync(paths.html, "utf-8");
		return { html, meta };
	} catch {
		return null;
	}
}
