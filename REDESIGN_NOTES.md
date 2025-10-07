# Website Redesign - October 2025

## Overview
Complete redesign of Om Surve's portfolio website with modern terminal-inspired aesthetics, upgraded to Next.js 15 and React 19.

## Major Updates

### 1. Technology Stack Upgrades
- **Next.js**: 12.1.6 → 15.5.4
- **React & React DOM**: 18.1.0 → 19.2.0
- **All dependencies**: Updated to latest compatible versions
- **Removed**: `custom-cursor-react` (incompatible with React 19)
- **Added**: Custom React-based cursor implementation

### 2. Resume Data Updates (From PDF)
Updated `data/portfolio.json` with current achievements:

#### Professional Highlights
- **Current Role**: VP of Artificial Intelligence @ Fusion Cyber
- **Revenue Impact**: Scaled to $3M+ in 2025
- **Major Deals**: $1M Beacon AI LMS licensing deal
- **Cost Savings**: $500K saved with Rangsphera cyber range development
- **Efficiency Gains**: 30% lead generation boost with Alice AI agents

#### Experience Timeline
1. **Fusion Cyber - VP of AI** (April 2025 - Present)
2. **Fusion Cyber - Head of AI Development** (April 2024 - May 2025)
3. **Fusion Cyber - AI Engineer** (May 2023 - March 2024)
4. **Freelance ML Engineer** (August 2023 - December 2024)
5. **bbsAI - AWS Consultant** (March 2024)
6. **Spark Racing Team - Telemetry Head** (March 2023 - November 2023)
7. **Tericsoft - AI Intern** (May 2023 - August 2023)
8. **IIT Bombay - ML Engineer** (July 2022 - July 2023)

#### Education
- **IIM Bangalore** - HealthCare Incubation (May 2025 - December 2025)
- **Pillai College of Engineering** - B.Tech IT (2021 - 2024)
- **IIT Madras** - Foundation Data Science (Dec 2021 - Dec 2022)

#### Updated Projects
- Beacon AI - AI LMS Platform
- Rangsphera - AI Cyber Range
- Alice AI Calling Agents
- GPOD AI & Freelance Projects (edgeof.xyz, schooltube.com, etc.)
- Smart India Hackathon Winner (NDRF)
- Formula Racing Telemetry System

### 3. New Features

#### ASCII Lego Background Animation
**File**: `components/LegoBackground/index.js`

