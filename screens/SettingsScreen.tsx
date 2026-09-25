import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Text from '../components/AppText';
import LegalDocModal from '../components/LegalDocModal';
import { LegalDocKey } from '../legalText';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react-native';
import {
  Album02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Flag02Icon,
  FavouriteIcon,
  HelpCircleIcon,
  LockIcon,
  LogOutIcon,
  Megaphone01Icon,
  Moon02Icon,
  MusicNote02Icon,
  PhoneIcon,
  ShieldUserIcon,
  StickerIcon,
  Sun01Icon,
  Time02Icon,
  TranslateIcon,
  User02Icon,
  UserBlock01Icon,
} from '@hugeicons/core-free-icons';
import { AppearanceMode, useAppTheme } from '../ThemeContext';
import { Colors, radius, space, typography } from '../theme';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import Badge from '../components/Badge';
import StickerSheet from '../components/StickerSheet';

const OPTIONS: { mode: AppearanceMode; label: string; icon: typeof Moon02Icon }[] = [
  { mode: 'dark', label: 'Dark', icon: Moon02Icon },
  { mode: 'light', label: 'Light', icon: Sun01Icon },
  { mode: 'system', label: 'Use phone default', icon: PhoneIcon },
];

type SettingItem = { label: string; description: string; icon: IconSvgElement; action?: 'content' | 'stickers' | 'sounds' | 'blocked' | 'ads' | 'language' };

// Every row uses a real icon at the same size and color — no emoji (which
// render in full color via the system font regardless of what's set here)
// and no plain-text glyphs (which come out at wildly different visual
// weights depending on the character). Appearance/dark mode lives outside
// this list — it gets its own row with an inline switch instead of a chevron.
const SETTINGS: SettingItem[] = [
  { label: 'Content', description: 'Posts, stories, and clips', icon: Album02Icon, action: 'content' },
  { label: 'Manage best friends', description: 'Choose who sees your close-circle posts', icon: FavouriteIcon },
  { label: 'Stickers', description: 'Create, save, and share stickers', icon: StickerIcon, action: 'stickers' },
  { label: 'Ads', description: 'Create and manage ads you run on MyCircle', icon: Megaphone01Icon, action: 'ads' },
  { label: 'Blocked accounts', description: 'Accounts you no longer see or hear from', icon: UserBlock01Icon, action: 'blocked' },
  { label: 'Security & privacy', description: 'Control your account and visibility', icon: LockIcon },
  { label: 'Account', description: 'Profile details and account preferences', icon: User02Icon },
  { label: 'Wellbeing', description: 'Time and activity controls', icon: Time02Icon },
  { label: 'Language', description: 'Content language for your feed', icon: TranslateIcon, action: 'language' },
  { label: 'Sounds', description: 'Add and manage the sounds you\'ve made', icon: MusicNote02Icon, action: 'sounds' },
  { label: 'Support', description: 'Help, feedback, and reporting', icon: HelpCircleIcon },
];

