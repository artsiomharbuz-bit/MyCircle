import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { SentIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';

export default function NewMessageSheet({
  visible,
  userId,
  onClose,
  onSelectUser,
}: {
  visible: boolean;
  userId: Id<'users'>;
  onClose: () => void;
  onSelectUser: (userId: Id<'users'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const people = useQuery(
    api.follows.listFollowingForNewMessage,
    visible ? { userId } : 'skip'
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.heading}>New Message</Text>

        {people?.length === 0 && (
          <Text style={styles.emptyText}>
            Follow people to start a conversation with them.
          </Text>
        )}

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {people?.map((person) => {
            const displayName = person.name ?? person.username ?? 'Someone';
            const letter = (person.username ?? displayName).charAt(0).toUpperCase();
            const gradient = (person.avatarGradient as [string, string]) ?? [
              colors.red,
              colors.coral,
            ];

            return (
              <View key={person._id} style={styles.row}>
                <View style={styles.avatar}>
                  {person.avatarUrl ? (
                    <Image source={{ uri: person.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <LinearGradient colors={gradient} style={styles.avatarGradient}>
                      <Text style={styles.avatarLetter}>{letter}</Text>
                    </LinearGradient>
                  )}
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.name}>{displayName}</Text>
                  {person.username && (
                    <Text style={styles.username}>
                      @{person.username}
                      {person.isFriend ? ' · Friend' : ''}
                    </Text>
                  )}
                </View>

                <AnimatedPressable
                  style={styles.messageButton}
                  onPress={() => onSelectUser(person._id as Id<'users'>)}
                >
                  <HugeiconsIcon icon={SentIcon} size={18} color={colors.buttonText} />
                </AnimatedPressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const AVATAR_SIZE = 44;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.xl,
      paddingTop: space.sm,
      paddingBottom: space.xxxl - 8,
      maxHeight: '75%',
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
    heading: {
      ...typography.h2,
      color: colors.white,
      marginBottom: space.sm,
    },
    emptyText: {
      ...typography.callout,
      color: colors.textMuted,
      paddingVertical: space.sm,
    },
    list: {
      maxHeight: 420,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.xs + 2,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    avatarGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      flex: 1,
    },
    avatarLetter: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 17,
      color: '#ffffff',
    },
    rowText: {
      flex: 1,
    },
    messageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBackground,
    },
    name: {
      ...typography.bodyBold,
      color: colors.white,
    },
    username: {
      marginTop: 2,
      ...typography.footnote,
      color: colors.textMuted,
    },
  });
