# 素材目录说明

运行时素材放在 `apps/desktop/public/assets/`，Vite 构建时会原样复制到桌面客户端。

本目录只保存源素材和参考素材：

- `tiles/`：当前牌面源图。
- `reference/tile-sheets/`：牌面参考图集。
- `archive/tiles-pro-v2/`：专业牌面候选版本，暂未接入当前运行链。
- `archive/tiles-v1-debug/`：调试版本牌面，暂未接入当前运行链。

不要直接把新牌面放到根目录。要替换客户端显示时，应更新 `apps/desktop/public/assets/tiles/`，然后重新构建。
