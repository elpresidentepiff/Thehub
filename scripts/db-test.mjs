// Proves the Hub database on a throwaway local Postgres. No Supabase project is touched.
//
//   npm run db:test
//
// 1. initdb a private cluster in a temp dir (unix socket only, trust auth, random port)
// 2. apply scripts/db/local-supabase-stub.sql (roles, auth.uid/jwt) then supabase/migrations/*
// 3. load pgTAP (pinned tarball, sha-256 checked, cached in ~/.cache/thehub)
// 4. seed the real registry (data/inventory/*.json) through private.upsert_inventory
// 5. run supabase/tests/database/*.test.sql (TAP; any "not ok" fails)
// 6. race: many concurrent sessions try to hold overlapping periods on one desk; the
//    database must never hold two overlapping periods for the same unit
// 7. stop the cluster and delete it, whatever happened
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PGTAP = {
  version: '1.3.3',
  url: 'https://github.com/theory/pgtap/archive/refs/tags/v1.3.3.tar.gz',
  sha256: '325ea79d0d2515bce96bce43f6823dcd3effbd6c54cb2a4d6c2384fffa3a14c7',
};

const pgBin = process.env.PG_BIN ?? ['17', '16', '15'].map((v) => `/usr/lib/postgresql/${v}/bin`).find((d) => existsSync(join(d, 'initdb')));
if (!pgBin) {
  console.error('db-test: no Postgres server binaries found. Install postgresql or set PG_BIN.');
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), 'hub-db-'));
const port = String(40000 + Math.floor(Math.random() * 20000));
const conn = ['-h', tmp, '-p', port, '-U', 'postgres'];  // same superuser name as Supabase
let failures = 0;
const log = (s) => console.log(s);
const fail = (s) => { failures++; console.error(`FAIL ${s}`); };

function run(cmd, args, opts = {}) {
  const r = spawnSync(join(pgBin, cmd), args, { encoding: 'utf8', ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  }
  return r;
}
const psql = (db, extra, opts) => run('psql', [...conn, '-d', db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...extra], opts);

async function pgtapSql() {
  const dir = join(homedir(), '.cache', 'thehub');
  const out = join(dir, `pgtap-${PGTAP.version}.sql`);
  if (existsSync(out)) return out;
  mkdirSync(dir, { recursive: true });
  const res = await fetch(PGTAP.url);
  if (!res.ok) throw new Error(`pgTAP download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== PGTAP.sha256) throw new Error(`pgTAP checksum mismatch: ${got}`);
  const tgz = join(dir, `pgtap-${PGTAP.version}.tar.gz`);
  writeFileSync(tgz, buf);
  const tar = spawnSync('tar', ['-xzf', tgz, '-C', dir, `pgtap-${PGTAP.version}/sql/pgtap.sql.in`], { encoding: 'utf8' });
  if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`);
  const src = readFileSync(join(dir, `pgtap-${PGTAP.version}`, 'sql', 'pgtap.sql.in'), 'utf8');
  writeFileSync(out, src.replaceAll('__OS__', 'linux').replaceAll('__VERSION__', PGTAP.version.split('.').slice(0, 2).join('.')));
  return out;
}

function tap(name, output) {
  const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
  const planned = Number((lines.find((l) => /^1\.\.\d+$/.test(l)) ?? '1..0').slice(3));
  const oks = lines.filter((l) => /^ok \d+/.test(l)).length;
  const bad = lines.filter((l) => /^not ok \d+/.test(l));
  const diag = lines.filter((l) => l.startsWith('#'));
  if (bad.length || oks !== planned || planned === 0) {
    fail(`${name}: ${oks}/${planned} passed`);
    for (const l of [...bad, ...diag]) console.error(`   ${l}`);
  } else {
    log(`ok   ${name}: ${oks}/${planned}`);
  }
}

async function race(label, attempts) {
  // Each attempt is its own psql session, all started at once.
  const results = await Promise.all(attempts.map(({ start, end, hash }) => new Promise((resolve) => {
    const sql = `set role service_role; select id from private.acquire_hold('L2-D001', '${race.price}', ` +
      `date_trunc('day', now()) + interval '2 days' + interval '${start} minutes', ` +
      `date_trunc('day', now()) + interval '2 days' + interval '${end} minutes', 10, null, '${hash}');`;
    const p = spawn(join(pgBin, 'psql'), [...conn, '-d', 'hub', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ ok: code === 0, refused: /not available/.test(err), err, start, end }));
  })));
  const won = results.filter((r) => r.ok);
  const odd = results.filter((r) => !r.ok && !r.refused);
  for (const r of odd) fail(`${label}: unexpected error ${r.err.trim()}`);
  return { won, results };
}

