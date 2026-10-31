import { Image, StyleSheet, View } from 'react-native';
import { space } from '../theme';
import { useAppTheme } from '../ThemeContext';

export default function Logo() {
  const { scheme } = useAppTheme();
  return (
    <View style={styles.logoWrap}>
      <Image
        source={scheme === 'light' ? require('../assets/circlemark-light.png') : require('../assets/circlemark-dark.png')}
        style={styles.logo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginTop: space.xl,
  },
  logo: { width: 72, height: 72 },
});