Features:
- Canvas-based animation with floating ASCII blocks (█▓▒░■▪▫)
- Randomly assembling structures (towers, grids, pyramids)
- Structures build → hold 3-5 seconds → break apart → rebuild
- Terminal-style scan line effects
- Blue color scheme (#0066cc) for light theme
- Performance optimized with RAF (requestAnimationFrame)
- 150 floating blocks + 3 simultaneous structures

#### Glass Morphism Cards
**WorkCard** (`components/WorkCard/index.js`):
- Glass morphism with backdrop blur
- 3D tilt effect on hover (translateY + rotateX)
- Animated gradient borders (cyan → purple → pink)
- Tech stack badges on project images
- Terminal prompt indicator `>_`
- Glow effects and shadows
- "View Project →" hover indicator
- Supports `tech` array prop for displaying technologies

**ServiceCard** (`components/ServiceCard/index.js`):
- Timeline layout with connecting lines and dots
- Animated timeline turns gradient on hover
- Glass morphism cards that slide right on hover
- Date and location badges
- Company logos (emoji icons)
- Terminal prompt style `$ Company Name`
- Smooth hover animations

#### Terminal Boot Sequence
- Dark loading screen with boot messages
- Displays: "INITIALIZING SYSTEM..." → "LOADING MODULES..." → "MOUNTING FILESYSTEMS..." → "> WELCOME TO OM.CO"
- Green terminal text animation
- Fades to main content after sequence

#### Custom Cursor
**File**: `components/Cursor/index.js`

Native React implementation (no external library):
- Cyan color (#0891b2) for visibility on light background
- Follows mouse with smooth animation
- Scales up on hover over `.link` elements
- Lightweight and performant

### 4. Design System

#### Color Palette
- **Primary**: Cyan (#06b6d4, #0891b2)
- **Secondary**: Purple (#a855f7, #9333ea)
- **Accent**: Pink (#ec4899)
- **Terminal**: Green (#00ff41 dark, #059669 light)
- **Background**: White
- **Text**: Slate-900, Slate-700, Slate-600

#### Typography
- **Primary Font**: Hind (body text)
- **Monospace**: JetBrains Mono (terminal elements, headers, code)
- Terminal-style section headers: `> Work_`, `> Experience_`, `> About_`

#### Animations & Effects
- Gradient animations (@keyframes gradient-xy)
- Scan line overlay for terminal aesthetic
- Glitch text effect (available but not currently used)
- Fade-in animations
- Hover lift effects
- Neon glow text-shadow
- Smooth scroll behavior

### 5. UI/UX Improvements

#### Header Navigation
- Black/dark background with white text
- Rounded full (pill shape) design
- Backdrop blur with transparency (bg-black/95)
- Sticky positioning
- Padding and shadow for depth
- Hover effects on buttons (bg-slate-800)

#### Homepage Layout
- Current role badge with gradient background
- Gradient text on name
- Larger, more prominent headings
- Terminal-style prompt indicators throughout
- Improved spacing and hierarchy
- Glass morphism about section

#### Responsive Design
- Custom breakpoints maintained:
  - mob: 375px
  - tablet: 768px
  - laptop: 1024px
  - desktop: 1280px
  - laptopl: 1440px

### 6. Configuration Changes

#### Next.js Config (`next.config.js`)
```javascript
{
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}
```

#### Netlify Config (`netlify.toml`)
```toml
[build]
    command = "npm run build"
    publish = "out"

[build.environment]
    NODE_VERSION = "20.11.0"
```

#### Package.json Scripts
- Removed deprecated `export` script
- Build now handles static export automatically

### 7. Styling Updates (`styles/globals.css`)

New additions:
- Scan line overlay effect
- Custom animations (gradient-xy, glitch, matrix-rain, fadeIn)
- Glass morphism utility classes
- Terminal cursor blink
- Neon glow effects
- Gradient text utilities
- Hidden scrollbar (functionality maintained)
- Smooth scroll behavior

### 8. Contact Information Updates
- Email: osurve20ece@student.mes.ac.in → omsurve.work@gmail.com
- Phone: +917588339211
- Updated across all components (Header, Footer, etc.)

### 9. Theme Changes
- Removed dark mode toggle
- Fixed to light theme with dark accents
- Black header/navigation for contrast
- White content background
- Terminal green accents

## File Changes Summary

### New Files Created
- `components/LegoBackground/index.js` - ASCII animation background
- `CLAUDE.md` - AI assistant documentation
- `REDESIGN_NOTES.md` - This file

### Modified Files
- `components/Cursor/index.js` - Native React cursor
- `components/WorkCard/index.js` - Glass morphism redesign
- `components/ServiceCard/index.js` - Timeline layout
- `components/Header/index.js` - Black rounded header
- `components/Footer/index.js` - Updated links
- `components/Button/index.js` - Light theme styling
- `pages/index.js` - Terminal theme, boot sequence
- `pages/resume.js` - Multi-education support
- `data/portfolio.json` - Complete data update
- `styles/globals.css` - Terminal effects, animations
- `next.config.js` - Static export config
- `netlify.toml` - Node v20, simplified build
- `package.json` - Dependency updates, removed export script

## Performance

- Build time: ~2 seconds
- Homepage size: 4.43 kB
- First Load JS: 168 kB
- All pages successfully prerendered
- Animations optimized with RAF
- Canvas-based background for smooth performance

## Deployment

- **Platform**: Netlify
- **Node Version**: 20.11.0
- **Build Command**: `npm run build`
- **Publish Directory**: `out`
- **Static Export**: Enabled
- **Status**: Ready for deployment ✅

## Future Enhancements

Potential additions:
- "God Mode" toggle for extra effects
- Matrix rain effect variant
- Interactive Lego block builder
- Analytics integration
- Performance monitoring
- SEO optimizations
- Blog section activation

---

**Redesign Date**: October 8, 2025
**Version**: 4.0
**Status**: Production Ready 🚀
