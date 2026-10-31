const windows: Record<string, [number, number]> = {
  registerByEmail: [3, 60 * 60_000], registerGlobal: [20, 60_000],
  loginByEmail: [8, 15 * 60_000], loginGlobal: [40, 60_000], modUnlock: [5, 15 * 60_000],
  createPost: [4, 60 * 60_000], createStory: [5, 60 * 60_000],
  createHighlight: [15, 24 * 60 * 60_000], createRemix: [5, 60 * 60_000],
  createAd: [10, 24 * 60 * 60_000], addComment: [8, 10 * 60_000],
  sendMessage: [10, 60_000], sendGroupMessage: [10, 60_000], generateUploadUrl: [10, 60 * 60_000],
  toggleLike: [20, 60_000], toggleBookmark: [20, 60_000], follow: [10, 60_000],
  createCircle: [10, 24 * 60 * 60_000], createGroup: [10, 24 * 60 * 60_000],
  inviteToCircle: [10, 10 * 60_000], report: [5, 60 * 60_000], blockUser: [10, 60_000],
};

export const rateLimiter = {
  async limit(ctx: any, name: string, options: { key?: string; throws?: boolean } = {}) {
    const [limit, windowMs] = windows[name] ?? [60, 60_000];
    return ctx.rateLimit(name, options.key ?? 'global', limit, windowMs, options.throws ?? false);
  },
};
