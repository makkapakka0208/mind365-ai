const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const sourceCache = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
function device(database = new Map()) {
  const local = new Map();
  const control = { configured: false, offline: false, failWrite: false, afterRead: null, beforeWrite: null };
  const window = new EventTarget();
  window.localStorage = {
    getItem: k => local.get(k) ?? null,
    setItem: (k, v) => { if (control.failWrite) throw new DOMException('full', 'QuotaExceededError'); local.set(k, v); },
    removeItem: k => local.delete(k),
  };
  const modules = new Map();
  const context = vm.createContext({ window, navigator: {}, console, Event, DOMException, setTimeout, clearTimeout,
    crypto: { randomUUID }, process: { env: {} }, URL, Blob, AbortSignal });
  let account;
  const client = {
    from(table) {
      let operation = 'select', payload, filters = [];
      const query = {
        select() { return query; }, order() { return query; },
        eq(k, v) { filters.push(row => row[k] === v); return query; },
        in(k, values) { filters.push(row => values.includes(row[k])); return query; },
        update(v) { operation = 'update'; payload = v; return query; },
        insert(v) { operation = 'insert'; payload = v; return query; },
        upsert(v) { operation = 'upsert'; payload = v; return query; },
        then(resolve, reject) {
          return (async () => {
            if (control.offline) return { error: { message: 'offline' }, data: null };
            if (!database.has(table)) database.set(table, new Map());
            const rows = database.get(table);
            if (operation !== 'select' && control.beforeWrite) await control.beforeWrite(table, operation);
            if (operation === 'select') {
              const data = clone([...rows.values()].filter(r => filters.every(f => f(r))));
              if (control.afterRead) await control.afterRead(table);
              return { error: null, data };
            }
            let changed = [];
            if (operation === 'update') {
              for (const [id, row] of rows) if (filters.every(f => f(row))) {
                rows.set(id, clone({ ...row, ...payload })); changed.push({ id });
              }
            } else {
              for (const row of Array.isArray(payload) ? payload : [payload]) {
                if (operation === 'insert' && rows.has(row.id)) return { error: { message: 'duplicate key' }, data: null };
                rows.set(row.id, clone(row)); changed.push({ id: row.id });
              }
            }
            return { error: null, data: changed };
          })().then(resolve, reject);
        },
      };
      return query;
    },
  };
  const defaults = { enableSupabaseSync: false, supabaseUrl: '', supabaseAnonKey: '', supabaseUserId: '', weeklyStudyTarget: 10, weeklyReadingTarget: 7 };
  const mocks = {
    '@/lib/auth': { getCachedAuthUserId: () => account.getStorageScope().startsWith('user:') ? account.getStorageScope().slice(5) : null },
    '@/lib/api': { apiFetch: async () => { throw new Error('disabled'); } },
    '@/lib/supabase': {
      DEFAULT_SETTINGS: defaults, createDefaultSupabaseUserId: randomUUID,
      normalizeMind365Settings: s => ({ ...defaults, ...(s && typeof s === 'object' ? s : {}) }),
      getSupabaseConfig: () => control.configured ? { url: 'test', userId: 'test' } : null,
      getActiveSyncConfig: (s, uid) => control.configured && uid ? { url: 'test', userId: uid } : null,
      createMind365SupabaseClient: () => client,
    },
  };
  function load(name) {
    if (mocks[name]) return mocks[name];
    if (modules.has(name)) return modules.get(name).exports;
    const file = path.join(root, 'src', name.slice(2) + '.ts');
    if (!sourceCache.has(file)) sourceCache.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    const module = { exports: {} };
    modules.set(name, module);
    vm.runInContext(`(function(require,module,exports){${sourceCache.get(file)}\n})`, context, { filename: file })(load, module, module.exports);
    return module.exports;
  }
  account = load('@/lib/account-storage');
  const storage = load('@/lib/storage');
  return { account, storage, drafts: load('@/lib/journal-draft'), life: load('@/lib/life-path-storage'), control, local, database };
}
const diary = (text = 'original') => ({ id: randomUUID(), createdAt: '2026-09-05T00:00:00.000Z', date: '2026-09-05', mood: 6, thoughts: text, reading: '', studyHours: 0, tags: [], images: [] });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('legacy data stays guest-owned; accounts and stale scope tokens are isolated', () => {
  const d = device();
  const log = diary();
  d.local.set('daily_logs', JSON.stringify([log]));
  assert.equal(d.storage.getDailyLogs()[0].id, log.id);
  const valid = d.account.captureStorageScope();
  d.account.setStorageUser('A');
  assert.equal(d.storage.getDailyLogs().length, 0);
  assert.equal(valid(), false);
  d.storage.setDailyLogs([diary('A')]);
  d.account.setStorageUser('B');
  assert.equal(d.storage.getDailyLogs().length, 0);
  d.account.setStorageUser('A');
  assert.equal(d.storage.getDailyLogs()[0].thoughts, 'A');
  d.account.setStorageUser(null);
  assert.equal(d.storage.getDailyLogs()[0].id, log.id);
  assert.ok(d.local.has('daily_logs'));
});

