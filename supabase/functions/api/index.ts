import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const secretKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!secretKey) throw new Error('Supabase Edge Function secret key is missing.');
const storageAdmin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Edge isolates are short-lived and can scale horizontally. Use Supabase's
// shared transaction pooler URL when configured to avoid consuming one direct
// Postgres connection per isolate. Transaction pooling requires prepare:false.
const databaseUrl = Deno.env.get('APP_DATABASE_POOLER_URL') ?? Deno.env.get('SUPABASE_DB_URL');
if (!databaseUrl) throw new Error('Supabase database connection URL is missing.');
const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  max_lifetime: 60,
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const modules: Record<string, () => Promise<Record<string, any>>> = {
  ads: () => import('./backend/convex/ads.ts'),
  affinity: () => import('./backend/convex/affinity.ts'),
  auth: () => import('./backend/convex/auth.ts'),
  blocks: () => import('./backend/convex/blocks.ts'),
  bookmarks: () => import('./backend/convex/bookmarks.ts'),
  circles: () => import('./backend/convex/circles.ts'),
  comments: () => import('./backend/convex/comments.ts'),
  engagement: () => import('./backend/convex/engagement.ts'),
  follows: () => import('./backend/convex/follows.ts'),
  groups: () => import('./backend/convex/groups.ts'),
  highlights: () => import('./backend/convex/highlights.ts'),
  impressions: () => import('./backend/convex/impressions.ts'),
  languageDetection: () => import('./backend/convex/languageDetection.ts'),
  likes: () => import('./backend/convex/likes.ts'),
  messages: () => import('./backend/convex/messages.ts'),
  moderation: () => import('./backend/convex/moderation.ts'),
  moderationAuth: () => import('./backend/convex/moderationAuth.ts'),
  notifications: () => import('./backend/convex/notifications.ts'),
  polls: () => import('./backend/convex/polls.ts'),
  posts: () => import('./backend/convex/posts.ts'),
  push: () => import('./backend/convex/push.ts'),
  search: () => import('./backend/convex/search.ts'),
  sounds: () => import('./backend/convex/sounds.ts'),
  stickers: () => import('./backend/convex/stickers.ts'),
  stories: () => import('./backend/convex/stories.ts'),
  typing: () => import('./backend/convex/typing.ts'),
  userCircles: () => import('./backend/convex/userCircles.ts'),
  users: () => import('./backend/convex/users.ts'),
};

type Condition = { op: string; field: string; value: any };
type Expr = Condition | { op: 'and' | 'or'; values: Expr[] } | { op: 'not'; value: Expr };
const fieldName = (value: any) => typeof value === 'string' ? value : value?.field;

function filterOps(): any {
  return {
    field: (field: string) => ({ field }),
    eq: (left: any, value: any) => ({ op: 'eq', field: fieldName(left), value }),
    neq: (left: any, value: any) => ({ op: 'neq', field: fieldName(left), value }),
    gt: (left: any, value: any) => ({ op: 'gt', field: fieldName(left), value }),
    gte: (left: any, value: any) => ({ op: 'gte', field: fieldName(left), value }),
    lt: (left: any, value: any) => ({ op: 'lt', field: fieldName(left), value }),
    lte: (left: any, value: any) => ({ op: 'lte', field: fieldName(left), value }),
    and: (...values: Expr[]) => ({ op: 'and', values }),
    or: (...values: Expr[]) => ({ op: 'or', values }),
    not: (value: Expr) => ({ op: 'not', value }),
  };
}

function matches(row: any, expr: Expr): boolean {
  if (expr.op === 'and') return expr.values.every((value) => matches(row, value));
  if (expr.op === 'or') return expr.values.some((value) => matches(row, value));
  if (expr.op === 'not') return !matches(row, expr.value);
  const actual = row[expr.field];
  switch (expr.op) {
    case 'eq': return actual === expr.value;
    case 'neq': return actual !== expr.value;
    case 'gt': return actual > expr.value;
    case 'gte': return actual >= expr.value;
    case 'lt': return actual < expr.value;
    case 'lte': return actual <= expr.value;
    default: return false;
  }
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Invalid database identifier.');
  return `"${value}"`;
}

