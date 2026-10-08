import Head from "next/head";
import data from "../../data/portfolio.json";

// Per-page <head> tags: title, description, canonical, Open Graph, Twitter,
// optional robots directive and JSON-LD. `path` is the route with trailing
// slash (the site exports with trailingSlash: true).
const Seo = ({ title, description, path = "/", noindex = false, jsonLd, type = "website" }) => {
  const url = `${data.siteUrl}${path}`;
  const desc = description || data.siteDescription;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={data.name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Head>
  );
};

export default Seo;
