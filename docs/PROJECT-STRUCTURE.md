# 邳州麻将项目结构说明

本文档描述当前真实运行结构。项目采用 npm workspaces 管理的 monorepo：`apps/` 放可运行应用，`packages/` 放应用共用的领域能力，`assets/` 放不直接进入安装包的源素材。

## 1. 运行链路

```text
Electron 主进程
├─ 创建桌面窗口
├─ 启动或探测本机 WebSocket 服务
└─ 加载 React 页面
     ├─ 大厅 Lobby
     ├─ 等待房 WaitingRoom
     ├─ 蓝金 2.5D 牌桌 Table
     └─ 查胡结算 Settlement
          │
          └─ GameClient（WebSocket）
               │
               ├─ Electron 内嵌 server-core（单机/本机联机）
               └─ apps/server（局域网独立主机）
                    │
                    ├─ packages/server-core：房间、连接、陪练
                    ├─ packages/rules：牌局状态机、胡牌与计分
                    └─ packages/shared：牌定义、协议、共享类型
```

依赖方向必须保持单向：

```text
shared ← rules ← server-core ← desktop/server
```

`shared` 不依赖任何业务包；`rules` 不依赖 Electron、React 或 Node 网络模块。

## 2. 根目录

| 文件或目录 | 作用 |
|---|---|
| `.github/workflows/ci.yml` | GitHub Actions；在 macOS、Windows、Linux 的 Node 20 上执行完整验证。 |
| `.env.example` | 环境变量示例；可配置服务端口或开发环境连接地址。 |
| `.gitignore` | 排除依赖、构建产物、打包产物和系统垃圾。 |
| `README.md` | 项目首页，提供玩法能力、开发和打包命令。 |
| `package.json` | workspace 总入口；统一定义 `dev`、`test`、`verify`、`build`、`package:*`。 |
| `package-lock.json` | 锁定全仓库依赖版本，Windows/macOS 应保持一致。 |
| `tsconfig.base.json` | 所有 TypeScript workspace 共用的编译选项。 |
| `apps/` | 可直接启动或打包的应用。 |
| `packages/` | 多个应用共用的规则、服务和协议。 |
| `assets/` | 新版麻将牌源素材备份，不直接进入安装包。 |
| `docs/` | 架构与玩法规则文档。 |
| `scripts/check-architecture.mts` | 阻止 shared/rules/server-core 反向依赖，并检查 34 个运行时牌桌素材是否缺失。 |
| `scripts/smoke.mts` | 四人联机、重连、下一局和单机陪练的端到端验证。 |

## 3. `apps/desktop`：桌面客户端

### 配置与入口

| 文件 | 作用 |
|---|---|
| `package.json` | Electron 客户端依赖、脚本和 electron-builder 打包配置。 |
| `index.html` | Vite 页面外壳，提供 React 挂载节点。 |
| `vite.config.ts` | Vite/React 构建配置。 |
| `tsconfig.json` | 桌面端 TypeScript 配置。 |

### `electron/`：Electron 主进程

| 文件 | 作用 |
|---|---|
| `main.ts` | 主进程入口；先显示窗口，再异步启动本机牌局服务，避免首页卡死。 |
| `window.ts` | 创建和配置 BrowserWindow，区分开发地址与打包后的本地页面。 |
| `preload.ts` | 通过安全 IPC 向 React 页面暴露本机服务地址和新窗口能力。 |
| `localServer.ts` | 探测 8787 端口；已有服务则复用，没有则启动内嵌 server-core。 |

### `src/`：React 用户界面

| 文件 | 作用 |
|---|---|
| `main.tsx` | React 入口和全局错误边界；渲染失败时显示可恢复错误页。 |
| `App.tsx` | 页面总控制器；管理本机/联机模式、WebSocket、房间状态和页面切换。 |
| `styles.css` | CSS 总入口，按顺序引入四个样式模块。 |
| `vite-env.d.ts` | Vite 和 preload API 的类型声明入口。 |

### `src/table/`：牌桌展示子模块

| 文件 | 作用 |
|---|---|
| `BoardSeats.tsx` | 四个座位、暗手和四方牌河的纯展示组件。 |
| `DiscardFlight.tsx` | 出牌飞行动画；只负责动画呈现，不处理规则。 |
| `TenpaiBar.tsx` | 可见牌统计和听牌余张提示。 |
| `clock.tsx` | 回合倒计时与桌面时钟，避免高频刷新整个牌桌。 |

### `src/views/`：完整页面

| 文件 | 作用 |
|---|---|
| `Lobby.tsx` | 首页；昵称、创建房间、加入房间、单机陪练和服务器状态。 |
| `WaitingRoom.tsx` | 联机等待房；显示四个座位、准备状态和房主开局操作。 |
| `Table.tsx` | 核心牌桌；四家位置、牌墙、手牌、牌河、副露、操作区和听牌提示。 |
| `Settlement.tsx` | 查胡结算弹窗；显示胡数、幺数、两两流水、牌面拆解和下一局。 |

