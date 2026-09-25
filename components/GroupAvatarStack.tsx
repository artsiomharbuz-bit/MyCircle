import { Image, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../ThemeContext';
import { Colors } from '../theme';

export type GroupAvatarMember = {
  _id: string;
  name?: string;
  username?: string;
  avatarUrl: string | null;
  avatarGradient?: string[];
};

// A group has no photo of its own — this is its avatar everywhere (DMs
// list, chat header): up to 3 members' own avatars, overlapping, most
// recently-relevant first.
export default function GroupAvatarStack({
  members,
  size,
}: {
  members: GroupAvatarMember[];
  size: number;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const shown = members.slice(0, 3);
  const memberSize = shown.length > 1 ? size * 0.62 : size;
  // Later members sit on top, offset toward the bottom-right, like a fanned
  // stack of photos — centered as a whole within the reserved size x size
  // box regardless of how many are shown.
  const step = memberSize * 0.32;
  const extent = memberSize + (shown.length - 1) * step;
  const base = (size - extent) / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {shown.map((member, index) => {
        const displayName = member.name ?? member.username ?? 'Someone';
        const letter = (member.username ?? displayName).charAt(0).toUpperCase();
        const gradient = (member.avatarGradient as [string, string]) ?? [colors.red, colors.coral];
        const offset = base + index * step;

        return (
          <View
            key={member._id}
            style={[
              styles.member,
              {
                width: memberSize,
                height: memberSize,
                borderRadius: memberSize / 2,
                left: offset,
                top: offset,
                borderColor: colors.background,
              },
            ]}
          >
            {member.avatarUrl ? (
              <Image source={{ uri: member.avatarUrl }} style={styles.memberImage} />
            ) : (
              <LinearGradient colors={gradient} style={styles.memberGradient}>
                <Text style={[styles.memberLetter, { fontSize: memberSize * 0.42 }]}>{letter}</Text>
              </LinearGradient>
            )}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {
      position: 'relative',
    },
    member: {
      position: 'absolute',
      overflow: 'hidden',
      borderWidth: 1.5,
      backgroundColor: colors.buttonSecondary,
    },
    memberGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberImage: {
      flex: 1,
    },
    memberLetter: {
      fontFamily: 'Poppins_600SemiBold',
      color: '#ffffff',
    },
  });
