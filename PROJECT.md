# Project: iMahjong · Pizhou Mahjong Production Overhaul & Aesthetic Rebirth

## Architecture
- **Layer Boundaries**:
  - `packages/shared`: Shared constants, protocol events, types, rank & achievement ladders (`rank.ts`), pure utils. Zero Node builtins (`forbidNodeBuiltins: true`).
  - `packages/rules`: Pure game rules engine, Shanten search, tile acceptance, defense assessment, companion AI, and game state serialization/deserialization. Zero Node builtins (`forbidNodeBuiltins: true`).
  - `packages/server-core`: HTTP Router (`httpRouter.ts`), Account Store (`AccountStore`, `DiskAccountStore` at `.pizhou-state/accounts/`), Room management, disk snapshot persistence (`DiskRoomStore`), WebSocket server, heartbeats, bot execution, rate limiting.
  - `apps/server`: Standalone Node.js server entry point exposing WebSocket + HTTP `/api/*` routes.
  - `apps/desktop`: Electron + Vite + React desktop client with Web Audio sound manager, settings, 2.5D jade table with zero-occlusion FX, Oriental Lobby, Guofeng Profile & Career Stats, and Canvas Battle Report Poster.
  - `packages/worker`: Cloudflare Worker DO backend (shared protocol/db).
- **Dual Track Organization**:
  - **Implementation Track**:
    - Milestone 1: Account Security, Server REST Endpoints & Multi-Device Roaming (R1)
    - Milestone 2: Guofeng Avatars, Profile Modal, Career Stats & Achievement Ladder (R2)
    - Milestone 3: 2.5D Jade Mahjong Tiles & Zero-Occlusion Action FX Safe-Zones (R3)
    - Milestone 4: Oriental Lobby Redesign & Shenghun Settle Canvas Poster (R4)
    - Milestone 5: E2E Integration, Architecture Checks, Full Test Suite & macOS Packaging
  - **E2E Testing Track**: Test Infra, Tiers 1-4 requirement-driven test cases, publishes `TEST_READY.md`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Natural Physical Sound Assets | 16 natural sampled WAV sound effects | M1-Legacy | Initial Req |
