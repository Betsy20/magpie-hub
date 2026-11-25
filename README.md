# magpie hub

把一个 GitHub 作者的**公开 magpie 插件**收进一个静态页面：带插件原图标、可搜索、可筛选、一键复制安装命令，直接托管在 GitHub Pages。

当前快照：`MYCF711` 的 24 个公开插件（页面默认隐藏模板仓与已废弃的旧注册表，实际展示 22 个）。

界面用 [shadcn/ui](https://github.com/shadcn-ui/ui) 的组件（Button / Card / Badge / Input / Dialog / Select / ToggleGroup / Switch / Tooltip / Sonner）搭，样式走 Tailwind CSS v4，没有手写组件。

## 本地开发

```bash
npm install
npm run data     # 拉一次 GitHub，生成 public/data/plugins.json 和插件图标
npm run dev      # http://localhost:5173
```

换作者或想更新版本号时重跑 `npm run data`：

```bash
node scripts/build.mjs 某个作者
```

## 构建

```bash
npm run build    # 产物在 dist/，纯静态，可直接丢到任何静态托管
npm run preview  # 本地预览产物
```

## 发布到 GitHub Pages

仓库里已经放好 `.github/workflows/pages.yml`：

1. 新建公开仓库，把本目录推上去：

   ```bash
   git init -b main
   git add .
   git commit -m "magpie hub"
   git remote add origin https://github.com/<你的账号>/magpie-hub.git
   git push -u origin main
   ```

2. GitHub → 仓库 **Settings → Pages** → Source 选 **GitHub Actions**。

3. 之后每次 push 自动构建发布，地址是 `https://<你的账号>.github.io/magpie-hub/`。

不想用 Actions 的话，把 `dist/` 提交到 `gh-pages` 分支并在 Pages 里选该分支也可以（`vite.config.ts` 里 `base: "./"`，子路径部署不会丢资源）。

## 配置

`config.json`：

| 字段 | 作用 |
|---|---|
| `sources` | 作者来源列表（GitHub / Gitee 可混排） |
| `title` / `subtitle` | 站点标题与副标题 |
| `exclude` | 不展示的仓库（模板、归档、非插件） |
| `include` | 强制展示不在 `magpie-*` 命名下的仓库 |
| `pins` | 置顶仓库 |
| `liveOnLoad` | 打开页面时是否用 GitHub API 实时同步一次 |
| `gateSeconds` | 开屏公告的倒计时秒数 |

页面右上角「设置」能增删作者（GitHub 作者实时生效，Gitee 作者需要在 `config.json` 里加完重跑构建）、开关自动同步、清除本地数据。

## 安装

每张卡片都给出 `magpie plugin add github:<owner>/<repo>`，点「复制」粘到终端即可，永远对应仓库最新代码。

已发布到 npm 的插件多一个按钮，走 magpie 的深链 `magpie://plugin?name=<包名>`：它只会在 magpie 的插件面板里打开这一页，安装按钮还得你自己按，且装到的是 npm 上的版本，不一定比 GitHub 新。

## 说明

- 只收录**公开**仓库；私有仓匿名接口读不到，页面里也不会出现。
- 插件图标取自仓库里的 `registry-entry.json` / `package.json`（`magpie.icon`），构建时缩到 96px PNG 存进 `public/data/icons/`，一张约 10KB；没有图标的用首字母渐变徽标兜底。
- 实时同步走匿名 GitHub API：每 IP 每小时 60 次，超了页面提示并继续用快照。
- 响应式：手机单列、平板两列、桌面三列；字号全部用 rem，浏览器放大缩小或调大默认字号都不会挤坏布局。
- 每张卡片都有「在 magpie 中打开」按钮：npm 上有的插件走 `magpie://plugin?name=` 深链；手机端或没检测到本机 magpie 时，点击直接复制安装命令并给出提示。
- 开屏使用公告 10 秒倒计时，`?gate=1` 强制显示、`?gate=0` 跳过。
