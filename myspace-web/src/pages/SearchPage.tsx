import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthedQuery as useQuery } from '../lib/auth';
import { Search as SearchIcon } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { AppShell } from '../layout/AppShell';
import { Avatar } from '../components/Avatar';
import { RowSkeletonList } from '../components/Skeleton';
import { useAuth } from '../lib/auth';

export function SearchPage() {
  const { userId } = useAuth();
  const [params, setParams] = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';

  const results = useQuery(api.search.search, { query: q, viewerId: userId ?? undefined });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(value.trim() ? { q: value.trim() } : {});
  };

  return (
    <AppShell>
      <form onSubmit={onSubmit} className="relative">
        <SearchIcon
          size={16}
          strokeWidth={2.25}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mc-text-muted)]"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          placeholder="Search people, posts, #hashtags"
          className="w-full bg-[var(--mc-surface)] border border-[var(--mc-border)] rounded-full pl-10 pr-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[var(--mc-accent)]"
        />
      </form>

      {!q && (
        <div className="text-center py-16">
          <SearchIcon size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--mc-text-muted)] opacity-60" />
          <p className="text-[var(--mc-text-muted)]">Search for people or posts.</p>
        </div>
      )}

      {q && results === undefined && (
        <div className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] divide-y divide-[var(--mc-border)] overflow-hidden">
          <RowSkeletonList count={4} />
        </div>
      )}

      {q && results && results.users.length === 0 && results.posts.length === 0 && results.clips.length === 0 && (
        <div className="text-center py-16">
          <SearchIcon size={32} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--mc-text-muted)] opacity-60" />
          <p className="text-[var(--mc-text-muted)]">No results for "{q}".</p>
        </div>
      )}

      {!!results?.users.length && (
        <section className="bg-[var(--mc-surface)] rounded-xl border border-[var(--mc-border)] divide-y divide-[var(--mc-border)] overflow-hidden">
          <h2 className="px-4 py-2 text-[13px] font-semibold text-[var(--mc-text-muted)]">People</h2>
          {results.users.map(
            (u) =>
              u && (
                <Link
                  key={u._id}
                  to={`/profile/${u._id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--mc-nav-hover)] transition"
                >
                  <Avatar user={u} size={40} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] truncate">{u.name || u.username}</p>
                    {u.username && <p className="text-[13px] text-[var(--mc-text-muted)]">@{u.username}</p>}
                  </div>
                </Link>
              )
          )}
        </section>
      )}

      {!!results?.posts.length && (
        <section>
          <h2 className="px-1 py-2 text-[13px] font-semibold text-[var(--mc-text-muted)]">Posts</h2>
          <div className="grid grid-cols-3 gap-1">
            {results.posts.map(
              (p) =>
                p && (
                  <Link
                    key={p._id}
                    to={`/post/${p._id}`}
                    className="aspect-square bg-[var(--mc-surface)] border border-[var(--mc-border)] rounded-lg overflow-hidden"
                  >
                    {p.mediaUrl && <img src={p.mediaUrl} alt="" className="w-full h-full object-cover" />}
                  </Link>
                )
            )}
          </div>
        </section>
      )}
    </AppShell>
  );
}