function compileExpression(expr: Expr, values: any[]): string {
  if (expr.op === 'and' || expr.op === 'or') {
    if (expr.values.length === 0) return expr.op === 'and' ? 'true' : 'false';
    return `(${expr.values.map((value) => compileExpression(value, values)).join(expr.op === 'and' ? ' AND ' : ' OR ')})`;
  }
  if (expr.op === 'not') return `(NOT ${compileExpression(expr.value, values)})`;
  const field = quoteIdentifier(expr.field);
  if (expr.value === undefined) {
    if (expr.op === 'eq') return `${field} IS NULL`;
    if (expr.op === 'neq') return `${field} IS NOT NULL`;
  }
  values.push(expr.value);
  const parameter = `$${values.length}`;
  const operator: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
  const sqlOperator = operator[expr.op];
  if (!sqlOperator) throw new Error(`Unsupported query operator: ${expr.op}`);
  return `${field} ${sqlOperator} ${parameter}`;
}

function toDoc(row: any): any {
  if (!row) return null;
  const { id, _creationTime, ...values } = row;
  for (const key of Object.keys(values)) if (values[key] === null) delete values[key];
  return { ...values, _id: id, _creationTime };
}

function tableFromId(id: string): string | null {
  const splitAt = id.indexOf(':');
  return splitAt > 0 ? id.slice(0, splitAt) : null;
}

function fail(error: any): never {
  if (error) throw new Error(error.message ?? String(error));
  throw new Error('Supabase operation failed.');
}

class Query {
  private indexFilters: Condition[] = [];
  private predicates: Expr[] = [];
  private direction: 'asc' | 'desc' = 'desc';

  constructor(private table: string, private tx: any) {}

  private copy(): Query {
    const copy = new Query(this.table, this.tx);
    copy.indexFilters = [...this.indexFilters];
    copy.predicates = [...this.predicates];
    copy.direction = this.direction;
    return copy;
  }

  withIndex(_name: string, build?: (q: any) => any): Query {
    const copy = this.copy();
    if (build) {
      const builder = {
        eq(field: string, value: any) { copy.indexFilters.push({ op: 'eq', field, value }); return this; },
        neq(field: string, value: any) { copy.indexFilters.push({ op: 'neq', field, value }); return this; },
        gt(field: string, value: any) { copy.indexFilters.push({ op: 'gt', field, value }); return this; },
        gte(field: string, value: any) { copy.indexFilters.push({ op: 'gte', field, value }); return this; },
        lt(field: string, value: any) { copy.indexFilters.push({ op: 'lt', field, value }); return this; },
        lte(field: string, value: any) { copy.indexFilters.push({ op: 'lte', field, value }); return this; },
      };
      build(builder);
    }
    return copy;
  }

  filter(build: (q: any) => Expr): Query {
    const copy = this.copy();
    copy.predicates.push(build(filterOps()));
    return copy;
  }

  order(direction: 'asc' | 'desc'): Query {
    const copy = this.copy();
    copy.direction = direction;
    return copy;
  }

  async collect(): Promise<any[]> { return this.execute(); }
  async take(count: number): Promise<any[]> { return this.execute(count); }
  async first(): Promise<any | null> { return (await this.execute(1))[0] ?? null; }
  async unique(): Promise<any | null> {
    const rows = await this.execute(2);
    if (rows.length > 1) throw new Error(`Expected at most one ${this.table} row.`);
    return rows[0] ?? null;
  }

