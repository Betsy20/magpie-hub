import { useEffect, useState } from "react";
import { animate } from "motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** 用 motion 做缓动滚动；环境不跑动画帧时，结束后直接跳到位。 */
function scrollToY(target: number) {
  const root = document.documentElement;
  const from = window.scrollY || root.scrollTop || 0;
  const distance = Math.abs(target - from);
  if (distance < 2) return;

  const duration = Math.min(0.9, 0.32 + distance / 7000);
  const controls = animate(from, target, {
    duration,
    ease: EASE,
    onUpdate: (value) => {
      root.scrollTop = value;
      document.body.scrollTop = value;
    }
  });

  window.setTimeout(() => {
    controls.stop();
    const current = window.scrollY || root.scrollTop || 0;
    if (Math.abs(current - target) < 8) return;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    root.scrollTop = target;
    document.body.scrollTop = target;
    root.style.scrollBehavior = previous;
  }, duration * 1000 + 250);
}

/** 右下角悬浮的「回到顶部 / 到最底部」按钮，页面不够长时自动隐藏。 */
export function ScrollButtons() {
  const [state, setState] = useState({ scrollable: true, atTop: false, atBottom: false });

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const y = window.scrollY || root.scrollTop || 0;
      const max = root.scrollHeight - root.clientHeight;
      setState({
        scrollable: max > 160,
        atTop: y < 8,
        atBottom: y > max - 8
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // 个别环境（无头、部分内嵌浏览器）不派发 scroll 事件，兜一个低频轮询
    const timer = window.setInterval(update, 400);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.clearInterval(timer);
    };
  }, []);

  if (!state.scrollable) return null;

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col gap-2 sm:right-6">
      <Button
        variant="outline"
        size="icon"
        aria-label="回到顶部"
        aria-disabled={state.atTop}
        onClick={() => scrollToY(0)}
        className={cn("size-9 bg-background/90 shadow-sm backdrop-blur transition-opacity", state.atTop && "opacity-40")}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="到最底部"
        aria-disabled={state.atBottom}
        onClick={() => scrollToY(document.documentElement.scrollHeight)}
        className={cn(
          "size-9 bg-background/90 shadow-sm backdrop-blur transition-opacity",
          state.atBottom && "opacity-40"
        )}
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
}
