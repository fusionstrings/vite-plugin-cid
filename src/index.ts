/**
 * # CID Vite Plugin
 *
 * A Vite plugin that renames build outputs using Content Identifiers (CID).
 *
 * ## Features
 *
 * - **Content-Addressed Naming**: All build outputs are renamed using CIDv1 (SHA-256, base32)
 * - **Automatic Reference Updates**: All internal references are updated to use new CID filenames
 * - **Manifest Support**: Vite manifest files are updated with new filenames
 * - **HTML Preservation**: HTML entry points keep original names for web server compatibility
 * - **Topological Processing**: Files are processed in dependency order to ensure correct references
 *
 * ## Installation
 *
 * ```bash
 * # Using Deno
 * deno add jsr:@fusionstrings/vite-plugin-cid
 *
 * # Using npm
 * npx jsr add @fusionstrings/vite-plugin-cid
 * ```
 *
 * ## Quick Start
 *
 * ```typescript
 * import { defineConfig } from 'vite';
 * import { cid } from '@fusionstrings/vite-plugin-cid';
 *
 * export default defineConfig({
 *   plugins: [cid()],
 * });
 * ```
 *
 * @module
 */

import type { Plugin } from "vite";
import type { OutputBundle, OutputChunk } from "rollup";
import { generateCID } from "./cid.ts";
import * as path from "@std/path";

/**
 * Extended OutputChunk with Vite-specific metadata.
 * @internal
 */
interface ViteOutputChunk extends OutputChunk {
	viteMetadata?: {
		importedAssets: Set<string>;
		importedCss: Set<string>;
	};
}

/**
 * Creates a Vite plugin that renames build output files using CIDs.
 *
 * @remarks
 * The plugin operates in two phases:
 *
 * 1. **generateBundle**: Processes files in topological order, generates CIDs,
 *    renames files, and updates all references.
 *
 * 2. **writeBundle**: Performs final updates to manifest files on disk.
 *
 * Key behaviors:
 * - HTML files retain original names for web server compatibility
 * - Manifest files are processed last to capture all renames
 * - Circular dependencies are handled gracefully
 * - Source map references are updated automatically
 *
 * @returns A Vite {@link https://vitejs.dev/guide/api-plugin.html | Plugin} instance
 *
 * @see {@link generateCID} for the underlying CID generation function
 *
 * @public
 */
