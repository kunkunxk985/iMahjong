# 项目架构

真正在跑的只有这一条链：

```text
Electron 窗口
  └─ apps/desktop/src/App.tsx
       ├─ Lobby          首页：联机房间 / 单机陪练
       ├─ WaitingRoom    联机等人
       ├─ Table          牌桌（2.5D CSS：实体牌 + 四方牌河）
       └─ Settlement     结算
            │
            └─ src/ws/client.ts
                 │
                 └─ 本机 WebSocket（Electron 内置，默认 8787）
                      或朋友电脑上的 apps/server
                           │
                           └─ packages/server-core
                                ├─ room.ts     房间、座位、开局、结算入账
                                ├─ bots.ts     单机陪练调度（调用 rules/companion）
                                └─ createServer.ts
                                     │
                                     └─ packages/rules   查胡、听牌、出牌决策
                                     └─ packages/shared  牌、协议、类型
```

## 目录

| 路径 | 是否运行时需要 | 作用 |
|---|---|---|
| `apps/desktop/src/` | 是 | React 界面 |
| `apps/desktop/electron/` | 是 | 窗口、preload、本机服务启动 |
| `apps/desktop/public/assets/` | 是 | 牌面和桌布 |
| `apps/desktop/scripts/*.mjs` | 开发/打包 | `dev` / `build` / `clean` / 拷到桌面 |
| `apps/server/` | 仅局域网主机 | 不开窗口时单独起服务 |
| `packages/rules/` | 是 | 规则引擎和测试 |
| `packages/server-core/` | 是 | 房间与陪练 |
| `packages/shared/` | 是 | 前后端共用类型 |
| `assets/source/` | 否 | 牌面原图备份 |
| `docs/` | 否 | 说明 |

## 生成物（可随时删，用命令重建）

```text
node_modules/                 npm install
apps/desktop/dist/            npm run build
apps/desktop/dist-electron/   npm run build
apps/desktop/release/         npm run package:mac / package:win
```

`npm run clean` 会清掉后三个。

## 已拿掉的历史残留

- Three.js 牌桌（`src/scene/`）
- 旧牌面生成脚本（会画胶囊条子，已删）
- `public/assets/tile-faces/`（运行时读的是 `tiles/`）
- `assets/reference/` 旧图集

## 常用命令

```bash
npm install
npm run dev          # 桌面端，自带本机服务
npm test
npm run verify
npm run clean        # 删 dist / release
npm run package:mac
```
