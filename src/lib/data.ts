export type Provider = "github" | "gitee";

export interface Plugin {
  provider: Provider;
  owner: string;
  repo: string;
  host: string;
  repoUrl: string;
  displayName: string;
  description: string;
  summary: string;
  version: string | null;
  providers: string[];
  license: string | null;
  node: string | null;
  icon?: string | null;
  npmVersion?: string | null;
  homepage: string | null;
  topics: string[];
  stars: number;
  archived: boolean;
  paused: boolean;
  updatedAt: string;
  install: string;
}

export interface SourceSummary {
  provider: Provider;
  owner: string;
  repoCount: number;
  pluginCount: number;
}

export interface Snapshot {
  schema: number;
  generatedAt: string;
  sources: SourceSummary[];
  pluginCount: number;
  plugins: Plugin[];
}

const PAUSED_RE = /停止维护|暂停维护|deprecated|归档|archived/i;

export const isPluginRepo = (repo: { name?: string; topics?: string[] }) => {
  const name = (repo.name ?? "").toLowerCase();
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  return name.startsWith("magpie-") || topics.includes("magpie-plugin");
};

export async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const res = await fetch(new URL("data/plugins.json", document.baseURI), { cache: "no-cache" });
    if (!res.ok) return null;
    return (await res.json()) as Snapshot;
  } catch {
    return null;
  }
}

export interface LiveRepo {
  name: string;
  description: string | null;
  topics?: string[];
  license?: { spdx_id?: string | null } | null;
  homepage?: string | null;
  stargazers_count?: number;
  archived?: boolean;
  pushed_at?: string;
  updated_at?: string;
}

export async function fetchLive(owner: string): Promise<{ repos: LiveRepo[]; rate: number | null }> {
  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated`,
    { headers: { accept: "application/vnd.github+json" }, cache: "no-store" }
  );
  if (!res.ok) {
    const limited = res.status === 403 || res.status === 429;
    throw new Error(limited ? "GitHub 接口限流了，稍后再试" : `GitHub 返回 ${res.status}`);
  }
  const rate = res.headers.get("x-ratelimit-remaining");
  return { repos: (await res.json()) as LiveRepo[], rate: rate === null ? null : Number(rate) };
}

export function fromLiveRepo(repo: LiveRepo, owner: string): Plugin {
  const description = repo.description ?? "";
  return {
    provider: "github",
    owner,
    repo: repo.name,
    host: "github.com",
    repoUrl: `https://github.com/${owner}/${repo.name}`,
    displayName: repo.name,
    description,
    summary: description,
    version: null,
    providers: [],
    license: repo.license?.spdx_id ?? null,
    node: null,
    icon: null,
    npmVersion: null,
    homepage: repo.homepage ?? null,
    topics: repo.topics ?? [],
    stars: repo.stargazers_count ?? 0,
    archived: Boolean(repo.archived),
    paused: PAUSED_RE.test(`${repo.name} ${description}`),
    updatedAt: repo.pushed_at ?? repo.updated_at ?? "",
    install: `magpie plugin add github:${owner}/${repo.name}`
  };
}

/** 实时列表决定“有哪些仓库”，快照补齐版本号、中文简介和图标。 */
export function mergeLive(repos: LiveRepo[], owner: string, previous: Plugin[]): Plugin[] {
  const byRepo = new Map(previous.map((plugin) => [plugin.repo, plugin]));
  return repos.filter(isPluginRepo).map((repo) => {
    const prev = byRepo.get(repo.name);
    if (!prev) return fromLiveRepo(repo, owner);
    return {
      ...prev,
      updatedAt: repo.pushed_at ?? prev.updatedAt,
      stars: repo.stargazers_count ?? prev.stars,
      archived: Boolean(repo.archived),
      paused: prev.paused || Boolean(repo.archived),
      topics: repo.topics?.length ? repo.topics : prev.topics,
      homepage: repo.homepage ?? prev.homepage,
      install: `magpie plugin add github:${owner}/${repo.name}`
    };
  });
}

/** 只替换这个 GitHub 作者的那部分，Gitee 等其他来源原样保留。 */
export function applyLive(owner: string, repos: LiveRepo[], previous: Plugin[]): Plugin[] {
  const isSameOwner = (plugin: Plugin) => plugin.provider === "github" && plugin.owner === owner;
  return [
    ...previous.filter((plugin) => !isSameOwner(plugin)),
    ...mergeLive(repos, owner, previous.filter(isSameOwner))
  ];
}