export function cid(): Plugin {
	return {
		name: "vite-plugin-cid",
		enforce: "post",
		apply: "build",

		async generateBundle(_options, bundle: OutputBundle) {
			const fileMap = new Map<string, string>();

			const getDeps = (fileName: string): string[] => {
				const chunk = bundle[fileName];
				if (!chunk) return [];
				if (chunk.type === "asset") return [];

				const viteChunk = chunk as ViteOutputChunk;
				return [
					...chunk.imports,
					...chunk.dynamicImports,
					...viteChunk.viteMetadata?.importedAssets || [],
					...viteChunk.viteMetadata?.importedCss || [],
				];
			};

			// Topological sort using DFS
			const sorted: string[] = [];
			const visited = new Set<string>();
			const visiting = new Set<string>();

			const visit = (fileName: string) => {
				if (visited.has(fileName)) return;
				if (visiting.has(fileName)) return; // Break cycles
				visiting.add(fileName);

				for (const dep of getDeps(fileName)) {
					if (bundle[dep]) visit(dep);
				}

				visiting.delete(fileName);
				visited.add(fileName);
				sorted.push(fileName);
			};

			for (const fileName of Object.keys(bundle)) {
				visit(fileName);
			}

			// Separate manifest files for last-pass processing
			const manifestFiles: string[] = [];
			const regularFiles: string[] = [];

			for (const fileName of sorted) {
				if (
					fileName.endsWith(".json") &&
					(fileName.includes("manifest") || fileName.includes(".vite"))
				) {
					manifestFiles.push(fileName);
				} else {
					regularFiles.push(fileName);
				}
			}

			// Process regular files
			for (const fileName of regularFiles) {
				const item = bundle[fileName];
				let content: string | Uint8Array;

				if (item.type === "asset") {
					content = item.source;
					if (typeof content === "string") {
						for (const [oldName, newName] of fileMap) {
							const oldBase = path.basename(oldName);
							const newBase = path.basename(newName);
							const escapedOldBase = oldBase.replace(
								/[.*+?^${}()|[\]\\]/g,
								"\\$&",
							);
							content = content.replace(
								new RegExp(escapedOldBase, "g"),
								newBase,
							);
						}
						item.source = content;
					}
				} else {
					let code = item.code;

					for (const [oldName, newName] of fileMap) {
						const oldBase = path.basename(oldName);
						const newBase = path.basename(newName);
						const escapedOldBase = oldBase.replace(
							/[.*+?^${}()|[\]\\]/g,
							"\\$&",
						);
						code = code.replace(new RegExp(escapedOldBase, "g"), newBase);
					}

					item.code = code;
					content = code;
				}

				// Skip HTML files to preserve entry points
				if (fileName.endsWith(".html")) continue;

				const cid = await generateCID(content);
				const ext = path.extname(fileName);
				const dir = path.dirname(fileName);
				const newFileName = path.join(dir, `${cid}${ext}`);

				if (newFileName !== fileName) {
					item.fileName = newFileName;
					delete bundle[fileName];
					bundle[newFileName] = item;
					fileMap.set(fileName, newFileName);
				}
			}

			// Update source map references
			for (const [oldName, newName] of fileMap) {
				if (oldName.endsWith(".map")) {
					const sourceFile = oldName.replace(/\.map$/, "");
					const newSourceFile = fileMap.get(sourceFile);

					if (newSourceFile && bundle[newSourceFile]) {
						const item = bundle[newSourceFile];
						if (item.type === "chunk") {
							const oldMapBase = path.basename(oldName);
							const newMapBase = path.basename(newName);
							const escapedOldMapBase = oldMapBase.replace(
								/[.*+?^${}()|[\]\\]/g,
								"\\$&",
							);
							item.code = item.code.replace(
								new RegExp(escapedOldMapBase, "g"),
								newMapBase,
							);
						}
					}
				}
			}

			// Process manifest files
			for (const fileName of manifestFiles) {
				const item = bundle[fileName];
				if (item.type !== "asset") continue;

				let content = item.source;
				if (typeof content !== "string") continue;

				try {
					const manifest = JSON.parse(content);
					for (const [oldName, newName] of fileMap) {
						const escapedOldName = oldName.replace(
							/[.*+?^${}()|[\]\\]/g,
							"\\$&",
						);
						const manifestStr = JSON.stringify(manifest);
						const updatedStr = manifestStr.replace(
							new RegExp(escapedOldName, "g"),
							newName,
						);
						Object.assign(manifest, JSON.parse(updatedStr));
					}
					content = JSON.stringify(manifest, null, 2);
				} catch {
					for (const [oldName, newName] of fileMap) {
						const escapedOldName = oldName.replace(
							/[.*+?^${}()|[\]\\]/g,
							"\\$&",
						);
						content = content.replace(new RegExp(escapedOldName, "g"), newName);
					}
				}

				item.source = content;
				// Note: We do NOT rename manifest files themselves
				// They should keep their original names (.vite/manifest.json, etc.)
			}
		},

		async writeBundle(options, bundle) {
			const fs = await import("node:fs/promises");
			const outDir = options.dir || "dist";

			for (const fileName of Object.keys(bundle)) {
				if (!fileName.endsWith(".json")) continue;
				if (!(fileName.includes("manifest") || fileName.includes(".vite"))) {
					continue;
				}

				const filePath = path.join(outDir, fileName);

				try {
					const content = await fs.readFile(filePath, "utf-8");
					const manifest = JSON.parse(content);
					let updated = false;

					for (const bundleFileName of Object.keys(bundle)) {
						const basename = path.basename(
							bundleFileName,
							path.extname(bundleFileName),
						);
						if (basename.startsWith("bafkrei")) {
							const dir = path.dirname(bundleFileName);
							const ext = path.extname(bundleFileName);

							const manifestStr = JSON.stringify(manifest);
							const pattern = new RegExp(
								`"(${dir}/[^"]+${ext.replace(".", "\\.")})"`,
								"g",
							);
							const matches = manifestStr.match(pattern);

							if (matches) {
								for (const match of matches) {
									const oldPath = match.slice(1, -1);
									if (!bundle[oldPath] && oldPath !== bundleFileName) {
										const escapedOldPath = oldPath.replace(
											/[.*+?^${}()|[\]\\]/g,
											"\\$&",
										);
										const updatedStr = JSON.stringify(manifest).replace(
											new RegExp(escapedOldPath, "g"),
											bundleFileName,
										);
										Object.assign(manifest, JSON.parse(updatedStr));
										updated = true;
									}
								}
							}
						}
					}

					if (updated) {
						await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));
					}
				} catch {
					// Ignore errors
				}
			}
		},
	};
}