### `src/components/`：可复用界面组件

| 文件 | 作用 |
|---|---|
| `TileView.tsx` | 单张麻将牌；根据牌 key 加载新版 PNG，并渲染牌体、阴影和牌背。 |
| `Melds.tsx` | 吃、碰、坎、杠的分组显示；负责暗坎遮挡和多组副露布局。 |
| `ActionBar.tsx` | 当前可执行操作按钮：吃、碰、杠、坎、胡、过、关门。 |
| `RulesModal.tsx` | 游戏内规则说明。 |
| `SettingsModal.tsx` | 联机服务器地址设置。 |

### `src/audio/` 与 `src/ws/`

| 文件 | 作用 |
|---|---|
| `audio/sfx.ts` | 音效名称与播放基础封装。 |
| `audio/useSoundEffects.ts` | 根据牌局状态变化触发摸牌、出牌、碰杠胡等音效。 |
| `ws/client.ts` | WebSocket 客户端；连接、重连、协议收发和 actionId 生成。 |

### `src/styles/`：蓝金 2.5D 视觉系统

| 文件 | 作用 |
|---|---|
| `core.css` | 色板、字体、窗口舞台、桌布木框、牌体和通用按钮基础。 |
| `interface.css` | 大厅、等待房、设置和结算等界面样式。 |
| `table.css` | 蓝金牌桌、玩家席位、牌墙、牌河、副露和中央状态盘。 |
| `responsive.css` | 小窗口和不同比例屏幕的缩放、换列与防裁切规则。 |

### `public/assets/`：运行时美术资源

| 路径 | 作用 |
|---|---|
| `tiles/wan-1.png` ～ `wan-9.png` | 一至九万。 |
| `tiles/tong-1.png` ～ `tong-9.png` | 一至九筒。 |
| `tiles/tiao-1.png` ～ `tiao-9.png` | 一至九条。 |
| `tiles/dragon-1.png` ～ `dragon-3.png` | 中、发、白。 |
| `tile-back.png` | 对手手牌和暗牌使用的绿色牌背。 |
| `felt.jpg` | 牌桌绒布材质。 |
| `wood.jpg` | 外围木框材质。 |
| `corner.png` | 蓝金牌桌四角装饰。 |

120张牌不是120个图片文件，而是30种牌面各放4张。

### `build/` 与 `scripts/`

| 文件 | 作用 |
|---|---|
| `build/icon.png` | 应用图标原图。 |
| `build/icon.icns` | macOS 应用图标。 |
| `build/icon.ico` | Windows 应用图标。 |
| `build/MaShanZheng.ttf` | 打包图标/美术流程保留的中文字体资源。 |
| `scripts/dev.mjs` | 同时启动 Vite 与 Electron，Electron 异常退出时自动重启。 |
| `scripts/build.mjs` | 构建 React 页面并打包 Electron 主进程代码。 |
| `scripts/bundle-electron.mjs` | 将 Electron 主进程及其 workspace 依赖打成可运行 JS。 |
| `scripts/clean.mjs` | 删除 `dist`、`dist-electron` 和 `release`。 |
| `scripts/copy-to-desktop.mjs` | 打包后覆盖桌面唯一最新版 App，并清理旧 DMG。 |

## 4. `apps/server`：独立局域网服务

| 文件 | 作用 |
|---|---|
| `src/index.ts` | 薄适配入口；监听所有网卡并输出本机及局域网 WebSocket 地址。规则和房间逻辑仍由 `server-core` 提供。 |
| `package.json` | 独立服务的开发、启动和类型检查命令。 |
| `tsconfig.json` | 服务端入口的 TypeScript 配置。 |

只有一台电脑作为纯主机、不打开桌面客户端时，才需要 `npm run dev:server` 单独运行它。根目录的 `scripts/smoke.mts` 负责四人联机、重连、下一局和单机陪练全流程验证。

## 5. `packages/shared`：共享模型与协议

| 文件 | 作用 |
|---|---|
| `index.ts` | 包的统一导出入口。 |
| `constants.ts` | 服务端口、窗口尺寸、超时等跨端常量。 |
| `tiles.ts` | 120张牌墙、牌 key、排序和幺九判断。 |
| `types.ts` | 玩家、房间、牌局视图、操作、结算等公共类型。 |
| `protocol.ts` | 客户端到服务端、服务端到客户端的 WebSocket 消息联合类型。 |
| `events.ts` | 连接状态与牌局事件相关共享类型。 |
| `seats.ts` | 座位顺序、相对方位、房间号和昵称规范化工具。 |
| `package.json` | 包入口和类型检查脚本。 |
| `tsconfig.json` | 共享包 TypeScript 配置。 |

## 6. `packages/rules`：邳州麻将规则引擎

