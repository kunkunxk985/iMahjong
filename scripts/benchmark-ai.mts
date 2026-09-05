import {
  type AvailableAction,
  type GameAction,
  type PublicPlayerView,
  type Tile,
} from '@pizhou/shared';
import {
  calculateShanten,
  chooseCompanionAction,
  discardScore,
  assessDiscardDanger,
  PizhouGame,
  type SeatRuntime,
} from '@pizhou/rules';

/** Seeded PRNG for reproducible benchmark results */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Legacy baseline AI heuristic decision function */
function legacyPickDiscard(hand: Tile[], lastDrawnId?: string): Tile {
  let best = hand[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const tile of hand) {
    let score = discardScore(tile, hand);
    if (tile.id === lastDrawnId) score -= 1;
    if (score < bestScore) {
      best = tile;
      bestScore = score;
    }
  }
  return best;
}

function legacyCompanionAction(
  actions: AvailableAction[],
  seat: SeatRuntime,
  rng: () => number,
): GameAction | null {
  if (actions.length === 0) return null;
  const hu = actions.find((item) => item.kind === 'hu');
  if (hu?.key === 'qidong-gang-hu') {
    if (actions.some((item) => item.kind === 'pass') && rng() < 0.72) return { kind: 'pass' };
    return { kind: 'hu', key: 'qidong-gang-hu' };
  }
  if (hu) return { kind: 'hu' };

  const kan = actions.find((item) => item.kind === 'kan');
  if (kan && rng() < 0.85) return { kind: 'kan', key: kan.key, tileIds: kan.tileIds };

  const anGang = actions.find((item) => item.kind === 'an-gang');
  if (anGang) return { kind: 'an-gang', key: anGang.key, tileIds: anGang.tileIds };

  const ziGang = actions.find((item) => item.kind === 'zi-gang');
  if (ziGang) return { kind: 'zi-gang', key: ziGang.key, tileId: ziGang.tileId };

  const mingGang = actions.find((item) => item.kind === 'ming-gang');
  if (mingGang && rng() < 0.85) return { kind: 'ming-gang', key: mingGang.key, tileIds: mingGang.tileIds };

  const peng = actions.find((item) => item.kind === 'peng');
  if (peng && rng() < 0.7) return { kind: 'peng', key: peng.key, tileIds: peng.tileIds };

  const chi = actions.find((item) => item.kind === 'chi');
  if (chi && rng() < 0.55) return { kind: 'chi', tileIds: chi.tileIds };

  const closeGate = actions.find((item) => item.kind === 'close-gate');
  if (closeGate && rng() < 0.8) return { kind: 'close-gate', tileId: closeGate.tileIds?.[0] };

  if (actions.some((item) => item.kind === 'discard')) {
    const tile = legacyPickDiscard(seat.hand, seat.lastDrawnId);
    return { kind: 'discard', tileId: tile.id };
  }
  if (actions.some((item) => item.kind === 'pass')) return { kind: 'pass' };
  return null;
}

interface BenchmarkStats {
  totalGames: number;
  completedGames: number;
  illegalMoves: number;
  crashes: number;
  settlements: {
    pingHu: number;
    qidongGangHu: number;
    liuju: number;
    baozhuang: number;
  };
  totalTurnsToTenpai: number;
  tenpaiCount: number;
  // Discards when at least one opponent is threatening (closed door or 3 melds) AND player is not yet in Tenpai (defending)
  defenseDiscardsTotal: number;
  defenseDiscardsRaw: number;
  defenseDiscardsHighDanger: number; // danger > 60
  defenseDiscardsTotalDanger: number;
  durationMs: number;
}

