import { StyleSheet, View } from 'react-native';
import { MusicNote02Icon, SpeakerIcon, Video01Icon } from '@hugeicons/core-free-icons';
import ActionSheet, { SheetAction } from './ActionSheet';
import VolumeSlider from './VolumeSlider';
import { AudioMode } from '../screens/EditMediaScreen';
import { useAppTheme } from '../ThemeContext';
import { Colors, radius, space } from '../theme';

// The sound icon's own menu, top-right of the edit canvas once a sound has
// been picked for a video: choose whether the clip's own audio plays at all,
// then balance the two tracks. Only reachable for video — a photo has no
// audio of its own to weigh against the sound.
export default function AudioMixSheet({
  visible,
  soundName,
  audioMode,
  soundVolume,
  originalVolume,
  onChangeMode,
  onChangeSoundVolume,
  onChangeOriginalVolume,
  onClose,
}: {
  visible: boolean;
  soundName: string;
  audioMode: AudioMode;
  soundVolume: number;
  originalVolume: number;
  onChangeMode: (mode: AudioMode) => void;
  onChangeSoundVolume: (value: number) => void;
  onChangeOriginalVolume: (value: number) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const actions: SheetAction[] = [
    {
      key: 'sound-only',
      label: 'Only audio',
      description: `Mutes the clip's own sound — only "${soundName}" plays`,
      icon: MusicNote02Icon,
      onPress: () => onChangeMode('sound-only'),
    },
    {
      key: 'both',
      label: 'Audio + video sound',
      description: 'Plays both together, balanced by the sliders below',
      icon: SpeakerIcon,
      onPress: () => onChangeMode('both'),
    },
  ];

  return (
    <ActionSheet
      visible={visible}
      title="Sound"
      subtitle={`Using "${soundName}" — currently ${
        audioMode === 'sound-only' ? 'only audio' : 'audio + video sound'
      }`}
      actions={actions}
      onClose={onClose}
    >
      <View style={styles.sliders}>
        <VolumeSlider
          label="Sound volume"
          icon={MusicNote02Icon}
          value={soundVolume}
          onChange={onChangeSoundVolume}
        />
        {audioMode === 'both' && (
          <VolumeSlider
            label="Video volume"
            icon={Video01Icon}
            value={originalVolume}
            onChange={onChangeOriginalVolume}
          />
        )}
      </View>
    </ActionSheet>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sliders: {
      marginTop: space.lg,
      padding: space.md,
      borderRadius: radius.lg,
      gap: space.lg,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
