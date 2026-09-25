import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Oswald_700Bold } from '@expo-google-fonts/oswald';
import {
  Poppins_400Regular,
  Poppins_400Regular_Italic,
  Poppins_600SemiBold,
  Poppins_600SemiBold_Italic,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Unbounded_500Medium } from '@expo-google-fonts/unbounded';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Caveat_700Bold } from '@expo-google-fonts/caveat';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from 'convex/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Notifications from 'expo-notifications';
import { api } from './convex/_generated/api';
import { Id } from './convex/_generated/dataModel';
import {
  getStoredUserId,
  setStoredUserId,
  clearStoredUserId,
  getSavedAccountIds,
  addSavedAccountId,
  getStoredSessionToken,
  setStoredSessionToken,
  clearStoredSessionToken,
} from './session';
import { SessionTokenProvider } from './SessionContext';
import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import OnboardingNameScreen from './screens/OnboardingNameScreen';
import OnboardingDobScreen from './screens/OnboardingDobScreen';
import OnboardingUsernameScreen from './screens/OnboardingUsernameScreen';
import OnboardingAvatarScreen from './screens/OnboardingAvatarScreen';
import HomeScreen from './screens/HomeScreen';
import ExploreScreen from './screens/ExploreScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProfileActivityScreen, { ProfileActivityMode } from './screens/ProfileActivityScreen';
import BottomNavBar from './components/BottomNavBar';
import SearchScreen from './screens/SearchScreen';
import DiscoverFriendsScreen from './screens/DiscoverFriendsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import FollowListScreen from './screens/FollowListScreen';
import CameraScreen, { CapturedMedia, ContentType, PostKind } from './screens/CameraScreen';
import EditMediaScreen, { PersistedSound, PersistedTextOverlay } from './screens/EditMediaScreen';
import PostDetailsScreen, { PostDetails } from './screens/PostDetailsScreen';
import AudienceSelectionScreen from './screens/AudienceSelectionScreen';
import StoryAudienceScreen from './screens/StoryAudienceScreen';
import StoryViewerScreen from './screens/StoryViewerScreen';
import ClipsScreen from './screens/ClipsScreen';
import SoundScreen from './screens/SoundScreen';
import ManageSoundsScreen from './screens/ManageSoundsScreen';
import DMsScreen from './screens/DMsScreen';
import ChatScreen from './screens/ChatScreen';
import ChatInfoScreen from './screens/ChatInfoScreen';
import CreateGroupScreen from './screens/CreateGroupScreen';
import GroupChatScreen from './screens/GroupChatScreen';
import GroupInfoScreen from './screens/GroupInfoScreen';
import SettingsScreen from './screens/SettingsScreen';
import BlockedAccountsScreen from './screens/BlockedAccountsScreen';
import AdsSettingsScreen from './screens/AdsSettingsScreen';
import CreateAdScreen, { MyAd } from './screens/CreateAdScreen';
import AdModInboxScreen from './screens/AdModInboxScreen';
import ManageAdminsScreen from './screens/ManageAdminsScreen';
import ModInboxScreen from './screens/ModInboxScreen';
import BannedScreen from './screens/BannedScreen';
import AccountAlertPopup from './components/AccountAlertPopup';
import RestrictedNoticeModal from './components/RestrictedNoticeModal';
import { clearModToken } from './modSession';
import { fetchNetworkInfo } from './deviceInfo';
import { ThemeProvider } from './ThemeContext';
import SplashOverlay from './components/SplashOverlay';
import LegalUpdateModal from './components/LegalUpdateModal';
import AppErrorBoundary from './components/AppErrorBoundary';
import ErrorToast from './components/ErrorToast';
import { acknowledgeLegal, getLegalUpdate } from './legal';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// The client's own logger prints every failed call with console.error, which
// pops up as a red "Convex error" box in a dev build even when the app already
// handles it. Route it to console.log instead (still visible in Metro).
const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL as string, {
  logger: {
    log: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.log(...args),
    error: (...args: unknown[]) => console.log(...args),
    logVerbose: () => {},
  },
});

