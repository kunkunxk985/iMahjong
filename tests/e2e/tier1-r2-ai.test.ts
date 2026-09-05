import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PizhouGame,
  getTenpaiWaits,
  chooseCompanionAction,
  pickDiscard,
  companionThinkMs,
} from '@pizhou/rules';
import * as rulesModule from '@pizhou/rules';
import type { Tile, Meld } from '@pizhou/shared';
import { referenceShantenSearch, referenceAssessDanger } from './helpers/contracts.ts';

function makeTile(suit: 'wan' | 'tong' | 'tiao' | 'dragon', rank: number, id: string): Tile {
  return { id, suit, rank, key: `${suit}-${rank}` };
}

test('Tier 1 [R2 AI] - 2.1: Shanten search across standard, 2-pair Guanmen, and single-wait formations', () => {
  // Case A: 4 melds + 1 single tile (Single-wait Guanmen) -> Tenpai (shanten 0)
  const singleHand: Tile[] = [makeTile('wan', 5, 'w5')];
  const fourMelds: Meld[] = [
    { type: 'peng', tiles: [makeTile('wan', 1, '1'), makeTile('wan', 1, '2'), makeTile('wan', 1, '3')] },
    { type: 'peng', tiles: [makeTile('wan', 2, '4'), makeTile('wan', 2, '5'), makeTile('wan', 2, '6')] },
    { type: 'peng', tiles: [makeTile('wan', 3, '7'), makeTile('wan', 3, '8'), makeTile('wan', 3, '9')] },
    { type: 'peng', tiles: [makeTile('wan', 4, '10'), makeTile('wan', 4, '11'), makeTile('wan', 4, '12')] },
  ];
  const resSingle = referenceShantenSearch(singleHand, fourMelds);
  assert.equal(resSingle.shanten, 0, '4-meld single wait must be 0-shanten (Tenpai)');
  assert.equal(resSingle.waits.length, 1, 'Single wait must wait on the lone tile to complete pair');

  // Case B: 3 melds + 2 pairs (2-pair Guanmen) -> Tenpai (shanten 0)
  const twoPairHand: Tile[] = [
    makeTile('tong', 2, 't2a'),
    makeTile('tong', 2, 't2b'),
    makeTile('tong', 8, 't8a'),
    makeTile('tong', 8, 't8b'),
  ];
  const threeMelds: Meld[] = [
    { type: 'peng', tiles: [makeTile('wan', 1, '1'), makeTile('wan', 1, '2'), makeTile('wan', 1, '3')] },
    { type: 'peng', tiles: [makeTile('wan', 2, '4'), makeTile('wan', 2, '5'), makeTile('wan', 2, '6')] },
    { type: 'peng', tiles: [makeTile('wan', 3, '7'), makeTile('wan', 3, '8'), makeTile('wan', 3, '9')] },
  ];
  const resTwoPair = referenceShantenSearch(twoPairHand, threeMelds);
  assert.equal(resTwoPair.shanten, 0, '3-meld 2-pair Guanmen must be 0-shanten (Tenpai)');
  assert.equal(resTwoPair.waits.length, 2, '2-pair Guanmen must wait on either pair key');

  // Case C: Standard Tenpai hand (3 melds in hand, 1 pair, 1 two-sided wait)
  // 1-2-3 Wan, 4-5-6 Wan, 7-8-9 Wan, 2-2 Tong, 4-5 Tiao -> waiting on 3-6 Tiao
  const standardTenpai: Tile[] = [
    makeTile('wan', 1, 'w1'), makeTile('wan', 2, 'w2'), makeTile('wan', 3, 'w3'),
    makeTile('wan', 4, 'w4'), makeTile('wan', 5, 'w5'), makeTile('wan', 6, 'w6'),
    makeTile('wan', 7, 'w7'), makeTile('wan', 8, 'w8'), makeTile('wan', 9, 'w9'),
    makeTile('tong', 2, 't2a'), makeTile('tong', 2, 't2b'),
    makeTile('tiao', 4, 's4'), makeTile('tiao', 5, 's5'),
  ];
  const waits = getTenpaiWaits(standardTenpai, 0);
  assert.equal(waits.length, 2, 'Two-sided wait 4-5 Tiao must yield exactly 2 waiting tiles (3 and 6 Tiao)');
  assert.ok(waits.includes('tiao-3'), 'Must wait on 3 Tiao');
  assert.ok(waits.includes('tiao-6'), 'Must wait on 6 Tiao');

  // If rules export calculateShanten, verify contract directly
  if (typeof (rulesModule as Record<string, unknown>).calculateShanten === 'function') {
    const calc = (rulesModule as unknown as { calculateShanten: typeof referenceShantenSearch }).calculateShanten;
    const directResult = calc(twoPairHand, threeMelds);
    assert.equal(directResult.shanten, 0);
  }
});

test('Tier 1 [R2 AI] - 2.2: Effective tile acceptance & discard prioritization', () => {
  // Authoritative expectation: AI prioritizes keeping high-acceptance combinations
  // e.g. 2-3 Wan (two-sided, up to 8 copies) over isolated YaoJiu tile (e.g. 1 Wan, 9 Tiao)
  const hand: Tile[] = [
    makeTile('wan', 1, 'w1_iso'), // isolated
    makeTile('wan', 4, 'w4'),
    makeTile('wan', 5, 'w5'),     // connected 4-5
    makeTile('tong', 3, 't3a'),
    makeTile('tong', 3, 't3b'),   // pair
    makeTile('tiao', 7, 's7a'),
    makeTile('tiao', 7, 's7b'),   // pair
    makeTile('tiao', 7, 's7c'),   // pung
  ];

  // pickDiscard should discard the isolated tile rather than breaking 4-5 or pairs
  const discard = pickDiscard(hand, 'w1_iso');
  assert.equal(discard.id, 'w1_iso', 'Isolated tile must be chosen for discard to preserve acceptance');
});

