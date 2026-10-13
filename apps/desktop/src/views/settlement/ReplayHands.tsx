import { isPrivatePlayerView, type ClientView, type Settlement } from '@pizhou/shared';
import { Melds } from '../../components/Melds';
import { TileView } from '../../components/TileView';
import { AvatarView } from '../../components/AvatarView';
import { SEAT_NAMES } from './presentation';

export function ReplayHands({ view, settlement }: { view: ClientView; settlement: Settlement }) {
  return (
    <div className="settlement-replay">
      <div className="settlement-replay-intro">
        <strong>本局牌面复盘</strong>
        <span>结算后公开四家手牌，副露与牌河清晰展示，便于核对查胡分。</span>
      </div>
      <div className="settlement-replay-grid">
        {view.players.map((player) => {
          const hand = isPrivatePlayerView(player) ? player.hand : [];
          const winner = player.seat === settlement.winnerSeat;
          const winningDiscardId = !settlement.selfDraw && winner ? view.lastDiscard?.tile.id : undefined;
          const score = settlement.scores.find((item) => item.seat === player.seat);
          const delta = score?.delta ?? 0;
          const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

          return (
            <article key={player.seat} className={`replay-player-card ${winner ? 'is-winner' : ''}`}>
              <div className="replay-card-header">
                <div className="replay-card-identity">
                  <AvatarView avatar={player.avatar} className="replay-player-avatar" alt={`${player.nickname}头像`} />
                  <span className="seat-badge">{SEAT_NAMES[player.seat]}</span>
                  <b className="replay-player-name">{player.nickname}</b>
                  {player.title ? <span className="replay-player-title">{player.title}</span> : null}
                  {player.isDealer ? <span className="tag-dealer">庄</span> : null}
                  {winner ? <span className="tag-winner">胡牌</span> : null}
                  {player.closed ? <span className="tag-closed">关门</span> : null}
                  <span className="replay-hand-count">{hand.length}张手牌</span>
                </div>

                <div className="replay-card-score">
                  <strong className={`score-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{deltaLabel}</strong>
                  <span className="score-detail">{score?.hu ?? 0}胡 · {score?.yao ?? 0}幺</span>
                  <small className="score-type">{score?.piaoHun ? '飘荤' : winner ? '本局赢家' : '两两对账'}</small>
                </div>
              </div>

              <div className="replay-card-body">
                <div className="replay-main-row">
                  {player.melds.length > 0 ? (
                    <div className="replay-melds-cluster">
                      <Melds melds={player.melds} highlightKey={null} />
                    </div>
                  ) : null}

                  {hand.length > 0 ? (
                    <div className="replay-hand-cluster" aria-label={`${player.nickname}手牌`}>
                      {hand.map((tile) => (
                        <TileView
                          key={tile.id}
                          tile={tile}
                          pose="hand"
                          last={tile.id === winningDiscardId}
                          className="replay-tile"
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="replay-empty">手牌未公开</span>
                  )}
                </div>

                {player.discards.length > 0 ? (
                  <div className="replay-discards-row">
                    <span className="replay-discards-label">弃牌</span>
                    <div className="replay-discard-tiles">
                      {player.discards.map((tile) => (
                        <TileView key={tile.id} tile={tile} small pose="lie" className="replay-discard-tile" />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

