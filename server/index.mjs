import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(serverDir, '..');
const envFile = path.join(serverDir, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) { const k = line.slice(0, i).trim(); const v = line.slice(i + 1).trim(); if (k && !process.env[k]) process.env[k] = v.replace(/^['"]|['"]$/g, ''); }
  }
}
const web = path.join(root, 'web');
const wiki = path.resolve(process.env.WIKI_PATH || 'C:/LLM_wiki');
const port = Number(process.env.PORT || 8787);
const key = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const pdfTool = process.env.PDFTOTEXT || (process.platform === 'win32' ? 'C:/Users/todog/AppData/Local/hermes/git/mingw64/bin/pdftotext.exe' : 'pdftotext');
const allowed = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.md', '.txt', '.csv', '.json']);
const profileContext = 'PROFILE SOURCES:\nGoogle Scholar: https://scholar.google.com/citations?user=wnc8LRUAAAAJ&hl=es\nLinkedIn: https://www.linkedin.com/in/angel-canelo-bbbab715b\nPersonal email: angelcanelophd@gmail.com\nWork email: angel.canelo@samsung.com\nWorkplace: Samsung Electronics';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.name === 'eunhye-secretary' || ent.name === 'images' || ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    if (ent.isDirectory()) walk(p, out);
    else if (allowed.has(path.extname(ent.name).toLowerCase())) out.push(p);
  }
  return out;
}
function catalog() {
  return walk(wiki).map(p => {
    const rel = path.relative(wiki, p).split(path.sep).join('/');
    const st = fs.statSync(p);
    return { path: rel, name: path.basename(p), ext: path.extname(p).slice(1), category: rel.split('/')[0], size: st.size, sizeLabel: st.size > 1048576 ? (st.size / 1048576).toFixed(1) + ' MB' : Math.ceil(st.size / 1024) + ' KB' };
  });
}
function sendJson(res, obj, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); }
const mime = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.json': 'application/json; charset=utf-8' };
function safeWikiFile(rel) { const full = path.resolve(wiki, rel); return full.startsWith(wiki + path.sep) && fs.existsSync(full) && fs.statSync(full).isFile() && allowed.has(path.extname(full).toLowerCase()) ? full : null; }
function extract(file) {
  try {
    const lower = file.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.txt') || lower.endsWith('.csv') || lower.endsWith('.json')) return fs.readFileSync(file, 'utf8').slice(0, 12000);
    if (lower.endsWith('.pdf')) return execFileSync(pdfTool, [file, '-'], { encoding: 'utf8', timeout: 20000 }).slice(0, 12000);
  } catch (_) {}
  return '';
}
function readBody(req) { return new Promise((resolve, reject) => { let s = ''; req.on('data', x => s += x); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { reject(e); } }); }); }
async function ask(message) {
  if (!key) return { answer: '서버에 OPENAI_API_KEY가 설정되지 않았어요. 새 키를 발급한 뒤 server/.env에 설정해 주세요.', sources: [] };
  const files = catalog();
  const terms = message.toLowerCase().split(/\s+/).filter(x => x.length > 1);
  const relevant = files.filter(f => terms.some(t => (f.name + ' ' + f.path).toLowerCase().includes(t))).slice(0, 8);
  const context = relevant.map(f => 'FILE: ' + f.path + '\n' + extract(path.join(wiki, f.path))).join('\n\n').slice(0, 30000);
  const system = 'You are 은혜 (Eunhye), a warm, precise Korean personal secretary. Answer only from the supplied personal archive context. If unsupported, say so. Use clear Markdown headings, bullets, tables where useful, and a few friendly relevant emojis. Cite source filenames in square brackets. Support summaries, comparisons, tables, statistics, and plots. For numeric chart requests append JSON on a separate line as CHART:{"title":"...","data":[{"label":"...","value":0}]}.\n\n' + profileContext + '\n\nARCHIVE CONTEXT:\n' + (context || files.map(f => f.path).join('\n'));
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: message }], temperature: 0.2 }) });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  let answer = d.choices?.[0]?.message?.content || '답변이 없습니다.';
  let chart; const marker = 'CHART:'; const at = answer.indexOf(marker);
  if (at >= 0) { try { chart = JSON.parse(answer.slice(at + marker.length).trim()); answer = answer.slice(0, at).trim(); } catch (_) {} }
  return { answer, chart, sources: relevant.map(f => ({ path: f.path, name: f.name })) };
}
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
    if (u.pathname === '/api/status') return sendJson(res, { connected: Boolean(key), model, provider: 'OpenAI' });
    if (u.pathname === '/api/files') return sendJson(res, { files: catalog() });
    if (u.pathname === '/api/file') { const rel = u.searchParams.get('path') || ''; const full = safeWikiFile(rel); if (!full) return sendJson(res, { error: 'not found' }, 404); return sendJson(res, { path: rel, name: path.basename(full), ext: path.extname(full).slice(1), text: extract(full) }); }
    if (u.pathname === '/api/document') { const rel = u.searchParams.get('path') || ''; const full = safeWikiFile(rel); if (!full) return sendJson(res, { error: 'not found' }, 404); res.writeHead(200, { 'Content-Type': mime[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Content-Disposition': 'inline; filename*=UTF-8\'\'' + encodeURIComponent(path.basename(full)) }); return fs.createReadStream(full).pipe(res); }
    if (u.pathname === '/api/chat' && req.method === 'POST') { const b = await readBody(req); return sendJson(res, await ask(String(b.message || ''))); }
    const rel = decodeURIComponent(u.pathname === '/' ? 'index.html' : u.pathname.slice(1)); const full = path.resolve(web, rel);
    if (!full.startsWith(web) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return sendJson(res, { error: 'not found' }, 404);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' }; res.writeHead(200, { 'Content-Type': types[path.extname(full)] || 'application/octet-stream' }); fs.createReadStream(full).pipe(res);
  } catch (e) { sendJson(res, { error: e.message }, 500); }
});
server.listen(port, () => console.log('은혜 비서 running at http://localhost:' + port));
