import { useEffect, useState } from "react";
import { Database, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatTime } from "@/lib/format";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  liveOnLoad: boolean;
  snapshotAt: string | null;
  liveAt: string | null;
  rate: number | null;
  count: number;
  saving: boolean;
  onSave: (owner: string, liveOnLoad: boolean) => void;
  onReset: () => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  owner,
  liveOnLoad,
  snapshotAt,
  liveAt,
  rate,
  count,
  saving,
  onSave,
  onReset
}: SettingsDialogProps) {
  const [draftOwner, setDraftOwner] = useState(owner);
  const [draftLive, setDraftLive] = useState(liveOnLoad);

  useEffect(() => {
    if (open) {
      setDraftOwner(owner);
      setDraftLive(liveOnLoad);
    }
  }, [open, owner, liveOnLoad]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            换 GitHub 作者会实时读取一次仓库列表，Gitee 来源不受影响。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-owner">GitHub 作者</Label>
            <Input
              id="settings-owner"
              value={draftOwner}
              onChange={(e) => setDraftOwner(e.target.value)}
              placeholder="例如 MYCF711"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="settings-live">每次打开都同步</Label>
              <p className="text-xs text-muted-foreground">打开页面就拉一次 GitHub，匿名接口 60 次/小时。</p>
            </div>
            <Switch id="settings-live" checked={draftLive} onCheckedChange={setDraftLive} />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs">
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">本地快照</span>
              <span className="font-mono">{snapshotAt ? `${formatTime(snapshotAt)} · ${count} 个` : "未构建"}</span>
            </div>
            <Separator className="my-1.5" />
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">最近同步</span>
              <span className="font-mono">{liveAt ? formatTime(liveAt) : "本次未同步"}</span>
            </div>
            <Separator className="my-1.5" />
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">接口配额</span>
              <span className="font-mono">{rate === null ? "—" : `${rate} 次 / 小时`}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="text-muted-foreground" onClick={onReset}>
            <RotateCcw className="size-4" />
            清除本地数据
          </Button>
          <Button disabled={saving || !draftOwner.trim()} onClick={() => onSave(draftOwner.trim().replace(/^@/, ""), draftLive)}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            保存并同步
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
