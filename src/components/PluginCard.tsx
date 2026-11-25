import { useState } from "react";
import { AppWindow, Copy, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Plugin } from "@/lib/data";
import { copyText } from "@/lib/clipboard";
import { formatDate, hueOf, initialOf } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PluginCardProps {
  plugin: Plugin;
  starred: boolean;
  onToggleStar: () => void;
  canOpenInMagpie: boolean;
  isMobile: boolean;
}

function PluginLogo({ plugin }: { plugin: Plugin }) {
  const [failed, setFailed] = useState(false);
  const hue = hueOf(plugin.repo);

  if (plugin.icon && !failed) {
    return (
      <img
        src={new URL(plugin.icon, document.baseURI).href}
        alt={`${plugin.displayName} 图标`}
        loading="lazy"
        decoding="async"
        className="size-10 shrink-0 rounded-[10px] border object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-[10px] text-sm font-semibold text-white shadow-sm"
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 68% 56%), hsl(${(hue + 46) % 360} 64% 44%))`
      }}
    >
      {initialOf(plugin.displayName)}
    </span>
  );
}

export function PluginCard({ plugin, starred, onToggleStar, canOpenInMagpie, isMobile }: PluginCardProps) {
  const repoUrl = plugin.repoUrl;
  const providers = plugin.providers ?? [];
  const installTarget = plugin.install.replace(/^magpie plugin add\s+/, "");
  const onNpm = Boolean(plugin.npmVersion);

  async function copyInstall() {
    const ok = await copyText(plugin.install);
    toast[ok ? "success" : "error"](ok ? "安装命令已复制" : "复制失败，请手动选中");
  }

  function openInMagpie() {
    if (onNpm && canOpenInMagpie) {
      window.location.href = `magpie://plugin?name=${encodeURIComponent(plugin.repo)}`;
      return;
    }
    void copyText(plugin.install).then((ok) => {
      if (!ok) {
        toast.error("复制失败，请手动选中命令");
        return;
      }
      toast.success(isMobile ? "安装命令已复制" : onNpm ? "没检测到本机 magpie，命令已复制" : "命令已复制，粘贴到终端即可");
    });
  }

  return (
    <Card
      data-plugin={plugin.repo}
      data-provider={plugin.provider}
      className={cn(
        "group flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        plugin.paused && "opacity-80"
      )}
    >
      <CardHeader className="gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="flex items-start gap-3">
          <PluginLogo plugin={plugin} />

          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate text-[0.95rem] leading-snug">
              <a href={repoUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                {plugin.displayName || plugin.repo}
              </a>
            </CardTitle>
            <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
              {plugin.host}/{plugin.owner}/{plugin.repo}
            </p>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-pressed={starred}
                aria-label={starred ? "取消收藏" : "收藏"}
                onClick={onToggleStar}
              >
                <Star className={cn("size-4", starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{starred ? "取消收藏" : "收藏"}</TooltipContent>
          </Tooltip>
        </div>

        <CardDescription className="line-clamp-3 min-h-[3.9rem] text-[0.8rem] leading-relaxed">
          {plugin.summary || plugin.description || "作者还没写简介。"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap gap-1.5 px-4 pb-4 sm:px-5">
        {plugin.paused && (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            已停维护
          </Badge>
        )}
        {plugin.version && (
          <Badge variant="secondary" className="font-mono text-[0.7rem]">
            v{plugin.version}
          </Badge>
        )}
        {providers.slice(0, 2).map((p) => (
          <Badge
            key={p}
            variant="outline"
            title={providers.join(" · ")}
            className="font-mono text-[0.7rem] text-muted-foreground"
          >
            {p}
          </Badge>
        ))}
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch gap-2.5 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <code className="block rounded-md bg-muted px-2.5 py-1.5 font-mono text-[0.7rem] leading-snug text-muted-foreground">
          <span className="block text-[0.65rem] opacity-70">magpie plugin add</span>
          <span className="block truncate text-foreground/80">{installTarget}</span>
        </code>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[0.7rem] text-muted-foreground/80">
            更新于 {formatDate(plugin.updatedAt)}
            {plugin.stars > 0 ? ` · ★ ${plugin.stars}` : ""}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={copyInstall}
            >
              <Copy className="size-3.5" />
              复制
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={openInMagpie}
              aria-label={onNpm && canOpenInMagpie ? "在 magpie 中打开安装页" : "安装（复制命令）"}
              title={
                onNpm && canOpenInMagpie
                  ? "在 magpie 面板中打开，由你确认安装"
                  : isMobile
                    ? "复制安装命令"
                    : onNpm
                      ? "没检测到本机 magpie，点击复制命令"
                      : "未发布到 npm，点击复制命令"
              }
            >
              <AppWindow className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" asChild>
              <a href={repoUrl} target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库">
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
