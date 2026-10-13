import assert from 'node:assert/strict';
import { test } from 'node:test';
import { settlementFixture } from './helpers/settlementFixture';
import { getSettlementPresentation, getTransactionPresentation } from '../src/views/settlement/presentation';

test('bao display uses payable instead of net delta and does not mutate score order', () => {
  const { view, settlement } = settlementFixture();
  const before = JSON.stringify(settlement);
  const model = getSettlementPresentation(view, settlement);
  assert.equal(model.baoZhuangTotalPoints, 120);
  assert.equal(model.baoZhuangTotalMoney, '24.0');
  assert.equal(model.hunDiTotalPoints, 90);
  assert.equal(model.chaHuPoints, 30);
  assert.equal(model.chaHuMoney, '6.0');
  assert.equal(model.maxDelta, 120);
  assert.deepEqual(model.sortedScores.map((s) => s.seat), [0, 3, 2, 1]);
  assert.equal(model.winningDiscardId, 'winning-tile');
  assert.equal(JSON.stringify(settlement), before);
});

test('point-only, self draw and draw keep their winner/rate fallbacks', () => {
  for (const rate of [0, -1]) {
    const { view, settlement } = settlementFixture('self', rate);
    const model = getSettlementPresentation(view, settlement);
    assert.equal(model.ratePerPoint, 0.1);
    assert.equal(model.winningDiscardId, undefined);
  }
  const { view, settlement } = settlementFixture('draw');
  const model = getSettlementPresentation(view, settlement);
  assert.equal(model.winnerPlayer, null);
  assert.deepEqual(model.winnerHand, []);
  assert.equal(model.drawText, '牌墙摸完流局');
});

test('legacy transactions keep dealer and raw-hu fallbacks and signed transfer direction', () => {
  const { settlement } = settlementFixture();
  const tx = settlement.transactions![1];
  const model = getTransactionPresentation(settlement, tx);
  assert.equal(model.winnerName, '西家');
  assert.equal(model.loserName, '胡家');
  assert.equal(model.absPoints, 4);
  assert.equal(model.rawDeltaHu, 3);
  assert.equal(model.piaoMultiplier, 1);
  assert.equal(model.dealerMultiplier, 1);
  assert.equal(model.settledDeltaHu, 3);
  assert.equal(model.deltaYao, -1);
  const explicit = getTransactionPresentation(settlement, settlement.transactions![0]);
  assert.equal(explicit.settledDeltaHu, 12);
  assert.equal(explicit.isDealerB, true);
  assert.equal(getTransactionPresentation(settlement, settlement.transactions![2]).isTie, true);
});
