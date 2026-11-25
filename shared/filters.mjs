/** 构建脚本和前端共用的规则，避免两边漂移。 */

/**
 * 一个仓库是不是 magpie 插件（GitHub / Gitee 通用）。
 * @param {{ name?: string, description?: string | null, topics?: string[] | null }} repo
 */
export function isPluginRepo({ name = "", description = "", topics = [] }) {
  const lower = name.toLowerCase();
  if (lower.startsWith("dsh-")) return false;
  const hay = `${lower} ${description ?? ""} ${(topics ?? []).join(" ")}`.toLowerCase();
  return lower.startsWith("magpie-") || hay.includes("magpie-plugin") || hay.includes("magpie 插件");
}

/**
 * 安装目标（不带 `magpie plugin add` 前缀）。
 * @param {{ provider: string, owner: string, repo: string }} plugin
 */
export function installTarget({ provider, owner, repo }) {
  return provider === "gitee" ? `git+https://gitee.com/${owner}/${repo}` : `github:${owner}/${repo}`;
}

/**
 * 完整安装命令。
 * @param {{ provider: string, owner: string, repo: string }} plugin
 */
export function installFor(plugin) {
  return `magpie plugin add ${installTarget(plugin)}`;
}
