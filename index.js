'use strict';

/**
 * 剧情指导 StoryGuide (SillyTavern UI Extension)
 * v0.7.5
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
  worldbookJson: '',

  // 模块自定义（JSON 字符串 + 解析备份）
  modulesJson: '',
  // 额外可自定义提示词“骨架”
  customSystemPreamble: '',     // 附加在默认 system 之后
  customConstraints: '',        // 附加在默认 constraints 之后

  // 世界地图（实验性）：用（可继承）API 生成「地点拓扑 + 主角位置」并在面板渲染
  mapProvider: 'inherit',       // inherit | st | custom
  mapPersistToChat: true,
  // 地图生成默认沿用“剧情指导”的 API 配置（endpoint/key/model/max_tokens/stream/top_p）
  // 仍保留旧字段兼容（不会用于生成；仅用于旧预设导入不报错）
  mapCustomEndpoint: '',
  mapCustomApiKey: '',
  mapCustomModel: 'gpt-4o-mini',
  mapTemperature: 0.35,
  mapTopP: 0.95,
  mapMaxTokens: 4096,
  mapStream: false,
  mapMaxLocations: 20,
  mapMaxLinks: 40,
});

const META_KEYS = Object.freeze({
  canon: 'storyguide_canon_outline',
  world: 'storyguide_world_setup',
  map: 'storyguide_world_map',
});

let lastReport = null;
let lastJsonText = '';
let lastMap = null;
let lastMapJsonText = '';
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

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    `【聊天记录（最近${picked.length}条）】`,
    picked.length ? picked.join('\n\n') : '（空）'
  ].join('\n');

  return { snapshotText, sourceSummary };
}

// -------------------- world map (experimental) --------------------

function buildMapSchema(maxLocations, maxLinks) {
  const maxL = clampInt(maxLocations, 5, 80, DEFAULT_SETTINGS.mapMaxLocations);
  const maxE = clampInt(maxLinks, 5, 200, DEFAULT_SETTINGS.mapMaxLinks);

  return {
    type: 'object',
    additionalProperties: false,
    required: ['locations', 'protagonist'],
    properties: {
      title: { type: 'string' },
      locations: {
        type: 'array',
        maxItems: maxL,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name', 'x', 'y'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            type: { type: 'string' },
            note: { type: 'string' },
          },
        },
      },
      links: {
        type: 'array',
        maxItems: maxE,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'to'],
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            label: { type: 'string' },
          },
        },
      },
      protagonist: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          at: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          note: { type: 'string' },
        },
      },
    },
  };
}

function buildMapPromptMessages(snapshotText) {
  const s = ensureSettings();
  const maxLocations = clampInt(s.mapMaxLocations, 5, 80, DEFAULT_SETTINGS.mapMaxLocations);
  const maxLinks = clampInt(s.mapMaxLinks, 5, 200, DEFAULT_SETTINGS.mapMaxLinks);

  const system = [
    `---BEGIN PROMPT---`,
    `[System]`,
    `你是“世界地图生成器”。你的任务是：从聊天/设定中提取“地点（locations）+ 连接（links）+ 主角位置（protagonist）”，并输出一份可视化用的 JSON。`,
    ``,
    `[Constraints]`,
    `1) 不要凭空杜撰地点；如果只能推断，请在 note 标注“推测/不确定”。`,
    `2) 坐标系：x,y 都是 0~100 的数字（尽量整数），用于二维示意图，不追求真实比例。`,
    `3) locations 数量 ≤ ${maxLocations}；links 数量 ≤ ${maxLinks}。`,
    `4) protagonist.at 尽量填写 locations.id；如果不确定 at，就用 x/y 直接标注并写 note。`,
    `5) 输出必须是 JSON 对象本体（无 Markdown、无代码块、无多余解释）。`,
    ``,
    `[Output JSON Schema]`,
    `- title: string (可选)`,
    `- locations: {id,name,x,y,type?,note?}[]`,
    `- links: {from,to,label?}[] (可选)`,
    `- protagonist: {name,at?,x?,y?,note?}`,
    `---END PROMPT---`,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: snapshotText },
  ];
}

function resolveMapProvider() {
  const s = ensureSettings();
  let provider = String(s.mapProvider || 'inherit');
  if (provider === 'inherit') provider = String(s.provider || 'st');

  // 地图生成沿用“剧情指导”的 API 设置（同一套 endpoint/key/model/max_tokens/stream/top_p）
  // 这样用户只需要配置一次，地图与剧情指导保持一致。
  const useCustom = provider === 'custom';
  const endpoint = useCustom ? String(s.customEndpoint || '').trim() : '';
  const apiKey = useCustom ? String(s.customApiKey || '') : '';
  const model = useCustom ? String(s.customModel || '').trim() : '';
  const temperature = clampFloat(s.temperature, 0, 2, DEFAULT_SETTINGS.temperature);
  const topP = clampFloat(s.customTopP, 0, 1, DEFAULT_SETTINGS.customTopP);
  const maxTokens = clampInt(s.customMaxTokens, 256, 200000, DEFAULT_SETTINGS.customMaxTokens);
  const stream = !!s.customStream;

  return { provider, endpoint, apiKey, model, temperature, topP, maxTokens, stream };
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

// -------------------- map generation --------------------

function normalizeMapJson(raw) {
  const out = (raw && typeof raw === 'object') ? clone(raw) : {};
  if (!Array.isArray(out.locations)) out.locations = [];
  if (!Array.isArray(out.links)) out.links = [];
  if (!out.protagonist || typeof out.protagonist !== 'object') out.protagonist = { name: '主角' };

  // clamp coords + coerce ids
  const idSeen = new Set();
  out.locations = out.locations
    .filter(x => x && typeof x === 'object')
    .map((l, idx) => {
      const id = String(l.id || l.name || `loc_${idx + 1}`);
      let uniq = id;
      let k = 2;
      while (idSeen.has(uniq)) { uniq = `${id}_${k++}`; }
      idSeen.add(uniq);

      const x = clampFloat(l.x, 0, 100, 50);
      const y = clampFloat(l.y, 0, 100, 50);
      return {
        id: uniq,
        name: String(l.name || uniq),
        x,
        y,
        type: l.type ? String(l.type) : '',
        note: l.note ? String(l.note) : '',
      };
    });

  out.links = out.links
    .filter(x => x && typeof x === 'object')
    .map(e => ({
      from: String(e.from || ''),
      to: String(e.to || ''),
      label: e.label ? String(e.label) : '',
    }))
    .filter(e => e.from && e.to);

  out.protagonist.name = String(out.protagonist.name || '主角');
  if (out.protagonist.at) out.protagonist.at = String(out.protagonist.at);
  if (out.protagonist.x !== undefined) out.protagonist.x = clampFloat(out.protagonist.x, 0, 100, 50);
  if (out.protagonist.y !== undefined) out.protagonist.y = clampFloat(out.protagonist.y, 0, 100, 50);
  if (out.protagonist.note) out.protagonist.note = String(out.protagonist.note);

  // If protagonist.at matches a location, snap to it
  if (out.protagonist.at) {
    const loc = out.locations.find(l => l.id === out.protagonist.at) || out.locations.find(l => l.name === out.protagonist.at);
    if (loc) {
      out.protagonist.at = loc.id;
      out.protagonist.x = loc.x;
      out.protagonist.y = loc.y;
    }
  }

  return out;
}

function makeStarPoints(cx, cy, rOuter, rInner, spikes) {
  const pts = [];
  const n = spikes || 5;
  const step = Math.PI / n;
  let rot = -Math.PI / 2;
  for (let i = 0; i < n * 2; i++) {
    const r = (i % 2 === 0) ? rOuter : rInner;
    const x = cx + Math.cos(rot) * r;
    const y = cy + Math.sin(rot) * r;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    rot += step;
  }
  return pts.join(' ');
}

function hashStr(str) {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function estimateSvgTextWidth(text, fontSize) {
  const t = String(text || '');
  const fs = Number(fontSize) || 3.2;
  let units = 0;
  for (const ch of t) {
    // ASCII narrower, CJK wider (rough estimate)
    units += (ch.charCodeAt(0) <= 0x7f) ? 0.58 : 1.0;
  }
  return Math.max(2.5, units * fs * 0.78);
}

function isMapLayoutDegenerate(locations) {
  const locs = Array.isArray(locations) ? locations : [];
  if (locs.length < 4) {
    // For tiny maps, avoid aggressive auto-layout unless it's clearly unusable.
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    let centerish = 0, n = 0;
    for (const l of locs) {
      const x = Number(l?.x); const y = Number(l?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      n++;
      if (Math.abs(x - 50) < 1.2 && Math.abs(y - 50) < 1.2) centerish++;
    }
    if (n < 2) return false;
    const area = (maxX - minX) * (maxY - minY);
    if (area < 40) return true;           // almost stacked
    if (centerish / n > 0.60) return true; // everyone at center default
    return false;
  }

  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  let sumX = 0, sumY = 0, n = 0;
  let centerish = 0;
  for (const l of locs) {
    const x = Number(l?.x); const y = Number(l?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    sumX += x; sumY += y; n++;
    if (Math.abs(x - 50) < 1.2 && Math.abs(y - 50) < 1.2) centerish++;
  }
  if (n < 3) return true;

  const area = (maxX - minX) * (maxY - minY);
  if (area < 260) return true; // clustered

  // std dev check
  const mx = sumX / n, my = sumY / n;
  let vx = 0, vy = 0;
  for (const l of locs) {
    const x = Number(l?.x); const y = Number(l?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    vx += (x - mx) * (x - mx);
    vy += (y - my) * (y - my);
  }
  vx /= n; vy /= n;
  if (Math.sqrt(vx) < 6 || Math.sqrt(vy) < 5) return true;
  if (centerish / n > 0.55) return true;

  return false;
}

function scaleNodesToFit(nodes, pad) {
  const p = Number(pad) || 10;
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
  }
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);

  const sx = (100 - 2 * p) / w;
  const sy = (100 - 2 * p) / h;
  const s = Math.min(sx, sy);

  const ox = (100 - w * s) / 2 - minX * s;
  const oy = (100 - h * s) / 2 - minY * s;

  for (const n of nodes) {
    n.x = clampFloat(n.x * s + ox, p, 100 - p, 50);
    n.y = clampFloat(n.y * s + oy, p, 100 - p, 50);
  }
}

function runForceLayout(locs, links) {
  const nodes = locs.map((l, i) => ({
    id: l.id,
    x: Number.isFinite(l.x) ? l.x : (50 + (Math.random() - 0.5) * 18),
    y: Number.isFinite(l.y) ? l.y : (50 + (Math.random() - 0.5) * 18),
    vx: 0,
    vy: 0,
    _i: i,
  }));

  // jitter if too many identical coords
  const buckets = new Map();
  for (const n of nodes) {
    const k = `${Math.round(n.x)}_${Math.round(n.y)}`;
    const c = (buckets.get(k) || 0) + 1;
    buckets.set(k, c);
    if (c > 1) {
      n.x += (Math.random() - 0.5) * 6;
      n.y += (Math.random() - 0.5) * 6;
    }
  }

  const idToIdx = new Map(nodes.map((n, idx) => [n.id, idx]));
  const edges = (Array.isArray(links) ? links : [])
    .map(e => ({ a: idToIdx.get(e.from), b: idToIdx.get(e.to) }))
    .filter(e => Number.isInteger(e.a) && Number.isInteger(e.b) && e.a !== e.b);

  const n = nodes.length;
  const steps = 260;
  const repK = 120;          // repulsion strength
  const attrK = 0.040;       // attraction along edges
  const rest = Math.max(12, Math.min(22, 60 / Math.sqrt(Math.max(1, n)))); // target edge length
  const centerK = 0.006;     // gentle centering
  const damp = 0.84;

  for (let it = 0; it < steps; it++) {
    // repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 0.08;
        const inv = 1 / d2;
        const f = repK * inv;

        a.vx -= dx * f;
        a.vy -= dy * f;
        b.vx += dx * f;
        b.vy += dy * f;
      }
    }

    // attraction (springs)
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const diff = d - rest;
      const f = attrK * diff;
      dx /= d; dy /= d;

      a.vx += dx * f;
      a.vy += dy * f;
      b.vx -= dx * f;
      b.vy -= dy * f;
    }

    // integrate
    for (const p of nodes) {
      // center pull
      p.vx += (50 - p.x) * centerK;
      p.vy += (50 - p.y) * centerK;

      p.vx *= damp;
      p.vy *= damp;

      p.x += p.vx * 0.055;
      p.y += p.vy * 0.055;
    }
  }

  scaleNodesToFit(nodes, 10);

  // write back
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const l of locs) {
    const p = byId.get(l.id);
    if (p) { l.x = p.x; l.y = p.y; }
  }
}

function autoBeautifyMap(m) {
  // Deep clone to avoid mutating original
  const out = normalizeMapJson(m);

  // If layout is degenerate (e.g., all on a line / clustered), auto layout.
  if (isMapLayoutDegenerate(out.locations)) {
    runForceLayout(out.locations, out.links);
    // resnap protagonist if it points to a location
    if (out.protagonist?.at) {
      const loc = out.locations.find(l => l.id === out.protagonist.at) || out.locations.find(l => l.name === out.protagonist.at);
      if (loc) { out.protagonist.x = loc.x; out.protagonist.y = loc.y; }
    }
  }

  return out;
}

function buildSvgLabel({ x, y, text, fontSize, anchor, clsText, clsBg }) {
  const t = String(text || '');
  if (!t) return '';
  const fs = Number(fontSize) || 3.2;
  const padX = 0.9, padY = 0.55;
  const w = estimateSvgTextWidth(t, fs);
  const h = fs + 1.25;

  const a = anchor || 'start';
  const ta = (a === 'end' || a === 'middle') ? a : 'start';

  let rx;
  if (ta === 'middle') rx = x - w / 2 - padX;
  else if (ta === 'end') rx = x - w - padX;
  else rx = x - padX;

  const ry = y - fs + padY;
  const rect = `<rect class="${clsBg || 'sg-map-label-bg'}" x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${(w + padX * 2).toFixed(2)}" height="${h.toFixed(2)}" rx="1.2" ry="1.2" />`;
  const txt = `<text class="${clsText || 'sg-map-label-text'}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${ta}" dominant-baseline="alphabetic">${escapeXml(t)}</text>`;
  return `<g class="sg-map-label">${rect}${txt}</g>`;
}

function computeCurveControl(ax, ay, bx, by, seed) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  let dx = bx - ax;
  let dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
  dx /= d; dy /= d;
  const nx = -dy, ny = dx; // perpendicular
  const h = hashStr(seed);
  const bucket = (h % 9) - 4; // -4..4
  const off = bucket * 1.7;
  const cx = mx + nx * off;
  const cy = my + ny * off;
  return { cx, cy, mx, my };
}

function makeArrowPolygon(ax, ay, bx, by, cx, cy) {
  // direction at end of quadratic curve: from control to end
  let dx = bx - cx;
  let dy = by - cy;
  const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
  dx /= d; dy /= d;
  const nx = -dy, ny = dx;

  const len = 1.8;
  const wid = 0.95;
  const tipX = bx, tipY = by;
  const baseX = bx - dx * len;
  const baseY = by - dy * len;

  const leftX = baseX + nx * wid;
  const leftY = baseY + ny * wid;
  const rightX = baseX - nx * wid;
  const rightY = baseY - ny * wid;

  return `${tipX.toFixed(2)},${tipY.toFixed(2)} ${leftX.toFixed(2)},${leftY.toFixed(2)} ${rightX.toFixed(2)},${rightY.toFixed(2)}`;
}

function bindMapInteractions() {
  const svg = document.querySelector('#sg_map_view svg.sg-map-svg');
  if (!svg) return;

  const viewport = svg.querySelector('.sg-map-viewport');
  if (!viewport) return;

  // Rebind per render (map changes), but keep one handler instance.
  if (svg.dataset.sgBound === '1') return;
  svg.dataset.sgBound = '1';

  svg.style.touchAction = 'none';

  const state = { s: 1, tx: 0, ty: 0, dragging: false, last: null };

  const apply = () => {
    viewport.setAttribute('transform', `translate(${state.tx.toFixed(2)} ${state.ty.toFixed(2)}) scale(${state.s.toFixed(3)})`);
  };

  const getPt = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = getPt(e);
    const oldS = state.s;
    const factor = (e.deltaY > 0) ? 0.90 : 1.10;
    const newS = clampFloat(oldS * factor, 0.6, 3.2, 1);

    // keep the world point under cursor stable: p = s*w + t
    const wx = (p.x - state.tx) / oldS;
    const wy = (p.y - state.ty) / oldS;

    state.s = newS;
    state.tx = p.x - wx * newS;
    state.ty = p.y - wy * newS;
    apply();
  }, { passive: false });

  const onMove = (e) => {
    if (!state.dragging) return;
    const p = getPt(e);
    const dx = p.x - state.last.x;
    const dy = p.y - state.last.y;
    state.tx += dx;
    state.ty += dy;
    state.last = p;
    apply();
  };

  const onUp = () => {
    state.dragging = false;
    svg.classList.remove('dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  svg.addEventListener('pointerdown', (e) => {
    // left button or touch
    if (e.button !== undefined && e.button !== 0) return;
    state.dragging = true;
    svg.classList.add('dragging');
    state.last = getPt(e);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  svg.addEventListener('dblclick', (e) => {
    e.preventDefault();
    state.s = 1; state.tx = 0; state.ty = 0;
    apply();
  });

  apply();
}

function renderMapSvg(mapJson) {
  const m = autoBeautifyMap(mapJson);
  const locById = new Map(m.locations.map(l => [l.id, l]));

  // background grid (minor + major)
  const grid = [];
  for (let i = 0; i <= 100; i += 10) {
    const cls = (i % 20 === 0) ? 'sg-map-grid sg-map-grid-major' : 'sg-map-grid sg-map-grid-minor';
    grid.push(`<line class="${cls}" x1="${i}" y1="0" x2="${i}" y2="100" />`);
    grid.push(`<line class="${cls}" x1="0" y1="${i}" x2="100" y2="${i}" />`);
  }

  const links = m.links.map((e, idx) => {
    const a = locById.get(e.from) || m.locations.find(x => x.name === e.from);
    const b = locById.get(e.to) || m.locations.find(x => x.name === e.to);
    if (!a || !b) return '';

    const { cx, cy, mx, my } = computeCurveControl(a.x, a.y, b.x, b.y, `${e.from}|${e.to}|${idx}`);
    const d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    const arrowPts = makeArrowPolygon(a.x, a.y, b.x, b.y, cx, cy);

    // label at curve midpoint (slightly lifted)
    let lx = mx, ly = my - 1.8;
    const label = e.label ? buildSvgLabel({
      x: clampFloat(lx, 4, 96, lx),
      y: clampFloat(ly, 6, 96, ly),
      text: e.label,
      fontSize: 3.0,
      anchor: 'middle',
      clsText: 'sg-map-link-label-text',
      clsBg: 'sg-map-link-label-bg',
    }) : '';

    const title = [e.label, `${a.name} → ${b.name}`].filter(Boolean).join(' ');
    return `
      <g class="sg-map-link" data-from="${escapeXml(e.from)}" data-to="${escapeXml(e.to)}">
        <path class="sg-map-link-path" d="${d}" />
        <polygon class="sg-map-link-arrow" points="${arrowPts}" />
        ${label}
        ${title ? `<title>${escapeXml(title)}</title>` : ''}
      </g>
    `;
  }).join('');

  const nodes = m.locations.map((l) => {
    const title = [l.name, l.type ? `(${l.type})` : '', l.note].filter(Boolean).join(' ');
    const type = l.type ? ` data-type="${escapeXml(l.type)}"` : '';

    // label placement
    const fs = 3.25;
    const w = estimateSvgTextWidth(l.name, fs);
    let anchor = (l.x > 72) ? 'end' : 'start';
    let x = (anchor === 'end') ? (l.x - 3.2) : (l.x + 3.2);
    let y = l.y + ((l.y < 18) ? 5.2 : (l.y > 86 ? -2.6 : 1.8));

    // clamp label inside
    if (anchor === 'start') x = clampFloat(x, 2.2, 98 - w, x);
    else x = clampFloat(x, 2.2 + w, 98, x);
    y = clampFloat(y, 6.0, 96.0, y);

    const label = buildSvgLabel({
      x, y,
      text: l.name,
      fontSize: fs,
      anchor,
      clsText: 'sg-map-node-label-text',
      clsBg: 'sg-map-node-label-bg',
    });

    return `
      <g class="sg-map-node" data-id="${escapeXml(l.id)}"${type}>
        <circle class="sg-map-node-ring" cx="${l.x.toFixed(2)}" cy="${l.y.toFixed(2)}" r="3.05" />
        <circle class="sg-map-node-dot" cx="${l.x.toFixed(2)}" cy="${l.y.toFixed(2)}" r="2.05" />
        ${label}
        ${title ? `<title>${escapeXml(title)}</title>` : ''}
      </g>
    `;
  }).join('');

  const px = clampFloat(m.protagonist.x, 0, 100, 50);
  const py = clampFloat(m.protagonist.y, 0, 100, 50);
  const pTitle = [m.protagonist.name, m.protagonist.at ? `@${m.protagonist.at}` : '', m.protagonist.note || ''].filter(Boolean).join(' ');

  const starPtsOuter = makeStarPoints(px, py, 3.35, 1.65, 5);
  const starPtsGlow = makeStarPoints(px, py, 4.45, 2.15, 5);

  // protagonist label placement
  const pFs = 3.35;
  const pW = estimateSvgTextWidth(m.protagonist.name, pFs);
  let pAnchor = (px > 72) ? 'end' : 'start';
  let pX = (pAnchor === 'end') ? (px - 3.6) : (px + 3.6);
  let pY = py - 5.1;
  if (pY < 6) pY = py + 6.0;

  if (pAnchor === 'start') pX = clampFloat(pX, 2.2, 98 - pW, pX);
  else pX = clampFloat(pX, 2.2 + pW, 98, pX);
  pY = clampFloat(pY, 6.0, 96.0, pY);

  const pLabel = buildSvgLabel({
    x: pX, y: pY,
    text: m.protagonist.name,
    fontSize: pFs,
    anchor: pAnchor,
    clsText: 'sg-map-protagonist-label-text',
    clsBg: 'sg-map-protagonist-label-bg',
  });

  const star = `
    <g class="sg-map-protagonist">
      <polygon class="sg-map-protagonist-glow" points="${starPtsGlow}" />
      <polygon class="sg-map-protagonist-star" points="${starPtsOuter}" />
      ${pLabel}
      ${pTitle ? `<title>${escapeXml(pTitle)}</title>` : ''}
    </g>
  `;

  const title = m.title ? `<div class="sg-map-title">${escapeXml(m.title)}</div>` : '';
  const hint = `<div class="sg-map-interact-hint">滚轮缩放 · 拖拽平移 · 双击重置</div>`;

  const svg = `
    ${title}
    ${hint}
    <svg class="sg-map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="World Map">
      <rect class="sg-map-bg" x="0" y="0" width="100" height="100" rx="2.6" ry="2.6" />
      <g class="sg-map-viewport">
        <g class="sg-map-grid-layer">${grid.join('')}</g>
        <g class="sg-map-links-layer">${links}</g>
        <g class="sg-map-nodes-layer">${nodes}</g>
        ${star}
      </g>
    </svg>
  `;

  // sanitize as HTML
  return SillyTavern.libs?.DOMPurify ? SillyTavern.libs.DOMPurify.sanitize(svg) : svg;
}

function renderMapToPane(mapJson, rawText) {
  lastMap = mapJson;
  lastMapJsonText = rawText || (mapJson ? JSON.stringify(mapJson, null, 2) : '');

  const $json = $('#sg_map_json');
  const $view = $('#sg_map_view');
  if ($json.length) $json.text(lastMapJsonText || '');
  if ($view.length) {
    if (!mapJson) $view.html('<div class="sg-hint">（尚未生成）</div>');
    else $view.html(renderMapSvg(mapJson));
    // enable pan/zoom and keep handlers one-time bound
    bindMapInteractions();
  }

  $('#sg_mapCopyJson').prop('disabled', !Boolean(lastMapJsonText));
}

async function clearMap() {
  lastMap = null;
  lastMapJsonText = '';
  renderMapToPane(null, '');
  try { await setChatMetaValue(META_KEYS.map, ''); } catch { /* ignore */ }
  setStatus('已清空地图', 'ok');
}

