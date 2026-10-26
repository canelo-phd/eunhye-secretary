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
  const filenameTerms = lexicalTerms(question).filter(term => term.length >= 4);
  const exactFilename = records.map(record => ({
    record,
    score: filenameTerms.reduce((total, term) => total + (record.path.toLocaleLowerCase().includes(term) ? term.length / Math.max(1, records.filter(x => x.path.toLocaleLowerCase().includes(term)).length) : 0), 0),
  })).sort((a, b) => b.score - a.score)[0];
  if (exactFilename?.score > 0) { const row = scored.find(x => x.path === exactFilename.record.path); if (row) { row.score = Number.MAX_SAFE_INTEGER; scored.sort((a, b) => b.score - a.score); } }
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
function representativeDocument(records, path, question, queryEmbedding) {
  const documentChunks = records.filter(record => record.path === path);
  if (documentChunks.length <= 6) return documentChunks;
  const terms = lexicalTerms(expandQuestion(question));
  const scored = documentChunks.map(record => ({ record, score: terms.reduce((n, term) => n + ((record.text + ' ' + record.name).toLocaleLowerCase().split(term).length - 1), 0) + cosine(queryEmbedding, record.embedding) * 12 })).sort((a, b) => b.score - a.score);
  const picks = [documentChunks[0], documentChunks[Math.floor(documentChunks.length / 2)], documentChunks[documentChunks.length - 1], ...scored.slice(0, 3).map(x => x.record)];
  return [...new Map(picks.map(record => [record.chunk, record])).values()].sort((a, b) => a.chunk - b.chunk).slice(0, 6);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/api/status') return json({ connected: Boolean(env.OPENAI_API_KEY), model: CHAT_MODEL, provider: 'OpenAI', retrieval: 'semantic-ocr-v2' }, 200, origin);
    if (url.pathname !== '/api/chat' || request.method !== 'POST') return json({ error: 'not found' }, 404, origin);
    if (origin && origin !== PAGES_ORIGIN) return json({ error: 'origin not allowed' }, 403, origin);
    if (!env.OPENAI_API_KEY) return json({ error: 'The OpenAI secret is not configured in this Worker.' }, 503, origin);
    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, origin); }
    const message = String(payload.message || '').trim().slice(0, 2400);
    if (!message) return json({ error: 'message is required' }, 400, origin);
    const asksTime = /(?:\bwhat(?:'s| is)?\s+(?:the\s+)?time\b|\btime is it\b|\bcurrent time\b|몇 시|현재 시간|시간.*(?:몇|알려)|qué hora|que hora)/i.test(message);
    if (asksTime) {
      const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      const korean = /[\uac00-\ud7a3]/.test(message);
      const spanish = /(?:hola|qué|que|hora|buenos|buenas)/i.test(message);
      const answer = korean ? `현재 한국 시간은 ${now}입니다. 🕒 🇰🇷` : spanish ? `La hora actual en Corea es ${now}. 🕒 🇰🇷` : `The current time in Korea is ${now}. 🕒 🇰🇷`;
      return json({ answer, sources: [] }, 200, origin);
    }
    try {
      const archiveIntent = /angel|canelo|career|research|topic|paper|publication|award|prize|certificate|degree|education|qualification|bachelor|master|phd|doctoral|thesis|dissertation|resume|samsung|employment|wiki|archive|document|file|박사|석사|학사|논문|연구|수상|학위|경력|문서|파일/i.test(message);
      const records = archiveIntent ? await indexRecords() : [];
      const queryEmbedding = archiveIntent ? await embed(expandQuestion(message), env.OPENAI_API_KEY) : [];
      const lowerMessage = message.toLocaleLowerCase();
      const wantsAwards = /award|awards|prize|honou?r|certificate|scholarship|수상|상장|증명서/.test(lowerMessage);
      const wantsDegrees = /degree|degrees|education|academic background|qualification|bachelor|master|phd|doctorate|학위|학력/.test(lowerMessage);
      const wantsResearch = /research|topic|topics|paper|papers|publication|publications|article|articles|논문|연구/.test(lowerMessage);
      const explicitTerms = lexicalTerms(message).filter(term => term.length >= 4 && /\d/.test(term)).map(term => ({ term, matches: records.filter(record => record.path.toLocaleLowerCase().includes(term)) })).filter(x => x.matches.length).sort((a, b) => a.matches.length - b.matches.length || b.term.length - a.term.length);
      const thesisPath = /bachelor|undergraduate|학사/.test(lowerMessage) ? 'research/Angel_Canelo_학사논문.pdf' : /master|석사/.test(lowerMessage) ? 'research/Angel_Canelo_석사논문.pdf' : /phd|doctoral|doctorate|박사/.test(lowerMessage) && /thesis|dissertation|논문|summar|summary|요약/.test(lowerMessage) ? 'research/Angel_Canelo_박사논문.pdf' : '';
      let selected;
      if (thesisPath) {
        selected = representativeDocument(records, thesisPath, message, queryEmbedding);
      } else if (wantsAwards) {
        selected = records.filter(record => record.path.startsWith('awards/'));
        if (wantsDegrees) {
          const resume = records.find(record => record.path === 'career/ANGEL_CANELO_resume.pdf');
          const phd = records.find(record => record.path === 'research/Angel_Canelo_박사논문.pdf');
          if (resume) selected.push(resume);
          if (phd) selected.push(phd);
        }
      } else if (wantsResearch) {
        selected = [...new Map(records.filter(record => record.path.startsWith('research/')).map(record => [record.path, record])).values()].sort((a, b) => (b.path.includes('NTIRE_2025') ? 1 : 0) - (a.path.includes('NTIRE_2025') ? 1 : 0));
      } else if (wantsDegrees) {
        selected = records.filter(record => record.path === 'career/ANGEL_CANELO_resume.pdf' || /Angel_Canelo_(박사|석사|학사)논문\.pdf$/.test(record.path));
      } else {
        selected = archiveIntent ? (explicitTerms.length ? explicitTerms[0].matches.slice(0, 2) : rank(records, message, queryEmbedding)) : [];
      }
      selected = selected.slice(0, 8);
      const requiredResearchFiles = wantsResearch ? selected.filter(x => x.path.startsWith('research/')).map(x => x.path).join(', ') : '';
      const context = selected.map(x => `FILE: ${x.path}\n${x.text}`).join('\n\n').slice(0, 26000);
      const instruction = `You are Eunhye, a precise personal archive assistant and helpful general assistant. For archive-related questions, answer only from the archive context, do not infer unsupported facts, and cite the source filenames in square brackets. For general questions that do not concern the archive, answer normally from your general knowledge, do not invent access to private information or real-time data, and do not cite archive files. Search and reason across English, Spanish, Korean, and other multilingual filenames and text when the question concerns the archive. Reply in the same language used in the user's question unless they explicitly request another language; for short ambiguous greetings such as "hello", default to English. A filename such as 박사논문 means doctoral/PhD thesis, 석사논문 means master's thesis, and 학사논문 means bachelor's thesis. When the user asks for degrees, include every degree present in the résumé, explicitly including the bachelor's, master's, and PhD/doctoral degree when listed. The PhD/doctoral degree must be an in-table row dated August 2024, never outside the table. When the user asks for a list or table by year, extract the date from every selected document, include every relevant item (including certificates), sort dated entries chronologically by year, and place any undated entries in a clearly labeled final section. If the user requests a table or list of the owner's research papers, include ONLY selected FILE blocks that explicitly identify Angel Canelo or Ángel Canelo as an author, or a thesis explicitly attributed to him. Never treat a cited/reference paper, a challenge mentioned inside a paper, or general background material as one of his authored publications. For a research inventory request such as "my research topics and papers", include exactly one row for every selected research FILE unless that file explicitly proves Angel is not an author; missing or garbled accent characters are not proof of non-authorship. In research inventory tables, use a compact Author column containing only "Angel Canelo"; do not list coauthors there. Keep the Year and Author columns compact, and let only the Title/Topic column wrap. The selected NTIRE 2025 file explicitly lists Angel Canelo as an author and must be included when selected. Never invent a document title, publication year, author list, or path; Every table row must correspond to one selected FILE block and must be supported by that file's extracted text. REQUIRED RESEARCH FILES FOR THIS REQUEST: ${requiredResearchFiles || 'none'}. If this list is non-empty, include exactly one row for every listed file. If evidence is insufficient, say so plainly. Use clear Markdown, tables where helpful, and MUST include 2–5 meaningful emojis in every answer, including greetings, (for example 📚, 🏆, 🧠, 📊, ✅), without turning the answer into decoration. Cite source filenames in square brackets.\n\nARCHIVE CONTEXT:\n${context}`;
      const openai = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: CHAT_MODEL, temperature: 0.2, messages: [{ role: 'system', content: instruction }, { role: 'user', content: message }] }),
      });
      if (!openai.ok) throw new Error(await openai.text());
      const result = await openai.json();
      let answer = result.choices?.[0]?.message?.content || 'No answer was returned.';
      if (wantsDegrees) answer = answer.replace(/(\|\s*)2024(\s*\|\s*Doctoral Degree\b)/i, '$1August 2024$2');
      const used = [...new Map(selected.map(x => [x.path, { path: x.path, name: x.name }])).values()];
      return json({ answer, sources: used }, 200, origin);
    } catch (error) {
      return json({ error: 'AI request failed', detail: String(error.message || error) }, 502, origin);
    }
  },
};
