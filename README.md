# homepage

一个使用 `Astro + TypeScript + Tailwind CSS` 重构的中文单页个人主页，视觉方向是手帐 / notebook 风格。

## 开发

```bash
bun install
bun run dev
```

本地开发默认启动 Astro 开发服务器。

## 验证

```bash
bun run test
bun run check
bun run build
```

## 目录

- `src/pages/index.astro`: 单页入口
- `src/content/homepage.ts`: 可替换的首页内容数据
- `src/components`: 手帐风卡片与内容条目组件
- `public/images`: 本地占位素材
- `specs/stitch_handwritten_notebook_profile.zip`: 设计参考