test('an old device pulls newer remote text without uploading stale cached text', async () => {
  const db = new Map(); const a = device(db); const b = device(db);
  for (const d of [a, b]) { d.account.setStorageUser('A'); d.control.configured = true; }
  const log = diary();
  await a.storage.saveDailyLog(log);
  await b.storage.refreshDailyLogs();
  await a.storage.updateDailyLog({ ...a.storage.getDailyLogs()[0], thoughts: 'new on A' });
  await b.storage.refreshDailyLogs();
  assert.equal(b.storage.getDailyLogs()[0].thoughts, 'new on A');
  assert.equal(JSON.parse(db.get('diaries').get(log.id).content).thoughts, 'new on A');
});

test('offline concurrent diary edits preserve both versions and sync conflict copy', async () => {
  const db = new Map(); const a = device(db); const b = device(db);
  for (const d of [a, b]) { d.account.setStorageUser('A'); d.control.configured = true; }
  const log = diary(); await a.storage.saveDailyLog(log); await b.storage.refreshDailyLogs();
  b.control.offline = true;
  await b.storage.updateDailyLog({ ...b.storage.getDailyLogs()[0], thoughts: 'offline B' });
  assert.equal(b.storage.getDiarySyncState().pending, 1);
  await a.storage.updateDailyLog({ ...a.storage.getDailyLogs()[0], thoughts: 'online A' });
  b.control.offline = false;
  await b.storage.refreshDailyLogs(); await b.storage.refreshDailyLogs();
  assert.deepEqual(clone(b.storage.getDailyLogs().map(l => l.thoughts).sort()), ['offline B', 'online A']);
  assert.equal(db.get('diaries').size, 2);
  assert.equal(b.storage.getDiarySyncState().pending, 0);
});

test('compare-and-swap rejects a remote edit between fetch and write', async () => {
  const d = device(); d.account.setStorageUser('A'); d.control.configured = true;
  const log = diary(); await d.storage.saveDailyLog(log);
  d.control.beforeWrite = async table => {
    if (table !== 'diaries') return;
    d.control.beforeWrite = null;
    const row = d.database.get(table).get(log.id);
    row.content = JSON.stringify({ ...JSON.parse(row.content), thoughts: 'racing remote' });
  };
  const result = await d.storage.updateDailyLog({ ...d.storage.getDailyLogs()[0], thoughts: 'local edit' });
  assert.equal(result.synced, false);
  assert.equal(JSON.parse(d.database.get('diaries').get(log.id).content).thoughts, 'racing remote');
  await d.storage.refreshDailyLogs();
  assert.equal(d.storage.getDailyLogs().length, 2);
});

test('an in-flight account A refresh cannot populate account B', async () => {
  const d = device(); d.account.setStorageUser('A'); d.control.configured = true;
  await d.storage.saveDailyLog(diary('private A'));
  d.control.afterRead = async () => d.account.setStorageUser('B');
  await d.storage.refreshDailyLogs();
  assert.equal(d.storage.getDailyLogs().length, 0);
  assert.equal(d.account.accountStorage.getItem('diary_synced'), null);
});

