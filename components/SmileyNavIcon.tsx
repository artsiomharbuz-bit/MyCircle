import Svg, { Circle, Path } from 'react-native-svg';

// Custom rendering of the profile smiley (instead of the shared HugeiconsIcon)
// for the same reason as ExploreIcon: filling it solid the normal way also
// fills the eyes/mouth paths, making the face vanish into the rest of the
// icon. Here the outer circle fills with the active color while the face
// stays outline-only, punched through with the page background color so it
// still reads as a distinct face on top of the solid disc.
export default function SmileyNavIcon({
  size,
  color,
  active,
  backgroundColor,
}: {
  size: number;
  color: string;
  active: boolean;
  backgroundColor: string;
}) {
  const faceColor = active ? backgroundColor : color;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? color : 'none'}
      />
      <Path
        d="M8 15C8.91212 16.2144 10.3643 17 12 17C13.6357 17 15.0879 16.2144 16 15"
        stroke={faceColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M15.625 8.387V8.91649M8.375 8.387V8.91649M8.75 8.75C8.75 8.33579 8.58211 8 8.375 8C8.16789 8 8 8.33579 8 8.75C8 9.16421 8.16789 9.5 8.375 9.5C8.58211 9.5 8.75 9.16421 8.75 8.75ZM16 8.75C16 8.33579 15.8321 8 15.625 8C15.4179 8 15.25 8.33579 15.25 8.75C15.25 9.16421 15.4179 9.5 15.625 9.5C15.8321 9.5 16 9.16421 16 8.75Z"
        stroke={faceColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
