import React from 'react';
import {
  GUOFENG_AVATAR_PRESETS,
  type GuofengAvatarDef,
  type GuofengAvatarId,
  isGuofengAvatar,
  getGuofengAvatarDef,
} from '@pizhou/shared';

export { GUOFENG_AVATAR_PRESETS, isGuofengAvatar, getGuofengAvatarDef };
export type { GuofengAvatarDef, GuofengAvatarId };

export interface GuofengAvatarProps {
  id: string;
  className?: string;
  size?: number | string;
  alt?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement | HTMLSpanElement>) => void;
}

export const GuofengAvatar: React.FC<GuofengAvatarProps> = ({
  id,
  className,
  size = 40,
  alt = '国风头像',
  title,
  onClick,
}) => {
  const preset = getGuofengAvatarDef(id) ?? GUOFENG_AVATAR_PRESETS[0];
  const displayTitle = title ?? `${preset.name} · ${preset.desc}`;
  const dim = typeof size === 'number' ? `${size}px` : size;

  const renderArtwork = () => {
    switch (preset.id) {
      case 'guofeng_yushi': // 翡翠雀客 (Jade Scholar & Bi Disk)
        return (
          <g>
            {/* Bamboo leaf accents */}
            <path d="M 22 36 C 28 26 40 28 42 36 C 36 34 26 38 22 36 Z" fill="#6ee7b7" opacity="0.7" />
            <path d="M 78 36 C 72 26 60 28 58 36 C 64 34 74 38 78 36 Z" fill="#6ee7b7" opacity="0.7" />
            {/* Hanging Cord */}
            <path d="M 50 16 L 50 32" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="32" r="3" fill="#f87171" />
            {/* Jade Bi Ring */}
            <circle cx="50" cy="54" r="23" fill="none" stroke="#34d399" strokeWidth="10" filter="url(#dropGlow)" />
            <circle cx="50" cy="54" r="28" fill="none" stroke="#059669" strokeWidth="1" />
            <circle cx="50" cy="54" r="18" fill="none" stroke="#a7f3d0" strokeWidth="1.2" />
            {/* Inner square cut */}
            <rect x="44" y="48" width="12" height="12" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1.2" rx="1.5" />
            {/* Center Jade Gem */}
            <circle cx="50" cy="54" r="3.5" fill="#ecfdf5" />
            {/* Bottom Tassel */}
            <path d="M 50 77 L 50 86 M 47 79 L 45 88 M 53 79 L 55 88" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );

      case 'guofeng_mingling': // 执扇名伶 (Opera Diva & Fan)
        return (
          <g>
            {/* Plum blossom petals in background */}
            <circle cx="30" cy="30" r="3.5" fill="#fecdd3" opacity="0.6" />
            <circle cx="70" cy="28" r="3" fill="#fecdd3" opacity="0.6" />
            <circle cx="50" cy="24" r="4" fill="#fda4af" opacity="0.8" />
            <circle cx="50" cy="24" r="1.5" fill="#fff" />
            {/* Folding fan ribs radiating */}
            <path d="M 20 62 A 38 38 0 0 1 80 62 L 50 78 Z" fill="#ffe4e6" stroke="#f43f5e" strokeWidth="1.5" />
            <path d="M 25 60 A 34 34 0 0 1 75 60 L 50 78 Z" fill="#fb7185" />
            <line x1="50" y1="78" x2="24" y2="58" stroke="#be123c" strokeWidth="1.2" />
            <line x1="50" y1="78" x2="35" y2="50" stroke="#be123c" strokeWidth="1.2" />
            <line x1="50" y1="78" x2="50" y2="46" stroke="#be123c" strokeWidth="1.2" />
            <line x1="50" y1="78" x2="65" y2="50" stroke="#be123c" strokeWidth="1.2" />
            <line x1="50" y1="78" x2="76" y2="58" stroke="#be123c" strokeWidth="1.2" />
            {/* Fan Gold Rim & Lotus motif */}
            <path d="M 20 62 A 38 38 0 0 1 80 62" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
            <path d="M 44 58 Q 50 50 56 58 Q 50 63 44 58 Z" fill="#fff1f2" />
            {/* Pivot pin & Red Silk Tassel */}
            <circle cx="50" cy="78" r="2.5" fill="#fbbf24" stroke="#881337" strokeWidth="1" />
            <path d="M 50 80 Q 48 88 47 92 M 50 80 Q 52 88 53 92" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );

      case 'guofeng_daoshi': // 运河仙翁 (Canal Taoist & Taiji)
        return (
          <g>
            {/* Whisk / Cloud curls */}
            <path d="M 22 50 Q 32 32 50 32 Q 68 32 78 50 Q 64 42 50 42 Q 36 42 22 50 Z" fill="#c4b5fd" opacity="0.4" />
            {/* Outer Taiji Ring */}
            <circle cx="50" cy="52" r="25" fill="#ede9fe" stroke="#7c3aed" strokeWidth="2.5" />
            {/* Dark half S-curve */}
            <path d="M 50 27 A 25 25 0 0 1 50 77 A 12.5 12.5 0 0 1 50 52 A 12.5 12.5 0 0 0 50 27 Z" fill="#4c1d95" />
            {/* Two Yin-Yang Eyes */}
            <circle cx="50" cy="39.5" r="3.5" fill="#ede9fe" />
            <circle cx="50" cy="64.5" r="3.5" fill="#4c1d95" />
            {/* Eight Trigram Accents around edge */}
            <line x1="50" y1="20" x2="50" y2="24" stroke="#a78bfa" strokeWidth="2" />
            <line x1="50" y1="80" x2="50" y2="84" stroke="#a78bfa" strokeWidth="2" />
            <line x1="20" y1="52" x2="24" y2="52" stroke="#a78bfa" strokeWidth="2" />
            <line x1="76" y1="52" x2="80" y2="52" stroke="#a78bfa" strokeWidth="2" />
          </g>
        );

      case 'guofeng_nuxia': // 飒爽剑客 (Swordsman Hat & Crossed Blades)
        return (
          <g>
            {/* Crossed Sword Blades */}
            <line x1="24" y1="26" x2="76" y2="78" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="24" y1="26" x2="76" y2="78" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="76" y1="26" x2="24" y2="78" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="76" y1="26" x2="24" y2="78" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
            {/* Sword Guards & Pommels */}
            <rect x="22" y="24" width="7" height="3" fill="#f59e0b" transform="rotate(45 25.5 25.5)" />
            <rect x="71" y="24" width="7" height="3" fill="#f59e0b" transform="rotate(-45 74.5 25.5)" />
            {/* Conical Bamboo Hat (斗笠) */}
            <path d="M 16 56 Q 50 36 84 56 Q 50 50 16 56 Z" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
            <path d="M 38 46 L 50 34 L 62 46 Z" fill="#d97706" opacity="0.8" />
            {/* Black Veil Shadow under hat */}
            <ellipse cx="50" cy="57" rx="26" ry="6" fill="#1e293b" opacity="0.85" />
            {/* Cold piercing gaze */}
            <circle cx="43" cy="57" r="1.5" fill="#38bdf8" />
            <circle cx="57" cy="57" r="1.5" fill="#38bdf8" />
          </g>
        );

      case 'guofeng_jinli': // 祥瑞锦鲤 (Fortune Leaping Koi)
        return (
          <g>
            {/* Water Ripple Rings */}
            <ellipse cx="50" cy="52" rx="36" ry="14" fill="none" stroke="#fed7aa" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />
            <ellipse cx="50" cy="52" rx="26" ry="10" fill="none" stroke="#ffedd5" strokeWidth="1" opacity="0.5" />
            {/* Koi Body Curves */}
            <path
              d="M 32 68 Q 28 42 46 32 Q 62 26 66 40 Q 70 54 54 64 Q 40 72 32 68 Z"
              fill="#fb923c"
              stroke="#ea580c"
              strokeWidth="2"
            />
            {/* White/Golden Belly & Scales */}
            <path d="M 36 62 Q 34 46 48 38 Q 54 44 48 56 Q 42 64 36 62 Z" fill="#ffedd5" />
            <circle cx="50" cy="46" r="2.5" fill="#f97316" />
            <circle cx="56" cy="42" r="2.5" fill="#f97316" />
            {/* Flowing Tail Fin */}
            <path d="M 32 68 Q 22 76 16 74 Q 24 86 32 76 Q 34 84 40 82 Z" fill="#fdba74" stroke="#ea580c" strokeWidth="1.2" />
            {/* Dorsal & Ventral Fins */}
            <path d="M 52 30 Q 60 22 66 26 Q 64 34 58 34 Z" fill="#fdba74" />
            {/* Koi Eye & Whisker */}
            <circle cx="62" cy="40" r="2" fill="#0f172a" />
            <path d="M 66 42 Q 74 44 76 48" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );

      case 'guofeng_xianhe': // 云中仙鹤 (Cloud Soaring Crane)
        return (
          <g>
            {/* Auspicious swirling clouds */}
            <path d="M 20 68 Q 28 60 38 64 Q 46 56 56 62 Q 68 58 78 66" fill="none" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            {/* Wide Soaring Wings */}
            <path d="M 50 48 Q 24 30 18 42 Q 32 46 44 54 Z" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
            <path d="M 50 48 Q 76 30 82 42 Q 68 46 56 54 Z" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
            {/* Black wingtips (flight feathers) */}
            <path d="M 18 42 Q 24 44 28 46 L 24 48 L 18 42 Z" fill="#0f172a" />
            <path d="M 82 42 Q 76 44 72 46 L 76 48 L 82 42 Z" fill="#0f172a" />
            {/* Crane Body & Tail */}
            <ellipse cx="50" cy="56" rx="8" ry="14" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
            <path d="M 48 70 L 46 84 M 52 70 L 54 84" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
            {/* Slender Neck & Head */}
            <path d="M 50 44 Q 50 32 52 26" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="53" cy="25" r="3.5" fill="#ffffff" />
            <line x1="55" y1="25" x2="63" y2="25" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
            {/* Red Crown (丹顶) */}
            <circle cx="52.5" cy="23" r="1.8" fill="#ef4444" />
          </g>
        );

      case 'guofeng_shenlong': // 苍青游龙 (Azure Imperial Dragon)
        return (
          <g>
            {/* Coiling Body Clouds */}
            <path d="M 22 56 Q 36 34 50 50 Q 64 66 78 48" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
            {/* Dragon Horns (鹿角) */}
            <path d="M 44 32 Q 40 20 34 18 M 40 24 L 36 26" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 56 32 Q 60 20 66 18 M 60 24 L 64 26" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            {/* Dragon Head Structure */}
            <path d="M 36 42 Q 50 32 64 42 Q 68 56 50 64 Q 32 56 36 42 Z" fill="#047857" stroke="#34d399" strokeWidth="1.8" />
            {/* Fierce Eyes */}
            <ellipse cx="44" cy="44" rx="3.5" ry="2.5" fill="#fef08a" />
            <circle cx="44" cy="44" r="1.2" fill="#064e3b" />
            <ellipse cx="56" cy="44" rx="3.5" ry="2.5" fill="#fef08a" />
            <circle cx="56" cy="44" r="1.2" fill="#064e3b" />
            {/* Dragon Snout & Whiskers */}
            <ellipse cx="50" cy="54" rx="7" ry="4.5" fill="#065f46" stroke="#6ee7b7" strokeWidth="1" />
            <path d="M 43 54 Q 30 52 24 64" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M 57 54 Q 70 52 76 64" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
            {/* Flaming Dragon Pearl (宝珠) */}
            <circle cx="50" cy="74" r="6" fill="#fbbf24" filter="url(#dropGlow)" />
            <circle cx="50" cy="74" r="4" fill="#fef08a" />
          </g>
        );

      case 'guofeng_fenghuang': // 赤炎神凤 (Blazing Phoenix)
        return (
          <g>
            {/* Flame Halo Aura */}
            <circle cx="50" cy="50" r="28" fill="none" stroke="#fca5a5" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            {/* Sweeping Radiant Wings */}
            <path d="M 50 48 Q 20 28 16 54 Q 34 56 46 58 Z" fill="#f87171" stroke="#ef4444" strokeWidth="1.5" />
            <path d="M 50 48 Q 80 28 84 54 Q 66 56 54 58 Z" fill="#f87171" stroke="#ef4444" strokeWidth="1.5" />
            {/* Wing Feather Flares */}
            <path d="M 22 42 Q 30 36 38 46" fill="none" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
            <path d="M 78 42 Q 70 36 62 46" fill="none" stroke="#fef08a" strokeWidth="2" strokeLinecap="round" />
            {/* Phoenix Head & Curved Beak */}
            <ellipse cx="50" cy="38" rx="6" ry="8" fill="#ef4444" stroke="#fde047" strokeWidth="1.2" />
            <path d="M 50 42 L 56 46 L 50 48 Z" fill="#f59e0b" />
            {/* Crown Plumes (凤冠) */}
            <path d="M 47 31 Q 44 20 40 18" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
            <path d="M 50 30 Q 50 18 50 16" fill="none" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 53 31 Q 56 20 60 18" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
            {/* Flowing Tail Feathers with Eye-spots */}
            <path d="M 46 62 Q 38 74 34 88 M 50 64 L 50 90 M 54 62 Q 62 74 66 88" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <circle cx="34" cy="86" r="3" fill="#ef4444" stroke="#fef08a" strokeWidth="1" />
            <circle cx="50" cy="88" r="3" fill="#ef4444" stroke="#fef08a" strokeWidth="1" />
            <circle cx="66" cy="86" r="3" fill="#ef4444" stroke="#fef08a" strokeWidth="1" />
          </g>
        );

      case 'guofeng_qilin': // 金甲麒麟 (Golden Qilin)
        return (
          <g>
            {/* Radiance Spikes */}
            <circle cx="50" cy="52" r="30" fill="none" stroke="#fde047" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.6" />
            {/* Single Spiral Horn (独角) */}
            <path d="M 50 36 Q 50 20 54 16 Q 52 24 50 36 Z" fill="#fef08a" stroke="#d97706" strokeWidth="1.5" />
            {/* Mane of Golden Flame Curls */}
            <path d="M 32 44 Q 24 36 32 30 Q 40 38 34 46" fill="#f59e0b" opacity="0.8" />
            <path d="M 68 44 Q 76 36 68 30 Q 60 38 66 46" fill="#f59e0b" opacity="0.8" />
            {/* Qilin Muzzle & Scale Armor Plate */}
            <rect x="34" y="38" width="32" height="28" rx="8" fill="#eab308" stroke="#78350f" strokeWidth="2" />
            <circle cx="43" cy="48" r="3" fill="#78350f" />
            <circle cx="44" cy="47.5" r="1" fill="#fff" />
            <circle cx="57" cy="48" r="3" fill="#78350f" />
            <circle cx="58" cy="47.5" r="1" fill="#fff" />
            {/* Dragon Beard & Nose */}
            <ellipse cx="50" cy="58" rx="6" ry="3.5" fill="#ca8a04" />
            <path d="M 44 60 Q 36 64 30 74" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
            <path d="M 56 60 Q 64 64 70 74" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
            {/* Golden Ingot in mouth / base */}
            <path d="M 40 76 L 60 76 L 56 82 L 44 82 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.2" />
            <ellipse cx="50" cy="76" rx="8" ry="3" fill="#fde047" />
          </g>
        );

      case 'guofeng_xuanwu': // 镇水玄武 (Water Xuanwu Turtle & Serpent)
        return (
          <g>
            {/* Wave crests at base */}
            <path d="M 18 76 Q 34 66 50 76 Q 66 86 82 76" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            {/* Turtle Carapace (Turtle Shell) */}
            <ellipse cx="50" cy="54" rx="24" ry="18" fill="#0369a1" stroke="#38bdf8" strokeWidth="2.5" />
            {/* Shell Hexagon Pattern */}
            <polygon points="50,42 58,47 58,57 50,62 42,57 42,47" fill="#0284c7" stroke="#7dd3fc" strokeWidth="1.5" />
            <line x1="50" y1="42" x2="50" y2="36" stroke="#7dd3fc" strokeWidth="1.2" />
            <line x1="58" y1="47" x2="68" y2="44" stroke="#7dd3fc" strokeWidth="1.2" />
            <line x1="58" y1="57" x2="68" y2="60" stroke="#7dd3fc" strokeWidth="1.2" />
            <line x1="50" y1="62" x2="50" y2="72" stroke="#7dd3fc" strokeWidth="1.2" />
            <line x1="42" y1="57" x2="32" y2="60" stroke="#7dd3fc" strokeWidth="1.2" />
            <line x1="42" y1="47" x2="32" y2="44" stroke="#7dd3fc" strokeWidth="1.2" />
            {/* Coiling Water Serpent Neck & Head */}
            <path d="M 64 64 Q 78 46 68 32 Q 58 22 50 28" fill="none" stroke="#0ea5e9" strokeWidth="3.5" strokeLinecap="round" />
            <ellipse cx="50" cy="27" rx="4" ry="3" fill="#0284c7" stroke="#bae6fd" strokeWidth="1" />
            <circle cx="48.5" cy="26" r="1" fill="#fef08a" />
          </g>
        );

      case 'guofeng_linglu': // 呦呦仙鹿 (Ethereal Celestial Deer)
        return (
          <g>
            {/* Starlight Constellation Dots */}
            <circle cx="28" cy="24" r="1.5" fill="#ccfbf1" opacity="0.8" />
            <circle cx="72" cy="24" r="1.5" fill="#ccfbf1" opacity="0.8" />
            <circle cx="50" cy="16" r="2" fill="#5eead4" />
            {/* Antlers Branching Out gracefully */}
            <path d="M 44 38 Q 36 24 24 22 M 34 26 Q 30 18 36 14 M 32 30 Q 24 32 20 28" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 56 38 Q 64 24 76 22 M 66 26 Q 70 18 64 14 M 68 30 Q 76 32 80 28" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" />
            {/* Graceful Deer Head Silhouette */}
            <path d="M 42 36 Q 50 32 58 36 Q 60 52 50 68 Q 40 52 42 36 Z" fill="#0f766e" stroke="#5eead4" strokeWidth="1.8" />
            {/* Long Ears */}
            <ellipse cx="36" cy="40" rx="6" ry="2.5" fill="#14b8a6" transform="rotate(-30 36 40)" />
            <ellipse cx="64" cy="40" rx="6" ry="2.5" fill="#14b8a6" transform="rotate(30 64 40)" />
            {/* Gentle Eyes & Forehead Star */}
            <circle cx="45" cy="46" r="2" fill="#134e4a" />
            <circle cx="55" cy="46" r="2" fill="#134e4a" />
            <circle cx="50" cy="40" r="2" fill="#fef08a" />
            {/* Sacred Lingzhi Herb in Mouth */}
            <path d="M 50 66 Q 44 74 38 72 Q 36 68 42 66 Z" fill="#f43f5e" />
          </g>
        );

      case 'guofeng_zongshi': // 邳州宗师 (Pizhou Grandmaster & Canal Waves)
      default:
        return (
          <g>
            {/* Grand Canal Triple Wave Arches */}
            <path d="M 20 70 Q 35 60 50 70 Q 65 80 80 70" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 22 76 Q 36 68 50 76 Q 64 84 78 76" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
            {/* Red Lacquer Master Seal Box */}
            <rect x="32" y="24" width="36" height="38" rx="4" fill="#991b1b" stroke="#fbbf24" strokeWidth="2" filter="url(#dropGlow)" />
            <rect x="35" y="27" width="30" height="32" rx="2" fill="none" stroke="#fca5a5" strokeWidth="0.8" strokeDasharray="3 2" />
            {/* Stylized Pizhou White Garlic Blossom & Mahjong Master Seal */}
            {/* Garlic bulb petals / lotus center */}
            <path d="M 50 32 C 45 36 44 44 50 50 C 56 44 55 36 50 32 Z" fill="#fef3c7" stroke="#b45309" strokeWidth="1.2" />
            <path d="M 45 36 C 39 40 42 48 48 50 Z" fill="#fde68a" opacity="0.85" />
            <path d="M 55 36 C 61 40 58 48 52 50 Z" fill="#fde68a" opacity="0.85" />
            {/* Golden Ribbon Seal Bottom */}
            <circle cx="50" cy="56" r="3" fill="#fbbf24" />
            <path d="M 48 58 L 44 68 M 52 58 L 56 68" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
    }
  };

  return (
    <svg
      className={`guofeng-avatar ${className ?? ''}`.trim()}
      viewBox="0 0 100 100"
      width={dim}
      height={dim}
      role="img"
      aria-label={alt}
      onClick={onClick}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <title>{displayTitle}</title>
      <defs>
        {/* Glow and Drop Shadows */}
        <filter id="dropGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
        </filter>
        {/* Outer Imperial Gold Ring */}
        <linearGradient id={`goldRing_${preset.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="30%" stopColor="#facc15" />
          <stop offset="70%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        {/* Dynamic Theme Radial Backdrop */}
        <radialGradient id={`bgGrad_${preset.id}`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor={preset.theme} stopOpacity="0.9" />
          <stop offset="60%" stopColor={preset.theme} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#091811" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      {/* Outer Border: Double Imperial Gold Medallion Rim */}
      <circle cx="50" cy="50" r="48" fill={`url(#goldRing_${preset.id})`} stroke="#451a03" strokeWidth="1" />
      <circle cx="50" cy="50" r="45" fill={`url(#bgGrad_${preset.id})`} />
      <circle
        cx="50"
        cy="50"
        r="44.5"
        fill="none"
        stroke="rgba(254, 240, 138, 0.4)"
        strokeWidth="1"
        strokeDasharray="4 2"
      />

      {/* Central Vector Artwork */}
      {renderArtwork()}

      {/* Fine Inner Lens Bevel */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth="1.2"
        style={{ pointerEvents: 'none' }}
      />
    </svg>
  );
};
