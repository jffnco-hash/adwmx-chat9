// node check.mjs [الرابط]  — يفحص الـ Worker والقاعدة
const base = process.argv[2] || 'https://adwmx-chat9.jffnco.workers.dev';
const r = await fetch(base + '/ping'); const t = await r.text();
console.log(r.status, t);
try { const j = JSON.parse(t); console.log(j.ok && j.db ? '✅ شغّال والقاعدة تمام' : '❌ فيه مشكلة: ' + (j.error || 'راجع الإعدادات')); } catch { console.log('❌ الرد مش JSON — الرابط غلط أو محمي بتسجيل دخول'); }