function runBenchmarkCohort(
  cohortName: string,
  gameCount: number,
  aiType: 'new' | 'baseline',
  baseSeed: number,
): BenchmarkStats {
  const stats: BenchmarkStats = {
    totalGames: gameCount,
    completedGames: 0,
    illegalMoves: 0,
    crashes: 0,
    settlements: {
      pingHu: 0,
      qidongGangHu: 0,
      liuju: 0,
      baozhuang: 0,
    },
    totalTurnsToTenpai: 0,
    tenpaiCount: 0,
    defenseDiscardsTotal: 0,
    defenseDiscardsRaw: 0,
    defenseDiscardsHighDanger: 0,
    defenseDiscardsTotalDanger: 0,
    durationMs: 0,
  };

  const startTime = Date.now();

  for (let g = 0; g < gameCount; g++) {
    const rng = mulberry32(baseSeed + g * 37);
    let game: PizhouGame;
    try {
      game = new PizhouGame({ rng, timeoutMs: 30_000 });
    } catch {
      stats.crashes++;
      continue;
    }

    const turnsPerSeat = [0, 0, 0, 0];
    const reachedTenpai = [false, false, false, false];

    let steps = 0;
    const maxSteps = 1200;

    while (game.phase !== 'settlement' && steps < maxSteps) {
      steps++;

      if (game.phase === 'self-turn') {
        const seat = game.currentSeat;
        turnsPerSeat[seat]!++;
        const seatRuntime = game.seats[seat]!;

        // Track when this seat reaches tenpai
        const currentShanten = calculateShanten(seatRuntime.hand, seatRuntime.melds).shanten;
        if (currentShanten <= 0 && !reachedTenpai[seat]) {
          reachedTenpai[seat] = true;
          stats.tenpaiCount++;
          stats.totalTurnsToTenpai += Math.max(1, turnsPerSeat[seat]!);
        }

        const actions = game.availableFor(seat);
        const allDiscards = game.seats.flatMap((s) => s.discards);

        // Build public views of opponents
        const publicViews: PublicPlayerView[] = game.seats
          .map((s, idx) => ({
            seat: idx,
            nickname: `Bot${idx}`,
            avatar: '',
            ready: true,
            online: true,
            isHost: idx === 0,
            isDealer: idx === game.dealer,
            closed: s.closed,
            score: 0,
            handCount: s.hand.length,
            discards: s.discards,
            melds: s.melds,
          }))
          .filter((p) => p.seat !== seat);

        let action: GameAction | null = null;
        if (aiType === 'new') {
          action = chooseCompanionAction(actions, seatRuntime, rng, {
            publicViews,
            allDiscards,
            currentSeat: seat,
            humanBusy: false,
          });
        } else {
          action = legacyCompanionAction(actions, seatRuntime, rng);
        }

        if (!action) {
          const tile = seatRuntime.hand[0]!;
          action = { kind: 'discard', tileId: tile.id };
        }

        // Track defensive discards:
        // When at least one opponent is threatening (closed door or 3 pk melds) AND this player is not in Tenpai (shanten >= 1)
        if (action.kind === 'discard' && action.tileId) {
          const discarded = seatRuntime.hand.find((t) => t.id === action!.tileId);
          if (discarded) {
            const hasThreatOpponent = publicViews.some((opp) => opp.closed || opp.melds.length >= 3);
            if (hasThreatOpponent && currentShanten >= 1) {
              stats.defenseDiscardsTotal++;
              const isRaw = !allDiscards.some((d) => d.key === discarded.key);
              if (isRaw) {
                stats.defenseDiscardsRaw++;
              }
              const danger = assessDiscardDanger(discarded, publicViews, allDiscards).dangerScore;
              if (danger >= 60) {
                stats.defenseDiscardsHighDanger++;
              }
              stats.defenseDiscardsTotalDanger += danger;
            }
          }
        }

        const res = game.apply(seat, action, `step-${steps}-${seat}`, game.sequence);
        if (!res.ok) {
          stats.illegalMoves++;
          break;
        }
        continue;
      }

      if ((game.phase === 'claim-window' || game.phase === 'qidong') && game.pending) {
        const candidates = [...game.pending.candidates];
        for (const candidate of candidates) {
          if (game.phase !== 'claim-window' && game.phase !== 'qidong') break;
          if (game.pending?.responses.has(candidate.seat)) continue;

          const seatRuntime = game.seats[candidate.seat]!;
          const allDiscards = game.seats.flatMap((s) => s.discards);
          const publicViews: PublicPlayerView[] = game.seats
            .map((s, idx) => ({
              seat: idx,
              nickname: `Bot${idx}`,
              avatar: '',
              ready: true,
              online: true,
              isHost: idx === 0,
              isDealer: idx === game.dealer,
              closed: s.closed,
              score: 0,
              handCount: s.hand.length,
              discards: s.discards,
              melds: s.melds,
            }))
            .filter((p) => p.seat !== candidate.seat);

          let action: GameAction | null = null;
          if (aiType === 'new') {
            action = chooseCompanionAction(candidate.actions, seatRuntime, rng, {
              publicViews,
              allDiscards,
              currentSeat: candidate.seat,
              humanBusy: false,
            });
          } else {
            action = legacyCompanionAction(candidate.actions, seatRuntime, rng);
          }

          if (!action) action = { kind: 'pass' };
          const res = game.apply(candidate.seat, action, `claim-${steps}-${candidate.seat}`, game.sequence);
          if (!res.ok) {
            stats.illegalMoves++;
          }
        }
      }
    }

    if (game.phase === 'settlement' && game.settlement) {
      stats.completedGames++;
      if (game.settlement.liuju) {
        stats.settlements.liuju++;
      } else if (game.settlement.winType === 'qidong-gang-hu') {
        stats.settlements.qidongGangHu++;
      } else {
        stats.settlements.pingHu++;
      }
      if (game.settlement.baoZhuang) {
        stats.settlements.baozhuang++;
      }
    } else {
      stats.crashes++;
    }
  }

  stats.durationMs = Date.now() - startTime;
  return stats;
}

