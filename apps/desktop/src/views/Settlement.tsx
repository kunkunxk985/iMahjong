import { useEffect, useState } from 'react';
import { isPrivatePlayerView, type BaoZhuangReason, type ClientView, type Settlement } from '@pizhou/shared';
import { Melds } from '../components/Melds';
import { TileView } from '../components/TileView';
import { saveMatchToHistory } from '../storage/history';
import { apiSaveMatch } from '../api/auth';
import { AvatarView } from '../components/AvatarView';

const SEAT_NAMES = ['东', '南', '西', '北'] as const;

const WIN_LABEL: Record<string, string> = {
  'ping-hu': '平胡',
  'qidong-gang-hu': '起手杠胡',
  liuju: '流局',
};

const BAO_LABEL: Record<BaoZhuangReason, string> = {
  four_wait_seq: '四组听顺包庄',
  chow_wait_seq: '吃牌听顺包庄',
  xiang: '香牌包庄',
};

const BAO_EXPLANATION: Record<BaoZhuangReason, string> = {
  four_wait_seq: '胡家已有四组碰、坎或杠，单张听牌且始终未换张；该点炮牌与手中单张能相连成顺，本局按飘荤结算。',
  chow_wait_seq: '胡家已有四组牌且其中含吃，单张听牌且始终未换张；该点炮牌与手中单张能相连成顺，本局按普通胡结算。',
  xiang: '胡家已有三组碰、坎或杠，手里保留两对但尚未选择两对关门；该点炮牌此前全桌从未打出，属于香牌，由点炮者按飘荤包庄。',
};

const DRAW_LABEL: Record<string, string> = {
  four_same: '开局四同张流局',
  wall: '牌墙摸完流局',
};

