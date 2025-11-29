# Deployment Guide

This project uses Deno and publishes to JSR (JavaScript Registry).

## Publishing to JSR

### Automatic (Recommended)

1. Create a version tag:

```bash
git tag v0.0.2
git push origin v0.0.2
```

2. GitHub Actions automatically:
   - Runs tests
   - Checks formatting & linting
   - Publishes to JSR

### Manual Publishing

```bash
# Ensure you're logged in to JSR
deno publish --dry-run  # Preview what will be published
deno publish            # Publish to JSR
```

## Documentation Deployment

Documentation is automatically generated using `deno doc` and deployed to GitHub
Pages on every push to main.

### Manual Documentation Generation

```bash
# Generate HTML documentation
deno task docs

# View locally
deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts docs
```

## Using the Package

### From JSR (Deno)

```typescript
import { cidVitePlugin } from "jsr:@fusionstrings/vite-plugin-cid";
```

### From JSR (Node.js)

```bash
npx jsr add @fusionstrings/vite-plugin-cid
```

Then in your code:

```typescript
import { cidVitePlugin } from "@fusionstrings/vite-plugin-cid";
```

## CI/CD Workflows

### 1. CI (Pull Requests & Main Branch)

- Runs on every push and PR
- Checks: formatting, linting, type checking, tests

### 2. Publish to JSR

- Runs on version tags (`v*`)
- Publishes package to JSR

### 3. Deploy Documentation

- Runs on pushes to main branch
- Generates and deploys docs to GitHub Pages

## Local Development

```bash
# Check types
deno task check

# Format code
deno task fmt

# Lint
deno task lint

# Run tests
deno task test

# Build with Vite
deno task build

# Watch mode
deno task dev

# Generate documentation locally
deno task docs

# View documentation (after generating)
cd docs && python3 -m http.server 8000
# Or
deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts docs
```

## Running the Playground

```bash
cd playground

# Using Deno
deno run -A npm:vite@7.2.4 build

# Or if you have Vite installed globally
vite build
```

## Setup Requirements

### For JSR Publishing

No secrets needed - JSR uses OIDC tokens from GitHub Actions.

### For GitHub Pages

1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. Push to main to trigger deployment

## 1. Library Deployment (NPM)

**What gets deployed:** The compiled plugin code (`dist/` folder)

**When:** On GitHub releases or manually

**How:**

```bash
# Local testing
npm run build
npm pack

# Publishing (automated via GitHub Actions)
# Create a new release on GitHub, and the workflow will:
# 1. Run tests
# 2. Build the library
# 3. Publish to npm with provenance
```

**Manual publish:**

```bash
npm version patch|minor|major
git push --follow-tags
npm publish
```

## 2. Documentation Deployment (GitHub Pages)

**What gets deployed:** The documentation site (`.vitepress/dist/` folder)

**When:** On every push to main branch

**How:** The GitHub Action automatically:

1. Builds the library
2. Generates API docs from TSDoc
3. Builds VitePress site
4. Deploys to GitHub Pages

**Manual deployment:**

```bash
npm run docs:build
# Deploy .vitepress/dist to your hosting provider
```

## Alternative Hosting Options

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
npm run docs:build
vercel --prod .vitepress/dist
```

### Netlify

```bash
# netlify.toml
[build]
  command = "npm run docs:build"
  publish = ".vitepress/dist"
```

### Cloudflare Pages

```bash
# Build command: npm run docs:build
# Build output directory: .vitepress/dist
```

## Setup Requirements

### For NPM Publishing

1. Create an NPM account
2. Generate an access token with publish permissions
3. Add `NPM_TOKEN` secret to GitHub repository

### For GitHub Pages

1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. Push to main branch to trigger deployment

## Local Development

```bash
# Library development
npm run dev

# Documentation development  
npm run docs:dev

# Preview documentation build
npm run docs:build
npm run docs:preview
```