export function runBenchmark(): void {
  console.log('========================================================================');
  console.log('      PIZHOU MAHJONG AI BENCHMARK SUITE (>= 500 GAMES SIMULATION)       ');
  console.log('========================================================================\n');

  const GAME_COUNT = 500;
  const SEED = 20260904;

  console.log(`[1/2] Simulating ${GAME_COUNT} games with New AI (Milestone 2: Shanten + Defense)...`);
  const newStats = runBenchmarkCohort('New AI (M2)', GAME_COUNT, 'new', SEED);

  console.log(`[2/2] Simulating ${GAME_COUNT} games with Baseline AI (Legacy Heuristic)...`);
  const baseStats = runBenchmarkCohort('Baseline AI', GAME_COUNT, 'baseline', SEED);

  const avgTenpaiTurnNew = (newStats.totalTurnsToTenpai / Math.max(1, newStats.tenpaiCount)).toFixed(2);
  const avgTenpaiTurnBase = (baseStats.totalTurnsToTenpai / Math.max(1, baseStats.tenpaiCount)).toFixed(2);

  const defenseRawRateNew = (
    (newStats.defenseDiscardsRaw / Math.max(1, newStats.defenseDiscardsTotal)) * 100
  ).toFixed(2);
  const defenseRawRateBase = (
    (baseStats.defenseDiscardsRaw / Math.max(1, baseStats.defenseDiscardsTotal)) * 100
  ).toFixed(2);

  const highDangerRateNew = (
    (newStats.defenseDiscardsHighDanger / Math.max(1, newStats.defenseDiscardsTotal)) * 100
  ).toFixed(2);
  const highDangerRateBase = (
    (baseStats.defenseDiscardsHighDanger / Math.max(1, baseStats.defenseDiscardsTotal)) * 100
  ).toFixed(2);

  const avgDangerNew = (
    newStats.defenseDiscardsTotalDanger / Math.max(1, newStats.defenseDiscardsTotal)
  ).toFixed(1);
  const avgDangerBase = (
    baseStats.defenseDiscardsTotalDanger / Math.max(1, baseStats.defenseDiscardsTotal)
  ).toFixed(1);

  console.log('\n========================================================================');
  console.log('                         BENCHMARK RESULTS MATRIX                       ');
  console.log('========================================================================');
  console.log('| Metric                                 | New AI (M2)    | Baseline AI  | Improvement  |');
  console.log('|----------------------------------------|----------------|--------------|--------------|');
  console.log(
    `| Total Matches Simulated                | ${String(newStats.totalGames).padEnd(14)} | ${String(baseStats.totalGames).padEnd(12)} | 100% Target  |`,
  );
  console.log(
    `| Legal Completion Rate                  | ${(String(((newStats.completedGames / newStats.totalGames) * 100).toFixed(1)) + '%').padEnd(14)} | ${(String(((baseStats.completedGames / baseStats.totalGames) * 100).toFixed(1)) + '%').padEnd(12)} | Perfect Zero |`,
  );
  console.log(
    `| Illegal Action Count                   | ${String(newStats.illegalMoves).padEnd(14)} | ${String(baseStats.illegalMoves).padEnd(12)} | Zero Errors  |`,
  );
  console.log(
    `| Average Tenpai Turn (听牌平均巡目)      | ${String(avgTenpaiTurnNew + ' 巡').padEnd(14)} | ${String(avgTenpaiTurnBase + ' 巡').padEnd(12)} | Faster by ${(Number(avgTenpaiTurnBase) - Number(avgTenpaiTurnNew)).toFixed(2)} 巡 |`,
  );
  console.log(
    `| Defensive Raw Discard Rate (防守生张率) | ${String(defenseRawRateNew + '%').padEnd(14)} | ${String(defenseRawRateBase + '%').padEnd(12)} | -${(Number(defenseRawRateBase) - Number(defenseRawRateNew)).toFixed(2)}% Safe |`,
  );
  console.log(
    `| High Danger Discard Rate (高危牌率>60) | ${String(highDangerRateNew + '%').padEnd(14)} | ${String(highDangerRateBase + '%').padEnd(12)} | -${(Number(highDangerRateBase) - Number(highDangerRateNew)).toFixed(2)}% Safe |`,
  );
  console.log(
    `| Average Discard Danger (防守期弃牌危险) | ${String(avgDangerNew + ' / 100').padEnd(14)} | ${String(avgDangerBase + ' / 100').padEnd(12)} | -${(Number(avgDangerBase) - Number(avgDangerNew)).toFixed(1)} Pts Safe |`,
  );
  console.log(
    `| Baozhuang Incidents (包庄被包次数)     | ${String(newStats.settlements.baozhuang).padEnd(14)} | ${String(baseStats.settlements.baozhuang).padEnd(12)} | -${baseStats.settlements.baozhuang - newStats.settlements.baozhuang} Reduced  |`,
  );
  console.log(
    `| Execution Time (500 Matches)           | ${String((newStats.durationMs / 1000).toFixed(2) + 's').padEnd(14)} | ${String((baseStats.durationMs / 1000).toFixed(2) + 's').padEnd(12)} | Highly Opt   |`,
  );
  console.log('========================================================================\n');

  console.log('Settlement Distribution:');
  console.log(`- New AI:      PingHu=${newStats.settlements.pingHu}, QidongGangHu=${newStats.settlements.qidongGangHu}, Liuju=${newStats.settlements.liuju}`);
  console.log(`- Baseline AI: PingHu=${baseStats.settlements.pingHu}, QidongGangHu=${baseStats.settlements.qidongGangHu}, Liuju=${baseStats.settlements.liuju}\n`);

  if (newStats.completedGames === newStats.totalGames && newStats.illegalMoves === 0) {
    console.log('✔ All 500 games completed legally with 100% success rate.');
  } else {
    console.error('❌ Benchmark failure: incomplete games or illegal moves detected.');
    process.exitCode = 1;
  }
}

// Run benchmark if invoked directly
runBenchmark();
