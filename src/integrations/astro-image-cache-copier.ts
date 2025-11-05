import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AstroIntegration } from "astro";

const ASTRO_ASSETS_CACHE = "./tmp/.astro/assets";

export default (): AstroIntegration => ({
	name: "astro-image-cache-copier",
	hooks: {
		"astro:build:done": async ({ dir, logger }) => {
			const dirPath = fileURLToPath(dir);
			const destDir = path.join(dirPath, "_astro");

			if (!fs.existsSync(ASTRO_ASSETS_CACHE)) {
				logger.info("No Astro image cache found, skipping image cache copy...");
				return;
			}

			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}

			const files = fs.readdirSync(ASTRO_ASSETS_CACHE, { withFileTypes: true });
			let copiedCount = 0;

			for (const file of files) {
				if (file.isDirectory()) continue;

				const srcPath = path.join(ASTRO_ASSETS_CACHE, file.name);
				const destPath = path.join(destDir, file.name);

				// Only copy if file doesn't already exist (avoid overwriting newer versions)
				if (!fs.existsSync(destPath)) {
					fs.copyFileSync(srcPath, destPath);
					copiedCount++;
				}
			}

			if (copiedCount > 0) {
				logger.info(`Copied ${copiedCount} cached image(s) from Astro cache to dist/_astro/`);
			}
		},
	},
});
