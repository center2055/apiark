"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  RefreshCw,
  Star,
  Download,
  Tag,
  AlertCircle,
  GitPullRequest,
  GitFork,
  Users,
  Activity,
  FolderOpen,
  Flag,
  Info,
  Lock,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REPO = "berbicanes/apiark";
const API = "https://api.github.com";
const PASSWORD = "Aa123456789!";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number | null | undefined): string {
  if (n == null) return "--";
  return Number(n).toLocaleString("en-US");
}

function relTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + "d ago";
  const months = Math.floor(days / 30);
  if (months < 12) return months + "mo ago";
  return Math.floor(months / 12) + "y ago";
}

function absDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sizeFormat(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let b = bytes;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return b.toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

function isAutoUpdaterAsset(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.endsWith(".sig") ||
    n === "latest.json" ||
    n.endsWith(".app.tar.gz") ||
    n.endsWith(".nsis.zip") ||
    n.endsWith(".msi.zip") ||
    n.endsWith(".appimage.tar.gz")
  );
}

function detectPlatform(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("win") || n.includes(".exe") || n.includes(".msi") || n.includes("windows"))
    return "Windows";
  if (
    n.includes("mac") ||
    n.includes("darwin") ||
    n.includes(".dmg") ||
    n.includes("osx") ||
    n.includes("apple") ||
    n.includes("aarch64-apple") ||
    n.includes("x86_64-apple")
  )
    return "macOS";
  if (
    n.includes("linux") ||
    n.includes(".deb") ||
    n.includes(".rpm") ||
    n.includes(".appimage") ||
    n.includes(".tar.gz") ||
    n.includes("x86_64-unknown-linux") ||
    n.includes("aarch64-unknown-linux")
  )
    return "Linux";
  return "Other";
}

/* ------------------------------------------------------------------ */
/*  GitHub API fetch helpers                                           */
/* ------------------------------------------------------------------ */

interface RateLimitInfo {
  remaining: number | null;
  limit: number | null;
}