test('offline todo deletion survives a reload and is replayed to the cloud', async () => {
  const d = device(); d.account.setStorageUser('A'); d.control.configured = true;
  d.storage.addTodo('delete offline'); await settle();
  const id = d.storage.getTodos()[0].id;
  d.control.offline = true; d.storage.deleteTodo(id); await settle();
  assert.equal(d.storage.getTodos().length, 0);
  const reloaded = device(d.database);
  for (const [k,v] of d.local) reloaded.local.set(k,v);
  reloaded.account.setStorageUser('A'); reloaded.control.configured = true;
  await reloaded.storage.refreshTodos();
  assert.equal(reloaded.storage.getTodos().length, 0);
  assert.equal(d.database.get('todos').get(id).deleted, true);
});

test('backup restores todos, inline images, drafts, reviews and Life Path; old backups preserve missing collections', async () => {
  const d = device();
  const log = diary(); log.images = ['data:image/png;base64,AAAA'];
  d.storage.setDailyLogs([log]); d.storage.addTodo('backup todo');
  const draft = { mood: 6, thoughts: 'unfinished', tags: '', images: [], base: null, savedAt: new Date().toISOString() };
  d.drafts.writeJournalDraft(log.date, draft);
  d.account.accountStorage.setItem('reviews', JSON.stringify({ weekly: { w: 'reflection' }, monthly: {}, yearly: {} }));
  d.life.saveGoals([{ id: 'goal1', title: 'Read', targetValue: 10, currentValue: 1 }]);
  const raw = JSON.stringify(d.storage.getMind365BackupData());
  const next = device(); const result = next.storage.importMind365Backup(raw); await settle();
  assert.equal(result.todos, 1); assert.equal(next.storage.getTodos()[0].text, 'backup todo');
  assert.equal(next.storage.getDailyLogs()[0].images[0], log.images[0]);
  assert.equal(next.drafts.readJournalDraft(log.date).thoughts, 'unfinished');
  assert.equal(next.life.loadGoals()[0].title, 'Read');
  assert.match(next.account.accountStorage.getItem('reviews'), /reflection/);
  next.storage.importMind365Backup(JSON.stringify({ daily_logs: [], quotes: [], notes: [] }));
  assert.equal(next.storage.getTodos().length, 1);
  assert.equal(next.drafts.readJournalDraft(log.date).thoughts, 'unfinished');
});

test('invalid backup and quota failure leave every collection unchanged', () => {
  const d = device(); d.storage.setDailyLogs([diary('keep')]);
  const before = JSON.stringify([...d.local]);
  assert.throws(() => d.storage.importMind365Backup('{}'));
  assert.throws(() => d.storage.importMind365Backup(JSON.stringify({ daily_logs: [{}], quotes: [], notes: [] })));
  assert.equal(JSON.stringify([...d.local]), before);
  d.control.failWrite = true;
  assert.throws(() => d.storage.importMind365Backup(JSON.stringify({ daily_logs: [diary('new')], quotes: [], notes: [] })));
  assert.equal(JSON.stringify([...d.local]), before);
  assert.equal(d.storage.getDailyLogs()[0].thoughts, 'keep');
});

test('foreign backup IDs are remapped and connection settings are never imported', () => {
  const d = device(); d.account.setStorageUser('B');
  const log = diary();
  d.storage.importMind365Backup(JSON.stringify({ version: 3, scope: 'user:A', daily_logs: [log], quotes: [], notes: [], settings: { supabaseUrl: 'foreign', supabaseUserId: 'A' } }));
  assert.notEqual(d.storage.getDailyLogs()[0].id, log.id);
  assert.equal(d.storage.getSettings().supabaseUrl, '');
});

test('drafts survive date changes/reload and remain account-isolated', () => {
  const d = device(); d.account.setStorageUser('A');
  const draft = { mood: 6, thoughts: 'keep typing', tags: '', images: [], base: null, savedAt: new Date().toISOString() };
  d.drafts.writeJournalDraft('2026-09-05', draft);
  d.drafts.writeJournalDraft('2026-09-04', { ...draft, thoughts: 'yesterday' });
  assert.equal(d.drafts.readJournalDraft('2026-09-05').thoughts, draft.thoughts);
  d.account.setStorageUser('B'); assert.equal(d.drafts.readJournalDraft('2026-09-05'), null);
  d.account.setStorageUser('A'); d.drafts.removeJournalDraft('2026-09-05');
  assert.equal(d.drafts.readJournalDraft('2026-09-05'), null);
  assert.equal(d.drafts.readJournalDraft('2026-09-04').thoughts, 'yesterday');
});
