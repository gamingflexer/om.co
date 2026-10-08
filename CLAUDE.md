# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website for Om Surve built with Next.js 16 (Pages Router, static export). The site showcases work projects, experience, blog posts, and a resume. Based on a React portfolio template with custom modifications. Live at https://asach.co/

## Development Commands

```bash
pnpm install      # pnpm only (pnpm-lock.yaml); no npm/yarn lockfiles
pnpm dev          # development server
pnpm build        # next build with output: 'export' -> static site in out/
pnpm lint         # eslint . (flat config in eslint.config.mjs)
```

## Architecture

### Data-Driven Content

Portfolio content is centrally managed in `data/portfolio.json`, which contains:
- Personal info (name, taglines, contact)
- Projects list with images and URLs
- Services/experience items
- Social media links
- Resume data (experiences, education, skills, achievements)
- Feature flags (`showBlog`, `showResume`, `darkMode`)

### Pages Structure

- `/` (pages/index.js) - Scroll-driven journey (`components/Journey`): Om on a meadow → his eye → Earth from orbit → solar system → nearby stars → Milky Way → a lensed black hole (raymarched Schwarzschild disc, `scenes/blackhole.js`) → a supernova (`scenes/supernova.js`) → a pulsar with sweeping beams and pulse rings (`scenes/pulsar.js`) → Local Group → cosmic web/observable universe → back through the eye to the meadow. One fixed WebGL canvas; a 21-viewport spacer provides the scroll range. Each stage is a three.js scene in `components/Journey/scenes/`, rendered to HDR targets and cross-faded in `components/Journey/index.js` (stage windows in `STAGES`). Textures live in `public/space/` (see `public/space/CREDITS.md`); the character is `public/models/om.glb`. `?debug` exposes `window.__journey`, `?hour=18.3` previews a time of day.
- `/blog` (pages/blog/index.js) - Blog listing page (only shown if `showBlog: true` in portfolio.json)
- `/blog/[slug]` (pages/blog/[slug].js) - Individual blog post pages
- `/edit` (pages/edit.js) - Development-only page for editing portfolio data via UI

### Blog System

- Blog posts are stored as Markdown files with frontmatter in `_posts/` directory
- Posts use gray-matter for parsing frontmatter (title, date, image, preview, author)
- Blog functions (`getAllPosts`, `getPostBySlug`) are in `utils/api.js`
- Markdown is converted to HTML using `remark` and `remark-html` (see `utils/markdownToHtml.js`)

### Component Architecture

Key reusable components in `components/`:
- `Header` - Navigation with scroll handlers for work/about sections
- `WorkCard` - Project card with image, title, description
- `ServiceCard` - Experience/service card
- `ProjectResume` - Resume experience item with dates, position, bullets
- `Cursor` - Custom cursor component using `custom-cursor-react`
- `Socials` - Social media links from portfolio.json
- `Footer` - Site footer
- `BlogEditor` - Development-only editor for blog posts

### Animations

GSAP animations are centralized in `animations/index.js`:
- `stagger()` function provides consistent entrance animations across pages
- Used for text reveals and element entrance effects

### Styling

- Tailwind CSS with custom configuration in `tailwind.config.js`
- Custom breakpoints: mob (375px), tablet (768px), laptop (1024px), desktop (1280px), laptopl (1440px)
- Dark mode support via `next-themes` (class-based strategy)
- Global styles in `styles/globals.css`

### Development-Only Features

Several features only work in `NODE_ENV === "development"`:
- Edit Data button on homepage (links to `/edit`)
- Edit Resume button on resume page
- Blog post create/delete functionality
- API route `/api/portfolio` for updating portfolio.json
- API routes `/api/blog` and `/api/blog/edit` for blog CRUD operations

### Deployment

Configured for Netlify deployment:
- `netlify.toml`: build command `pnpm run build`, publish `out/` (Next.js static export), Node 22
- `out/` is a build artifact and is gitignored
- Standalone static pages (e.g. interactive blog posts) live in `public/blog/<slug>/index.html` and are copied as-is into `out/`

## Important Notes

- To update portfolio content, modify `data/portfolio.json`
- Blog posts must be added to `_posts/` directory as `.md` files with proper frontmatter
- The `react-portfolio-template-main/` directory appears to be the original template source - main code is in root
- Blog and resume features can be toggled via `showBlog` and `showResume` flags in portfolio.json
