const MODULE_NAME = 'infinite_plot_guide';
const PROMPT_KEY = '3_infinite_plot_guide';

const DEFAULTS = {
  enabled: true,

  // mode:
  // - external: call an independent API and append the returned Plot Guide block to the AI message.
  // - inject  : inject instructions into the main prompt (uses main LLM tokens).
  mode: 'external',

  // Canon scaffolding
  workTitle: '',
  canonMC: '',
  keyNpcs: '',
  canonNotes: '',

  // Inject mode only
  position: 1,
  depth: 0,
  scanWi: false,

  // External API mode only
  apiUrl: '',
  apiKey: '',
  apiHeaderName: 'Authorization',
  apiKeyPrefix: 'Bearer ',
  apiModel: '',
  apiTemperature: 0.2,
  apiMaxMessages: 10,
  apiTimeoutMs: 20000,

  // Which chat messages are sent to the external API
  includeSystem: false,
  includeHidden: true, // hidden messages may contain important blocks
};

function getContextSafe() {
  if (!globalThis.SillyTavern?.getContext) return null;
  return globalThis.SillyTavern.getContext();
}

function getEventTypes(ctx) {
  return ctx?.event_types || ctx?.eventTypes || ctx?.event_types || {};
}

function loadSettings(ctx) {
  const store = ctx.extensionSettings;
  if (!store[MODULE_NAME]) store[MODULE_NAME] = structuredClone(DEFAULTS);
  const s = store[MODULE_NAME];
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (s[k] === undefined || s[k] === null) s[k] = v;
  }
  return s;
}

