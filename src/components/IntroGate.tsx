import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Plugin } from "@/lib/data";

const STORAGE_KEY = "magpiehub:intro-seen";

function buildPrompt(sample?: Plugin) {
  const name = sample ? sample.repo : "<插件名>";
  const version = sample?.version ? `v${sample.version}` : "<版本>";
  const url = sample?.repoUrl ?? "<仓库地址>";
  return `插件：${name}（${version}，${url}）
问题：<一句话写清现象，比如：登录后模型列表是空的>
复现：<做了什么操作，预期是什么，实际是什么>
报错：<把 magpie 终端或面板里的报错原文贴这里>

帮我定位并修复这个问题；如果是插件本身的 bug，请直接给作者提 issue / PR。`;
}

async function copy(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
    return true;
  } catch {
    toast.error("复制失败，请手动选中");
    return false;
  }
}

interface IntroGateProps {
  seconds: number;
  sample?: Plugin;
}

/**
 * 开屏提示：倒计时结束前不提供关闭入口。
 * 被外部脚本摘掉会自动挂回去（JavaScript 客户端做不了绝对防绕过，只能做到这一步）。
 */
export function IntroGate({ seconds, sample }: IntroGateProps) {
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
  const progress = ((seconds - left) / seconds) * 100;

  return (
    <div
      ref={rootRef}
      id="intro-gate"
      role="dialog"
      aria-modal="true"
      aria-label="使用说明"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="my-auto w-full max-w-xl rounded-xl border bg-card p-5 text-card-foreground shadow-2xl sm:p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="size-4 text-primary" />
          先看 {seconds} 秒
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">两条路：自己装，或者丢给 AI</h2>

        <div className="mt-5 space-y-4">
          <section className="space-y-2">
            <p className="text-sm font-medium">1 · 复制指令直接安装</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 font-mono text-xs text-muted-foreground">
                {install}
              </code>
              <Button size="sm" variant="secondary" onClick={() => copy(install, "安装命令已复制")}>
                <Copy className="size-3.5" />
                复制
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">2 · 遇到问题，直接把这段发给你的 AI</p>
            <div className="relative">
              <pre className="max-h-60 overflow-auto rounded-md border bg-muted/40 p-3 pr-12 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                {prompt}
              </pre>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 size-7"
                    aria-label="复制这段描述"
                    onClick={() => copy(prompt, "问题描述已复制")}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>复制这段</TooltipContent>
              </Tooltip>
            </div>
          </section>
        </div>

        <div className="mt-6 space-y-3">
          <Progress value={progress} className="h-1" />
          <Button className="w-full" disabled={!done} onClick={enter}>
            {done ? "进入插件列表" : `请稍候 ${left}s`}
          </Button>
        </div>
      </div>
    </div>
  );
}
