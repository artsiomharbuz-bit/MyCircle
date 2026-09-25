import { forwardRef } from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { typography, TypographyVariant } from '../theme';

// The one Text component every screen renders through. `variant` applies a
// scale entry (size/lineHeight/family) from theme.ts; an explicit `style`
// still wins over it, so existing call sites with their own fontSize keep
// rendering exactly as before — `variant` is additive, not a migration
// that had to touch every file at once.
const AppText = forwardRef<RNText, TextProps & { variant?: TypographyVariant }>(
  ({ style, variant, ...props }, ref) => (
    <RNText
      ref={ref}
      {...props}
      style={[
        { fontFamily: 'Poppins_400Regular', includeFontPadding: false },
        variant && typography[variant],
        style,
      ]}
    />
  )
);

export default AppText;