| 文件 | 作用 |
|---|---|
| `src/index.ts` | 规则包统一导出入口。 |
| `src/types.ts` | 规则引擎内部座位状态、阶段和可执行操作类型。 |
| `src/win.ts` | 判断是否能胡，并枚举“四组面子加一对”的合法拆法。 |
| `src/tenpai.ts` | 计算听哪些牌，以及打哪张后进入听牌。 |
| `src/actions.ts` | 生成吃、碰、杠、坎、胡、关门等合法操作并定义优先级。 |
| `src/score.ts` | 查胡核心：胡/幺计分、点炮/自摸拆法、庄家与飘荤本人倍率、关门、包庄和两两结账。 |
| `src/engine.ts` | 纯内存牌局状态机；发牌、轮转、声明、超时、流局与结算。 |
| `src/companion.ts` | 单机陪练的出牌和操作决策。 |
| `tests/win.test.ts` | 胡牌合法性和120张牌型测试。 |
| `tests/tenpai.test.ts` | 听牌与打牌后听口测试。 |
| `tests/score.test.ts` | 查胡、对子与暗坎、本人倍率、关门、飘荤和包庄边界测试。 |
| `tests/engine.test.ts` | 完整状态机、操作优先级、关门锁牌和流局测试。 |
| `tests/companion.test.ts` | 陪练决策和思考时间测试。 |
| `package.json` | 规则包入口与测试脚本。 |
| `tsconfig.json` | 规则包 TypeScript 配置。 |

规则修改必须先补对应测试，尤其不要绕过 `score.ts` 直接在 UI 计算分数。

## 7. `packages/server-core`：房间与连接服务

| 文件 | 作用 |
|---|---|
| `src/index.ts` | 服务核心统一导出入口。 |
| `src/createServer.ts` | 创建 WebSocket 服务、解析协议、广播客户端视图。 |
| `src/room.ts` | 房间、座位、准备、开局、离开、重连、下一局和累计分数。 |
| `src/bots.ts` | 三位陪练的异步操作调度和定时器清理。 |
| `src/lan.ts` | 查找局域网 IPv4 地址，供主机打印连接地址。 |
| `tests/room.test.ts` | 房号、准备开局、房主转移、重连、清扫和机器人定时器测试。 |
| `package.json` | 服务核心依赖与测试脚本。 |
| `tsconfig.json` | 服务核心 TypeScript 配置。 |

## 8. `assets` 与 `docs`

| 路径 | 作用 |
|---|---|
| `assets/source/tile-faces/` | 30张新版牌面源文件和1张高清牌背备份。 |
| `assets/source/tile-front.png` | 空白牌胚源图。 |
| `assets/README.md` | 说明源素材与运行时素材的区别。 |
| `docs/PROJECT-STRUCTURE.md` | 本文档。 |
| `docs/产品与规则说明.txt` | 产品目标和当前邳州麻将玩法约定。 |
| `docs/邳州麻将规则考据.md` | 公开来源分级、采用口径、实现解释、本房房规和待牌友确认项。 |

不要直接从 `assets/source/` 加载运行时图片。确认牌面后，将成品放入 `apps/desktop/public/assets/tiles/`。

## 9. 可删除的生成物

以下目录不属于源码，均被 `.gitignore` 排除：

| 目录 | 重建方式 |
|---|---|
| `node_modules/` | `npm install` |
| `apps/desktop/dist/` | `npm run build` |
| `apps/desktop/dist-electron/` | `npm run build` |
| `apps/desktop/release/` | `npm run package:mac` 或 `npm run package:win` |

执行 `npm run clean` 可清除桌面端构建和打包产物。

## 10. 常用命令

```bash
npm install             # 安装全部 workspace 依赖
npm run dev             # 启动 Electron，并自动启动本机服务
npm run dev:server      # 仅启动局域网主机
npm run typecheck       # 全仓库类型检查
npm test                # 规则与房间测试
npm run smoke           # 四人 WebSocket 全流程测试
npm run verify          # 类型 + 测试 + smoke + 构建
npm run build           # 生产构建
npm run package:mac     # macOS 打包并覆盖桌面最新版
npm run package:win     # Windows x64 打包
npm run clean           # 清理生成物
```

## 11. 维护边界

- 修改牌面：只替换 `public/assets/tiles/` 中对应 PNG，不改牌 key。
- 修改布局：优先改 `Table.tsx`、`Melds.tsx` 和 `styles/table.css`。
- 修改胡牌合法性：改 `win.ts`，并补 `win.test.ts`。
- 修改查胡计分：改 `score.ts`，并补 `score.test.ts`。
- 修改操作流程：改 `actions.ts`/`engine.ts`，并补 `engine.test.ts`。
- 修改房间联机：改 `server-core`，并补 `room.test.ts` 和 smoke 流程。
- 不要在 React 组件中复制规则逻辑；客户端只能展示服务端给出的牌局状态与结算。
