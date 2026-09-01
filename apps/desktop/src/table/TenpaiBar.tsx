import { useState } from 'react';
import { TILE_COPIES, tileLabel, type ClientView, type Tile } from '@pizhou/shared';
import { TenpaiMagnifier } from '../components/TenpaiMagnifier';

export function countVisibleTiles(view: ClientView, myHand: Tile[]): Record<string, number> {
  const seen: Record<string, number> = {};
  const add = (key: string) => {
    if (key && key !== 'back') seen[key] = (seen[key] ?? 0) + 1;
  };

  for (const tile of myHand) add(tile.key);
  for (const player of view.players) {
    for (const tile of player.discards) add(tile.key);
    for (const meld of player.melds) {
      if (player.seat === view.mySeat || (meld.type !== 'kan' && meld.type !== 'an-gang' && meld.type !== 'zi-gang')) {
        for (const tile of meld.tiles) add(tile.key);
      }
    }
  }

  return seen;
}

function remainingCount(key: string, visible: Record<string, number>): number {
  return Math.max(0, TILE_COPIES - (visible[key] ?? 0));
}

export function TenpaiBar({
  waits,
  visible,
  previewLabel,
  elevated,
  isClosed,
  meldsCount = 0,
}: {
  waits: string[];
  visible: Record<string, number>;
  previewLabel?: string;
  elevated?: boolean;
  isClosed?: boolean;
  meldsCount?: number;
}) {
  const [showMagnifier, setShowMagnifier] = useState(false);
  if (waits.length === 0) return null;
  const totalRemaining = waits.reduce((sum, key) => sum + remainingCount(key, visible), 0);

  return (
    <div
      className={`tenpai-bar ${elevated ? 'elevated' : ''} ${isClosed ? 'is-closed-bar' : ''}`}
      onMouseEnter={() => setShowMagnifier(true)}
      onMouseLeave={() => setShowMagnifier(false)}
      onClick={() => setShowMagnifier((prev) => !prev)}
      title="点击或悬浮查看胡牌胜算透视"
    >
      {isClosed ? <span className="tenpai-closed-pill">🚪 已关门锁定</span> : null}
      <span className="tenpai-label">{previewLabel ? `打【${previewLabel}】听` : '听'}</span>
      {waits.map((key) => {
        const left = remainingCount(key, visible);
        return (
          <span key={key} className={`wait-tile ${left === 0 ? 'is-empty' : ''}`}>
            {tileLabel(key)}
            <span className="wait-count">×{left}</span>
          </span>
        );
      })}
      <span className="wait-total">共{totalRemaining}张 🔍</span>

      {showMagnifier ? (
        <TenpaiMagnifier
          waits={waits}
          visible={visible}
          previewLabel={previewLabel}
          isClosed={isClosed}
          meldsCount={meldsCount}
        />
      ) : null}
    </div>
  );
}
