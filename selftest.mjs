import { DatabaseSync } from 'node:sqlite';
import worker from './worker.js';
const sqlite = new DatabaseSync(':memory:');
const mk = (sql, args=[]) => ({
  bind: (...a) => mk(sql, a),
  first: async () => sqlite.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
  run: async () => { const r = sqlite.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
});
const env = { DB: { prepare: (s) => mk(s), batch: async (qs) => { for (const q of qs) await q.run(); return []; } }, DEVELOPER_PHONE: '01011112222, +201037625810', MEDIA_HOST: 'reels.test', DEBUG: 'true' };
const call = async (path, body, hdr = {}, method) => {
  const r = await worker.fetch(new Request('https://x.test' + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...hdr }, body: body ? JSON.stringify(body) : undefined }), env);
  return { s: r.status, j: await r.json() };
};
let fails = 0; const ok = (name, c, extra='') => { console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : '  ' + extra)); if (!c) fails++; };

const dev = await call('/register', { phone: '01011112222', name: 'Ahmed', pass: 'oldpass1' });
ok('register dev', dev.s === 200 && dev.j.token, JSON.stringify(dev));
const bob = await call('/register', { phone: '01099998888', name: 'Bob', pass: 'bobpass1' });
const T = dev.j.token, TB = bob.j.token;

// avatar
const img = Buffer.from('fakejpegbytes'.repeat(100)).toString('base64');
let r = await call('/profile/avatar', { img }, { 'x-token': T });
ok('avatar upload', r.s === 200 && r.j.v > 0, JSON.stringify(r)); const v1 = r.j.v;
r = await call('/avatar?phone=01011112222', null, { 'x-token': TB });
ok('bob reads dev avatar', r.s === 200 && r.j.img === img && r.j.v === v1, JSON.stringify(r).slice(0,120));
r = await call('/avatar?phone=01011112222&v=' + v1, null, { 'x-token': TB });
ok('avatar same-version shortcut', r.j.same === true, JSON.stringify(r));
r = await call('/avatars/versions', { phones: ['01011112222', '01099998888', '0100000'] }, { 'x-token': TB });
ok('versions', r.j.v['01011112222'] === v1 && r.j.v['01099998888'] === 0, JSON.stringify(r));
r = await call('/profile/avatar', { img: 'not base64 !!' }, { 'x-token': T });
ok('bad avatar rejected', r.s === 413, JSON.stringify(r));
r = await call('/avatar?phone=01099998888', null, { 'x-token': T });
ok('no avatar -> empty', r.j.v === 0 && r.j.img === '', JSON.stringify(r));

// message carries av
r = await call('/send', { to: '01099998888', text: 'hi', id: 'm1' }, { 'x-token': T });
const row = sqlite.prepare("SELECT payload FROM messages WHERE message_id='m1'").get();
ok('message payload has av', JSON.parse(row.payload).av === v1, row.payload);

// name
r = await call('/account/update', { name: 'A' }, { 'x-token': T }); ok('short name rejected', r.s === 400);
r = await call('/account/update', { name: 'أحمد المطور' }, { 'x-token': T });
ok('name updated', r.s === 200 && sqlite.prepare("SELECT name FROM users WHERE phone='01011112222'").get().name === 'أحمد المطور', JSON.stringify(r));

// password
r = await call('/account/password', { old: 'WRONG', pass: 'newpass22' }, { 'x-token': T }); ok('wrong old pw rejected', r.s === 403, JSON.stringify(r));
r = await call('/account/password', { old: 'oldpass1', pass: '123' }, { 'x-token': T }); ok('short new pw rejected', r.s === 400);
r = await call('/account/password', { old: 'oldpass1', pass: 'newpass22' }, { 'x-token': T }); ok('password changed', r.s === 200, JSON.stringify(r));
r = await call('/login', { phone: '01011112222', pass: 'oldpass1' }); ok('old pw no longer works', r.s === 401);
r = await call('/login', { phone: '01011112222', pass: 'newpass22' }); ok('new pw works', r.s === 200 && r.j.name === 'أحمد المطور', JSON.stringify(r));
const T2 = r.j.token;

// admin reset
const al = await call('/admin/login', { phone: '01011112222' }, { 'x-token': T2 }); ok('admin login', al.s === 200 && al.j.token, JSON.stringify(al));
r = await call('/admin/set-password', { phone: '01099998888', pass: 'reset-bob-1' }, { 'x-admin': al.j.token }); ok('admin resets bob', r.s === 200, JSON.stringify(r));
r = await call('/login', { phone: '01099998888', pass: 'reset-bob-1' }); ok('bob logs in with reset pw', r.s === 200);
r = await call('/admin/set-password', { phone: '01011112222', pass: 'dev-reset-9' }, { 'x-admin': al.j.token }); ok('admin resets own pw (keeps session)', r.s === 200);
r = await call('/exists?phone=01099998888', null, { 'x-token': T2 }); ok('dev token still valid after self-reset', r.s === 200 && r.j.exists, JSON.stringify(r));
r = await call('/login', { phone: '01011112222', pass: 'dev-reset-9' }); ok('dev logs in with reset pw', r.s === 200);
r = await call('/profile/avatar', { img: '' }, { 'x-token': r.j.token }); ok('avatar removed', r.s === 200 && r.j.removed);
r = await call('/account/update', { name: 'ok name' }); ok('unauthenticated blocked', r.s === 401, JSON.stringify(r));

// ---- مطورين متعددين + whoami + ميديا
const asst = await call('/register', { phone: '+201037625810', name: 'Awad', pass: 'assist-pw1' });
const al2 = await call('/admin/login', { phone: '+201037625810' }, { 'x-token': asst.j.token });
ok('2nd developer can enter admin', al2.s === 200 && al2.j.token, JSON.stringify(al2));
const stranger = await call('/register', { phone: '01055556666', name: 'Eve', pass: 'evepass11' });
const al3 = await call('/admin/login', { phone: '01055556666' }, { 'x-token': stranger.j.token });
ok('non-developer refused', al3.s === 403 && /غير مصرح/.test(al3.j.error), JSON.stringify(al3));
let w1 = await call('/whoami', null, { 'x-token': asst.j.token }); ok('whoami dev=true', w1.j.dev === true && w1.j.phone.endsWith('1037625810'), JSON.stringify(w1));
w1 = await call('/whoami', null, { 'x-token': stranger.j.token }); ok('whoami dev=false', w1.j.dev === false);
const tx = stranger.j.token;
r = await call('/send', { to: '01011112222', text: '🎬 فيديو', id: 'v1', kind: 'video', media: 'https://reels.test/media/abc123', fname: 'a.mp4', size: 1234 }, { 'x-token': tx });
ok('media message accepted', r.s === 200 && r.j.media === true, JSON.stringify(r));
const prow = JSON.parse(sqlite.prepare("SELECT payload FROM messages WHERE message_id='v1'").get().payload);
ok('media payload fields', prow.kind === 'video' && prow.media === 'https://reels.test/media/abc123' && prow.size === 1234 && prow.fname === 'a.mp4' && prow.name === 'Eve', JSON.stringify(prow));
r = await call('/send', { to: '01011112222', text: '🎬 فيديو', id: 'v2', kind: 'video', media: 'https://evil.example/x' }, { 'x-token': tx });
const p2 = JSON.parse(sqlite.prepare("SELECT payload FROM messages WHERE message_id='v2'").get().payload);
ok('foreign media host ignored (plain text)', !p2.media && !p2.kind, JSON.stringify(p2));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
