import { useState } from "react";
import { cn } from "@/lib/utils";

/** 作者/站点头像；加载失败就退回首字母，避免裂图。 */
export function AuthorAvatar({
  src,
  name,
  className
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid place-items-center bg-muted text-[9px] uppercase text-muted-foreground",
          className
        )}
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={new URL(src, document.baseURI).href}
      alt=""
      loading="lazy"
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
