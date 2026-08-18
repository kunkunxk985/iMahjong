# 邳州麻将桌面版

双击就能玩的单机 Demo。规则在本地跑，三位陪练自动打牌。四人联机以后再加。

## 安装包

```bash
npm install
npm run package:win
```

生成文件在 `apps/desktop/release/`：

- `邳州麻将 Setup 0.1.0.exe` 安装版，会在桌面建快捷方式
- `邳州麻将 0.1.0.exe` 绿色版，拷走就能开

## 开发

```bash
npm install
npm run dev:desktop
```

点「开始对局」即可，不用填端口，也不用先开服务器。