type Screen =
  | 'welcome'
  | 'login'
  | 'register'
  | 'onboarding-name'
  | 'onboarding-dob'
  | 'onboarding-username'
  | 'onboarding-avatar'
  | 'home'
  | 'explore'
  | 'search'
  | 'discover-friends'
  | 'profile'
  | 'profile-activity'
  | 'follow-list'
  | 'camera'
  | 'edit-media'
  | 'post-details'
  | 'audience-selection'
  | 'clips'
  | 'dms'
  | 'chat'
  | 'chat-info'
  | 'create-group'
  | 'group-chat'
  | 'group-info'
  | 'settings'
  | 'manage-admins'
  | 'mod-inbox'
  | 'notifications'
  | 'story-audience'
  | 'story-viewer'
  | 'sound'
  | 'manage-sounds'
  | 'blocked-accounts'
  | 'ads-settings'
  | 'create-ad'
  | 'ad-mod-inbox';

type ProfileFrame =
  | { screen: 'profile'; userId: Id<'users'> }
  | { screen: 'follow-list'; userId: Id<'users'>; listType: 'followers' | 'following' };

type PersistentTab = 'home' | 'explore' | 'search' | 'dms' | 'profile-own';
const PERSISTENT_TABS: PersistentTab[] = ['home', 'explore', 'search', 'dms', 'profile-own'];

const styles = StyleSheet.create({
  tabVisible: { flex: 1 },
  tabHidden: { display: 'none' },
});

