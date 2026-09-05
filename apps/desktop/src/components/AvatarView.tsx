import React from 'react';
import { isImageAvatar, sanitizeAvatar } from '@pizhou/shared';
import { GuofengAvatar, isGuofengAvatar } from './GuofengAvatar';

export interface AvatarViewProps {
  avatar?: string | null;
  className?: string;
  alt?: string;
  size?: number | string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLElement | SVGSVGElement>) => void;
}

/**
 * Universal Avatar Renderer.
 * Prioritizes:
 * 1. 12 Curated Oriental/Guofeng SVG vector avatars with instant zero-latency rendering.
 * 2. Validated custom image URLs (data URLs / uploaded avatars).
 * 3. Legacy Unicode emojis ('🀄', '🐉', etc.) as fallback.
 */
export function AvatarView({
  avatar,
  className,
  alt = '玩家头像',
  size,
  title,
  onClick,
}: AvatarViewProps) {
  // 1. Guofeng Vector Avatars (e.g. 'guofeng_yushi')
  const rawAvatar = typeof avatar === 'string' ? avatar : '';
  if (rawAvatar.startsWith('guofeng_') || isGuofengAvatar(avatar)) {
    return (
      <GuofengAvatar
        id={rawAvatar}
        className={className}
        alt={alt}
        size={size}
        title={title}
        onClick={onClick}
      />
    );
  }

  // 2. Custom Image Avatars (e.g. data:image/webp;base64...)
  if (isImageAvatar(avatar)) {
    const dimStyle = size ? { width: size, height: size } : undefined;
    return (
      <img
        className={`${className ?? ''} avatar-image`.trim()}
        src={avatar!}
        alt={alt}
        title={title}
        draggable={false}
        onClick={onClick}
        style={{
          ...dimStyle,
          objectFit: 'cover',
          borderRadius: '50%',
          cursor: onClick ? 'pointer' : 'default',
        }}
      />
    );
  }

  // 3. Fallback: Unicode Emoji or default seal
  const fallbackEmoji = sanitizeAvatar(avatar);
  const fontSizeStyle = size && typeof size === 'number' ? { fontSize: `${Math.round(size * 0.6)}px` } : undefined;

  return (
    <span
      className={`avatar-fallback ${className ?? ''}`.trim()}
      title={title}
      onClick={onClick}
      style={{
        ...fontSizeStyle,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {fallbackEmoji}
    </span>
  );
}