function sanitizeOneLine(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function buildHeaderSuffix(s) {
  const title = sanitizeOneLine(s.workTitle);
  const mc = sanitizeOneLine(s.canonMC);
  const npcs = sanitizeOneLine(s.keyNpcs);

  const bits = [];
  if (title) bits.push(`原著=${title}`);
  if (mc) bits.push(`原著主角=${mc}`);
  if (npcs) bits.push(`关键NPC=${npcs}`);
  return bits.length ? `（${bits.join('｜')}）` : '';
}

/** Ensures markdown quote block, and ensures it has a title line. */
function normalizeGuideText(raw, s) {
  let text = String(raw ?? '').trim();

  // Strip surrounding code fences if any.
  text = text.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '').replace(/\n```$/, '').trim();

  // Ensure it starts with a title line.
  const header = buildHeaderSuffix(s);
  const titleLine = `> **【剧情指引${header}】**`;

  const hasTitle = /^\s*>?\s*\*\*\s*【剧情指引.*】\s*\*\*/m.test(text);
  if (!hasTitle) {
    text = `${titleLine}\n${text}`;
  }

  // Force quote marker on every line (orange bar).
  text = text
    .split('\n')
    .map((line) => {
      const l = line.replace(/\s+$/, '');
      if (l.trim() === '') return '>';
      if (l.startsWith('>')) return l;
      return `> ${l}`;
    })
    .join('\n');

  return text.trim();
}

function buildInjectionText(s) {
  const header = buildHeaderSuffix(s);
  const mc = sanitizeOneLine(s.canonMC);

  const canonNotes = String(s.canonNotes ?? '').trim();
  const canonNotesBlock = canonNotes
    ? `\n【原著线要点（供对照，需优先采用；若冲突，以更具体者为准）】\n${canonNotes}\n`
    : '';

  return [
    `你必须在“本回合正文的最后”追加一次且仅一次如下块（不要改动前文，只在末尾新增）。本块是“导演提示/原著对照”，不是角色对白。`,
    `写作基准：以${mc ? `原著主角「${mc}」` : '原著主角'}的既定行为链为第一优先，其次是原著关键NPC的既定行为链；避免泛泛世界观解释。`,
    `输出要求：每条都写成“人物+动词+目的/结果”的具体动作句；不确定则写“原著线未知”，并用【推测】给出A/B分支。`,
    `格式要求：整块必须使用 Markdown 引用（每行以 "> " 开头）以保持橙色竖线。`,
    canonNotesBlock ? `参考材料：${canonNotesBlock}` : '',
    `> **【剧情指引${header}】**`,
    `> 原著此刻：{{1-3条，按先后；写“谁在做什么/将做什么/为何”。}}`,
    `> 原著接下来：{{2-3条，按先后；聚焦原著主角/关键NPC下一步动作。}}`,
    `> 偏离影响：{{对照原著，写“机会1点+风险1点”，都要具体。}}`,
    `> 提示：{{给主角3条可执行建议，短句，编号1-3。}}`,
  ].filter(Boolean).join('\n');
}

function applyInjection(ctx, s) {
  if (!ctx?.setExtensionPrompt) return;

  // External mode: clear injection (so it doesn't double-generate).
  if (!s.enabled || s.mode !== 'inject') {
    ctx.setExtensionPrompt(PROMPT_KEY, '', Number(s.position ?? 1), Number(s.depth ?? 0), !!s.scanWi);
    return;
  }

  const text = buildInjectionText(s);
  ctx.setExtensionPrompt(PROMPT_KEY, text, Number(s.position), Number(s.depth), !!s.scanWi);
}

function pickRecentMessages(ctx, s) {
  const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
  const maxN = Math.max(1, Number(s.apiMaxMessages ?? 10));

  // From the end, keep last maxN messages that match filters.
  const picked = [];
  for (let i = chat.length - 1; i >= 0 && picked.length < maxN; i--) {
    const m = chat[i];
    if (!m) continue;

    // Hidden messages handling: in ST, hidden messages often have `is_hidden` or `hidden` flags.
    if (!s.includeHidden && (m.is_hidden || m.hidden)) continue;

    // System messages handling
    const name = String(m.name ?? '');
    const looksSystem = !m.is_user && /system/i.test(name);
    if (!s.includeSystem && looksSystem) continue;

    picked.push(m);
  }
  picked.reverse();
  return picked;
}

function toOpenAiMessages(ctx, s) {
  const recent = pickRecentMessages(ctx, s);

  const workTitle = sanitizeOneLine(s.workTitle);
  const canonMC = sanitizeOneLine(s.canonMC);
  const keyNpcs = sanitizeOneLine(s.keyNpcs);

  const canonNotes = String(s.canonNotes ?? '').trim();

  const sysLines = [
    `你是“无限流剧情指引块”生成器。你要阅读对话中“本回合正文”的信息，输出一个追加在正文末尾的【剧情指引】引用块。`,
    `重点：以原著时间线为基准，聚焦原著主角${canonMC ? `「${canonMC}」` : ''}在当前时间点的具体行动链，以及原著关键NPC的具体行动链。避免泛泛世界观解释。`,
    `若原著线不足以确定：必须写“原著线未知”，并用【推测】给出A/B分支。`,
    `输出必须是 Markdown 引用块（每行以 \"> \" 开头），且仅输出这一块，不要输出其它解释。`,
    workTitle ? `原著/剧本名：${workTitle}` : '',
    canonMC ? `原著主角：${canonMC}` : '',
    keyNpcs ? `关键NPC：${keyNpcs}` : '',
    canonNotes ? `原著线要点（更高优先级）：\n${canonNotes}` : '',
  ].filter(Boolean);

  const header = buildHeaderSuffix(s);

  const formatLines = [
    `你输出的块必须遵循以下结构（行内内容由你填写）：`,
    `> **【剧情指引${header}】**`,
    `> 原著此刻：...`,
    `> 原著接下来：...`,
    `> 偏离影响：...`,
    `> 提示：1)... 2)... 3)...`,
  ];

  const messages = [{ role: 'system', content: sysLines.join('\n') + '\n\n' + formatLines.join('\n') }];

  for (const m of recent) {
    const role = m.is_user ? 'user' : 'assistant';
    messages.push({ role, content: String(m.mes ?? '') });
  }

  return messages;
}

