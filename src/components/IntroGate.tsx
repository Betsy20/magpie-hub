import { useCallback, useEffect, useRef, useState } from "react";
import { AppWindow, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyText, copyWithToast } from "@/lib/clipboard";
import type { Plugin } from "@/lib/data";

import { storageKeys } from "@/lib/storage";

const STORAGE_KEY = storageKeys.intro;
const LOGO = () => new URL("owner.png", document.baseURI).href;

function buildPrompt(sample?: Plugin) {
  const name = sample?.repo ?? "<插件名>";
  const url = sample?.repoUrl ? `（${sample.repoUrl}）` : "";
  return `插件：${name}${url}

我遇到的问题：<用一句话说清楚就行，比如：登录之后模型列表是空的>

帮我看看是怎么回事。如果确认是插件本身的问题，请直接给作者提 issue 或 PR。`;
}

interface IntroGateProps {
  seconds: number;
  sample?: Plugin;
  canOpenInMagpie: boolean;
  isMobile: boolean;
}

/**
 * 开屏使用公告：倒计时结束前不提供关闭入口。
 * 被外部脚本摘掉会自动挂回去（JavaScript 客户端做不了绝对防绕过，只能做到这一步）。
 */
export function IntroGate({ seconds, sample, canOpenInMagpie, isMobile }: IntroGateProps) {
  const params = new URLSearchParams(location.search);
  const forced = params.get("gate") === "1";
  const skipped = params.get("gate") === "0";

  const [open, setOpen] = useState(() => {
    if (skipped) return false;
    if (forced) return true;
    try {
      return !sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return true;
    }
  });
  const [left, setLeft] = useState(seconds);
  const rootRef = useRef<HTMLDivElement>(null);
  const prompt = buildPrompt(sample);
  const install = sample?.install ?? "magpie plugin add github:<作者>/<仓库>";
  const onNpm = Boolean(sample?.npmVersion);

  function installNow() {
    if (onNpm && canOpenInMagpie && sample) {
      window.location.href = `magpie://plugin?name=${encodeURIComponent(sample.npmName ?? sample.repo)}`;
      return;
    }
    void copyWithToast(install, "安装命令已复制");
  }

  const enter = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* 忽略 */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setLeft(seconds);

    const timer = window.setInterval(() => {
      setLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);

    const blockKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", blockKeys, true);

    // 被 hook / 脚本移除后自动挂回去（监听整棵 DOM，节点被谁摘掉都能发现）
    const node = rootRef.current;
    const parent = node?.parentElement ?? null;
    const observer = new MutationObserver(() => {
      const current = rootRef.current;
      if (!current || document.body.contains(current)) return;
      const host = parent?.isConnected ? parent : document.body;
      host.appendChild(current);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    rootRef.current?.focus();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("keydown", blockKeys, true);
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, seconds]);

  if (!open) return null;

  const done = left <= 0;
  const progress = seconds > 0 ? ((seconds - left) / seconds) * 100 : 100;

  return (
    <div
      ref={rootRef}
      id="intro-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-gate-title"
      tabIndex={-1}
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-background/85 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-xl border bg-card p-4 text-card-foreground shadow-2xl sm:p-6">
          <div className="flex items-center gap-2">
            <img src={LOGO()} alt="" width={24} height={24} className="size-6 rounded-md border object-cover" />
            <h2 id="intro-gate-title" className="text-lg font-semibold tracking-tight sm:text-xl">
              使用公告
            </h2>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {done ? "可以进入" : `剩余 ${left}s`}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <section className="space-y-2">
              <p className="text-sm font-medium">1 · 复制指令直接安装</p>
              <div className="flex items-start gap-2">
                <code className="scrollbar-none min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-2.5 py-2 font-mono text-[11.5px] leading-relaxed whitespace-nowrap text-muted-foreground">
                  {install}
                </code>
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-8 shrink-0"
                  aria-label="复制安装命令"
                  onClick={() => copyWithToast(install, "安装命令已复制")}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={onNpm && canOpenInMagpie ? "在 magpie 中安装" : "安装（复制命令）"}
                  title={onNpm && canOpenInMagpie ? "在 magpie 中打开，按 Install" : "复制安装命令"}
                  onClick={installNow}
                >
                  <AppWindow className="size-3.5" />
                </Button>
              </div>
              {onNpm && canOpenInMagpie && (
                <p className="text-xs text-muted-foreground">右侧按钮会在 magpie 里打开插件页，按 Install 完成。</p>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-sm font-medium">2 · 遇到问题，直接把这段发给你的 AI</p>
              <div className="relative">
                <pre className="max-h-[34dvh] overflow-auto rounded-md border bg-muted/40 p-3 pr-12 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap">
                  {prompt}
                </pre>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-2 size-7"
                      aria-label="复制这段描述"
                      onClick={() => copyWithToast(prompt, "问题描述已复制")}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>复制这段</TooltipContent>
                </Tooltip>
              </div>
            </section>
          </div>

          <div className="mt-5 space-y-3">
            <Progress value={progress} className="h-1" />
            <Button className="h-11 w-full text-[15px] sm:h-9 sm:text-sm" disabled={!done} onClick={enter}>
              {done ? "进入插件列表" : `请稍候 ${left}s`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
