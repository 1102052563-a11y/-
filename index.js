'use strict';

/**
 * 剧情指导 StoryGuide (SillyTavern UI Extension)
 * v0.9.2
 *
 * 新增：输出模块自定义（更高自由度）
 * - 你可以自定义“输出模块列表”以及每个模块自己的提示词（prompt）
 * - 面板提供一个「模块配置(JSON)」编辑区：可增删字段、改顺序、改提示词、控制是否在面板/自动追加中展示
 * - 插件会根据模块自动生成 JSON Schema（动态字段）并要求模型按该 Schema 输出
 *
 * 兼容：仍然保持 v0.3.x 的“独立API走后端代理 + 抗变量更新覆盖（自动补贴）+ 点击折叠”能力
 */

const MODULE_NAME = 'storyguide';

/**
 * 模块配置格式（JSON 数组）示例：
 * [
 *   {"key":"world_summary","title":"世界简介","type":"text","prompt":"1~3句概括世界与局势","required":true,"panel":true,"inline":true},
 *   {"key":"key_plot_points","title":"重要剧情点","type":"list","prompt":"3~8条关键剧情点（短句）","maxItems":8,"required":true,"panel":true,"inline":false}
 * ]
 *
 * 字段说明：
 * - key: JSON 输出字段名（唯一）
 * - title: 渲染到报告的标题
 * - type: "text" 或 "list"（list = string[]）
 * - prompt: 该模块的生成提示词（会写进 Output Fields）
 * - required: 是否强制要求该字段输出
 * - panel: 是否在“报告”里展示
 * - inline: 是否在“自动追加分析框”里展示
 * - maxItems: type=list 时限制最大条目（可选）
 */

const DEFAULT_MODULES = Object.freeze([
  { key: 'world_summary', title: '世界简介', type: 'text', prompt: '1~3句概括世界与局势', required: true, panel: true, inline: true },
  { key: 'key_plot_points', title: '重要剧情点', type: 'list', prompt: '3~8条关键剧情点（短句）', maxItems: 8, required: true, panel: true, inline: false },
  { key: 'current_scene', title: '当前时间点 · 具体剧情', type: 'text', prompt: '描述当前发生了什么（地点/人物动机/冲突/悬念）', required: true, panel: true, inline: true },
  { key: 'next_events', title: '后续将会发生的事', type: 'list', prompt: '接下来最可能发生的事（条目）', maxItems: 6, required: true, panel: true, inline: true },
  { key: 'protagonist_impact', title: '主角行为造成的影响', type: 'text', prompt: '主角行为对剧情/关系/风险造成的改变', required: true, panel: true, inline: false },
  { key: 'tips', title: '给主角的提示（基于原著后续/大纲）', type: 'list', prompt: '给出可执行提示（尽量具体）', maxItems: 4, required: true, panel: true, inline: true },
]);

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,

  // 输入截取
  maxMessages: 40,
  maxCharsPerMessage: 1600,
  includeUser: true,
  includeAssistant: true,

  // 生成控制（仍保留剧透与 temperature；更多风格可通过自定义 system/constraints 做）
  spoilerLevel: 'mild', // none | mild | full
  temperature: 0.4,

  // 自动刷新（面板报告）
  autoRefresh: false,
  autoRefreshOn: 'received', // received | sent | both
  debounceMs: 1200,

  // 自动追加到正文末尾
  autoAppendBox: true,
  appendMode: 'compact', // compact | standard
  appendDebounceMs: 700,

  // 追加框展示哪些模块
  inlineModulesSource: 'inline', // inline | panel | all
  inlineShowEmpty: false,        // 是否显示空字段占位

  // provider
  provider: 'st', // st | custom

  // custom API（建议填“API基础URL”，如 https://api.openai.com/v1 ）
  customEndpoint: '',
  customApiKey: '',
  customModel: 'gpt-4o-mini',
  customModelsCache: [],
  customTopP: 0.95,
  customMaxTokens: 8192,
  customStream: false,

  // 预设导入/导出
  presetIncludeApiKey: false,

  // 世界书（World Info/Lorebook）导入与注入
  worldbookEnabled: false,
  worldbookMode: 'active', // active | all
  worldbookMaxChars: 6000,
  worldbookWindowMessages: 18,

  // 图谱/地图（角色关系/地点结构）
  graphInject: false,
  graphAllowMapUpdate: false,
  graphMaxChars: 4000,

  // 外部世界信息源（可选，用于自动建图/替代世界书）
  worldSourceEnabled: false,
  worldSourceUrl: '',
  worldSourceMethod: 'GET', // GET | POST
  worldSourceHeadersJson: '',
  worldSourceMaxChars: 8000,
  worldSourceInjectToAnalysis: false,
  worldSourceCache: '',
  worldSourceLastFetchedAt: 0,
  worldbookJson: '',

  // 模块自定义（JSON 字符串 + 解析备份）
  modulesJson: '',
  // 额外可自定义提示词“骨架”
  customSystemPreamble: '',     // 附加在默认 system 之后
  customConstraints: '',        // 附加在默认 constraints 之后
});

const META_KEYS = Object.freeze({
  canon: 'storyguide_canon_outline',
  world: 'storyguide_world_setup',
  graph: 'storyguide_graph_data',
});

let lastReport = null;
let lastJsonText = '';
let refreshTimer = null;
let appendTimer = null;

// ============== 关键：DOM 追加缓存 & 观察者（抗重渲染） ==============
/**
 * inlineCache: Map<mesKey, { htmlInner: string, collapsed: boolean, createdAt: number }>
 * mesKey 优先用 DOM 的 mesid（如果拿不到则用 chatIndex）
 */
const inlineCache = new Map();
const panelCache = new Map(); // <mesKey, { htmlInner, collapsed, createdAt }>
let chatDomObserver = null;
let bodyDomObserver = null;
let reapplyTimer = null;

// -------------------- ST request headers compatibility --------------------
function getCsrfTokenCompat() {
  const meta = document.querySelector('meta[name="csrf-token"], meta[name="csrf_token"], meta[name="csrfToken"]');
  if (meta && meta.content) return meta.content;
  const ctx = SillyTavern.getContext?.() ?? {};
  return ctx.csrfToken || ctx.csrf_token || globalThis.csrf_token || globalThis.csrfToken || '';
}

function getStRequestHeadersCompat() {
  const ctx = SillyTavern.getContext?.() ?? {};
  let h = {};
  try {
    if (typeof SillyTavern.getRequestHeaders === 'function') h = SillyTavern.getRequestHeaders();
    else if (typeof ctx.getRequestHeaders === 'function') h = ctx.getRequestHeaders();
    else if (typeof globalThis.getRequestHeaders === 'function') h = globalThis.getRequestHeaders();
  } catch { h = {}; }

  h = { ...(h || {}) };

  const token = getCsrfTokenCompat();
  if (token) {
    if (!('X-CSRF-Token' in h) && !('X-CSRF-TOKEN' in h) && !('x-csrf-token' in h)) {
      h['X-CSRF-Token'] = token;
    }
  }
  return h;
}

// -------------------- utils --------------------

function clone(obj) { try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj)); } }

function ensureSettings() {
  const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
  if (!extensionSettings[MODULE_NAME]) {
    extensionSettings[MODULE_NAME] = clone(DEFAULT_SETTINGS);
    // 初始写入默认 modulesJson
    extensionSettings[MODULE_NAME].modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);
    saveSettingsDebounced();
  } else {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (!Object.hasOwn(extensionSettings[MODULE_NAME], k)) extensionSettings[MODULE_NAME][k] = DEFAULT_SETTINGS[k];
    }
    // 兼容旧版：若 modulesJson 为空，补默认
    if (!extensionSettings[MODULE_NAME].modulesJson) {
      extensionSettings[MODULE_NAME].modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);
    }
  }
  return extensionSettings[MODULE_NAME];
}

function saveSettings() { SillyTavern.getContext().saveSettingsDebounced(); }

function stripHtml(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]*>/g, '').replace(/\s+\n/g, '\n').trim();
}

function escapeHtml(text) {
  const s = String(text ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function stripCodeFences(text) {
  const t = String(text ?? '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m && m[1]) return String(m[1]).trim();
  return t;
}



function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(v, 10);
  if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  return fallback;
}
function clampFloat(v, min, max, fallback) {
  const n = Number.parseFloat(v);
  if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  return fallback;
}

function safeJsonParse(maybeJson) {
  if (!maybeJson) return null;
  let t = String(maybeJson).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  try { return JSON.parse(t); } catch { return null; }
}

function renderMarkdownToHtml(markdown) {
  const { showdown, DOMPurify } = SillyTavern.libs;
  const converter = new showdown.Converter({ simplifiedAutoLink: true, strikethrough: true, tables: true });
  const html = converter.makeHtml(markdown || '');
  return DOMPurify.sanitize(html);
}

function renderMarkdownInto($el, markdown) { $el.html(renderMarkdownToHtml(markdown)); }

function getChatMetaValue(key) {
  const { chatMetadata } = SillyTavern.getContext();
  return chatMetadata?.[key] ?? '';
}
async function setChatMetaValue(key, value) {
  const ctx = SillyTavern.getContext();
  ctx.chatMetadata[key] = value;
  await ctx.saveMetadata();
}

function setStatus(text, kind = '') {
  const $s = $('#sg_status');
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
}

function updateButtonsEnabled() {
  const ok = Boolean(lastReport?.markdown);
  $('#sg_copyMd').prop('disabled', !ok);
  $('#sg_copyJson').prop('disabled', !Boolean(lastJsonText));
  $('#sg_injectTips').prop('disabled', !ok);
}

function showPane(name) {
  $('#sg_modal .sg-tab').removeClass('active');
  $(`#sg_tab_${name}`).addClass('active');
  $('#sg_modal .sg-pane').removeClass('active');
  $(`#sg_pane_${name}`).addClass('active');
}

// -------------------- modules config --------------------

function validateAndNormalizeModules(raw) {
  const mods = Array.isArray(raw) ? raw : null;
  if (!mods) return { ok: false, error: '模块配置必须是 JSON 数组。', modules: null };

  const seen = new Set();
  const normalized = [];

  for (const m of mods) {
    if (!m || typeof m !== 'object') continue;
    const key = String(m.key || '').trim();
    if (!key) continue;
    if (seen.has(key)) return { ok: false, error: `模块 key 重复：${key}`, modules: null };
    seen.add(key);

    const type = String(m.type || 'text').trim();
    if (type !== 'text' && type !== 'list') return { ok: false, error: `模块 ${key} 的 type 必须是 "text" 或 "list"`, modules: null };

    const title = String(m.title || key).trim();
    const prompt = String(m.prompt || '').trim();

    const required = m.required !== false; // default true
    const panel = m.panel !== false;       // default true
    const inline = m.inline === true;      // default false unless explicitly true

    const maxItems = (type === 'list' && Number.isFinite(Number(m.maxItems))) ? clampInt(m.maxItems, 1, 50, 8) : undefined;

    normalized.push({ key, title, type, prompt, required, panel, inline, ...(maxItems ? { maxItems } : {}) });
  }

  if (!normalized.length) return { ok: false, error: '模块配置为空：至少需要 1 个模块。', modules: null };
  return { ok: true, error: '', modules: normalized };
}



// -------------------- presets & worldbook --------------------

function downloadTextFile(filename, text, mime='application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      input.remove();
      resolve(file);
    });
    input.click();
  });
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('FileReader error'));
    r.readAsText(file);
  });
}

// 尝试解析 SillyTavern 世界书导出 JSON（不同版本结构可能不同）
// 返回：[{ title, keys: string[], content: string }]
function parseWorldbookJson(rawText) {
  if (!rawText) return [];
  let data = null;
  try { data = JSON.parse(rawText); } catch { return []; }

  // Some exports embed JSON as a string field (double-encoded)
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { /* ignore */ }
  }

  function toArray(maybe) {
    if (!maybe) return null;
    if (Array.isArray(maybe)) return maybe;
    if (typeof maybe === 'object') {
      // common: entries as map {uid: entry}
      const vals = Object.values(maybe);
      if (vals.length && vals.every(v => typeof v === 'object')) return vals;
    }
    return null;
  }

  // try to locate entries container (array or map)
  const candidates = [
    data?.entries,
    data?.world_info?.entries,
    data?.worldInfo?.entries,
    data?.lorebook?.entries,
    data?.data?.entries,
    data?.items,
    data?.world_info,
    data?.worldInfo,
    data?.lorebook,
    Array.isArray(data) ? data : null,
  ].filter(Boolean);

  let entries = null;
  for (const c of candidates) {
    const arr = toArray(c);
    if (arr && arr.length) { entries = arr; break; }
    // sometimes nested: { entries: {..} }
    if (c && typeof c === 'object') {
      const inner = toArray(c.entries);
      if (inner && inner.length) { entries = inner; break; }
    }
  }
  if (!entries) return [];

  function splitKeys(str) {
    return String(str || '')
      .split(/[\n,，;；\|]+/g)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const norm = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;

    const title = String(e.title ?? e.name ?? e.comment ?? e.uid ?? e.id ?? '').trim();

    // keys can be stored in many variants in ST exports
    const kRaw =
      e.keys ??
      e.key ??
      e.keywords ??
      e.trigger ??
      e.triggers ??
      e.pattern ??
      e.match ??
      e.tags ??
      e.primary_key ??
      e.primaryKey ??
      e.keyprimary ??
      e.keyPrimary ??
      null;

    const k2Raw =
      e.keysecondary ??
      e.keySecondary ??
      e.secondary_keys ??
      e.secondaryKeys ??
      e.keys_secondary ??
      e.keysSecondary ??
      null;

    let keys = [];
    if (Array.isArray(kRaw)) keys = kRaw.map(x => String(x || '').trim()).filter(Boolean);
    else if (typeof kRaw === 'string') keys = splitKeys(kRaw);

    if (Array.isArray(k2Raw)) keys = keys.concat(k2Raw.map(x => String(x || '').trim()).filter(Boolean));
    else if (typeof k2Raw === 'string') keys = keys.concat(splitKeys(k2Raw));

    keys = Array.from(new Set(keys)).filter(Boolean);

    const content = String(
      e.content ?? e.entry ?? e.text ?? e.description ?? e.desc ?? e.body ?? e.value ?? e.prompt ?? ''
    ).trim();

    if (!content) continue;
    norm.push({ title: title || (keys[0] ? `条目：${keys[0]}` : '条目'), keys, content });
  }
  return norm;
}

function selectActiveWorldbookEntries(entries, recentText) {
  const text = String(recentText || '').toLowerCase();
  if (!text) return [];
  const picked = [];
  for (const e of entries) {
    const keys = Array.isArray(e.keys) ? e.keys : [];
    if (!keys.length) continue;
    const hit = keys.some(k => k && text.includes(String(k).toLowerCase()));
    if (hit) picked.push(e);
  }
  return picked;
}

function estimateTokens(text) {
  const s = String(text || '');
  // Try SillyTavern token counter if available
  try {
    const ctx = SillyTavern.getContext?.();
    if (ctx && typeof ctx.getTokenCount === 'function') {
      const n = ctx.getTokenCount(s);
      if (Number.isFinite(n)) return n;
    }
    if (typeof SillyTavern.getTokenCount === 'function') {
      const n = SillyTavern.getTokenCount(s);
      if (Number.isFinite(n)) return n;
    }
  } catch { /* ignore */ }

  // Fallback heuristic:
  // - CJK chars ~ 1 token each
  // - other chars ~ 1 token per 4 chars
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  const rest = s.replace(/[\u4e00-\u9fff]/g, '').replace(/\s+/g, '');
  const other = rest.length;
  return cjk + Math.ceil(other / 4);
}

function computeWorldbookInjection() {
  const s = ensureSettings();
  const raw = String(s.worldbookJson || '').trim();
  const enabled = !!s.worldbookEnabled;

  const result = {
    enabled,
    importedEntries: 0,
    selectedEntries: 0,
    injectedEntries: 0,
    injectedChars: 0,
    injectedTokens: 0,
    mode: String(s.worldbookMode || 'active'),
    text: ''
  };

  if (!raw) return result;

  const entries = parseWorldbookJson(raw);
  result.importedEntries = entries.length;
  if (!entries.length) return result;

  // 如果未启用注入：仅返回“导入数量”，不计算注入内容（UI 也能看到导入成功）
  if (!enabled) return result;

  // recent window text for activation
  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  const win = clampInt(s.worldbookWindowMessages, 5, 80, 18);
  const pickedMsgs = [];
  for (let i = chat.length - 1; i >= 0 && pickedMsgs.length < win; i--) {
    const m = chat[i];
    if (!m) continue;
    const t = stripHtml(m.mes ?? m.message ?? '');
    if (t) pickedMsgs.push(t);
  }
  const recentText = pickedMsgs.reverse().join('\n');

  let use = entries;
  if (result.mode === 'active') {
    const act = selectActiveWorldbookEntries(entries, recentText);
    use = act.length ? act : [];
  }
  result.selectedEntries = use.length;

  if (!use.length) return result;

  const maxChars = clampInt(s.worldbookMaxChars, 500, 50000, 6000);
  let acc = '';
  let used = 0;

  for (const e of use) {
    const head = `- 【${e.title}】${(e.keys && e.keys.length) ? `（触发：${e.keys.slice(0,6).join(' / ')}）` : ''}\n`;
    const body = e.content.trim() + '\n';
    const chunk = head + body + '\n';
    if ((acc.length + chunk.length) > maxChars) break;
    acc += chunk;
    used += 1;
  }

  result.injectedEntries = used;
  result.injectedChars = acc.length;
  result.injectedTokens = estimateTokens(acc);
  result.text = acc;

  return result;
}

