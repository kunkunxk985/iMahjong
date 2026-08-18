import { type Tile } from '@pizhou/shared';

interface TileViewProps {
  tile?: Tile;
  back?: boolean;
  small?: boolean;
  selected?: boolean;
  drawn?: boolean;
  dim?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

function faceSrc(tile: Tile): string {
  return `/assets/tiles/${tile.suit}-${tile.rank}.png`;
}

export function TileView({ tile, back, small, selected, drawn, dim, onClick, onDoubleClick }: TileViewProps) {
  const className = [
    'tile',
    small ? 'small' : '',
    selected ? 'selected' : '',
    drawn ? 'drawn' : '',
    dim ? 'dim' : '',
    back || !tile ? 'is-back' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <img
      className="tile-skin"
      src={back || !tile ? '/assets/tile-back.png' : faceSrc(tile)}
      alt=""
      draggable={false}
    />
  );

  if (!onClick) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {body}
    </button>
  );
}

export function TileShowcase() {
  const samples: Tile[] = [
    { id: 's5', suit: 'wan', rank: 5, key: 'wan-5' },
    { id: 't1', suit: 'tong', rank: 1, key: 'tong-1' },
    { id: 't5', suit: 'tong', rank: 5, key: 'tong-5' },
    { id: 'b1', suit: 'tiao', rank: 1, key: 'tiao-1' },
    { id: 'b2', suit: 'tiao', rank: 2, key: 'tiao-2' },
    { id: 'b3', suit: 'tiao', rank: 3, key: 'tiao-3' },
  ];
  return (
    <div className="tile-showcase">
      {samples.map((tile) => (
        <TileView key={tile.id} tile={tile} />
      ))}
    </div>
  );
}
