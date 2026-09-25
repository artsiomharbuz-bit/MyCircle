import { useEffect } from 'react';
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';

// A post's own sound track, played as an invisible second player synced to
// the post's main media. expo-video is what this whole app already uses for
// video, and it plays an audio-only source just as well as a video one, so a
// 1x1 hidden VideoView is how a "sound" (whether it's a plain mp3 or another
// clip's own video, referenced rather than re-encoded) gets layered in
// without a separate audio library.
//
// This is real-time synced dual playback, not a single mixed-down file —
// there's no on-device audio engine in this project to bake two tracks into
// one exported file, so "audio + video sound" plays both tracks live instead.
export default function SoundAudioLayer({
  audioUrl,
  volume,
  isActive,
  syncPlayer,
}: {
  audioUrl: string | null;
  // 0-1, defaults handled by the caller.
  volume: number;
  isActive: boolean;
  // The main video's own player, when there is one. The sound track's
  // length rarely matches the video's exactly, so left alone the two loop
  // on their own separate cycles and drift out of sync over time — this
  // restarts the sound every time the video reaches the end of a loop, so
  // it always begins again exactly when the video does.
  syncPlayer?: VideoPlayer;
}) {
  const player = useVideoPlayer(audioUrl ? { uri: audioUrl } : null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  useEffect(() => {
    if (isActive && audioUrl) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, audioUrl, player]);

  useEffect(() => {
    if (!syncPlayer || !isActive || !audioUrl) return;
    const subscription = syncPlayer.addListener('playToEnd', () => {
      player.currentTime = 0;
      player.play();
    });
    return () => subscription.remove();
  }, [syncPlayer, isActive, audioUrl, player]);

  if (!audioUrl) return null;

  return (
    <VideoView
      style={styles.hidden}
      player={player}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

const styles = {
  hidden: { width: 1, height: 1, opacity: 0 },
} as const;
