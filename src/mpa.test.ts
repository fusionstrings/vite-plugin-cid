import { assert, assertEquals, assertMatch } from "@std/assert";
import { build } from "vite";
import { cid } from "./index.ts";
import * as path from "@std/path";
import { fromFileUrl } from "@std/path";

const __dirname = path.dirname(fromFileUrl(import.meta.url));
const tempDir = path.join(__dirname, "../temp-mpa");

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
	name:
		"cid - MPA Support - should preserve filenames for all HTML entry points",
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		await Deno.mkdir(tempDir, { recursive: true });

		try {
			// Create index.html
			await Deno.writeTextFile(
				path.join(tempDir, "index.html"),
				`
      <!DOCTYPE html>
      <html>
        <head><title>Home</title></head>
        <body>
          <h1>Home</h1>
          <a href="/about.html">About</a>
        </body>
      </html>
    `,
			);

			// Create about.html
			await Deno.writeTextFile(
				path.join(tempDir, "about.html"),
				`
      <!DOCTYPE html>
      <html>
        <head><title>About</title></head>
        <body>
          <h1>About</h1>
          <script type="module" src="./main.js"></script>
        </body>
      </html>
    `,
			);

			// Create main.js
			await Deno.writeTextFile(
				path.join(tempDir, "main.js"),
				`console.log('main');`,
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
							about: path.join(tempDir, "about.html"),
						},
					},
				},
			});

			const distDir = path.join(tempDir, "dist");

			// Check that index.html exists
			const indexExists = await Deno.stat(path.join(distDir, "index.html"))
				.then(() => true).catch(() => false);
			assertEquals(indexExists, true);

			// Check that about.html exists (should NOT be renamed)
			const aboutExists = await Deno.stat(path.join(distDir, "about.html"))
				.then(() => true).catch(() => false);
			assertEquals(aboutExists, true);

			// Check that JS file IS renamed
			const files = [];
			for await (const name of walkDir(distDir)) {
				files.push(name);
			}
			const jsFiles = files.filter((f) => f.endsWith(".js"));
			assert(jsFiles.length > 0);
			const jsBasename = path.basename(jsFiles[0]);
			assertMatch(jsBasename, /^bafkrei/);
		} finally {
			await Deno.remove(tempDir, { recursive: true }).catch(() => {});
		}
	},
});
