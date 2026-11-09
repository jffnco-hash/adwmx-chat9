// تجهيز ونشر السيرفر الجديد بأمر واحد:   node setup.mjs --dev 01012345678
//   1) يثبّت wrangler  2) يتأكد من تسجيل الدخول  3) ينشئ قاعدة D1 جديدة adwmx2 (لو مش موجودة)
//   4) يكتب database_id ورقم المطور في wrangler.toml  5) ينشئ الجداول  6) ينشر الـ Worker  7) يفحصه
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const win = process.platform === 'win32';
const wr = (args, inherit = false) => spawnSync('npx', ['wrangler', ...args], { encoding: 'utf8', shell: win, stdio: inherit ? 'inherit' : 'pipe' });
const DB = 'adwmx2';
const devArg = process.argv.indexOf('--dev') > -1 ? process.argv[process.argv.indexOf('--dev') + 1] : '';

if (!existsSync('node_modules')) { console.log('⏳ npm install ...'); if (spawnSync('npm', ['install'], { stdio: 'inherit', shell: win }).status) process.exit(1); }
if (wr(['whoami']).status) { console.log('🔑 سجّل دخول Cloudflare:'); if (wr(['login'], true).status) process.exit(1); }

const uuidIn = (t) => (t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
const findDb = () => { try { return JSON.parse(wr(['d1', 'list', '--json']).stdout).find((d) => d.name === DB)?.uuid; } catch { return undefined; } };
let id = findDb();
if (!id) {
  console.log(`🗄  إنشاء قاعدة البيانات الجديدة ${DB} ...`);
  const r = wr(['d1', 'create', DB]); const out = (r.stdout || '') + (r.stderr || '');
  id = uuidIn(out) || findDb();
  if (!id) { console.error('❌ تعذّر إنشاء القاعدة:\n' + out); process.exit(1); }
}
let toml = readFileSync('wrangler.toml', 'utf8');
toml = /^\s*database_id\s*=/m.test(toml) ? toml.replace(/^\s*database_id\s*=\s*"[^"]*"/m, `database_id = "${id}"`) : toml.replace(/(database_name\s*=\s*"[^"]*"\n)/, `$1database_id = "${id}"\n`);
if (devArg) toml = toml.replace(/DEVELOPER_PHONE\s*=\s*"[^"]*"/, `DEVELOPER_PHONE = "${devArg.replace(/[^0-9+]/g, '')}"`);
writeFileSync('wrangler.toml', toml);
console.log('✅ database_id =', id);

console.log('📋 إنشاء الجداول ...');
if (wr(['d1', 'execute', DB, '--remote', '--file=./schema.sql'], true).status) console.log('(تخطّي: الـ Worker بينشئ الجداول تلقائياً أول طلب)');

console.log('🚀 نشر الـ Worker ...');
const d = wr(['deploy']); const log = (d.stdout || '') + (d.stderr || ''); console.log(log);
if (d.status) process.exit(1);
const url = (log.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) || [])[0];
if (url) { console.log('🌐 الرابط:', url); spawnSync('node', ['check.mjs', url], { stdio: 'inherit' }); }
if (!/DEVELOPER_PHONE\s*=\s*"[0-9+]+"/.test(toml)) console.log('\nℹ️ لسه ما حطيتش رقم المطور: node setup.mjs --dev 01xxxxxxxxx (ولازم نفس الرقم في Dev.PHONE بالتطبيق).');
