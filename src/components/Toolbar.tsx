import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索插件、仓库、provider…"
          aria-label="搜索插件"
          className="h-10 bg-card pl-9"
        />
      </div>

      <Select value={sort} onValueChange={(value) => onSortChange(value as Sort)}>
        <SelectTrigger className="h-10 w-[116px] shrink-0 bg-card sm:w-[132px]" aria-label="排序">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="updated">最近更新</SelectItem>
          <SelectItem value="name">名称 A→Z</SelectItem>
          <SelectItem value="oldest">最早更新</SelectItem>
        </SelectContent>
      </Select>

      <ToggleGroup
        type="single"
        variant="outline"
        value={filter}
        onValueChange={(value) => value && onFilterChange(value as Filter)}
        className="scrollbar-none h-10 w-full min-w-0 justify-start overflow-x-auto sm:w-auto"
        aria-label="分类筛选"
      >
        {FILTERS.map((item) => (
          <ToggleGroupItem
            key={item.value}
            value={item.value}
            className="shrink-0 gap-1.5 whitespace-nowrap px-2.5 text-xs data-[state=on]:bg-accent sm:px-3"
          >
            {item.label}
            <span className="tabular-nums text-muted-foreground">{counts[item.value]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