let lastWorldbookStats = null;

function buildWorldbookBlock() {
  const info = computeWorldbookInjection();
  lastWorldbookStats = info;

  if (!info.enabled) return '';
  if (!info.text) return '';
  return `\n【世界书/World Info（已导入：${info.importedEntries}条，本次注入：${info.injectedEntries}条，约${info.injectedTokens} tokens）】\n${info.text}\n`;
}

// -------------------- graph/map (per-chat metadata) --------------------

function defaultGraphData() {
  return {
    nodes: [],
    edges: [],
    currentNodeId: '',
    backgroundImage: '',
    canvas: { width: 1400, height: 900 }
  };
}

function getGraphData() {
  const raw = getChatMetaValue(META_KEYS.graph);
  if (!raw) return defaultGraphData();
  try {
    const j = JSON.parse(String(raw));
    if (!j || typeof j !== 'object') return defaultGraphData();
    if (!Array.isArray(j.nodes)) j.nodes = [];
    if (!Array.isArray(j.edges)) j.edges = [];
    if (!j.canvas || typeof j.canvas !== 'object') j.canvas = { width: 1400, height: 900 };
    if (!Number.isFinite(Number(j.canvas.width))) j.canvas.width = 1400;
    if (!Number.isFinite(Number(j.canvas.height))) j.canvas.height = 900;
    j.currentNodeId = String(j.currentNodeId || '');
    j.backgroundImage = String(j.backgroundImage || '');
    return j;
  } catch {
    return defaultGraphData();
  }
}

let graphSaveTimer = null;
function saveGraphDataDebounced(data) {
  const payload = JSON.stringify(data);
  if (graphSaveTimer) clearTimeout(graphSaveTimer);
  graphSaveTimer = setTimeout(() => {
    graphSaveTimer = null;
    setChatMetaValue(META_KEYS.graph, payload).catch(() => {});
  }, 450);
}

function setGraphData(data) {
  const d = data || defaultGraphData();
  saveGraphDataDebounced(d);
  updateGraphInfoLabel();

  // (UI sync removed)

  if (isGraphModalOpen()) renderGraphModal();
}

function upsertNode(nodes, patch) {
  const id = String(patch.id || '').trim();
  if (!id) return;
  let n = nodes.find(x => String(x.id) === id);
  if (!n) {
    n = { id, name: id, type: 'character', parentId: '', x: 200, y: 200, description: '' };
    nodes.push(n);
  }
  for (const k of ['name','type','parentId','description']) {
    if (Object.hasOwn(patch, k)) n[k] = String(patch[k] ?? '');
  }
  if (Object.hasOwn(patch, 'x')) n.x = Number(patch.x);
  if (Object.hasOwn(patch, 'y')) n.y = Number(patch.y);
  if (Object.hasOwn(patch, 'coords')) {
    const t = String(patch.coords || '');
    const mm = t.split(',').map(v => Number(v.trim()));
    if (mm.length >= 2 && Number.isFinite(mm[0]) && Number.isFinite(mm[1])) { n.x = mm[0]; n.y = mm[1]; }
  }
  if (!Number.isFinite(n.x)) n.x = 200;
  if (!Number.isFinite(n.y)) n.y = 200;
}

function removeNode(nodes, id) {
  const i = nodes.findIndex(x => String(x.id) === String(id));
  if (i !== -1) nodes.splice(i, 1);
}

function upsertEdge(edges, patch) {
  const from = String(patch.from || patch.source || '').trim();
  const to = String(patch.to || patch.target || '').trim();
  if (!from || !to) return;
  const label = String(patch.label || '').trim();
  let e = edges.find(x => String(x.from) === from && String(x.to) === to && String(x.label||'') === label);
  if (!e) edges.push({ from, to, label });
}

function removeEdge(edges, patch) {
  const from = String(patch.from || patch.source || '').trim();
  const to = String(patch.to || patch.target || '').trim();
  const label = String(patch.label || '').trim();
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i];
    if (String(e.from) === from && String(e.to) === to) {
      if (!label || String(e.label||'') === label) edges.splice(i, 1);
    }
  }
}

function applyGraphUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) return 0;
  const g = getGraphData();
  let changed = 0;

  for (const u0 of updates) {
    const u = (u0 && typeof u0 === 'object') ? u0 : null;
    if (!u) continue;
    const op = String(u.op || u.action || '').trim().toLowerCase();

    if (op === 'add_or_update' || op === 'upsert' || op === 'add_or_update_node' || op === 'node') {
      upsertNode(g.nodes, u);
      changed++;
      continue;
    }
    if (op === 'remove' || op === 'remove_node' || op === 'delete_node') {
      removeNode(g.nodes, u.id);
      // 同时移除相关边
      const id = String(u.id || '');
      g.edges = g.edges.filter(e => String(e.from) !== id && String(e.to) !== id);
      if (g.currentNodeId === id) g.currentNodeId = '';
      changed++;
      continue;
    }
    if (op === 'add_or_update_edge' || op === 'edge' || op === 'add_edge' || op === 'upsert_edge') {
      upsertEdge(g.edges, u);
      changed++;
      continue;
    }
    if (op === 'remove_edge' || op === 'delete_edge') {
      removeEdge(g.edges, u);
      changed++;
      continue;
    }
    if (op === 'set_current' || op === 'set_current_node' || op === 'current') {
      const id = String(u.id || u.nodeId || u.currentNodeId || '').trim();
      if (id) {
        g.currentNodeId = id;
        changed++;
      }
      continue;
    }
    if (op === 'set_background' || op === 'background') {
      const bg = String(u.url || u.backgroundImage || u.bg || '').trim();
      if (bg !== String(g.backgroundImage || '')) {
        g.backgroundImage = bg;
        changed++;
      }
      continue;
    }

    // 兼容：TheWorld 风格里 coords/parentId 等也在 add_or_update 里，这里已处理
  }

  if (changed) setGraphData(g);
  return changed;
}

function extractUpdatesFromText(text) {
  const t = String(text || '');
  const out = [];
  const re1 = /<MapUpdate>\s*([\s\S]+?)\s*<\/MapUpdate>/ig;
  const re2 = /<GraphUpdate>\s*([\s\S]+?)\s*<\/GraphUpdate>/ig;

  const grab = (re) => {
    let m;
    while ((m = re.exec(t))) {
      const body = String(m[1] || '').trim();
      try {
        const j = JSON.parse(body);
        if (Array.isArray(j)) out.push(...j);
      } catch { /* ignore */ }
    }
  };
  grab(re1); grab(re2);
  return out;
}

function walkStrings(obj, fn) {
  if (!obj) return;
  if (typeof obj === 'string') { fn(obj); return; }
  if (Array.isArray(obj)) { obj.forEach(v => walkStrings(v, fn)); return; }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) walkStrings(obj[k], fn);
  }
}

function maybeProcessGraphUpdateFromOutput(rawText, parsedObj) {
  const s = ensureSettings();
  if (!s.graphAllowMapUpdate) return 0;

  let updates = extractUpdatesFromText(rawText);
  if (parsedObj) {
    walkStrings(parsedObj, (str) => { updates = updates.concat(extractUpdatesFromText(str)); });
    // 也支持显式字段：map_update / graph_update（数组）
    if (Array.isArray(parsedObj.map_update)) updates = updates.concat(parsedObj.map_update);
    if (Array.isArray(parsedObj.graph_update)) updates = updates.concat(parsedObj.graph_update);
  }
  updates = updates.filter(x => x && typeof x === 'object');
  return applyGraphUpdates(updates);
}

function buildGraphBlock() {
  const s = ensureSettings();
  if (!s.graphInject) return '';

  const g = getGraphData();
  const maxChars = clampInt(s.graphMaxChars, 500, 50000, DEFAULT_SETTINGS.graphMaxChars);

  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];

  const current = nodes.find(n => String(n.id) === String(g.currentNodeId));
  const header = `【图谱/地图（节点：${nodes.length}，关系：${edges.length}，当前位置：${current ? current.name : '未设置'}）】`;

  const lines = [header];
  // 简要列出节点
  const maxList = Math.min(nodes.length, 60);
  for (let i = 0; i < maxList; i++) {
    const n = nodes[i];
    const type = n.type ? `#${n.type}` : '';
    const parent = n.parentId ? ` parent=${n.parentId}` : '';
    lines.push(`- ${n.id}（${n.name}）${type}${parent}`);
  }
  if (nodes.length > maxList) lines.push(`- …（省略 ${nodes.length - maxList} 个节点）`);

  // 简要列出关系
  if (edges.length) {
    lines.push(`\n【关系】`);
    const maxE = Math.min(edges.length, 80);
    for (let i = 0; i < maxE; i++) {
      const e = edges[i];
      const label = e.label ? `（${e.label}）` : '';
      lines.push(`- ${e.from} → ${e.to}${label}`);
    }
    if (edges.length > maxE) lines.push(`- …（省略 ${edges.length - maxE} 条关系）`);
  }

  let text = lines.join('\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '…';
  return `\n${text}\n`;
}



// -------------------- external world source --------------------

function parseHeadersJson(text) {
  const t = String(text ?? '').trim();
  if (!t) return {};
  try {
    const j = JSON.parse(t);
    if (j && typeof j === 'object' && !Array.isArray(j)) return j;
  } catch { /* ignore */ }
  return null; // invalid
}

function formatTime(ts) {
  const n = Number(ts || 0);
  if (!n) return '未刷新';
  const d = new Date(n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function updateWorldSourceInfoLabel() {
  const $info = $('#sg_worldSourceInfo');
  if (!$info.length) return;
  const s = ensureSettings();
  const len = (s.worldSourceCache ? String(s.worldSourceCache).length : 0);
  const t = formatTime(s.worldSourceLastFetchedAt);
  const url = s.worldSourceUrl ? ` · ${s.worldSourceUrl}` : '';
  $info.text(`上次刷新：${t} · ${len} 字符${url}`);
}

function buildWorldSourceBlock() {
  const s = ensureSettings();
  if (!s.worldSourceEnabled || !s.worldSourceInjectToAnalysis) return '';
  const url = String(s.worldSourceUrl || '').trim();
  const maxChars = clampInt(s.worldSourceMaxChars, 500, 200000, DEFAULT_SETTINGS.worldSourceMaxChars);
  const raw = String(s.worldSourceCache || '').trim();

  if (!raw) return `【外部世界信息】（未刷新）\n`;
  const text = raw.length > maxChars ? raw.slice(0, maxChars) + '…' : raw;
  return `【外部世界信息${url ? `（${url}）` : ''}】\n${text}\n`;
}

function getWorldSourceTextForMapGen() {
  const s = ensureSettings();
  if (!s.worldSourceEnabled) return '';
  const maxChars = clampInt(s.worldSourceMaxChars, 500, 200000, DEFAULT_SETTINGS.worldSourceMaxChars);
  const raw = String(s.worldSourceCache || '').trim();
  if (!raw) return '';
  return raw.length > maxChars ? raw.slice(0, maxChars) + '…' : raw;
}

async function fetchWorldSourceNow() {
  const s = ensureSettings();
  if (!s.worldSourceUrl) throw new Error('请填写世界信息源 URL');
  const url = String(s.worldSourceUrl || '').trim();
  const method = String(s.worldSourceMethod || 'GET').toUpperCase();

  const headersObj = parseHeadersJson(s.worldSourceHeadersJson);
  if (headersObj === null) throw new Error('请求头 JSON 格式不正确');

  const headers = { ...headersObj };
  if (!headers.Accept) headers.Accept = 'application/json, text/plain, */*';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`世界信息源请求失败: HTTP ${res.status} ${res.statusText}\n${text}`);
    err.status = res.status;
    throw err;
  }

  const ct = String(res.headers.get('content-type') || '');
  let text = '';
  if (ct.includes('application/json')) {
    const j = await res.json().catch(() => null);
    text = JSON.stringify(j ?? {}, null, 2);
  } else {
    text = await res.text().catch(() => '');
  }

  const maxChars = clampInt(s.worldSourceMaxChars, 500, 200000, DEFAULT_SETTINGS.worldSourceMaxChars);
  if (text.length > maxChars) text = text.slice(0, maxChars) + '…';

  s.worldSourceCache = text;
  s.worldSourceLastFetchedAt = Date.now();
  saveSettings();

  updateWorldSourceInfoLabel();
  return text;
}

function clearWorldSourceCache() {
  const s = ensureSettings();
  s.worldSourceCache = '';
  s.worldSourceLastFetchedAt = 0;
  saveSettings();
  updateWorldSourceInfoLabel();
}

// -------------------- graph UI --------------------

let sgGraphBackdrop = null;
let sgGraphUi = {
  scale: 1,
  tx: 0,
  ty: 0,
  selectedId: '',
};

function isGraphModalOpen() {
  return !!(sgGraphBackdrop && document.body.contains(sgGraphBackdrop));
}

function closeGraphModal() {
  if (sgGraphBackdrop && sgGraphBackdrop.parentNode) sgGraphBackdrop.parentNode.removeChild(sgGraphBackdrop);
  sgGraphBackdrop = null;
}

