import type { Meld } from '@pizhou/shared';
import { TileView } from './TileView';

const MELD_LABEL: Record<string, string> = {
  chi: '吃',
  peng: '碰',
  kan: '坎',
  'ming-gang': '明杠',
  'an-gang': '暗杠',
  'bu-gang': '补杠',
};

interface MeldsProps {
  melds: Meld[];
  vertical?: boolean;
  isOpponent?: boolean;
  highlightKey?: string | null;
  onTileHover?: (key: string | null) => void;
}

export function Melds({
  melds,
  vertical = false,
  isOpponent = false,
  highlightKey,
  onTileHover,
}: MeldsProps) {
  if (melds.length === 0) return null;

  const kanMelds = melds.filter((m) => m.type === 'kan' || m.type === 'an-gang');
  const openMelds = melds.filter((m) => m.type !== 'kan' && m.type !== 'an-gang');
  const orderedMelds = [
    ...kanMelds.map((meld) => ({ meld, isKan: true })),
    ...openMelds.map((meld) => ({ meld, isKan: false })),
  ];

  const renderMeld = (meld: Meld, index: number, isKan: boolean) => {
    const isSecret = isKan && isOpponent;
    const label = isSecret
      ? meld.type === 'an-gang' ? '暗杠' : '暗坎'
      : isKan
        ? meld.type === 'an-gang' ? '🔒 暗杠' : '🔒 坎'
        : MELD_LABEL[meld.type] ?? '副露';

    return (
      <div
        key={`${meld.type}-${index}`}
        className={`meld ${meld.type} ${isKan ? 'is-kan-meld' : 'is-open-meld'} ${isSecret ? 'is-secret' : ''}`}
      >
        <span className="meld-badge">{label}</span>
        <div className="meld-tiles">
          {meld.tiles.map((tile) => (
            <TileView
              key={tile.id}
              tile={tile}
              back={isSecret || tile.key === 'back'}
              small
              pose={isSecret ? 'rack' : 'lie'}
              highlightSame={Boolean(highlightKey && !isSecret && tile.key !== 'back' && tile.key === highlightKey)}
              onHover={(hovered) => {
                if (!isSecret && tile.key !== 'back') {
                  onTileHover?.(hovered ? tile.key : null);
                }
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`melds-container ${vertical ? 'vertical' : ''} ${melds.length >= 3 ? 'has-many' : ''}`}
      data-meld-count={melds.length}
    >
      {orderedMelds.map(({ meld, isKan }, index) => renderMeld(meld, index, isKan))}
    </div>
  );
}
