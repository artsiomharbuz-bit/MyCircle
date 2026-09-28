import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import FormModal from './FormModal';
import PrimaryButton from './PrimaryButton';
import { UserAdd01Icon } from '@hugeicons/core-free-icons';
import { space } from '../theme';

// Shown when someone browsing as a guest (see WelcomeScreen's "Try as
// guest") taps anything that actually needs an account — Home, Create,
// DMs, Profile. Explore itself stays open to guests, so this only ever
// appears from the nav bar's other four destinations (see App.tsx).
export default function AuthRequiredModal({
  visible,
  onClose,
  onLogin,
  onRegister,
}: {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
}) {
  const { t } = useTranslation('components');
  return (
    <FormModal
      visible={visible}
      title={t('authRequired.title')}
      subtitle={t('authRequired.subtitle')}
      icon={UserAdd01Icon}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <PrimaryButton label={t('authRequired.createAccount')} tone="primary" onPress={onRegister} />
          <PrimaryButton label={t('authRequired.logIn')} tone="ghost" onPress={onLogin} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: space.sm,
  },
});
