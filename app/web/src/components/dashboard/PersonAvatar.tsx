/**
 * PersonAvatar — an initials avatar with a colour derived deterministically
 * from the name, so the same person is always the same colour across widgets.
 *
 * We have no patient/doctor photos, so the reference dashboard's avatars are
 * rendered as coloured initials rather than faked stock imagery.
 */
import { Avatar } from '@mui/material';

const PALETTE = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#14b8a6', '#6366f1', '#f97316',
];

function hueFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '').trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface PersonAvatarProps {
  name: string;
  size?: number;
}

export function PersonAvatar({ name, size = 32 }: PersonAvatarProps) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: hueFor(name),
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </Avatar>
  );
}
