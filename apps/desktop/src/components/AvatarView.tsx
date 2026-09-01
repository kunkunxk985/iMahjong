import { isImageAvatar, sanitizeAvatar } from '@pizhou/shared';

interface AvatarViewProps {
  avatar?: string | null;
  className?: string;
  alt?: string;
}

/** Render either a preset emoji or a validated, CF-backed custom image. */
export function AvatarView({ avatar, className, alt = '' }: AvatarViewProps) {
  const value = sanitizeAvatar(avatar);
  if (isImageAvatar(value)) {
    return <img className={`${className ?? ''} avatar-image`.trim()} src={value} alt={alt} draggable={false} />;
  }
  return <span className={className}>{value}</span>;
}
