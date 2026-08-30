# 邳州麻将：服务器云端部署与公网联机指南

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
