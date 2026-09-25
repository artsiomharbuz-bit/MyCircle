import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { rateLimiter } from './lib/rateLimit';
import { requireUser } from './lib/session';

export const generateUploadUrl = mutation({
  args: { userId: v.id('users'), sessionToken: v.string() },
  handler: async (ctx, { userId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    await rateLimiter.limit(ctx, 'generateUploadUrl', { key: userId, throws: true });
    return ctx.storage.generateUploadUrl();
  },
});
export const create = mutation({
  args: { ownerId: v.id('users'), name: v.string(), imageStorageId: v.id('_storage'), sessionToken: v.string() },
  handler: async (ctx, { sessionToken, ...args }) => {
    await requireUser(ctx, args.ownerId, sessionToken);
    const name = args.name.trim();
    if (!name) throw new Error('A sticker name is required.');
    return ctx.db.insert('stickers', { ...args, name });
  },
});
export const list = query({
  args: { userId: v.id('users'), search: v.optional(v.string()), savedOnly: v.optional(v.boolean()), sessionToken: v.string() },
  handler: async (ctx, { userId, search, savedOnly, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const saved = await ctx.db.query('savedStickers').withIndex('by_user', q => q.eq('userId', userId)).collect();
    const savedIds = new Set(saved.map(row => row.stickerId));
    const term = search?.trim().toLowerCase() ?? '';
    const rows = await ctx.db.query('stickers').collect();
    return Promise.all(rows.filter(row => (!savedOnly || savedIds.has(row._id)) && (!term || row.name.toLowerCase().includes(term))).map(async row => ({ _id: row._id, name: row.name, imageUrl: await ctx.storage.getUrl(row.imageStorageId), isSaved: savedIds.has(row._id) })));
  },
});
export const toggleSaved = mutation({
  args: { userId: v.id('users'), stickerId: v.id('stickers'), sessionToken: v.string() },
  handler: async (ctx, { userId, stickerId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const existing = await ctx.db.query('savedStickers').withIndex('by_user_sticker', q => q.eq('userId', userId).eq('stickerId', stickerId)).unique();
    if (existing) await ctx.db.delete(existing._id); else await ctx.db.insert('savedStickers', { userId, stickerId });
  },
});

export const save = mutation({
  args: { userId: v.id('users'), stickerId: v.id('stickers'), sessionToken: v.string() },
  handler: async (ctx, { userId, stickerId, sessionToken }) => {
    await requireUser(ctx, userId, sessionToken);
    const existing = await ctx.db.query('savedStickers').withIndex('by_user_sticker', q => q.eq('userId', userId).eq('stickerId', stickerId)).unique();
    if (existing) return { alreadySaved: true };
    await ctx.db.insert('savedStickers', { userId, stickerId });
    return { alreadySaved: false };
  },
});
