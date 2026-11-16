const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.join(__dirname, '..', 'workspace');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
  'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'you', 'your', 'they',
  'their', 'not', 'no', 'if', 'then', 'else', 'when', 'while', 'all', 'any', 'into'
]);

/**
 * Tokenize code, markdown, and natural language into normalized terms.
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const expanded = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_./\\:-]+/g, ' ')
    .toLowerCase();
  return expanded
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Split a document into overlapping chunks for fine-grained BM25 retrieval.
 */
function chunkText(text, chunkSize = 650, overlap = 110) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + chunkSize);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

/**
 * Build an in-memory chunk corpus from workspaceFiles, memoryWiki, and Knowledge Graph triples.
 */
function buildCorpus(state) {
  const docs = [];
  const files = state?.workspaceFiles || [];

  for (const file of files) {
    let content = file.content;
    if (typeof content !== 'string' && file.filename) {
      try {
        const diskPath = path.join(WORKSPACE_DIR, path.basename(file.filename));
        if (fs.existsSync(diskPath)) {
          content = fs.readFileSync(diskPath, 'utf8');
        }
      } catch {}
    }
    if (!content) continue;
    const chunks = chunkText(content);
    chunks.forEach((chunk, idx) => {
      docs.push({
        id: `ws:${file.filename}#${idx}`,
        sourceType: 'workspace',
        sourceName: file.filename,
        department: file.department || 'Engineering',
        text: chunk,
        tokens: tokenize(`${file.filename} ${file.department || ''} ${chunk}`)
      });
    });
  }

  const wiki = state?.memoryWiki || [];
  for (const entry of wiki) {
    if (!entry?.content) continue;
    const chunks = chunkText(entry.content);
    chunks.forEach((chunk, idx) => {
      docs.push({
        id: `wiki:${entry.id || entry.title}#${idx}`,
        sourceType: 'memory_wiki',
        sourceName: entry.title || 'Wiki Entry',
        department: entry.department || 'Executive',
        text: chunk,
        tokens: tokenize(`${entry.title || ''} ${entry.department || ''} ${chunk}`)
      });
    });
  }

  const triples = state?.cognitiveMemory?.knowledgeGraph || [];
  if (triples.length > 0) {
    const batchSize = 6;
    for (let i = 0; i < triples.length; i += batchSize) {
      const slice = triples.slice(i, i + batchSize);
      const text = slice
        .map((t) => `[${t.department || 'Core'}] ${t.subject} --(${t.predicate})--> ${t.object} (conf: ${t.confidence ?? 0.95})`)
        .join('\n');
      docs.push({
        id: `kg:batch-${i}`,
        sourceType: 'knowledge_graph',
        sourceName: 'Cognitive Knowledge Graph',
        department: slice[0]?.department || 'Executive',
        text,
        tokens: tokenize(text)
      });
    }
  }

  return docs;
}

/**
 * Retrieve top-k relevant chunks using BM25 + optional department affinity boost.
 */
function retrieveContext({ state, query, department = null, topK = 4, maxChars = 1800 }) {
  const started = Date.now();
  const queryTokens = tokenize(query);
  const docs = buildCorpus(state);

  if (queryTokens.length === 0 || docs.length === 0) {
    return {
      hits: [],
      formattedContext: '',
      totalChunksIndexed: docs.length,
      queryTokens,
      durationMs: Date.now() - started
    };
  }

  const N = docs.length;
  let totalLen = 0;
  const df = new Map();

  for (const doc of docs) {
    totalLen += doc.tokens.length;
    const seen = new Set(doc.tokens);
    for (const term of seen) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }
  const avgdl = totalLen / N || 1;
  const k1 = 1.5;
  const b = 0.75;
  const uniqueQuery = Array.from(new Set(queryTokens));

  const scored = [];
  for (const doc of docs) {
    if (doc.tokens.length === 0) continue;
    const tfMap = new Map();
    for (const t of doc.tokens) {
      tfMap.set(t, (tfMap.get(t) || 0) + 1);
    }

    let score = 0;
    for (const qTerm of uniqueQuery) {
      const tf = tfMap.get(qTerm) || 0;
      if (tf === 0) continue;
      const docFreq = df.get(qTerm) || 0;
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const denom = tf + k1 * (1 - b + b * (doc.tokens.length / avgdl));
      score += idf * ((tf * (k1 + 1)) / denom);
    }

    if (score > 0) {
      if (department && doc.department && doc.department.toLowerCase() === department.toLowerCase()) {
        score *= 1.15;
      }
      scored.push({
        id: doc.id,
        sourceType: doc.sourceType,
        sourceName: doc.sourceName,
        department: doc.department,
        score: Number(score.toFixed(3)),
        excerpt: doc.text
      });
    }
  }

  scored.sort((a, bScore) => bScore.score - a.score);

  const hits = [];
  let charCount = 0;
  for (const item of scored) {
    if (hits.length >= topK) break;
    const snippet = item.excerpt.length > 550 ? `${item.excerpt.slice(0, 550)}...` : item.excerpt;
    if (charCount + snippet.length > maxChars && hits.length > 0) break;
    hits.push({ ...item, excerpt: snippet });
    charCount += snippet.length;
  }

  const formattedContext =
    hits.length > 0
      ? hits
          .map(
            (h, i) =>
              `[RAG #${i + 1} | ${h.sourceType}: ${h.sourceName} (${h.department}) | score=${h.score}]\n${h.excerpt}`
          )
          .join('\n\n')
      : '';

  return {
    hits,
    formattedContext,
    totalChunksIndexed: N,
    queryTokens,
    durationMs: Date.now() - started
  };
}

module.exports = {
  tokenize,
  chunkText,
  buildCorpus,
  retrieveContext
};
