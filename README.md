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

- 两种日期模式：
  - **真实日期**：选择公历年 / 月 / 日（默认 Asia/Shanghai 今天）。星期按该日期自动计算并锁定；2 月 29 日仅闰年可选
  - **指定组合**：月 / 日 / 星期独立选择，不必是真实日期（2 月按 28 天）
- 「求解」用 DLX 精确覆盖穷尽该目标的全部解。搜索按时间片让出主线程，状态会显示已找到的数量、耗时，以及是否已穷尽
- 「上一解 / 下一解」浏览找到的全部解
- 「播放」按块动画摆上棋盘；速度滑条可调
- 「清空」重置棋盘
- 打开 `/?demo=1` 会按当天真实日期自动求解

## 技术

- Vite + TypeScript（无框架）
- Knuth DLX（Dancing Links）Exact Cover
- 棋盘与方块数据见 `src/data/pieces.json`

## 演示参数

打开 `/?demo=1` 会按当天真实日期自动求解，并在找到第一个解时立即铺满棋盘（便于截图）。搜索会继续直到穷尽。

## 在线

- GitHub: https://github.com/HerbertGao/calendar-puzzle
- Cloudflare Pages: https://calendar-puzzle-9tb.pages.dev/
- 演示自动求解: https://calendar-puzzle-9tb.pages.dev/?demo=1
