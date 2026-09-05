# E2E Testing Infrastructure (TEST_INFRA)

## 1. Overview & Objectives

The End-to-End (E2E) test suite for **Pizhou Mahjong (邳州麻将)** provides opaque-box, requirement-driven automated verification across all game systems, protocols, and deployment environments. It covers:
- **R1: Physical Audio & Dialect Voice Acting** (sampled WAV physical SFX, Mandarin & Pizhou dialect voice acting, sound manager pipeline, volume & mute persistence, legacy synthesis decommissioning).
- **R2: High-Level AI Companion & Game Rules** (Shanten search algorithms, effective tile acceptance, opponent threat perception & incense/Guanmen defense, tactical melds, humanized thinking latency, multiplayer bot-fill).
- **R3: Server HA, Snapshot Persistence & Resilience** (pure data game serialization, DiskRoomStore atomic snapshot persistence and crash recovery, full-duplex WebSocket ping/pong, heartbeat sweeps, resilient client reconnection with 100% desk state alignment, anti-cheat sequence verification and rate limiting).

---

## 2. Infrastructure Architecture

### 2.1 Test Runner & Execution Stack
- **Native Test Runner**: Node.js built-in test runner (`node:test`) executed via `node --import tsx --test`.
- **Zero Heavy Harness**: Does not require heavy browser emulators for core protocol, game engine, and server verification; uses real native WebSocket connections and headless audio pipeline contract validators.
- **Single-Command Invocation**:
  ```bash
  node --import tsx --test tests/e2e/*.test.ts
  ```

### 2.2 Directory Layout
```
tests/e2e/
├── helpers/
│   ├── test-harness.ts        # Ephemeral port allocator, WebSocket test client bot, server lifecycle
│   └── contracts.ts           # Spec definitions, RIFF WAV header validator, game state checkers
├── tier1-r1-audio.test.ts     # Tier 1: Feature coverage for R1 Audio & Voice
├── tier1-r2-ai.test.ts        # Tier 1: Feature coverage for R2 AI Companion & Rules
├── tier1-r3-server.test.ts    # Tier 1: Feature coverage for R3 Server HA & Persistence
├── tier2-boundaries.test.ts   # Tier 2: Boundary and corner cases across R1, R2, R3
├── tier3-combinations.test.ts # Tier 3: Cross-feature pairwise & composite integrations
└── tier4-scenarios.test.ts    # Tier 4: Real-world match and disaster recovery simulations
```

### 2.3 Layer Isolation & Ephemeral Networking
- **Dynamic Port Allocation**: Every server test suite allocates a unique, available port (range 20000–30000) using `getAvailablePort()` to prevent port contention during sequential or parallel test execution.
- **Isolated State Directories**: File persistence tests write to ephemeral directories (e.g. `.pizhou-state-test-<pid>-<random>/`) and clean up after test completion.
- **No Production Mutation**: E2E tests interact strictly via public WebSocket protocol (`C2SMessage` / `S2CMessage`), public exported engine functions, and file system outputs.

---

## 3. The 4-Tier Test Matrix

| Tier | Name | Target Scope | Minimum Test Count | Description |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage | R1, R2, R3 | >= 5 tests per feature (15 total) | Verifies standard primary behavior (happy path) for all functional requirements against specifications. |
| **Tier 2** | Boundary & Corner Cases | R1, R2, R3 | >= 5 tests per feature (15 total) | Verifies extreme boundaries, empty states, 4-seen tiles, volume limits, network drops, packet floods, and error handling. |
| **Tier 3** | Cross-Feature Combinations | Pairwise & Triad | >= 5 tests | Verifies cross-system interactions (e.g., AI action triggering audio dispatch, bot execution surviving server crash recovery, audio settings sync across reconnects). |
| **Tier 4** | Real-World Application Scenarios | Complete Match Simulations | >= 5 simulations | Full-lifecycle real-world matches: 4-player games, high-stakes Guanmen/Baozhuang showdowns, disaster recovery, weak network stress, and solo bot games. |

---

## 4. Test Execution Guide

### 4.1 Run the Full E2E Test Suite
```bash
node --import tsx --test tests/e2e/*.test.ts
```

### 4.2 Run Specific Tiers
```bash
# Tier 1: Feature coverage
node --import tsx --test tests/e2e/tier1-*.test.ts

# Tier 2: Boundary & Corner cases
node --import tsx --test tests/e2e/tier2-boundaries.test.ts

# Tier 3: Cross-Feature combinations
node --import tsx --test tests/e2e/tier3-combinations.test.ts

# Tier 4: Real-World match scenarios
node --import tsx --test tests/e2e/tier4-scenarios.test.ts
```

### 4.3 CI & Architecture Verification
The E2E suite runs in harmony with the project's standard quality gates:
```bash
npm run check:architecture  # Verifies layer boundaries and static assets
npm run typecheck           # TypeScript strict verification
npm test                    # Workspace unit tests
npm run smoke               # Local smoke test
```

---

## 5. Authoritative Expected Output Derivation

1. **Audio Integrity**: Expected PCM format is derived directly from the audio pipeline contract: standard RIFF/WAVE header, 16-bit little-endian, sample rate >= 22.05kHz, non-zero audio payload.
2. **AI & Shanten Rules**: Expected Shanten and tenpai counts are mathematically derived from standard Pizhou Mahjong rules: standard 4-meld 1-pair formula $2(M_{target}-M)-\min(M_{target}-M,T)-P$, Pizhou 2-pair Guanmen ($M=0, P=1, T=1 \implies \text{shanten}=0$), and single-wait Guanmen ($\text{shanten}=0$).
3. **Server State Serialization**: Expected roundtrip equivalence is verified by asserting deep equality on `seat.hand`, `seat.melds`, `wall`, `dealer`, `sequence`, and confirming that subsequent state transitions on deserialized engines match the original engine.
4. **Resilience & Reconnection**: Expected desk alignment requires 100% preservation of seat index, hand cards, public melds, wall count, active turn, available actions, and sequence numbers.
