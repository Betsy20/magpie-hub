import { copyWithToast } from "./clipboard";
import type { Plugin } from "./data";

/** 能跳 magpie 就跳，否则复制安装命令；卡片和公告共用同一套行为。 */
export function installOrCopy(plugin: Plugin | undefined, canOpenInMagpie: boolean) {
  if (!plugin) return;
  if (plugin.npmVersion && canOpenInMagpie) {
    window.location.href = `magpie://plugin?name=${encodeURIComponent(plugin.npmName ?? plugin.repo)}`;
    return;
  }
  void copyWithToast(plugin.install, "安装命令已复制");
}
