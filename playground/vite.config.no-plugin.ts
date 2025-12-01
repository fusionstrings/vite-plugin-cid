import { defineConfig } from "vite";

export default defineConfig({
    root: __dirname,
    plugins: [],
    build: {
        outDir: "dist-no-plugin",
        emptyOutDir: true,
        manifest: true,
        ssrManifest: true,
        modulePreload: true,
    },
});
