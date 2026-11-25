#!/usr/bin/env node
/**
 * 用 GitHub Git Data API 推送当前分支。
 *
 * 本机（以及常见网络环境）经常能连 api.github.com 但连不上 github.com:443，
 * 这时 `git push` 会 Connection reset；这个脚本改用 API 建 blob/tree/commit/ref，
 * 并用本地 HEAD 的元数据（作者、时间、message）重建同一个 commit。
 *
 *   node scripts/push.mjs [owner/repo]
 *
 * 需要已登录的 gh（用 `gh auth token` 取 token），不改动本地仓库。
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const repo = process.argv[2] || "baijiu666/magpie-hub";
const [owner, name] = repo.split("/");
const branch = "main";

const run = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "magpie-hub-push",
      ...(init.headers ?? {})
    }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}: ${JSON.stringify(body)}`);
  return body;
};

const head = run(["rev-parse", "HEAD"]);
// message 按 commit 对象里的原始字节取，多一个换行都会让 SHA 对不上
const rawCommit = execFileSync("git", ["cat-file", "commit", "HEAD"], { encoding: "utf8" });
const message = rawCommit.slice(rawCommit.indexOf("\n\n") + 2);
const authorName = run(["log", "-1", "--format=%an"]);
const authorEmail = run(["log", "-1", "--format=%ae"]);
const authorDate = run(["log", "-1", "--format=%aI"]);
const committerName = run(["log", "-1", "--format=%cn"]);
const committerEmail = run(["log", "-1", "--format=%ce"]);
const committerDate = run(["log", "-1", "--format=%cI"]);

// 空仓库不允许建 blob，先塞一个占位 README 让仓库有历史（最后会被孤儿化）
try {
  await api(`/repos/${owner}/${name}/git/ref/heads/${branch}`);
} catch (error) {
  if (!/40[49]/.test(String(error))) throw error;
  await api(`/repos/${owner}/${name}/contents/README.md`, {
    method: "PUT",
    body: JSON.stringify({ message: "init", content: Buffer.from(`# ${name}\n`).toString("base64") })
  });
  console.log("空仓库：先写入占位 README");
}

const files = run(["ls-files", "-z"]).split("\0").filter(Boolean);
console.log(`${repo} · ${branch} · ${files.length} 个文件 · HEAD ${head.slice(0, 7)}`);

// 1. 上传 blob
const entries = [];
const CONCURRENCY = 6;
for (let i = 0; i < files.length; i += CONCURRENCY) {
  const slice = files.slice(i, i + CONCURRENCY);
  const done = await Promise.all(
    slice.map(async (file) => {
      const content = (await readFile(file)).toString("base64");
      const blob = await api(`/repos/${owner}/${name}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content, encoding: "base64" })
      });
      return { path: file, mode: "100644", type: "blob", sha: blob.sha };
    })
  );
  entries.push(...done);
  process.stdout.write(`\r  blob ${Math.min(i + CONCURRENCY, files.length)}/${files.length}`);
}
process.stdout.write("\n");

// 2. tree
const tree = await api(`/repos/${owner}/${name}/git/trees`, {
  method: "POST",
  body: JSON.stringify({ tree: entries })
});
console.log(`tree ${tree.sha.slice(0, 7)}`);

// 3. 远端当前 HEAD 作为父提交（本机连不上 github.com，本地仓库与远端各自独立）
let remoteHead = null;
try {
  remoteHead = (await api(`/repos/${owner}/${name}/git/ref/heads/${branch}`)).object.sha;
} catch {
  remoteHead = null;
}

if (remoteHead) {
  const remoteCommit = await api(`/repos/${owner}/${name}/git/commits/${remoteHead}`);
  if (remoteCommit.tree.sha === tree.sha) {
    console.log("内容与远端一致，不用推送");
    process.exit(0);
  }
}

const commit = await api(`/repos/${owner}/${name}/git/commits`, {
  method: "POST",
  body: JSON.stringify({
    message,
    tree: tree.sha,
    parents: remoteHead ? [remoteHead] : [],
    author: { name: authorName, email: authorEmail, date: authorDate },
    committer: { name: committerName, email: committerEmail, date: committerDate }
  })
});
console.log(`commit ${commit.sha.slice(0, 7)}`);

// 4. ref
try {
  await api(`/repos/${owner}/${name}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha })
  });
  console.log(`新建分支 ${branch}`);
} catch (error) {
  if (!/already exists/i.test(String(error))) throw error;
  await api(`/repos/${owner}/${name}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true })
  });
  console.log(`更新分支 ${branch}`);
}

console.log(`https://github.com/${owner}/${name}/commit/${commit.sha}`);
