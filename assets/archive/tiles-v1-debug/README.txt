邳州麻将基础牌面素材

本目录包含30种唯一牌面，每种在牌库中复制4张，共120张：

- WAN_1 至 WAN_9：一万至九万。
- TIAO_1 至 TIAO_9：一条至九条。
- TONG_1 至 TONG_9：一筒至九筒。
- DRAGON_ZHONG：中。
- DRAGON_FA：发。
- DRAGON_BAI：白。

请不要使用动物、鸡图、扑克牌、风牌、花牌、癞子或随机生成的替代图案。

代码中通过 tiles.json 的 tileIds 映射加载对应图片。发牌时每个 tileId 创建4个不同实例，例如：

WAN_1_1
WAN_1_2
WAN_1_3
WAN_1_4

完整参考图：

../tile-reference/mahjong-tile-sheet.png

完整120张总览：

../tile-reference/mahjong-full-120-deck.png

可缩放源文件：

../tile-reference/mahjong-tile-sheet.svg