function openGraphModal() {
  if (isGraphModalOpen()) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'sg-graph-backdrop';
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeGraphModal();
  });

  const modal = document.createElement('div');
  modal.className = 'sg-graph-modal';
  modal.innerHTML = `
    <div class="sg-graph-head">
      <div class="sg-graph-title">图谱 / 地图</div>
      <div class="sg-graph-mini" id="sg_graph_head_info"></div>
      <div class="sg-graph-toolbar">
        <button class="menu_button sg-btn" id="sg_graph_fit">适配</button>
        <button class="menu_button sg-btn" id="sg_graph_reset">重置视图</button>
        <button class="menu_button sg-btn" id="sg_graph_add_node">+ 节点</button>
        <button class="menu_button sg-btn" id="sg_graph_add_edge">+ 关系</button>
        <button class="menu_button sg-btn" id="sg_graph_close">关闭</button>
      </div>
    </div>
    <div class="sg-graph-body">
      <div class="sg-graph-side">
        <div class="sg-graph-field">
          <label>搜索</label>
          <input id="sg_graph_search" type="text" placeholder="输入 id / 名称…">
        </div>
        <div class="sg-graph-field">
          <label>选中节点</label>
          <select id="sg_graph_select"></select>
        </div>
        <div class="sg-graph-field">
          <label>名称</label>
          <input id="sg_graph_name" type="text">
        </div>
        <div class="sg-graph-field">
          <label>类型</label>
          <select id="sg_graph_type">
            <option value="character">角色</option>
            <option value="location">地点</option>
            <option value="faction">组织/势力</option>
            <option value="item">物品</option>
            <option value="event">事件</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="sg-graph-field">
          <label>父节点ID（可空，用于地点层级）</label>
          <input id="sg_graph_parent" type="text" placeholder="例如：city_alpha">
        </div>
        <div class="sg-graph-field">
          <label>描述</label>
          <textarea id="sg_graph_desc" rows="4"></textarea>
        </div>
        <div class="sg-row sg-inline">
          <button class="menu_button sg-btn" id="sg_graph_set_current">设为当前位置</button>
          <button class="menu_button sg-btn" id="sg_graph_delete">删除节点</button>
        </div>

        <div class="sg-graph-mini" style="margin-top:10px;">
          小技巧：拖动节点可改坐标；鼠标滚轮缩放；拖动画布平移。<br>
          AI 更新：在任意输出字段里包含 <code>&lt;MapUpdate&gt;[...]&lt;/MapUpdate&gt;</code> 即可更新。
        </div>

        <div class="sg-graph-list" id="sg_graph_list"></div>
      </div>

      <div class="sg-graph-canvas">
        <div class="sg-graph-viewport" id="sg_graph_viewport">
          <div class="sg-graph-scene" id="sg_graph_scene">
            <div class="sg-graph-bg" id="sg_graph_bg"></div>
            <svg class="sg-graph-svg" id="sg_graph_svg"></svg>
          </div>
        </div>
      </div>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  sgGraphBackdrop = backdrop;

  // wire
  modal.querySelector('#sg_graph_close').addEventListener('click', closeGraphModal);
  modal.querySelector('#sg_graph_fit').addEventListener('click', () => fitGraphToBounds());
  modal.querySelector('#sg_graph_reset').addEventListener('click', () => resetGraphView());
  modal.querySelector('#sg_graph_add_node').addEventListener('click', () => addGraphNodePrompt());
  modal.querySelector('#sg_graph_add_edge').addEventListener('click', () => addGraphEdgePrompt());

  const viewport = modal.querySelector('#sg_graph_viewport');
  viewport.addEventListener('wheel', (e) => onGraphWheel(e), { passive: false });
  viewport.addEventListener('pointerdown', (e) => onGraphPanStart(e));

  modal.querySelector('#sg_graph_search').addEventListener('input', () => renderGraphModal());
  modal.querySelector('#sg_graph_select').addEventListener('change', (e) => {
    sgGraphUi.selectedId = String(e.target.value || '');
    renderGraphModal();
  });

  const saveField = () => saveSelectedNodeFromFields();
  ['#sg_graph_name','#sg_graph_type','#sg_graph_parent','#sg_graph_desc'].forEach(sel => {
    modal.querySelector(sel).addEventListener('change', saveField);
    modal.querySelector(sel).addEventListener('blur', saveField);
  });

  modal.querySelector('#sg_graph_set_current').addEventListener('click', () => {
    const g = getGraphData();
    if (!sgGraphUi.selectedId) return;
    g.currentNodeId = sgGraphUi.selectedId;
    setGraphData(g);
    renderGraphModal();
  });

  modal.querySelector('#sg_graph_delete').addEventListener('click', () => {
    if (!sgGraphUi.selectedId) return;
    if (!confirm(`删除节点 ${sgGraphUi.selectedId}？（相关关系也会删除）`)) return;
    const g = getGraphData();
    const id = sgGraphUi.selectedId;
    g.nodes = g.nodes.filter(n => String(n.id) !== id);
    g.edges = g.edges.filter(e => String(e.from) !== id && String(e.to) !== id);
    if (g.currentNodeId === id) g.currentNodeId = '';
    sgGraphUi.selectedId = '';
    setGraphData(g);
    renderGraphModal();
  });

  resetGraphView(true);
  renderGraphModal();
}

function resetGraphView(keepSelection = false) {
  sgGraphUi.scale = 1;
  sgGraphUi.tx = 0;
  sgGraphUi.ty = 0;
  if (!keepSelection) sgGraphUi.selectedId = '';
  applyGraphTransform();
}

function applyGraphTransform() {
  if (!isGraphModalOpen()) return;
  const scene = document.getElementById('sg_graph_scene');
  if (!scene) return;
  scene.style.transform = `translate(${sgGraphUi.tx}px, ${sgGraphUi.ty}px) scale(${sgGraphUi.scale})`;
}

function screenToWorld(x, y) {
  return {
    x: (x - sgGraphUi.tx) / sgGraphUi.scale,
    y: (y - sgGraphUi.ty) / sgGraphUi.scale
  };
}

let panState = null;
function onGraphPanStart(ev) {
  // only when clicking background (not node)
  const target = ev.target;
  if (target && target.classList && target.classList.contains('sg-graph-node')) return;
  const viewport = document.getElementById('sg_graph_viewport');
  if (!viewport) return;
  ev.preventDefault();
  panState = { x: ev.clientX, y: ev.clientY, tx: sgGraphUi.tx, ty: sgGraphUi.ty, pid: ev.pointerId };
  viewport.classList.add('is-panning');
  viewport.setPointerCapture?.(ev.pointerId);
  window.addEventListener('pointermove', onGraphPanMove, true);
  window.addEventListener('pointerup', onGraphPanEnd, true);
  window.addEventListener('pointercancel', onGraphPanEnd, true);
}

function onGraphPanMove(ev) {
  if (!panState) return;
  const dx = ev.clientX - panState.x;
  const dy = ev.clientY - panState.y;
  sgGraphUi.tx = panState.tx + dx;
  sgGraphUi.ty = panState.ty + dy;
  applyGraphTransform();
}

function onGraphPanEnd(ev) {
  if (!panState) return;
  const viewport = document.getElementById('sg_graph_viewport');
  viewport?.classList.remove('is-panning');
  try { viewport?.releasePointerCapture?.(panState.pid); } catch {}
  panState = null;
  window.removeEventListener('pointermove', onGraphPanMove, true);
  window.removeEventListener('pointerup', onGraphPanEnd, true);
  window.removeEventListener('pointercancel', onGraphPanEnd, true);
}

function onGraphWheel(ev) {
  ev.preventDefault();
  const delta = ev.deltaY;
  const factor = delta > 0 ? 0.9 : 1.1;
  const oldScale = sgGraphUi.scale;
  let newScale = oldScale * factor;
  newScale = Math.min(2.6, Math.max(0.35, newScale));

  const rect = ev.currentTarget.getBoundingClientRect();
  const px = ev.clientX - rect.left;
  const py = ev.clientY - rect.top;

  // zoom around pointer
  const wx = (px - sgGraphUi.tx) / oldScale;
  const wy = (py - sgGraphUi.ty) / oldScale;
  sgGraphUi.scale = newScale;
  sgGraphUi.tx = px - wx * newScale;
  sgGraphUi.ty = py - wy * newScale;

  applyGraphTransform();
}

function fitGraphToBounds() {
  if (!isGraphModalOpen()) return;
  const g = getGraphData();
  const nodes = g.nodes || [];
  if (!nodes.length) { resetGraphView(true); return; }

  const viewport = document.getElementById('sg_graph_viewport');
  const scene = document.getElementById('sg_graph_scene');
  if (!viewport || !scene) return;

  const rect = viewport.getBoundingClientRect();
  const pad = 40;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const x = Number(n.x), y = Number(n.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) { resetGraphView(true); return; }

  const bw = Math.max(80, maxX - minX + 160);
  const bh = Math.max(80, maxY - minY + 160);

  const sx = (rect.width - pad * 2) / bw;
  const sy = (rect.height - pad * 2) / bh;
  const scale = Math.min(2.3, Math.max(0.35, Math.min(sx, sy)));

  sgGraphUi.scale = scale;
  sgGraphUi.tx = pad - (minX - 80) * scale;
  sgGraphUi.ty = pad - (minY - 80) * scale;

  applyGraphTransform();
}

function addGraphNodePrompt() {
  const id = prompt('新节点 ID（英文/数字/下划线，唯一）', `node_${Date.now()}`);
  if (!id) return;
  const name = prompt('节点名称（显示用）', id) || id;
  const type = prompt('类型（character/location/faction/item/event/other）', 'character') || 'character';

  const g = getGraphData();
  const exists = g.nodes.find(n => String(n.id) === String(id));
  if (exists) { alert('该 ID 已存在'); return; }

  // place at viewport center
  const viewport = document.getElementById('sg_graph_viewport');
  const rect = viewport ? viewport.getBoundingClientRect() : { width: 800, height: 500 };
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const w = screenToWorld(cx, cy);

  g.nodes.push({ id: String(id), name: String(name), type: String(type), parentId: '', x: w.x, y: w.y, description: '' });
  sgGraphUi.selectedId = String(id);
  setGraphData(g);
  renderGraphModal();
}

function addGraphEdgePrompt() {
  const input = prompt('新增关系：格式  sourceId -> targetId : 标签(可选)\n例如：alice -> bob : 兄妹', '');
  if (!input) return;

  const m = input.match(/^\s*([^\s\-:>]+)\s*->\s*([^\s:]+)\s*(?::\s*(.+))?$/);
  if (!m) { alert('格式不正确'); return; }

  const from = String(m[1] || '').trim();
  const to = String(m[2] || '').trim();
  const label = String(m[3] || '').trim();

  const g = getGraphData();
  upsertEdge(g.edges, { from, to, label });
  setGraphData(g);
  renderGraphModal();
}

function saveSelectedNodeFromFields() {
  if (!isGraphModalOpen()) return;
  if (!sgGraphUi.selectedId) return;

  const g = getGraphData();
  const n = g.nodes.find(x => String(x.id) === String(sgGraphUi.selectedId));
  if (!n) return;

  const $ = (id) => document.getElementById(id);
  const name = $('sg_graph_name')?.value ?? '';
  const type = $('sg_graph_type')?.value ?? 'character';
  const parentId = $('sg_graph_parent')?.value ?? '';
  const desc = $('sg_graph_desc')?.value ?? '';

  n.name = String(name);
  n.type = String(type);
  n.parentId = String(parentId);
  n.description = String(desc);

  setGraphData(g);
}

function renderGraphModal() {
  if (!isGraphModalOpen()) return;
  const modal = sgGraphBackdrop.querySelector('.sg-graph-modal');
  if (!modal) return;

  const g = getGraphData();
  const nodes = g.nodes || [];
  const edges = g.edges || [];

  // header info
  const current = nodes.find(n => String(n.id) === String(g.currentNodeId));
  modal.querySelector('#sg_graph_head_info').textContent = `节点 ${nodes.length} · 关系 ${edges.length} · 当前位置：${current ? current.name : '未设置'}`;

  // background
  const bg = modal.querySelector('#sg_graph_bg');
  if (bg) bg.style.backgroundImage = g.backgroundImage ? `url(${g.backgroundImage})` : 'none';

  // search
  const q = String(modal.querySelector('#sg_graph_search').value || '').trim().toLowerCase();
  const filtered = q ? nodes.filter(n => String(n.id).toLowerCase().includes(q) || String(n.name||'').toLowerCase().includes(q)) : nodes;

  // select options
  const sel = modal.querySelector('#sg_graph_select');
  const keep = sgGraphUi.selectedId;
  sel.innerHTML = `<option value="">（未选择）</option>` + filtered.slice(0, 400).map(n => `<option value="${escapeHtml(n.id)}">${escapeHtml(n.id)}（${escapeHtml(n.name||'')}）</option>`).join('');
  if (keep && filtered.some(n => String(n.id) === keep)) sel.value = keep;
  else if (!keep && filtered.length) { /* keep none */ }

  // side list (quick click)
  const list = modal.querySelector('#sg_graph_list');
  list.innerHTML = filtered.slice(0, 120).map(n => {
    const tag = n.type ? `#${escapeHtml(n.type)}` : '';
    return `<div class="sg-graph-item" data-id="${escapeHtml(n.id)}"><b>${escapeHtml(n.name||n.id)}</b> <span class="sg-muted">${escapeHtml(n.id)}</span> <span class="sg-muted">${tag}</span></div>`;
  }).join('');
  list.querySelectorAll('.sg-graph-item').forEach(el => {
    el.addEventListener('click', () => {
      sgGraphUi.selectedId = el.getAttribute('data-id') || '';
      renderGraphModal();
    });
  });

  // fill fields
  const node = nodes.find(n => String(n.id) === String(sgGraphUi.selectedId));
  modal.querySelector('#sg_graph_name').value = node ? String(node.name||'') : '';
  modal.querySelector('#sg_graph_type').value = node ? String(node.type||'character') : 'character';
  modal.querySelector('#sg_graph_parent').value = node ? String(node.parentId||'') : '';
  modal.querySelector('#sg_graph_desc').value = node ? String(node.description||'') : '';

  // render scene size
  const scene = modal.querySelector('#sg_graph_scene');
  const W = Number(g.canvas?.width) || 1400;
  const H = Number(g.canvas?.height) || 900;
  scene.style.width = `${W}px`;
  scene.style.height = `${H}px`;

  // nodes
  // remove old node divs (keep bg + svg)
  [...scene.querySelectorAll('.sg-graph-node')].forEach(el => el.remove());

  for (const n of nodes) {
    const el = document.createElement('div');
    el.className = 'sg-graph-node';
    el.dataset.id = String(n.id);
    el.dataset.type = String(n.type || 'other');
    el.textContent = String(n.name || n.id);
    el.style.left = `${Number(n.x) || 0}px`;
    el.style.top = `${Number(n.y) || 0}px`;
    if (String(n.id) === String(g.currentNodeId)) el.classList.add('is-current');
    scene.appendChild(el);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      sgGraphUi.selectedId = String(n.id);
      renderGraphModal();
    });

    enableNodeDrag(el);
  }

  // edges (SVG)
  const svg = modal.querySelector('#sg_graph_svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const nodeById = new Map(nodes.map(n => [String(n.id), n]));
  const edgeEls = [];

  for (const e of edges) {
    const a = nodeById.get(String(e.from));
    const b = nodeById.get(String(e.to));
    if (!a || !b) continue;

    const x1 = Number(a.x) || 0;
    const y1 = Number(a.y) || 0;
    const x2 = Number(b.x) || 0;
    const y2 = Number(b.y) || 0;

    edgeEls.push(`<line class="sg-graph-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    if (e.label) {
      edgeEls.push(`<text class="sg-graph-edge-label" x="${mx}" y="${my - 6}" text-anchor="middle">${escapeHtml(String(e.label))}</text>`);
    }
  }

  svg.innerHTML = edgeEls.join('');

  applyGraphTransform();
}

function enableNodeDrag(el) {
  let dragging = false;
  let start = null;
  let moved = false;

  const onMove = (ev) => {
    if (!dragging || !start) return;
    const dx = (ev.clientX - start.sx) / sgGraphUi.scale;
    const dy = (ev.clientY - start.sy) / sgGraphUi.scale;
    if (!moved && (Math.abs(dx) + Math.abs(dy) > 2)) moved = true;

    const nx = start.x + dx;
    const ny = start.y + dy;

    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;

    // update in data and rerender edges only (fast)
    const g = getGraphData();
    const n = g.nodes.find(n => String(n.id) === String(el.dataset.id));
    if (n) { n.x = nx; n.y = ny; saveGraphDataDebounced(g); }
    renderGraphEdgesOnly();
  };

  const onUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    try { el.releasePointerCapture(ev.pointerId); } catch {}
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
  };

  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    dragging = true;
    moved = false;
    el.classList.add('is-dragging');
    try { el.setPointerCapture(ev.pointerId); } catch {}

    const g = getGraphData();
    const n = g.nodes.find(n => String(n.id) === String(el.dataset.id));
    start = {
      sx: ev.clientX,
      sy: ev.clientY,
      x: Number(n?.x) || 0,
      y: Number(n?.y) || 0
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  });
}

function renderGraphEdgesOnly() {
  if (!isGraphModalOpen()) return;
  const modal = sgGraphBackdrop.querySelector('.sg-graph-modal');
  if (!modal) return;

  const g = getGraphData();
  const nodes = g.nodes || [];
  const edges = g.edges || [];
  const W = Number(g.canvas?.width) || 1400;
  const H = Number(g.canvas?.height) || 900;

  const svg = modal.querySelector('#sg_graph_svg');
  if (!svg) return;
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const nodeById = new Map(nodes.map(n => [String(n.id), n]));
  const edgeEls = [];

  for (const e of edges) {
    const a = nodeById.get(String(e.from));
    const b = nodeById.get(String(e.to));
    if (!a || !b) continue;

    const x1 = Number(a.x) || 0;
    const y1 = Number(a.y) || 0;
    const x2 = Number(b.x) || 0;
    const y2 = Number(b.y) || 0;

    edgeEls.push(`<line class="sg-graph-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    if (e.label) {
      edgeEls.push(`<text class="sg-graph-edge-label" x="${mx}" y="${my - 6}" text-anchor="middle">${escapeHtml(String(e.label))}</text>`);
    }
  }
  svg.innerHTML = edgeEls.join('');
}

function updateGraphInfoLabel() {
  const $info = $('#sg_graphInfo');
  if (!$info.length) return;
  const g = getGraphData();
  const nodes = Array.isArray(g.nodes) ? g.nodes : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];
  const current = nodes.find(n => String(n.id) === String(g.currentNodeId));
  const curText = current ? `，当前位置：${current.name}` : '';
  $info.text(`图谱：${nodes.length} 节点 / ${edges.length} 关系${curText}`);
}

function parseGraphJson(text) {
  const t = String(text || '').trim();
  if (!t) return defaultGraphData();
  let j = null;
  try { j = JSON.parse(t); } catch { j = null; }
  if (!j || typeof j !== 'object') return defaultGraphData();
  // 兼容：只有 nodes/edges 的对象
  if (!Array.isArray(j.nodes)) j.nodes = [];
  if (!Array.isArray(j.edges)) j.edges = [];
  if (!j.canvas) j.canvas = { width: 1400, height: 900 };
  j.backgroundImage = String(j.backgroundImage || '');
  j.currentNodeId = String(j.currentNodeId || '');
  return j;
}

