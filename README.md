# 邳州麻将桌面版

双击就能玩的单机 Demo。规则在本地跑，三位陪练自动打牌。四人联机以后再加。

当前规则是完整查胡麻将：120 张、胡/幺两两结、落地碰算坎、飘荤、三种包庄、起手杠、四同张流局。

## 开发

```bash
npm install
npm test
npm run dev:desktop
```

点「开始对局」即可，不用填端口，也不用先开服务器。

## 打包

```bash
npm run package:mac
```

Windows 实际用的是未签名解压目录（`--win --x64 --dir`），不是 NSIS 安装包。
