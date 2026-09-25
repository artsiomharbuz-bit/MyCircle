import { StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { useAppTheme } from '../ThemeContext';
import { space } from '../theme';

// Kept for the moderation UI, which tints a verification row with it.
export const VERIFIED_BLACK = '#000000';

// Dark mode: a white circle with a black check. Light mode: a dark circle
// with a white check — the badge always inverts against the page.
export default function VerifiedBadge({
  size = 16,
  verified,
}: {
  size?: number;
  // Passing the flag straight through keeps every call site a one-liner:
  // <VerifiedBadge verified={user.isVerified} /> renders nothing when false.
  verified?: boolean;
}) {
  const { scheme } = useAppTheme();
  if (!verified) return null;

  const dark = scheme === 'dark';

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dark ? '#ffffff' : '#111111',
        },
      ]}
    >
      <HugeiconsIcon
        icon={Tick02Icon}
        size={size * 0.7}
        color={dark ? '#000000' : '#ffffff'}
        strokeWidth={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: space.xxs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