function exportGraphJson() {
  const g = getGraphData();
  const txt = JSON.stringify(g, null, 2);
  const blob = new Blob([txt], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `storyguide-graph-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function getModules(mode /* panel|append */) {
  const s = ensureSettings();
  const rawText = String(s.modulesJson || '').trim();
  let parsed = null;
  try { parsed = JSON.parse(rawText); } catch { parsed = null; }

  const v = validateAndNormalizeModules(parsed);
  const base = v.ok ? v.modules : clone(DEFAULT_MODULES);

  if (mode === 'append') {
    const src = String(s.inlineModulesSource || 'inline');
    if (src === 'all') return base;
    if (src === 'panel') return base.filter(m => m.panel);
    return base.filter(m => m.inline);
  }

  return base.filter(m => m.panel); // panel
}

// -------------------- prompt (database-like skeleton + modules) --------------------

function spoilerPolicyText(level) {
  switch (level) {
    case 'none': return `【剧透策略】严格不剧透：不要透露原著明确未来事件与真相；只给“行动建议/风险提示”，避免点名关键反转。`;
    case 'full': return `【剧透策略】允许全剧透：可以直接指出原著后续的关键事件/真相，并解释如何影响当前路线。`;
    case 'mild':
    default: return `【剧透策略】轻剧透：可以用“隐晦提示 + 关键风险点”，避免把原著后续完整摊开；必要时可点到为止。`;
  }
}

function buildSchemaFromModules(modules) {
  const properties = {};
  const required = [];

  for (const m of modules) {
    if (m.type === 'list') {
      properties[m.key] = {
        type: 'array',
        items: { type: 'string' },
        ...(m.maxItems ? { maxItems: m.maxItems } : {}),
        minItems: 0
      };
    } else {
      properties[m.key] = { type: 'string' };
    }
    if (m.required) required.push(m.key);
  }

  return {
    name: 'StoryGuideDynamicReport',
    description: '剧情指导动态输出（按模块配置生成）',
    strict: true,
    value: {
      '$schema': 'http://json-schema.org/draft-04/schema#',
      type: 'object',
      additionalProperties: false,
      properties,
      required
    }
  };
}

function buildOutputFieldsText(modules) {
  // 每个模块一行：key: title — prompt
  const lines = [];
  for (const m of modules) {
    const p = m.prompt ? ` — ${m.prompt}` : '';
    const t = m.title ? `（${m.title}）` : '';
    if (m.type === 'list') {
      lines.push(`- ${m.key}${t}: string[]${m.maxItems ? ` (<=${m.maxItems})` : ''}${p}`);
    } else {
      lines.push(`- ${m.key}${t}: string${p}`);
    }
  }
  return lines.join('\n');
}

function buildPromptMessages(snapshotText, spoilerLevel, modules, mode /* panel|append */) {
  const s = ensureSettings();
  const compactHint = mode === 'append'
    ? `【输出偏好】更精简：少废话、少铺垫、直给关键信息。`
    : `【输出偏好】适度详细：以“可执行引导”为主，不要流水账。`;

  const extraSystem = String(s.customSystemPreamble || '').trim();
  const extraConstraints = String(s.customConstraints || '').trim();

  const system = [
    `---BEGIN PROMPT---`,
    `[System]`,
    `你是执行型“剧情指导/编剧顾问”。从“正在经历的世界”（聊天+设定）提炼结构，并给出后续引导。`,
    spoilerPolicyText(spoilerLevel),
    compactHint,
    extraSystem ? `\n【自定义 System 补充】\n${extraSystem}` : ``,
    ``,
    `[Constraints]`,
    `1) 不要凭空杜撰世界观/人物/地点；不确定写“未知/待确认”。`,
    `2) 不要复述流水账；只提炼关键矛盾、动机、风险与走向。`,
    `3) 输出必须是 JSON 对象本体（无 Markdown、无代码块、无多余解释）。`,
    `4) 只输出下面列出的字段，不要额外字段。`,
    extraConstraints ? `\n【自定义 Constraints 补充】\n${extraConstraints}` : ``,
    ``,
    `[Output Fields]`,
    buildOutputFieldsText(modules),
    `---END PROMPT---`
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: snapshotText }
  ];
}

// -------------------- snapshot --------------------

function buildSnapshot() {
  const ctx = SillyTavern.getContext();
  const s = ensureSettings();

  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  const maxMessages = clampInt(s.maxMessages, 5, 200, DEFAULT_SETTINGS.maxMessages);
  const maxChars = clampInt(s.maxCharsPerMessage, 200, 8000, DEFAULT_SETTINGS.maxCharsPerMessage);

  let charBlock = '';
  try {
    if (ctx.characterId !== undefined && ctx.characterId !== null && Array.isArray(ctx.characters)) {
      const c = ctx.characters[ctx.characterId];
      if (c) {
        const name = c.name ?? '';
        const desc = c.description ?? c.desc ?? '';
        const personality = c.personality ?? '';
        const scenario = c.scenario ?? '';
        const first = c.first_mes ?? c.first_message ?? '';
        charBlock =
          `【角色卡】\n` +
          `- 名称：${stripHtml(name)}\n` +
          `- 描述：${stripHtml(desc)}\n` +
          `- 性格：${stripHtml(personality)}\n` +
          `- 场景/设定：${stripHtml(scenario)}\n` +
          (first ? `- 开场白：${stripHtml(first)}\n` : '');
      }
    }
  } catch (e) { console.warn('[StoryGuide] character read failed:', e); }

  const canon = stripHtml(getChatMetaValue(META_KEYS.canon));
  const world = stripHtml(getChatMetaValue(META_KEYS.world));

  const picked = [];
  for (let i = chat.length - 1; i >= 0 && picked.length < maxMessages; i--) {
    const m = chat[i];
    if (!m) continue;

    const isUser = m.is_user === true;
    if (isUser && !s.includeUser) continue;
    if (!isUser && !s.includeAssistant) continue;

    const name = stripHtml(m.name || (isUser ? 'User' : 'Assistant'));
    let text = stripHtml(m.mes ?? m.message ?? '');
    if (!text) continue;
    if (text.length > maxChars) text = text.slice(0, maxChars) + '…(截断)';
    picked.push(`【${name}】${text}`);
  }
  picked.reverse();

  const sourceSummary = {
    totalMessages: chat.length,
    usedMessages: picked.length,
    hasCanon: Boolean(canon),
    hasWorld: Boolean(world),
    characterSelected: ctx.characterId !== undefined && ctx.characterId !== null
  };

  const snapshotText = [
    `【任务】你是“剧情指导”。根据下方“正在经历的世界”（聊天 + 设定）输出结构化报告。`,
    ``,
    charBlock ? charBlock : `【角色卡】（未获取到/可能是群聊）`,
    ``,
    world ? `【世界观/设定补充】\n${world}\n` : `【世界观/设定补充】（未提供）\n`,
    canon ? `【原著后续/大纲】\n${canon}\n` : `【原著后续/大纲】（未提供）\n`,
    buildWorldbookBlock(),
    buildGraphBlock(),    `【聊天记录（最近${picked.length}条）】`,
    picked.length ? picked.join('\n\n') : '（空）'
  ].join('\n');

  return { snapshotText, sourceSummary };
}



async function runGraphAutoGenerate() {
  const s = ensureSettings();
  if (!s.enabled) { setStatus('插件未启用', 'warn'); return; }

  setStatus('正在生成地图/图谱…', 'warn');
  $('#sg_autogenGraph').prop('disabled', true);

  try {
    const { snapshotText } = buildSnapshot();
    const g = getGraphData();

    const nodesSummary = (g.nodes || []).slice(0, 80).map(n => `- ${n.id} | ${n.name || ''} | ${n.type || ''} | parent:${n.parentId || ''}`).join('\n');
    const edgesSummary = (g.edges || []).slice(0, 120).map(e => `- ${e.from} -> ${e.to}${e.label ? ` : ${e.label}` : ''}`).join('\n');
    const graphSummary = `【已有图谱（用于增量更新，避免重复造ID）】\n节点(${(g.nodes||[]).length}):\n${nodesSummary || '（空）'}\n\n关系(${(g.edges||[]).length}):\n${edgesSummary || '（空）'}\n\n当前节点: ${g.currentNodeId || '（未设置）'}\n`;

    const maxPromptChars = 16000;
    const snap = String(snapshotText || '');
    const snapCut = snap.length > maxPromptChars ? snap.slice(snap.length - maxPromptChars) : snap;
    const worldBlock = '';

    const system = [
      '你是“地图/关系图谱生成器”。你可以利用你对原著/世界观的常识（如果你知道），并结合【聊天正文】来推断地点与角色关系。',
      '你的任务：基于输入信息，生成 SillyTavern 插件可执行的 MapUpdate 指令数组，用于构建“地点地图 + 角色关系网”。',
      '',
      '输出要求（非常重要）：',
      '1) 只输出一个 <MapUpdate>...</MapUpdate> 块，块内是 JSON 数组；不要输出任何额外文字、解释、代码块标记。',
      '2) 每个节点必须有稳定 id（仅小写字母/数字/下划线），并尽量复用【已有图谱】里存在的 id。',
      '3) 节点字段建议：id,name,type,parentId,x,y,description。（x,y 为像素坐标，范围建议 x:0-1400, y:0-900）',
      '4) 关系用 from,to,label。label 简短如：亲属/敌对/同盟/雇佣/追捕/师徒。',
      '5) 数量控制：<= 25 个节点，<= 40 条关系。优先“关键地点 + 关键人物 + 关键势力”。',
      '6) 如果能推断玩家当前位置，请设置一个 set_current 操作：{"op":"set_current","id":"node_id"}。',
      '',
      '允许的 op：add_or_update_node / remove_node / add_or_update_edge / remove_edge / set_current。',
    ].join('\n');

    const user = [
            graphSummary,
      '【聊天 + 设定（截取）】',
      snapCut,
      '',
      '请输出 MapUpdate：'
    ].join('\n');

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];

    let outText = '';
    if (s.provider === 'custom') {
      outText = await callViaCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream);
    } else {
      outText = await callViaSillyTavern(messages, null, s.temperature);
      if (typeof outText !== 'string') outText = JSON.stringify(outText ?? '');
    }

    const updates = extractUpdatesFromText(outText);
    if (!updates.length) {
      // fallback: try parse as raw json array
      const raw = stripCodeFences(String(outText || ''));
      let j = null;
      try { j = JSON.parse(raw); } catch { j = null; }
      if (Array.isArray(j)) updates.push(...j);
    }

    if (!updates.length) {
      throw new Error('未检测到 <MapUpdate> 指令。请检查模型是否严格按要求输出。');
    }

    const changed = applyGraphUpdates(updates);
    updateGraphInfoLabel();
    if (isGraphModalOpen()) renderGraphModal();

    setStatus(`地图/图谱已更新：${changed} 项变更 ✅`, 'ok');
  } finally {
    $('#sg_autogenGraph').prop('disabled', false);
  }
}

// -------------------- provider=st --------------------

async function callViaSillyTavern(messages, schema, temperature) {
  const ctx = SillyTavern.getContext();
  if (typeof ctx.generateRaw === 'function') return await ctx.generateRaw({ prompt: messages, jsonSchema: schema, temperature });
  if (typeof ctx.generateQuietPrompt === 'function') return await ctx.generateQuietPrompt({ messages, jsonSchema: schema, temperature });
  if (globalThis.TavernHelper && typeof globalThis.TavernHelper.generateRaw === 'function') {
    const txt = await globalThis.TavernHelper.generateRaw({ ordered_prompts: messages, should_stream: false });
    return String(txt || '');
  }
  throw new Error('未找到可用的生成函数（generateRaw/generateQuietPrompt）。');
}

async function fallbackAskJson(messages, temperature) {
  const ctx = SillyTavern.getContext();
  const retry = clone(messages);
  retry.unshift({ role: 'system', content: `再次强调：只输出 JSON 对象本体，不要任何额外文字。` });
  if (typeof ctx.generateRaw === 'function') return await ctx.generateRaw({ prompt: retry, temperature });
  if (typeof ctx.generateQuietPrompt === 'function') return await ctx.generateQuietPrompt({ messages: retry, temperature });
  throw new Error('fallback 失败：缺少 generateRaw/generateQuietPrompt');
}

async function fallbackAskJsonCustom(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream) {
  const retry = clone(messages);
  retry.unshift({ role: 'system', content: `再次强调：只输出 JSON 对象本体，不要任何额外文字，不要代码块。` });
  return await callViaCustom(apiBaseUrl, apiKey, model, retry, temperature, maxTokens, topP, stream);
}

function hasAnyModuleKey(obj, modules) {
  if (!obj || typeof obj !== 'object') return false;
  for (const m of modules || []) {
    const k = m?.key;
    if (k && Object.prototype.hasOwnProperty.call(obj, k)) return true;
  }
  return false;
}



// -------------------- custom provider

// -------------------- custom provider (proxy-first) --------------------

function normalizeBaseUrl(input) {
  let u = String(input || '').trim();
  if (!u) return '';
  u = u.replace(/\/+$/, '');
  u = u.replace(/\/v1\/chat\/completions$/i, '');
  u = u.replace(/\/chat\/completions$/i, '');
  u = u.replace(/\/v1\/completions$/i, '');
  u = u.replace(/\/completions$/i, '');
  return u;
}
function deriveChatCompletionsUrl(base) {
  const u = normalizeBaseUrl(base);
  if (!u) return '';
  if (/\/v1$/.test(u)) return u + '/chat/completions';
  if (/\/v1\b/i.test(u)) return u.replace(/\/+$/, '') + '/chat/completions';
  return u + '/v1/chat/completions';
}


async function readStreamedChatCompletionToText(res) {
  const reader = res.body?.getReader?.();
  if (!reader) {
    // no stream body; fallback to normal
    const txt = await res.text().catch(() => '');
    return txt;
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let out = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // process line by line
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);

      const t = line.trim();
      if (!t) continue;

      // SSE: data: ...
      if (t.startsWith('data:')) {
        const payload = t.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') return out;

        try {
          const j = JSON.parse(payload);
          const c0 = j?.choices?.[0];
          const delta = c0?.delta?.content;
          if (typeof delta === 'string') {
            out += delta;
            continue;
          }
          const msg = c0?.message?.content;
          if (typeof msg === 'string') {
            // some servers stream full message chunks as message.content
            out += msg;
            continue;
          }
          const txt = c0?.text;
          if (typeof txt === 'string') {
            out += txt;
            continue;
          }
          const c = j?.content;
          if (typeof c === 'string') {
            out += c;
            continue;
          }
        } catch {
          // ignore
        }
      } else {
        // NDJSON line
        try {
          const j = JSON.parse(t);
          const c0 = j?.choices?.[0];
          const delta = c0?.delta?.content;
          if (typeof delta === 'string') out += delta;
          else if (typeof c0?.message?.content === 'string') out += c0.message.content;
        } catch {
          // ignore
        }
      }
    }
  }

  // flush remaining (rare)
  const rest = buffer.trim();
  if (rest) {
    // try parse if json line
    try {
      const j = JSON.parse(rest);
      const c0 = j?.choices?.[0];
      const delta = c0?.delta?.content;
      if (typeof delta === 'string') out += delta;
      else if (typeof c0?.message?.content === 'string') out += c0.message.content;
    } catch { /* ignore */ }
  }

  return out;
}

async function callViaCustomBackendProxy(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream) {
  const url = '/api/backends/chat-completions/generate';

  const requestBody = {
    messages,
    model: String(model || '').replace(/^models\//, '') || 'gpt-4o-mini',
    max_tokens: maxTokens ?? 8192,
    temperature: temperature ?? 0.7,
    top_p: topP ?? 0.95,
    stream: !!stream,
    chat_completion_source: 'custom',
    reverse_proxy: apiBaseUrl,
    custom_url: apiBaseUrl,
    custom_include_headers: apiKey ? `Authorization: Bearer ${apiKey}` : '',
  };

  const headers = { ...getStRequestHeadersCompat(), 'Content-Type': 'application/json' };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(requestBody) });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`后端代理请求失败: HTTP ${res.status} ${res.statusText}\n${text}`);
    err.status = res.status;
    throw err;
  }


  const ct = String(res.headers.get('content-type') || '');
  if (stream && (ct.includes('text/event-stream') || ct.includes('ndjson') || ct.includes('stream'))) {
    const streamed = await readStreamedChatCompletionToText(res);
    if (streamed) return String(streamed);
    // fall through
  }

  const data = await res.json().catch(() => ({}));
  if (data?.choices?.[0]?.message?.content) return String(data.choices[0].message.content);
  if (typeof data?.content === 'string') return data.content;
  return JSON.stringify(data ?? '');
}

async function callViaCustomBrowserDirect(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream) {
  const endpoint = deriveChatCompletionsUrl(apiBaseUrl);
  if (!endpoint) throw new Error('custom 模式：API基础URL 为空');

  const body = {
    model,
    messages,
    max_tokens: maxTokens ?? 8192,
    temperature: temperature ?? 0.7,
    top_p: topP ?? 0.95,
    stream: !!stream,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`直连请求失败: HTTP ${res.status} ${res.statusText}\n${text}`);
  }

  const ct = String(res.headers.get('content-type') || '');
  if (stream && (ct.includes('text/event-stream') || ct.includes('ndjson') || ct.includes('stream'))) {
    const streamed = await readStreamedChatCompletionToText(res);
    return String(streamed || '');
  }

  const json = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? '');
}

async function callViaCustom(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream) {
  const base = normalizeBaseUrl(apiBaseUrl);
  if (!base) throw new Error('custom 模式需要填写 API基础URL');

  try {
    return await callViaCustomBackendProxy(base, apiKey, model, messages, temperature, maxTokens, topP, stream);
  } catch (e) {
    const status = e?.status;
    if (status === 404 || status === 405) {
      console.warn('[StoryGuide] backend proxy unavailable; fallback to browser direct');
      return await callViaCustomBrowserDirect(base, apiKey, model, messages, temperature, maxTokens, topP, stream);
    }
    throw e;
  }
}

// -------------------- render report from modules --------------------

function renderReportMarkdownFromModules(parsedJson, modules) {
  const lines = [];
  lines.push(`# 剧情指导报告`);
  lines.push('');

  for (const m of modules) {
    const val = parsedJson?.[m.key];
    lines.push(`## ${m.title || m.key}`);

    if (m.type === 'list') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) {
        lines.push('（空）');
      } else {
        // tips 用有序列表更舒服
        if (m.key === 'tips') {
          arr.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
        } else {
          arr.forEach(t => lines.push(`- ${t}`));
        }
      }
    } else {
      lines.push(val ? String(val) : '（空）');
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// -------------------- panel analysis --------------------

async function runAnalysis() {
  const s = ensureSettings();
  if (!s.enabled) { setStatus('插件未启用', 'warn'); return; }

  setStatus('分析中…', 'warn');
  $('#sg_analyze').prop('disabled', true);

  try {
    const { snapshotText, sourceSummary } = buildSnapshot();
    const modules = getModules('panel');
    const schema = buildSchemaFromModules(modules);
    const messages = buildPromptMessages(snapshotText, s.spoilerLevel, modules, 'panel');

    let jsonText = '';
    if (s.provider === 'custom') {
      jsonText = await callViaCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream);
      const parsedTry = safeJsonParse(jsonText);
      if (!parsedTry || !hasAnyModuleKey(parsedTry, modules)) {
        try { jsonText = await fallbackAskJsonCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream); }
        catch { /* ignore */ }
      }
    } else {
      jsonText = await callViaSillyTavern(messages, schema, s.temperature);
      if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
      const parsedTry = safeJsonParse(jsonText);
      if (!parsedTry || Object.keys(parsedTry).length === 0) jsonText = await fallbackAskJson(messages, s.temperature);
    }

    const parsed = safeJsonParse(jsonText);

    try { maybeProcessGraphUpdateFromOutput(String(jsonText||''), parsed); } catch { /* ignore */ }
    lastJsonText = (parsed ? JSON.stringify(parsed, null, 2) : String(jsonText || ''));

    $('#sg_json').text(lastJsonText);
    $('#sg_src').text(JSON.stringify(sourceSummary, null, 2));

    if (!parsed) {
      // 同步原文到聊天末尾（解析失败时也不至于“聊天里看不到”）
      try { syncPanelOutputToChat(String(jsonText || lastJsonText || ''), true); } catch { /* ignore */ }
      showPane('json');
      throw new Error('模型输出无法解析为 JSON（已切到 JSON 标签，看看原文）');
    }

    const md = renderReportMarkdownFromModules(parsed, modules);
    lastReport = { json: parsed, markdown: md, createdAt: Date.now(), sourceSummary };
    renderMarkdownInto($('#sg_md'), md);

    // 同步面板报告到聊天末尾
    try { syncPanelOutputToChat(md, false); } catch { /* ignore */ }

    updateButtonsEnabled();
    showPane('md');
    setStatus('完成 ✅', 'ok');
  } catch (e) {
    console.error('[StoryGuide] analysis failed:', e);
    setStatus(`分析失败：${e?.message ?? e}`, 'err');
  } finally {
    $('#sg_analyze').prop('disabled', false);
  }
}