async function callExternalApi(ctx, s) {
  const url = String(s.apiUrl ?? '').trim();
  if (!url) throw new Error('未设置 API URL');

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(s.apiTimeoutMs ?? 20000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    const key = String(s.apiKey ?? '');
    const headerName = String(s.apiHeaderName ?? 'Authorization').trim();
    const prefix = String(s.apiKeyPrefix ?? 'Bearer ');

    if (key && headerName) {
      headers[headerName] = `${prefix}${key}`;
    }

    // OpenAI-compatible default payload
    const payload = {
      model: String(s.apiModel ?? '').trim() || undefined,
      temperature: Number(s.apiTemperature ?? 0.2),
      messages: toOpenAiMessages(ctx, s),
    };

    // Remove undefined keys (some servers are strict)
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      const errText = ct.includes('application/json')
        ? JSON.stringify(await res.json()).slice(0, 1000)
        : (await res.text()).slice(0, 1000);
      throw new Error(`API 错误 ${res.status}: ${errText}`);
    }

    if (ct.includes('application/json')) {
      const j = await res.json();

      // OpenAI compatible: choices[0].message.content
      const openai = j?.choices?.[0]?.message?.content;
      if (typeof openai === 'string' && openai.trim()) return openai;

      // Common alternates
      const alt =
        j?.content ??
        j?.text ??
        j?.result ??
        j?.output ??
        j?.data ??
        j?.message ??
        '';
      if (typeof alt === 'string' && alt.trim()) return alt;

      return JSON.stringify(j);
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function findLastAssistantMessageIndex(ctx) {
  const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
  for (let i = chat.length - 1; i >= 0; i--) {
    const m = chat[i];
    if (!m) continue;
    if (!m.is_user && typeof m.mes === 'string') return i;
  }
  return -1;
}

async function appendGuideToLastAssistantMessage(ctx, s) {
  const idx = findLastAssistantMessageIndex(ctx);
  if (idx < 0) return;

  const msg = ctx.chat[idx];
  if (!msg?.mes) return;

  // Prevent double-append (swipes, rerenders, etc.)
  if (/\*\*【剧情指引/.test(msg.mes)) return;

  const rawGuide = await callExternalApi(ctx, s);
  const guide = normalizeGuideText(rawGuide, s);

  msg.mes = String(msg.mes).replace(/\s*$/, '') + '\n\n' + guide;

  // Best-effort persistence (depends on ST version)
  try {
    await ctx.saveChat?.();
  } catch {}
  try {
    ctx.saveChatDebounced?.();
  } catch {}
}

async function mountSettingsUI(ctx, s) {
  const html = ctx.renderExtensionTemplateAsync
    ? await ctx.renderExtensionTemplateAsync(MODULE_NAME, 'settings')
    : ctx.renderExtensionTemplate(MODULE_NAME, 'settings');

  $('#extensions_settings2').append(html);

  // Fill inputs
  $('#ipg_enabled').prop('checked', !!s.enabled);
  $('#ipg_mode').val(String(s.mode ?? 'external'));

  $('#ipg_work_title').val(s.workTitle);
  $('#ipg_canon_mc').val(s.canonMC);
  $('#ipg_key_npcs').val(s.keyNpcs);
  $('#ipg_canon_notes').val(s.canonNotes);

  // Inject settings
  $('#ipg_position').val(String(s.position));
  $('#ipg_depth').val(String(s.depth));
  $('#ipg_scan_wi').prop('checked', !!s.scanWi);

  // External API settings
  $('#ipg_api_url').val(s.apiUrl);
  $('#ipg_api_key').val(s.apiKey);
  $('#ipg_api_header').val(s.apiHeaderName);
  $('#ipg_api_prefix').val(s.apiKeyPrefix);
  $('#ipg_api_model').val(s.apiModel);
  $('#ipg_api_temp').val(String(s.apiTemperature));
  $('#ipg_api_maxmsg').val(String(s.apiMaxMessages));
  $('#ipg_api_timeout').val(String(s.apiTimeoutMs));
  $('#ipg_api_include_system').prop('checked', !!s.includeSystem);
  $('#ipg_api_include_hidden').prop('checked', !!s.includeHidden);

  const toggleModeUi = () => {
    const mode = String($('#ipg_mode').val() ?? 'external');
    $('.ipg_mode_inject').toggle(mode === 'inject');
    $('.ipg_mode_external').toggle(mode === 'external');
  };

  const persist = () => {
    s.enabled = !!$('#ipg_enabled').prop('checked');
    s.mode = String($('#ipg_mode').val() ?? 'external');

    s.workTitle = String($('#ipg_work_title').val() ?? '');
    s.canonMC = String($('#ipg_canon_mc').val() ?? '');
    s.keyNpcs = String($('#ipg_key_npcs').val() ?? '');
    s.canonNotes = String($('#ipg_canon_notes').val() ?? '');

    s.position = Number($('#ipg_position').val() ?? 1);
    s.depth = Number($('#ipg_depth').val() ?? 0);
    s.scanWi = !!$('#ipg_scan_wi').prop('checked');

    s.apiUrl = String($('#ipg_api_url').val() ?? '');
    s.apiKey = String($('#ipg_api_key').val() ?? '');
    s.apiHeaderName = String($('#ipg_api_header').val() ?? 'Authorization');
    s.apiKeyPrefix = String($('#ipg_api_prefix').val() ?? 'Bearer ');
    s.apiModel = String($('#ipg_api_model').val() ?? '');
    s.apiTemperature = Number($('#ipg_api_temp').val() ?? 0.2);
    s.apiMaxMessages = Number($('#ipg_api_maxmsg').val() ?? 10);
    s.apiTimeoutMs = Number($('#ipg_api_timeout').val() ?? 20000);
    s.includeSystem = !!$('#ipg_api_include_system').prop('checked');
    s.includeHidden = !!$('#ipg_api_include_hidden').prop('checked');

    Object.assign(ctx.extensionSettings[MODULE_NAME], s);
    ctx.saveSettingsDebounced?.();

    toggleModeUi();
    applyInjection(ctx, s);
  };

  // Bind listeners
  $('#ipg_enabled, #ipg_mode').on('change', persist);

  $('#ipg_work_title, #ipg_canon_mc, #ipg_key_npcs, #ipg_canon_notes')
    .on('input', persist);

  $('#ipg_position, #ipg_depth').on('change input', persist);
  $('#ipg_scan_wi').on('change', persist);

  $('#ipg_api_url, #ipg_api_key, #ipg_api_header, #ipg_api_prefix, #ipg_api_model')
    .on('input', persist);
  $('#ipg_api_temp, #ipg_api_maxmsg, #ipg_api_timeout').on('change input', persist);
  $('#ipg_api_include_system, #ipg_api_include_hidden').on('change', persist);

  $('#ipg_apply_now').on('click', () => {
    persist();
    toastr?.success?.('设置已应用（后续生效）');
  });

  $('#ipg_test_now').on('click', async () => {
    persist();
    try {
      toastr?.info?.('正在调用外部 API 生成剧情指引…');
      await appendGuideToLastAssistantMessage(ctx, s);
      toastr?.success?.('已追加剧情指引块（若没看到，请检查 API 返回 / CORS）');
    } catch (e) {
      console.error(e);
      toastr?.error?.(`外部 API 调用失败：${e?.message || e}`);
    }
  });

  $('#ipg_clear_now').on('click', () => {
    s.enabled = false;
    $('#ipg_enabled').prop('checked', false);
    Object.assign(ctx.extensionSettings[MODULE_NAME], s);
    ctx.saveSettingsDebounced?.();
    toggleModeUi();
    applyInjection(ctx, s);
    toastr?.info?.('已禁用剧情指引');
  });

  toggleModeUi();
}

jQuery(async () => {
  const ctx = getContextSafe();
  if (!ctx) return;

  const s = loadSettings(ctx);

  // Apply inject settings (clears injection when not in inject mode)
  applyInjection(ctx, s);

  const { eventSource } = ctx;
  const event_types = getEventTypes(ctx);

  // External mode hook: append before UI render (MESSAGE_RECEIVED fires before render). 
  // Docs: MESSAGE_RECEIVED is emitted when the LLM message is generated and recorded but not yet rendered. citeturn3view1
  if (eventSource?.on && event_types?.MESSAGE_RECEIVED) {
    eventSource.on(event_types.MESSAGE_RECEIVED, async () => {
      try {
        if (!s.enabled) return;
        if (s.mode !== 'external') return;
        await appendGuideToLastAssistantMessage(ctx, s);
      } catch (e) {
        console.error('Infinite Plot Guide external API failed:', e);
      }
    });
  }

  // Ensure injection keeps in sync on chat switches
  if (eventSource?.on && event_types?.CHAT_CHANGED) {
    eventSource.on(event_types.CHAT_CHANGED, () => applyInjection(ctx, s));
  }

  try {
    await mountSettingsUI(ctx, s);
  } catch (e) {
    console.error('Infinite Plot Guide: failed to mount settings UI', e);
  }
});
