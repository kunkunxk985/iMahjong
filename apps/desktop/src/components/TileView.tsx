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
  closeGateHint?: boolean;
  xiangHint?: boolean;
  chouHint?: boolean;
  className?: string;
  pose?: 'hand' | 'lie' | 'rack';
  dataTileId?: string;
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
export { faceSrc };

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
  closeGateHint,
  xiangHint,
  chouHint,
  className: extraClassName,
  pose = 'hand',
  dataTileId,
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
    closeGateHint ? 'close-gate-hint' : '',
    xiangHint ? 'xiang-hint' : '',
    chouHint ? 'chou-hint' : '',
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
      <img
        className="tile-skin"
        src={isBack ? './assets/tile-back.png' : faceSrc(tile!)}
        alt=""
        draggable={false}
      />
      {closeGateHint ? (
        <span className="close-gate-badge">关门</span>
      ) : tenpaiHint ? (
        <span className="tenpai-badge">听</span>
      ) : xiangHint ? (
        <span className="xiang-badge" title="香牌（生张·点炮包庄）">香</span>
      ) : chouHint ? (
        <span className="chou-badge" title="臭牌（熟张·点炮免包）">臭</span>
      ) : null}
    </>
  );

  if (!onClick) {
    return (
      <div
        className={className}
        data-tile-id={dataTileId}
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
      data-tile-id={dataTileId}
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