// -------------------- inline append (dynamic modules) --------------------

function indentForListItem(md) {
  const s = String(md || '');
  const pad = '    '; // 4 spaces to ensure nested blocks stay inside the module card
  if (!s) return pad + '（空）';
  return s.split('\n').map(line => pad + line).join('\n');
}

function normalizeNumberedHints(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const t = String(arr[i] ?? '').trim();
    if (!t) continue;
    // If the item already starts with 【n】, keep it; else prefix with 【i+1】
    if (/^【\d+】/.test(t)) out.push(t);
    else out.push(`【${i + 1}】 ${t}`);
  }
  return out;
}

function buildInlineMarkdownFromModules(parsedJson, modules, mode, showEmpty) {
  // mode: compact|standard
  const lines = [];
  lines.push(`**剧情指导**`);

  for (const m of modules) {
    const hasKey = parsedJson && Object.hasOwn(parsedJson, m.key);
    const val = hasKey ? parsedJson[m.key] : undefined;
    const title = m.title || m.key;

    if (m.type === 'list') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) {
        if (showEmpty) lines.push(`- **${title}**\n${indentForListItem('（空）')}`);
        continue;
      }

      if (mode === 'compact') {
        const limit = Math.min(arr.length, 3);
        const picked = arr.slice(0, limit).map(x => String(x ?? '').trim()).filter(Boolean);
        lines.push(`- **${title}**
${indentForListItem(picked.join(' / '))}`);
      } else {
        // 标准模式：把整个列表合并到同一个模块卡片内（以【1】等为分隔提示）
        const normalized = normalizeNumberedHints(arr);
        const joined = normalized.join('\n\n');
        lines.push(`- **${title}**\n${indentForListItem(joined)}`);
      }
    } else {
      const text = (val !== undefined && val !== null) ? String(val).trim() : '';
      if (!text) {
        if (showEmpty) lines.push(`- **${title}**\n${indentForListItem('（空）')}`);
        continue;
      }

      if (mode === 'compact') {
        const short = (text.length > 140 ? text.slice(0, 140) + '…' : text);
        lines.push(`- **${title}**
${indentForListItem(short)}`);
      } else {
        // 标准模式：把内容缩进到 list item 内，避免内部列表/编号变成“同级卡片”
        lines.push(`- **${title}**\n${indentForListItem(text)}`);
      }
    }
  }

  return lines.join('\n');
}

// -------------------- message locating & box creation --------------------

function getLastAssistantMessageRef() {
  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  for (let i = chat.length - 1; i >= 0; i--) {
    const m = chat[i];
    if (!m) continue;
    if (m.is_user === true) continue;
    if (m.is_system === true) continue;
    const mesid = (m.mesid ?? m.id ?? m.message_id ?? String(i));
    return { chatIndex: i, mesKey: String(mesid) };
  }
  return null;
}

function findMesElementByKey(mesKey) {
  if (!mesKey) return null;
  const selectors = [
    `.mes[mesid="${CSS.escape(String(mesKey))}"]`,
    `.mes[data-mesid="${CSS.escape(String(mesKey))}"]`,
    `.mes[data-mes-id="${CSS.escape(String(mesKey))}"]`,
    `.mes[data-id="${CSS.escape(String(mesKey))}"]`,
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  const all = Array.from(document.querySelectorAll('.mes')).filter(x => x && !x.classList.contains('mes_user'));
  return all.length ? all[all.length - 1] : null;
}

function setCollapsed(boxEl, collapsed) {
  if (!boxEl) return;
  boxEl.classList.toggle('collapsed', !!collapsed);
}

function attachToggleHandler(boxEl, mesKey) {
  if (!boxEl) return;
  const head = boxEl.querySelector('.sg-inline-head');
  if (!head) return;
  if (head.dataset.sgBound === '1') return;
  head.dataset.sgBound = '1';

  head.addEventListener('click', (e) => {
    if (e.target && (e.target.closest('a'))) return;

    const cur = boxEl.classList.contains('collapsed');
    const next = !cur;
    setCollapsed(boxEl, next);

    const cached = inlineCache.get(String(mesKey));
    if (cached) {
      cached.collapsed = next;
      inlineCache.set(String(mesKey), cached);
    }
  });
}

function createInlineBoxElement(mesKey, htmlInner, collapsed) {
  const box = document.createElement('div');
  box.className = 'sg-inline-box';
  box.dataset.sgMesKey = String(mesKey);

  box.innerHTML = `
    <div class="sg-inline-head" title="点击折叠/展开（不会自动生成）">
      <span class="sg-inline-badge">📘</span>
      <span class="sg-inline-title">剧情指导</span>
      <span class="sg-inline-sub">（剧情分析）</span>
      <span class="sg-inline-chevron">▾</span>
    </div>
    <div class="sg-inline-body">${htmlInner}</div>
  `.trim();

  setCollapsed(box, !!collapsed);
  attachToggleHandler(box, mesKey);
  return box;
}


function attachPanelToggleHandler(boxEl, mesKey) {
  if (!boxEl) return;
  const head = boxEl.querySelector('.sg-panel-head');
  if (!head) return;
  if (head.dataset.sgBound === '1') return;
  head.dataset.sgBound = '1';

  head.addEventListener('click', (e) => {
    if (e.target && (e.target.closest('a'))) return;

    const cur = boxEl.classList.contains('collapsed');
    const next = !cur;
    setCollapsed(boxEl, next);

    const cached = panelCache.get(String(mesKey));
    if (cached) {
      cached.collapsed = next;
      panelCache.set(String(mesKey), cached);
    }
  });
}

function createPanelBoxElement(mesKey, htmlInner, collapsed) {
  const box = document.createElement('div');
  box.className = 'sg-panel-box';
  box.dataset.sgMesKey = String(mesKey);

  box.innerHTML = `
    <div class="sg-panel-head" title="点击折叠/展开（面板分析结果）">
      <span class="sg-inline-badge">🧭</span>
      <span class="sg-inline-title">剧情指导</span>
      <span class="sg-inline-sub">（面板报告）</span>
      <span class="sg-inline-chevron">▾</span>
    </div>
    <div class="sg-panel-body">${htmlInner}</div>
  `.trim();

  setCollapsed(box, !!collapsed);
  attachPanelToggleHandler(box, mesKey);
  return box;
}

function ensurePanelBoxPresent(mesKey) {
  const cached = panelCache.get(String(mesKey));
  if (!cached) return false;

  const mesEl = findMesElementByKey(mesKey);
  if (!mesEl) return false;

  const textEl = mesEl.querySelector('.mes_text');
  if (!textEl) return false;

  const existing = textEl.querySelector('.sg-panel-box');
  if (existing) {
    setCollapsed(existing, !!cached.collapsed);
    attachPanelToggleHandler(existing, mesKey);
    const body = existing.querySelector('.sg-panel-body');
    if (body && cached.htmlInner && body.innerHTML !== cached.htmlInner) body.innerHTML = cached.htmlInner;
    return true;
  }

  const box = createPanelBoxElement(mesKey, cached.htmlInner, cached.collapsed);
  textEl.appendChild(box);
  return true;
}


function syncPanelOutputToChat(markdownOrText, asCodeBlock = false) {
  const ref = getLastAssistantMessageRef();
  if (!ref) return false;

  const mesKey = ref.mesKey;

  let md = String(markdownOrText || '').trim();
  if (!md) return false;

  if (asCodeBlock) {
    // show raw output safely
    md = '```text\n' + md + '\n```';
  }

  const htmlInner = renderMarkdownToHtml(md);
  panelCache.set(String(mesKey), { htmlInner, collapsed: false, createdAt: Date.now() });

  requestAnimationFrame(() => { ensurePanelBoxPresent(mesKey); });

  // anti-overwrite reapply (same idea as inline)
  setTimeout(() => ensurePanelBoxPresent(mesKey), 800);
  setTimeout(() => ensurePanelBoxPresent(mesKey), 1800);
  setTimeout(() => ensurePanelBoxPresent(mesKey), 3500);
  setTimeout(() => ensurePanelBoxPresent(mesKey), 6500);

  return true;
}


function ensureInlineBoxPresent(mesKey) {
  const cached = inlineCache.get(String(mesKey));
  if (!cached) return false;

  const mesEl = findMesElementByKey(mesKey);
  if (!mesEl) return false;

  const textEl = mesEl.querySelector('.mes_text');
  if (!textEl) return false;

  const existing = textEl.querySelector('.sg-inline-box');
  if (existing) {
    setCollapsed(existing, !!cached.collapsed);
    attachToggleHandler(existing, mesKey);
    // 更新 body（有时候被覆盖成空壳）
    const body = existing.querySelector('.sg-inline-body');
    if (body && cached.htmlInner && body.innerHTML !== cached.htmlInner) body.innerHTML = cached.htmlInner;
    return true;
  }

  const box = createInlineBoxElement(mesKey, cached.htmlInner, cached.collapsed);
  textEl.appendChild(box);
  return true;
}

// -------------------- reapply (anti-overwrite) --------------------

function scheduleReapplyAll(reason = '') {
  if (reapplyTimer) clearTimeout(reapplyTimer);
  reapplyTimer = setTimeout(() => {
    reapplyTimer = null;
    reapplyAllInlineBoxes(reason);
  }, 260);
}

function reapplyAllInlineBoxes(reason = '') {
  const s = ensureSettings();
  if (!s.enabled) return;
  for (const [mesKey] of inlineCache.entries()) {
    ensureInlineBoxPresent(mesKey);
  }
  for (const [mesKey] of panelCache.entries()) {
    ensurePanelBoxPresent(mesKey);
  }
}

// -------------------- inline append generate & cache --------------------

async function runInlineAppendForLastMessage(opts = {}) {
  const s = ensureSettings();
  const force = !!opts.force;
  const allow = !!opts.allowWhenDisabled;
  if (!s.enabled) return;
  // 手动按钮允许在关闭“自动追加”时也生成
  if (!s.autoAppendBox && !allow) return;

  const ref = getLastAssistantMessageRef();
  if (!ref) return;

  const { mesKey } = ref;

  if (force) {
    inlineCache.delete(String(mesKey));
  }

  // 如果已经缓存过：非强制则只补贴一次；强制则重新请求
  if (inlineCache.has(String(mesKey)) && !force) {
    ensureInlineBoxPresent(mesKey);
    return;
  }

  try {
    const { snapshotText } = buildSnapshot();

    const modules = getModules('append');
    // append 里 schema 按 inline 模块生成；如果用户把 inline 全关了，就不生成
    if (!modules.length) return;

    // 对 “compact/standard” 给一点暗示（不强制），避免用户模块 prompt 很长时没起作用
    const modeHint = (s.appendMode === 'standard')
      ? `\n【附加要求】inline 输出可比面板更短，但不要丢掉关键信息。\n`
      : `\n【附加要求】inline 输出尽量短：每个字段尽量 1~2 句/2 条以内。\n`;

    const schema = buildSchemaFromModules(modules);
    const messages = buildPromptMessages(snapshotText + modeHint, s.spoilerLevel, modules, 'append');

    let jsonText = '';
    if (s.provider === 'custom') {
      jsonText = await callViaCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream);
      const parsedTry = safeJsonParse(jsonText);
      if (!parsedTry || !hasAnyModuleKey(parsedTry, modules)) {
        try { jsonText = await fallbackAskJsonCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream); }
        catch { /* ignore */ }
      }
    } else {
      jsonText = await callViaSillyTavern(messages, schema, s.temperature);
      if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
      const parsedTry = safeJsonParse(jsonText);
      if (!parsedTry || Object.keys(parsedTry).length === 0) jsonText = await fallbackAskJson(messages, s.temperature);
    }

    const parsed = safeJsonParse(jsonText);
    try { maybeProcessGraphUpdateFromOutput(String(jsonText||''), parsed); } catch { /* ignore */ }
    if (!parsed) {
      // 解析失败：也把原文追加到聊天末尾，避免“有输出但看不到”
      const raw = String(jsonText || '').trim();
      const rawMd = raw ? ('```text\n' + raw + '\n```') : '（空）';
      const mdFail = `**剧情指导（解析失败）**\n\n${rawMd}`;
      const htmlInnerFail = renderMarkdownToHtml(mdFail);

      inlineCache.set(String(mesKey), { htmlInner: htmlInnerFail, collapsed: false, createdAt: Date.now() });
      requestAnimationFrame(() => { ensureInlineBoxPresent(mesKey); });
      setTimeout(() => ensureInlineBoxPresent(mesKey), 800);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 1800);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 3500);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 6500);
      return;
    }

    const md = buildInlineMarkdownFromModules(parsed, modules, s.appendMode, !!s.inlineShowEmpty);
    const htmlInner = renderMarkdownToHtml(md);

    inlineCache.set(String(mesKey), { htmlInner, collapsed: false, createdAt: Date.now() });

    requestAnimationFrame(() => { ensureInlineBoxPresent(mesKey); });

    // 额外补贴：对付“变量更新晚到”的二次覆盖
    setTimeout(() => ensureInlineBoxPresent(mesKey), 800);
    setTimeout(() => ensureInlineBoxPresent(mesKey), 1800);
    setTimeout(() => ensureInlineBoxPresent(mesKey), 3500);
    setTimeout(() => ensureInlineBoxPresent(mesKey), 6500);
  } catch (e) {
    console.warn('[StoryGuide] inline append failed:', e);
  }
}

