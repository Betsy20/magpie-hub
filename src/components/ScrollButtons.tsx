import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 直接跳到位；html 上写了 scroll-behavior: smooth，临时关掉再跳才可靠。 */
function scrollToY(target: number) {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, target);
  root.style.scrollBehavior = previous;
  window.requestAnimationFrame(() => {
    if (Math.abs(window.scrollY - target) < 2) return;
    const again = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, target);
    root.style.scrollBehavior = again;
  });
}

/** 右下角悬浮的「回到顶部 / 到最底部」按钮，页面不够长时自动隐藏。 */
export function ScrollButtons() {
  const [state, setState] = useState({ scrollable: true, atTop: false, atBottom: false });

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      setState({
        scrollable: max > 160,
        atTop: window.scrollY < 8,
        atBottom: window.scrollY > max - 8
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
        className={cn("size-9 bg-background/90 shadow-sm backdrop-blur", state.atTop && "opacity-40")}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="到最底部"
        aria-disabled={state.atBottom}
        onClick={() => scrollToY(document.documentElement.scrollHeight)}
        className={cn("size-9 bg-background/90 shadow-sm backdrop-blur", state.atBottom && "opacity-40")}
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
}
