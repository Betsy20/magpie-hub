import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, RefreshCw, SearchX, Settings2 } from "lucide-react";
import siteConfig from "../config.json";
import { IntroGate } from "@/components/IntroGate";
import { PluginCard } from "@/components/PluginCard";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toolbar, type Filter, type Sort } from "@/components/Toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { applyLive, fetchLive, loadSnapshot, type Provider, type Plugin } from "@/lib/data";
import { readJson, storageKeys, writeJson } from "@/lib/storage";

interface SourceConfig {
  provider: Provider;
  owner?: string;
  repo?: string;
}

const config = siteConfig as {
  title: string;
  heading: string;
  sources: SourceConfig[];
  include: string[];
  exclude: string[];
  pins: string[];
  liveOnLoad: boolean;
  gateSeconds: number;
};

const sources = (config.sources ?? []) as SourceConfig[];
const primaryOwner = sources.find((source) => source.provider === "github" && source.owner)?.owner ?? "MYCF711";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-2.1c-3.2.69-3.88-1.35-3.88-1.35-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export default function App() {
  const [owner, setOwner] = useState(primaryOwner);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
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

  const isStarred = (plugin: Plugin) =>
    config.pins.includes(plugin.repo) || stars.includes(`${plugin.provider}:${plugin.owner}/${plugin.repo}`);

  async function sync(target = owner, silent = false) {
    setSyncing(true);
    try {
      const { repos, rate: remaining } = await fetchLive(target);
      setRate(remaining);
      setPlugins((previous) => applyLive(target, repos, previous));
      setLiveAt(new Date().toISOString());
      if (!silent) toast.success("已同步 GitHub 仓库列表");
      return true;
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "同步失败");
      return false;
    } finally {
      setSyncing(false);
    }
  }

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    (async () => {
      const snapshot = await loadSnapshot();
      const fromUrl = new URLSearchParams(location.search).get("owner");
      const stored = readJson<string>(storageKeys.owner, "");
      setOwner((fromUrl || stored || primaryOwner).replace(/^@/, "").trim());

      if (snapshot?.plugins?.length) {
        setPlugins(snapshot.plugins);
        setSnapshotAt(snapshot.generatedAt);
      }
      setLoading(false);

      if (!snapshot?.plugins?.length || readJson<boolean>(storageKeys.live, Boolean(config.liveOnLoad))) {
        await sync(primaryOwner, true);
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

  async function handleSave(nextOwner: string, nextLive: boolean) {
    writeJson(storageKeys.owner, nextOwner);
    writeJson(storageKeys.live, nextLive);
    setLiveOnLoad(nextLive);
    setSettingsOpen(false);

    if (nextOwner !== owner) {
      setOwner(nextOwner);
      // 只清掉上一个 GitHub 作者的条目，Gitee 等其他来源不动
      setPlugins((previous) => previous.filter((plugin) => plugin.provider !== "github"));
      setLiveAt(null);
    }

    setSaving(true);
    const ok = await sync(nextOwner);
    setSaving(false);
    if (ok) toast.success(`已切换到 ${nextOwner}`);
  }

  function handleReset() {
    Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
    setSettingsOpen(false);
    setStars([]);
    setLiveOnLoad(Boolean(config.liveOnLoad));
    location.reload();
  }

  const ownerUrl = `https://github.com/${owner}`;
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
                <a href={ownerUrl} target="_blank" rel="noreferrer" aria-label={`${owner} 的 GitHub`}>
                  <GithubMark className="size-4" />
                  <span className="hidden sm:inline">@{owner}</span>
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
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="gap-1.5 py-1">
                <Package className="size-3.5" />
                {counts.all} 个插件
              </Badge>
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
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <a className="hover:text-foreground" href="https://github.com/yetone/magpie" target="_blank" rel="noreferrer">
                magpie
              </a>
              {sources
                .filter((source) => source.owner)
                .map((source) => (
                  <a
                    key={`${source.provider}:${source.owner}`}
                    className="hover:text-foreground"
                    href={
                      source.provider === "gitee"
                        ? `https://gitee.com/${source.owner}`
                        : `https://github.com/${source.owner}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.owner}
                  </a>
                ))}
            </div>
          </div>
        </footer>

        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          owner={owner}
          liveOnLoad={liveOnLoad}
          snapshotAt={snapshotAt}
          liveAt={liveAt}
          rate={rate}
          count={counts.all}
          saving={saving}
          onSave={handleSave}
          onReset={handleReset}
        />

        <IntroGate seconds={config.gateSeconds} sample={sample} />
      </div>
    </TooltipProvider>
  );
}
