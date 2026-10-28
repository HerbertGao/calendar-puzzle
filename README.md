# 日历拼图求解器

木质「月 + 日 + 星期」日历拼图的网页求解器：露出指定三格，其余 47 格用 10 块积木覆盖（允许旋转与翻转）。

## 运行

```bash
cd 本目录
npm i
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

## 功能

- 选择月 / 日 / 星期，点「求解」找第一种摆法（DLX 精确覆盖）
- 「下一解」浏览缓存的最多 20 个不同解
- 「播放」按块动画摆上棋盘；速度滑条可调
- 「清空」重置棋盘

## 技术

- Vite + TypeScript（无框架）
- Knuth DLX（Dancing Links）Exact Cover
- 棋盘与方块数据见 `src/data/pieces.json`

## 演示参数

打开 `/?demo=1` 会自动求解当天日期并立即铺满棋盘（便于截图）。

## 在线

- GitHub: https://github.com/HerbertGao/calendar-puzzle
- Cloudflare Pages: https://calendar-puzzle-9tb.pages.dev/
- 演示自动求解: https://calendar-puzzle-9tb.pages.dev/?demo=1
