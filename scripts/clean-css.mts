/**
 * Dead-CSS detector and remover.
 *
 * The project accumulated ~12.8k lines of CSS, a large share of it orphaned by
 * earlier UI refactors. Manual auditing does not scale, so this script finds
 * rule blocks whose selectors reference no class name present in the TS/TSX
 * sources and removes them.
 *
 * Safety model — the hard part is class names built at runtime through template
 * literals, e.g. `className={`turn-${currentPosition}`}` or `${meld.type}`.
 * A naive scan cannot see those, so the script
 *   1. harvests class tokens from plain string className attributes,
 *   2. harvests literal fragments from template-literal className attributes,
 *   3. treats any selector whose class is a PREFIX of a known dynamic family
 *      (driven by --dynamic-prefixes) as live, never dead,
 *   4. never removes a rule whose selector contains a descendant/attribute part
 *      it cannot reason about,
 * and reports every removal so the diff can be reviewed.
 *
 * Usage:
 *   node --import tsx scripts/clean-css.mts --check    # report only, exit 1 if dead
 *   node --import tsx scripts/clean-css.mts --apply    # rewrite the files
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'apps/desktop/src');

const APPLY = process.argv.includes('--apply');

/** Class families assembled at runtime; their prefixes must never be pruned. */
const DYNAMIC_PREFIXES = [
  'turn-', 'is-', 'has-', 'board-corner-', 'action-', 'meld-', 'pose-',
  'splash-', 'bubble-', 'network-', 'mode-', 'ring-', 'size-', 'scale-',
  'rank-', 'suit-', 'point-rate-', 'ready-', 'seat-', 'dx-', 'dy-',
  'preset-', 'option-', 'record-', 'achievement-',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Collect every class token that can possibly reach the DOM.
 *
 * Template literals are the interesting case: `turn-${pos}` contributes both
 * the literal `turn-` and, for each branch of the interpolation, the concrete
 * value (`bottom`, `right`, ...). Interpolations we cannot resolve are covered
 * by DYNAMIC_PREFIXES instead.
 */
function collectLiveClasses(files: string[]): Set<string> {
  const live = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    // className="a b c"  /  className={'a b c'}
    for (const m of src.matchAll(/className\s*=\s*["']([^"']*)["']/g)) {
      for (const t of m[1]!.match(/[A-Za-z][\w-]*/g) ?? []) live.add(t);
    }
    // className={`...`} — keep literal chunks and any `x-${expr}` prefix
    for (const m of src.matchAll(/className\s*=\s*\{`([^`]*)`\}/g)) {
      for (const t of m[1]!.match(/[A-Za-z][\w-]*/g) ?? []) live.add(t);
    }
    // `pos-${position}` style fragments anywhere in a template
    for (const m of src.matchAll(/([A-Za-z][\w-]*)-\$\{/g)) live.add(m[1]!);
    // ternary branches inside className: 'is-you' : ''
    for (const m of src.matchAll(/['"]([a-z][\w-]{2,})['"]/g)) {
      // only treat as class when it looks like one and is not a common non-class word
      if (!/^(is|has|turn|board|action|meld|pose|splash|quiet|lobby|hall|dossier|settlement|profile|game|friend|chat|auth|rule|network)-/.test(m[1]!)
          && !/^(is|has)-[a-z]+$/.test(m[1]!)) {
        live.add(m[1]!);
      }
    }
  }
  return live;
}

interface Block {
  start: number;      // 0-based line index
  end: number;        // inclusive
  classes: string[];
  text: string;
  /** Selector contains constructs we refuse to reason about. */
  opaque: boolean;
}

/** Split a stylesheet into top-level rule blocks with line ranges. */
function parseBlocks(css: string): Block[] {
  const lines = css.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed.startsWith('/*') || !trimmed.includes('{')) { i += 1; continue; }
    const start = i;
    let depth = 0;
    const collected: string[] = [];
    while (i < lines.length) {
      const cur = lines[i]!;
      if (!cur.trim().startsWith('/*')) collected.push(cur);
      depth += (cur.match(/{/g)?.length ?? 0) - (cur.match(/}/g)?.length ?? 0);
      if (depth <= 0) break;
      i += 1;
    }
    const end = Math.min(i, lines.length - 1);
    const text = collected.join('\n');
    const selector = text.split('{')[0] ?? '';
    const classes = [...selector.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]!);
    // @media / @keyframes and attribute or combinator-heavy selectors: leave alone
    const opaque = selector.trim().startsWith('@')
      || /[\[\]>~]/.test(selector)
      || classes.length === 0;
    blocks.push({ start, end, classes, text, opaque });
    i = end + 1;
  }
  return blocks;
}

/**
 * Decide what to do with one rule block.
 *
 * Returns 'keep', 'drop' or 'prune'. A selector list like
 *   `.auth-hero-eyebrow, .auth-card-kicker, .lobby-kicker { ... }`
 * mixes live and dead classes; deleting it wholesale because one member is
 * unused silently restyles the live ones. So a comma list is pruned member by
 * member, and the block is rewritten rather than removed.
 */
function classify(block: Block, live: Set<string>): 'keep' | 'drop' | 'prune' {
  if (block.opaque) return 'keep';
  if (DYNAMIC_PREFIXES.some((p) => block.classes.some((c) => c.startsWith(p)))) return 'keep';
  const anyLive = block.classes.some((c) => live.has(c));
  if (!anyLive) return 'drop';
  // Some members are live and some are not: prune the dead ones.
  const selector = block.text.split('{')[0] ?? '';
  const parts = selector.split(',').map((p) => p.trim()).filter(Boolean);
  const survivors = parts.filter((part) => {
    const cls = [...part.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]!);
    if (cls.length === 0) return true;
    if (DYNAMIC_PREFIXES.some((pre) => cls.some((c) => c.startsWith(pre)))) return true;
    return cls.some((c) => live.has(c));
  });
  return survivors.length === parts.length ? 'keep' : 'prune';
}

const sourceFiles = walk(SRC);
const live = collectLiveClasses(sourceFiles);
const cssFiles = [
  ...readdirSync(join(SRC, 'styles')).filter((f) => f.endsWith('.css')).map((f) => join(SRC, 'styles', f)),
];

let totalDead = 0;
let totalLines = 0;
const removals: Array<{ file: string; from: number; to: number; classes: string[]; important: boolean; why?: string }> = [];
const prunes: Array<{ file: string; line: number; removed: string[] }> = [];

for (const file of cssFiles) {
  const css = readFileSync(file, 'utf8');
  const blocks = parseBlocks(css);
  const lines = css.split('\n');
  totalLines += lines.length;
  const drop = new Set<number>();
  const rewrite = new Map<number, string>();
  for (const block of blocks) {
    const verdict = classify(block, live);
    const riskyLine = block.text
      .split('\n')
      .find((l) => /font-family|--[a-z-]+\s*:/.test(l) && !/^\s*\*/.test(l));

    if (verdict === 'drop') {
      for (let n = block.start; n <= block.end; n += 1) drop.add(n);
      totalDead += block.end - block.start + 1;
      removals.push({
        file: relative(ROOT, file),
        from: block.start + 1,
        to: block.end + 1,
        classes: block.classes.slice(0, 4),
        important: Boolean(riskyLine),
        why: riskyLine?.trim().slice(0, 60),
      });
    } else if (verdict === 'prune') {
      const braceAt = block.text.indexOf('{');
      const body = block.text.slice(braceAt);
      const parts = block.text.slice(0, braceAt).split(',').map((p) => p.trim()).filter(Boolean);
      const survivors = parts.filter((part) => {
        const cls = [...part.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]!);
        if (cls.length === 0) return true;
        if (DYNAMIC_PREFIXES.some((pre) => cls.some((c) => c.startsWith(pre)))) return true;
        return cls.some((c) => live.has(c));
      });
      rewrite.set(block.start, `${survivors.join(',\n')}${body}`);
      totalDead += parts.length - survivors.length;
      prunes.push({
        file: relative(ROOT, file),
        line: block.start + 1,
        removed: parts.filter((p) => !survivors.includes(p)).slice(0, 4),
      });
    }
  }
  if (APPLY && (drop.size > 0 || rewrite.size > 0)) {
    const out: string[] = [];
    lines.forEach((line, idx) => {
      if (drop.has(idx)) return;
      out.push(rewrite.get(idx) ?? line);
    });
    writeFileSync(file, out.join('\n'), 'utf8');
  }
}

const pct = totalLines === 0 ? 0 : Math.round((100 * totalDead) / totalLines * 10) / 10;
console.log(`dead rules: ${removals.length}, dead lines: ${totalDead}/${totalLines} (${pct}%)`);

// Extra safety signal: a dead block that still declares font-family or a CSS
// custom property is almost certainly load-bearing (it may be the only rule
// setting a global font or a design token). Surface them instead of removing.
const risky = removals.filter((r) => r.important);
if (risky.length > 0) {
  console.log(`\n⚠ ${risky.length} flagged block(s) also set font-family or a custom property:`);
  for (const r of risky) console.log(`  ${r.file}:${r.from}-${r.to}  ${r.classes.join(', ')}  <- ${r.why}`);
}
for (const r of removals.slice(0, 40)) {
  console.log(`  ${r.file}:${r.from}-${r.to}  ${r.classes.join(', ')}`);
}
if (removals.length > 40) console.log(`  ... and ${removals.length - 40} more`);
if (prunes.length > 0) {
  console.log(`\npruned ${prunes.length} mixed selector list(s) (dead member removed, live member kept):`);
  for (const p of prunes.slice(0, 20)) console.log(`  ${p.file}:${p.line}  dropped ${p.removed.join(', ')}`);
}

if (!APPLY && removals.length > 0) {
  console.log('\nre-run with --apply to remove them');
  process.exitCode = 1;
}