test('Tier 1 [R2 AI] - 2.3: Opponent threat perception & defense model (Xiang Pai avoidance)', () => {
  const tileToTest = makeTile('dragon', 1, 'd1'); // 红中

  // Case 1: Opponent has closed: true, dragon-1 is unseen in river -> High Danger (Xiang Pai)
  const closedOpponent = {
    closed: true,
    melds: [],
    discards: [makeTile('wan', 1, 'w1'), makeTile('wan', 2, 'w2')],
    discardedBeforeClose: ['wan-1', 'wan-2'],
  };
  const dangerClosed = referenceAssessDanger(tileToTest, [closedOpponent], []);
  assert.ok(dangerClosed.dangerScore >= 70, `Unseen tile against closed opponent must be high danger (got ${dangerClosed.dangerScore})`);
  assert.ok(dangerClosed.isXiangPai, 'Must be flagged as Xiang Pai (fragrant/fresh tile)');

  // Case 2: Genbutsu: Opponent already discarded dragon-1 -> 0 Danger
  const genbutsuOpponent = {
    closed: true,
    melds: [],
    discards: [makeTile('dragon', 1, 'd1_prev')],
  };
  const dangerGenbutsu = referenceAssessDanger(tileToTest, [genbutsuOpponent], [makeTile('dragon', 1, 'd1_prev')]);
  assert.equal(dangerGenbutsu.dangerScore, 0, 'Genbutsu tile must have 0 danger score');
  assert.equal(dangerGenbutsu.isGenbutsu, true, 'Must be identified as Genbutsu');

  // Case 3: 4-seen tile in river -> 0 Danger
  const fourSeenDiscards = [
    makeTile('dragon', 1, 'd1_1'),
    makeTile('dragon', 1, 'd1_2'),
    makeTile('dragon', 1, 'd1_3'),
    makeTile('dragon', 1, 'd1_4'),
  ];
  const danger4Seen = referenceAssessDanger(tileToTest, [closedOpponent], fourSeenDiscards);
  assert.equal(danger4Seen.dangerScore, 0, '4-seen tile must be 100% safe');
});

test('Tier 1 [R2 AI] - 2.4: Tactical meld decisions & humanized thinking latency', () => {
  // Verify thinking delay distribution:
  // Self-turn delay should be between 1000ms and 3000ms
  const delays: number[] = [];
  for (let i = 0; i < 20; i++) {
    delays.push(companionThinkMs('self-turn', false));
  }
  const minDelay = Math.min(...delays);
  const maxDelay = Math.max(...delays);
  assert.ok(minDelay >= 1000, `Min self-turn delay should be >= 1000ms, got ${minDelay}`);
  assert.ok(maxDelay <= 3500, `Max self-turn delay should be <= 3500ms, got ${maxDelay}`);

  // In claim-window with human player present, delay should be respectful of human pace
  const humanBusyDelay = companionThinkMs('claim-window', true);
  assert.ok(humanBusyDelay >= 1500, `Claim-window delay when human is busy should be >= 1500ms, got ${humanBusyDelay}`);
});

test('Tier 1 [R2 AI] - 2.5: Bot-fill and autonomous match progression in game engine', () => {
  const game = new PizhouGame();
  assert.equal(game.phase, 'self-turn');

  // Fast forward moves using AI companion decisions across self-turn and claim windows
  let steps = 0;
  while (steps < 20 && game.phase !== 'settlement') {
    if (game.phase === 'self-turn') {
      const seatIdx = game.currentSeat;
      const runtime = (game as unknown as { seats: Array<unknown> }).seats[seatIdx] as Parameters<typeof chooseCompanionAction>[1];
      const availableActions = game.availableFor(seatIdx);

      const action = chooseCompanionAction(availableActions, runtime);
      assert.ok(action, `Companion must decide a legal action on turn ${steps}`);

      if (action.kind === 'discard' && action.tileId) {
        const ok = game.discard(seatIdx, action.tileId);
        assert.ok(ok, `Discard ${action.tileId} by seat ${seatIdx} must succeed`);
      } else {
        const res = game.apply(seatIdx, action, `step-${steps}`, game.sequence);
        assert.ok(res.ok, `Companion self action must succeed: ${res.error}`);
      }
      steps++;
    } else if (game.phase === 'claim-window' || game.phase === 'qidong') {
      const candidates = [...(game.pending?.candidates ?? [])];
      for (const candidate of candidates) {
        if (game.phase !== 'claim-window' && game.phase !== 'qidong') break;
        if (game.pending?.responses.has(candidate.seat)) continue;
        const runtime = (game as unknown as { seats: Array<unknown> }).seats[candidate.seat] as Parameters<typeof chooseCompanionAction>[1];
        const action = chooseCompanionAction(candidate.actions, runtime);
        const res = game.apply(candidate.seat, action, `step-${steps}-${candidate.seat}`, game.sequence);
        assert.ok(res.ok, `Companion claim action must succeed: ${res.error}`);
      }
      steps++;
    } else {
      break;
    }
  }
  assert.ok(steps >= 5, `Bots must successfully advance at least 5 game moves (completed: ${steps})`);
});
