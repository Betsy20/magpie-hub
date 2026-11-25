#!/usr/bin/env node
/**
 * 生成 public/data/plugins.json（快照）与 public/data/icons/*.png。
 *
 *   node scripts/build.mjs          # 读 config.json 里的 sources
 *
 * 数据源支持 GitHub 与 Gitee：作者的所有公开仓库，或单独指定的仓库。
 * 只用公开接口，不需要任何 token。
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { installFor, isPluginRepo } from "../shared/filters.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const UA = "magpie-hub-build (+https://github.com/baijiu666/magpie-hub)";
const OUT_DIR = path.join(ROOT, "public", "data");
const ICON_DIR = path.join(OUT_DIR, "icons");

const config = JSON.parse(await readFile(path.join(ROOT, "config.json"), "utf8"));
const sources = (config.sources ?? [{ provider: "github", owner: config.owner }]).map((source) => ({
  provider: source.provider ?? "github",
  owner: source.owner ?? (source.repo ? source.repo.split("/")[0] : null),
  repo: source.repo ?? null
}));

/* ---------------- HTTP ---------------- */

async function get(url, accept = "application/json") {
  const res = await fetch(url, { headers: { "user-agent": UA, accept } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
}

const json = async (url) => (await get(url)).json();

async function text(url) {
  try {
    const res = await get(url, "text/plain");
    return await res.text();
  } catch {
    return null;
  }
}

/* ---------------- 仓库列表 ---------------- */

async function listSource(source) {
  if (source.repo) {
    const [owner, repo] = source.repo.split("/");
    const api =
      source.provider === "gitee"
        ? `https://gitee.com/api/v5/repos/${owner}/${repo}`
        : `https://api.github.com/repos/${owner}/${repo}`;
    return [normalize(await json(api), source.provider, owner)];
  }

  const repos = [];
  for (let page = 1; page <= 5; page++) {
    const api =
      source.provider === "gitee"
        ? `https://gitee.com/api/v5/users/${source.owner}/repos?per_page=100&sort=updated&page=${page}`
        : `https://api.github.com/users/${source.owner}/repos?per_page=100&sort=updated&page=${page}`;
    const batch = await json(api);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.map((repo) => normalize(repo, source.provider, source.owner));
}

function normalize(repo, provider, owner) {
  return {
    provider,
    owner,
    name: repo.name,
    branch: repo.default_branch || "main",
    description: repo.description || "",
    stars: repo.stargazers_count ?? 0,
    topics: repo.topics ?? [],
    archived: Boolean(repo.archived),
    updatedAt: repo.pushed_at || repo.updated_at || ""
  };
}

/* ---------------- 图标 ---------------- */

await rm(ICON_DIR, { recursive: true, force: true });
await mkdir(ICON_DIR, { recursive: true });

function dataUriToBuffer(uri) {
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const meta = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  try {
    return meta.includes("base64")
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
  } catch {
    return null;
  }
}

async function writeIcon(plugin) {
  const value = plugin.iconSource;
  if (!value || typeof value !== "string") return null;

  let buffer = null;
  if (value.startsWith("data:")) {
    buffer = dataUriToBuffer(value);
  } else {
    const url = /^https?:\/\//.test(value) ? value : `${plugin.rawBase}/${value.replace(/^\.?\//, "")}`;
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      if (res.ok) buffer = Buffer.from(await res.arrayBuffer());
    } catch {
      buffer = null;
    }
  }
  if (!buffer?.length) return null;

  const file = `${plugin.provider}-${plugin.owner}-${plugin.repo}.png`;
  try {
    await sharp(buffer)
      .resize(96, 96, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(path.join(ICON_DIR, file));
    return `data/icons/${file}`;
  } catch {
    return null;
  }
}

/* ---------------- 单个插件 ---------------- */

const PAUSED_RE = /停止维护|暂停维护|deprecated|归档|archived/i;
const pickZh = (summary) =>
  summary && typeof summary === "object" ? summary.zh || summary.en || "" : "";

/** README 第一段正文，作为没有中文简介时的兜底。 */
function firstParagraph(markdown) {
  if (!markdown) return "";
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  const paragraph = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!line) {
      if (paragraph.length) break;
      continue;
    }
    if (/^(#{1,6}\s|>|\||<|!\[|-{3,}|={3,})/.test(line)) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line);
  }
  return paragraph
    .join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

async function detail(repo) {
  const rawBase =
    repo.provider === "gitee"
      ? `https://gitee.com/${repo.owner}/${repo.name}/raw/${repo.branch}`
      : `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.branch}`;

  const pkgText = await text(`${rawBase}/package.json`);
  let pkg = null;
  try {
    pkg = pkgText ? JSON.parse(pkgText) : null;
  } catch {
    pkg = null;
  }

  const entryText = repo.provider === "github" ? await text(`${rawBase}/registry-entry.json`) : null;
  let entry = null;
  try {
    entry = entryText ? JSON.parse(entryText) : null;
  } catch {
    entry = null;
  }

  const magpie = pkg?.magpie ?? {};
  const page = magpie.page && typeof magpie.page === "object" ? magpie.page : {};
  const keywords = Array.isArray(pkg?.keywords) ? pkg.keywords : [];

  const description = pkg?.description || repo.description || "";
  const paused = PAUSED_RE.test(`${repo.name} ${repo.description} ${description} ${pickZh(entry?.summary)}`) || repo.archived;

  let summary = pickZh(entry?.summary);
  if (!summary) {
    const paragraph = firstParagraph(await text(`${rawBase}/README.md`));
    summary = /[\u4e00-\u9fa5]/.test(paragraph) ? paragraph : description || paragraph;
  }

  const plugin = {
    provider: repo.provider,
    owner: repo.owner,
    repo: repo.name,
    host: repo.provider === "gitee" ? "gitee.com" : "github.com",
    repoUrl:
      repo.provider === "gitee"
        ? `https://gitee.com/${repo.owner}/${repo.name}`
        : `https://github.com/${repo.owner}/${repo.name}`,
    displayName:
      (typeof magpie.name === "string" && magpie.name) ||
      (typeof page.name === "string" && page.name) ||
      (typeof entry?.name === "string" && entry.name) ||
      repo.name,
    description,
    summary,
    version: pkg?.version || null,
    npmName: typeof pkg?.name === "string" ? pkg.name : null,
    providers: Array.isArray(entry?.providers)
      ? entry.providers
      : Array.isArray(magpie.providers)
        ? magpie.providers
        : [],
    paused,
    stars: repo.stars,
    topics: repo.topics,
    updatedAt: repo.updatedAt,
    npmVersion: null,
    icon: null,
    iconSource: magpie.icon || page.icon || entry?.icon || null,
    rawBase
  };

  plugin.install = installFor(plugin);
  plugin.icon = await writeIcon(plugin);
  delete plugin.iconSource;
  delete plugin.rawBase;
  return plugin;
}

/* ---------------- 跑一遍 ---------------- */

const all = [];
const summary = [];

for (const source of sources) {
  let repos = [];
  try {
    repos = await listSource(source);
  } catch (error) {
    console.warn(`! ${source.provider}:${source.repo ?? source.owner} — ${error.message}`);
    summary.push({ provider: source.provider, owner: source.owner, repoCount: 0, pluginCount: 0 });
    continue;
  }

  const picked = repos.filter((repo) => isPluginRepo(repo));
  const details = [];
  for (let i = 0; i < picked.length; i += 6) {
    const slice = picked.slice(i, i + 6);
    const done = await Promise.all(
      slice.map(async (repo) => {
        try {
          return await detail(repo);
        } catch (error) {
          console.warn(`! ${repo.provider}:${repo.owner}/${repo.name} — ${error.message}`);
          return null;
        }
      })
    );
    details.push(...done.filter(Boolean));
    process.stdout.write(`\r  ${source.owner}: ${Math.min(i + 6, picked.length)}/${picked.length}`);
  }
  process.stdout.write("\n");

  all.push(...details);
  summary.push({
    provider: source.provider,
    owner: source.owner,
    repoCount: repos.length,
    pluginCount: details.length
  });
}

/* 各来源作者的头像，存本地，页脚直接显示 */
const authorDir = path.join(OUT_DIR, "authors");
await mkdir(authorDir, { recursive: true });
const authors = [];

for (const source of sources.filter((item) => item.owner)) {
  let avatar = null;
  try {
    const api =
      source.provider === "gitee"
        ? `https://gitee.com/api/v5/users/${source.owner}`
        : `https://api.github.com/users/${source.owner}`;
    const profile = await json(api);
    if (profile?.avatar_url) {
      const res = await fetch(profile.avatar_url, { headers: { "user-agent": UA } });
      if (res.ok) {
        const file = `${source.provider}-${source.owner}.png`;
        await sharp(Buffer.from(await res.arrayBuffer()))
          .resize(64, 64, { fit: "cover" })
          .png({ compressionLevel: 9 })
          .toFile(path.join(authorDir, file));
        avatar = `data/authors/${file}`;
      }
    }
  } catch (error) {
    console.warn(`! avatar ${source.provider}:${source.owner} — ${error.message}`);
  }
  authors.push({ provider: source.provider, owner: source.owner, avatar });
}

/* magpie 本体作者的署名头像 */
let magpieAuthor = { owner: "yetone", avatar: null };
try {
  const profile = await json("https://api.github.com/users/yetone");
  if (profile?.avatar_url) {
    const res = await fetch(profile.avatar_url, { headers: { "user-agent": UA } });
    if (res.ok) {
      const file = "yetone.png";
      await mkdir(authorDir, { recursive: true });
      await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(64, 64, { fit: "cover" })
        .png({ compressionLevel: 9 })
        .toFile(path.join(authorDir, file));
      magpieAuthor = { owner: "yetone", avatar: `data/authors/${file}` };
    }
  }
} catch (error) {
  console.warn(`! magpie author avatar — ${error.message}`);
}

/* npm 上有没有同名包：决定要不要显示 magpie:// 深链 */
async function npmLatest(name) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.["dist-tags"]?.latest ?? null;
  } catch {
    return null;
  }
}

await Promise.all(all.map(async (plugin) => {
  plugin.npmVersion = await npmLatest(plugin.npmName ?? plugin.repo);
}));

/* 站点 logo：第一个 GitHub 作者的头像，存成本地文件，页面不依赖外链 */
const primaryGithub = sources.find((source) => source.provider === "github" && source.owner)?.owner;
if (primaryGithub) {
  try {
    const user = await json(`https://api.github.com/users/${primaryGithub}`);
    const res = await fetch(`${user.avatar_url}&s=128`, { headers: { "user-agent": UA } });
    if (res.ok) {
      await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(96, 96, { fit: "cover" })
        .png({ compressionLevel: 9 })
        .toFile(path.join(ROOT, "public", "owner.png"));
      console.log(`logo: ${primaryGithub} 的头像 → public/owner.png`);
    }
  } catch (error) {
    console.warn(`! logo: ${error.message}`);
  }
}

all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

const snapshot = {
  generatedAt: new Date().toISOString(),
  authors,
  magpie: magpieAuthor,
  plugins: all
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, "plugins.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(
  `${summary.map((item) => `${item.provider}:${item.owner} ${item.pluginCount}/${item.repoCount}`).join(" · ")}` +
    ` → ${all.length} 个插件`
);
