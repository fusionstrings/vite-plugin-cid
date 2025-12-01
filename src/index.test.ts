import { assert, assertEquals } from "@std/assert";
import { build } from "vite";
import { cid } from "./index.ts";
import * as path from "@std/path";
import { fromFileUrl } from "@std/path";
import { generateCID } from "./cid.ts";

const __dirname = path.dirname(fromFileUrl(import.meta.url));
const tempDir = path.join(__dirname, "../temp-test");

async function* walkDir(dir: string, base = dir): AsyncGenerator<string> {
	for await (const entry of Deno.readDir(dir)) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory) {
			yield* walkDir(fullPath, base);
		} else {
			yield path.relative(base, fullPath);
		}
	}
}

Deno.test({
	name: "cid - should rename files to their CIDs",
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		await Deno.mkdir(tempDir, { recursive: true });

		// Create a simple app
		await Deno.writeTextFile(
			path.join(tempDir, "index.html"),
			`
      <!DOCTYPE html>
      <html>
        <head>
          <script type="module" src="./main.js"></script>
          <link rel="stylesheet" href="./style.css">
        </head>
        <body>
          <h1>Hello</h1>
        </body>
      </html>
    `,
		);
		await Deno.writeTextFile(
			path.join(tempDir, "main.js"),
			`
      import './style.css';
      console.log('main');
    `,
		);
		await Deno.writeTextFile(
			path.join(tempDir, "style.css"),
			`
      body { color: red; }
    `,
		);

		try {
			await build({
				root: tempDir,
				logLevel: "silent",
				plugins: [cid()],
				build: {
					outDir: "dist",
					minify: false, // Easier to debug/verify
					emptyOutDir: true,
				},
			});

			const distDir = path.join(tempDir, "dist");
			const files = [];
			for await (const name of walkDir(distDir)) {
				files.push(name);
			}

			// Find CSS and JS files by extension
			const cssFile = files.find((f) => f.endsWith(".css"));
			const jsFile = files.find((f) => f.endsWith(".js"));

			assert(cssFile !== undefined, "CSS file should exist");
			assert(jsFile !== undefined, "JS file should exist");

			// Verify CSS CID
			if (cssFile) {
				const content = await Deno.readFile(path.join(distDir, cssFile));
				const expectedCid = await generateCID(content);
				assert(
					cssFile.includes(expectedCid),
					`CSS file should contain CID ${expectedCid}`,
				);
			}

			// Verify JS CID
			if (jsFile) {
				const content = await Deno.readFile(path.join(distDir, jsFile));
				const expectedCid = await generateCID(content);
				assert(
					jsFile.includes(expectedCid),
					`JS file should contain CID ${expectedCid}`,
				);
			}

			// Verify HTML CID and references
			// index.html should NOT be renamed so it can be served
			const indexHtmlPath = path.join(distDir, "index.html");
			const indexHtmlExists = await Deno.stat(indexHtmlPath).then(() => true)
				.catch(() => false);
			assertEquals(indexHtmlExists, true);

			if (indexHtmlExists) {
				const content = await Deno.readTextFile(indexHtmlPath);
				// It should reference the JS and CSS files by their new names
				if (jsFile) {
					assert(content.includes(jsFile), "HTML should reference JS file");
				}
				if (cssFile) {
					assert(content.includes(cssFile), "HTML should reference CSS file");
				}
			}
		} finally {
			await Deno.remove(tempDir, { recursive: true }).catch(() => {});
		}
	},
});
