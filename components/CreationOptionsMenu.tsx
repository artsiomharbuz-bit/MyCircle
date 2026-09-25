import AppTextInput from './AppTextInput';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Text from './AppText';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import { MAX_POLL_OPTIONS, MAX_POLL_OPTION_LENGTH, MAX_POLL_QUESTION_LENGTH, MIN_POLL_OPTIONS } from '../pollOptions';

export type DraftPoll = { question: string; options: string[] };

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// The "Options" sheet at the bottom of post/clip creation — the "Contains
// AI" toggle, an explicit content-language override (see AGENTS.md section
// 3: creator selection always wins over automatic detection), and an
// optional poll.
export default function CreationOptionsMenu({
  visible,
  containsAi,
  onChangeContainsAi,
  language,
  onChangeLanguage,
  languageOptions,
  poll,
  onChangePoll,
  onClose,
}: {
  visible: boolean;
  containsAi: boolean;
  onChangeContainsAi: (value: boolean) => void;
  language: string | null;
  onChangeLanguage: (value: string | null) => void;
  languageOptions: { code: string; label: string }[];
  poll: DraftPoll | null;
  onChangePoll: (poll: DraftPoll | null) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const togglePoll = (value: boolean) => {
    onChangePoll(value ? { question: '', options: ['', ''] } : null);
  };
  const setQuestion = (question: string) => {
    if (poll) onChangePoll({ ...poll, question });
  };
  const setOption = (index: number, value: string) => {
    if (!poll) return;
    const options = poll.options.slice();
    options[index] = value;
    onChangePoll({ ...poll, options });
  };
  const addOption = () => {
    if (!poll || poll.options.length >= MAX_POLL_OPTIONS) return;
    onChangePoll({ ...poll, options: [...poll.options, ''] });
  };
  const removeOption = (index: number) => {
    if (!poll || poll.options.length <= MIN_POLL_OPTIONS) return;
    onChangePoll({ ...poll, options: poll.options.filter((_, i) => i !== index) });
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.anchor} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Contains AI</Text>
                <Text style={styles.rowDescription}>
                  Let people know this was made or edited with AI.
                </Text>
              </View>
              <Switch
                value={containsAi}
                onValueChange={onChangeContainsAi}
                trackColor={{ false: colors.buttonSecondary, true: colors.buttonBackground }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.languageSection}>
              <Text style={styles.rowLabel}>Content language</Text>
              <Text style={styles.rowDescription}>
                Overrides automatic detection so the right people find this.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.languageRow}
              >
                <Pressable
                  style={[styles.languageChip, language === null && styles.languageChipActive]}
                  onPress={() => onChangeLanguage(null)}
                >
                  <Text
                    style={[styles.languageChipText, language === null && styles.languageChipTextActive]}
                  >
                    Auto-detect
                  </Text>
                </Pressable>
                {languageOptions.map((option) => (
                  <Pressable
                    key={option.code}
                    style={[styles.languageChip, language === option.code && styles.languageChipActive]}
                    onPress={() => onChangeLanguage(option.code)}
                  >
                    <Text
                      style={[
                        styles.languageChipText,
                        language === option.code && styles.languageChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.pollSection}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Add a poll</Text>
                  <Text style={styles.rowDescription}>
                    Ask a question with {MIN_POLL_OPTIONS}-{MAX_POLL_OPTIONS} options — people see
                    results as percentages once they vote.
                  </Text>
                </View>
                <Switch
                  value={poll !== null}
                  onValueChange={togglePoll}
                  trackColor={{ false: colors.buttonSecondary, true: colors.buttonBackground }}
                  thumbColor={colors.white}
                />
              </View>

              {poll && (
                <View style={styles.pollEditor}>
                  <AppTextInput
                    style={styles.pollInput}
                    placeholder="Ask a question…"
                    placeholderTextColor={colors.placeholder}
                    value={poll.question}
                    onChangeText={setQuestion}
                    maxLength={MAX_POLL_QUESTION_LENGTH}
                    cursorColor={colors.coral}
                  />

                  {poll.options.map((option, index) => (
                    <View key={index} style={styles.pollOptionRow}>
                      <AppTextInput
                        style={[styles.pollInput, styles.pollOptionInput]}
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor={colors.placeholder}
                        value={option}
                        onChangeText={(value) => setOption(index, value)}
                        maxLength={MAX_POLL_OPTION_LENGTH}
                        cursorColor={colors.coral}
                      />
                      {poll.options.length > MIN_POLL_OPTIONS && (
                        <Pressable style={styles.pollOptionRemove} onPress={() => removeOption(index)}>
                          <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                  ))}

                  {poll.options.length < MAX_POLL_OPTIONS && (
                    <Pressable style={styles.addOptionButton} onPress={addOption}>
                      <HugeiconsIcon icon={PlusSignIcon} size={14} color={colors.textMuted} />
                      <Text style={styles.addOptionText}>Add option</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          <Pressable style={styles.done} onPress={onClose}>
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'transparent',
    },
    anchor: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      paddingTop: space.xs,
      paddingHorizontal: space.lg,
      paddingBottom: space.xxl,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.buttonSecondary,
      marginBottom: space.lg,
    },
    scroll: {
      maxHeight: SCREEN_HEIGHT * 0.62,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.md,
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowLabel: {
      ...typography.bodyBold,
      color: colors.white,
    },
    rowDescription: {
      ...typography.caption,
      color: colors.textMuted,
    },
    languageSection: {
      paddingVertical: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    languageRow: {
      gap: space.xs,
      marginTop: space.sm,
      paddingRight: space.xs,
    },
    languageChip: {
      paddingHorizontal: space.md,
      height: 34,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    languageChipActive: {
      backgroundColor: colors.buttonBackground,
      borderColor: colors.buttonBackground,
    },
    languageChipText: {
      ...typography.calloutBold,
      color: colors.white,
    },
    languageChipTextActive: {
      color: colors.buttonText,
    },
    pollSection: {
      paddingVertical: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    pollEditor: {
      gap: space.xs,
      paddingBottom: space.xxs,
    },
    pollInput: {
      fontFamily: 'Poppins_400Regular',
      height: 44,
      borderRadius: radius.input,
      paddingHorizontal: space.md,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.white,
      fontSize: typography.callout.fontSize,
    },
    pollOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
    },
    pollOptionInput: {
      flex: 1,
    },
    pollOptionRemove: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    addOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addOptionText: {
      ...typography.calloutBold,
      color: colors.textMuted,
    },
    done: {
      marginTop: space.md,
      height: 50,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBackground,
    },
    doneLabel: {
      ...typography.bodyBold,
      color: colors.buttonText,
    },
  });
