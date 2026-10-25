const PAGES_ORIGIN = 'https://canelo-phd.github.io';
const INDEX_URL = 'https://canelo-phd.github.io/eunhye-secretary/archive-index.json?v=ocr-20261025';
const CHAT_MODEL = 'gpt-4o-mini';
const EMBEDDING_MODEL = 'text-embedding-3-small';

function cors(origin = '') {
  return {
    'Access-Control-Allow-Origin': origin === PAGES_ORIGIN ? origin : PAGES_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
function json(value, status = 200, origin = '') {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });
}
function lexicalTerms(text = '') {
  const stop = new Set(['the','and','for','with','from','that','this','are','was','have','has','about','what','when','where','which','como','para','con','las','los','del','una','por']);
  return [...new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).filter(x => !stop.has(x)))];
}
function expandQuestion(question) {
  const q = question.toLocaleLowerCase();
  const hints = [];
  if (/award|awards|prize|honou?r|certificate|achievement|scholarship|수상|상장|증명서/i.test(q)) hints.push('awards award certificate prize honour scholarship academic transcript poster conference project management 수료증명서');
  if (/degree|degrees|education|academic|qualification|bachelor|master|phd|doctor|doctoral|thesis|dissertation|학위|학사|석사|박사|논문/i.test(q)) hints.push('education academic degree bachelor master phd doctoral thesis dissertation resume 학사논문 석사논문 박사논문');
  if (/phd|doctoral|doctorate|박사/i.test(q) && /thesis|dissertation|논문|summary|summar/i.test(q)) hints.push('Angel_Canelo_박사논문 doctoral dissertation PhD thesis');
  if (/master|석사/i.test(q) && /thesis|논문|summary|summar/i.test(q)) hints.push('Angel_Canelo_석사논문 master thesis');
  if (/bachelor|undergraduate|학사/i.test(q) && /thesis|논문|summary|summar/i.test(q)) hints.push('Angel_Canelo_학사논문 bachelor thesis');
  if (/current|role|position|samsung|career|employment|work|currently|present/i.test(q)) hints.push('career current position Staff Engineer Samsung Electronics resume');
  return `${question}\n${hints.join('\n')}`;
}
function cosine(a = [], b = []) {
  let dot = 0, aa = 0, bb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
async function embed(text, key) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, dimensions: 256, input: text }),
  });
  if (!response.ok) throw new Error(`Embedding request failed: ${await response.text()}`);
  const result = await response.json();
  return result.data?.[0]?.embedding || [];
}
async function indexRecords() {
  const response = await fetch(INDEX_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!response.ok) throw new Error('Archive index is unavailable.');
  const body = await response.json();
  return Array.isArray(body.records) ? body.records : [];
}
function rank(records, question, queryEmbedding) {
  const terms = lexicalTerms(expandQuestion(question));
  const scored = records.map(record => {
    const haystack = `${record.name} ${record.path} ${record.text}`.toLocaleLowerCase();
    const filename = `${record.name} ${record.path}`.toLocaleLowerCase();
    const lexical = terms.reduce((n, term) => n + (haystack.split(term).length - 1) + 3 * (filename.split(term).length - 1), 0);
    const semantic = cosine(queryEmbedding, record.embedding);
    return { ...record, score: lexical + semantic * 12 };
  }).sort((a, b) => b.score - a.score);
  const exactFilename = records.find(record => lexicalTerms(question).some(term => term.length >= 4 && record.path.toLocaleLowerCase().includes(term)));
  if (exactFilename) { exactFilename.score = Number.MAX_SAFE_INTEGER; scored.sort((a, b) => b.score - a.score); }
  if (/current|role|position|samsung|career|employment|work|currently|present/i.test(question)) {
    const resume = scored.find(x => x.path === 'career/ANGEL_CANELO_resume.pdf');
    if (resume) resume.score = Number.MAX_SAFE_INTEGER;
    scored.sort((a, b) => b.score - a.score);
  }
  const paths = [];
  for (const row of scored) if (!paths.includes(row.path)) paths.push(row.path);
  const chosenPaths = paths.slice(0, 5);
  const selected = [];
  for (const path of chosenPaths) {
    for (const row of scored.filter(x => x.path === path).slice(0, 2)) {
      if (selected.length < 8) selected.push(row);
    }
  }
  return selected;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/api/status') return json({ connected: Boolean(env.OPENAI_API_KEY), model: CHAT_MODEL, provider: 'OpenAI' }, 200, origin);
    if (url.pathname !== '/api/chat' || request.method !== 'POST') return json({ error: 'not found' }, 404, origin);
    if (origin && origin !== PAGES_ORIGIN) return json({ error: 'origin not allowed' }, 403, origin);
    if (!env.OPENAI_API_KEY) return json({ error: 'The OpenAI secret is not configured in this Worker.' }, 503, origin);
    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, origin); }
    const message = String(payload.message || '').trim().slice(0, 2400);
    if (!message) return json({ error: 'message is required' }, 400, origin);
    try {
      const records = await indexRecords();
      const queryEmbedding = await embed(expandQuestion(message), env.OPENAI_API_KEY);
      const selected = rank(records, message, queryEmbedding);
      const context = selected.map(x => `FILE: ${x.path}\n${x.text}`).join('\n\n').slice(0, 26000);
      const instruction = `You are Eunhye, a precise personal archive assistant. Answer only from the archive context. Do not infer facts not supported by the selected documents. Search and reason across English, Spanish, Korean, and other multilingual filenames and text. A filename such as 박사논문 means doctoral/PhD thesis, 석사논문 means master's thesis, and 학사논문 means bachelor's thesis. Summaries must describe the document content, not merely its filename. If evidence is insufficient, say so plainly. Use clear Markdown, tables where helpful, and restrained relevant emojis. Cite source filenames in square brackets.\n\nARCHIVE CONTEXT:\n${context}`;
      const openai = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: CHAT_MODEL, temperature: 0.2, messages: [{ role: 'system', content: instruction }, { role: 'user', content: message }] }),
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
