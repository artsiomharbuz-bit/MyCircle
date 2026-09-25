import type { ReactNode } from 'react';

const RING_WIDTH = 3;
const RING_GAP = 3;

// Wraps an avatar with a red-coral gradient ring and a small breathing gap,
// matching the app's StoryRing.tsx exactly (#ff3d68 -> #ff7a59). Renders the
// child as-is when there's no active story.
export function StoryRing({
  hasStory,
  size,
  children,
  ringWidth = RING_WIDTH,
  gap = RING_GAP,
}: {
  hasStory: boolean;
  size: number;
  children: ReactNode;
  ringWidth?: number;
  gap?: number;
}) {
  const ringSize = size + (ringWidth + gap) * 2;
  const avatarOffset = ringWidth + gap;

  if (!hasStory) {
    return (
      <div style={{ width: ringSize, height: ringSize, position: 'relative' }}>
        <div style={{ position: 'absolute', top: avatarOffset, left: avatarOffset, width: size, height: size }}>
          {children}
        </div>
      </div>
    );
  }

  const gapMaskSize = size + gap * 2;

  return (
    <div style={{ width: ringSize, height: ringSize, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          width: ringSize,
          height: ringSize,
          borderRadius: '9999px',
          background: 'linear-gradient(135deg, var(--mc-story-start), var(--mc-story-end))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: ringWidth,
          left: ringWidth,
          width: gapMaskSize,
          height: gapMaskSize,
          borderRadius: '9999px',
          background: 'var(--mc-surface)',
        }}
      />
      <div style={{ position: 'absolute', top: avatarOffset, left: avatarOffset, width: size, height: size }}>
        {children}
      </div>
    </div>
  );
}
