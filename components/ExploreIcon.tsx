import Svg, { Circle, Path } from 'react-native-svg';

// Custom rendering of the compass icon (instead of the shared HugeiconsIcon)
// because filling it solid the normal way also fills the needle path, making
// the needle vanish into the rest of the icon. Here the outer circle fills
// with the active color while the needle stays outline-only, punched through
// with the page background color so it still reads as a distinct shape.
export default function ExploreIcon({
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
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="13"
        r="9"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill={active ? color : 'none'}
      />
      <Path d="M12 3.5V2" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 2H14" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M14.7728 10.2571C15.5061 10.9837 14.3328 16.8933 13.1289 16.9974C12.1189 17.0848 11.8041 15.0928 11.5914 14.4614C11.3815 13.8383 11.1478 13.6139 10.5298 13.4095C8.95989 12.8901 8.17492 12.6304 8.0195 12.2192C7.60796 11.1304 13.8362 9.32902 14.7728 10.2571Z"
        stroke={active ? backgroundColor : color}
        strokeWidth="2.2"
        fill="none"
      />
    </Svg>
  );
}
