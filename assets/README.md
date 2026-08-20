# 素材目录说明

运行时素材放在 `apps/desktop/public/assets/`，Vite 构建时会原样复制到桌面客户端。

本目录只保存不会直接进入客户端的源素材和参考素材：

- `source/tile-front.png`：牌面生成脚本使用的空白牌胚。
- `reference/tile-sheets/`：牌面参考图集。

客户端实际显示的牌面统一放在 `apps/desktop/public/assets/tiles/`。替换牌面后重新运行 `npm run build` 或打包命令即可。