try {
  run('initdb', ['-D', join(tmp, 'data'), '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C'], { stdio: 'pipe' });
  run('pg_ctl', ['-D', join(tmp, 'data'), '-l', join(tmp, 'log'), '-w', '-o', `-p ${port} -k ${tmp} -c listen_addresses=''`, 'start'], { stdio: 'pipe' });
  psql('postgres', ['-c', 'create database hub']);
  log(`db-test: throwaway Postgres (${pgBin.split('/').at(-2)}) at ${tmp}`);

  psql('hub', ['-f', join(root, 'scripts/db/local-supabase-stub.sql')]);
  const migrations = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const m of migrations) {
    psql('hub', ['-1', '-f', join(root, 'supabase/migrations', m)]);
    log(`ok   migration ${m}`);
  }
  psql('hub', ['-c', 'set search_path = public', '-f', await pgtapSql()]);

  // Seed the real registry through the same function the server will use.
  const registries = readdirSync(join(root, 'data/inventory')).filter((f) => f.endsWith('.json'));
  for (const f of registries) {
    const json = readFileSync(join(root, 'data/inventory', f), 'utf8');
    const tag = `reg${randomBytes(4).toString('hex')}`;
    const file = join(tmp, `${f}.sql`);
    writeFileSync(file, `set role service_role;\nselect private.upsert_inventory($${tag}$${json}$${tag}$::jsonb);\n`);
    psql('hub', ['-f', file]);
    psql('hub', ['-f', file]); // twice: must be idempotent
    const counts = psql('hub', ['-t', '-A', '-c',
      `select count(*) filter (where kind = 'desk') || ' desks, ' || count(*) filter (where kind <> 'desk') || ' rooms/offices, ' ||
              count(*) filter (where not is_bookable) || ' not bookable' from hub.bookable_units`]).stdout.trim();
    const reg = JSON.parse(json);
    const desks = reg.units.filter((u) => u.kind === 'desk').length;
    if (!counts.startsWith(`${desks} desks, ${reg.units.length - desks} rooms/offices`)) fail(`seed ${f}: got ${counts}`);
    else log(`ok   seed ${f}: ${counts} (idempotent)`);
  }

  const testsDir = join(root, 'supabase/tests/database');
  for (const f of readdirSync(testsDir).filter((t) => t.endsWith('.test.sql')).sort()) {
    const r = psql('hub', ['-t', '-A', '-f', join(testsDir, f)], { allowFail: true });
    if (r.status !== 0) fail(`${f}: psql exited ${r.status}\n${r.stderr}`);
    tap(f, r.stdout);
  }

  // Race on the real desk L2-D001 with a development price.
  race.price = psql('hub', ['-t', '-A', '-c', `
    update hub.bookable_units set verified = true where id = 'L2-D001';
    insert into hub.products (id, kind, name, unit_kind, billing, period_unit)
      values ('race_day_pass', 'day_pass', 'Race test', 'desk', 'one_time', 'day');
    insert into hub.product_prices (product_id, environment, unit_amount)
      values ('race_day_pass', 'development', 1) returning id;`]).stdout.trim().split('\n').at(-1);

  const same = await race('identical period', Array.from({ length: 24 }, () => ({ start: 600, end: 720, hash: randomBytes(32).toString('hex') })));
  if (same.won.length !== 1) fail(`identical period: ${same.won.length} of 24 sessions got the desk (want exactly 1)`);
  else log('ok   race: 24 sessions, identical period -> exactly 1 hold');

  const mixed = await race('overlapping periods', Array.from({ length: 40 }, () => {
    const start = 780 + 15 * Math.floor(Math.random() * 24);
    return { start, end: start + 15 * (1 + Math.floor(Math.random() * 8)), hash: randomBytes(32).toString('hex') };
  }));
  const overlaps = psql('hub', ['-t', '-A', '-c', `
    select count(*) from hub.reservations a join hub.reservations b
      on a.unit_id = b.unit_id and a.id < b.id and a.during && b.during
    where a.status in ('held','confirmed') and b.status in ('held','confirmed')`]).stdout.trim();
  const winners = mixed.won.sort((a, b) => a.start - b.start);
  let reach = -1;
  const pairwise = winners.some((w) => { const hit = w.start < reach; reach = Math.max(reach, w.end); return hit; });
  if (overlaps !== '0' || pairwise) fail(`overlapping periods: ${overlaps} overlapping rows in the database`);
  else log(`ok   race: 40 sessions, random overlapping periods -> ${winners.length} holds, 0 overlaps`);
} catch (e) {
  fail(e.message);
} finally {
  run('pg_ctl', ['-D', join(tmp, 'data'), '-m', 'immediate', 'stop'], { allowFail: true, stdio: 'pipe' });
  rmSync(tmp, { recursive: true, force: true });
}

if (failures) {
  console.error(`db-test: ${failures} failure(s)`);
  process.exit(1);
}
console.log('db-test: ok');
