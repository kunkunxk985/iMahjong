import { memo } from 'react';
import {
  isPrivatePlayerView,
  SEAT_NAMES,
  type ClientView,
  type PublicPlayerView,
} from '@pizhou/shared';
import { TileView } from '../components/TileView';
import { AvatarView } from '../components/AvatarView';

export type BoardPosition = 'top' | 'right' | 'bottom' | 'left';
type ViewPlayer = ClientView['players'][number];

export function relativeSeat(seat: number, mySeat: number): number {
  return (seat - mySeat + 4) % 4;
}

export const BoardPlayer = memo(function BoardPlayer({
  player,
  position,
  you,
  current,
}: {
  player: ViewPlayer;
  position: BoardPosition;
  you?: boolean;
  current: boolean;
}) {
  const avatar = player.isBot ? '陪' : player.avatar;
  const seatName = SEAT_NAMES[player.seat];

  return (
    <div
      className={`board-player board-player-${position} ${current ? 'is-current' : ''} ${you ? 'is-you' : ''}`}
      aria-current={current ? 'true' : undefined}
    >
      <div className="player-avatar-wrap">
        <div className={`board-avatar avatar-${player.seat}`}>
          <AvatarView avatar={avatar} className="board-avatar-content" alt={`${player.nickname}头像`} />
        </div>
        <span className="player-seat-badge" title={`座位：${seatName}风`}>{seatName}</span>
        {player.isDealer ? <span className="player-dealer-badge" title="当前庄家">庄</span> : null}
      </div>

      <div className="player-meta-wrap">
        <div className="player-name-row">
          <span className="player-name" title={player.nickname}>
            {player.nickname}
          </span>
          {you ? <span className="player-you-tag">我</span> : null}
        </div>
        <div className="player-score-row">
          <span className="player-score" aria-label={`积分 ${player.score}`}>
            {player.score > 0 ? `+${player.score}` : player.score}
          </span>
        </div>
      </div>
    </div>
  );
});

export const ConcealedHand = memo(function ConcealedHand({
  player,
  position,
  reveal = false,
}: {
  player: ViewPlayer;
  position: BoardPosition;
  reveal?: boolean;
}) {
  const count = Math.min(player.handCount, 14);
  if (count === 0) return null;
  const revealed = reveal && isPrivatePlayerView(player);

  return (
    <div
      className={`board-concealed board-concealed-${position} ${revealed ? 'is-revealed' : ''}`}
      aria-label={`${SEAT_NAMES[player.seat]}${revealed ? '手牌' : '手牌背面'}`}
    >
      {revealed
        ? player.hand.map((tile) => (
            <TileView key={tile.id} tile={tile} small pose="rack" className="board-concealed-tile" />
          ))
        : Array.from({ length: count }, (_, index) => (
            <TileView key={`${player.seat}-hand-${index}`} back small pose="rack" className="board-concealed-tile" />
          ))}
    </div>
  );
});

export const DiscardRiver = memo(function DiscardRiver({
  player,
  position,
  lastDiscardId,
  flyingDiscardId,
  highlightKey,
  onTileHover,
}: {
  player: PublicPlayerView;
  position: BoardPosition;
  lastDiscardId?: string;
  flyingDiscardId?: string | null;
  highlightKey?: string | null;
  onTileHover?: (key: string | null) => void;
}) {
  if (player.discards.length === 0) return null;

  return (
    <div className={`board-discard board-discard-${position}`} aria-label={`${SEAT_NAMES[player.seat]}弃牌区`}>
      <div className="board-discard-grid">
        {player.discards.map((tile) => {
          return (
            <div
              key={tile.id}
              className={`board-discard-cell ${tile.id === lastDiscardId ? 'is-last' : ''} ${tile.id === flyingDiscardId ? 'is-flight-target' : ''}`}
              data-discard-tile-id={tile.id}
            >
              <TileView
                tile={tile}
                small
                pose="lie"
                last={tile.id === lastDiscardId}
                highlightSame={Boolean(highlightKey && tile.key === highlightKey)}
                onHover={(hovered) => onTileHover?.(hovered ? tile.key : null)}
                className="board-discard-tile"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