function AppContent() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  // The active account's session token — see SessionContext.tsx, which is
  // what actually hands this to every useAuthedQuery/useAuthedMutation call
  // app-wide via the provider wrapped around this component's own render
  // below, rather than threading it through every screen's props.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  // One BottomNavBar instance, mounted here rather than inside each of the
  // five screens it appears on — it used to be a separate instance per
  // screen, which meant navigating away from a tab unmounted its animation
  // mid-flight (a tap's animation only ever played in full when it didn't
  // navigate anywhere, e.g. tapping the tab you're already on). Living here
  // instead means switching screens never interrupts it. scrollY is shared
  // the same way, since it also drives that screen's CollapsibleHeader.
  const navScrollY = useRef(new Animated.Value(0)).current;
  const mountedTabs = useRef(new Set<PersistentTab>());
  const mountedFor = useRef<Id<'users'> | null>(null);
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [username, setUsername] = useState('');
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  // Extra pictures picked alongside the first, for a swipeable post.
  const [extraMedia, setExtraMedia] = useState<CapturedMedia[]>([]);
  const [postKind, setPostKind] = useState<PostKind>('post');
  const [postDetails, setPostDetails] = useState<PostDetails | null>(null);
  const [postTextOverlay, setPostTextOverlay] = useState<PersistedTextOverlay | null>(null);
  const [postSound, setPostSound] = useState<PersistedSound>(null);
  const [cameraContentType, setCameraContentType] = useState<ContentType>('Post');
  const [storyViewerAuthorId, setStoryViewerAuthorId] = useState<Id<'users'> | null>(null);
  const [storyReturnScreen, setStoryReturnScreen] = useState<Screen>('home');
  const [clipsInitialPostId, setClipsInitialPostId] = useState<Id<'posts'> | null>(null);
  const [clipsReturnScreen, setClipsReturnScreen] = useState<Screen>('explore');
  const [chatWithUserId, setChatWithUserId] = useState<Id<'users'> | null>(null);
  const [groupChatId, setGroupChatId] = useState<Id<'groupChats'> | null>(null);
  const [viewedSoundId, setViewedSoundId] = useState<Id<'sounds'> | null>(null);
  const [soundReturnScreen, setSoundReturnScreen] = useState<Screen>('home');
  // null = creating a new ad; set when editing a rejected one to resubmit.
  const [editingAd, setEditingAd] = useState<MyAd | null>(null);
  // The report queue is reachable from two places, so back has to retrace
  // whichever one opened it.
  const [modInboxReturn, setModInboxReturn] = useState<Screen>('dms');

  // Every account ever logged into on this device, for the account switcher.
  const [savedAccountIds, setSavedAccountIds] = useState<Id<'users'>[]>([]);
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const rememberAccount = (id: Id<'users'>) => {
    addSavedAccountId(id).then((ids) => setSavedAccountIds(ids as Id<'users'>[]));
  };

  const switchAccount = (id: Id<'users'>) => {
    // A moderator unlock belongs to one account and one session — switching
    // away from it has to drop the token, not carry it across.
    clearModToken();
    setUserId(id);
    setStoredUserId(id);
    getStoredSessionToken(id).then(setSessionToken);
    setViewedProfileUserId(id);
    setProfileStack([]);
    setScreen('home');
  };

  // Profile / follow-list drill-down: a tiny navigation stack so "back" can retrace
  // Search -> someone's profile -> their followers -> another profile -> etc.
  const [viewedProfileUserId, setViewedProfileUserId] = useState<Id<'users'> | null>(null);
  const [profileActivityMode, setProfileActivityMode] = useState<ProfileActivityMode>('liked');
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [profileStack, setProfileStack] = useState<ProfileFrame[]>([]);
  const [profileStackOrigin, setProfileStackOrigin] = useState<Screen>('home');

  const pushProfileFrame = (frame: ProfileFrame) => {
    setProfileStack((prev) => {
      if (prev.length === 0) {
        setProfileStackOrigin(screen);
      }
      return [...prev, frame];
    });
    setViewedProfileUserId(frame.userId);
    if (frame.screen === 'follow-list') {
      setFollowListType(frame.listType);
    }
    setScreen(frame.screen);
  };

  const popProfileFrame = () => {
    setProfileStack((prev) => {
      const next = prev.slice(0, -1);
      if (next.length === 0) {
        setScreen(profileStackOrigin);
      } else {
        const top = next[next.length - 1];
        setViewedProfileUserId(top.userId);
        if (top.screen === 'follow-list') {
          setFollowListType(top.listType);
        }
        setScreen(top.screen);
      }
      return next;
    });
  };

  const openOwnProfile = () => {
    setViewedProfileUserId(userId);
    setProfileStack([]);
    setScreen('profile');
  };

  const openSound = (soundId: Id<'sounds'>) => {
    setViewedSoundId(soundId);
    setSoundReturnScreen(screen);
    setScreen('sound');
  };

  // Shared by every remix's "jump to the original clip" tap — from a post
  // card, a clip already open in ClipsScreen, or a remixed story. Always
  // opens the standalone Clips viewer, never another remix.
  const openClip = (postId: Id<'posts'>) => {
    setClipsInitialPostId(postId);
    setClipsReturnScreen(screen === 'clips' ? clipsReturnScreen : screen);
    setScreen('clips');
  };

  // Session restore: was there a logged-in/registered user last time we opened the app?
  const [storedUserId, setStoredUserIdState] = useState<Id<'users'> | null | undefined>(
    undefined
  );
  const [routed, setRouted] = useState(false);

  useEffect(() => {
    getStoredUserId().then((id) => setStoredUserIdState((id as Id<'users'> | null) ?? null));
    getSavedAccountIds().then((ids) => setSavedAccountIds(ids as Id<'users'>[]));
  }, []);

  const restoredUser = useQuery(
    api.users.getUser,
    storedUserId ? { userId: storedUserId } : 'skip'
  );

  useEffect(() => {
    if (routed) return;
    if (storedUserId === undefined) return;

    if (storedUserId === null) {
      setRouted(true);
      return;
    }

    if (restoredUser === undefined) return;

    if (restoredUser === null) {
      clearStoredUserId();
      setRouted(true);
      return;
    }

    // An account saved from before session tokens existed (or a token that
    // never made it to storage) can't make any protected call — treat it as
    // logged out rather than routing to 'home' and having every screen's
    // queries skip forever.
    getStoredSessionToken(storedUserId).then((token) => {
      if (!token) {
        clearStoredUserId();
        setRouted(true);
        return;
      }
      setUserId(storedUserId);
      setSessionToken(token);
      rememberAccount(storedUserId);
      setScreen(restoredUser.onboardingComplete ? 'home' : 'onboarding-name');
      setRouted(true);
    });
  }, [storedUserId, restoredUser, routed]);

  // Ban state, active restrictions and any unacknowledged warning or strike.
  const accountStatus = useQuery(
    api.moderation.getAccountStatus,
    userId && sessionToken ? { userId, sessionToken } : 'skip'
  );
  const unreadMessageCount = useQuery(
    api.messages.getUnreadMessageCount,
    userId && sessionToken ? { userId, sessionToken } : 'skip'
  );
  const recordSession = useMutation(api.moderation.recordSession);

  // Policy/terms heads-up: shown once per logged-in session whenever their
  // text has changed since this device last acknowledged (see legal.ts).
  const [legalUpdate, setLegalUpdate] = useState<{ privacy: boolean; terms: boolean } | null>(null);
  useEffect(() => {
    if (!userId) {
      setLegalUpdate(null);
      return;
    }
    getLegalUpdate().then(setLegalUpdate);
  }, [userId]);

  // The restriction notice is a one-time heads-up per app open, not an
  // acknowledgeable alert row — it just tracks whether this session has
  // shown it yet, and resets on the next cold start.
  const [restrictedNoticeSeen, setRestrictedNoticeSeen] = useState(false);
  useEffect(() => {
    setRestrictedNoticeSeen(false);
  }, [userId]);

  // The device reports its own public IP and rough location once per session
  // — a Convex mutation can't see the requesting socket, and the moderation
  // Information page needs both.
  useEffect(() => {
    if (!userId || !sessionToken) return;
    let cancelled = false;
    fetchNetworkInfo().then((info) => {
      if (cancelled) return;
      recordSession({
        userId,
        sessionToken,
        ip: info.ip,
        location: info.location,
        lat: info.lat,
        lng: info.lng,
      }).catch(() => {
        // Best-effort telemetry — a stale session here must never surface.
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, sessionToken]);

  const deleteSession = useMutation(api.users.deleteSession);

  const logOut = () => {
    clearModToken();
    clearStoredUserId();
    if (userId && sessionToken) {
      clearStoredSessionToken(userId);
      deleteSession({ token: sessionToken }).catch(() => {});
    }
    setUserId(null);
    setSessionToken(null);
    setViewedProfileUserId(null);
    setProfileStack([]);
    setScreen('welcome');
  };

  // `target` lets the always-mounted tab screens (see below) render a screen
  // other than the current one; `ownProfile` pins the profile tab to the
  // signed-in user even while the shared 'profile' screen is showing someone else.
  const renderScreen = (target: Screen = screen, ownProfile = false) => {
    switch (target) {
    case 'login':
      return (
        <LoginScreen
          onBack={() => {
            if (isAddingAccount) {
              setIsAddingAccount(false);
              setScreen('profile');
            } else {
              setScreen('welcome');
            }
          }}
          onSwitchToRegister={() => setScreen('register')}
          onLoggedIn={(loggedInUserId, loggedInSessionToken, onboardingComplete) => {
            setUserId(loggedInUserId);
            setSessionToken(loggedInSessionToken);
            rememberAccount(loggedInUserId);
            setIsAddingAccount(false);
            setScreen(onboardingComplete ? 'home' : 'onboarding-name');
          }}
        />
      );

    case 'register':
      return (
        <RegisterScreen
          onBack={() => {
            if (isAddingAccount) {
              setIsAddingAccount(false);
              setScreen('profile');
            } else {
              setScreen('welcome');
            }
          }}
          onSwitchToLogin={() => setScreen('login')}
          onRegistered={(newUserId, newSessionToken) => {
            // They agreed to the current policy/terms while signing up.
            acknowledgeLegal();
            setUserId(newUserId);
            setSessionToken(newSessionToken);
            rememberAccount(newUserId);
            setIsAddingAccount(false);
            setScreen('onboarding-name');
          }}
        />
      );

    case 'onboarding-name':
      return (
        <OnboardingNameScreen
          onBack={() => setScreen('welcome')}
          onNext={(value) => {
            setName(value);
            setScreen('onboarding-dob');
          }}
        />
      );

    case 'onboarding-dob':
      return (
        <OnboardingDobScreen
          onBack={() => setScreen('onboarding-name')}
          onNext={(value) => {
            setDateOfBirth(value);
            setScreen('onboarding-username');
          }}
        />
      );

    case 'onboarding-username':
      return (
        <OnboardingUsernameScreen
          onBack={() => setScreen('onboarding-dob')}
          onNext={(value) => {
            setUsername(value);
            setScreen('onboarding-avatar');
          }}
        />
      );

    case 'onboarding-avatar':
      return (
        <OnboardingAvatarScreen
          userId={userId as Id<'users'>}
          name={name}
          username={username}
          dateOfBirth={dateOfBirth}
          onBack={() => setScreen('onboarding-username')}
          onDone={() => setScreen('home')}
        />
      );

    case 'home':
      return (
        <HomeScreen
          userId={userId as Id<'users'>}
          scrollY={navScrollY}
          onOpenCamera={() => {
            setCameraContentType('Post');
            setScreen('camera');
          }}
          onOpenDiscoverFriends={() => setScreen('discover-friends')}
          onOpenNotifications={() => setScreen('notifications')}
          onAddStory={() => {
            setCameraContentType('Story');
            setScreen('camera');
          }}
          onOpenStory={(authorId) => {
            setStoryViewerAuthorId(authorId);
            setStoryReturnScreen('home');
            setScreen('story-viewer');
          }}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
          onOpenSound={openSound}
          onOpenClip={openClip}
          onOpenGroupChat={(groupId) => {
            setGroupChatId(groupId);
            setScreen('group-chat');
          }}
        />
      );

    case 'notifications':
      return (
        <NotificationsScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('home')}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
          onOpenAds={() => setScreen('ads-settings')}
        />
      );

    case 'explore':
      return (
        <ExploreScreen
          userId={userId as Id<'users'>}
          scrollY={navScrollY}
          onOpenCamera={() => {
            setCameraContentType('Post');
            setScreen('camera');
          }}
          onOpenSearch={() => setScreen('search')}
          onOpenDiscoverFriends={() => setScreen('discover-friends')}
          onOpenClip={(postId) => {
            setClipsInitialPostId(postId);
            setClipsReturnScreen('explore');
            setScreen('clips');
          }}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
          onOpenStory={(authorId) => {
            setStoryViewerAuthorId(authorId);
            setStoryReturnScreen('explore');
            setScreen('story-viewer');
          }}
          onOpenSound={openSound}
        />
      );

    case 'discover-friends':
      return (
        <DiscoverFriendsScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('home')}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
        />
      );

    case 'dms':
      return (
        <DMsScreen
          userId={userId as Id<'users'>}
          scrollY={navScrollY}
          onOpenDiscoverFriends={() => setScreen('discover-friends')}
          onOpenChat={(otherUserId) => {
            setChatWithUserId(otherUserId);
            setScreen('chat');
          }}
          onOpenGroupChat={(groupId) => {
            setGroupChatId(groupId);
            setScreen('group-chat');
          }}
          onOpenCreateGroup={() => setScreen('create-group')}
          onOpenModInbox={() => {
            setModInboxReturn('dms');
            setScreen('mod-inbox');
          }}
        />
      );

    case 'chat':
      return (
        <ChatScreen
          currentUserId={userId as Id<'users'>}
          otherUserId={chatWithUserId as Id<'users'>}
          onBack={() => setScreen('dms')}
          onOpenInfo={() => setScreen('chat-info')}
        />
      );

    case 'chat-info':
      return (
        <ChatInfoScreen
          currentUserId={userId as Id<'users'>}
          otherUserId={chatWithUserId as Id<'users'>}
          onBack={() => setScreen('chat')}
          onChatCleared={() => setScreen('chat')}
        />
      );

    case 'create-group':
      return (
        <CreateGroupScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('dms')}
          onCreated={(groupId) => {
            setGroupChatId(groupId);
            setScreen('group-chat');
          }}
        />
      );

    case 'group-chat':
      return (
        <GroupChatScreen
          groupId={groupChatId as Id<'groupChats'>}
          currentUserId={userId as Id<'users'>}
          onBack={() => setScreen('dms')}
          onOpenInfo={() => setScreen('group-info')}
        />
      );

    case 'group-info':
      return (
        <GroupInfoScreen
          groupId={groupChatId as Id<'groupChats'>}
          currentUserId={userId as Id<'users'>}
          onBack={() => setScreen('group-chat')}
          onChatCleared={() => setScreen('group-chat')}
          onLeft={() => setScreen('dms')}
        />
      );

    case 'clips':
      return (
        <ClipsScreen
          key={clipsInitialPostId}
          userId={userId as Id<'users'>}
          initialPostId={clipsInitialPostId as Id<'posts'>}
          onClose={() => setScreen(clipsReturnScreen)}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
          onOpenStory={(authorId) => {
            setStoryViewerAuthorId(authorId);
            setStoryReturnScreen('clips');
            setScreen('story-viewer');
          }}
          onOpenSound={openSound}
          onOpenOriginal={openClip}
        />
      );

    case 'search':
      return (
        <SearchScreen
          userId={userId as Id<'users'>}
          scrollY={navScrollY}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
        />
      );

    case 'profile':
      return (
        <ProfileScreen
          viewedUserId={(ownProfile ? userId : viewedProfileUserId ?? userId) as Id<'users'>}
          currentUserId={userId as Id<'users'>}
          savedAccountIds={savedAccountIds}
          onSwitchAccount={switchAccount}
          onAddAccount={() => {
            setIsAddingAccount(true);
            setScreen('login');
          }}
          onBack={popProfileFrame}
          scrollY={navScrollY}
          onOpenSettings={() => setScreen('settings')}
          onOpenFollowers={() =>
            pushProfileFrame({
              screen: 'follow-list',
              userId: (ownProfile ? userId : viewedProfileUserId ?? userId) as Id<'users'>,
              listType: 'followers',
            })
          }
          onOpenFollowing={() =>
            pushProfileFrame({
              screen: 'follow-list',
              userId: (ownProfile ? userId : viewedProfileUserId ?? userId) as Id<'users'>,
              listType: 'following',
            })
          }
          onOpenClip={(postId) => {
            setClipsInitialPostId(postId);
            setClipsReturnScreen('profile');
            setScreen('clips');
          }}
          onOpenStory={(authorId) => {
            setStoryViewerAuthorId(authorId);
            setStoryReturnScreen('profile');
            setScreen('story-viewer');
          }}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
          onOpenSound={openSound}
          onOpenLiked={() => {
            setProfileActivityMode('liked');
            setScreen('profile-activity');
          }}
          onOpenSaved={() => {
            setProfileActivityMode('saved');
            setScreen('profile-activity');
          }}
          onOpenChat={(otherUserId) => {
            setChatWithUserId(otherUserId);
            setScreen('chat');
          }}
        />
      );

    case 'profile-activity':
      return (
        <ProfileActivityScreen
          userId={userId as Id<'users'>}
          mode={profileActivityMode}
          onBack={() => setScreen('profile')}
          onOpenClip={(postId) => {
            setClipsInitialPostId(postId);
            setClipsReturnScreen('profile-activity');
            setScreen('clips');
          }}
          onOpenStory={(authorId) => {
            setStoryViewerAuthorId(authorId);
            setStoryReturnScreen('profile-activity');
            setScreen('story-viewer');
          }}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
          onOpenSound={openSound}
        />
      );

    case 'settings':
      return (
        <SettingsScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('profile')}
          onLogout={logOut}
          onOpenManageAdmins={() => setScreen('manage-admins')}
          onOpenModInbox={() => {
            setModInboxReturn('settings');
            setScreen('mod-inbox');
          }}
          onOpenSounds={() => setScreen('manage-sounds')}
          onOpenBlockedAccounts={() => setScreen('blocked-accounts')}
          onOpenAds={() => setScreen('ads-settings')}
          onOpenAdModInbox={() => setScreen('ad-mod-inbox')}
        />
      );

    case 'blocked-accounts':
      return (
        <BlockedAccountsScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('settings')}
        />
      );

    case 'ads-settings':
      return (
        <AdsSettingsScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('settings')}
          onCreateAd={() => {
            setEditingAd(null);
            setScreen('create-ad');
          }}
          onEditAd={(ad) => {
            setEditingAd(ad);
            setScreen('create-ad');
          }}
        />
      );

    case 'create-ad':
      return (
        <CreateAdScreen
          userId={userId as Id<'users'>}
          editingAd={editingAd}
          onBack={() => setScreen('ads-settings')}
          onDone={() => {
            setEditingAd(null);
            setScreen('ads-settings');
          }}
        />
      );

    case 'ad-mod-inbox':
      return (
        <AdModInboxScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('settings')}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
        />
      );

    case 'manage-admins':
      return (
        <ManageAdminsScreen
          adminId={userId as Id<'users'>}
          onBack={() => setScreen('settings')}
        />
      );

    case 'mod-inbox':
      return (
        <ModInboxScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen(modInboxReturn)}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
        />
      );

    case 'sound':
      return (
        <SoundScreen
          soundId={viewedSoundId as Id<'sounds'>}
          viewerId={userId as Id<'users'>}
          onBack={() => setScreen(soundReturnScreen)}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
          onOpenClip={(postId) => {
            setClipsInitialPostId(postId);
            setClipsReturnScreen('sound');
            setScreen('clips');
          }}
        />
      );

    case 'manage-sounds':
      return (
        <ManageSoundsScreen
          userId={userId as Id<'users'>}
          onBack={() => setScreen('settings')}
          onOpenSound={openSound}
        />
      );

    case 'follow-list':
      return (
        <FollowListScreen
          userId={viewedProfileUserId as Id<'users'>}
          type={followListType}
          currentUserId={userId as Id<'users'>}
          onBack={popProfileFrame}
          onOpenUser={(targetId) => pushProfileFrame({ screen: 'profile', userId: targetId })}
        />
      );

    case 'camera':
      return (
        <CameraScreen
          initialContentType={cameraContentType}
          onClose={() => setScreen('home')}
          onCaptured={(media, kind, extras) => {
            setCapturedMedia(media);
            setExtraMedia(kind === 'post' ? extras ?? [] : []);
            setPostKind(kind);
            setScreen('edit-media');
          }}
        />
      );

    case 'edit-media':
      return (
        <EditMediaScreen
          userId={userId as Id<'users'>}
          media={capturedMedia as CapturedMedia}
          kind={postKind}
          onBack={() => setScreen('camera')}
          onConfirm={(media, textOverlay, sound) => {
            setCapturedMedia(media);
            setPostTextOverlay(textOverlay);
            setPostSound(sound);
            setScreen(postKind === 'story' ? 'story-audience' : 'post-details');
          }}
        />
      );

    case 'story-audience':
      return (
        <StoryAudienceScreen
          userId={userId as Id<'users'>}
          media={capturedMedia as CapturedMedia}
          textOverlay={postTextOverlay}
          onBack={() => setScreen('edit-media')}
          onPosted={() => {
            setCapturedMedia(null);
            setPostKind('post');
            setPostTextOverlay(null);
            setPostSound(null);
            setScreen('home');
          }}
        />
      );

    case 'story-viewer':
      return (
        <StoryViewerScreen
          authorId={storyViewerAuthorId as Id<'users'>}
          viewerId={userId as Id<'users'>}
          onClose={() => {
            setStoryViewerAuthorId(null);
            setScreen(storyReturnScreen);
          }}
          onOpenClip={(postId) => {
            setStoryViewerAuthorId(null);
            openClip(postId);
          }}
        />
      );

    case 'post-details':
      return (
        <PostDetailsScreen
          userId={userId as Id<'users'>}
          media={capturedMedia as CapturedMedia}
          kind={postKind as Exclude<PostKind, 'story'>}
          onBack={() => setScreen('edit-media')}
          onNext={(details) => {
            setPostDetails(details);
            setScreen('audience-selection');
          }}
        />
      );

    case 'audience-selection':
      return (
        <AudienceSelectionScreen
          userId={userId as Id<'users'>}
          media={capturedMedia as CapturedMedia}
          kind={postKind as Exclude<PostKind, 'story'>}
          title={postDetails?.title ?? ''}
          caption={postDetails?.caption ?? ''}
          containsAi={postDetails?.containsAi ?? false}
          creatorLanguage={postDetails?.language ?? null}
          poll={postDetails?.poll ?? null}
          textOverlay={postTextOverlay}
          sound={postSound}
          extraMedia={extraMedia}
          onBack={() => setScreen('post-details')}
          onPosted={() => {
            setCapturedMedia(null);
            setExtraMedia([]);
            setPostKind('post');
            setPostDetails(null);
            setPostTextOverlay(null);
            setPostSound(null);
            setScreen('home');
          }}
        />
      );

    default:
      return (
        <WelcomeScreen
          onLogin={() => setScreen('login')}
          onRegister={() => setScreen('register')}
        />
      );
    }
  };

  if (!routed) {
    return null;
  }

  // The nav bar shows on the five tab screens — 'profile' only while it's
  // actually showing the signed-in user's own profile (pushProfileFrame
  // reuses the 'profile' screen for viewing anyone else's, which never gets
  // the bar, same as ProfileScreen used to gate its own local instance).
  const isOwnProfileScreen =
    screen === 'profile' && (viewedProfileUserId === null || viewedProfileUserId === userId);
  const showNavBar =
    screen === 'home' ||
    screen === 'explore' ||
    screen === 'search' ||
    screen === 'dms' ||
    isOwnProfileScreen;
  const activeTabKey: PersistentTab | null = isOwnProfileScreen
    ? 'profile-own'
    : screen === 'home' || screen === 'explore' || screen === 'search' || screen === 'dms'
      ? screen
      : null;
  if (mountedFor.current !== userId) {
    mountedFor.current = userId;
    mountedTabs.current.clear();
  }
  if (activeTabKey && userId) mountedTabs.current.add(activeTabKey);

  const navActiveTab =
    screen === 'home' ||
    screen === 'explore' ||
    screen === 'search' ||
    screen === 'dms'
      ? screen
      : 'profile';

  // A banned account gets the explanation screen instead of the app. Every
  // write is refused server-side too, so this isn't the only line of defence.
  if (userId && accountStatus?.isBanned) {
    return (
      <BannedScreen
        bannedUntil={accountStatus.bannedUntil}
        strikeCount={accountStatus.strikeCount}
        onLogout={logOut}
      />
    );
  }

  return (
    <SessionTokenProvider sessionToken={sessionToken}>
      {/* The five tab screens stay mounted once opened (hidden, not unmounted)
          so switching back is instant and keeps their scroll position and
          loaded data instead of reloading every time. */}
      {PERSISTENT_TABS.map(
        (key) =>
          mountedTabs.current.has(key) && (
            <View
              key={`${userId}-${key}`}
              style={key === activeTabKey ? styles.tabVisible : styles.tabHidden}
            >
              {key === 'profile-own' ? renderScreen('profile', true) : renderScreen(key)}
            </View>
          )
      )}
      {activeTabKey === null && renderScreen()}

      {showNavBar && (
        <BottomNavBar
          active={navActiveTab}
          unreadMessageCount={unreadMessageCount}
          scrollY={navScrollY}
          onPressHome={() => setScreen('home')}
          onPressExplore={() => setScreen('explore')}
          onPressCreate={() => {
            setCameraContentType('Post');
            setScreen('camera');
          }}
          onPressDMs={() => setScreen('dms')}
          onPressProfile={openOwnProfile}
        />
      )}

      {userId && accountStatus?.pendingAlert && (
        <AccountAlertPopup
          alert={accountStatus.pendingAlert}
          userId={userId}
          strikeCount={accountStatus.strikeCount}
        />
      )}

      {userId && !accountStatus?.pendingAlert && legalUpdate && (
        <LegalUpdateModal
          visible
          privacy={legalUpdate.privacy}
          terms={legalUpdate.terms}
          onAcknowledge={() => {
            acknowledgeLegal();
            setLegalUpdate(null);
          }}
        />
      )}

      {/* Only once any warning/strike popup has been cleared — otherwise the
          two would stack. */}
      {userId &&
        !accountStatus?.pendingAlert &&
        accountStatus?.isRestricted &&
        !restrictedNoticeSeen && (
          <RestrictedNoticeModal
            visible
            restrictedUntil={accountStatus.restrictedUntil}
            onDismiss={() => setRestrictedNoticeSeen(true)}
          />
        )}
    </SessionTokenProvider>
  );

}

export default function App() {
  // Bumped to restart the whole app tree after an error screen.
  const [appInstance, setAppInstance] = useState(0);
  const [fontsLoaded] = useFonts({
    Oswald_700Bold,
    Fredoka_600SemiBold,
    Caveat_700Bold,
    BebasNeue_400Regular,
    PermanentMarker_400Regular,
    Pacifico_400Regular,
    Anton_400Regular,
    ArchivoBlack_400Regular,
    Poppins_400Regular,
    Poppins_400Regular_Italic,
    Poppins_600SemiBold,
    Poppins_600SemiBold_Italic,
    Poppins_700Bold,
    Unbounded_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <KeyboardProvider>
          <ConvexProvider client={convex}>
            <AppErrorBoundary
              onReset={(sessionExpired) => {
                if (sessionExpired) clearStoredUserId();
                setAppInstance((n) => n + 1);
              }}
            >
              <AppContent key={appInstance} />
            </AppErrorBoundary>
            <ErrorToast />
          </ConvexProvider>
          <SplashOverlay />
        </KeyboardProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
