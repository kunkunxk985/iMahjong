import { useState } from 'react';
import type { BaoZhuangReason, PairwiseTransaction, Settlement, SettlementScore } from '@pizhou/shared';

const SEAT_NAMES = ['东', '南', '西', '北'] as const;

const WIN_LABEL: Record<string, string> = {
  'ping-hu': '平胡',
  'qidong-gang-hu': '起手杠胡',
  liuju: '流局',
};

const BAO_LABEL: Record<BaoZhuangReason, string> = {
  four_wait_seq: '四坎听顺包庄',
  chow_wait_seq: '吃牌听顺包庄',
  xiang: '香牌包庄',
};

const DRAW_LABEL: Record<string, string> = {
  four_same: '开局四同张流局',
  wall: '牌墙摸完流局',
};

export function SettlementModal({
  settlement,
  onAgain,
  onLeave,
  readyCount,
  alreadyReady = false,
}: {
  settlement: Settlement;
  onAgain: () => void;
  onLeave?: () => void;
  readyCount: number;
  alreadyReady?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'breakdown'>('summary');
  const [ratePerPoint, setRatePerPoint] = useState<number>(0.1);
  const [showMoney, setShowMoney] = useState<boolean>(false);

  const bao = settlement.baoZhuang
    ? BAO_LABEL[settlement.baoZhuang.reason]
    : null;
  const drawText = settlement.drawReason ? DRAW_LABEL[settlement.drawReason] ?? settlement.drawReason : null;

  const getNickname = (seat: number) => {
    const found = settlement.scores.find((s) => s.seat === seat);
    return found?.nickname || `${SEAT_NAMES[seat]}家`;
  };

  const isDealer = (seat: number) => {
    const found = settlement.scores.find((s) => s.seat === seat);
    return Boolean(found?.isDealer);
  };

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
        </header>

        {/* Tab Switcher */}
        {!settlement.liuju ? (
          <div className="settlement-tabs">
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
          </div>
        ) : null}

        {/* Rate Converter Toolbar */}
        {!settlement.liuju ? (
          <div className="rate-toolbar">
            <div className="rate-presets">
              <span className="rate-label">折算单价:</span>
              {[0.1, 0.2, 0.5, 1].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={`rate-chip ${ratePerPoint === rate && showMoney ? 'active' : ''}`}
                  onClick={() => {
                    setRatePerPoint(rate);
                    setShowMoney(true);
                  }}
                >
                  ¥{rate}/分
                </button>
              ))}
              <button
                type="button"
                className={`rate-chip ${!showMoney ? 'active' : ''}`}
                onClick={() => setShowMoney(false)}
              >
                仅看计分
              </button>
            </div>
          </div>
        ) : null}

        {/* Content Area */}
        <div className="settlement-body">
          {settlement.liuju ? (
            <div className="liuju-notice">
              <p>本局流局，不进行查胡结算与分数结算。</p>
            </div>
          ) : activeTab === 'summary' ? (
            <div className="summary-view">
              <table className="balance-table">
                <thead>
                  <tr>
                    <th>玩家</th>
                    <th>基础胡/幺</th>
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
                <small>💡 计分说明：四家基础胡数平等计算；两两结算时庄闲差胡翻倍（幺不翻倍），闲闲结算差胡不翻倍。</small>
              </div>
            </div>
          ) : activeTab === 'ledger' ? (
            <div className="ledger-view">
              <div className="tx-list">
                {(settlement.transactions ?? []).map((tx, idx) => {
                  const nameA = getNickname(tx.seatA);
                  const nameB = getNickname(tx.seatB);
                  const isDealerA = isDealer(tx.seatA);
                  const isDealerB = isDealer(tx.seatB);
                  const seatNameA = SEAT_NAMES[tx.seatA];
                  const seatNameB = SEAT_NAMES[tx.seatB];

                  const winnerName = tx.points > 0 ? nameA : tx.points < 0 ? nameB : null;
                  const loserName = tx.points > 0 ? nameB : tx.points < 0 ? nameA : null;
                  const winSeat = tx.points > 0 ? seatNameA : seatNameB;
                  const loseSeat = tx.points > 0 ? seatNameB : seatNameA;
                  const absPoints = Math.abs(tx.points);
                  const absMoney = (absPoints * ratePerPoint).toFixed(1);

                  return (
                    <div key={idx} className={`tx-card ${tx.isDealerPair ? 'dealer-pair' : ''}`}>
                      <div className="tx-header">
                        <div className="tx-player">
                          <span className="seat-badge">{seatNameA}</span>
                          <b>{nameA}</b>
                          {isDealerA ? <span className="tag-dealer">庄</span> : null}
                          <span className="player-hu">({tx.huA}胡 {tx.yaoA}幺)</span>
                        </div>
                        <span className="tx-vs">VS</span>
                        <div className="tx-player">
                          <span className="seat-badge">{seatNameB}</span>
                          <b>{nameB}</b>
                          {isDealerB ? <span className="tag-dealer">庄</span> : null}
                          <span className="player-hu">({tx.huB}胡 {tx.yaoB}幺)</span>
                        </div>
                      </div>

                      <div className="tx-formula">
                        <span className="formula-tag">{tx.isDealerPair ? '庄闲对账 (差胡×2)' : '闲闲对账 (差胡×1)'}</span>
                        <span className="formula-text">
                          差胡: {Math.abs(tx.huA - tx.huB)} {tx.isDealerPair ? '×2' : '×1'} = {Math.abs(tx.deltaHu)}分
                          {tx.deltaYao !== 0 ? ` | 差幺: ${Math.abs(tx.deltaYao)}×10 = ${Math.abs(tx.deltaYao) * 10}分` : ''}
                        </span>
                      </div>

                      <div className="tx-result">
                        {tx.points === 0 ? (
                          <span className="result-tie">双方平手（0分）</span>
                        ) : (
                          <span className="result-flow">
                            【{winSeat}】<b>{winnerName}</b> 向 【{loseSeat}】<b>{loserName}</b> 收取{' '}
                            <strong className="up">+{absPoints}分</strong>
                            {showMoney ? <em className="money-tag">(¥{absMoney})</em> : null}
                          </span>
                        )}
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
                  <span>胡牌基础</span>
                  <strong>{settlement.hu} 胡</strong>
                </div>
                <div>
                  <span>幺数</span>
                  <strong>{settlement.yao} 幺</strong>
                </div>
                <div>
                  <span>庄家身份</span>
                  <strong>{settlement.dealerMultiplier === 2 ? '庄家(两两结差胡×2)' : '闲家'}</strong>
                </div>
                <div>
                  <span>牌面单体分</span>
                  <strong>{settlement.hu + settlement.yao * 10} 分</strong>
                </div>
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
                      <span>{(item.notes ?? []).join('，') || '无坎对'}</span>
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
