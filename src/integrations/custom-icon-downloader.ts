import type { AstroIntegration } from "astro";
import type { FileObject } from "@/lib/interfaces";
import { getDataSource, downloadFile, isNotionHostedIconUrl } from "../lib/notion/client";

export default (): AstroIntegration => ({
	name: "custom-icon-downloader",
	hooks: {
		"astro:build:start": async () => {
			const database = await getDataSource();
			const icon = database.Icon as FileObject;
			if (!database.Icon || !icon?.Url) {
				return Promise.resolve();
			}

			const shouldCacheLocally =
				icon.Type === "file" ||
				icon.Type === "custom_emoji" ||
				icon.Type === "icon" ||
				(icon.Type === "external" && isNotionHostedIconUrl(icon.Url));

			if (!shouldCacheLocally) {
				return Promise.resolve();
			}

			let url!: URL;
			try {
				url = new URL(icon.Url);
			} catch (err) {
				console.log("Invalid Icon image URL");
				return Promise.resolve();
			}

			// Download to BOTH locations:
			// 1. src/assets/notion for Astro image optimization (header)
			// 2. public/notion for OG image generation
			await downloadFile(url, true, true); // to src/assets/notion
			await downloadFile(url, false, true); // to public/notion
		},
	},
});