function scheduleInlineAppend() {
  const s = ensureSettings();
  const delay = clampInt(s.appendDebounceMs, 150, 5000, DEFAULT_SETTINGS.appendDebounceMs);
  if (appendTimer) clearTimeout(appendTimer);
  appendTimer = setTimeout(() => {
    appendTimer = null;
    runInlineAppendForLastMessage().catch(() => void 0);
  }, delay);
}

// -------------------- models refresh (custom) --------------------

function fillModelSelect(modelIds, selected) {
  const $sel = $('#sg_modelSelect');
  if (!$sel.length) return;
  $sel.empty();
  $sel.append(`<option value="">（选择模型）</option>`);
  (modelIds || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (selected && id === selected) opt.selected = true;
    $sel.append(opt);
  });
}

async function refreshModels() {
  const s = ensureSettings();
  const raw = String($('#sg_customEndpoint').val() || s.customEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('请先填写 API基础URL 再刷新模型', 'warn'); return; }

  setStatus('正在刷新模型列表…', 'warn');

  const apiKey = String($('#sg_customApiKey').val() || s.customApiKey || '');
  const statusUrl = '/api/backends/chat-completions/status';

  const body = {
    reverse_proxy: apiBase,
    chat_completion_source: 'custom',
    custom_url: apiBase,
    custom_include_headers: apiKey ? `Authorization: Bearer ${apiKey}` : ''
  };

  // prefer backend status
  try {
    const headers = { ...getStRequestHeadersCompat(), 'Content-Type': 'application/json' };
    const res = await fetch(statusUrl, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`状态检查失败: HTTP ${res.status} ${res.statusText}\n${txt}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a,b) => String(a).localeCompare(String(b)));

    if (!ids.length) {
      setStatus('刷新成功，但未解析到模型列表（返回格式不兼容）', 'warn');
      return;
    }

    s.customModelsCache = ids;
    saveSettings();
    fillModelSelect(ids, s.customModel);
    setStatus(`已刷新模型：${ids.length} 个（后端代理）`, 'ok');
    return;
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) console.warn('[StoryGuide] status check failed; fallback to direct /models', e);
  }

  // fallback direct
  try {
    const modelsUrl = (function (base) {
      const u = normalizeBaseUrl(base);
      if (!u) return '';
      if (/\/v1$/.test(u)) return u + '/models';
      if (/\/v1\b/i.test(u)) return u.replace(/\/+$/, '') + '/models';
      return u + '/v1/models';
    })(apiBase);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { method: 'GET', headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`直连 /models 失败: HTTP ${res.status} ${res.statusText}\n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a,b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('直连刷新失败：未解析到模型列表', 'warn'); return; }

    s.customModelsCache = ids;
    saveSettings();
    fillModelSelect(ids, s.customModel);
    setStatus(`已刷新模型：${ids.length} 个（直连 fallback）`, 'ok');
  } catch (e) {
    setStatus(`刷新模型失败：${e?.message ?? e}`, 'err');
  }
}

// -------------------- UI --------------------

function findTopbarContainer() {
  const extBtn =
    document.querySelector('#extensions_button') ||
    document.querySelector('[data-i18n="Extensions"]') ||
    document.querySelector('button[title*="Extensions"]') ||
    document.querySelector('button[aria-label*="Extensions"]');
  if (extBtn && extBtn.parentElement) return extBtn.parentElement;

  const candidates = ['#top-bar', '#topbar', '#topbar_buttons', '#topbar-buttons', '.topbar', '.topbar_buttons', '.top-bar', '.top-bar-buttons', '#rightNav', '#top-right', '#toolbar'];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function createTopbarButton() {
  if (document.getElementById('sg_topbar_btn')) return;
  const container = findTopbarContainer();
  const btn = document.createElement('button');
  btn.id = 'sg_topbar_btn';
  btn.type = 'button';
  btn.className = 'sg-topbar-btn';
  btn.title = '剧情指导 StoryGuide';
  btn.innerHTML = '<span class="sg-topbar-icon">📘</span>';
  btn.addEventListener('click', () => openModal());

  if (container) {
    const sample = container.querySelector('button');
    if (sample && sample.className) btn.className = sample.className + ' sg-topbar-btn';
    container.appendChild(btn);
  } else {
    btn.className += ' sg-topbar-fallback';
    document.body.appendChild(btn);
  }
}


function findChatInputAnchor() {
  // Prefer send button as anchor
  const sendBtn =
    document.querySelector('#send_but') ||
    document.querySelector('#send_button') ||
    document.querySelector('button#send') ||
    document.querySelector('button[title*="Send"]') ||
    document.querySelector('button[aria-label*="Send"]') ||
    document.querySelector('button.menu_button#send_but') ||
    document.querySelector('.send_button') ||
    document.querySelector('button[type="submit"]');

  if (sendBtn) return sendBtn;

  // Fallback: textarea container
  const ta =
    document.querySelector('#send_textarea') ||
    document.querySelector('textarea[name="message"]') ||
    document.querySelector('textarea');

  return ta;
}

const SG_CHAT_POS_KEY = 'storyguide_chat_controls_pos_v1';
let sgChatPinnedLoaded = false;
let sgChatPinnedPos = null; // {left, top, pinned}
let sgChatPinned = false;

function loadPinnedChatPos() {
  if (sgChatPinnedLoaded) return;
  sgChatPinnedLoaded = true;
  try {
    const raw = localStorage.getItem(SG_CHAT_POS_KEY);
    if (!raw) return;
    const j = JSON.parse(raw);
    if (j && typeof j.left === 'number' && typeof j.top === 'number') {
      sgChatPinnedPos = { left: j.left, top: j.top, pinned: j.pinned !== false };
      sgChatPinned = sgChatPinnedPos.pinned;
    }
  } catch { /* ignore */ }
}

function savePinnedChatPos(left, top) {
  try {
    sgChatPinnedPos = { left: Number(left) || 0, top: Number(top) || 0, pinned: true };
    sgChatPinned = true;
    localStorage.setItem(SG_CHAT_POS_KEY, JSON.stringify(sgChatPinnedPos));
  } catch { /* ignore */ }
}

function clearPinnedChatPos() {
  try {
    sgChatPinnedPos = null;
    sgChatPinned = false;
    localStorage.removeItem(SG_CHAT_POS_KEY);
  } catch { /* ignore */ }
}

function clampToViewport(left, top, w, h) {
  const pad = 8;
  const L = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
  const T = Math.max(pad, Math.min(top, window.innerHeight - h - pad));
  return { left: L, top: T };
}

function measureWrap(wrap) {
  const prevVis = wrap.style.visibility;
  wrap.style.visibility = 'hidden';
  wrap.style.left = '0px';
  wrap.style.top = '0px';
  const w = wrap.offsetWidth || 220;
  const h = wrap.offsetHeight || 38;
  wrap.style.visibility = prevVis || 'visible';
  return { w, h };
}

function positionChatActionButtons() {
  const wrap = document.getElementById('sg_chat_controls');
  if (!wrap) return;

  loadPinnedChatPos();

  const { w, h } = measureWrap(wrap);

  // If user dragged & pinned position, keep it.
  if (sgChatPinned && sgChatPinnedPos) {
    const clamped = clampToViewport(sgChatPinnedPos.left, sgChatPinnedPos.top, w, h);
    wrap.style.left = `${Math.round(clamped.left)}px`;
    wrap.style.top = `${Math.round(clamped.top)}px`;
    return;
  }

  const sendBtn =
    document.querySelector('#send_but') ||
    document.querySelector('#send_button') ||
    document.querySelector('button#send') ||
    document.querySelector('button[title*="Send"]') ||
    document.querySelector('button[aria-label*="Send"]') ||
    document.querySelector('.send_button') ||
    document.querySelector('button[type="submit"]');

  if (!sendBtn) return;

  const rect = sendBtn.getBoundingClientRect();

  // place to the left of send button, vertically centered
  let left = rect.left - w - 10;
  let top = rect.top + (rect.height - h) / 2;

  const clamped = clampToViewport(left, top, w, h);
  wrap.style.left = `${Math.round(clamped.left)}px`;
  wrap.style.top = `${Math.round(clamped.top)}px`;
}

let sgChatPosTimer = null;
function schedulePositionChatButtons() {
  if (sgChatPosTimer) return;
  sgChatPosTimer = setTimeout(() => {
    sgChatPosTimer = null;
    try { positionChatActionButtons(); } catch {}
  }, 60);
}
function ensureChatActionButtons() {
  if (document.getElementById('sg_chat_controls')) {
    schedulePositionChatButtons();
    return;
  }

  const sendAnchor = findChatInputAnchor();
  if (!sendAnchor) return;

  const wrap = document.createElement('div');
  wrap.id = 'sg_chat_controls';

  // draggable handle (drag to pin position; double click to reset)
  const handle = document.createElement('div');
  handle.className = 'sg-chat-drag-handle';
  handle.title = '拖动按钮位置（双击复位为自动贴边）';
  handle.textContent = '⋮⋮';
  wrap.className = 'sg-chat-controls';

  const gen = document.createElement('button');
  gen.type = 'button';
  gen.id = 'sg_chat_generate';
  gen.className = 'menu_button sg-chat-btn';
  gen.title = '手动生成剧情指导分析框（不会自动生成）';
  gen.innerHTML = '📘 <span class="sg-chat-label">生成</span>';

  const reroll = document.createElement('button');
  reroll.type = 'button';
  reroll.id = 'sg_chat_reroll';
  reroll.className = 'menu_button sg-chat-btn';
  reroll.title = '重Roll：重新生成剧情指导分析框';
  reroll.innerHTML = '🎲 <span class="sg-chat-label">重Roll</span>';

  const setBusy = (busy) => {
    gen.disabled = busy;
    reroll.disabled = busy;
    wrap.classList.toggle('is-busy', !!busy);
  };

  gen.addEventListener('click', async () => {
    try {
      setBusy(true);
      await runInlineAppendForLastMessage({ allowWhenDisabled: true, force: false });
    } catch (e) {
      console.warn('[StoryGuide] generate failed', e);
    } finally {
      setBusy(false);
      schedulePositionChatButtons();
    }
  });

  reroll.addEventListener('click', async () => {
    try {
      setBusy(true);
      await runInlineAppendForLastMessage({ allowWhenDisabled: true, force: true });
    } catch (e) {
      console.warn('[StoryGuide] reroll failed', e);
    } finally {
      setBusy(false);
      schedulePositionChatButtons();
    }
  });

  wrap.appendChild(handle);

  wrap.appendChild(gen);
  wrap.appendChild(reroll);

  // Use fixed positioning to avoid overlapping with send button / different themes.
  
  // drag to move (pin position)
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let moved = false;

  const onMove = (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!moved && (Math.abs(dx) + Math.abs(dy) > 4)) moved = true;

    const { w, h } = measureWrap(wrap);
    const clamped = clampToViewport(startLeft + dx, startTop + dy, w, h);
    wrap.style.left = `${Math.round(clamped.left)}px`;
    wrap.style.top = `${Math.round(clamped.top)}px`;
  };

  const onUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('is-dragging');
    try { handle.releasePointerCapture(ev.pointerId); } catch {}
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);

    if (moved) {
      const left = parseInt(wrap.style.left || '0', 10);
      const top = parseInt(wrap.style.top || '0', 10);
      savePinnedChatPos(left, top);
    }
  };

  handle.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    loadPinnedChatPos();
    dragging = true;
    moved = false;
    wrap.classList.add('is-dragging');

    const rect = wrap.getBoundingClientRect();
    startX = ev.clientX;
    startY = ev.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    try { handle.setPointerCapture(ev.pointerId); } catch {}
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  });

  handle.addEventListener('dblclick', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    clearPinnedChatPos();
    schedulePositionChatButtons();
  });

  document.body.appendChild(wrap);
  loadPinnedChatPos();

  // Keep it positioned correctly
  window.addEventListener('resize', schedulePositionChatButtons, { passive: true });
  window.addEventListener('scroll', schedulePositionChatButtons, { passive: true });

  schedulePositionChatButtons();
}

// -------------------- card toggle (shrink/expand per module card) --------------------
function clearLegacyZoomArtifacts() {
  try {
    document.body.classList.remove('sg-zoom-lock');
    document.querySelectorAll('.sg-zoomed').forEach(el => el.classList.remove('sg-zoomed'));
    const ov = document.getElementById('sg_zoom_overlay');
    if (ov) ov.remove();
  } catch { /* ignore */ }
}

function installCardZoomDelegation() {
  // keep old function name for compatibility, but behavior is now "click to shrink/expand"
  if (window.__storyguide_card_toggle_installed) return;
  window.__storyguide_card_toggle_installed = true;

  clearLegacyZoomArtifacts();

  document.addEventListener('click', (e) => {
    const target = e.target;

    // don't hijack interactive elements
    if (target.closest('a, button, input, textarea, select, label')) return;

    const card = target.closest('.sg-inline-body > ul > li');
    if (!card) return;

    // if user is selecting text, don't toggle
    try {
      const sel = window.getSelection();
      if (sel && String(sel).trim().length > 0) return;
    } catch { /* ignore */ }

    e.preventDefault();
    e.stopPropagation();

    card.classList.toggle('sg-collapsed');
  }, true);
}