| 2 | Dialect & Mandarin Voice Packs | 78 authentic broadcast WAV voice clips | M1-Legacy | Initial Req |
| 3 | SoundManager & Audio Pipeline | Web Audio buffer caching, GainNode 3-channel volume control | M1-Legacy | Initial Req |
| 4 | Volume & Settings Controls | Persistent localStorage audio settings, multi-channel volume sliders | M1-Legacy | Initial Req |
| 5 | Legacy Audio Decommissioning | 100% elimination of oscillator white noise and speechSynthesis | M1-Legacy | Initial Req |
| 6 | Shanten Search Algorithm | Pure TS recursive/memoized Shanten search for standard & Pizhou hands | M2-Legacy | Initial Req |
| 7 | Effective Tile Acceptance | Calculate effective tiles and remaining copies to maximize advancement | M2-Legacy | Initial Req |
| 8 | Defensive Discard & Danger Model | Opponent closed door & 3-meld incense perception, genbutsu/dead-tile defense | M2-Legacy | Initial Req |
| 9 | Tactical Melds & Humanized Delay | Strategic chi/peng/guanmen decision logic, adaptive thinking delay | M2-Legacy | Initial Req |
| 10 | Bot-Fill for Online Rooms | Seamless bot substitution in multiplayer rooms | M2-Legacy | Initial Req |
| 11 | 500-Game AI Benchmark Suite | Automated benchmark script testing >=500 matches and tenpai speed | M2-Legacy | Initial Req |
| 12 | Pure Data Game Serialization | `serializeGame` and `deserializeGame` in `@pizhou/rules` without Node builtins | M3-Legacy | Initial Req |
| 13 | Disk Snapshot Persistence | `DiskRoomStore` in `@pizhou/server-core` with atomic file writes & crash recovery | M3-Legacy | Initial Req |
| 14 | Active Heartbeat & Dead Socket Cleanup | Full-duplex WebSocket ping/pong, heartbeat sweep closing dead sockets | M3-Legacy | Initial Req |
| 15 | Resilient Client Reconnection | Exponential reconnect backoff with random jitter, ping watchdog, desk alignment | M3-Legacy | Initial Req |
| 16 | Anti-Cheat & Security Hardening | 64KB maxPayload, sliding-window rate limiters, flood control | M3-Legacy | Initial Req |
| 17 | Server REST Endpoints & HTTP Router | Move/unify REST router in `@pizhou/server-core` so Node server & desktop localServer support `/api/auth/*`, `/api/profile`, `/api/matches` | M1 | Follow-up R1 |
| 18 | DiskAccountStore Atomic Persistence | Atomic file persistence for accounts, sessions, profiles, and matches under `.pizhou-state/accounts/` | M1 | Follow-up R1 |
| 19 | WebCrypto PBKDF2 Password Security | Salted PBKDF2-HMAC-SHA256 (120k iter), constant-time comparison, safe password storage | M1 | Follow-up R1 |
| 20 | Multi-Device Sessions & Silent Renewal | Multi-session support per user (up to 10), 30-day sliding window, `/api/auth/renew` silent refresh | M1 | Follow-up R1 |
| 21 | Clean Logout & Credential Revocation | Active logout cleanly resets client to fresh guest; password change revokes all other active sessions | M1 | Follow-up R1 |
| 22 | Isolated User Match History & Roaming | Local history partitioned by `userId`, automatic sync/merge between solo/online and cloud | M1 | Follow-up R1 |
| 23 | 12 Guofeng Oriental Vector Avatars | Curated SVG vector avatars (`GuofengAvatar.tsx`, `AvatarView.tsx`) with zero latency & lore | M2 | Follow-up R2 |
| 24 | Real-time Profile & Signature Sync | Real-time nickname & bio editing, instant propagation to room waiting lobby, player popovers & table seats | M2 | Follow-up R2 |
| 25 | Career Statistics & Fan Type Dashboard | Enriched stats dashboard: games, win-rate gauge, fan types (平胡, 自摸, 起手杠胡, 飘荤, 关门, 包庄), max win | M2 | Follow-up R2 |
| 26 | 9-Tier Rank Badges & 15 Achievements | Rating Points (RP) rank ladder and 15 milestone achievements defined in `packages/shared/src/rank.ts` | M2 | Follow-up R2 |
| 27 | 2.5D Mutton-Fat White Jade Mahjong Tiles | Translucent jade face, top chamfer highlight, ivory-to-emerald sandwich bevels, imperial jade back | M3 | Follow-up R3 |
| 28 | Tile Physics Micro-Floating Interactions | Damped spring hover, selected lift, ambient contact shadow, and breathing hover on drawn tile | M3 | Follow-up R3 |
| 29 | 4-Quadrant Zero-Occlusion Safe-Zone FX | Mid-ground diagonal safe zones ($Q_{SW}, Q_{SE}, Q_{NW}, Q_{NE}$) for action seals (碰/吃/杠/关门/胡), 100% zero occlusion | M3 | Follow-up R3 |
| 30 | Multi-Resolution & Window Scale Adaptive Table | Viewport-safe layout preserving layer order and clarity across window sizes | M3 | Follow-up R3 |
| 31 | Oriental Aesthetic Guofeng Lobby | Frosted jade lacquer top nav, gold currency pill, 6-digit segmented room PIN join, brand accents | M4 | Follow-up R4 |
| 32 | Shenghun-Style Settlement Screen | High-aesthetic post-match card, 4-player ranking cards, MVP crest, winning hand decomposition tray | M4 | Follow-up R4 |
| 33 | High-DPI Canvas Battle Report Poster | Off-screen Canvas 2D generator (`canvasPoster.ts`), clean 2x Retina PNG export with room info & timestamps | M4 | Follow-up R4 |
| 34 | Full Verification, Build & Packaging | 100% pass on architecture checks, typecheck, unit tests, smoke tests, production build, and macOS packaging | M5 | Follow-up Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Account Security & Cloud Roaming | Features 17-22: Server-core REST router, DiskAccountStore, PBKDF2 auth, multi-session, renew, isolated history | None | DONE |
| M2 | Guofeng Avatars, Profile & Achievements | Features 23-26: Guofeng vector avatars, bio sync, career stats, 9-tier rank, 15 achievements, popovers | None | DONE |
| M3 | 2.5D Jade Tiles & Zero-Occlusion Safe FX | Features 27-30: Jade CSS/shaders, spring hover physics, 4 diagonal safe quadrants action seals | None | DONE |
| M4 | Oriental Lobby & Canvas Settlement Poster | Features 31-33: Lobby visual overhaul, Shenghun settlement card, HTML5 Canvas 2D battle report generator | None | DONE |
| M5 | Final E2E Pass, Build & Packaging Acceptance | Feature 34: 100% pass on architecture checks, typecheck, unit tests, smoke tests, build, mac package | M1, M2, M3, M4 | DONE |


