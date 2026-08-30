# 素材目录

运行时只读 `apps/desktop/public/assets/`：

- `tiles/`：万、筒、条、中发白牌面（成品，以此为准）
- `tile-back.png`：牌背
- `felt.jpg` / `wood.jpg` / `corner.png`：桌面材质

本目录是不进安装包的源素材备份：

- `source/tile-faces/tile-back.png`：高清牌背原稿
- `source/tile-front.png`：空白牌胚

替换牌面：把 PNG 放到 `apps/desktop/public/assets/tiles/`，再 `npm run build` 或打包。
