# 字幕时间轴质检器

纪录片交付前的字幕质检工具（纯前端）：接收用户粘贴的字幕 JSON 数组，校验数据合法性，
在可缩放 SVG 时间轴中绘制全部片段，并通过一次顺序区间扫描检出**重叠**与**过密切换**
（间隔 < 100ms）问题。

## 输入格式

JSON 数组，每项仅含四个字段（不允许任何额外字段，如 `speaker`）：

| 字段    | 要求                           |
| ------- | ------------------------------ |
| `id`    | 字符串，全批唯一               |
| `start` | 整数毫秒，≥ 0                  |
| `end`   | 整数毫秒，> start              |
| `text`  | 非空字符串                     |

```json
[
  { "id": "s1", "start": 0, "end": 1800, "text": "开场白" },
  { "id": "s2", "start": 2000, "end": 3600, "text": "主持人介绍嘉宾" }
]
```

## 规则

- **整批拒绝**：按输入项顺序及 `id → start → end → text` 字段顺序定位首个错误；
  字段缺失、类型错误、重复 id、时间非法（start < 0、end ≤ start）或含额外字段
  （如 `speaker`）时整批拒绝，并清除旧图形与结论。
- **排序**：合法片段按 `start`、`end`、输入索引稳定排序后全部绘制到时间轴。
- **重叠**：顺序扫描中，当前片段 `start` 小于任一尚未结束片段的 `end` 即判重叠，
  发生毫秒取当前 `start`；多个在先片段时取输入索引最小者作为另一方。
- **过密切换**：无重叠时，仅与排序后前一片段比较，间隔 < 100ms 判为过密，
  发生毫秒取前一片段 `end`；恰好 100ms 合格。
- **首错即止**：扫描遇到首个问题立即停止，页面只显示该问题类型、发生毫秒和
  双方 id，并在时间轴上联动高亮两个片段；无问题显示“可交付”。

## 运行（Docker Compose）

```bash
# 启动前端（默认宿主机 8080 端口，可用 WEB_PORT 覆盖）
docker compose up --build web
WEB_PORT=9000 docker compose up --build web

# 一次性验收：单元测试 + 针对 web 服务的端到端测试
docker compose up --build --abort-on-container-exit --exit-code-from verify
# 或
docker compose run --rm verify
```

`verify` 服务退出码为 0 表示验收通过。

## 本地开发

```bash
npm ci
npm run dev          # Vite 开发服务器
npm run build        # 类型检查 + 生产构建
npm run test:unit    # Vitest 单元测试（校验与扫描逻辑）
npm run test:e2e     # Playwright 端到端测试（需先启动服务，BASE_URL 可覆盖，默认 http://localhost:8080）
npm run verify       # 单元测试 + 等待服务就绪 + 端到端测试
```

## 技术栈

TypeScript · React · Vite · Vitest · Playwright · Docker Compose

```
src/
  validate.ts   输入校验（首个错误定位）
  scan.ts       稳定排序 + 一次顺序区间扫描（首错即止）
  evaluate.ts   解析 → 校验 → 排序 → 扫描
  Timeline.tsx  可缩放 SVG 时间轴（滚轮/按钮缩放、拖拽平移、联动高亮）
  App.tsx       页面装配与结论展示
e2e/            Playwright 端到端测试
```
