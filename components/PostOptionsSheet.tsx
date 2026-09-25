import { useState } from 'react';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import { AiBrain01Icon, Delete02Icon, Flag02Icon, ShieldUserIcon } from '@hugeicons/core-free-icons';
import ActionSheet, { SheetAction } from './ActionSheet';
import ConfirmActionModal from './ConfirmActionModal';
import PostReportModal from './PostReportModal';
import { useModGate } from './ModGate';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

// The three-dot menu on a post or clip. Everyone gets Report; moderators also
// get a direct takedown, which goes through the password gate and a
// confirmation screen before anything is removed.
export default function PostOptionsSheet({
  visible,
  postId,
  postKind,
  authorId,
  containsAi,
  viewerId,
  onClose,
}: {
  visible: boolean;
  postId: Id<'posts'>;
  postKind: 'post' | 'clip';
  authorId?: Id<'users'>;
  // Whether the creator already flagged this as AI — lets moderators add the
  // label when they didn't, without offering to "unlabel" it.
  containsAi?: boolean;
  viewerId: Id<'users'>;
  onClose: () => void;
}) {
  const modStatus = useQuery(api.moderation.getModStatus, { userId: viewerId });
  const deletePostAsMod = useMutation(api.moderation.deletePostAsMod);
  const labelPostAsAi = useMutation(api.moderation.labelPostAsAi);
  const { run, gate } = useModGate(viewerId);

  const [reportOpen, setReportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwnPost = authorId === viewerId;

  const actions: SheetAction[] = [];

  if (!isOwnPost) {
    actions.push({
      key: 'report',
      label: 'Report',
      description: `Tell moderators something is wrong with this ${postKind}`,
      icon: Flag02Icon,
      tone: 'danger',
      onPress: () => {
        onClose();
        setReportOpen(true);
      },
    });
  }

  if (modStatus?.isMod) {
    if (!containsAi) {
      actions.push({
        key: 'label-ai',
        label: 'Label as Contains AI',
        description: "The creator didn't flag this — add the label yourself",
        icon: AiBrain01Icon,
        onPress: () => {
          onClose();
          run((token) => labelPostAsAi({ postId, modId: viewerId, token }));
        },
      });
    }

    actions.push({
      key: 'remove',
      label: `Remove this ${postKind}`,
      description: 'Moderator takedown — deletes it for everyone',
      icon: Delete02Icon,
      tone: 'danger',
      onPress: () => {
        onClose();
        // Unlock first: the confirmation screen is only worth showing once
        // we know the takedown can actually go through.
        run(() => setConfirmDelete(true));
      },
    });
  }

  return (
    <>
      <ActionSheet
        visible={visible}
        title={postKind === 'clip' ? 'Clip options' : 'Post options'}
        subtitle={
          modStatus?.isMod
            ? 'You have moderator tools on this item.'
            : undefined
        }
        actions={actions}
        onClose={onClose}
      />

      <PostReportModal
        visible={reportOpen}
        postId={postId}
        postKind={postKind}
        reporterId={viewerId}
        onClose={() => setReportOpen(false)}
      />

      <ConfirmActionModal
        visible={confirmDelete}
        title={`Remove this ${postKind}?`}
        subtitle="This is a moderator takedown and cannot be undone."
        icon={ShieldUserIcon}
        consequences={[
          `The ${postKind} and its media are deleted permanently.`,
          'Every like, comment and bookmark on it goes too.',
          "The takedown is written to the author's log with your name.",
        ]}
        confirmLabel={`Remove ${postKind}`}
        onConfirm={async () => {
          await run((token) => deletePostAsMod({ postId, modId: viewerId, token }));
        }}
        onClose={() => setConfirmDelete(false)}
      />

      {gate}
    </>
  );
}