async function runMapGeneration() {
  const s = ensureSettings();
  if (!s.enabled) { setStatus('插件未启用', 'warn'); return; }

  setStatus('生成地图中…', 'warn');
  $('#sg_mapGenerate').prop('disabled', true);

  try {
    const { snapshotText } = buildSnapshot();
    const messages = buildMapPromptMessages(snapshotText);
    const schema = buildMapSchema(s.mapMaxLocations, s.mapMaxLinks);

    const cfg = resolveMapProvider();
    let jsonText = '';

    if (cfg.provider === 'custom') {
      jsonText = await callViaCustom(cfg.endpoint, cfg.apiKey, cfg.model, messages, cfg.temperature, cfg.maxTokens, cfg.topP, cfg.stream);
      const parsedTry = safeJsonParse(jsonText);
      if (!parsedTry || !parsedTry.locations) {
        try {
          jsonText = await fallbackAskJsonCustom(cfg.endpoint, cfg.apiKey, cfg.model, messages, cfg.temperature, cfg.maxTokens, cfg.topP, cfg.stream);
        } catch { /* ignore */ }
      }
    } else {
      jsonText = await callViaSillyTavern(messages, schema, cfg.temperature);
      if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
      const parsedTry = safeJsonParse(jsonText);
      if (!parsedTry || !parsedTry.locations) jsonText = await fallbackAskJson(messages, cfg.temperature);
    }

    const parsed = safeJsonParse(jsonText);
    if (!parsed) {
      renderMapToPane(null, String(jsonText || ''));
      showPane('map');
      throw new Error('地图输出无法解析为 JSON（已切到地图标签，看看原文/JSON）');
    }

    const normalized = normalizeMapJson(parsed);
    const rawPretty = JSON.stringify(normalized, null, 2);
    renderMapToPane(normalized, rawPretty);

    if (s.mapPersistToChat) {
      try { await setChatMetaValue(META_KEYS.map, rawPretty); } catch { /* ignore */ }
    }

    showPane('map');
    setStatus('地图已生成 ✅', 'ok');
  } catch (e) {
    console.error('[StoryGuide] map failed:', e);
    setStatus(`地图生成失败：${e?.message ?? e}`, 'err');
  } finally {
    $('#sg_mapGenerate').prop('disabled', false);
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

function fillModelSelectFor($sel, modelIds, selected) {
  if (!$sel || !$sel.length) return;
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

function fillModelSelectAll(modelIds, selected) {
  fillModelSelectFor($('#sg_modelSelect'), modelIds, selected);
  fillModelSelectFor($('#sg_mapModelSelect'), modelIds, selected);
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
    fillModelSelectAll(ids, s.customModel);
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
    fillModelSelectAll(ids, s.customModel);
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

function positionChatActionButtons() {
  const wrap = document.getElementById('sg_chat_controls');
  if (!wrap) return;

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

  // measure
  const prevVis = wrap.style.visibility;
  wrap.style.visibility = 'hidden';
  wrap.style.left = '0px';
  wrap.style.top = '0px';
  const w = wrap.offsetWidth || 200;
  const h = wrap.offsetHeight || 36;

  // place to the left of send button, vertically centered
  let left = rect.left - w - 10;
  let top = rect.top + (rect.height - h) / 2;

  // clamp to viewport
  const pad = 8;
  left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - h - pad));

  wrap.style.left = `${Math.round(left)}px`;
  wrap.style.top = `${Math.round(top)}px`;
  wrap.style.visibility = prevVis || 'visible';
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
    wrap.querySelectorAll('button.sg-chat-btn').forEach(b => { b.disabled = !!busy; });
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

  const mapBtn = document.createElement('button');
  mapBtn.type = 'button';
  mapBtn.id = 'sg_chat_map';
  mapBtn.className = 'menu_button sg-chat-btn';
  mapBtn.title = '生成/刷新世界地图（打开面板→地图标签）';
  mapBtn.innerHTML = '🗺 <span class="sg-chat-label">地图</span>';

  mapBtn.addEventListener('click', async () => {
    try {
      setBusy(true);
      openModal();
      showPane('map');
      pullUiToSettings();
      saveSettings();
      await runMapGeneration();
    } catch (e) {
      console.warn('[StoryGuide] map generate failed', e);
    } finally {
      setBusy(false);
      schedulePositionChatButtons();
    }
  });

  wrap.appendChild(gen);
  wrap.appendChild(reroll);
  wrap.appendChild(mapBtn);

  // Use fixed positioning to avoid overlapping with send button / different themes.
  document.body.appendChild(wrap);

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




          <div class="sg-status" id="sg_status"></div>
        </div>

        <div class="sg-right">
          <div class="sg-card">
            <div class="sg-card-title">输出</div>

            <div class="sg-tabs">
              <button class="sg-tab active" id="sg_tab_md">报告</button>
              <button class="sg-tab" id="sg_tab_map">地图</button>
              <button class="sg-tab" id="sg_tab_json">JSON</button>
              <button class="sg-tab" id="sg_tab_src">来源</button>
              <div class="sg-spacer"></div>
              <button class="menu_button sg-btn" id="sg_copyMd" disabled>复制MD</button>
              <button class="menu_button sg-btn" id="sg_copyJson" disabled>复制JSON</button>
              <button class="menu_button sg-btn" id="sg_injectTips" disabled>注入提示</button>
            </div>

            <div class="sg-pane active" id="sg_pane_md"><div class="sg-md" id="sg_md">(尚未生成)</div></div>
            <div class="sg-pane" id="sg_pane_map">
              <div class="sg-row sg-inline sg-map-toolbar">
                <label style="opacity:.82;">地图 Provider</label>
                <select id="sg_mapProvider">
                  <option value="inherit">跟随上方 Provider</option>
                  <option value="st">使用当前 SillyTavern API</option>
                  <option value="custom">独立API（使用上方设置）</option>
                </select>

                <label class="sg-check" title="把地图JSON存到本聊天元数据里，切换聊天后也能看到">
                  <input type="checkbox" id="sg_mapPersist">随聊天保存</label>

                <button class="menu_button sg-btn" id="sg_mapGenerate">生成/刷新地图</button>
                <button class="menu_button sg-btn" id="sg_mapClear">清空</button>
                <button class="menu_button sg-btn" id="sg_mapCopyJson" disabled>复制地图JSON</button>
              </div>

              <div id="sg_map_custom_block" class="sg-card sg-subcard" style="display:none; margin-top:10px;">
                <div class="sg-card-title">地图 API 设置（与剧情指导共用）</div>

                <div class="sg-field">
                  <label>API基础URL（例如 https://api.openai.com/v1 ）</label>
                  <input id="sg_mapEndpoint" type="text" placeholder="https://xxx.com/v1">
                  <div class="sg-hint">这里与上方“独立API”共用同一套设置；任意一处修改都会同步。</div>
                </div>

                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>API Key（可选）</label>
                    <input id="sg_mapApiKey" type="password" placeholder="可留空">
                  </div>
                  <div class="sg-field">
                    <label>模型（可手填）</label>
                    <input id="sg_mapModel" type="text" placeholder="gpt-4o-mini">
                  </div>
                </div>

                <div class="sg-row sg-inline">
                  <button class="menu_button sg-btn" id="sg_mapRefreshModels">检查/刷新模型</button>
                  <select id="sg_mapModelSelect" class="sg-model-select">
                    <option value="">（选择模型）</option>
                  </select>
                </div>

                <div class="sg-row">
                  <div class="sg-field sg-field-full">
                    <label>最大回复token数（max_tokens）</label>
                    <input id="sg_mapMaxTokens" type="number" min="256" max="200000" step="1" placeholder="例如：60000">
                    <label class="sg-check" style="margin-top:8px;">
                      <input type="checkbox" id="sg_mapStream"> 使用流式返回（stream=true）
                    </label>
                  </div>
                </div>
              </div>

              <div class="sg-map-view" id="sg_map_view"><div class="sg-hint">（尚未生成）</div></div>
              <details class="sg-map-details">
                <summary>地图JSON</summary>
                <pre class="sg-pre" id="sg_map_json"></pre>
              </details>
            </div>
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
  $('#sg_tab_map').on('click', () => showPane('map'));
  $('#sg_tab_json').on('click', () => showPane('json'));
  $('#sg_tab_src').on('click', () => showPane('src'));

  // 地图 API 复用“剧情指导”的同一套独立API配置。
  // 显示/隐藏规则：看“地图 Provider”最终解析后的 provider。
  const toggleMapCustomBlock = () => {
    const mp = String($('#sg_mapProvider').val() || 'inherit');
    const main = String($('#sg_provider').val() || 'st');
    const resolved = (mp === 'inherit') ? main : mp;
    $('#sg_map_custom_block').toggle(resolved === 'custom');
  };

  const syncVal = (src, dst) => {
    const $s = $(src); const $d = $(dst);
    if (!$s.length || !$d.length) return;
    const v = $s.val();
    if ($d.val() !== v) $d.val(v);
  };
  const syncChecked = (src, dst) => {
    const $s = $(src); const $d = $(dst);
    if (!$s.length || !$d.length) return;
    const v = $s.is(':checked');
    if ($d.is(':checked') !== v) $d.prop('checked', v);
  };

  // 双向同步：上方独立API块 <-> 地图独立API块
  $('#sg_customEndpoint').on('input', () => syncVal('#sg_customEndpoint', '#sg_mapEndpoint'));
  $('#sg_mapEndpoint').on('input', () => syncVal('#sg_mapEndpoint', '#sg_customEndpoint'));

  $('#sg_customApiKey').on('input', () => syncVal('#sg_customApiKey', '#sg_mapApiKey'));
  $('#sg_mapApiKey').on('input', () => syncVal('#sg_mapApiKey', '#sg_customApiKey'));

  $('#sg_customModel').on('input', () => syncVal('#sg_customModel', '#sg_mapModel'));
  $('#sg_mapModel').on('input', () => syncVal('#sg_mapModel', '#sg_customModel'));

  $('#sg_customMaxTokens').on('input', () => syncVal('#sg_customMaxTokens', '#sg_mapMaxTokens'));
  $('#sg_mapMaxTokens').on('input', () => syncVal('#sg_mapMaxTokens', '#sg_customMaxTokens'));

  $('#sg_customStream').on('change', () => syncChecked('#sg_customStream', '#sg_mapStream'));
  $('#sg_mapStream').on('change', () => syncChecked('#sg_mapStream', '#sg_customStream'));

  $('#sg_mapProvider').on('change', () => toggleMapCustomBlock());

  $('#sg_mapGenerate').on('click', async () => {
    pullUiToSettings();
    saveSettings();
    await runMapGeneration();
  });

  $('#sg_mapRefreshModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshModels();
  });

  $('#sg_mapModelSelect').on('change', () => {
    const id = String($('#sg_mapModelSelect').val() || '').trim();
    if (!id) return;
    $('#sg_mapModel').val(id);
    $('#sg_customModel').val(id);
    $('#sg_modelSelect').val(id);
  });

  $('#sg_mapCopyJson').on('click', async () => {
    try { await navigator.clipboard.writeText(lastMapJsonText || ''); setStatus('已复制：地图JSON', 'ok'); }
    catch (e) { setStatus(`复制失败：${e?.message ?? e}`, 'err'); }
  });

  $('#sg_mapClear').on('click', () => { clearMap().catch(() => void 0); });

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
    toggleMapCustomBlock();
  });

  $('#sg_refreshModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshModels();
  });

  $('#sg_modelSelect').on('change', () => {
    const id = String($('#sg_modelSelect').val() || '').trim();
    if (!id) return;
    $('#sg_customModel').val(id);
    $('#sg_mapModel').val(id);
    $('#sg_mapModelSelect').val(id);
  });

  // 初次计算一次（避免刚打开时地图块显示状态不对）
  toggleMapCustomBlock();

  
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
  $('#sg_customMaxTokens').val(s.customMaxTokens ?? DEFAULT_SETTINGS.customMaxTokens);
  $('#sg_customStream').prop('checked', !!s.customStream);

  // map settings
  $('#sg_mapProvider').val(String(s.mapProvider || 'inherit'));
  $('#sg_mapPersist').prop('checked', !!s.mapPersistToChat);
  $('#sg_mapEndpoint').val(s.customEndpoint);
  $('#sg_mapApiKey').val(s.customApiKey);
  $('#sg_mapModel').val(s.customModel);
  $('#sg_mapMaxTokens').val(s.customMaxTokens ?? DEFAULT_SETTINGS.customMaxTokens);
  $('#sg_mapStream').prop('checked', !!s.customStream);

  // 地图块显示逻辑：跟随最终解析 provider
  const mp = String(s.mapProvider || 'inherit');
  const resolved = (mp === 'inherit') ? String(s.provider || 'st') : mp;
  $('#sg_map_custom_block').toggle(resolved === 'custom');

  fillModelSelectAll(Array.isArray(s.customModelsCache) ? s.customModelsCache : [], s.customModel);

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

  $('#sg_custom_block').toggle(s.provider === 'custom');
  updateButtonsEnabled();

  // load persisted map (per chat)
  try {
    const txt = String(getChatMetaValue(META_KEYS.map) || '').trim();
    if (!txt) {
      renderMapToPane(null, '');
    } else {
      const parsed = safeJsonParse(txt);
      if (parsed) {
        const normalized = normalizeMapJson(parsed);
        renderMapToPane(normalized, JSON.stringify(normalized, null, 2));
      } else {
        // keep raw in JSON panel for debugging
        renderMapToPane(null, txt);
      }
    }
  } catch { /* ignore */ }
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

  // 共享：独立API设置（剧情指导 + 地图共用）
  const sharedEndpoint = String($('#sg_customEndpoint').val() || $('#sg_mapEndpoint').val() || '').trim();
  const sharedApiKey = String($('#sg_customApiKey').val() || $('#sg_mapApiKey').val() || '');
  const sharedModel = String($('#sg_customModel').val() || $('#sg_mapModel').val() || '').trim();
  const sharedMaxTokensRaw = $('#sg_customMaxTokens').val() || $('#sg_mapMaxTokens').val();
  const sharedStream = ($('#sg_customStream').length ? $('#sg_customStream').is(':checked') : false) || ($('#sg_mapStream').length ? $('#sg_mapStream').is(':checked') : false);

  s.customEndpoint = sharedEndpoint;
  s.customApiKey = sharedApiKey;
  s.customModel = sharedModel;
  s.customMaxTokens = clampInt(sharedMaxTokensRaw, 256, 200000, s.customMaxTokens || DEFAULT_SETTINGS.customMaxTokens);
  s.customStream = !!sharedStream;

  // map settings
  s.mapProvider = String($('#sg_mapProvider').val() || 'inherit');
  s.mapPersistToChat = $('#sg_mapPersist').is(':checked');

  // modulesJson：先不强行校验（用户可先保存再校验），但会在分析前用默认兜底
  s.modulesJson = String($('#sg_modulesJson').val() || '').trim() || JSON.stringify(DEFAULT_MODULES, null, 2);

  s.customSystemPreamble = String($('#sg_customSystemPreamble').val() || '');
  s.customConstraints = String($('#sg_customConstraints').val() || '');

  s.presetIncludeApiKey = $('#sg_presetIncludeApiKey').is(':checked');

  s.worldbookEnabled = $('#sg_worldbookEnabled').is(':checked');
  s.worldbookMode = String($('#sg_worldbookMode').val() || 'active');
  s.worldbookMaxChars = clampInt($('#sg_worldbookMaxChars').val(), 500, 50000, s.worldbookMaxChars || 6000);
  s.worldbookWindowMessages = clampInt($('#sg_worldbookWindowMessages').val(), 5, 80, s.worldbookWindowMessages || 18);
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
    runMapGeneration,
    runInlineAppendForLastMessage,
    reapplyAllInlineBoxes,
    buildSnapshot: () => buildSnapshot(),
    getLastReport: () => lastReport,
    getLastMap: () => lastMap,
    refreshModels,
    _inlineCache: inlineCache,
  };
}

init();