function buildModalHtml() {
  return `
  <div id="sg_modal_backdrop" class="sg-backdrop" style="display:none;">
    <div id="sg_modal" class="sg-modal" role="dialog" aria-modal="true">
      <div class="sg-modal-head">
        <div class="sg-modal-title">
          <span class="sg-badge">📘</span>
          剧情指导 <span class="sg-sub">StoryGuide</span>
        </div>
        <div class="sg-modal-actions">
          <button class="menu_button sg-btn" id="sg_close">关闭</button>
        </div>
      </div>

      <div class="sg-modal-body">
        <div class="sg-left">
          <div class="sg-card">
            <div class="sg-card-title">生成设置</div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>启用</label>
                <label class="sg-switch">
                  <input type="checkbox" id="sg_enabled">
                  <span class="sg-slider"></span>
                </label>
              </div>

              <div class="sg-field">
                <label>剧透等级</label>
                <select id="sg_spoiler">
                  <option value="none">不剧透</option>
                  <option value="mild">轻剧透</option>
                  <option value="full">全剧透</option>
                </select>
              </div>

              <div class="sg-field">
                <label>Provider</label>
                <select id="sg_provider">
                  <option value="st">使用当前 SillyTavern API（推荐）</option>
                  <option value="custom">独立API（走酒馆后端代理，减少跨域）</option>
                </select>
              </div>

              <div class="sg-field">
                <label>temperature</label>
                <input id="sg_temperature" type="number" step="0.05" min="0" max="2">
              </div>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>最近消息条数</label>
                <input id="sg_maxMessages" type="number" min="5" max="200">
              </div>
              <div class="sg-field">
                <label>每条最大字符</label>
                <input id="sg_maxChars" type="number" min="200" max="8000">
              </div>
            </div>

            <div class="sg-row">
              <label class="sg-check"><input type="checkbox" id="sg_includeUser">包含用户消息</label>
              <label class="sg-check"><input type="checkbox" id="sg_includeAssistant">包含AI消息</label>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_autoRefresh">自动刷新面板报告</label>
              <select id="sg_autoRefreshOn">
                <option value="received">AI回复时</option>
                <option value="sent">用户发送时</option>
                <option value="both">两者都触发</option>
              </select>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_autoAppendBox">启用分析框（手动生成/重Roll）</label>
              <select id="sg_appendMode">
                <option value="compact">简洁</option>
                <option value="standard">标准</option>
              </select>
              <select id="sg_inlineModulesSource" title="选择追加框展示的模块来源">
                <option value="inline">仅 inline=true 的模块</option>
                <option value="panel">跟随面板（panel=true）</option>
                <option value="all">显示全部模块</option>
              </select>
              <label class="sg-check" title="即使模型没输出该字段，也显示（空）占位">
                <input type="checkbox" id="sg_inlineShowEmpty">显示空字段
              </label>
              <span class="sg-hint">（点击框标题可折叠）</span>
            </div>

            <div id="sg_custom_block" class="sg-card sg-subcard" style="display:none;">
              <div class="sg-card-title">独立API 设置（建议填 API基础URL）</div>

              <div class="sg-field">
                <label>API基础URL（例如 https://api.openai.com/v1 ）</label>
                <input id="sg_customEndpoint" type="text" placeholder="https://xxx.com/v1">
                <div class="sg-hint sg-warn">优先走酒馆后端代理接口（/api/backends/...），比浏览器直连更不容易跨域/连不上。</div>
              </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>API Key（可选）</label>
                  <input id="sg_customApiKey" type="password" placeholder="可留空">
                </div>

                <div class="sg-field">
                  <label>模型（可手填）</label>
                  <input id="sg_customModel" type="text" placeholder="gpt-4o-mini">
                </div>
              </div>

              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_refreshModels">检查/刷新模型</button>
                <select id="sg_modelSelect" class="sg-model-select">
                  <option value="">（选择模型）</option>
                </select>
              </div>

              <div class="sg-row">
                <div class="sg-field sg-field-full">
                  <label>最大回复token数</label>
                  <input id="sg_customMaxTokens" type="number" min="256" max="200000" step="1" placeholder="例如：60000">
                
                  <label class="sg-check" style="margin-top:8px;">
                    <input type="checkbox" id="sg_customStream"> 使用流式返回（stream=true）
                  </label>
</div>
              </div>
            </div>

            <div class="sg-actions-row">
              <button class="menu_button sg-btn-primary" id="sg_saveSettings">保存设置</button>
              <button class="menu_button sg-btn-primary" id="sg_analyze">分析当前剧情</button>
            </div>
          </div>

          <div class="sg-card">
            <div class="sg-card-title">输出模块（JSON，可自定义字段/提示词）</div>
            <div class="sg-hint">你可以增删模块、改 key/title/type/prompt、控制 panel/inline。保存前可点“校验”。</div>

            <div class="sg-field">
              <textarea id="sg_modulesJson" rows="12" spellcheck="false"></textarea>
              <div class="sg-actions-row">
                <button class="menu_button sg-btn" id="sg_validateModules">校验</button>
                <button class="menu_button sg-btn" id="sg_resetModules">恢复默认</button>
                <button class="menu_button sg-btn" id="sg_applyModules">应用到设置</button>
              </div>
            </div>

            <div class="sg-field">
              <label>自定义 System 补充（可选）</label>
              <textarea id="sg_customSystemPreamble" rows="3" placeholder="例如：更偏悬疑、强调线索、避免冗长…"></textarea>
            </div>
            <div class="sg-field">
              <label>自定义 Constraints 补充（可选）</label>
              <textarea id="sg_customConstraints" rows="3" placeholder="例如：必须提到关键人物动机、每条不超过20字…"></textarea>
            </div>
          </div>

          
          <div class="sg-card">
            <div class="sg-card-title">预设与世界书</div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_exportPreset">导出预设</button>
              <label class="sg-check"><input type="checkbox" id="sg_presetIncludeApiKey">导出包含 API Key</label>
              <button class="menu_button sg-btn" id="sg_importPreset">导入预设</button>
            </div>

            <div class="sg-hint">预设会包含：生成设置 / 独立API / 输出模块 / 世界书设置 / 自定义提示骨架。导入会覆盖当前配置。</div>

            <hr class="sg-hr">

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_worldbookEnabled">在分析输入中注入世界书</label>
              <select id="sg_worldbookMode">
                <option value="active">仅注入“可能激活”的条目（推荐）</option>
                <option value="all">注入全部条目</option>
              </select>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>世界书最大注入字符</label>
                <input id="sg_worldbookMaxChars" type="number" min="500" max="50000">
              </div>
              <div class="sg-field">
                <label>激活检测窗口（最近消息条数）</label>
                <input id="sg_worldbookWindowMessages" type="number" min="5" max="80">
              </div>
            </div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_importWorldbook">导入世界书JSON</button>
              <button class="menu_button sg-btn" id="sg_clearWorldbook">清空世界书</button>
              <button class="menu_button sg-btn" id="sg_saveWorldbookSettings">保存世界书设置</button>
            </div>

            <div class="sg-hint" id="sg_worldbookInfo">（未导入世界书）</div>
          </div>




          


          <div class="sg-card">
            <div class="sg-card-title">图谱 / 地图（角色关系 & 地点结构）</div>

            <div class="sg-row sg-grid2">
              <label class="sg-check"><input type="checkbox" id="sg_graphInject">在分析输入中注入图谱摘要</label>
              <label class="sg-check"><input type="checkbox" id="sg_graphAllowMapUpdate">允许从输出中读取 &lt;MapUpdate&gt; 更新图谱</label>
            </div>

            <div class="sg-row sg-grid2">
              <div class="sg-field">
                <label>图谱最大注入字符</label>
                <input id="sg_graphMaxChars" type="number" min="500" max="50000">
              </div>
              <div class="sg-field">
                <label>背景图URL（可选）</label>
                <input id="sg_graphBg" type="text" placeholder="https://...">
              </div>
            </div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_openGraph">打开图谱面板</button>
              <button class="menu_button sg-btn" id="sg_autogenGraph">AI生成地图</button>
              <button class="menu_button sg-btn" id="sg_extractGraphFromWorldbook">从世界书提取</button>
              <button class="menu_button sg-btn" id="sg_importGraph">导入图谱JSON</button>
              <button class="menu_button sg-btn" id="sg_exportGraph">导出图谱JSON</button>
              <button class="menu_button sg-btn" id="sg_clearGraph">清空图谱</button>
            </div>

            <div class="sg-hint" id="sg_graphInfo">（图谱：0 节点 / 0 关系）</div>
            <div class="sg-hint sg-muted">提示：你可以把角色当“节点”，把“亲属/敌对/同盟”等当“关系”。也可以把地点做成树状层级（world → region → city → room）。</div>
          </div>


          

            <div class="sg-row">
              <div class="sg-field">
                <label>请求头（JSON，可选）</label>
                <textarea id="sg_worldSourceHeadersJson" rows="3" placeholder='{"Authorization":"Bearer xxx","X-Token":"..."}'></textarea>
              </div>
            </div>

            <div class="sg-row sg-grid2">
              <div class="sg-field">
                <label>最大读取字符</label>
                <input id="sg_worldSourceMaxChars" type="number" min="500" max="200000">
              </div>
              <div class="sg-field">
                <label>缓存状态</label>
                <div class="sg-hint" id="sg_worldSourceInfo">（未刷新）</div>
              </div>
            </div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_worldSourceFetch">刷新世界信息</button>
              <button class="menu_button sg-btn" id="sg_worldSourceClear">清空缓存</button>
            </div>

            <div class="sg-hint sg-muted">说明：此功能会由插件在浏览器内向你填写的 URL 发起请求，然后把返回内容交给模型用于“自动生成地图”。若无法访问，多半是 CORS/HTTPS 混用问题；建议让你的世界信息服务开启 CORS 或通过同域转发。</div>
          </div>

<div class="sg-status" id="sg_status"></div>
        </div>

        <div class="sg-right">
          <div class="sg-card">
            <div class="sg-card-title">输出</div>

            <div class="sg-tabs">
              <button class="sg-tab active" id="sg_tab_md">报告</button>
              <button class="sg-tab" id="sg_tab_json">JSON</button>
              <button class="sg-tab" id="sg_tab_src">来源</button>
              <div class="sg-spacer"></div>
              <button class="menu_button sg-btn" id="sg_copyMd" disabled>复制MD</button>
              <button class="menu_button sg-btn" id="sg_copyJson" disabled>复制JSON</button>
              <button class="menu_button sg-btn" id="sg_injectTips" disabled>注入提示</button>
            </div>

            <div class="sg-pane active" id="sg_pane_md"><div class="sg-md" id="sg_md">(尚未生成)</div></div>
            <div class="sg-pane" id="sg_pane_json"><pre class="sg-pre" id="sg_json"></pre></div>
            <div class="sg-pane" id="sg_pane_src"><pre class="sg-pre" id="sg_src"></pre></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

function ensureModal() {
  if (document.getElementById('sg_modal_backdrop')) return;
  document.body.insertAdjacentHTML('beforeend', buildModalHtml());

  $('#sg_modal_backdrop').on('click', (e) => { if (e.target && e.target.id === 'sg_modal_backdrop') closeModal(); });
  $('#sg_close').on('click', closeModal);

  $('#sg_tab_md').on('click', () => showPane('md'));
  $('#sg_tab_json').on('click', () => showPane('json'));
  $('#sg_tab_src').on('click', () => showPane('src'));

  $('#sg_saveSettings').on('click', () => {
    pullUiToSettings();
    saveSettings();
    setStatus('已保存设置', 'ok');
  });

  $('#sg_analyze').on('click', async () => {
    pullUiToSettings();
    saveSettings();
    await runAnalysis();
  });

  $('#sg_saveWorld').on('click', async () => {
    try { await setChatMetaValue(META_KEYS.world, String($('#sg_worldText').val() || '')); setStatus('已保存：世界观/设定补充（本聊天）', 'ok'); }
    catch (e) { setStatus(`保存失败：${e?.message ?? e}`, 'err'); }
  });

  $('#sg_saveCanon').on('click', async () => {
    try { await setChatMetaValue(META_KEYS.canon, String($('#sg_canonText').val() || '')); setStatus('已保存：原著后续/大纲（本聊天）', 'ok'); }
    catch (e) { setStatus(`保存失败：${e?.message ?? e}`, 'err'); }
  });

  $('#sg_copyMd').on('click', async () => {
    try { await navigator.clipboard.writeText(lastReport?.markdown ?? ''); setStatus('已复制：Markdown 报告', 'ok'); }
    catch (e) { setStatus(`复制失败：${e?.message ?? e}`, 'err'); }
  });

  $('#sg_copyJson').on('click', async () => {
    try { await navigator.clipboard.writeText(lastJsonText || ''); setStatus('已复制：JSON', 'ok'); }
    catch (e) { setStatus(`复制失败：${e?.message ?? e}`, 'err'); }
  });

  $('#sg_injectTips').on('click', () => {
    const tips = Array.isArray(lastReport?.json?.tips) ? lastReport.json.tips : [];
    const spoiler = ensureSettings().spoilerLevel;
    const text = tips.length
      ? `/sys 【剧情指导提示｜${spoiler}】\n` + tips.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : (lastReport?.markdown ?? '');

    const $ta = $('#send_textarea');
    if ($ta.length) { $ta.val(text).trigger('input'); setStatus('已把提示放入输入框（你可以手动发送）', 'ok'); }
    else setStatus('找不到输入框 #send_textarea，无法注入', 'err');
  });

  $('#sg_provider').on('change', () => {
    const provider = String($('#sg_provider').val());
    $('#sg_custom_block').toggle(provider === 'custom');
  });

  $('#sg_refreshModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshModels();
  });

  $('#sg_modelSelect').on('change', () => {
    const id = String($('#sg_modelSelect').val() || '').trim();
    if (id) $('#sg_customModel').val(id);
  $('#sg_customMaxTokens').val(s.customMaxTokens || 8192);
  $('#sg_customStream').prop('checked', !!s.customStream);
  });

  
  // presets actions
  $('#sg_exportPreset').on('click', () => {
    try {
      pullUiToSettings();
      const s = ensureSettings();
      const out = clone(s);

      const includeKey = $('#sg_presetIncludeApiKey').is(':checked');
      if (!includeKey) out.customApiKey = '';

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`storyguide-preset-${stamp}.json`, JSON.stringify(out, null, 2));
      setStatus('已导出预设 ✅', 'ok');
    } catch (e) {
      setStatus(`导出失败：${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_importPreset').on('click', async () => {
    try {
      const file = await pickFile('.json,application/json');
      if (!file) return;
      const txt = await readFileText(file);
      const data = JSON.parse(txt);

      if (!data || typeof data !== 'object') {
        setStatus('导入失败：预设文件格式不对', 'err');
        return;
      }

      const s = ensureSettings();
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (Object.hasOwn(data, k)) s[k] = data[k];
      }

      if (!s.modulesJson) s.modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);

      saveSettings();
      pullSettingsToUi();
      setStatus('已导入预设并应用 ✅（建议刷新一次页面）', 'ok');

      scheduleReapplyAll('import_preset');
    } catch (e) {
      setStatus(`导入失败：${e?.message ?? e}`, 'err');
    }
  });

  // worldbook actions
  $('#sg_importWorldbook').on('click', async () => {
    try {
      const file = await pickFile('.json,application/json');
      if (!file) return;
      const txt = await readFileText(file);
      const entries = parseWorldbookJson(txt);

      const s = ensureSettings();
      s.worldbookJson = txt;
      saveSettings();

      updateWorldbookInfoLabel();

      setStatus('世界书已导入 ✅', entries.length ? 'ok' : 'warn');
    } catch (e) {
      setStatus(`导入世界书失败：${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_clearWorldbook').on('click', () => {
    const s = ensureSettings();
    s.worldbookJson = '';
    saveSettings();
    updateWorldbookInfoLabel();
    setStatus('已清空世界书', 'ok');
  });

  $('#sg_saveWorldbookSettings').on('click', () => {
    try {
      pullUiToSettings();
      saveSettings();
      updateWorldbookInfoLabel();
      setStatus('世界书设置已保存 ✅', 'ok');
    } catch (e) {
      setStatus(`保存世界书设置失败：${e?.message ?? e}`, 'err');
    }
  });

  // 自动保存：世界书相关设置变更时立刻写入
  $('#sg_worldbookEnabled, #sg_worldbookMode').on('change', () => {
    pullUiToSettings();
    saveSettings();
    updateWorldbookInfoLabel();
  });
  $('#sg_worldbookMaxChars, #sg_worldbookWindowMessages').on('input', () => {
    pullUiToSettings();
    saveSettings();
    updateWorldbookInfoLabel();
  });


  // graph/map actions
  $('#sg_openGraph').on('click', () => {
    try { openGraphModal(); } catch (e) { setStatus(`打开图谱失败：${e?.message ?? e}`, 'err'); }
  });

  $('#sg_extractGraphFromWorldbook').on('click', async () => {
    try {
      const s = ensureSettings();
      if (!s.worldbookJson) {
        setStatus('请先在上方导入世界书 JSON（或绑定世界书）', 'warn');
        return;
      }
      const entries = parseWorldbookJson(s.worldbookJson);
      if (!entries.length) {
        setStatus('世界书为空，无法提取', 'warn');
        return;
      }

      const g = defaultGraphData();
      const W = Number(g.canvas?.width) || 1400;
      const H = Number(g.canvas?.height) || 900;

      // 1) 读取 [MapNode:ID]
      for (const e of entries) {
        const name = String(e.name || '');
        const m = name.match(/\[MapNode:(.*?)\]/);
        if (!m) continue;
        const id = String(m[1] || '').trim();
        if (!id) continue;

        let data = {};
        try { data = JSON.parse(String(e.content || '{}')); } catch { data = {}; }

        const displayName = String(data.name || data.title || data.label || id);
        const type = String(data.type || 'location');
        const parentId = String(data.parentId || data.parent || '');

        // TheWorld coords 通常是 0-1000（代表百分比*10），这里换算到画布像素
        let x = 200, y = 200;
        if (typeof data.coords === 'string') {
          const mm = data.coords.split(',').map(v => Number(v.trim()));
          if (mm.length >= 2 && Number.isFinite(mm[0]) && Number.isFinite(mm[1])) {
            x = (mm[0] / 1000) * W;
            y = (mm[1] / 1000) * H;
          }
        }
        if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
          x = Number(data.x); y = Number(data.y);
        }

        g.nodes.push({
          id,
          name: displayName,
          type,
          parentId,
          x,
          y,
          description: String(data.description || data.desc || '')
        });
      }

      // 2) 尝试解析 [TheWorld:Locator] 里的当前位置
      const locator = entries.find(e => String(e.name||'') === '[TheWorld:Locator]');
      if (locator && locator.content) {
        const content = String(locator.content);
        const pm = content.match(/Path:.*?\(([^)]+)\)\s*$/m);
        if (pm && pm[1]) g.currentNodeId = String(pm[1]).trim();
        const cm = content.match(/current_location_id\s*[:=]\s*([A-Za-z0-9_\-]+)/i);
        if (!g.currentNodeId && cm && cm[1]) g.currentNodeId = String(cm[1]).trim();
      }

      await setChatMetaValue(META_KEYS.graph, JSON.stringify(g));
      updateGraphInfoLabel();
      if (isGraphModalOpen()) renderGraphModal();
      setStatus(`已从世界书提取图谱：${g.nodes.length} 节点`, 'ok');
    } catch (e) {
      setStatus(`提取失败：${e?.message ?? e}`, 'err');
    }
  });


  $('#sg_importGraph').on('click', async () => {
    try {
      const file = await pickFile('.json,application/json');
      if (!file) return;
      const txt = await readFileText(file);
      const g = parseGraphJson(txt);
      await setChatMetaValue(META_KEYS.graph, JSON.stringify(g));
      updateGraphInfoLabel();
      if (isGraphModalOpen()) renderGraphModal();
      setStatus('图谱已导入 ✅', 'ok');
    } catch (e) {
      setStatus(`导入图谱失败：${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_exportGraph').on('click', () => {
    try { exportGraphJson(); } catch (e) { setStatus(`导出图谱失败：${e?.message ?? e}`, 'err'); }
  });

  $('#sg_clearGraph').on('click', async () => {
    if (!confirm('清空本聊天的图谱/地图？')) return;
    try {
      await setChatMetaValue(META_KEYS.graph, JSON.stringify(defaultGraphData()));
      updateGraphInfoLabel();
      if (isGraphModalOpen()) renderGraphModal();
      setStatus('已清空图谱', 'ok');
    } catch (e) {
      setStatus(`清空失败：${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_graphBg').on('change', () => {
    try {
      const g = getGraphData();
      g.backgroundImage = String($('#sg_graphBg').val() || '').trim();
      setGraphData(g);
    } catch { /* ignore */ }
  });


  $('#sg_graphInject, #sg_graphAllowMapUpdate').on('change', () => {
    pullUiToSettings();
    saveSettings();
  });
  $('#sg_graphMaxChars').on('input', () => {
    pullUiToSettings();
    saveSettings();
  });



  // world source actions
  $('#sg_worldSourceFetch').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      setStatus('正在刷新世界信息…', 'warn');
      await fetchWorldSourceNow();
      setStatus('已刷新世界信息 ✅', 'ok');
    } catch (e) {
      setStatus(`刷新失败：${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_worldSourceClear').on('click', () => {
    clearWorldSourceCache();
    setStatus('已清空世界信息缓存', 'ok');
  });

  $('#sg_worldSourceEnabled, #sg_worldSourceInjectToAnalysis, #sg_worldSourceMethod').on('change', () => {
    pullUiToSettings();
    saveSettings();
    updateWorldSourceInfoLabel();
  });

  $('#sg_worldSourceUrl, #sg_worldSourceHeadersJson').on('change blur', () => {
    pullUiToSettings();
    saveSettings();
    updateWorldSourceInfoLabel();
  });

  $('#sg_worldSourceMaxChars').on('input', () => {
    pullUiToSettings();
    saveSettings();
    updateWorldSourceInfoLabel();
  });

  // graph: AI auto generate map
  $('#sg_autogenGraph').on('click', async () => {
    try {
      await runGraphAutoGenerate();
    } catch (e) {
      setStatus(`生成失败：${e?.message ?? e}`, 'err');
    }
  });



// modules json actions
  $('#sg_validateModules').on('click', () => {
    const txt = String($('#sg_modulesJson').val() || '').trim();
    let parsed = null;
    try { parsed = JSON.parse(txt); } catch (e) {
      setStatus(`模块 JSON 解析失败：${e?.message ?? e}`, 'err');
      return;
    }
    const v = validateAndNormalizeModules(parsed);
    if (!v.ok) {
      setStatus(`模块校验失败：${v.error}`, 'err');
      return;
    }
    setStatus(`模块校验通过 ✅（${v.modules.length} 个模块）`, 'ok');
  });

  $('#sg_resetModules').on('click', () => {
    $('#sg_modulesJson').val(JSON.stringify(DEFAULT_MODULES, null, 2));
    setStatus('已恢复默认模块（尚未保存，点“应用到设置”）', 'warn');
  });

  $('#sg_applyModules').on('click', () => {
    const txt = String($('#sg_modulesJson').val() || '').trim();
    let parsed = null;
    try { parsed = JSON.parse(txt); } catch (e) {
      setStatus(`模块 JSON 解析失败：${e?.message ?? e}`, 'err');
      return;
    }
    const v = validateAndNormalizeModules(parsed);
    if (!v.ok) { setStatus(`模块校验失败：${v.error}`, 'err'); return; }

    const s = ensureSettings();
    s.modulesJson = JSON.stringify(v.modules, null, 2);
    saveSettings();
    $('#sg_modulesJson').val(s.modulesJson);
    setStatus('模块已应用并保存 ✅（注意：追加框展示的模块由“追加框展示模块”控制）', 'ok');
  });
}

function pullSettingsToUi() {
  const s = ensureSettings();

  $('#sg_enabled').prop('checked', !!s.enabled);
  $('#sg_spoiler').val(s.spoilerLevel);
  $('#sg_provider').val(s.provider);
  $('#sg_temperature').val(s.temperature);

  $('#sg_maxMessages').val(s.maxMessages);
  $('#sg_maxChars').val(s.maxCharsPerMessage);

  $('#sg_includeUser').prop('checked', !!s.includeUser);
  $('#sg_includeAssistant').prop('checked', !!s.includeAssistant);

  $('#sg_autoRefresh').prop('checked', !!s.autoRefresh);
  $('#sg_autoRefreshOn').val(s.autoRefreshOn);

  $('#sg_autoAppendBox').prop('checked', !!s.autoAppendBox);
  $('#sg_appendMode').val(s.appendMode);

  $('#sg_inlineModulesSource').val(String(s.inlineModulesSource || 'inline'));
  $('#sg_inlineShowEmpty').prop('checked', !!s.inlineShowEmpty);

  $('#sg_customEndpoint').val(s.customEndpoint);
  $('#sg_customApiKey').val(s.customApiKey);
  $('#sg_customModel').val(s.customModel);

  fillModelSelect(Array.isArray(s.customModelsCache) ? s.customModelsCache : [], s.customModel);

  $('#sg_worldText').val(getChatMetaValue(META_KEYS.world));
  $('#sg_canonText').val(getChatMetaValue(META_KEYS.canon));

  $('#sg_modulesJson').val(String(s.modulesJson || JSON.stringify(DEFAULT_MODULES, null, 2)));
  $('#sg_customSystemPreamble').val(String(s.customSystemPreamble || ''));
  $('#sg_customConstraints').val(String(s.customConstraints || ''));

  $('#sg_presetIncludeApiKey').prop('checked', !!s.presetIncludeApiKey);

  $('#sg_worldbookEnabled').prop('checked', !!s.worldbookEnabled);
  $('#sg_worldbookMode').val(String(s.worldbookMode || 'active'));
  $('#sg_worldbookMaxChars').val(s.worldbookMaxChars);
  $('#sg_worldbookWindowMessages').val(s.worldbookWindowMessages);

  updateWorldbookInfoLabel();

  try {
    const count = parseWorldbookJson(String(s.worldbookJson || '')).length;
    $('#sg_worldbookInfo').text(count ? `已导入世界书：${count} 条` : '（未导入世界书）');
  } catch {
    $('#sg_worldbookInfo').text('（未导入世界书）');
  }

  
  // graph/map
  $('#sg_graphInject').prop('checked', !!s.graphInject);
  $('#sg_graphAllowMapUpdate').prop('checked', !!s.graphAllowMapUpdate);
  $('#sg_graphMaxChars').val(s.graphMaxChars);

  try {
    const g = getGraphData();
    $('#sg_graphBg').val(String(g.backgroundImage || ''));
  } catch { $('#sg_graphBg').val(''); }

  updateGraphInfoLabel();

$('#sg_custom_block').toggle(s.provider === 'custom');
  updateButtonsEnabled();
}

function updateWorldbookInfoLabel() {
  const s = ensureSettings();
  const $info = $('#sg_worldbookInfo');
  if (!$info.length) return;

  try {
    if (!s.worldbookJson) {
      $info.text('（未导入世界书）');
      return;
    }
    const stats = computeWorldbookInjection();
    const base = `已导入世界书：${stats.importedEntries} 条`;
    if (!s.worldbookEnabled) {
      $info.text(`${base}（未启用注入）`);
      return;
    }
    if (stats.mode === 'active' && stats.selectedEntries === 0) {
      $info.text(`${base}｜模式：active｜本次无条目命中（0 条）`);
      return;
    }
    $info.text(`${base}｜模式：${stats.mode}｜本次注入：${stats.injectedEntries} 条｜字符：${stats.injectedChars}｜约 tokens：${stats.injectedTokens}`);
  } catch {
    $info.text('（世界书信息解析失败）');
  }
}


function pullUiToSettings() {
  const s = ensureSettings();

  s.enabled = $('#sg_enabled').is(':checked');
  s.spoilerLevel = String($('#sg_spoiler').val());
  s.provider = String($('#sg_provider').val());
  s.temperature = clampFloat($('#sg_temperature').val(), 0, 2, s.temperature);

  s.maxMessages = clampInt($('#sg_maxMessages').val(), 5, 200, s.maxMessages);
  s.maxCharsPerMessage = clampInt($('#sg_maxChars').val(), 200, 8000, s.maxCharsPerMessage);

  s.includeUser = $('#sg_includeUser').is(':checked');
  s.includeAssistant = $('#sg_includeAssistant').is(':checked');

  s.autoRefresh = $('#sg_autoRefresh').is(':checked');
  s.autoRefreshOn = String($('#sg_autoRefreshOn').val());

  s.autoAppendBox = $('#sg_autoAppendBox').is(':checked');
  s.appendMode = String($('#sg_appendMode').val() || 'compact');

  s.inlineModulesSource = String($('#sg_inlineModulesSource').val() || 'inline');
  s.inlineShowEmpty = $('#sg_inlineShowEmpty').is(':checked');

  s.customEndpoint = String($('#sg_customEndpoint').val() || '').trim();
  s.customApiKey = String($('#sg_customApiKey').val() || '');
  s.customModel = String($('#sg_customModel').val() || '').trim();
  s.customMaxTokens = clampInt($('#sg_customMaxTokens').val(), 256, 200000, s.customMaxTokens || 8192);
  s.customStream = $('#sg_customStream').is(':checked');

  // modulesJson：先不强行校验（用户可先保存再校验），但会在分析前用默认兜底
  s.modulesJson = String($('#sg_modulesJson').val() || '').trim() || JSON.stringify(DEFAULT_MODULES, null, 2);

  s.customSystemPreamble = String($('#sg_customSystemPreamble').val() || '');
  s.customConstraints = String($('#sg_customConstraints').val() || '');

  s.presetIncludeApiKey = $('#sg_presetIncludeApiKey').is(':checked');

  s.worldbookEnabled = $('#sg_worldbookEnabled').is(':checked');
  s.worldbookMode = String($('#sg_worldbookMode').val() || 'active');
  s.worldbookMaxChars = clampInt($('#sg_worldbookMaxChars').val(), 500, 50000, s.worldbookMaxChars || 6000);
  s.worldbookWindowMessages = clampInt($('#sg_worldbookWindowMessages').val(), 5, 80, s.worldbookWindowMessages || 18);

  // graph/map
  s.graphInject = $('#sg_graphInject').is(':checked');
  s.graphAllowMapUpdate = $('#sg_graphAllowMapUpdate').is(':checked');
  s.graphMaxChars = clampInt($('#sg_graphMaxChars').val(), 500, 50000, s.graphMaxChars || 4000);

  // background image stored in per-chat graph data
  try {
    const g = getGraphData();
    const bg = String($('#sg_graphBg').val() || '').trim();
    if (bg !== String(g.backgroundImage || '')) {
      g.backgroundImage = bg;
      setGraphData(g);
    }
  } catch { /* ignore */ }


  // world source
  s.worldSourceEnabled = $('#sg_worldSourceEnabled').is(':checked');
  s.worldSourceInjectToAnalysis = $('#sg_worldSourceInjectToAnalysis').is(':checked');
  s.worldSourceUrl = String($('#sg_worldSourceUrl').val() || '').trim();
  s.worldSourceMethod = String($('#sg_worldSourceMethod').val() || 'GET').toUpperCase();
  s.worldSourceHeadersJson = String($('#sg_worldSourceHeadersJson').val() || '').trim();
  s.worldSourceMaxChars = clampInt($('#sg_worldSourceMaxChars').val(), 500, 200000, s.worldSourceMaxChars || DEFAULT_SETTINGS.worldSourceMaxChars);


}

function openModal() {
  ensureModal();
  pullSettingsToUi();
  updateWorldbookInfoLabel();
  setStatus('', '');
  $('#sg_modal_backdrop').show();
  showPane('md');
}
function closeModal() { $('#sg_modal_backdrop').hide(); }

function injectMinimalSettingsPanel() {
  const $root = $('#extensions_settings');
  if (!$root.length) return;
  if ($('#sg_settings_panel_min').length) return;

  $root.append(`
    <div class="sg-panel-min" id="sg_settings_panel_min">
      <div class="sg-min-row">
        <div class="sg-min-title">剧情指导 StoryGuide</div>
        <button class="menu_button sg-btn" id="sg_open_from_settings">打开面板</button>
      </div>
      <div class="sg-min-hint">支持自定义输出模块（JSON），并且自动追加框会缓存+监听重渲染，尽量不被变量更新覆盖。</div>
    </div>
  `);
  $('#sg_open_from_settings').on('click', () => openModal());
}

// auto refresh panel only when open
function scheduleAutoRefresh() {
  const s = ensureSettings();
  if (!s.enabled || !s.autoRefresh) return;
  const delay = clampInt(s.debounceMs, 300, 10000, DEFAULT_SETTINGS.debounceMs);

  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (document.getElementById('sg_modal_backdrop') && $('#sg_modal_backdrop').is(':visible')) runAnalysis().catch(() => void 0);
    refreshTimer = null;
  }, delay);
}

// -------------------- DOM observers (anti overwrite) --------------------

function findChatContainer() {
  const candidates = [
    '#chat',
    '#chat_history',
    '#chatHistory',
    '#chat_container',
    '#chatContainer',
    '#chat_wrapper',
    '#chatwrapper',
    '.chat',
    '.chat_history',
    '.chat-history',
    '#sheldon_chat',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  const mes = document.querySelector('.mes');
  return mes ? mes.parentElement : null;
}

function startObservers() {
  const chatContainer = findChatContainer();
  if (chatContainer) {
    if (chatDomObserver) chatDomObserver.disconnect();
    chatDomObserver = new MutationObserver(() => scheduleReapplyAll('chat'));
    chatDomObserver.observe(chatContainer, { childList: true, subtree: true, characterData: true });
  }

  if (bodyDomObserver) bodyDomObserver.disconnect();
  bodyDomObserver = new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target;
      if (t && t.nodeType === 1) {
        const el = /** @type {Element} */ (t);
        if (el.classList?.contains('mes') || el.classList?.contains('mes_text') || el.querySelector?.('.mes') || el.querySelector?.('.mes_text')) {
          scheduleReapplyAll('body');
          break;
        }
      }
    }
  });
  bodyDomObserver.observe(document.body, { childList: true, subtree: true, characterData: false });

  ensureChatActionButtons();

  scheduleReapplyAll('start');
  installCardZoomDelegation();

  scheduleReapplyAll('start');
}

// -------------------- events --------------------

function setupEventListeners() {
  const ctx = SillyTavern.getContext();
  const { eventSource, event_types } = ctx;

  eventSource.on(event_types.APP_READY, () => {
    startObservers();

    eventSource.on(event_types.CHAT_CHANGED, () => {
      inlineCache.clear();
      scheduleReapplyAll('chat_changed');
      ensureChatActionButtons();
      if (document.getElementById('sg_modal_backdrop') && $('#sg_modal_backdrop').is(':visible')) {
        pullSettingsToUi();
        setStatus('已切换聊天：已同步本聊天字段', 'ok');
      }
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
      // 禁止自动生成：不在收到消息时自动分析/追加
      scheduleReapplyAll('msg_received');
    });

    eventSource.on(event_types.MESSAGE_SENT, () => {
      // 禁止自动生成：不在发送消息时自动刷新面板
    });
  });
}

// -------------------- init --------------------

function init() {
  ensureSettings();
  setupEventListeners();

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types } = ctx;

  eventSource.on(event_types.APP_READY, () => {
    // 不再在顶栏显示📘按钮（避免占位/重复入口）
    const oldBtn = document.getElementById('sg_topbar_btn');
    if (oldBtn) oldBtn.remove();

    injectMinimalSettingsPanel();
    ensureChatActionButtons();
    installCardZoomDelegation();
  });

  globalThis.StoryGuide = {
    open: openModal,
    close: closeModal,
    runAnalysis,
    runInlineAppendForLastMessage,
    reapplyAllInlineBoxes,
    buildSnapshot: () => buildSnapshot(),
    getLastReport: () => lastReport,
    refreshModels,
    _inlineCache: inlineCache,
  };
}

init();
