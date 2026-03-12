"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, Tag, AlertCircle } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

const REPO = "berbicanes/apiark";
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=50`;

interface GHRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string | null;
  published_at: string;
  prerelease: boolean;
  html_url: string;
  draft: boolean;
}

type FetchStatus = "loading" | "success" | "empty" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Very lightweight markdown-to-HTML for release notes.
 *  Handles: headings (##, ###), bold, inline code, bullet lists, links, and paragraphs. */
function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Close list if line is not a bullet
    if (inList && !line.match(/^\s*[-*]\s/)) {
      html += "</ul>";
      inList = false;
    }

    if (line.match(/^###\s/)) {
      html += `<h4 class="mt-5 mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">${inlineFormat(line.replace(/^###\s+/, ""))}</h4>`;
    } else if (line.match(/^##\s/)) {
      html += `<h3 class="mt-6 mb-2 text-base font-semibold text-zinc-300">${inlineFormat(line.replace(/^##\s+/, ""))}</h3>`;
    } else if (line.match(/^\s*[-*]\s/)) {
      if (!inList) {
        html += '<ul class="space-y-1.5 mb-3">';
        inList = true;
      }
      const content = line.replace(/^\s*[-*]\s+/, "");
      html += `<li class="flex items-start gap-2 text-sm text-zinc-400 leading-relaxed"><span class="text-zinc-600 mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-zinc-600"></span><span>${inlineFormat(content)}</span></li>`;
    } else if (line.trim() === "") {
      // skip blank lines
    } else {
      html += `<p class="text-sm text-zinc-400 leading-relaxed mb-2">${inlineFormat(line)}</p>`;
    }
  }

  if (inList) html += "</ul>";
  return html;
}

function inlineFormat(text: string): string {
  return text
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline">$1</a>')
    // Bold: **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-zinc-300 font-medium">$1</strong>')
    // Inline code: `text`
    .replace(/`([^`]+)`/g, '<code class="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs font-mono text-zinc-300">$1</code>');
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function ChangelogPage() {
  const [releases, setReleases] = useState<GHRelease[]>([]);
  const [status, setStatus] = useState<FetchStatus>("loading");

  useEffect(() => {
    fetch(RELEASES_API)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: GHRelease[]) => {
        const published = data.filter((r) => !r.draft);
        if (published.length === 0) {
          setStatus("empty");
        } else {
          setReleases(published);
          setStatus("success");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-36">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Changelog
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            New updates and improvements to ApiArk.
          </p>
        </motion.div>

        {/* Loading */}
        {status === "loading" && (
          <div className="mt-20 flex items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading releases...</span>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center"
          >
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
            <p className="text-sm text-zinc-400 mb-3">
              Could not load releases from GitHub.
            </p>
            <a
              href={`https://github.com/${REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:underline"
            >
              View releases on GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </motion.div>
        )}

        {/* No releases yet */}
        {status === "empty" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center"
          >
            <Tag className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
            <p className="text-zinc-300 font-medium mb-1">No releases yet</p>
            <p className="text-sm text-zinc-500 mb-4">
              The first release is coming soon. Star us on GitHub to get notified.
            </p>
            <a
              href={`https://github.com/${REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:underline"
            >
              Follow on GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </motion.div>
        )}

        {/* Releases */}
        {status === "success" && (
          <div className="mt-16 space-y-16">
            {releases.map((release, idx) => (
              <motion.article
                key={release.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                className="relative"
              >
                {/* Timeline dot + line */}
                {idx < releases.length - 1 && (
                  <div className="absolute left-[-28px] top-3 bottom-[-64px] w-px bg-[var(--color-border)] hidden lg:block" />
                )}
                <div className="absolute left-[-32px] top-2 hidden h-2.5 w-2.5 rounded-full border-2 border-indigo-500 bg-[var(--color-bg)] lg:block" />

                {/* Version header */}
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white">
                    {release.tag_name}
                  </h2>
                  {release.prerelease && (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-400">
                      Pre-release
                    </span>
                  )}
                  {idx === 0 && !release.prerelease && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400">
                      Latest
                    </span>
                  )}
                  <a
                    href={release.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-zinc-600 hover:text-zinc-400 transition-colors inline-flex items-center gap-1"
                  >
                    View on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  {release.name && release.name !== release.tag_name && (
                    <span className="text-zinc-400">{release.name} &middot; </span>
                  )}
                  {formatDate(release.published_at)}
                </p>

                {/* Release body (rendered markdown) */}
                {release.body && (
                  <div
                    className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(release.body) }}
                  />
                )}

                {!release.body && (
                  <p className="mt-4 text-sm text-zinc-600 italic">
                    No release notes for this version.
                  </p>
                )}
              </motion.article>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
