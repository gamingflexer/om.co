import React from "react";
import Link from "next/link";
import Seo from "../components/Seo";
import JourneyNav from "../components/JourneyNav";
import data from "../data/portfolio.json";

// Writing index. Posts are listed in data/portfolio.json `writing` (newest
// first); each one is a standalone page in public/blog/<slug>/ with a cover.jpg.
const episode = (post) => {
  const m = /episode (\d+)/i.exec(post.description);
  return m ? Number(m[1]) : null;
};
const summary = (post) => {
  const s = post.description.replace(/^[^:]*episode \d+:\s*/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const PostCard = ({ post, featured }) => {
  const ep = episode(post);
  return (
    // Plain <a>: the posts are static HTML, not Next pages, so no client-side routing.
    <a href={post.url} className={`blogs-card${featured ? " blogs-card--featured" : ""}`}>
      <span className="blogs-card__cover">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
        <img src={`${post.url}cover.jpg`} alt="" width="1920" height="1080" loading={featured ? "eager" : "lazy"} />
      </span>
      <span className="blogs-card__body">
        <span className="blogs-card__meta">
          {ep !== null && <span className="blogs-card__ep">Episode {ep}</span>}
          <span>{post.date}</span>
        </span>
        <span className="blogs-card__title">{post.title}</span>
        <span className="blogs-card__desc">{summary(post)}</span>
        <span className="blogs-card__read">
          Read <span aria-hidden="true">→</span>
        </span>
      </span>
    </a>
  );
};

const Blogs = () => {
  const [latest, ...rest] = data.writing;
  const email = data.socials.find((s) => s.link.startsWith("mailto:"));
  return (
    <>
      <Seo
        title={`Blogs | ${data.name}`}
        description="Book of Clarity: short, interactive essays by Om Surve on why startups fail, when to start one, and why businesses exist."
        path="/blogs/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Book of Clarity",
          url: `${data.siteUrl}/blogs/`,
          author: { "@type": "Person", name: data.name, url: data.siteUrl },
          blogPost: data.writing.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${data.siteUrl}${p.url}` })),
        }}
      />
      <div className="blogs-page">
        <JourneyNav tone="light" />
        <main className="blogs-main">
          <header className="blogs-head">
            <p className="blogs-head__eyebrow">Blogs</p>
            <h1 className="blogs-head__title">Book of Clarity</h1>
            <p className="blogs-head__sub">
              Short, interactive essays on building companies: why most startups fail, when to start one, and why businesses
              exist at all. One idea per episode, each with something to poke at.
            </p>
          </header>
          {latest && <PostCard post={latest} featured />}
          {rest.length > 0 && (
            <div className="blogs-grid">
              {rest.map((p) => (
                <PostCard key={p.url} post={p} />
              ))}
            </div>
          )}
        </main>
        <footer className="blogs-foot">
          <Link href="/" className="blogs-foot__home">
            <span aria-hidden="true">←</span> Back to the meadow
          </Link>
          {email && (
            <a href={email.link} className="blogs-foot__mail">
              Write to me
            </a>
          )}
        </footer>
      </div>
    </>
  );
};

export default Blogs;
