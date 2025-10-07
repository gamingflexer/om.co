# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website for Om Surve built with Next.js 12. The site showcases work projects, experience, blog posts, and a resume. Based on a React portfolio template with custom modifications. Live at https://asach.co/

## Development Commands

```bash
# Start development server
npm run dev
# or
yarn dev

# Build for production (includes export for static deployment)
npm run build
npm run export

# Lint code
npm run lint

# Start production server
npm start
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

- `/` (pages/index.js) - Main portfolio page with animated header, projects grid, experience cards, and about section
- `/resume` (pages/resume.js) - Resume page with download link (only shown if `showResume: true` in portfolio.json)
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
- `netlify.toml` specifies build command: `npm run build && npm run export`
- Publishes from `out` directory (Next.js static export)
- Environment variable required: `NETLIFY_NEXT_PLUGIN_SKIP=true`

## Important Notes

- To update portfolio content, modify `data/portfolio.json`
- Blog posts must be added to `_posts/` directory as `.md` files with proper frontmatter
- The `react-portfolio-template-main/` directory appears to be the original template source - main code is in root
- Blog and resume features can be toggled via `showBlog` and `showResume` flags in portfolio.json
