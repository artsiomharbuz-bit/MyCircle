import { LEGAL_VERSIONS } from './legalVersions';

export type LegalDocKey = 'privacy' | 'terms' | 'guidelines';

export type LegalDoc = {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
};

// Draft text describing how MyCircle actually behaves today. It should be
// reviewed by a lawyer before launch; when it changes, bump the matching
// date in legal.ts so users get the "Heads up" popup.
export const legalDocs: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: LEGAL_VERSIONS.privacy,
    sections: [
      {
        heading: 'What we collect',
        body:
          'Account details you give us (email, name, username, date of birth, profile photo, bio, pronouns and link), the posts, clips, stories, comments, messages, stickers and sounds you create, and who you follow, block or add to a circle.',
      },
      {
        heading: 'Device and location data',
        body:
          'Once per session your device reports its public IP address and a rough, IP-derived location. We use it for safety, moderation and coarse regional relevance. We never collect precise GPS location and we never show it to other users.',
      },
      {
        heading: 'How we use it',
        body:
          'To run MyCircle: show you content from your circles and Explore, rank feeds, deliver messages and notifications, keep the community safe and enforce our rules. Content marked Global is visible to everyone; content shared to circles is visible only to those circles.',
      },
      {
        heading: 'Sharing',
        body:
          'We do not sell your personal data. Your public profile, Global posts and clips are visible to other users. We use service providers (such as hosting and storage) to operate the app, and we may disclose information when the law requires it or to protect people from harm.',
      },
      {
        heading: 'Your choices',
        body:
          'You can edit your profile, block accounts, choose who sees each post, hide AI content, turn discoverability off, and delete individual posts. Chat backgrounds, mute and cleared chats are stored only on your device.',
      },
      {
        heading: 'Retention and security',
        body:
          'We keep your data while your account is active and delete content you remove. We protect data with encryption in transit and access controls, but no system is perfectly secure.',
      },
      {
        heading: 'Children',
        body: 'MyCircle is not for children under 13. If you believe a child has an account, contact us and we will remove it.',
      },
      {
        heading: 'Changes',
        body: 'When we change this policy we update the date above and show you a heads-up in the app.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: LEGAL_VERSIONS.terms,
    sections: [
      {
        heading: 'Using MyCircle',
        body:
          'You must be at least 13, give accurate information and keep your password safe. You are responsible for what happens on your account.',
      },
      {
        heading: 'Your content',
        body:
          'You own what you post. You give MyCircle a licence to host, display and distribute it as needed to run the service, including letting others remix Global clips into their circles. Only post things you have the right to share.',
      },
      {
        heading: 'Rules',
        body:
          'No harassment, hate, threats, sexual content involving minors, graphic violence, spam, scams, impersonation or illegal activity. Label AI-generated content. Do not attempt to break, scrape or abuse the service.',
      },
      {
        heading: 'Moderation',
        body:
          'We may remove content, restrict features, issue warnings and strikes, or ban accounts that break these terms. Three strikes result in a permanent ban. You can report content and accounts from their menus.',
      },
      {
        heading: 'Advertising',
        body: 'Ads are reviewed before they run. Advertisers are responsible for their ads and any payments they make.',
      },
      {
        heading: 'Disclaimer and liability',
        body:
          'MyCircle is provided as is, without warranties. To the extent the law allows, we are not liable for indirect or consequential losses arising from your use of the service.',
      },
      {
        heading: 'Changes',
        body:
          'We may update these terms. When we do we update the date above and show you a heads-up in the app; continuing to use MyCircle means you accept the new terms.',
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    updated: LEGAL_VERSIONS.terms,
    sections: [
      { heading: 'Be kind', body: 'Treat people with respect. Disagree without attacking anyone.' },
      { heading: 'Keep it safe', body: 'Do not share content that threatens, exploits or endangers others, or that promotes self-harm.' },
      { heading: 'Be honest', body: 'No impersonation, scams or misleading content. Mark posts that contain AI-generated media.' },
      { heading: 'Respect privacy', body: 'Do not post other people\'s private information or media without their consent.' },
      { heading: 'Report problems', body: 'Use the menu on any post, profile or sound to report it. Our moderators review reports.' },
    ],
  },
};
