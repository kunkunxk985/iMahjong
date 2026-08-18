import type { Meld } from '@pizhou/shared';
import { TileView } from './TileView';

export function Melds({ melds, vertical = false }: { melds: Meld[]; vertical?: boolean }) {
  if (melds.length === 0) return null;
  return (
    <div className={`melds ${vertical ? 'vertical' : ''}`}>
      {melds.map((meld, index) => (
        <div key={`${meld.type}-${index}`} className={`meld ${meld.type}`}>
          {meld.tiles.map((tile) => (
            <TileView key={tile.id} tile={tile} small />
          ))}
        </div>
      ))}
    </div>
  );
}
