import { useState } from 'react';
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from '../SessionContext';
import {
  Flag02Icon,
  InformationCircleIcon,
  Legal01Icon,
  ShieldUserIcon,
  UserBlock01Icon,
} from '@hugeicons/core-free-icons';
import ActionSheet, { SheetAction } from './ActionSheet';
import ModerationSheet from './ModerationSheet';
import NativePopup from './nativepopup';
import ProfileReportModal from './ProfileReportModal';
import UserInformationModal from './UserInformationModal';
import UserLogsModal from './UserLogsModal';
import { useModGate } from './ModGate';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

// The three-dot menu on a profile. Members see Report; moderators also get
// Moderation, Information and Logs — each of which needs the session unlocked
// with a password before it opens.
export default function ProfileOptionsSheet({
  visible,
  targetUserId,
  targetUsername,
  viewerId,
  onClose,
}: {
  visible: boolean;
  targetUserId: Id<'users'>;
  targetUsername?: string;
  viewerId: Id<'users'>;
  onClose: () => void;
}) {
  const modStatus = useQuery(api.moderation.getModStatus, { userId: viewerId });
  const target = useQuery(
    api.moderation.getModerationTarget,
    modStatus?.isMod && visible ? { targetUserId, modId: viewerId } : 'skip'
  );
  const blockStatus = useQuery(
    api.blocks.isBlocked,
    visible ? { viewerId, otherUserId: targetUserId } : 'skip'
  );
  const blockUser = useMutation(api.blocks.blockUser);
  const unblockUser = useMutation(api.blocks.unblockUser);
  const { run, gate } = useModGate(viewerId);

  const [reportOpen, setReportOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [informationOpen, setInformationOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const isSelf = targetUserId === viewerId;
  const actions: SheetAction[] = [];

  if (!isSelf && !target?.isMainAdmin) {
    if (blockStatus?.blockedByMe) {
      actions.push({
        key: 'unblock',
        label: 'Unblock this account',
        description: 'They can see your posts and profile again',
        icon: UserBlock01Icon,
        onPress: () => {
          onClose();
          unblockUser({ blockerId: viewerId, blockedId: targetUserId });
        },
      });
    } else {
      actions.push({
        key: 'block',
        label: 'Block this account',
        description: "Neither of you will see each other's posts, clips or stories",
        icon: UserBlock01Icon,
        tone: 'danger',
        onPress: () => {
          onClose();
          setBlockConfirmOpen(true);
        },
      });
    }

    actions.push({
      key: 'report',
      label: 'Report this profile',
      description: 'Describe the problem and attach evidence',
      icon: Flag02Icon,
      tone: 'danger',
      onPress: () => {
        onClose();
        setReportOpen(true);
      },
    });
  }

  if (modStatus?.isMod && !isSelf) {
    actions.push({
      key: 'moderation',
      label: 'Moderation',
      description: 'Restrict, warn, ban, verify or give a strike',
      icon: ShieldUserIcon,
      onPress: () => {
        onClose();
        run(() => setModerationOpen(true));
      },
    });
  }

  // Information/Logs are for reviewing someone else's account, not a mod's
  // own — same reasoning as excluding Report/Moderation above.
  if (modStatus?.isMod && !isSelf) {
    actions.push(
      {
        key: 'information',
        label: 'Information',
        description: 'Email, IP addresses, last online and location',
        icon: InformationCircleIcon,
        onPress: () => {
          onClose();
          run(() => setInformationOpen(true));
        },
      },
      {
        key: 'logs',
        label: 'Logs',
        description: 'Everything moderators have done to this account',
        icon: Legal01Icon,
        onPress: () => {
          onClose();
          run(() => setLogsOpen(true));
        },
      }
    );
  }

  return (
    <>
      <ActionSheet
        visible={visible}
        title={targetUsername ? `@${targetUsername}` : 'Profile options'}
        subtitle={
          target?.isMainAdmin
            ? 'This is the Main Admin account. It cannot be reported or moderated.'
            : undefined
        }
        actions={actions}
        onClose={onClose}
      />

      <NativePopup
        visible={blockConfirmOpen}
        title="Block this account?"
        message={`${targetUsername ? `@${targetUsername}` : 'This account'} won't be able to see your posts, clips, stories or profile — and you won't see theirs.`}
        confirmLabel="Block"
        onClose={() => setBlockConfirmOpen(false)}
        onConfirm={() => {
          blockUser({ blockerId: viewerId, blockedId: targetUserId });
        }}
      />

      <ProfileReportModal
        visible={reportOpen}
        targetUserId={targetUserId}
        targetUsername={targetUsername}
        reporterId={viewerId}
        onClose={() => setReportOpen(false)}
      />

      <ModerationSheet
        visible={moderationOpen}
        targetUserId={targetUserId}
        modId={viewerId}
        onClose={() => setModerationOpen(false)}
      />

      <UserInformationModal
        visible={informationOpen}
        targetUserId={targetUserId}
        modId={viewerId}
        onClose={() => setInformationOpen(false)}
      />

      <UserLogsModal
        visible={logsOpen}
        targetUserId={targetUserId}
        targetUsername={targetUsername}
        modId={viewerId}
        onClose={() => setLogsOpen(false)}
      />

      {gate}
    </>
  );
}
