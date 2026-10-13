import type { ClientView, Settlement } from '@pizhou/shared';
import { Melds } from '../../components/Melds';
import { TileView } from '../../components/TileView';
import { AvatarView } from '../../components/AvatarView';
import { SEAT_NAMES, WIN_LABEL, type SettlementPresentation } from './presentation';

export function SettlementResult({ view, settlement, showMoney, presentation }: {
  view: ClientView; settlement: Settlement; showMoney: boolean; presentation: SettlementPresentation;
}) {
  const { winnerPlayer, winnerHand, winnerMelds, winningDiscardId, sortedScores, maxDelta, ratePerPoint } = presentation;
  return (
    /* 1. Shenghun-Style Podium Cards & Winning Hand Domino Showcase */
    <div className="shenghun-settlement">
      <details className="winning-hand-tray"><summary>{settlement.liuju ? '查看流局说明' : '查看胡牌牌面'}</summary>
        <div className="winning-tray-header">
          <div className="winning-tray-title">
            <span>🀄 {settlement.liuju ? '局终牌面展示' : `赢家胡牌面拆解 (${settlement.winnerNickname || '胡家'})`}</span>
          </div>
          <div className="winning-fan-pills">
            {settlement.selfDraw ? (
              <span className="fan-chip win-type">自摸</span>
            ) : !settlement.liuju ? (
              <span className="fan-chip win-type">点炮胡</span>
            ) : null}
            <span className="fan-chip win-type">{WIN_LABEL[settlement.winType] ?? settlement.winType}</span>
            {winnerPlayer?.closed ? <span className="fan-chip closed">两对关门</span> : null}
            {settlement.hunDi ? <span className="fan-chip hun-di">飘荤 (+90分)</span> : null}
            {!settlement.liuju ? <span className="fan-chip dealer">涉及庄家的两两胡差×2</span> : null}
            {settlement.baoZhuang ? <span className="fan-chip baozhuang">包庄全赔</span> : null}
          </div>
        </div>

        {!settlement.liuju && (winnerMelds.length > 0 || winnerHand.length > 0) ? (
          <div className="winning-domino-row">
            {winnerMelds.length > 0 ? (
              <>
                <div className="domino-melds-group">
                  <Melds melds={winnerMelds} highlightKey={null} />
                </div>
                <div className="domino-group-sep" />
              </>
            ) : null}

            {winnerHand.length > 0 ? (
              <div className="domino-hand-group">
                {winnerHand.map((tile) => (
                  <TileView
                    key={tile.id}
                    tile={tile}
                    pose="hand"
                    last={tile.id === winningDiscardId}
                    className="winning-tray-tile"
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px 0' }}>
            {settlement.liuju ? '本局未形成有效胡牌，所有牌面已归档复盘。' : '牌面已归集两两对账账册。'}
          </div>
        )}
      </details>

      {/* 4-Player Podium Cards Grid */}
      <div className="shenghun-podium-grid">
        {sortedScores.map((score, rankIdx) => {
          const player = view.players[score.seat];
          const isMvp = score.delta === maxDelta && maxDelta > 0;
          const deltaMoney = (score.delta * ratePerPoint).toFixed(1);

          return (
            <div
              key={score.seat}
              className={`podium-player-card rank-${rankIdx + 1} ${isMvp ? 'is-mvp' : ''}`}
            >
              {/* MVP Laurel Crest */}


              {/* Avatar */}
              <div className="podium-avatar-wrap">
                <AvatarView avatar={player?.avatar} alt={score.nickname} />
                <span className="podium-seat-tag">{SEAT_NAMES[score.seat]}</span>
              </div>

              {/* Name & Title */}
              <div className="podium-player-name" title={score.nickname}>
                {score.nickname}
              </div>

              {/* Badges Row */}
              <div className="podium-tags-row">
                {score.isDealer ? <span className="podium-mini-tag dealer">庄家</span> : null}
                {player?.closed ? <span className="podium-mini-tag closed">关门</span> : null}
                {score.piaoHun ? <span className="podium-mini-tag piao">飘荤</span> : null}
                {score.isWinner ? <span className="podium-mini-tag winner">胡牌</span> : null}
              </div>

              {/* Large Score Delta */}
              <div
                className={`podium-score-delta ${
                  score.delta > 0 ? 'positive' : score.delta < 0 ? 'negative' : 'zero'
                }`}
              >
                {score.delta > 0 ? `+${score.delta}` : score.delta} 分
              </div>

              {showMoney && (
                <div style={{ fontSize: '12px', color: score.delta > 0 ? '#fde047' : '#f87171' }}>
                  {score.delta > 0 ? `+¥${deltaMoney}` : `¥${deltaMoney}`}
                </div>
              )}

              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                累计: {score.total}分
              </div>
            </div>
          );
        })}
      </div>
    </div>

  );
}
