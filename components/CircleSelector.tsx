import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import AnimatedPressable from './AnimatedPressable';
import Badge from './Badge';
import CreateCircleSheet from './CreateCircleSheet';
import InviteToCircleSheet from './InviteToCircleSheet';
import CircleActionsSheet from './CircleActionsSheet';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAppTheme } from '../ThemeContext';
import { circles as STATIC_CIRCLES, Colors, radius, space, typography } from '../theme';

export default function CircleSelector({
  userId,
  selectedId,
  onSelect,
  hasNewByCircle,
  onOpenGroupChat,
}: {
  userId: Id<'users'>;
  selectedId: string;
  onSelect: (id: string) => void;
  hasNewByCircle?: Record<string, boolean>;
  onOpenGroupChat: (groupId: Id<'groupChats'>) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [createVisible, setCreateVisible] = useState(false);
  const [inviteCircleId, setInviteCircleId] = useState<Id<'userCircles'> | null>(null);
  const [actionCircle, setActionCircle] = useState<{ _id: string; name: string; color: string; ownerId: Id<'users'> } | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedCustomIds, setOrderedCustomIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const layouts = useRef(new Map<string, { x: number; width: number }>()).current;
  const dragId = useRef<string | null>(null);
  const reorderCircle = useMutation(api.userCircles.reorderCircle);
  const myCircles = useQuery(api.userCircles.listMyCircles, { userId });

  useEffect(() => {
    if (myCircles) setOrderedCustomIds(myCircles.map((circle) => circle._id as string));
  }, [myCircles]);

  const allCircles = [
    ...STATIC_CIRCLES.map((circle) => ({ id: circle.id, label: circle.label, color: colors[circle.colorKey] })),
    ...orderedCustomIds
      .map((id) => myCircles?.find((circle) => circle._id === id))
      .filter((circle): circle is NonNullable<typeof circle> => circle !== undefined)
      .map((circle) => ({ id: circle._id as string, label: circle.name, color: circle.color })),
  ];

  const anims = useRef<Record<string, Animated.Value>>({}).current;
  const getAnim = (id: string) => {
    if (!anims[id]) anims[id] = new Animated.Value(id === selectedId ? 1 : 0);
    return anims[id];
  };

  // The selection can also change from outside (the header dropdown), so keep
  // every underline in step with `selectedId`.
  useEffect(() => {
    Object.keys(anims).forEach((id) => {
      Animated.timing(anims[id], {
        toValue: id === selectedId ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
    getAnim(selectedId);
  }, [selectedId]);

  const selectCircle = (id: string) => {
    if (reorderMode || id === selectedId) return;
    Animated.timing(getAnim(selectedId), { toValue: 0, duration: 220, useNativeDriver: false }).start();
    Animated.timing(getAnim(id), { toValue: 1, duration: 220, useNativeDriver: false }).start();
    onSelect(id);
  };

  const finishDrag = (dx: number) => {
    const id = dragId.current;
    if (!id) return;
    const currentIndex = orderedCustomIds.indexOf(id);
    const layout = layouts.get(id);
    if (currentIndex >= 0 && layout) {
      const center = layout.x + layout.width / 2 + dx;
      let targetIndex = currentIndex;
      orderedCustomIds.forEach((otherId, index) => {
        const other = layouts.get(otherId);
        if (other && center > other.x + other.width / 2) targetIndex = index;
      });
      if (targetIndex !== currentIndex) {
        const next = [...orderedCustomIds];
        next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, id);
        setOrderedCustomIds(next);
        next.forEach((circleId, index) => {
          reorderCircle({ userId, circleId: circleId as Id<'userCircles'>, sortOrder: index });
        });
      }
    }
    dragId.current = null;
    setDraggingId(null);
    setDragOffset(0);
  };

  const renderCircle = (circle: { id: string; label: string; color: string }) => {
    const isBuiltIn = circle.id === 'all' || circle.id === 'best-friends';
    const isSelected = circle.id === selectedId;
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => reorderMode && !isBuiltIn,
      onStartShouldSetPanResponderCapture: () => reorderMode && !isBuiltIn,
      onMoveShouldSetPanResponder: (_, gesture) => reorderMode && !isBuiltIn && Math.abs(gesture.dx) > 3,
      onMoveShouldSetPanResponderCapture: (_, gesture) => reorderMode && !isBuiltIn && Math.abs(gesture.dx) > 3,
      onPanResponderGrant: () => {
        dragId.current = circle.id;
        setDraggingId(circle.id);
        setDragOffset(0);
      },
      onPanResponderMove: (_, gesture) => setDragOffset(gesture.dx),
      onPanResponderRelease: (_, gesture) => finishDrag(gesture.dx),
      onPanResponderTerminate: () => finishDrag(0),
    });

    return (
      <Animated.View
        key={circle.id}
        {...(reorderMode && !isBuiltIn ? responder.panHandlers : {})}
        style={draggingId === circle.id ? { transform: [{ translateX: dragOffset }] } : undefined}
        onLayout={(event) => {
          if (!isBuiltIn) layouts.set(circle.id, { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width });
        }}
      >
        <AnimatedPressable
          onPress={() => selectCircle(circle.id)}
          onLongPress={() => {
            if (!reorderMode && !isBuiltIn) {
              const data = myCircles?.find((item) => item._id === circle.id);
              if (data) setActionCircle(data);
            }
          }}
          style={styles.tab}
        >
          <View style={styles.labelWrap}>
            <Text style={[styles.label, { color: isSelected ? circle.color : colors.textMuted }]}>{circle.label}</Text>
            {hasNewByCircle?.[circle.id] && <Badge dot style={styles.newDot} />}
          </View>
          <Animated.View style={[styles.underline, { backgroundColor: circle.color, opacity: getAnim(circle.id).interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]} />
        </AnimatedPressable>
      </Animated.View>
    );
  };

  return (
    <>
      <ScrollView horizontal scrollEnabled={!reorderMode} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {allCircles.map(renderCircle)}
        <AnimatedPressable onPress={() => setCreateVisible(true)} style={styles.tab}>
          <View style={styles.addLabelWrap}>
            <HugeiconsIcon icon={PlusSignIcon} size={14} color={colors.textMuted} />
            <Text style={[styles.label, styles.addLabel]}>Add Circle</Text>
          </View>
          <View style={styles.underlineSpacer} />
        </AnimatedPressable>
      </ScrollView>
      <CreateCircleSheet visible={createVisible} userId={userId} onClose={() => setCreateVisible(false)} onCreated={(circleId) => { setCreateVisible(false); setInviteCircleId(circleId); }} />
      <InviteToCircleSheet visible={inviteCircleId !== null} userId={userId} circleId={inviteCircleId} onClose={() => setInviteCircleId(null)} />
      <CircleActionsSheet
        visible={actionCircle !== null}
        circle={
          actionCircle
            ? {
                id: actionCircle._id as Id<'userCircles'>,
                label: actionCircle.name,
                color: actionCircle.color,
                ownerId: actionCircle.ownerId,
              }
            : null
        }
        userId={userId}
        onClose={() => setActionCircle(null)}
        onReorder={() => setReorderMode(true)}
        onOpenGroupChat={onOpenGroupChat}
        onLeft={(id) => {
          if (id === selectedId) onSelect(STATIC_CIRCLES[0].id);
        }}
      />
      {reorderMode && <AnimatedPressable style={styles.doneReorder} onPress={() => setReorderMode(false)}><Text style={styles.doneReorderText}>Done</Text></AnimatedPressable>}
    </>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xl, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  tab: { alignItems: 'center' },
  labelWrap: { position: 'relative' },
  newDot: { top: -2, right: -8 },
  label: { ...typography.h3 },
  addLabel: { color: colors.textMuted },
  underline: { alignSelf: 'stretch', marginTop: 6, height: 3, borderRadius: 2 },
  addLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: space.xxs + 2 },
  underlineSpacer: { marginTop: 6, height: 3 },
  doneReorder: { alignSelf: 'center', marginBottom: space.xs, paddingHorizontal: space.md, paddingVertical: space.xxs + 2, borderRadius: radius.md, backgroundColor: colors.buttonBackground },
  doneReorderText: { ...typography.bodyBold, color: colors.buttonText },
});
