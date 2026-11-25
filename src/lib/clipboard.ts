import { toast } from "sonner";

/** 复制文本：Clipboard API 卡住或没权限时退回 execCommand，保证一定有结果。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error("clipboard timeout")), 250))
      ]);
      return true;
    }
  } catch {
    /* 落到下面的兜底 */
  }

  const previous = document.activeElement as HTMLElement | null;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    area.style.fontSize = "16px";
    document.body.appendChild(area);
    area.focus();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    area.remove();
    previous?.focus?.();
    return ok;
  } catch {
    previous?.focus?.();
    return false;
  }
}

/** 复制并提示；message 是成功时的文案。 */
export async function copyWithToast(text: string, message: string) {
  const ok = await copyText(text);
  toast[ok ? "success" : "error"](ok ? message : "复制失败，请手动选中");
  return ok;
}
