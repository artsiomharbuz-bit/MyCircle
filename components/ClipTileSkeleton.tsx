import { StyleSheet } from 'react-native';
import Skeleton from './Skeleton';
import { radius } from '../theme';

const TILE_WIDTH = 116;
const TILE_HEIGHT = 190;

export default function ClipTileSkeleton() {
  return <Skeleton style={styles.tile} />;
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radius.lg,
  },
});
