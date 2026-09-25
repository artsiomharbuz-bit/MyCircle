import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export type FriendLiker = {
  _id: string;
  name?: string;
  username?: string;
  avatarUrl: string | null;
  avatarGradient?: string[];
};

const MAX_STACK = 3;

function Avatar({
  person,
  size,
  ringColor,
}: {
  person: FriendLiker;
  size: number;
  ringColor: string;
}) {
  const { colors } = useAppTheme();
  const letter = (person.username ?? person.name ?? '?').charAt(0).toUpperCase();
  const gradient = (person.avatarGradient as [string, string]) ?? [colors.red, colors.coral];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: ringColor,
        backgroundColor: ringColor,
      }}
    >
      {person.avatarUrl ? (
        <Image source={{ uri: person.avatarUrl }} style={{ flex: 1 }} />
      ) : (
        <LinearGradient
          colors={gradient}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: size * 0.4, color: '#fff' }}>
            {letter}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

// Up to three overlapping profile pictures of friends who liked something
// (a single one when only one did). Tapping it calls `onPress`.
export function FriendLikersStack({
  friends,
  size = 22,
  ringColor,
  onPress,
}: {
  friends: FriendLiker[];
  size?: number;
  ringColor?: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  if (friends.length === 0) return null;
  const shown = friends.slice(0, MAX_STACK);
  const overlap = size * 0.4;

  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel="Friends who liked this">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {shown.map((friend, i) => (
          <View key={friend._id} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: shown.length - i }}>
            <Avatar person={friend} size={size} ringColor={ringColor ?? colors.background} />
          </View>
        ))}
      </View>
    </Pressable>
  );
}

// "Ana and 3 others liked this" — for surfaces with room for a sentence.
export function friendLikersLabel(friends: FriendLiker[]): string {
  if (friends.length === 0) return '';
  const first = friends[0].username ?? friends[0].name ?? 'A friend';
  if (friends.length === 1) return `${first} liked this`;
  const others = friends.length - 1;
  return `${first} and ${others} other${others === 1 ? '' : 's'} liked this`;
}

// "Liked by ana, julia, tom and 1 other" with the names emphasised — the
// post-card variant of the sentence above.
export function FriendLikersLikedBy({
  friends,
  color,
  nameColor,
}: {
  friends: FriendLiker[];
  color: string;
  nameColor: string;
}) {
  const names = friends.slice(0, 3).map((f) => f.username ?? f.name ?? 'friend');
  const others = friends.length - names.length;
  return (
    <Text style={[inline.label, { color }]} numberOfLines={2}>
      Liked by{' '}
      <Text style={[inline.names, { color: nameColor }]}>{names.join(', ')}</Text>
      {others > 0 ? ` and ${others} other${others === 1 ? '' : 's'}` : ''}
    </Text>
  );
}

// Bottom sheet listing every friend who liked the item.
export function FriendLikersSheet({
  visible,
  friends,
  onClose,
  onOpenUser,
}: {
  visible: boolean;
  friends: FriendLiker[];
  onClose: () => void;
  onOpenUser?: (userId: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.heading}>Liked by friends</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {friends.map((friend) => (
            <Pressable
              key={friend._id}
              style={styles.row}
              onPress={() => {
                onClose();
                onOpenUser?.(friend._id);
              }}
            >
              <Avatar person={friend} size={44} ringColor={colors.border} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{friend.name ?? friend.username ?? 'Someone'}</Text>
                {friend.username && <Text style={styles.username}>@{friend.username}</Text>}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// A stack plus a tap-to-open sheet, for surfaces that just want one piece.
export function FriendLikersInline({
  friends,
  onOpenUser,
  showLabel = false,
  size = 22,
  ringColor,
  labelColor,
  likedBy = false,
}: {
  friends: FriendLiker[];
  onOpenUser?: (userId: string) => void;
  showLabel?: boolean;
  size?: number;
  ringColor?: string;
  labelColor?: string;
  // Post-card wording ("Liked by a, b and 2 others") instead of a sentence.
  likedBy?: boolean;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  if (friends.length === 0) return null;

  return (
    <>
      <Pressable style={inline.row} onPress={() => setOpen(true)}>
        <FriendLikersStack
          friends={friends}
          size={size}
          ringColor={ringColor}
          onPress={() => setOpen(true)}
        />
        {showLabel && likedBy && (
          <FriendLikersLikedBy
            friends={friends}
            color={labelColor ?? colors.textMuted}
            nameColor={colors.white}
          />
        )}
        {showLabel && !likedBy && (
          <Text
            style={[inline.label, { color: labelColor ?? colors.textMuted }]}
            numberOfLines={1}
          >
            {friendLikersLabel(friends)}
          </Text>
        )}
      </Pressable>
      <FriendLikersSheet
        visible={open}
        friends={friends}
        onClose={() => setOpen(false)}
        onOpenUser={onOpenUser}
      />
    </>
  );
}

const inline = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  label: { ...typography.footnote, flexShrink: 1 },
  names: { fontFamily: 'Poppins_600SemiBold' },
});

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '60%',
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.xl,
      paddingTop: space.sm,
      paddingBottom: space.xxxl,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomWidth: 0,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.buttonSecondary,
      marginBottom: space.lg,
    },
    heading: { ...typography.h2, color: colors.white, marginBottom: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
    rowText: { flex: 1 },
    name: { ...typography.bodyBold, color: colors.white },
    username: { ...typography.footnote, color: colors.textMuted },
  });
