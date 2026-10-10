const fs = require('fs')
const path = require('path')
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

// Standalone blog posts live in public/blog/<slug>/index.html. The static
// export copies them to out/ where Netlify serves the directory index, but
// `next dev` neither serves directory indexes nor lets them win over
// pages/blog/[slug].js, so in dev rewrite each one to its index.html.
const staticPosts = () => {
  const dir = path.join(__dirname, 'public/blog')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'index.html')))
    .map((d) => d.name)
}

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => {
  const dev = phase === PHASE_DEVELOPMENT_SERVER
  return {
    reactStrictMode: true,
    // rewrites are not allowed with output: 'export', so only export outside dev
    ...(dev ? {} : { output: 'export' }),
    images: {
      unoptimized: true,
    },
    trailingSlash: true,
    turbopack: {
      root: __dirname,
    },
    ...(dev && {
      async rewrites() {
        return {
          beforeFiles: staticPosts().map((slug) => ({
            source: `/blog/${slug}/`,
            destination: `/blog/${slug}/index.html`,
          })),
        }
      },
    }),
  }
}