  private async execute(count?: number): Promise<any[]> {
    const table = quoteIdentifier(this.table);
    const values: any[] = [];
    const clauses: string[] = [];
    for (const condition of this.indexFilters) {
      clauses.push(compileExpression(condition as Expr, values));
    }
    for (const predicate of this.predicates) {
      clauses.push(compileExpression(predicate, values));
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const limit = count === undefined ? 50_000 : Math.max(0, count);
    values.push(limit);
    const rows = await this.tx.unsafe(
      `SELECT * FROM public.${table}${where} ORDER BY "_creationTime" ${this.direction.toUpperCase()} LIMIT $${values.length}`,
      values
    );
    if (count === undefined && rows.length === limit) {
      throw new Error(`Query on ${this.table} exceeded the 50,000 row safety limit.`);
    }
    return rows.map(toDoc);
  }
}

function createContext(tx: any): any {
  const dbApi = {
    get: async (id: string) => {
      if (!id) return null;
      const table = tableFromId(id);
      if (!table) return null;
      const rows = await tx.unsafe(`SELECT * FROM public.${quoteIdentifier(table)} WHERE "id" = $1 LIMIT 1`, [id]);
      return toDoc(rows[0] ?? null);
    },
    query: (table: string) => new Query(table, tx),
    insert: async (table: string, values: any) => {
      const row = toRow(values);
      const keys = Object.keys(row);
      const columns = keys.map(quoteIdentifier).join(', ');
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
      const rows = await tx.unsafe(
        `INSERT INTO public.${quoteIdentifier(table)} (${columns}) VALUES (${placeholders}) RETURNING "id"`,
        keys.map((key) => row[key])
      );
      return rows[0].id;
    },
    patch: async (id: string, values: any) => {
      const table = tableFromId(id);
      if (!table) throw new Error('Invalid database row id.');
      const row = toRow(values);
      const keys = Object.keys(row);
      if (!keys.length) return;
      const setters = keys.map((key, index) => `${quoteIdentifier(key)} = $${index + 1}`).join(', ');
      await tx.unsafe(`UPDATE public.${quoteIdentifier(table)} SET ${setters} WHERE "id" = $${keys.length + 1}`, [...keys.map((key) => row[key]), id]);
    },
    replace: async (id: string, values: any) => {
      const table = tableFromId(id);
      if (!table) throw new Error('Invalid database row id.');
      const row = { ...toRow(values), id };
      const keys = Object.keys(row);
      const columns = keys.map(quoteIdentifier).join(', ');
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
      const setters = keys.filter((key) => key !== 'id').map((key) => `${quoteIdentifier(key)} = EXCLUDED.${quoteIdentifier(key)}`).join(', ');
      await tx.unsafe(`INSERT INTO public.${quoteIdentifier(table)} (${columns}) VALUES (${placeholders}) ON CONFLICT ("id") DO UPDATE SET ${setters}`, keys.map((key) => row[key]));
    },
    delete: async (id: string) => {
      const table = tableFromId(id);
      if (!table) return;
      await tx.unsafe(`DELETE FROM public.${quoteIdentifier(table)} WHERE "id" = $1`, [id]);
    },
  };

  const context: any = {
    db: dbApi,
    storage: {
      generateUploadUrl: async () => {
        const path = crypto.randomUUID();
        const { data, error } = await storageAdmin.storage.from('media').createSignedUploadUrl(path);
        if (error) throw error;
        const url = data.signedUrl.startsWith('http')
          ? data.signedUrl
          : `${supabaseUrl}/storage/v1${data.signedUrl.startsWith('/') ? '' : '/'}${data.signedUrl}`;
        const payload = encodeURIComponent(JSON.stringify({ url, storageId: `media/${path}` }));
        return `supabase-upload://${payload}`;
      },
      getUrl: async (storageId: string) => {
        const slash = storageId.indexOf('/');
        if (slash <= 0) return null;
        const bucket = storageId.slice(0, slash);
        const path = storageId.slice(slash + 1);
        const { data, error } = await storageAdmin.storage.from(bucket).createSignedUrl(path, 7 * 24 * 60 * 60);
        if (error) return null;
        return data.signedUrl;
      },
      delete: async (storageId: string) => {
        const slash = storageId.indexOf('/');
        if (slash <= 0) return;
        const { error } = await storageAdmin.storage.from(storageId.slice(0, slash)).remove([storageId.slice(slash + 1)]);
        if (error) throw error;
      },
    },
    rateLimit: async (name: string, key: string, limit: number, windowMs: number, throws: boolean) => {
      const result = await tx.unsafe('SELECT public.consume_rate_limit($1, $2, $3) AS ok', [`${name}:${key}`, limit, windowMs]);
      const data = result[0]?.ok;
      if (!data && throws) throw new Error('You are doing that too often. Please try again later.');
      return { ok: !!data };
    },
  };

  const schedule = async (ref: any, args: any, runAt: number) => {
    const name = referenceName(ref);
    if (runAt <= Date.now()) return runNamed(context, name, args);
    await tx.unsafe('INSERT INTO public."scheduledTasks" ("functionName", "args", "runAt") VALUES ($1, $2, $3)', [name, args, runAt]);
    return 'scheduled';
  };
  context.scheduler = {
    runAfter: (delayMs: number, ref: any, args: any) => schedule(ref, args, Date.now() + delayMs),
    runAt: (timestamp: number, ref: any, args: any) => schedule(ref, args, timestamp),
  };
  context.runQuery = (ref: any, args: any) => runNamed(context, referenceName(ref), args);
  context.runMutation = context.runQuery;
  context.runAction = context.runQuery;
  return context;
}

function toRow(values: Record<string, any>): Record<string, any> {
  const row = { ...values };
  delete row._id;
  delete row._creationTime;
  for (const key of Object.keys(row)) if (row[key] === undefined) row[key] = null;
  return row;
}

function referenceName(ref: any): string {
  if (typeof ref === 'string') return ref;
  const name = ref?.[Symbol.for('functionName')];
  if (typeof name !== 'string') throw new Error('Invalid backend function reference.');
  return name;
}

async function runNamed(ctx: any, name: string, args: any, allowInternal = true): Promise<any> {
  const split = name.lastIndexOf(':');
  const moduleName = name.slice(0, split).replaceAll('/', '_');
  const functionName = name.slice(split + 1);
  const loader = modules[moduleName];
  if (!loader) throw new Error(`Unknown backend module: ${moduleName}`);
  const module = await loader();
  const registered = module[functionName];
  if (!registered?._handler) throw new Error(`Unknown backend function: ${name}`);
  if (registered._internal && !allowInternal) throw new Error('Function not found.');
  return await registered._handler(ctx, args ?? {});
}

async function runDueTasks(ctx: any, tx: any) {
  const tasks = await tx.unsafe('SELECT * FROM public."scheduledTasks" WHERE "runAt" <= $1 ORDER BY "runAt" LIMIT 20 FOR UPDATE SKIP LOCKED', [Date.now()]);
  for (const task of tasks) {
    try {
      await runNamed(ctx, task.functionName, task.args);
      await tx.unsafe('DELETE FROM public."scheduledTasks" WHERE "id" = $1', [task.id]);
    } catch (error) {
      console.error('Scheduled task failed', task.functionName, error);
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await request.json();
    const name = String(body.name ?? '');
    if (!/^[A-Za-z][A-Za-z0-9]*:[A-Za-z][A-Za-z0-9]*$/.test(name)) {
      return Response.json({ error: 'Invalid backend function name.' }, { status: 400, headers: corsHeaders });
    }
    const data = await sql.begin(async (tx) => {
      const ctx = createContext(tx);
      await runDueTasks(ctx, tx);
      return await runNamed(ctx, name, body.args ?? {}, false);
    });
    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: any) {
    const message = error?.message ?? 'The request failed.';
    console.error('Backend request failed:', message);
    return Response.json({ error: message }, { status: 200, headers: corsHeaders });
  }
});
