import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import BackButton from '../components/BackButton';
import WheelPicker from '../components/WheelPicker';
import PrimaryButton from '../components/PrimaryButton';
import useEntranceAnimation from '../useEntranceAnimation';
import { useAppTheme } from '../ThemeContext';
import { Colors, space } from '../theme';

const MONTH_KEYS = [
  'monthJanuary',
  'monthFebruary',
  'monthMarch',
  'monthApril',
  'monthMay',
  'monthJune',
  'monthJuly',
  'monthAugust',
  'monthSeptember',
  'monthOctober',
  'monthNovember',
  'monthDecember',
];

const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const MIN_AGE = 13;
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - MIN_AGE - i).reverse();

const defaultYear = CURRENT_YEAR - 18;

function daysInMonth(monthIndex: number, year: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export default function OnboardingDobScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (dateOfBirth: string) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const styles = createStyles(colors);
  const entrance = useEntranceAnimation();
  const { t } = useTranslation(['onboardingDob', 'common']);
  const monthNames = useMemo(() => MONTH_KEYS.map((key) => t(key)), [t]);

  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [yearIndex, setYearIndex] = useState(YEARS.indexOf(defaultYear));
  const [dayIndex, setDayIndex] = useState(Math.min(today.getDate() - 1, 30));

  const year = YEARS[yearIndex];
  const dayCount = daysInMonth(monthIndex, year);
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => String(i + 1)),
    [dayCount]
  );
  const clampedDayIndex = Math.min(dayIndex, dayCount - 1);

  useEffect(() => {
    if (dayIndex > dayCount - 1) {
      setDayIndex(dayCount - 1);
    }
  }, [dayCount, dayIndex]);

  const handleContinue = () => {
    const date = new Date(year, monthIndex, clampedDayIndex + 1);
    onNext(date.toISOString().slice(0, 10));
  };

  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />

      <Animated.View style={[styles.titleWrap, entrance]}>
        <Text variant="display" style={styles.title}>
          {t('title')}
        </Text>
        <Text variant="body" style={styles.subtitle}>
          {t('subtitle')}
        </Text>

        <View style={styles.pickerRow}>
          <WheelPicker
            data={monthNames}
            selectedIndex={monthIndex}
            onChange={setMonthIndex}
            style={styles.monthColumn}
          />
          <WheelPicker data={days} selectedIndex={clampedDayIndex} onChange={setDayIndex} />
          <WheelPicker
            data={YEARS.map(String)}
            selectedIndex={yearIndex}
            onChange={setYearIndex}
          />
        </View>
      </Animated.View>

      <Animated.View style={[styles.actions, entrance]}>
        <PrimaryButton label={t('continueButton')} tone="primary" onPress={handleContinue} />
      </Animated.View>

      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: space.xl,
      paddingTop: space.xl,
      paddingBottom: space.xl,
    },
    titleWrap: {
      marginTop: space.xxl,
    },
    title: {
      color: colors.white,
    },
    subtitle: {
      marginTop: space.xs,
      color: colors.textMuted,
    },
    pickerRow: {
      marginTop: space.xl,
      flexDirection: 'row',
    },
    monthColumn: {
      flex: 1.4,
    },
    actions: {
      marginTop: space.xxl,
    },
  });
