import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View, ViewStyle } from 'react-native';
import Text from './AppText';
import { useAppTheme } from '../ThemeContext';
import { Colors } from '../theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

export default function WheelPicker({
  data,
  selectedIndex,
  onChange,
  style,
}: {
  data: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const listRef = useRef<FlatList<string>>(null);
  const isSettling = useRef(false);

  useEffect(() => {
    if (isSettling.current) return;
    listRef.current?.scrollToOffset({
      offset: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex, data.length]);

  const commitIndex = (offsetY: number) => {
    const index = Math.max(0, Math.min(data.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
    isSettling.current = false;
    if (index !== selectedIndex) {
      onChange(index);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item, i) => `${item}-${i}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{ paddingVertical: PADDING }}
        onScrollBeginDrag={() => {
          isSettling.current = true;
        }}
        onMomentumScrollEnd={(e) => commitIndex(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => {
          // Only commit here if there's no residual velocity — otherwise momentum
          // scrolling is about to continue, and committing now (before it settles)
          // makes the list jump back to the old selectedIndex mid-scroll, fighting
          // the user's finger.
          const velocity = e.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(velocity) < 0.05) {
            commitIndex(e.nativeEvent.contentOffset.y);
          }
        }}
        renderItem={({ item, index }) => {
          const distance = Math.abs(index - selectedIndex);
          return (
            <View style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  distance === 0 && styles.itemTextActive,
                  distance >= 2 && styles.itemTextFar,
                ]}
              >
                {item}
              </Text>
            </View>
          );
        }}
      />

      <View pointerEvents="none" style={styles.highlight} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  container: {
    height: PICKER_HEIGHT,
    flex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 19,
    color: colors.textMuted,
  },
  itemTextActive: {
    color: colors.white,
    fontSize: 21,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '700',
  },
  itemTextFar: {
    opacity: 0.4,
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
