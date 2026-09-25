import { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius } from '../theme';

const HEIGHT = 56;

// The single-line text input used across auth, onboarding and forms —
// replaces the copy-pasted "height: 56, borderRadius: 28" TextInput that
// used to live in each of those screens separately. `error`, when set,
// swaps the border for the app's error color and shows the message below.
const TextField = forwardRef<TextInput, TextInputProps & { error?: string }>(
  ({ style, error, ...props }, ref) => {
    const { colors } = useAppTheme();
    const styles = createStyles(colors);

    return (
      <View>
        <TextInput
          ref={ref}
          style={[styles.input, !!error && styles.inputError, style]}
          placeholderTextColor={colors.placeholder}
          cursorColor={colors.coral}
          {...props}
        />
        {!!error && (
          <Text variant="footnote" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    );
  }
);

export default TextField;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    input: {
      height: HEIGHT,
      borderRadius: radius.input,
      paddingHorizontal: 22,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontFamily: 'Poppins_400Regular',
      fontSize: 16,
      paddingVertical: 0,
      textAlignVertical: 'center',
      includeFontPadding: false,
    },
    inputError: {
      borderColor: colors.red,
    },
    error: {
      marginTop: 6,
      marginLeft: 4,
      color: colors.red,
    },
  });
