import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, RefreshCw, SearchX, Settings2 } from "lucide-react";
import siteConfig from "../config.json";
import { IntroGate } from "@/components/IntroGate";
import { PluginCard } from "@/components/PluginCard";
import { SettingsDialog, type SourceConfig } from "@/components/SettingsDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toolbar, type Filter, type Sort } from "@/components/Toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { applyLive, fetchLive, loadSnapshot, type Author, type Plugin } from "@/lib/data";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import { cn } from "@/lib/utils";

const config = siteConfig as {
  title: string;
  heading: string;
  sources: { provider: "github" | "gitee"; owner?: string; repo?: string }[];
  include: string[];
  exclude: string[];
  pins: string[];
  liveOnLoad: boolean;
  gateSeconds: number;
};

const defaultSources: SourceConfig[] = (config.sources ?? [])
  .filter((source) => source.owner)
  .map((source) => ({ provider: source.provider, owner: source.owner as string }));

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-2.1c-3.2.69-3.88-1.35-3.88-1.35-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export default function App() {
  const [sources, setSources] = useState<SourceConfig[]>(defaultSources);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [stars, setStars] = useState<string[]>(() => readJson<string[]>(storageKeys.stars, []));
  const [liveOnLoad, setLiveOnLoad] = useState<boolean>(() =>
    readJson<boolean>(storageKeys.live, Boolean(config.liveOnLoad))
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 手机 / 平板：没有本机 magpie，一键安装只能退回复制命令
  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const forced = new URLSearchParams(location.search).get("mobile");
    if (forced === "1") return true;
    if (forced === "0") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
  }, []);

  // 探测本机 magpie 网关（默认 3425）；no-cors 只看能不能连通，不看内容
  const [magpieOnline, setMagpieOnline] = useState(false);
  useEffect(() => {
    if (isMobile) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1500);
    fetch("http://127.0.0.1:3425/", { mode: "no-cors", signal: controller.signal })
      .then(() => setMagpieOnline(true))
      .catch(() => setMagpieOnline(false))
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isMobile]);

  const primaryOwner = sources.find((source) => source.provider === "github")?.owner ?? "MYCF711";
  const avatarOf = (provider: string, owner: string) =>
    authors.find((author) => author.provider === provider && author.owner === owner)?.avatar ?? null;
  const authorGroups = (["github", "gitee"] as const)
    .map((provider) => ({
      provider,
      items: sources
        .filter((source) => source.provider === provider)
        .map((source) => ({ ...source, avatar: avatarOf(source.provider, source.owner) }))
    }))
    .filter((group) => group.items.length > 0);

  const isStarred = (plugin: Plugin) =>
    config.pins.includes(plugin.repo) || stars.includes(`${plugin.provider}:${plugin.owner}/${plugin.repo}`);

  async function sync(list: SourceConfig[] = sources, silent = false) {
    const githubSources = list.filter((source) => source.provider === "github" && source.owner);
    if (!githubSources.length) {
      if (!silent) toast.error("至少要留一个 GitHub 作者才能同步");
      return false;
    }
    setSyncing(true);
    try {
      for (const source of githubSources) {
        const { repos, rate: remaining } = await fetchLive(source.owner);
        setRate(remaining);
        setPlugins((previous) => applyLive(source.owner, repos, previous));
      }
      setLiveAt(new Date().toISOString());
      if (!silent) toast.success(`已同步 ${githubSources.length} 位作者的仓库列表`);
      return true;
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "同步失败");
      return false;
    } finally {
      setSyncing(false);
    }
  }

  // 键盘：/ 聚焦搜索，Esc 清空搜索
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA)$/.test(target.tagName);
      if (event.key === "/" && !typing && !document.getElementById("intro-gate")) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="搜索插件"]')?.focus();
      }
      if (event.key === "Escape" && typing) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    (async () => {
      const stored = readJson<SourceConfig[]>(storageKeys.sources, []);
      let next = (Array.isArray(stored) && stored.length ? stored : defaultSources).filter(
        (source) => source?.provider && source?.owner
      );

      const fromUrl = new URLSearchParams(location.search).get("owner");
      if (fromUrl) {
        const owner = fromUrl.replace(/^@/, "").trim();
        if (owner && !next.some((source) => source.owner === owner)) {
          next = [{ provider: "github", owner }, ...next];
        }
      }
      setSources(next);

      const snapshot = await loadSnapshot();
      if (snapshot?.plugins?.length) {
        setPlugins(snapshot.plugins);
        setSnapshotAt(snapshot.generatedAt);
        setAuthors(snapshot.authors ?? []);
      }
      setLoading(false);

      if (!snapshot?.plugins?.length || readJson<boolean>(storageKeys.live, Boolean(config.liveOnLoad))) {
        await sync(next, true);
      }
    })();
  }, []);

  useEffect(() => {
    const visible = plugins.filter(
      (plugin) => !config.exclude.includes(plugin.repo) || config.include.includes(plugin.repo)
    ).length;
    document.title = `${config.title} · ${visible} 个插件`;
  }, [plugins]);

  const pool = useMemo(
    () => plugins.filter((plugin) => !config.exclude.includes(plugin.repo) || config.include.includes(plugin.repo)),
    [plugins]
  );

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: pool.length,
      active: pool.filter((plugin) => !plugin.paused).length,
      starred: pool.filter((plugin) => isStarred(plugin)).length,
      paused: pool.filter((plugin) => plugin.paused).length
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, stars]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = pool.filter((plugin) => {
      if (filter === "active" && plugin.paused) return false;
      if (filter === "paused" && !plugin.paused) return false;
      if (filter === "starred" && !isStarred(plugin)) return false;
      if (!q) return true;
      const haystack = [
        plugin.repo,
        plugin.owner,
        plugin.host,
        plugin.displayName,
        plugin.summary,
        plugin.description,
        ...(plugin.providers ?? []),
        ...(plugin.topics ?? [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    const weight = (plugin: Plugin) => (isStarred(plugin) ? 0 : 1);
    const time = (plugin: Plugin) => new Date(plugin.updatedAt).getTime() || 0;

    return filtered.sort((a, b) => {
      if (weight(a) !== weight(b)) return weight(a) - weight(b);
      if (sort === "name") return (a.displayName || a.repo).localeCompare(b.displayName || b.repo, "zh-CN");
      if (sort === "oldest") return time(a) - time(b);
      return time(b) - time(a);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, query, filter, sort, stars]);

  function toggleStar(plugin: Plugin) {
    const id = `${plugin.provider}:${plugin.owner}/${plugin.repo}`;
    setStars((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      writeJson(storageKeys.stars, next);
      return next;
    });
  }

  async function handleSave(nextSources: SourceConfig[], nextLive: boolean) {
    writeJson(storageKeys.sources, nextSources);
    writeJson(storageKeys.live, nextLive);
    setSources(nextSources);
    setLiveOnLoad(nextLive);
    setSettingsOpen(false);

    // 被移除的作者，卡片一起撤掉；剩下的保持原样
    setPlugins((previous) =>
      previous.filter((plugin) =>
        nextSources.some((source) => source.provider === plugin.provider && source.owner === plugin.owner)
      )
    );

    setSaving(true);
    await sync(nextSources);
    setSaving(false);
  }

  function handleReset() {
    Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
    setSettingsOpen(false);
    setStars([]);
    setLiveOnLoad(Boolean(config.liveOnLoad));
    location.reload();
  }

  const hasFilters = filter !== "all" || query.trim().length > 0;
  const sample = rows[0] ?? pool[0];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
            <a href="./" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
              <img
                src={new URL("owner.png", document.baseURI).href}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-lg border object-cover"
              />
              <span className="text-[0.95rem] sm:text-base">{config.title}</span>
            </a>

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="hidden gap-1.5 px-2 text-muted-foreground min-[380px]:inline-flex"
                asChild
              >
                <a href={`https://github.com/${primaryOwner}`} target="_blank" rel="noreferrer" aria-label="GitHub">
                  <GithubMark className="size-4" />
                  <span className="hidden sm:inline">@{primaryOwner}</span>
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => sync()} disabled={syncing} className="px-2 sm:px-3">
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                <span className="hidden min-[380px]:inline">同步</span>
              </Button>
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="设置" onClick={() => setSettingsOpen(true)}>
                    <Settings2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>设置</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6 sm:pb-20">
          <section className="pt-8 sm:pt-12">
            <h1 className="text-balance text-[clamp(1.65rem,4vw+0.9rem,2.4rem)] font-semibold leading-tight tracking-tight">
              {config.heading}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1.5 py-1">
                <Package className="size-3.5" />
                {counts.all} 个插件
              </Badge>
              <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    magpieOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
                {isMobile ? "手机端：复制命令到电脑装" : magpieOnline ? "本机 magpie 已运行" : "未检测到本机 magpie"}
              </span>
              {sources.map((source) => (
                <a
                  key={`${source.provider}:${source.owner}`}
                  href={
                    source.provider === "gitee"
                      ? `https://gitee.com/${source.owner}`
                      : `https://github.com/${source.owner}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {avatarOf(source.provider, source.owner) ? (
                    <img
                      src={new URL(avatarOf(source.provider, source.owner) as string, document.baseURI).href}
                      alt=""
                      className="size-4 rounded-full"
                    />
                  ) : (
                    <span className="font-mono text-[10px] opacity-60">{source.provider}</span>
                  )}
                  @{source.owner}
                </a>
              ))}
            </div>
          </section>

          <div className="sticky top-14 z-30 -mx-4 mt-5 bg-background/85 px-4 py-3 backdrop-blur sm:top-16 sm:-mx-6 sm:px-6">
            <Toolbar
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              sort={sort}
              onSortChange={setSort}
              counts={counts}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-[10px]" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="mt-4 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-5/6" />
                  <Skeleton className="mt-4 h-8 w-full" />
                </div>
              ))}
            </div>
          ) : rows.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {rows.map((plugin) => (
                <PluginCard
                  key={`${plugin.provider}:${plugin.owner}/${plugin.repo}`}
                  plugin={plugin}
                  starred={isStarred(plugin)}
                  onToggleStar={() => toggleStar(plugin)}
                  canOpenInMagpie={magpieOnline && !isMobile}
                  isMobile={isMobile}
                />
              ))}
            </div>
          ) : (
            <div className="mt-2 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center sm:py-20">
              <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <SearchX className="size-5" />
              </span>
              <p className="mt-4 font-medium">{hasFilters ? "没有匹配的插件" : "这里还没有插件"}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {hasFilters ? "换个关键词，或切回「全部」。" : "先跑 npm run data 生成快照，或点右上角「同步」。"}
              </p>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  清除筛选
                </Button>
              )}
            </div>
          )}
        </main>

        <footer className="mt-auto border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6">
            <a className="hover:text-foreground" href="https://github.com/yetone/magpie" target="_blank" rel="noreferrer">
              magpie
            </a>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {authorGroups.map((group) => (
                <div key={group.provider} className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{group.provider}</span>
                  <div className="flex items-center gap-2">
                    {group.items.map((item) => (
                      <a
                        key={`${item.provider}:${item.owner}`}
                        href={
                          item.provider === "gitee"
                            ? `https://gitee.com/${item.owner}`
                            : `https://github.com/${item.owner}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors hover:text-foreground"
                      >
                        {item.avatar ? (
                          <img
                            src={new URL(item.avatar, document.baseURI).href}
                            alt=""
                            className="size-5 rounded-full"
                          />
                        ) : (
                          <span className="grid size-5 place-items-center rounded-full bg-muted text-[9px] uppercase">
                            {item.owner.slice(0, 1)}
                          </span>
                        )}
                        {item.owner}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </footer>

        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          sources={sources}
          liveOnLoad={liveOnLoad}
          saving={saving}
          onSave={handleSave}
          onReset={handleReset}
        />

        <IntroGate
          seconds={config.gateSeconds}
          sample={sample}
          canOpenInMagpie={magpieOnline && !isMobile}
          isMobile={isMobile}
        />
      </div>
    </TooltipProvider>
  );
}
