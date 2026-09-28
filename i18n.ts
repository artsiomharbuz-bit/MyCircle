import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './locales/common.json';
import welcome from './locales/welcome.json';
import login from './locales/login.json';
import register from './locales/register.json';
import onboardingName from './locales/onboardingName.json';
import onboardingDob from './locales/onboardingDob.json';
import onboardingUsername from './locales/onboardingUsername.json';
import onboardingAvatar from './locales/onboardingAvatar.json';
import home from './locales/home.json';
import explore from './locales/explore.json';
import guestExplore from './locales/guestExplore.json';
import discoverFriends from './locales/discoverFriends.json';
import search from './locales/search.json';
import profile from './locales/profile.json';
import profileActivity from './locales/profileActivity.json';
import settings from './locales/settings.json';
import adsSettings from './locales/adsSettings.json';
import blockedAccounts from './locales/blockedAccounts.json';
import dms from './locales/dms.json';
import chat from './locales/chat.json';
import chatInfo from './locales/chatInfo.json';
import groupChat from './locales/groupChat.json';
import groupInfo from './locales/groupInfo.json';
import createGroup from './locales/createGroup.json';
import manageAdmins from './locales/manageAdmins.json';
import notifications from './locales/notifications.json';
import followList from './locales/followList.json';
import postDetails from './locales/postDetails.json';
import audienceSelection from './locales/audienceSelection.json';
import storyAudience from './locales/storyAudience.json';
import storyViewer from './locales/storyViewer.json';
import camera from './locales/camera.json';
import editMedia from './locales/editMedia.json';
import clips from './locales/clips.json';
import sound from './locales/sound.json';
import manageSounds from './locales/manageSounds.json';
import createAd from './locales/createAd.json';
import adModInbox from './locales/adModInbox.json';
import modInbox from './locales/modInbox.json';
import banned from './locales/banned.json';
import components from './locales/components.json';
import highlights from './locales/highlights.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'ar', label: 'العربية' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const RTL_LANGUAGES: LanguageCode[] = ['ar'];

const namespaceModules: Record<string, Record<string, object>> = {
  common,
  welcome,
  login,
  register,
  onboardingName,
  onboardingDob,
  onboardingUsername,
  onboardingAvatar,
  home,
  explore,
  guestExplore,
  discoverFriends,
  search,
  profile,
  profileActivity,
  settings,
  adsSettings,
  blockedAccounts,
  dms,
  chat,
  chatInfo,
  groupChat,
  groupInfo,
  createGroup,
  manageAdmins,
  notifications,
  followList,
  postDetails,
  audienceSelection,
  storyAudience,
  storyViewer,
  camera,
  editMedia,
  clips,
  sound,
  manageSounds,
  createAd,
  adModInbox,
  modInbox,
  banned,
  components,
  highlights,
};

const resources: Record<string, Record<string, object>> = {};
for (const code of SUPPORTED_LANGUAGES.map((l) => l.code)) {
  resources[code] = {};
}
for (const [namespace, byLanguage] of Object.entries(namespaceModules)) {
  for (const code of SUPPORTED_LANGUAGES.map((l) => l.code)) {
    resources[code][namespace] = byLanguage[code] ?? byLanguage.en ?? {};
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: Object.keys(namespaceModules),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
