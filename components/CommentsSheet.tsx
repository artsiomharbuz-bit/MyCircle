import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import CommentsPanel from './CommentsPanel';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
export const COMMENTS_SHEET_HEIGHT = SCREEN_HEIGHT * 0.62;
// Fully expanded stops just below the status bar instead of covering it.
const EXPANDED_HEIGHT = SCREEN_HEIGHT - (StatusBar.currentHeight ?? 44) - 8;
// Drag past the halfway point between the two heights and it snaps to
// whichever side it's closer to on release, like any standard bottom sheet.
const SNAP_MIDPOINT = (COMMENTS_SHEET_HEIGHT + EXPANDED_HEIGHT) / 2;

export default function CommentsSheet({
  visible,
  postId,
  userId,
  onClose,
  onOpenUser,
  onOpenStory,
}: {
  visible: boolean;
  postId: Id<'posts'> | null;
  userId: Id<'users'>;
  onClose: () => void;
  onOpenUser: (userId: Id<'users'>) => void;
  onOpenStory: (userId: Id<'users'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const height = useRef(new Animated.Value(COMMENTS_SHEET_HEIGHT)).current;
  const heightRef = useRef(COMMENTS_SHEET_HEIGHT);
  const dragStart = useRef(COMMENTS_SHEET_HEIGHT);

  useEffect(() => {
    const id = height.addListener(({ value }) => {
      heightRef.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);

  // Reset to the default height each time the sheet is (re)opened.
  useEffect(() => {
    if (visible) {
      height.setValue(COMMENTS_SHEET_HEIGHT);
      heightRef.current = COMMENTS_SHEET_HEIGHT;
    }
  }, [visible, height]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        dragStart.current = heightRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(
          EXPANDED_HEIGHT,
          Math.max(COMMENTS_SHEET_HEIGHT * 0.6, dragStart.current - gesture.dy)
        );
        height.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        // A deliberate downward slide closes the sheet from either snap point.
        if (gesture.dy > 80 || gesture.vy > 1.2) {
          onClose();
          return;
        }
        const target = heightRef.current > SNAP_MIDPOINT ? EXPANDED_HEIGHT : COMMENTS_SHEET_HEIGHT;
        Animated.spring(height, {
          toValue: target,
          useNativeDriver: false,
          speed: 16,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View style={[styles.sheet, { height }]}>
        <View style={styles.handleWrap} {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>
        <CommentsPanel
          postId={postId}
          userId={userId}
          active={visible}
          onOpenUser={onOpenUser}
          onOpenStory={onOpenStory}
        />
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      // Matches ActionSheet's bottom-sheet backdrop — no dimming, just an
      // invisible tap-catcher so tapping outside the sheet still closes it.
      backgroundColor: 'transparent',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomWidth: 0,
    },
    handleWrap: {
      paddingTop: space.sm,
      paddingBottom: space.xs,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.buttonSecondary,
    },
  });
