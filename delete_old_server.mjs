// يحذف السيرفر القديم نهائياً: الـ Worker "asdl" وقاعدة "adwmx" بكل المستخدمين والرسائل. مفيش رجوع.
// شغّله بعد ما تتأكد إن السيرفر الجديد شغّال:   node delete_old_server.mjs
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
const win = process.platform === 'win32';
const OLD_WORKER = 'asdl', OLD_DB = 'adwmx';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`⚠️ هيتحذف نهائياً: الـ Worker "${OLD_WORKER}" + قاعدة البيانات "${OLD_DB}" (كل المستخدمين القدامى ورسائلهم).`);
const a = (await rl.question('اكتب DELETE للتأكيد: ')).trim(); rl.close();
if (a !== 'DELETE') { console.log('اتلغى. ما اتحذفش حاجة.'); process.exit(0); }
const wr = (args) => spawnSync('npx', ['wrangler', ...args], { stdio: 'inherit', shell: win });
wr(['delete', '--name', OLD_WORKER, '--force']);
wr(['d1', 'delete', OLD_DB, '-y']);
console.log('تم. (لو ظهر خطأ "not found" يبقى اتحذف قبل كده)');
