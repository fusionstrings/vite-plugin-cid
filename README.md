# Vite Plugin CID

A Vite plugin that uses Content Identifiers (CID) as hashes for build assets,
enabling true content-addressed immutable builds perfect for decentralized web
deployment.

[![JSR](https://jsr.io/badges/@fusionstrings/vite-plugin-cid)](https://jsr.io/@fusionstrings/vite-plugin-cid)
[![JSR Score](https://jsr.io/badges/@fusionstrings/vite-plugin-cid/score)](https://jsr.io/@fusionstrings/vite-plugin-cid)

## Features

- 🔒 **Content Addressed**: Files are named by their content hash (CID),
  ensuring true immutability
- ⚡️ **Vite Powered**: Seamless integration with Vite's build pipeline and
  development server
- 📦 **IPFS Ready**: Perfect for deploying to IPFS, Arweave, or any
  content-addressed storage
- 🔄 **Automatic Updates**: All references to renamed files are automatically
  updated
- 📝 **Manifest Support**: Generates updated manifest files with CID-based
  filenames
- 🎯 **TypeScript**: Written in TypeScript with full type definitions

## Installation

### Deno (JSR)

```typescript
import { cidVitePlugin } from "jsr:@fusionstrings/vite-plugin-cid";
```

### Node.js (npm/pnpm/yarn)

```bash
# Using JSR with npm
npx jsr add @fusionstrings/vite-plugin-cid

# Using JSR with pnpm
pnpm dlx jsr add @fusionstrings/vite-plugin-cid

# Using JSR with yarn
yarn dlx jsr add @fusionstrings/vite-plugin-cid
```

## Usage

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { cidVitePlugin } from "@fusionstrings/vite-plugin-cid";

export default defineConfig({
	plugins: [
		cidVitePlugin(),
	],
	build: {
		manifest: true, // Optional: Generate manifest file
		modulePreload: true, // Optional: Enable module preloading
	},
});
```

## How It Works

1. During the build process, the plugin runs in the `generateBundle` hook
2. Files are processed in topological order (dependencies first)
3. Each file's content is hashed using the IPFS CID algorithm
4. Files are renamed with their CID hash
5. All references to renamed files are automatically updated in:
   - JavaScript/CSS code
   - HTML files
   - Source maps
   - Manifest files

## Configuration

The plugin works out of the box with no configuration required. Simply add it to
your Vite plugins array.

## Example Output

Before:

```
dist/
  assets/
    index-a1b2c3d4.js
    style-e5f6g7h8.css
```

After:

```
dist/
  assets/
    bafkreievmj4srvi27bv4qogei7yqihtcumxrmacteezcl4besq6strr44u.js
    bafkreicdwt3ocjgrqc3nxzvitlterbgeem3hrpaudujvil3hkwhdcbcupm.css
```

## Multi-Page Applications

The plugin supports Multi-Page Applications (MPA) by preserving HTML entry point
filenames. This ensures that web servers can properly serve the application
while all asset files use CID-based naming.

## Development

```bash
# Type check
deno check src/**/*.ts

# Format code
deno fmt

# Lint code
deno lint

# Run tests
deno test --allow-read --allow-write --allow-env

# Generate documentation
deno task docs
```

## Documentation

- [API Documentation](https://fusionstrings.github.io/vite-plugin-cid/)
- [JSR Package](https://jsr.io/@fusionstrings/vite-plugin-cid)

## Publishing

```bash
# Create a new version tag
git tag v0.0.2
git push origin v0.0.2

# Publishes automatically to JSR via GitHub Actions
```

## License

MIT
