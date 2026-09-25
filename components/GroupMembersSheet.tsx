import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery } from '../SessionContext';
import VerifiedBadge from './VerifiedBadge';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

// Lists a group's joined members. Used from the invite card so a person can
// see who is in a group before joining it.
export default function GroupMembersSheet({
  visible,
  groupId,
  groupName,
  viewerId,
  onClose,
}: {
  visible: boolean;
  groupId: Id<'groupChats'>;
  groupName?: string;
  viewerId: Id<'users'>;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const members = useQuery(
    api.groups.listGroupMembers,
    visible ? { groupId, viewerId } : 'skip'
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.heading} numberOfLines={1}>
          {groupName ?? 'Group'} members
        </Text>
        {members && (
          <Text style={styles.count}>
            {members.length} member{members.length === 1 ? '' : 's'}
          </Text>
        )}

        <ScrollView showsVerticalScrollIndicator={false}>
          {members?.map((member) => {
            const displayName = member.name ?? member.username ?? 'Someone';
            const letter = (member.username ?? displayName).charAt(0).toUpperCase();
            const gradient = (member.avatarGradient as [string, string]) ?? [
              colors.red,
              colors.coral,
            ];
            return (
              <View key={member._id} style={styles.row}>
                <View style={styles.avatar}>
                  {member.avatarUrl ? (
                    <Image source={{ uri: member.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={gradient} style={styles.avatarGradient}>
                      <Text style={styles.avatarLetter}>{letter}</Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.rowText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                    <VerifiedBadge verified={member.isVerified} size={14} />
                  </View>
                  {member.username && <Text style={styles.username}>@{member.username}</Text>}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '65%',
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
    heading: { ...typography.h2, color: colors.white },
    count: { ...typography.footnote, color: colors.textMuted, marginBottom: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
    avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
    avatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { flex: 1 },
    avatarLetter: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: '#ffffff' },
    rowText: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    name: { ...typography.bodyBold, color: colors.white, flexShrink: 1 },
    username: { ...typography.footnote, color: colors.textMuted },
  });
