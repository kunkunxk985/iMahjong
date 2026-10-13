import type { Settlement } from '@pizhou/shared';
import { SEAT_NAMES, getNickname, getTransactionPresentation } from './presentation';

type BillingProps = { settlement: Settlement; showMoney: boolean; ratePerPoint: number };

export function SettlementSummary({ settlement, showMoney, ratePerPoint }: BillingProps) {
  return (
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
                </td>
                <td>
                  <b>{item.hu ?? 0}</b> 胡 / <b>{item.yao ?? 0}</b> 幺
                </td>
                <td className="up">{item.receivable ? `+${item.receivable}` : '0'}</td>
                <td className="down">{item.payable ? `-${item.payable}` : '0'}</td>
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
    </div>

  );
}

export function SettlementLedger({ settlement }: { settlement: Settlement }) {
  return (
    <div className="ledger-view">
      {settlement.baoZhuang ? (
        <div className="settlement-ledger-note">
          <b>包庄说明：</b>下面六组是包庄前的两两查胡参考流水；实际收付已按包庄规则合并为【{getNickname(settlement, settlement.baoZhuang.payerSeat)}】一人承担，最终金额请以“查胡收付账单”为准。
        </div>
      ) : null}
      <div className="tx-grid">
        {(settlement.transactions ?? []).map((tx, idx) => {
          const { nameA, nameB, isDealerA, isDealerB, isTie, winnerName, loserName, winnerSeat, loserSeat, absPoints, rawDeltaHu, piaoMultiplier, dealerMultiplier, settledDeltaHu, deltaYao } = getTransactionPresentation(settlement, tx);

          return (
            <div key={idx} className={`tx-flow-card ${isTie ? 'is-tie' : ''}`}>
              <div className="tx-main-row">
                {isTie ? (
                  <div className="tx-tie-wrap">
                    <span>{nameA} 与 {nameB} 双方平手 (0分)</span>
                  </div>
                ) : (
                  <div className="tx-transfer-wrap">
                    <div className="tx-party is-winner">
                      <span className="seat-badge">{winnerSeat}</span>
                      <b>{winnerName}</b>
                      {(tx.points > 0 ? isDealerA : isDealerB) ? <span className="tag-dealer">庄</span> : null}
                    </div>
                    <div className="tx-arrow-pill">
                      <span className="tx-arrow-label">收取</span>
                      <strong className="tx-points-val">+{absPoints}分</strong>
                    </div>
                    <div className="tx-party is-loser">
                      <span className="seat-badge">{loserSeat}</span>
                      <b>{loserName}</b>
                      {(tx.points > 0 ? isDealerB : isDealerA) ? <span className="tag-dealer">庄</span> : null}
                    </div>
                  </div>
                )}
              </div>
              <div className="tx-formula-bar">
                <span className="tx-formula-text">
                  胡差 {rawDeltaHu} × {piaoMultiplier} × {dealerMultiplier} = {settledDeltaHu} 胡
                  {'；'}幺差 {deltaYao}（幺不翻）
                </span>
                <span className="tx-mult-tag">{piaoMultiplier > 1 ? '飘荤结算' : '普通结算'}</span>
                {dealerMultiplier > 1 ? <span className="tx-mult-tag">涉及庄家×2</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>

  );
}

export function SettlementBreakdown({ settlement }: { settlement: Settlement }) {
  return (
    <div className="breakdown-view">
      <ul className="breakdown-list">
        {settlement.breakdown.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span className="item-label">{item.label}</span>
            <span className="item-val">+{item.hu}胡{item.yao ? ` +${item.yao}幺` : ''}</span>
          </li>
        ))}
      </ul>
    </div>

  );
}