function ghHeaders(): HeadersInit {
  const token = sessionStorage.getItem("apiark_gh_token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

async function ghFetch(
  path: string,
  params = "",
  onRateLimit?: (info: RateLimitInfo) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = `${API}${path}${params ? "?" + params : ""}`;
  const res = await fetch(url, { headers: ghHeaders() });
  const remaining = res.headers.get("x-ratelimit-remaining");
  const limit = res.headers.get("x-ratelimit-limit");
  if (onRateLimit && remaining != null) {
    onRateLimit({
      remaining: parseInt(remaining),
      limit: limit ? parseInt(limit) : null,
    });
  }
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("x-ratelimit-reset");
    const resetDate = reset
      ? new Date(parseInt(reset) * 1000).toLocaleTimeString()
      : "soon";
    throw new Error(`Rate limited. Resets at ${resetDate}.`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function ghFetchAll(
  path: string,
  params = "per_page=100",
  onRateLimit?: (info: RateLimitInfo) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  let results: unknown[] = [];
  let page = 1;
  while (true) {
    const sep = params ? "&" : "";
    const url = `${API}${path}?${params}${sep}page=${page}&per_page=100`;
    const res = await fetch(url, { headers: ghHeaders() });
    const remaining = res.headers.get("x-ratelimit-remaining");
    const limit = res.headers.get("x-ratelimit-limit");
    if (onRateLimit && remaining != null) {
      onRateLimit({
        remaining: parseInt(remaining),
        limit: limit ? parseInt(limit) : null,
      });
    }
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results = results.concat(data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Types for dashboard data                                           */
/* ------------------------------------------------------------------ */

interface OverviewData {
  stars: number | null;
  downloads: number | null;
  autoUpdates: number | null;
  releases: number | null;
  openIssues: number | null;
  openPRs: number | null;
  forks: number | null;
  watchers: number | null;
  contributors: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ReleaseInfo { tag: string; downloads: number; autoUpdates: number; date: string; prerelease: boolean; assets: any[]; }
interface MostDownloaded { name: string; count: number; release: string; }
interface PlatformCounts { Windows: number; macOS: number; Linux: number; Other: number; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RepoInfo { created_at: string; updated_at: string; size: number; license: any; default_branch: string; language: string; private: boolean; has_wiki: boolean; topics: string[]; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ContributorInfo { login: string; avatar_url: string; html_url: string; contributions: number; }
interface IssuePRCounts { openIssues: number; closedIssues: number; openPRs: number; closedPRs: number; mergedPRs: number; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface LabelInfo { name: string; color: string; description: string; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CommitInfo { sha: string; message: string; author: string; html_url: string; date: string; }
interface ActivityItem { title: string; number: number; html_url: string; date: string; author?: string; }

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2a2a2e] border-t-[#6366f1]" />
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
      {message}
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  index,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="group cursor-default rounded-xl border border-[#2a2a2e] bg-[#18181b] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-black/30"
    >
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] text-lg"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="text-[28px] font-bold tabular-nums text-zinc-100">
        {value}
      </div>
      <div className="text-[13px] font-medium text-zinc-500">{label}</div>
    </motion.div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-xl border border-[#2a2a2e] bg-[#18181b] p-6 ${className}`}
    >
      {title && (
        <h3 className="mb-4 text-[15px] font-semibold text-zinc-400">
          {title}
        </h3>
      )}
      {children}
    </motion.div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold text-zinc-100">
      <span className="text-indigo-400">{icon}</span>
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/*  Login Component                                                    */
/* ------------------------------------------------------------------ */

function LoginOverlay({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("");
  const [token, setToken] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === PASSWORD) {
      sessionStorage.setItem("apiark_metrics_auth", "true");
      if (token.trim()) sessionStorage.setItem("apiark_gh_token", token.trim());
      onLogin();
    } else {
      setShaking(true);
      setError("Incorrect password. Please try again.");
      setPw("");
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0b]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: 1,
          scale: 1,
          x: shaking ? [0, -8, 8, -8, 8, -8, 8, 0] : 0,
        }}
        transition={{ duration: shaking ? 0.5 : 0.3 }}
        className="w-full max-w-[400px] rounded-xl border border-[#2a2a2e] bg-[#141416] p-10 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15">
          <Lock className="h-8 w-8 text-indigo-400" />
        </div>
        <h1 className="mb-1.5 bg-gradient-to-br from-indigo-400 to-violet-400 bg-clip-text text-[28px] font-bold text-transparent">
          ApiArk Metrics
        </h1>
        <p className="mb-7 text-sm text-zinc-400">
          Enter password to view the dashboard
        </p>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-[#2a2a2e] bg-[#1c1c1f] px-4 py-3 pr-11 text-[15px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
              tabIndex={-1}
            >
              {showPw ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
          <div className="mb-4">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="GitHub token (optional, for higher rate limits)"
              className="w-full rounded-lg border border-[#2a2a2e] bg-[#1c1c1f] px-4 py-3 text-[15px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500"
            />
            <p className="mt-1.5 text-left text-[11px] text-zinc-600">
              Without a token: 60 req/hr. With a token: 5,000 req/hr.
            </p>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-500 py-3 text-[15px] font-semibold text-white transition-all hover:bg-indigo-400 active:scale-[0.98]"
          >
            Unlock Dashboard
          </button>
          <div className="mt-3 min-h-[20px] text-[13px] text-red-400">
            {error}
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function MetricsPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({ remaining: null, limit: null });
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [headerToken, setHeaderToken] = useState("");

  // Data states
  const [overview, setOverview] = useState<OverviewData>({
    stars: null, downloads: null, autoUpdates: null, releases: null, openIssues: null,
    openPRs: null, forks: null, watchers: null, contributors: null,
  });
  const [releaseData, setReleaseData] = useState<ReleaseInfo[]>([]);
  const [mostDownloaded, setMostDownloaded] = useState<MostDownloaded | null>(null);
  const [platformCounts, setPlatformCounts] = useState<PlatformCounts>({ Windows: 0, macOS: 0, Linux: 0, Other: 0 });
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [contributorsList, setContributorsList] = useState<ContributorInfo[]>([]);
  const [issuePRCounts, setIssuePRCounts] = useState<IssuePRCounts | null>(null);
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [labels, setLabels] = useState<LabelInfo[]>([]);
  const [recentCommits, setRecentCommits] = useState<CommitInfo[]>([]);
  const [recentIssues, setRecentIssues] = useState<ActivityItem[]>([]);
  const [recentPRs, setRecentPRs] = useState<ActivityItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onRateLimit = useCallback((info: RateLimitInfo) => setRateLimit(info), []);

  // Check session on mount
  useEffect(() => {
    if (sessionStorage.getItem("apiark_metrics_auth") === "true") {
      setAuthed(true);
    }
  }, []);

  // Fetch data once authenticated
  const hasFetched = useRef(false);
  useEffect(() => {
    if (authed && !hasFetched.current) {
      hasFetched.current = true;
      refreshAll();
    }
  }, [authed]);

  const refreshAll = async () => {
    setLoading(true);
    setErrors({});
    await Promise.allSettled([
      fetchRepoInfo(),
      fetchReleases(),
      fetchIssuesAndPRs(),
      fetchContributors(),
      fetchLanguages(),
      fetchRecentCommits(),
      fetchRecentClosedIssues(),
      fetchRecentMergedPRs(),
      fetchLabels(),
    ]);
    setLoading(false);
    setLastUpdated(new Date().toLocaleString());
  };

  const fetchRepoInfo = async () => {
    try {
      const repo = await ghFetch(`/repos/${REPO}`, "", onRateLimit);
      setOverview((prev) => ({
        ...prev,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.subscribers_count,
        openIssues: repo.open_issues_count,
      }));
      setRepoInfo({
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        size: repo.size,
        license: repo.license,
        default_branch: repo.default_branch,
        language: repo.language,
        private: repo.private,
        has_wiki: repo.has_wiki,
        topics: repo.topics || [],
      });
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, repo: (e as Error).message }));
    }
  };

  const fetchReleases = async () => {
    try {
      const releases = await ghFetchAll(`/repos/${REPO}/releases`, "per_page=100", onRateLimit);
      let totalDownloads = 0;
      let totalAutoUpdates = 0;
      const plats: PlatformCounts = { Windows: 0, macOS: 0, Linux: 0, Other: 0 };
      let best: MostDownloaded = { name: "", count: 0, release: "" };
      const data: ReleaseInfo[] = [];

      releases.forEach((r: { tag_name: string; published_at: string; created_at: string; prerelease: boolean; assets: { name: string; download_count: number; size: number }[]; body: string }) => {
        let relDl = 0;
        let relAutoUp = 0;
        (r.assets || []).forEach((a) => {
          if (isAutoUpdaterAsset(a.name)) {
            relAutoUp += a.download_count;
            totalAutoUpdates += a.download_count;
            return;
          }
          relDl += a.download_count;
          totalDownloads += a.download_count;
          const plat = detectPlatform(a.name) as keyof PlatformCounts;
          plats[plat] += a.download_count;
          if (a.download_count > best.count) {
            best = { name: a.name, count: a.download_count, release: r.tag_name };
          }
        });
        data.push({
          tag: r.tag_name,
          downloads: relDl,
          autoUpdates: relAutoUp,
          date: r.published_at || r.created_at,
          prerelease: r.prerelease,
          assets: r.assets || [],
        });
      });

      setOverview((prev) => ({ ...prev, releases: releases.length, downloads: totalDownloads, autoUpdates: totalAutoUpdates }));
      setReleaseData(data);
      setPlatformCounts(plats);
      if (best.count > 0) setMostDownloaded(best);
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, releases: (e as Error).message }));
    }
  };

  const fetchIssuesAndPRs = async () => {
    try {
      const [openIssues, closedIssues, openPRs, closedPRs, mergedPRs] = await Promise.all([
        ghFetch("/search/issues", `q=repo:${REPO}+is:issue+is:open&per_page=1`, onRateLimit),
        ghFetch("/search/issues", `q=repo:${REPO}+is:issue+is:closed&per_page=1`, onRateLimit),
        ghFetch("/search/issues", `q=repo:${REPO}+is:pr+is:open&per_page=1`, onRateLimit),
        ghFetch("/search/issues", `q=repo:${REPO}+is:pr+is:closed&per_page=1`, onRateLimit),
        ghFetch("/search/issues", `q=repo:${REPO}+is:pr+is:merged&per_page=1`, onRateLimit),
      ]);
      const counts = {
        openIssues: openIssues.total_count || 0,
        closedIssues: closedIssues.total_count || 0,
        openPRs: openPRs.total_count || 0,
        closedPRs: closedPRs.total_count || 0,
        mergedPRs: mergedPRs.total_count || 0,
      };
      setIssuePRCounts(counts);
      setOverview((prev) => ({ ...prev, openIssues: counts.openIssues, openPRs: counts.openPRs }));
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, issues: (e as Error).message }));
    }
  };

  const fetchContributors = async () => {
    try {
      const contributors = await ghFetchAll(`/repos/${REPO}/contributors`, "per_page=100", onRateLimit);
      setOverview((prev) => ({ ...prev, contributors: contributors.length }));
      setContributorsList(
        contributors.map((c: { login: string; avatar_url: string; html_url: string; contributions: number }) => ({
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          contributions: c.contributions,
        }))
      );
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, contributors: (e as Error).message }));
    }
  };

  const fetchLanguages = async () => {
    try {
      const langs = await ghFetch(`/repos/${REPO}/languages`, "", onRateLimit);
      setLanguages(langs);
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, languages: (e as Error).message }));
    }
  };

  const fetchRecentCommits = async () => {
    try {
      const commits = await ghFetch(`/repos/${REPO}/commits`, "per_page=10", onRateLimit);
      setRecentCommits(
        commits.map((c: { sha: string; commit: { message: string; author: { name: string; date: string } }; author?: { login: string }; html_url: string }) => ({
          sha: c.sha,
          message: c.commit.message.split("\n")[0],
          author: c.author ? c.author.login : c.commit.author.name,
          html_url: c.html_url,
          date: c.commit.author.date,
        }))
      );
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, commits: (e as Error).message }));
    }
  };

  const fetchRecentClosedIssues = async () => {
    try {
      const issues = await ghFetch(`/repos/${REPO}/issues`, "state=closed&sort=updated&direction=desc&per_page=5", onRateLimit);
      setRecentIssues(
        issues
          .filter((i: { pull_request?: unknown }) => !i.pull_request)
          .map((i: { title: string; number: number; html_url: string; closed_at: string }) => ({
            title: i.title,
            number: i.number,
            html_url: i.html_url,
            date: i.closed_at,
          }))
      );
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, closedIssues: (e as Error).message }));
    }
  };

  const fetchRecentMergedPRs = async () => {
    try {
      const prs = await ghFetch(`/repos/${REPO}/pulls`, "state=closed&sort=updated&direction=desc&per_page=10", onRateLimit);
      setRecentPRs(
        prs
          .filter((p: { merged_at: string | null }) => p.merged_at)
          .slice(0, 5)
          .map((p: { title: string; number: number; html_url: string; merged_at: string; user: { login: string } }) => ({
            title: p.title,
            number: p.number,
            html_url: p.html_url,
            date: p.merged_at,
            author: p.user.login,
          }))
      );
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, mergedPRs: (e as Error).message }));
    }
  };

  const fetchLabels = async () => {
    try {
      const labelsData = await ghFetch(`/repos/${REPO}/labels`, "per_page=100", onRateLimit);
      setLabels(
        labelsData.map((l: { name: string; color: string; description: string }) => ({
          name: l.name,
          color: l.color,
          description: l.description || "",
        }))
      );
    } catch (e: unknown) {
      setErrors((prev) => ({ ...prev, labels: (e as Error).message }));
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Chart data                                                       */
  /* ---------------------------------------------------------------- */

  const sortedReleases = [...releaseData].reverse();

  const downloadsBarData = {
    labels: sortedReleases.map((r) => r.tag),
    datasets: [
      {
        label: "Manual Downloads",
        data: sortedReleases.map((r) => r.downloads),
        backgroundColor: "rgba(99,102,241,0.7)",
        borderColor: "#6366f1",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Auto-Updates",
        data: sortedReleases.map((r) => r.autoUpdates),
        backgroundColor: "rgba(34,197,94,0.5)",
        borderColor: "#22c55e",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const platLabels = (Object.keys(platformCounts) as (keyof PlatformCounts)[]).filter(
    (k) => platformCounts[k] > 0
  );
  const platColors: Record<string, string> = {
    Windows: "#3b82f6",
    macOS: "#a855f7",
    Linux: "#22c55e",
    Other: "#71717a",
  };

  const platformDoughnutData = {
    labels: platLabels,
    datasets: [
      {
        data: platLabels.map((k) => platformCounts[k]),
        backgroundColor: platLabels.map((l) => platColors[l] || "#71717a"),
        borderColor: "#141416",
        borderWidth: 3,
      },
    ],
  };

  const issuesDoughnutData = issuePRCounts
    ? {
        labels: ["Open", "Closed"],
        datasets: [
          {
            data: [issuePRCounts.openIssues, issuePRCounts.closedIssues],
            backgroundColor: ["#ef4444", "#22c55e"],
            borderColor: "#141416",
            borderWidth: 3,
          },
        ],
      }
    : null;

  const prsDoughnutData = issuePRCounts
    ? {
        labels: ["Open", "Merged", "Closed"],
        datasets: [
          {
            data: [
              issuePRCounts.openPRs,
              issuePRCounts.mergedPRs,
              Math.max(0, issuePRCounts.closedPRs - issuePRCounts.mergedPRs),
            ],
            backgroundColor: ["#f97316", "#a855f7", "#71717a"],
            borderColor: "#141416",
            borderWidth: 3,
          },
        ],
      }
    : null;

  const langLabels = Object.keys(languages);
  const langValues = Object.values(languages);
  const langTotal = langValues.reduce((a, b) => a + b, 0);
  const langColorMap: Record<string, string> = {
    Rust: "#dea584", TypeScript: "#3178c6", JavaScript: "#f1e05a", HTML: "#e34c26",
    CSS: "#563d7c", SCSS: "#c6538c", Shell: "#89e051", Python: "#3572A5",
    Go: "#00ADD8", Java: "#b07219", Swift: "#F05138", Kotlin: "#A97BFF",
  };
  const defaultLangColors = ["#6366f1", "#22c55e", "#eab308", "#ef4444", "#06b6d4", "#a855f7", "#f97316", "#ec4899"];

  const languagesBarData = {
    labels: langLabels,
    datasets: [
      {
        label: "Bytes",
        data: langValues,
        backgroundColor: langLabels.map(
          (l, i) => langColorMap[l] || defaultLangColors[i % defaultLangColors.length]
        ),
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: "#71717a", font: { size: 11 } },
        grid: { color: "#2a2a2e" },
      },
      y: {
        ticks: { color: "#71717a" },
        grid: { color: "#2a2a2e" },
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { color: "#a1a1aa", padding: 16, font: { size: 12 } },
      },
    },
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (!authed) {
    return (
      <>
        <Navbar />
        <LoginOverlay onLogin={() => setAuthed(true)} />
      </>
    );
  }

  const statCards = [
    { icon: <Star className="h-[18px] w-[18px]" />, bg: "rgba(234,179,8,.12)", color: "#eab308", value: fmt(overview.stars), label: "Stars" },
    { icon: <Download className="h-[18px] w-[18px]" />, bg: "rgba(34,197,94,.12)", color: "#22c55e", value: fmt(overview.downloads), label: "Manual Downloads" },
    { icon: <RefreshCw className="h-[18px] w-[18px]" />, bg: "rgba(99,102,241,.12)", color: "#6366f1", value: fmt(overview.autoUpdates), label: "Auto-Updates" },
    { icon: <Tag className="h-[18px] w-[18px]" />, bg: "rgba(99,102,241,.12)", color: "#6366f1", value: fmt(overview.releases), label: "Releases" },
    { icon: <AlertCircle className="h-[18px] w-[18px]" />, bg: "rgba(239,68,68,.12)", color: "#ef4444", value: fmt(overview.openIssues), label: "Open Issues" },
    { icon: <GitPullRequest className="h-[18px] w-[18px]" />, bg: "rgba(168,85,247,.12)", color: "#a855f7", value: fmt(overview.openPRs), label: "Open PRs" },
    { icon: <GitFork className="h-[18px] w-[18px]" />, bg: "rgba(6,182,212,.12)", color: "#06b6d4", value: fmt(overview.forks), label: "Forks" },
    { icon: <Eye className="h-[18px] w-[18px]" />, bg: "rgba(249,115,22,.12)", color: "#f97316", value: fmt(overview.watchers), label: "Watchers" },
    { icon: <Users className="h-[18px] w-[18px]" />, bg: "rgba(236,72,153,.12)", color: "#ec4899", value: fmt(overview.contributors), label: "Contributors" },
  ];

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-[1400px] px-5 pb-6 pt-24">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#2a2a2e] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-400">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">
              <span className="text-indigo-400">ApiArk</span> Metrics
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTokenInput(!showTokenInput)}
              className={`cursor-pointer rounded-md bg-[#1c1c1f] px-3 py-1.5 text-xs transition-colors hover:bg-[#222] ${
                rateLimit.remaining != null && rateLimit.remaining < 10
                  ? "text-red-400"
                  : "text-zinc-500"
              }`}
              title="Click to set GitHub token"
            >
              {rateLimit.remaining != null
                ? `API: ${rateLimit.remaining}/${rateLimit.limit} remaining`
                : "Loading..."}
            </button>
            {showTokenInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (headerToken.trim()) {
                    sessionStorage.setItem("apiark_gh_token", headerToken.trim());
                  } else {
                    sessionStorage.removeItem("apiark_gh_token");
                  }
                  setShowTokenInput(false);
                  refreshAll();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="password"
                  value={headerToken}
                  onChange={(e) => setHeaderToken(e.target.value)}
                  placeholder="ghp_... token"
                  autoFocus
                  className="w-48 rounded-lg border border-[#2a2a2e] bg-[#1c1c1f] px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400"
                >
                  Save
                </button>
              </form>
            )}
            <button
              onClick={refreshAll}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-[#2a2a2e] bg-[#141416] px-4 py-2.5 text-[13px] text-zinc-400 transition-all hover:border-indigo-500/50 hover:text-zinc-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        {/* Overview Cards */}
        <div className="mb-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-8">
          {statCards.map((card, i) => (
            <StatCard
              key={card.label}
              icon={card.icon}
              iconBg={card.bg}
              iconColor={card.color}
              value={card.value}
              label={card.label}
              index={i}
            />
          ))}
        </div>

        {/* Downloads Section */}
        <section className="mb-8">
          <SectionTitle icon={<Download className="h-5 w-5" />}>
            Downloads
          </SectionTitle>

          {mostDownloaded && (
            <div className="mb-4 flex items-center gap-4 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/[0.08] to-violet-500/[0.05] p-5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-2xl">
                🏆
              </div>
              <div>
                <div className="text-xl font-bold text-zinc-100">
                  {mostDownloaded.name}
                </div>
                <div className="text-[13px] text-zinc-500">
                  {fmt(mostDownloaded.count)} downloads ({mostDownloaded.release}) — Most downloaded asset
                </div>
              </div>
            </div>
          )}

          {errors.releases ? (
            <ErrorMsg message={errors.releases} />
          ) : (
            <>
              <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <Panel title="Downloads by Release">
                  <div className="relative h-[350px]">
                    {releaseData.length > 0 ? (
                      <Bar data={downloadsBarData} options={{
                        ...chartOptions,
                        plugins: { legend: { display: true, labels: { color: "#a1a1aa", font: { size: 11 } } } },
                        scales: {
                          ...chartOptions.scales,
                          x: { ...chartOptions.scales.x, stacked: true },
                          y: { ...chartOptions.scales.y, stacked: true },
                        },
                      }} />
                    ) : (
                      <LoadingSpinner />
                    )}
                  </div>
                </Panel>
                <Panel title="Platform Breakdown">
                  <div className="mx-auto h-[280px] max-w-[280px]">
                    {platLabels.length > 0 ? (
                      <Doughnut
                        data={platformDoughnutData}
                        options={doughnutOptions}
                      />
                    ) : (
                      <LoadingSpinner />
                    )}
                  </div>
                </Panel>
              </div>

              <Panel title="Downloads Breakdown by Asset">
                {releaseData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr>
                          {["Release", "Asset", "Type", "Platform", "Size", "Downloads"].map((h) => (
                            <th
                              key={h}
                              className={`border-b border-[#2a2a2e] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 ${
                                h === "Downloads" ? "text-right" : ""
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {releaseData.map((r) =>
                          r.assets.length === 0 ? (
                            <tr key={r.tag} className="hover:bg-[#1c1c1f]">
                              <td className="border-b border-[#2a2a2e] px-3 py-2.5 text-zinc-400">
                                {r.tag}
                              </td>
                              <td
                                colSpan={4}
                                className="border-b border-[#2a2a2e] px-3 py-2.5 text-zinc-600"
                              >
                                No assets
                              </td>
                              <td className="border-b border-[#2a2a2e] px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-100">
                                0
                              </td>
                            </tr>
                          ) : (
                            r.assets
                              .filter((a: { name: string }) => {
                                const n = a.name.toLowerCase();
                                return n !== "latest.json" && !n.endsWith(".sig");
                              })
                              .map(
                              (
                                a: {
                                  name: string;
                                  download_count: number;
                                  size: number;
                                },
                                i: number
                              ) => {
                                const isAutoUpdate = isAutoUpdaterAsset(a.name);
                                const plat = detectPlatform(a.name);
                                const platColor =
                                  plat === "Windows"
                                    ? "#3b82f6"
                                    : plat === "macOS"
                                    ? "#a855f7"
                                    : plat === "Linux"
                                    ? "#22c55e"
                                    : "#71717a";
                                return (
                                  <tr
                                    key={`${r.tag}-${a.name}`}
                                    className={`hover:bg-[#1c1c1f] ${isAutoUpdate ? "opacity-60" : ""}`}
                                  >
                                    <td className="border-b border-[#2a2a2e] px-3 py-2.5 text-zinc-400">
                                      {i === 0 ? r.tag : ""}
                                    </td>
                                    <td className="max-w-[300px] break-all border-b border-[#2a2a2e] px-3 py-2.5 text-xs text-zinc-400">
                                      {a.name}
                                    </td>
                                    <td className="border-b border-[#2a2a2e] px-3 py-2.5">
                                      <span
                                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                                          isAutoUpdate
                                            ? "bg-indigo-500/15 text-indigo-400"
                                            : "bg-green-500/15 text-green-400"
                                        }`}
                                      >
                                        {isAutoUpdate ? "Auto-Update" : "Download"}
                                      </span>
                                    </td>
                                    <td className="border-b border-[#2a2a2e] px-3 py-2.5">
                                      <span
                                        className="inline-block rounded px-2 py-0.5 text-[11px] font-semibold"
                                        style={{
                                          background: platColor + "22",
                                          color: platColor,
                                        }}
                                      >
                                        {plat}
                                      </span>
                                    </td>
                                    <td className="border-b border-[#2a2a2e] px-3 py-2.5 text-zinc-400">
                                      {sizeFormat(a.size)}
                                    </td>
                                    <td className="border-b border-[#2a2a2e] px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-100">
                                      {fmt(a.download_count)}
                                    </td>
                                  </tr>
                                );
                              }
                            )
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <LoadingSpinner />
                )}
              </Panel>
            </>
          )}
        </section>

        {/* Stars Section */}
        <section className="mb-8">
          <SectionTitle icon={<Star className="h-5 w-5" />}>Stars</SectionTitle>
          <Panel>
            <div className="bg-gradient-to-br from-indigo-400 to-violet-400 bg-clip-text text-[64px] font-extrabold leading-tight text-transparent">
              {fmt(overview.stars)}
            </div>
            <div className="mt-1 text-sm text-zinc-500">GitHub Stars</div>
            <div className="mt-4 rounded-lg bg-[#1c1c1f] p-3.5 text-[13px] text-zinc-400">
              📈 For full star history over time, visit{" "}
              <a
                href="https://star-history.com/#berbicanes/apiark&Date"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                star-history.com/berbicanes/apiark
              </a>
            </div>
          </Panel>
        </section>

        {/* Releases Section */}
        <section className="mb-8">
          <SectionTitle icon={<Flag className="h-5 w-5" />}>
            Releases
          </SectionTitle>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Latest Release">
              {releaseData.length > 0 ? (
                <>
                  <div className="mb-3">
                    <span className="text-[22px] font-bold text-zinc-100">
                      {releaseData[0].tag}
                    </span>
                    <span
                      className={`ml-2 inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                        releaseData[0].prerelease
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-green-500/15 text-green-400"
                      }`}
                    >
                      {releaseData[0].prerelease ? "Pre-release" : "Stable"}
                    </span>
                  </div>
                  <div className="mb-2 text-[13px] text-zinc-500">
                    Published {relTime(releaseData[0].date)} — {absDate(releaseData[0].date)}
                  </div>
                  <div className="text-[13px] text-zinc-400">
                    {releaseData[0].assets.length} assets — {fmt(releaseData[0].downloads)} downloads, {fmt(releaseData[0].autoUpdates)} auto-updates
                  </div>
                </>
              ) : (
                <LoadingSpinner />
              )}
            </Panel>
            <Panel title="Release Stats">
              {releaseData.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Releases", value: fmt(releaseData.length) },
                    { label: "Stable", value: fmt(releaseData.filter((r) => !r.prerelease).length), color: "text-green-400" },
                    { label: "Pre-release", value: fmt(releaseData.filter((r) => r.prerelease).length), color: "text-yellow-400" },
                    { label: "Manual Downloads", value: fmt(overview.downloads) },
                    { label: "Auto-Updates", value: fmt(overview.autoUpdates), color: "text-indigo-400" },
                    { label: "Total (All)", value: fmt((overview.downloads ?? 0) + (overview.autoUpdates ?? 0)) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg bg-[#1c1c1f] p-3.5"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {item.label}
                      </div>
                      <div
                        className={`mt-1 text-sm font-semibold ${
                          item.color || "text-zinc-100"
                        }`}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <LoadingSpinner />
              )}
            </Panel>
          </div>

          <Panel title="Release Timeline">
            {releaseData.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-[#2a2a2e]" />
                {releaseData.slice(0, 20).map((r) => (
                  <div
                    key={r.tag}
                    className="relative flex gap-3 pb-4 pt-2"
                  >
                    <div
                      className={`absolute -left-[21px] top-3 h-3 w-3 rounded-full border-2 border-[#0a0a0b] ${
                        r.prerelease ? "bg-yellow-400" : "bg-indigo-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-bold text-zinc-100">
                        {r.tag}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {absDate(r.date)} — {relTime(r.date)}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {r.assets.length} assets, {fmt(r.downloads)} downloads, {fmt(r.autoUpdates)} auto-updates
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <LoadingSpinner />
            )}
          </Panel>
        </section>

        {/* Issues & PRs Section */}
        <section className="mb-8">
          <SectionTitle icon={<AlertCircle className="h-5 w-5" />}>
            Issues & Pull Requests
          </SectionTitle>
          {errors.issues ? (
            <ErrorMsg message={errors.issues} />
          ) : (
            <>
              <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <Panel title="Issues">
                  {issuesDoughnutData ? (
                    <>
                      <div className="mx-auto h-[280px] max-w-[280px]">
                        <Doughnut
                          data={issuesDoughnutData}
                          options={doughnutOptions}
                        />
                      </div>
                      <div className="mt-3 text-center text-[13px] text-zinc-500">
                        {fmt(issuePRCounts!.openIssues)} open, {fmt(issuePRCounts!.closedIssues)} closed (
                        {fmt(issuePRCounts!.openIssues + issuePRCounts!.closedIssues)} total)
                      </div>
                    </>
                  ) : (
                    <LoadingSpinner />
                  )}
                </Panel>
                <Panel title="Pull Requests">
                  {prsDoughnutData ? (
                    <>
                      <div className="mx-auto h-[280px] max-w-[280px]">
                        <Doughnut
                          data={prsDoughnutData}
                          options={doughnutOptions}
                        />
                      </div>
                      <div className="mt-3 text-center text-[13px] text-zinc-500">
                        {fmt(issuePRCounts!.openPRs)} open, {fmt(issuePRCounts!.mergedPRs)} merged,{" "}
                        {fmt(Math.max(0, issuePRCounts!.closedPRs - issuePRCounts!.mergedPRs))} closed (
                        {fmt(issuePRCounts!.openPRs + issuePRCounts!.closedPRs)} total)
                      </div>
                    </>
                  ) : (
                    <LoadingSpinner />
                  )}
                </Panel>
              </div>

              <Panel title="Labels">
                {labels.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {labels.map((l) => {
                      const c = "#" + l.color;
                      const r = parseInt(l.color.substr(0, 2), 16);
                      const g = parseInt(l.color.substr(2, 2), 16);
                      const b = parseInt(l.color.substr(4, 2), 16);
                      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                      const textColor = lum > 0.5 ? "#000" : "#fff";
                      return (
                        <span
                          key={l.name}
                          title={l.description}
                          className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: c,
                            color: textColor,
                            borderColor: c + "40",
                          }}
                        >
                          {l.name}
                        </span>
                      );
                    })}
                  </div>
                ) : errors.labels ? (
                  <ErrorMsg message={errors.labels} />
                ) : (
                  <LoadingSpinner />
                )}
              </Panel>
            </>
          )}
        </section>

        {/* Repository Info Section */}
        <section className="mb-8">
          <SectionTitle icon={<FolderOpen className="h-5 w-5" />}>
            Repository Info
          </SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Details">
              {repoInfo ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Created", value: absDate(repoInfo.created_at) },
                      { label: "Last Updated", value: `${relTime(repoInfo.updated_at)} (${absDate(repoInfo.updated_at)})` },
                      { label: "Size", value: sizeFormat(repoInfo.size * 1024) },
                      { label: "License", value: repoInfo.license?.spdx_id || "None" },
                      { label: "Default Branch", value: repoInfo.default_branch },
                      { label: "Language", value: repoInfo.language || "N/A" },
                      { label: "Visibility", value: repoInfo.private ? "Private" : "Public" },
                      { label: "Has Wiki", value: repoInfo.has_wiki ? "Yes" : "No" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg bg-[#1c1c1f] p-3.5"
                      >
                        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          {item.label}
                        </div>
                        <div className="mt-1 break-all text-sm font-semibold text-zinc-100">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {repoInfo.topics.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {repoInfo.topics.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : errors.repo ? (
                <ErrorMsg message={errors.repo} />
              ) : (
                <LoadingSpinner />
              )}
            </Panel>
            <Panel title="Languages">
              {langLabels.length > 0 ? (
                <div className="relative h-[350px]">
                  <Bar
                    data={languagesBarData}
                    options={{
                      ...chartOptions,
                      indexAxis: "y" as const,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const pct = ((Number(ctx.raw) / langTotal) * 100).toFixed(1);
                              return `${sizeFormat(Number(ctx.raw))} (${pct}%)`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#71717a",
                            callback: (v) => sizeFormat(Number(v)),
                          },
                          grid: { color: "#2a2a2e" },
                        },
                        y: {
                          ticks: { color: "#a1a1aa", font: { size: 12 } },
                          grid: { display: false },
                        },
                      },
                    }}
                  />
                </div>
              ) : errors.languages ? (
                <ErrorMsg message={errors.languages} />
              ) : (
                <LoadingSpinner />
              )}
            </Panel>
          </div>
        </section>

        {/* Contributors Section */}
        <section className="mb-8">
          <SectionTitle icon={<Users className="h-5 w-5" />}>
            Contributors
          </SectionTitle>
          <Panel>
            {contributorsList.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {contributorsList.map((c) => (
                  <a
                    key={c.login}
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 rounded-lg border border-transparent bg-[#1c1c1f] p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-500/50"
                  >
                    <img
                      src={`${c.avatar_url}&s=96`}
                      alt={c.login}
                      loading="lazy"
                      className="h-12 w-12 rounded-full border-2 border-[#2a2a2e]"
                    />
                    <div className="break-all text-center text-[13px] font-semibold text-zinc-100">
                      {c.login}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {fmt(c.contributions)} commits
                    </div>
                  </a>
                ))}
              </div>
            ) : errors.contributors ? (
              <ErrorMsg message={errors.contributors} />
            ) : (
              <LoadingSpinner />
            )}
          </Panel>
        </section>

        {/* Recent Activity Section */}
        <section className="mb-8">
          <SectionTitle icon={<Activity className="h-5 w-5" />}>
            Recent Activity
          </SectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Last 10 Commits">
              {recentCommits.length > 0 ? (
                <div className="space-y-0">
                  {recentCommits.map((c) => (
                    <div
                      key={c.sha}
                      className="flex gap-3 border-b border-[#2a2a2e] py-3 last:border-b-0"
                    >
                      <div className="mt-[7px] h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[13px] text-zinc-100"
                          title={c.message}
                        >
                          {c.message}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          <a
                            href={c.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline"
                          >
                            {c.sha.substring(0, 7)}
                          </a>{" "}
                          by {c.author} — {relTime(c.date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : errors.commits ? (
                <ErrorMsg message={errors.commits} />
              ) : (
                <LoadingSpinner />
              )}
            </Panel>

            <Panel title="Last 5 Closed Issues">
              {recentIssues.length > 0 ? (
                <div className="space-y-0">
                  {recentIssues.map((i) => (
                    <div
                      key={i.number}
                      className="flex gap-3 border-b border-[#2a2a2e] py-3 last:border-b-0"
                    >
                      <div className="mt-[7px] h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[13px] text-zinc-100"
                          title={i.title}
                        >
                          {i.title}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          <a
                            href={i.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline"
                          >
                            #{i.number}
                          </a>{" "}
                          closed {relTime(i.date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : errors.closedIssues ? (
                <ErrorMsg message={errors.closedIssues} />
              ) : recentIssues.length === 0 && !loading ? (
                <div className="py-2 text-sm text-zinc-500">No closed issues.</div>
              ) : (
                <LoadingSpinner />
              )}
            </Panel>

            <Panel title="Last 5 Merged PRs">
              {recentPRs.length > 0 ? (
                <div className="space-y-0">
                  {recentPRs.map((p) => (
                    <div
                      key={p.number}
                      className="flex gap-3 border-b border-[#2a2a2e] py-3 last:border-b-0"
                    >
                      <div className="mt-[7px] h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" />
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[13px] text-zinc-100"
                          title={p.title}
                        >
                          {p.title}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          <a
                            href={p.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline"
                          >
                            #{p.number}
                          </a>{" "}
                          merged {relTime(p.date)}
                          {p.author ? ` by ${p.author}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : errors.mergedPRs ? (
                <ErrorMsg message={errors.mergedPRs} />
              ) : recentPRs.length === 0 && !loading ? (
                <div className="py-2 text-sm text-zinc-500">No merged PRs.</div>
              ) : (
                <LoadingSpinner />
              )}
            </Panel>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-[#2a2a2e] pt-8 text-center text-[13px] text-zinc-600">
          <div>
            ApiArk Metrics Dashboard —{" "}
            <a
              href="https://github.com/berbicanes/apiark"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              github.com/berbicanes/apiark
            </a>{" "}
            — &copy; {new Date().getFullYear()}
          </div>
          {lastUpdated && (
            <div className="mt-2 text-xs text-zinc-600">
              Last updated: {lastUpdated}
            </div>
          )}
        </footer>
      </main>
      <Footer />
    </>
  );
}
