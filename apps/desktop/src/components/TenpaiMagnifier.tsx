import { TILE_COPIES, tileLabel } from '@pizhou/shared';

interface TenpaiMagnifierProps {
  waits: string[];
  visible: Record<string, number>;
  previewLabel?: string;
  isClosed?: boolean;
  meldsCount?: number;
  onClose?: () => void;
}

function remainingCount(key: string, visible: Record<string, number>): number {
  return Math.max(0, TILE_COPIES - (visible[key] ?? 0));
}

function tileImgSrc(key: string): string {
  const parts = key.split('-');
  if (parts.length === 2) {
    return `./assets/tiles/${parts[0]}-${parts[1]}.png`;
  }
  return './assets/tile-back.png';
}

function getChanceStars(remaining: number): string {
  if (remaining >= 4) return '★★★★★';
  if (remaining === 3) return '★★★★☆';
  if (remaining === 2) return '★★★☆☆';
  if (remaining === 1) return '★★☆☆☆';
  return '☆☆☆☆☆ (绝张)';
}

export function TenpaiMagnifier({
  waits,
  visible,
  previewLabel,
  isClosed,
  meldsCount = 0,
}: TenpaiMagnifierProps) {
  if (waits.length === 0) return null;

  const totalRemaining = waits.reduce((sum, key) => sum + remainingCount(key, visible), 0);
  const isPiaoHunChance = meldsCount >= 3;

  return (
    <div className="tenpai-magnifier-card">
      <div className="magnifier-header">
        <span className="magnifier-title">
          🔍 听牌透视显微镜 {previewLabel ? `· 出【${previewLabel}】` : ''}
        </span>
        <span className="magnifier-total-pill">
          共听 <b>{waits.length}</b> 门 / 剩余 <b>{totalRemaining}</b> 张
        </span>
      </div>

      <div className="magnifier-list">
        {waits.map((key) => {
          const seen = visible[key] ?? 0;
          const left = remainingCount(key, visible);
          const stars = getChanceStars(left);

          return (
            <div key={key} className={`magnifier-item ${left === 0 ? 'is-depleted' : ''}`}>
              <div className="magnifier-tile-thumb">
                <img src={tileImgSrc(key)} alt="" className="thumb-img" />
              </div>
              <div className="magnifier-item-info">
                <div className="item-title-row">
                  <b className="item-name">{tileLabel(key)}</b>
                  <span className={`item-left-tag ${left > 0 ? 'available' : 'zero'}`}>
                    {left > 0 ? `剩余 ${left} 张` : '已无余牌'}
                  </span>
                </div>
                <div className="item-meta-row">
                  <span className="item-seen">桌面已见: {seen}/4 张</span>
                  <span className="item-stars" title="胡牌胜算评级">{stars}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="magnifier-footer">
        {isClosed ? (
          <span className="footer-tag safe">🛡️ 已经关门：享受胡牌飘荤，静候对手打香牌包全桌</span>
        ) : isPiaoHunChance ? (
          <span className="footer-tag warning">💡 建议关门：手牌成型可点击关门防守，并让打香牌点炮的对手包庄</span>
        ) : (
          <span className="footer-tag neutral">💡 提示：主动坎上三张可累积胡数，凑齐四组或两对可关门听牌</span>
        )}
      </div>
    </div>
  );
}