export default function SettingsScreen({ userId, onBack, onLogout, onOpenManageAdmins, onOpenModInbox, onOpenAdModInbox, onOpenSounds, onOpenBlockedAccounts, onOpenAds }: { userId: Id<'users'>; onBack: () => void; onLogout: () => void; onOpenManageAdmins: () => void; onOpenModInbox: () => void; onOpenAdModInbox: () => void; onOpenSounds: () => void; onOpenBlockedAccounts: () => void; onOpenAds: () => void }) {
  const { colors, scheme, mode, setMode } = useAppTheme();
  const styles = createStyles(colors);
  const [legalDoc, setLegalDoc] = useState<LegalDocKey | null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const selectedOption = OPTIONS.find((option) => option.mode === mode)!;
  const openItem = (item: SettingItem) => {
    if (item.action === 'content') setContentOpen(true);
    if (item.action === 'stickers') setStickersOpen(true);
    if (item.action === 'sounds') onOpenSounds();
    if (item.action === 'blocked') onOpenBlockedAccounts();
    if (item.action === 'ads') onOpenAds();
    if (item.action === 'language') setLanguageOpen(true);
  };

  // Manage Admins belongs to the one Main Admin account; the report queue and
  // ad review queue are shown to every moderator, Main Admin included.
  const modStatus = useQuery(api.moderation.getModStatus, { userId });
  const openReportCount = useQuery(api.moderation.getModInboxCount, { userId });
  const pendingAdCount = useQuery(api.ads.getPendingAdCount, { modId: userId });
  const me = useQuery(api.users.getUser, { userId });
  const setHideAiContent = useMutation(api.users.setHideAiContent);
  const setDiscoverable = useMutation(api.users.setDiscoverable);
  const commonLanguages = useQuery(api.users.listCommonLanguages, {});
  const setLanguage = useMutation(api.users.setLanguage);
  const primaryLanguage = me?.language ?? null;
  const additionalLanguages = (me?.spokenLanguages ?? []).filter((l) => l !== primaryLanguage);

  const choosePrimaryLanguage = (code: string) => {
    void setLanguage({ userId, language: code, spokenLanguages: [code, ...additionalLanguages] });
  };
  const toggleAdditionalLanguage = (code: string) => {
    if (!primaryLanguage || code === primaryLanguage) return;
    const next = additionalLanguages.includes(code)
      ? additionalLanguages.filter((l) => l !== code)
      : [...additionalLanguages, code];
    void setLanguage({ userId, language: primaryLanguage, spokenLanguages: [primaryLanguage, ...next] });
  };

  const displayName = me?.name ?? me?.username ?? 'You';
  const letter = (me?.username ?? displayName).charAt(0).toUpperCase();
  const gradient = (me?.avatarGradient as [string, string]) ?? [colors.red, colors.coral];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.profileCard} onPress={onBack}>
          <View style={styles.profileAvatar}>
            {me?.avatarUrl ? (
              <Image source={{ uri: me.avatarUrl }} style={styles.profileAvatarImage} />
            ) : (
              <LinearGradient colors={gradient} style={styles.profileAvatarGradient}>
                <Text style={styles.profileAvatarLetter}>{letter}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.rowText}>
            <Text style={styles.profileName}>{displayName}</Text>
            {me?.username && <Text style={styles.profileHandle}>@{me.username}</Text>}
          </View>
          <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
        </Pressable>

        {modStatus?.isMod && (
          <View style={styles.modSection}>
            <Text style={styles.sectionTitle}>Moderation</Text>
            <View style={styles.list}>
              {modStatus.isMainAdmin && (
                <Pressable style={styles.settingRow} onPress={onOpenManageAdmins}>
                  <View style={[styles.iconWrap, styles.modIconWrap]}>
                    <HugeiconsIcon icon={ShieldUserIcon} size={19} color={colors.accentText} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Manage Admins</Text>
                    <Text style={styles.rowDescription} numberOfLines={1}>Appoint or revoke moderators</Text>
                  </View>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
                </Pressable>
              )}
              <Pressable style={styles.settingRow} onPress={onOpenModInbox}>
                <View style={[styles.iconWrap, styles.modIconWrap]}>
                  <HugeiconsIcon icon={Flag02Icon} size={19} color={colors.accentText} />
                  <Badge count={openReportCount} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Reports</Text>
                  <Text style={styles.rowDescription} numberOfLines={1}>Review what the community has reported</Text>
                </View>
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
              </Pressable>
              <Pressable style={styles.settingRow} onPress={onOpenAdModInbox}>
                <View style={[styles.iconWrap, styles.modIconWrap]}>
                  <HugeiconsIcon icon={Megaphone01Icon} size={19} color={colors.accentText} />
                  <Badge count={pendingAdCount} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Ad review</Text>
                  <Text style={styles.rowDescription} numberOfLines={1}>Approve or reject submitted ads</Text>
                </View>
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Other settings</Text>
        <View style={styles.list}>
          <View style={styles.settingRow}>
            <Pressable style={styles.settingRowMain} onPress={() => setAppearanceOpen(true)}>
              <HugeiconsIcon icon={Moon02Icon} size={18} color={colors.textMuted} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Dark mode</Text>
                <Text style={styles.rowDescription} numberOfLines={1}>{selectedOption.label}</Text>
              </View>
            </Pressable>
            <Switch
              value={scheme === 'dark'}
              onValueChange={(value) => setMode(value ? 'dark' : 'light')}
              trackColor={{ false: colors.buttonSecondary, true: colors.buttonBackground }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingRowMain}>
              <HugeiconsIcon icon={User02Icon} size={18} color={colors.textMuted} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Suggest my account to others</Text>
                <Text style={styles.rowDescription} numberOfLines={2}>
                  Turn off to stop appearing in Discover Friends suggestions
                </Text>
              </View>
            </View>
            <Switch
              value={me?.discoverable ?? true}
              onValueChange={(value) => void setDiscoverable({ userId, discoverable: value })}
              trackColor={{ false: colors.buttonSecondary, true: colors.buttonBackground }}
              thumbColor={colors.white}
            />
          </View>
          {SETTINGS.map((item, index) => (
            <Pressable
              key={item.label}
              style={[styles.settingRow, index === SETTINGS.length - 1 && styles.settingRowLast]}
              onPress={() => openItem(item)}
            >
              <HugeiconsIcon icon={item.icon} size={18} color={colors.textMuted} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDescription} numberOfLines={1}>{item.description}</Text>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Account</Text>
        <View style={styles.list}>
          <Pressable style={[styles.settingRow, styles.settingRowLast]} onPress={onLogout}>
            <HugeiconsIcon icon={LogOutIcon} size={18} color={colors.red} />
            <View style={styles.rowText}>
              <Text style={styles.logoutRowLabel}>Log out</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.legal}>
          <Text style={styles.legalTitle}>Legal</Text>
          <View style={styles.legalLinks}>
            <Text style={styles.legalLink} onPress={() => setLegalDoc('terms')}>Terms of use</Text><Text style={styles.dot}>•</Text><Text style={styles.legalLink} onPress={() => setLegalDoc('privacy')}>Privacy policy</Text><Text style={styles.dot}>•</Text><Text style={styles.legalLink} onPress={() => setLegalDoc('guidelines')}>Community guidelines</Text>
          </View>
          <Text style={styles.version}>MyCircle</Text>
        </View>
      </ScrollView>
      <LegalDocModal docKey={legalDoc} onClose={() => setLegalDoc(null)} />
      <Modal transparent animationType="fade" visible={appearanceOpen} onRequestClose={() => setAppearanceOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAppearanceOpen(false)} />
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Appearance</Text>
          <View style={styles.optionList}>
            {OPTIONS.map((option) => {
              const isSelected = mode === option.mode;
              return <Pressable key={option.mode} style={[styles.option, isSelected && styles.optionActive]} onPress={() => { setMode(option.mode); setAppearanceOpen(false); }}>
                <View style={[styles.optionIcon, isSelected && styles.optionIconActive]}><HugeiconsIcon icon={option.icon} size={20} color={isSelected ? colors.black : colors.white} /></View>
                <Text style={styles.optionLabel}>{option.label}</Text>{isSelected && <View style={styles.selectedDot} />}
              </Pressable>;
            })}
          </View>
        </View>
      </Modal>
      <Modal transparent animationType="fade" visible={contentOpen} onRequestClose={() => setContentOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setContentOpen(false)} />
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Content</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchRowText}>
              <Text style={styles.switchRowLabel}>Hide AI content</Text>
              <Text style={styles.switchRowDescription}>
                Hide posts and clips labeled Contains AI, except from friends and your own.
              </Text>
            </View>
            <Switch
              value={me?.hideAiContent ?? false}
              onValueChange={(value) => void setHideAiContent({ userId, hideAiContent: value })}
              trackColor={{ false: colors.buttonSecondary, true: colors.buttonBackground }}
              thumbColor={colors.white}
            />
          </View>
        </View>
      </Modal>
      <Modal transparent animationType="fade" visible={languageOpen} onRequestClose={() => setLanguageOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLanguageOpen(false)} />
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Language</Text>
          <Text style={styles.languageSectionLabel}>Primary language</Text>
          <View style={styles.languageChipRow}>
            {(commonLanguages ?? []).map((lang) => {
              const isSelected = lang.code === primaryLanguage;
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.languageChip, isSelected && styles.languageChipActive]}
                  onPress={() => choosePrimaryLanguage(lang.code)}
                >
                  <Text style={[styles.languageChipText, isSelected && styles.languageChipTextActive]}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.languageSectionLabel, styles.languageSectionSpaced]}>
            Also fluent in (shows subtitled content in these languages more)
          </Text>
          <View style={styles.languageChipRow}>
            {(commonLanguages ?? [])
              .filter((lang) => lang.code !== primaryLanguage)
              .map((lang) => {
                const isSelected = additionalLanguages.includes(lang.code);
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.languageChip, isSelected && styles.languageChipActive]}
                    onPress={() => toggleAdditionalLanguage(lang.code)}
                    disabled={!primaryLanguage}
                  >
                    <Text style={[styles.languageChipText, isSelected && styles.languageChipTextActive]}>
                      {lang.label}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        </View>
      </Modal>
      <StickerSheet visible={stickersOpen} userId={userId} onClose={() => setStickersOpen(false)} manageOnly fullScreen />
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, gap: space.md, paddingBottom: space.lg },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, color: colors.white },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, marginBottom: space.xl, borderRadius: radius.lg, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  profileAvatarImage: { flex: 1 },
  profileAvatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileAvatarLetter: { ...typography.h3, color: '#ffffff' },
  profileName: { ...typography.bodyBold, color: colors.white },
  profileHandle: { ...typography.footnote, color: colors.textMuted, marginTop: 1 },
  // Section headers stay quiet (caption weight, muted color, uppercase
  // tracking) so they read as dividers rather than competing with row
  // labels for attention.
  sectionTitle: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.xs, marginLeft: space.xxs },
  sectionTitleSpaced: { marginTop: space.xl },
  list: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingRowLast: { borderBottomWidth: 0 },
  settingRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconWrap: { width: 34, height: 34, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  modSection: { marginBottom: space.xl }, modIconWrap: { backgroundColor: colors.red },
  rowText: { flex: 1, gap: 1 }, rowLabel: { ...typography.bodyBold, color: colors.white }, rowDescription: { ...typography.caption, color: colors.textMuted },
  logoutRowLabel: { ...typography.bodyBold, color: colors.red },
  legal: { alignItems: 'center', marginTop: space.xl, gap: space.xs }, legalTitle: { ...typography.callout, fontFamily: 'Poppins_600SemiBold', color: colors.white },
  legalLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 7 }, legalLink: { ...typography.caption, color: colors.textMuted }, dot: { ...typography.caption, color: colors.textMuted }, version: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'transparent' }, picker: { backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, paddingBottom: space.xxl, borderWidth: 1, borderColor: colors.border },
  pickerTitle: { ...typography.h2, color: colors.white, marginBottom: space.md }, optionList: { gap: space.xs }, option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.lg, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }, optionActive: { borderColor: colors.white },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.buttonBackground }, optionIconActive: { backgroundColor: colors.white }, optionLabel: { flex: 1, ...typography.bodyBold, color: colors.white }, selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.lg, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border },
  switchRowText: { flex: 1, gap: 3 },
  switchRowLabel: { ...typography.bodyBold, color: colors.white },
  switchRowDescription: { ...typography.caption, lineHeight: 16, color: colors.textMuted },
  languageSectionLabel: { ...typography.caption, fontFamily: 'Poppins_600SemiBold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  languageSectionSpaced: { marginTop: space.lg },
  languageChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  languageChip: { paddingHorizontal: space.md, height: 36, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border },
  languageChipActive: { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBackground },
  languageChipText: { ...typography.footnote, fontFamily: 'Poppins_600SemiBold', color: colors.white },
  languageChipTextActive: { color: colors.buttonText },
});