function ReplayHands({ view, settlement }: { view: ClientView; settlement: Settlement }) {
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

export function SettlementModal({
  view,
  settlement,
  onAgain,
  onLeave,
  readyCount,
  alreadyReady = false,
  gameMode = 'online',
  serverUrl,
  token,
}: {
  view: ClientView;
  settlement: Settlement;
  onAgain: () => void;
  onLeave?: () => void;
  readyCount: number;
  alreadyReady?: boolean;
  gameMode?: 'online' | 'local';
  serverUrl?: string;
  token?: string | null;
}) {
  const roomRate = view.pointRate ?? 0.1;
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'breakdown' | 'replay'>('summary');
  const ratePerPoint = roomRate > 0 ? roomRate : 0.1;
  const [showMoney, setShowMoney] = useState<boolean>(roomRate > 0);

  const bao = settlement.baoZhuang
    ? BAO_LABEL[settlement.baoZhuang.reason]
    : null;
  const drawText = settlement.drawReason ? DRAW_LABEL[settlement.drawReason] ?? settlement.drawReason : null;
  const [minimized, setMinimized] = useState(false);

  const baoZhuangPayerScore = settlement.baoZhuang
    ? settlement.scores.find((s) => s.seat === settlement.baoZhuang!.payerSeat)
    : null;
  const baoZhuangTotalPoints = baoZhuangPayerScore ? Math.abs(baoZhuangPayerScore.delta) : 0;
  const baoZhuangTotalMoney = (baoZhuangTotalPoints * ratePerPoint).toFixed(1);
  const hunDiTotalPoints = settlement.hunDi ? 90 : 0;
  const hunDiTotalMoney = (hunDiTotalPoints * ratePerPoint).toFixed(1);
  const hunDiPerPlayerMoney = ((30) * ratePerPoint).toFixed(1);
  const chaHuPoints = Math.max(0, baoZhuangTotalPoints - hunDiTotalPoints);
  const chaHuMoney = (chaHuPoints * ratePerPoint).toFixed(1);

  useEffect(() => {
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const myScoreObj = settlement.scores.find((s) => s.seat === view.mySeat);
    const myDeltaScore = myScoreObj?.delta ?? 0;
    const myIsWinner = view.mySeat === settlement.winnerSeat;

    const record = {
      id: `${view.roomCode || '888888'}-${settlement.winnerSeat ?? 'draw'}-${Date.now()}`,
      mode: gameMode,
      timestamp: Date.now(),
      dateStr,
      roomCode: gameMode === 'online' ? (view.roomCode || '888888') : '单机练习',
      winType: WIN_LABEL[settlement.winType] ?? settlement.winType,
      winnerNickname: settlement.winnerNickname ?? undefined,
      winnerSeat: settlement.winnerSeat,
      hu: settlement.hu,
      yao: settlement.yao,
      dealerMultiplier: settlement.dealerMultiplier,
      hunDi: Boolean(settlement.hunDi),
      liuju: Boolean(settlement.liuju),
      drawReason: settlement.drawReason ?? undefined,
      baoZhuang: settlement.baoZhuang,
      myDeltaScore,
      myIsWinner,
      scores: settlement.scores.map((s) => ({
        seat: s.seat,
        nickname: s.nickname,
        score: s.total ?? s.delta ?? 0,
        isWinner: Boolean(s.isWinner),
        isDealer: Boolean(s.isDealer),
        notes: s.notes,
      })),
    };

    saveMatchToHistory(record);

    if (token && serverUrl) {
      apiSaveMatch(serverUrl, token, record).catch((err) => {
        console.warn('Auto upload match record to Cloudflare failed:', err);
      });
    }
  }, [settlement, view.roomCode, view.mySeat, gameMode, token, serverUrl]);

  const getNickname = (seat: number) => {
    const found = settlement.scores.find((s) => s.seat === seat);
    return found?.nickname || `${SEAT_NAMES[seat]}家`;
  };

  const isDealer = (seat: number) => {
    const found = settlement.scores.find((s) => s.seat === seat);
    return Boolean(found?.isDealer);
  };

  const isPiaoHun = (seat: number) => {
    const found = settlement.scores.find((s) => s.seat === seat);
    return Boolean(found?.piaoHun);
  };

  if (minimized) {
    return (
      <div className="settlement-floating-bar">
        <button type="button" className="btn-action primary" onClick={() => setMinimized(false)}>
          📊 展开对账结算单
        </button>
        <button type="button" className="btn-action" disabled={alreadyReady} onClick={onAgain}>
          {alreadyReady ? '已准备，等朋友' : '再来一局'}
        </button>
        {onLeave ? (
          <button type="button" className="btn-action ghost" onClick={onLeave}>
            回大厅
          </button>
        ) : null}
        <span className="floating-ready-pill">已准备 {readyCount}/4</span>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="settlement ledger-modal">
        <div className="gold-line" />
        
        <header className="settlement-header">
          <h2>{settlement.liuju ? '流局' : `${settlement.winnerNickname ?? '玩家'} 胡牌`}</h2>
          <p className="sub">
            {WIN_LABEL[settlement.winType] ?? settlement.winType}
            {settlement.hunDi ? ' · 飘荤' : ''}
            {bao ? ` · ${bao}` : ''}
          </p>
          {drawText ? <p className="sub">{drawText}</p> : null}

          {/* Hun Di & Bao Zhuang Fund Highlight Badges */}
          {(settlement.hunDi || settlement.baoZhuang) && !settlement.liuju ? (
            <div className="settlement-fund-pills">
              {settlement.hunDi ? (
                <div className="settlement-fund-pill hun-di">
                  🍲 <b>飘荤底分：</b>
                  <span>全桌共计 <b>90分</b> {showMoney ? `(¥${hunDiTotalMoney})` : ''} · 每家 30分 {showMoney ? `(¥${hunDiPerPlayerMoney})` : ''}</span>
                </div>
              ) : null}
              {settlement.baoZhuang ? (
                <div className="settlement-fund-pill bao-zhuang">
                  💥 <b>包庄清算：</b>
                  <span>由【{getNickname(settlement.baoZhuang.payerSeat)}】一人全包 <b>{baoZhuangTotalPoints}分</b> {showMoney ? `(¥${baoZhuangTotalMoney})` : ''}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        {/* Tab Switcher */}
        <div className="settlement-tabs">
          {!settlement.liuju ? (
            <>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              📊 查胡收付账单
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
            >
              🧾 6组两两对账流水
            </button>
            {settlement.breakdown.length > 0 ? (
              <button
                type="button"
                className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
                onClick={() => setActiveTab('breakdown')}
              >
                🀄 赢家牌面拆解
              </button>
            ) : null}
            </>
          ) : null}
          <button
            type="button"
            className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            🀄 牌局复盘
          </button>
        </div>

        {/* Bao-Zhuang Penalty Alert Card */}
        {settlement.baoZhuang ? (
          <div className="settlement-baozhuang-card">
            <div className="baozhuang-icon">⚠️</div>
            <div className="baozhuang-content">
              <div className="baozhuang-header-row">
                <b className="baozhuang-title">
                  判定包庄 · 【{getNickname(settlement.baoZhuang.payerSeat)}】{BAO_LABEL[settlement.baoZhuang.reason]}
                </b>
                <span className="baozhuang-total-badge">
                  一人包赔全桌: <b>{baoZhuangTotalPoints}分</b> {showMoney ? <b className="baozhuang-money-val">¥{baoZhuangTotalMoney}</b> : null}
                </span>
              </div>
              <p className="baozhuang-desc">
                {BAO_EXPLANATION[settlement.baoZhuang.reason]} 另外两家原本应向胡家支付的份额由【{getNickname(settlement.baoZhuang.payerSeat)}】全额代付{settlement.hunDi ? '；本局飘荤荤底（3份共90分）也全部由包庄者一人承担。' : '。'}
              </p>
              <div className="baozhuang-breakdown-row">
                <span className="baozhuang-sub-pill">
                  查胡分差包赔: <b>{chaHuPoints}分</b> {showMoney ? `(¥${chaHuMoney})` : ''}
                </span>
                {settlement.hunDi ? (
                  <span className="baozhuang-sub-pill hun">
                    荤底全包(3家): <b>90分</b> {showMoney ? `(¥${hunDiTotalMoney})` : ''}
                  </span>
                ) : null}
                <span className="baozhuang-sub-pill safe">
                  其余2位闲家: <b>0分免责 {showMoney ? '(¥0.0)' : ''}</b>
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Rate Converter Toolbar - Fixed Room Rate */}
        {!settlement.liuju ? (
          <div className="rate-toolbar">
            <div className="rate-presets">
              <span className="rate-label">🔒 底分单价:</span>
              <span className="rate-chip active locked">
                {roomRate > 0 ? `¥${roomRate} / 分 (开局已固定)` : '纯积分模式 (无单价)'}
              </span>
              {roomRate > 0 ? (
                <button
                  type="button"
                  className={`rate-chip ${!showMoney ? 'active' : ''}`}
                  onClick={() => setShowMoney((prev) => !prev)}
                >
                  {showMoney ? '切换为仅看计分' : '切换为展示金额'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Content Area */}
        <div className="settlement-body">
          {activeTab === 'replay' ? (
            <ReplayHands view={view} settlement={settlement} />
          ) : settlement.liuju ? (
            <div className="liuju-notice">
              <p>本局流局，不进行查胡结算与分数结算。</p>
            </div>
          ) : activeTab === 'summary' ? (
            <div className="summary-view">
              <table className="balance-table">
                <thead>
                  <tr>
                    <th>玩家</th>
                    <th>牌面胡/幺</th>
                    <th>总应收</th>
                    <th>总应付</th>
                    <th>本局净结余</th>
                    {showMoney ? <th>折算金额</th> : null}
                    <th>累计总分</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.scores.map((item) => {
                    const netMoney = (item.delta * ratePerPoint).toFixed(1);
                    return (
                      <tr key={item.seat} className={item.seat === settlement.winnerSeat ? 'winner' : ''}>
                        <td>
                          <span className="seat-badge">{SEAT_NAMES[item.seat]}</span>
                          <span className="player-name">{item.nickname}</span>
                          {item.isDealer ? <span className="tag-dealer">庄</span> : null}
                          {item.isWinner ? <span className="tag-winner">胡</span> : null}
                          {item.piaoHun ? <span className="tag-piao">飘</span> : null}
                          {item.isWinner && settlement.hunDi ? (
                            <span className="player-note-badge winner-hun">
                              🍲 收荤底 +90分 {showMoney ? `(+¥${hunDiTotalMoney})` : ''}
                            </span>
                          ) : null}
                          {settlement.baoZhuang && item.seat === settlement.baoZhuang.payerSeat ? (
                            <span className="player-note-badge baozhuang-payer">
                              💥 包赔全桌 -{baoZhuangTotalPoints}分 {showMoney ? `(-¥${baoZhuangTotalMoney})` : ''}
                            </span>
                          ) : settlement.baoZhuang && !item.isWinner ? (
                            <span className="player-note-badge baozhuang-exempt">
                              🛡️ 包庄免责 0分 {showMoney ? '(¥0.0)' : ''}
                            </span>
                          ) : !settlement.baoZhuang && settlement.hunDi && !item.isWinner ? (
                            <span className="player-note-badge loser-hun">
                              🍲 付荤底 -30分 {showMoney ? `(-¥${hunDiPerPlayerMoney})` : ''}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <b>{item.hu ?? 0}</b> 胡 / <b>{item.yao ?? 0}</b> 幺
                        </td>
                        <td className="up">
                          {item.receivable ? `+${item.receivable}` : '0'}
                        </td>
                        <td className="down">
                          {item.payable ? `-${item.payable}` : '0'}
                        </td>
                        <td className={`delta-cell ${item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : ''}`}>
                          <strong>{item.delta > 0 ? `+${item.delta}` : item.delta}</strong>
                        </td>
                        {showMoney ? (
                          <td className={`money-cell ${item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : ''}`}>
                            <strong>{item.delta > 0 ? `+¥${netMoney}` : item.delta < 0 ? `-¥${Math.abs(Number(netMoney))}` : '¥0.0'}</strong>
                          </td>
                        ) : null}
                        <td>{item.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="rule-note">
                <small>💡 结算顺序：先算飘荤后的胡差；涉及庄家时胡差整体×2。牌面胡数、幺差与荤底不因庄家规则直接改变。</small>
              </div>
            </div>
          ) : activeTab === 'ledger' ? (
            <div className="ledger-view">
              {settlement.baoZhuang ? (
                <div className="ledger-baozhuang-notice">
                  💡 <b>包庄对账说明：</b>本局触发【{BAO_LABEL[settlement.baoZhuang.reason]}】，以下流水展示四家牌面的原始两两对账过程。实际结余已由包庄清算引擎接管（点炮者一人全赔，无辜闲家彻底免责为0分），最终净得分以“查胡收付账单”为准。
                </div>
              ) : null}
              <div className="tx-grid">
                {(settlement.transactions ?? []).map((tx, idx) => {
                  const nameA = getNickname(tx.seatA);
                  const nameB = getNickname(tx.seatB);
                  const isDealerA = isDealer(tx.seatA);
                  const isDealerB = isDealer(tx.seatB);
                  const isPiaoA = isPiaoHun(tx.seatA);
                  const isPiaoB = isPiaoHun(tx.seatB);
                  const seatNameA = SEAT_NAMES[tx.seatA];
                  const seatNameB = SEAT_NAMES[tx.seatB];

                  const isTie = tx.points === 0;
                  const winnerName = tx.points > 0 ? nameA : nameB;
                  const loserName = tx.points > 0 ? nameB : nameA;
                  const winnerSeat = tx.points > 0 ? seatNameA : seatNameB;
                  const loserSeat = tx.points > 0 ? seatNameB : seatNameA;
                  const isWinnerDealer = tx.points > 0 ? isDealerA : isDealerB;
                  const isLoserDealer = tx.points > 0 ? isDealerB : isDealerA;
                  const winnerHu = tx.points > 0 ? tx.huA : tx.huB;
                  const winnerYao = tx.points > 0 ? tx.yaoA : tx.yaoB;
                  const loserHu = tx.points > 0 ? tx.huB : tx.huA;
                  const loserYao = tx.points > 0 ? tx.yaoB : tx.yaoA;
                  const winnerHuMultiplier = tx.points > 0 ? tx.huMultiplierA : tx.huMultiplierB;
                  const loserHuMultiplier = tx.points > 0 ? tx.huMultiplierB : tx.huMultiplierA;
                  const winnerEffectiveHu = tx.points > 0 ? tx.effectiveHuA : tx.effectiveHuB;
                  const loserEffectiveHu = tx.points > 0 ? tx.effectiveHuB : tx.effectiveHuA;

                  const absPoints = Math.abs(tx.points);
                  const absMoney = (absPoints * ratePerPoint).toFixed(1);

                  const multiplierLabels = [
                    tx.huMultiplierA > 1 ? `${seatNameA}${isPiaoA ? '飘' : ''}×${tx.huMultiplierA}` : null,
                    tx.huMultiplierB > 1 ? `${seatNameB}${isPiaoB ? '飘' : ''}×${tx.huMultiplierB}` : null,
                    tx.isDealerPair ? '涉及庄家：胡差×2' : null,
                  ].filter((label): label is string => Boolean(label));

                  return (
                    <div key={idx} className={`tx-flow-card ${tx.isDealerPair ? 'is-dealer-pair' : ''} ${isTie ? 'is-tie' : ''}`}>
                      {/* Main Transaction Transfer Row */}
                      <div className="tx-main-row">
                        {isTie ? (
                          <div className="tx-tie-wrap">
                            <div className="tx-party">
                              <span className="seat-badge">{seatNameA}</span>
                              <b className="party-name">{nameA}</b>
                              {isDealerA ? <span className="tag-dealer">庄</span> : null}
                              <span className="party-score">
                                ({tx.huA}胡{tx.huMultiplierA > 1 ? `×${tx.huMultiplierA}=${tx.effectiveHuA}` : ''}{tx.yaoA ? ` ${tx.yaoA}幺` : ''})
                              </span>
                            </div>
                            <span className="tx-tie-badge">双方平手 (0分)</span>
                            <div className="tx-party">
                              <span className="seat-badge">{seatNameB}</span>
                              <b className="party-name">{nameB}</b>
                              {isDealerB ? <span className="tag-dealer">庄</span> : null}
                              <span className="party-score">
                                ({tx.huB}胡{tx.huMultiplierB > 1 ? `×${tx.huMultiplierB}=${tx.effectiveHuB}` : ''}{tx.yaoB ? ` ${tx.yaoB}幺` : ''})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="tx-transfer-wrap">
                            {/* Winner Party */}
                            <div className="tx-party is-winner">
                              <span className="seat-badge">{winnerSeat}</span>
                              <b className="party-name">{winnerName}</b>
                              {isWinnerDealer ? <span className="tag-dealer">庄</span> : null}
                              <span className="party-score">
                                ({winnerHu}胡{winnerHuMultiplier > 1 ? `×${winnerHuMultiplier}=${winnerEffectiveHu}` : ''}{winnerYao ? ` ${winnerYao}幺` : ''})
                              </span>
                            </div>

                            {/* Arrow & Amount */}
                            <div className="tx-arrow-pill">
                              <span className="tx-arrow-label">收取</span>
                              <strong className="tx-points-val">+{absPoints}分</strong>
                              {showMoney ? <span className="tx-money-val">¥{absMoney}</span> : null}
                            </div>

                            {/* Loser Party */}
                            <div className="tx-party is-loser">
                              <span className="seat-badge">{loserSeat}</span>
                              <b className="party-name">{loserName}</b>
                              {isLoserDealer ? <span className="tag-dealer">庄</span> : null}
                              <span className="party-score">
                                ({loserHu}胡{loserHuMultiplier > 1 ? `×${loserHuMultiplier}=${loserEffectiveHu}` : ''}{loserYao ? ` ${loserYao}幺` : ''})
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Formula & Rule Footer */}
                      <div className="tx-formula-bar">
                        {multiplierLabels.length > 0 ? (
                          <span className="tx-mult-tag">{multiplierLabels.join(' · ')}</span>
                        ) : null}
                        <span className="tx-formula-text">
                          {tx.isDealerPair ? '(' : ''}
                          {nameA} {tx.huA}胡{tx.huMultiplierA > 1 ? `×${tx.huMultiplierA}=${tx.effectiveHuA}` : ''}
                          {' − '}{nameB} {tx.huB}胡{tx.huMultiplierB > 1 ? `×${tx.huMultiplierB}=${tx.effectiveHuB}` : ''}
                          {tx.isDealerPair ? ') ×2' : ''}
                          {` = ${tx.deltaHu > 0 ? '+' : ''}${tx.deltaHu}胡`}
                          {tx.deltaYao !== 0 ? ` · 幺差 ${tx.yaoA}−${tx.yaoB}=${tx.deltaYao > 0 ? '+' : ''}${tx.deltaYao}幺` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="breakdown-view">
              <div className="score-grid">
                <div>
                  <span>牌面胡数（倍率前）</span>
                  <strong>{settlement.hu} 胡</strong>
                </div>
                <div>
                  <span>幺数</span>
                  <strong>{settlement.yao} 幺</strong>
                </div>
                <div>
                  <span>庄家身份</span>
                  <strong>{settlement.dealerMultiplier === 2 ? '庄家（涉及胡差时胡差×2）' : '闲家'}</strong>
                </div>
                <div>
                  <span>本房牌面折算（倍率前）</span>
                  <strong>{settlement.hu + settlement.yao * 10} 分</strong>
                </div>
                {settlement.hunDi ? (
                  <div>
                    <span>飘荤荤底（3家共计）</span>
                    <strong style={{ color: '#fef08a' }}>+90 分 {showMoney ? `(¥${hunDiTotalMoney})` : ''}</strong>
                  </div>
                ) : null}
                {settlement.baoZhuang ? (
                  <div>
                    <span>包庄由点炮者全赔</span>
                    <strong style={{ color: '#fca5a5' }}>共 {baoZhuangTotalPoints} 分 {showMoney ? `(¥${baoZhuangTotalMoney})` : ''}</strong>
                  </div>
                ) : null}
              </div>
              <ul className="breakdown-list">
                {settlement.breakdown.map((item, index) => (
                  <li key={`${item.label}-${index}`}>
                    <span className="item-label">{item.label}</span>
                    <span className="item-val">+{item.hu}胡{item.yao ? ` +${item.yao}幺` : ''}</span>
                  </li>
                ))}
              </ul>
              {settlement.scores.some((item) => item.notes && item.notes.length > 0) ? (
                <div className="all-notes">
                  <h4>四家牌型明细</h4>
                  {settlement.scores.map((item) => (
                    <div key={item.seat} className="player-note-row">
                      <span className="seat-badge">{SEAT_NAMES[item.seat]}</span>
                      <b>{item.nickname}:</b>
                      <span>{(item.notes ?? []).join('，') || '无对子、碰、坎或杠'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="split slim settlement-actions">
          <button type="button" className="btn-action primary" disabled={alreadyReady} onClick={onAgain}>
            {alreadyReady ? '已准备，等朋友' : '再来一局'}
          </button>
          <button type="button" className="btn-action ghost" onClick={() => setMinimized(true)}>
            👁️ 查看牌桌
          </button>
          {onLeave ? (
            <button type="button" className="btn-action ghost" onClick={onLeave}>
              回大厅
            </button>
          ) : null}
        </div>
        <p className="hint settlement-ready">已准备 {readyCount}/4{alreadyReady ? ' · 你已准备' : ''}</p>
      </div>
    </div>
  );
}
