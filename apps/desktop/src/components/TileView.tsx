import { type Tile } from '@pizhou/shared';

interface TileViewProps {
  tile?: Tile;
  back?: boolean;
  small?: boolean;
  selected?: boolean;
  drawn?: boolean;
  dim?: boolean;
  last?: boolean;
  tenpaiHint?: boolean;
  entering?: boolean;
  highlightSame?: boolean;
  className?: string;
  pose?: 'hand' | 'lie' | 'rack';
  onClick?: () => void;
  onDoubleClick?: () => void;
  onHover?: (hovered: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function faceSrc(tile: Tile): string {
  if (tile.key === 'back' || !tile.suit || !tile.rank) return './assets/tile-back.png';
  return `./assets/tiles/${tile.suit}-${tile.rank}.png`;
}

export function TileView({
  tile,
  back,
  small,
  selected,
  drawn,
  dim,
  last,
  tenpaiHint,
  entering,
  highlightSame,
  className: extraClassName,
  pose = 'hand',
  onClick,
  onDoubleClick,
  onHover,
  onMouseEnter,
  onMouseLeave,
}: TileViewProps) {
  const isBack = Boolean(back || !tile || tile.key === 'back');
  const className = [
    'tile',
    small ? 'small' : '',
    selected ? 'selected' : '',
    drawn ? 'drawn' : '',
    dim ? 'dim' : '',
    last ? 'last-out' : '',
    highlightSame && !isBack ? 'highlight-same' : '',
    isBack ? 'is-back' : '',
    tenpaiHint ? 'tenpai-hint' : '',
    entering ? 'entering' : '',
    extraClassName ?? '',
    `pose-${pose}`,
  ]
    .filter(Boolean)
    .join(' ');

  const handleMouseEnter = () => {
    onHover?.(true);
    onMouseEnter?.();
  };

  const handleMouseLeave = () => {
    onHover?.(false);
    onMouseLeave?.();
  };

  const body = (
    <>
      <span className="tile-3d">
        <span className="tile-face">
          <img
            className="tile-skin"
            src={isBack ? './assets/tile-back.png' : faceSrc(tile!)}
            alt=""
            draggable={false}
          />
        </span>
        <span className="tile-edge-x" aria-hidden="true" />
        <span className="tile-edge-y" aria-hidden="true" />
      </span>
      {tenpaiHint ? <span className="tenpai-badge">听</span> : null}
    </>
  );

  if (!onClick) {
    return (
      <div
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
