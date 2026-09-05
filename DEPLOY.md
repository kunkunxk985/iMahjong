# 邳州麻将：服务器云端部署与公网联机指南

## 当前 Cloudflare 部署

- 客户端默认地址：`wss://imahjong.kunkunxk985.workers.dev`。
- `imahjong` 是公开入口，通过 Service Binding 将 HTTP 和 WebSocket 请求原样交给 `pizhou-mahjong-server`。
- 原服务继续拥有 `PizhouHubDO` 数据库；不要删除原服务、重建命名空间或改变 `global_pizhou_hub`，否则可能无法访问原账号数据。
- 旧地址仍兼容旧版客户端。这里只更换公开入口，不迁移数据库、不修复已有登录故障。
- 完整部署：`npm run deploy:cf`；只部署入口：`npm run deploy:gateway -w @pizhou/worker`。
- 客户端固定连接此云端入口，不再提供自定义服务器输入，旧地址缓存不生效。已安装 App 需更新打包版本。单机练习保留内置本地服务，账号、资料、战绩仍走固定云端。
- 发布客户端前：`npm run verify`；Mac 客户端用 `npm run package:mac`，Windows 客户端用 `npm run package:win`。

以下为独立服务器的备选部署方式，并非当前 Cloudflare 部署步骤。

本文档提供三种将游戏服务器部署到云服务器（阿里云 / 腾讯云 / 华为云 / AWS / 自建 VPS）的方法。

---

## 🚀 方式一：Docker 一键部署（推荐，最省心）

### 1. 将项目上传到服务器
```bash
git clone <your-repo-url> pizhou-mahjong
cd pizhou-mahjong
```

### 2. 一键启动容器
```bash
docker compose up -d --build
```

### 3. 检查运行状态
```bash
docker compose logs -f
```

---

## ⚡ 方式二：Node.js + PM2 进程守护

### 1. 安装依赖
```bash
npm ci
```

### 2. 全局安装 PM2（如未安装）
```bash
npm install -g pm2
```

### 3. 启动后台守护服务
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 🌐 防火墙与安全组配置

在云服务器控制台（如腾讯云/阿里云管理后台），进入 **安全组 / 防火墙**：
- 放行 **TCP 端口 `27985`**（入站规则允许 `0.0.0.0/0`）。

---

## 👥 客户端（电脑端）连接说明

1. 打开桌面端《邳州麻将》；
2. 在大厅主页点击底部 **「设置」**；
3. 在「服务器地址」输入您的公网服务器地址，例如：
   ```text
   ws://你的服务器公网IP:27985
   ```
4. 点击 **「保存并连接」** 即可。
5. 创建房间后，把 **6 位房间号** 发给朋友即可跨公网畅玩！
