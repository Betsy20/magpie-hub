import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Filter = "all" | "active" | "starred" | "paused";
export type Sort = "updated" | "name" | "oldest";

interface ToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: Filter;
  onFilterChange: (value: Filter) => void;
  sort: Sort;
  onSortChange: (value: Sort) => void;
  counts: Record<Filter, number>;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "可用" },
  { value: "starred", label: "收藏" },
  { value: "paused", label: "已停维护" }
];

export function Toolbar({ query, onQueryChange, filter, onFilterChange, sort, onSortChange, counts }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="relative min-w-[14rem] flex-1 basis-full sm:basis-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-ink-3" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索插件、仓库、provider…"
          aria-label="搜索插件"
          className="h-10 rounded-[10px] border bg-card pl-9 text-[14px] shadow-none placeholder:text-ink-3 focus-visible:border-ink/30 focus-visible:ring-2 focus-visible:ring-ring/20"
        />
      </div>

      <div
        role="tablist"
        aria-label="分类筛选"
        className="scrollbar-none flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-[10px] border bg-bg-2 p-[3px]"
      >
        {FILTERS.map((item) => {
          const on = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onFilterChange(item.value)}
              className={cn(
                "flex h-[30px] shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-[13px] whitespace-nowrap transition-colors",
                on
                  ? "bg-card font-medium text-ink shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0_/_0.08)]"
                  : "text-ink-2 hover:text-ink"
              )}
            >
              {item.label}
              <span className={cn("tabular-nums text-[12px]", on ? "text-ink-3" : "text-ink-3/80")}>
                {counts[item.value]}
              </span>
            </button>
          );
        })}
      </div>

      <Select value={sort} onValueChange={(value) => onSortChange(value as Sort)}>
        <SelectTrigger
          className="h-10 w-full shrink-0 rounded-[10px] border bg-card text-[13px] sm:ml-auto sm:w-[128px]"
          aria-label="排序"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="updated">最近更新</SelectItem>
          <SelectItem value="name">名称 A→Z</SelectItem>
          <SelectItem value="oldest">最早更新</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}