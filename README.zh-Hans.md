# NeoDB Silica

[English](./README.md) | 简体中文

一个第三方 [NeoDB](https://neodb.net) PWA 客户端，为手机和平板设计，用于发现与记录图书、电影、剧集、音乐、游戏等内容。
NeoDB Silica 不是 NeoDB 官方应用；它使用 NeoDB 开放的 API，为你已有的 NeoDB 数据提供一个更适合触屏设备、可安装的界面。
你可以将 NeoDB Silica 部署到自己的 NeoDB 实例上并进行品牌自定义。

如果你使用的是 NeoDB 的旗舰实例（`neodb.social`），可以直接使用本仓库作者维护的[「别录.」](https://bielu.app) ，无需自行部署。

如果你为任何公共 NeoDB 实例部署了 NeoDB Silica，希望被列在下表中，欢迎在本仓库提 issue告诉我，我会补充上去。
注意进行品牌自定义时，请不要使用“别录”或者可能与其混淆的名称。

下表中除 bielu.app 以外，列出的各个部署均由各自的运营者独立维护和负责；列在此处不代表本项目或作者对其内容、可用性或数据安全负责，也不构成背书。

| NeoDB 实例 | 部署 |
| --- | --- |
| [neodb.social](https://neodb.social) | [bielu.app](https://bielu.app) |

## 功能

- 浏览、搜索 NeoDB 全部类别的条目
- 管理标记、评分、短评、长评与个人标签
- 查看时间线
- 优雅的磨砂玻璃界面，交互克制而精致。支持自定义主题色和夜间模式
- 可安装的 PWA
- 可选的 TMDB 数据增强（高清海报、剧照、可点击的演职员）

## 前置条件

- Node.js 20+
- 一个可访问的 NeoDB 实例

## 快速开始

1. 克隆本仓库，然后安装依赖：

   ```bash
   npm install
   ```

2. 复制环境变量模板：

   ```bash
   cp .env.example .env.local
   ```

3. 启动开发服务器：

   ```bash
   npm run dev
   ```

4. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)。
  
默认情况下应用连接的是 NeoDB 的公共旗舰实例（`https://neodb.social`），不需要自己搭建 NeoDB 即可直接体验。

## 配置

### 环境变量

所有运行时/部署相关的配置都通过环境变量完成，包括：
NeoDB 实例、session 密钥、OAuth 重定向来源、可选的 TMDB 与 Azure 翻译凭据、SEO/索引配置，
以及可选的出站代理。**密钥只应放在 `.env.local` 中**，该文件已被 `.gitignore` 排除。

`NEODB_SESSION_SECRET`必须配置才能正常登录。

出于安全考虑，生产环境必须配置 `NEODB_REDIRECT_ORIGIN` 或 `SITE_PUBLIC_ORIGIN`（否则登录会被
直接拒绝）。如果你是直接把这个应用暴露在公网上，而不是部署在 Vercel 这类平台后面，还需要额外设置
`TRUST_PROXY_HEADERS=0`。

更具体的环境变量配置说明，请参见 [`.env.example`](./.env.example)

### 品牌

品牌信息刻意没有放进环境变量。编辑 [`src/site.config.ts`](./src/site.config.ts)——它是
站点名称的唯一来源（同时驱动 PWA manifest、页面标题、桌面端 logo 文字、关于页面/个人页的署名
文案）、产品描述、主题/背景色、公开访问域名，以及反馈联系邮箱（留空则隐藏反馈入口）（具体配置方式请参见其中的注释）。

然后替换品牌素材：`src/app/icon.png` 与 `public/icons/*`（favicon、PWA 与 Apple 触摸图标）。

关于页面每个语言版本的文案（SEO 标题/描述、署名句、按钮文字）都写在
[`src/app/about/about-page.tsx`](./src/app/about/about-page.tsx) 的 `getContent()`
函数里，直接编辑对应语言的分支即可。

### 精选收藏单

首页"榜单"子标签展示的是人工精选的收藏单横向列表，配置在
[`src/data/featured-collections.json`](./src/data/featured-collections.json)
里，`sections` 数组里每一项对应一条横向列表：

```json
{
  "sections": [
    {
      "id": "neodb-most-marked",
      "title": "NeoDB标记最多",
      "collections": [
        {
          "uuid": "7jO1XpuOSfRXbmUKDHKDRP",
          "title": "2025年标记最多的图书",
          "url": "https://neodb.social/collection/7jO1XpuOSfRXbmUKDHKDRP"
        }
      ]
    }
  ]
}
```

- `id` —— 这条横向列表的唯一标识，不会显示在界面上。
- `title` —— 这条横向列表的标题，会原样显示。
- `collections[].uuid` —— 这个收藏单在**你自己实例**上的 UUID，真正决定抓取和渲染哪个收藏单的
  就是这个字段。
- `collections[].title` / `url` —— 只是给你自己留的备注，方便以后找到这个收藏单；实际显示的
  标题和封面永远来自 NeoDB 的实时数据，跟这两个字段无关。

如果没有配置任何内容（或配置的收藏单在你的实例上不存在），对应的横向列表和子标签会自动隐藏。

## 构建

```bash
npm run build
npm run start
```

本项目可以顺利部署到 Vercel，或任何支持运行 `next build` / `next start` 的 Node 主机。

## 致谢

- 目录数据与 API：[NeoDB](https://neodb.net)
- 部分影视数据：[TMDB](https://www.themoviedb.org)（本产品使用了 TMDB API，但未经 TMDB
  认可或认证）
- 翻译：Azure Translator
- 界面玻璃效果参考了
  [liquid-glass](https://github.com/nikdelvin/liquid-glass) 开源项目

## 许可证

[GNU AGPL-3.0-or-later](./LICENSE)。

Copyright (C) 2026 NeoDB Silica contributors。这是自由软件：你可以依据 GNU Affero 通用公共许可证
的条款重新分发和/或修改它。由于本项目设计为以网络服务的形式运行，任何运行修改版本并将其提供给
用户使用的人，也必须向这些用户提供修改后的源代码。