## Interface Contracts
### `@pizhou/server-core` (M1) ↔ Client & Server
- `AccountStore`: `createUser`, `getUserById`, `getUserByUsername`, `createSession`, `getSessionByToken`, `deleteSession`, `deleteUserSessionsExcept`, `saveProfile`, `saveMatch`, `getMatchesByUserId`
- `httpRouter`: handles `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/guest`, `POST /api/auth/upgrade`, `POST /api/auth/renew`, `POST /api/auth/logout`, `POST /api/auth/password`, `GET /api/profile`, `POST /api/profile`, `GET /api/matches`, `POST /api/matches`

### `@pizhou/shared` (M2) ↔ UI & Game Loop
- `RankTier`: 9 tiers (`novice_1` to `celestial_9`), `calculateRank(rp: number): RankInfo`
- `Achievement`: 15 achievements (`evaluateAchievements(history: MatchRecord[]): AchievementProgress[]`)
- Protocol: `player:updateProfile` with `{ name?: string; avatar?: string; bio?: string }`

### Safe-Zone Action Splash (M3) ↔ Table
- Mid-ground Diagonal Safe Quadrants: $Q_{SW} = (20\%, 78\%)$, $Q_{SE} = (80\%, 78\%)$, $Q_{NW} = (20\%, 22\%)$, $Q_{NE} = (80\%, 22\%)$
- Zero-occlusion guarantee: bounds do not intersect player bottom hand, discard drop points, or river.

### Canvas Battle Report Generator (M4) ↔ Settlement
- `generateBattleReportPoster(data: BattleReportData): Promise<Blob>`
- High-DPI 2x Retina canvas rendering with oriental watermarks, 4-player ranking cards, MVP crest, and winning hand tiles.

## Code Layout
- `packages/server-core/src/`: `accountStore.ts`, `httpRouter.ts`, `createServer.ts`, `password.ts`
- `packages/shared/src/`: `rank.ts`, `types.ts`, `events.ts`
- `apps/desktop/src/api/`: `auth.ts`
- `apps/desktop/src/storage/`: `history.ts`
- `apps/desktop/src/components/`: `GuofengAvatar.tsx`, `AvatarView.tsx`, `ProfileModal.tsx`, `PlayerCardPopover.tsx`, `ActionSplash.tsx`
- `apps/desktop/src/views/`: `Lobby.tsx`, `Settlement.tsx`, `Table.tsx`
- `apps/desktop/src/styles/`: `core.css`, `table.css`, `interface.css`, `lobby.css`
- `apps/desktop/src/utils/`: `canvasPoster.ts`
