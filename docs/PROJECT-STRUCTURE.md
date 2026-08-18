# 项目结构说明

当前项目是一个 npm workspace 单仓库，真正运行的入口只有一条：

```text
React 页面
  └─ apps/desktop/src/App.tsx
       ├─ Lobby.tsx          首页：创建/加入房间、单机入口
       ├─ WaitingRoom.tsx    联机等待大厅
       ├─ Table.tsx          当前正式牌桌：俯视 2D 绿绒布布局
       └─ Settlement.tsx     结算弹层
            │
            └─ apps/desktop/src/ws/client.ts         单机与联机统一走 WebSocket
                         │
                         └─ packages/server-core/src/
                              ├─ room.ts             房间、座位与对局编排
                              ├─ createServer.ts     WebSocket 服务
                              └─ bots.ts             陪练调度
                                   │
                                   ├─ apps/server/   独立局域网服务入口
                                   └─ Electron       桌面内置本机服务入口

共享规则与协议
  ├─ packages/shared/   牌、座位、事件、网络协议类型
  └─ packages/rules/    邳州麻将规则、胡牌、计分、陪练决策
```

## 目录职责

| 目录 | 作用 |
| --- | --- |
| `apps/desktop/src/` | React 客户端源码 |
| `apps/desktop/electron/` | Electron 主进程、本机服务启动、窗口与 preload |
| `apps/desktop/public/assets/` | 客户端运行时真正加载的牌面和桌面材质 |
| `apps/desktop/scripts/` | 开发、构建、打包和牌面生成脚本 |
| `apps/server/src/` | 四人联机服务端 |
| `packages/server-core/` | 独立服务与桌面内置服务共用的服务器核心 |
| `packages/shared/` | 客户端与服务端共用的数据类型 |
| `packages/rules/` | 规则引擎与测试 |
| `assets/tiles/` | 牌面源素材；不直接参与打包 |
| `assets/reference/` | 参考牌面图和牌面图集 |
| `assets/archive/` | 旧版/调试牌面素材，仅作留档 |
| `docs/` | 产品规则、架构与开发说明 |

## 关于旧 3D 文件

`archive/legacy-3d/` 是 Antigravity 之前做的 3D 牌桌实现。它没有被删除，但已移出 TypeScript 编译目录，也不会再把 Three.js 依赖打进安装包。当前牌桌入口是 `apps/desktop/src/views/Table.tsx`。

## 生成目录

以下目录是构建产物，不是源码：

```text
apps/desktop/dist/
apps/desktop/dist-electron/
apps/desktop/release/
```

可以用 `npm run clean` 清理它们，之后再运行构建或打包命令即可重新生成。

## 常用命令

```bash
npm install
npm run dev                 # 服务端 + Electron 开发客户端
npm run verify              # 类型检查、规则测试、联机全流程和桌面构建
npm run build               # 构建桌面端，不打包安装文件
npm run package:mac        # 生成 macOS DMG 和 release/mac-arm64/
npm run clean               # 清理桌面端生成目录
```

默认打包不会再自动复制到桌面，避免产生多个同名 `.app`。如果确实需要桌面副本，再显式运行：

```bash
npm run package:mac:desktop
```
