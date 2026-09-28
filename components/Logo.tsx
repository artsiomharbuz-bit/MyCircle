import { Image, StyleSheet, View } from 'react-native';
import { space } from '../theme';

export default function Logo() {
  return (
    <View style={styles.logoWrap}>
      <Image source={require('../assets/mycirclelogo.png')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginTop: space.xl,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
});
