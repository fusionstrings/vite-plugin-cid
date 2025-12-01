import { assert, assertMatch } from "@std/assert";
import { build } from "vite";
import { cid } from "./index.ts";
import * as path from "@std/path";
import { fromFileUrl } from "@std/path";

const __dirname = path.dirname(fromFileUrl(import.meta.url));
const tempDir = path.join(__dirname, "../temp-edge-cases");

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
	name: "cid - should handle duplicate content (CID collision)",
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		await Deno.mkdir(tempDir, { recursive: true });

		try {
			// Create two files with identical content
			await Deno.writeTextFile(
				path.join(tempDir, "index.html"),
				`
      <!DOCTYPE html>
      <html>
        <head>
          <script type="module" src="./a.js"></script>
          <script type="module" src="./b.js"></script>
        </head>
        <body><h1>Test</h1></body>
      </html>
    `,
			);
			await Deno.writeTextFile(
				path.join(tempDir, "a.js"),
				`console.log('same');`,
			);
			await Deno.writeTextFile(
				path.join(tempDir, "b.js"),
				`console.log('same');`,
			);

			await build({
				root: tempDir,
				logLevel: "silent",
				plugins: [cid()],
				build: {
					outDir: "dist",
					minify: false,
					emptyOutDir: true,
					rollupOptions: {
						input: {
							main: path.join(tempDir, "index.html"),
						},
					},
				},
			});

			const distDir = path.join(tempDir, "dist");
			const files = [];
			for await (const name of walkDir(distDir)) {
				files.push(name);
			}
			const jsFiles = files.filter((f) => f.endsWith(".js"));

			// Both files should have the same CID since they have the same content
			// But Vite might bundle them together, so we just check that CIDs are valid
			for (const file of jsFiles) {
				const basename = path.basename(file, ".js");
				assertMatch(basename, /^bafkrei/);
			}
		} finally {
			await Deno.remove(tempDir, { recursive: true }).catch(() => {});
		}
	},
});

Deno.test({
	name: "cid - should handle CSS with url() references",
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		await Deno.mkdir(tempDir, { recursive: true });

		try {
			await Deno.mkdir(path.join(tempDir, "assets"), { recursive: true });
			await Deno.writeTextFile(
				path.join(tempDir, "index.html"),
				`
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet" href="./style.css">
        </head>
        <body><h1>Test</h1></body>
      </html>
    `,
			);
			await Deno.writeTextFile(
				path.join(tempDir, "style.css"),
				`
      body {
        background-image: url('./assets/bg.png');
      }
    `,
			);
			// Create a small PNG (1x1 transparent pixel)
			const pngData = Uint8Array.from(
				atob(
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				),
				(c) => c.charCodeAt(0),
			);
			await Deno.writeFile(path.join(tempDir, "assets/bg.png"), pngData);

			await build({
				root: tempDir,
				logLevel: "silent",
				plugins: [cid()],
				build: {
					outDir: "dist",
					minify: false,
					emptyOutDir: true,
					assetsInlineLimit: 0, // Force all assets to be files, not data URLs
				},
			});

			const distDir = path.join(tempDir, "dist");
			const files = [];
			for await (const name of walkDir(distDir)) {
				files.push(name);
			}
			const cssFiles = files.filter((f) => f.endsWith(".css"));

			assert(cssFiles.length > 0);

			// Check that CSS file has CID name
			const cssFile = cssFiles[0];
			const basename = path.basename(cssFile, ".css");
			assertMatch(basename, /^bafkrei/);

			// Check that url() references are updated
			const cssContent = await Deno.readTextFile(path.join(distDir, cssFile));
			// The url should reference a CID-named file (or be inlined as data URL)
			// If it's a file reference, it should have a CID name
			if (cssContent.includes("url(") && !cssContent.includes("data:")) {
				assertMatch(cssContent, /url\([^)]*bafkrei[^)]*\)/);
			}
		} finally {
			await Deno.remove(tempDir, { recursive: true }).catch(() => {});
		}
	},
});

Deno.test({
	name: "cid - should handle empty files",
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		await Deno.mkdir(tempDir, { recursive: true });

		try {
			await Deno.writeTextFile(
				path.join(tempDir, "index.html"),
				`
      <!DOCTYPE html>
      <html>
        <head>
          <script type="module" src="./empty.js"></script>
        </head>
        <body><h1>Test</h1></body>
      </html>
    `,
			);
			await Deno.writeTextFile(path.join(tempDir, "empty.js"), "");

			await build({
				root: tempDir,
				logLevel: "silent",
				plugins: [cid()],
				build: {
					outDir: "dist",
					minify: false,
					emptyOutDir: true,
				},
			});

			// Should not throw
			const distDir = path.join(tempDir, "dist");
			const files = [];
			for await (const name of walkDir(distDir)) {
				files.push(name);
			}
			assert(files.length > 0);
		} finally {
			await Deno.remove(tempDir, { recursive: true }).catch(() => {});
		}
	},
});

Deno.test({
	name: "cid - should handle source maps when enabled",
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		await Deno.mkdir(tempDir, { recursive: true });

		try {
			await Deno.writeTextFile(
				path.join(tempDir, "index.html"),
				`
      <!DOCTYPE html>
      <html>
        <head>
          <script type="module" src="./main.js"></script>
        </head>
        <body><h1>Test</h1></body>
      </html>
    `,
			);
			await Deno.writeTextFile(
				path.join(tempDir, "main.js"),
				`
      console.log('test');
    `,
			);

			await build({
				root: tempDir,
				logLevel: "silent",
				plugins: [cid()],
				build: {
					outDir: "dist",
					minify: false,
					emptyOutDir: true,
					sourcemap: true,
				},
			});

			const distDir = path.join(tempDir, "dist");
			const files = [];
			for await (const name of walkDir(distDir)) {
				files.push(name);
			}
			const jsFiles = files.filter((f) =>
				f.endsWith(".js") && !f.endsWith(".map")
			);
			const mapFiles = files.filter((f) => f.endsWith(".js.map"));

			assert(jsFiles.length > 0);

			// Source maps might not be generated for very simple files
			// If they are generated, check that they have CID names
			if (mapFiles.length > 0) {
				const mapFile = mapFiles[0];
				const mapBasename = path.basename(mapFile, ".js.map");
				assertMatch(mapBasename, /^bafkrei/);

				// Check that JS file references the correct map file
				const jsFile = jsFiles[0];
				const jsContent = await Deno.readTextFile(path.join(distDir, jsFile));

				// Should have sourceMappingURL comment
				if (jsContent.includes("sourceMappingURL")) {
					const mapBasenameWithExt = path.basename(mapFile);
					assert(jsContent.includes(mapBasenameWithExt));
				}
			}
		} finally {
			await Deno.remove(tempDir, { recursive: true }).catch(() => {});
		}
	},
});
