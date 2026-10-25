const PAGES_ORIGIN = 'https://canelo-phd.github.io';
const INDEX_URL = 'https://canelo-phd.github.io/eunhye-secretary/archive-index.json';
const MODEL = 'gpt-4o-mini';

function cors(origin = '') {
  const allowed = origin === PAGES_ORIGIN ? origin : PAGES_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
function json(value, status = 200, origin = '') {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });
}
function tokens(text = '') {
  return [...new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).filter(x => !new Set(['the','and','for','with','from','that','this','are','was','have','has','about','what','when','where','which','como','para','con','las','los','del','una','por','and']).has(x)))];
}
function rank(records, question) {
  const terms = tokens(question);
  const ranked = records.map(record => {
    const haystack = (record.name + ' ' + record.text).toLocaleLowerCase();
    const filename = record.name.toLocaleLowerCase();
    const score = terms.reduce((n, term) => n + (haystack.split(term).length - 1) + 3 * (filename.split(term).length - 1), 0);
    return { ...record, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  if (/\b(current|role|position|samsung|career|employment|work)\b/i.test(question)) {
    const resume = records.find(x => x.path === 'career/ANGEL_CANELO_resume.pdf');
    if (resume) return [resume, ...ranked.filter(x => x.path !== resume.path)].slice(0, 8);
  }
  return ranked.slice(0, 8);
}
async function indexRecords() {
  const response = await fetch(INDEX_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!response.ok) throw new Error('Archive index is unavailable.');
  const body = await response.json();
  return Array.isArray(body.records) ? body.records : [];
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/api/status') return json({ connected: Boolean(env.OPENAI_API_KEY), model: MODEL, provider: 'OpenAI' }, 200, origin);
    if (url.pathname !== '/api/chat' || request.method !== 'POST') return json({ error: 'not found' }, 404, origin);
    if (origin && origin !== PAGES_ORIGIN) return json({ error: 'origin not allowed' }, 403, origin);
    if (!env.OPENAI_API_KEY) return json({ error: 'The OpenAI secret is not configured in this Worker.' }, 503, origin);
    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, origin); }
    const message = String(payload.message || '').trim().slice(0, 2400);
    if (!message) return json({ error: 'message is required' }, 400, origin);
    try {
      const records = await indexRecords();
      const selected = rank(records, message);
      const context = selected.length ? selected.map(x => `FILE: ${x.path}\n${x.text}`).join('\n\n').slice(0, 24000) : records.slice(0, 4).map(x => `FILE: ${x.path}\n${x.text}`).join('\n\n').slice(0, 12000);
      const instruction = `You are Eunhye, a precise personal archive assistant. Answer only using the archive context below. Do not invent facts. Treat filenames and extracted text as multilingual; the archive may be English, Spanish, or Korean. If evidence is insufficient, say so plainly. Use clear Markdown, useful tables when requested, and relevant restrained emojis. Cite source filenames in square brackets.\n\nARCHIVE CONTEXT:\n${context}`;
      const openai = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, temperature: 0.2, messages: [{ role: 'system', content: instruction }, { role: 'user', content: message }] }),
      });
      if (!openai.ok) throw new Error(await openai.text());
      const result = await openai.json();
      const used = [...new Map(selected.map(x => [x.path, { path: x.path, name: x.name }])).values()];
      return json({ answer: result.choices?.[0]?.message?.content || 'No answer was returned.', sources: used }, 200, origin);
    } catch (error) {
      return json({ error: 'AI request failed', detail: String(error.message || error) }, 502, origin);
    }
  },
};
