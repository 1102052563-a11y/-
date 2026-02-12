'use strict';

/**
 * 剧情指导 StoryGuide (SillyTavern UI Extension)
 * v0.9.8
 *
 * 新增：输出模块自定义（更高自由度�?
 * - 你可以自定义“输出模块列表”以及每个模块自己的提示词（prompt�?
 * - 面板提供一个「模块配�?JSON)」编辑区：可增删字段、改顺序、改提示词、控制是否在面板/自动追加中展�?
 * - 插件会根据模块自动生�?JSON Schema（动态字段）并要求模型按�?Schema 输出
 *
 * 兼容：仍然保�?v0.3.x 的“独立API走后端代�?+ 抗变量更新覆盖（自动补贴�? 点击折叠”能�?
 *
 * v0.8.2 修复：兼�?SlashCommand 返回 [object Object] 的情况（自动解析 UID / 文本输出�?
 * v0.8.3 新增：总结功能支持自定义提示词（system + user 模板，支持占位符�?
 * v0.8.6 修复：写入世界书不再依赖 JS 解析 UID（改为在同一�?STscript 管线内用 {{pipe}} 传�?UID），避免误报“无法解�?UID”�?
 * v0.9.0 修复：实时读取蓝灯世界书在部�?ST 版本返回包装字段（如 data �?JSON 字符串）时解析为 0 条的问题；并增强读取端点/文件名兼容�?
 * v0.9.1 新增：蓝灯索引→绿灯触发 的“索引日志”（显示命中条目名称/注入关键词），便于排查触发效果�?
 * v0.9.2 修复：条目标题前缀（comment）现在始终加在最前（即使模型输出了自定义 title 也会保留前缀）�?
 * v0.9.4 新增：总结写入世界书的“主要关键词(key)”可切换为“索引编号”（�?A-001），只写 1 个触发词，触发更精确�?
 * v0.9.5 改进：蓝灯索引匹配会综合“最�?N 条消息正�?+ 本次用户输入”，而不是只看最近正文（可在面板里关�?调整权重）�?
 * v0.9.6 改进：在面板标题处显示版本号，方便确认是否已正确更新到包含“用户输入权重”设置的版本�?
 * v0.9.9 改进：把“剧情指�?/ 总结设置 / 索引设置”拆成三页（左侧分页标签），界面更清晰�?
 * v0.9.8 新增：手动选择总结楼层范围（例�?20-40）并点击立即总结�?
 * v0.10.0 新增：手动楼层范围总结支持“按�?N 层拆分生成多条世界书条目”（例如 1-80 �?N=40 �?2 条）�?
 */

const SG_VERSION = '0.10.0';

const MODULE_NAME = 'storyguide';
const EXT_BASE_URL = (() => {
  const src = document.currentScript?.src || '';
  if (!src) return '';
  return src.slice(0, src.lastIndexOf('/') + 1);
})();


/**
 * 模块配置格式（JSON 数组）示例：
 * [
 *   {"key":"world_summary","title":"世界简�?,"type":"text","prompt":"1~3句概括世界与局�?,"required":true,"panel":true,"inline":true},
 *   {"key":"key_plot_points","title":"重要剧情�?,"type":"list","prompt":"3~8条关键剧情点（短句）","maxItems":8,"required":true,"panel":true,"inline":false}
 * ]
 *
 * 字段说明�?
 * - key: JSON 输出字段名（唯一�?
 * - title: 渲染到报告的标题
 * - type: "text" �?"list"（list = string[]�?
 * - prompt: 该模块的生成提示词（会写�?Output Fields�?
 * - required: 是否强制要求该字段输�?
 * - panel: 是否在“报告”里展示
 * - inline: 是否在“自动追加分析框”里展示
 * - maxItems: type=list 时限制最大条目（可选）
 */

const DEFAULT_MODULES = Object.freeze([
  { key: 'world_summary', title: '世界简�?, type: 'text', prompt: '1~3句概括世界与局�?, required: true, panel: true, inline: true, static: true },
  { key: 'key_plot_points', title: '重要剧情�?, type: 'list', prompt: '3~8条关键剧情点（短句）', maxItems: 8, required: true, panel: true, inline: false, static: true },
  { key: 'current_scene', title: '当前时间�?· 具体剧情', type: 'text', prompt: '描述当前发生了什么（地点/人物动机/冲突/悬念�?, required: true, panel: true, inline: true },
  { key: 'next_events', title: '后续将会发生的事', type: 'list', prompt: '接下来最可能发生的事（条目）', maxItems: 6, required: true, panel: true, inline: true },
  { key: 'protagonist_impact', title: '主角行为造成的影�?, type: 'text', prompt: '主角行为对剧�?关系/风险造成的改�?, required: true, panel: true, inline: false },
  { key: 'tips', title: '给主角的提示（基于原著后�?大纲�?, type: 'list', prompt: '给出可执行提示（尽量具体�?, maxItems: 4, required: true, panel: true, inline: true },
  { key: 'quick_actions', title: '快捷选项', type: 'list', prompt: '根据当前剧情走向，给�?~6个玩家可以发送的具体行动选项（每�?5~40字，可直接作为对话输入发送）', maxItems: 6, required: true, panel: true, inline: true },
]);

// ===== 总结提示词默认值（可在面板中自定义�?=====
const DEFAULT_SUMMARY_SYSTEM_PROMPT = `你是一个“剧情总结/世界书记忆”助手。\n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n任务：\n1) 阅读用户与AI对话片段，生成一段简洁摘要（中文�?50~400字，尽量包含：主要人�?目标/冲突/关键物品/地点/关系变化/未解决的悬念）。\n2) 提取 6~14 个关键词（中文优先，人物/地点/势力/物品/事件/关系等），用于世界书条目触发词。关键词尽量去重、不要太泛（如“然后”“好的”）。`;

const DEFAULT_SUMMARY_USER_TEMPLATE = `【楼层范围】{{fromFloor}}-{{toFloor}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【对话片段】\n{{chunk}}`;

const DEFAULT_MEGA_SUMMARY_SYSTEM_PROMPT = `你是一个“剧情大总结”助手�?

任务�?
1) 阅读多条剧情总结，输出一段更高层级的归纳（中文，200~600字，强调阶段性进�?主线变化/关键转折）�?
2) 提取 8~16 个关键词（人�?地点/势力/事件/关系等），用于世界书条目触发词�?
3) 只输�?JSON。`;
const DEFAULT_MEGA_SUMMARY_USER_TEMPLATE = `【待汇总条目】\n{{items}}`;

const DEFAULT_SEX_GUIDE_SYSTEM_PROMPT = `你是一个“性爱指导”助手，基于给定的剧情上下文与设定，提供成熟、尊重、强调自愿与安全的行动建议与注意事项�?

要求�?
1) 先确认双方意愿与边界，再给出具体且可执行的动�?节奏建议�?
2) 注意氛围营造、沟通与情绪反馈，避免粗暴与不适�?
3) 给出 3~6 条建议，语言直接但不必低俗�?
4) 若上下文不足，先提出澄清问题或保守建议。`;

const DEFAULT_SEX_GUIDE_USER_TEMPLATE = `【上下文】\n{{snapshot}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【性爱指导世界书】\n{{worldbook}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【用户需求】\n{{userNeed}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【用户输入】\n{{lastUser}}`;

// 无论用户怎么自定义提示词，仍会强制追�?JSON 输出结构要求，避免写入世界书失败
const SUMMARY_JSON_REQUIREMENT = `输出要求：\n- 只输出严�?JSON，不�?Markdown、不要代码块、不要任何多余文字。\n- JSON 结构必须为：{"title": string, "summary": string, "keywords": string[]}。\n- keywords �?6~14 个词/短语，尽量去重、避免泛词。`;


// ===== 索引提示词默认值（可在面板中自定义；用�?LLM 综合判断"模式�?=====
const DEFAULT_INDEX_SYSTEM_PROMPT = `你是一�?剧情索引匹配"助手�?

【任务�?
- 输入包含：最近剧情正文（节选）、用户当前输入、以及蓝灯世界书的全部候选条目（含名�?摘要/触发�?类型）�?
- 你的目标是：综合判断哪些候选条目与"当前剧情"最相关，并返回这些候选的名称�?

【选择优先级�?
1. **人物相关**：当前剧情涉及某个NPC时，优先索引该NPC的档案条�?
2. **装备相关**：当前剧情涉及某件装备时，优先索引该装备的条�?
3. **历史剧情**：优先选择时间较久远但与当前剧情相关的条目（避免索引最近已在上下文中的剧情�?
4. **因果关联**：当前事件的前因、伏笔、未解悬�?

【避免�?
- 不要选择刚刚发生的剧情（最�?层以内的内容通常已在上下文中�?
- 避免选择明显无关或过于泛泛的条目

【返回要求�?
- 返回条目数量�?<= maxPick
- 分类控制：人�?<= maxCharacters，装�?<= maxEquipments，势�?<= maxFactions，成�?<= maxAchievements，副职业 <= maxSubProfessions，任�?<= maxQuests，剧�?<= maxPlot`;

const DEFAULT_INDEX_USER_TEMPLATE = `【用户当前输入�?
{{userMessage}}

【最近剧情（节选）�?
{{recentText}}

【候选索引条目（JSON，来自蓝灯世界书全部条目）�?
{{candidates}}

【选择限制�?
- 总数不超�?{{maxPick}} �?
- 人物条目不超�?{{maxCharacters}} �?
- 装备条目不超�?{{maxEquipments}} �?
- 势力条目不超�?{{maxFactions}} �?
- 成就条目不超�?{{maxAchievements}} �?
- 副职业条目不超过 {{maxSubProfessions}} �?
- 任务条目不超�?{{maxQuests}} �?
- 剧情条目不超�?{{maxPlot}} �?

请从候选中选出与当前剧情最相关的条目，优先选择：与当前提到的人�?装备相关的条目、时间较久远的相关剧情。仅输出 JSON。`;

const INDEX_JSON_REQUIREMENT = `输出要求�?
- 只输出严�?JSON，不�?Markdown、不要代码块、不要任何多余文字�?
- JSON 结构必须为：{"pickedNames": string[]}�?
- pickedNames 必须是候选列表里�?name（即世界书条目名称，例如：[mvu_plot]成就｜弑星者｜ACH-001）�?
- 返回�?pickedNames 数量 <= maxPick。`;


// ===== 结构化世界书条目提示词默认�?=====
const DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT = `你是一�?剧情记忆管理"助手，负责从对话片段中提取结构化信息用于长期记忆�?

【任务�?
1. 识别本次对话中出现的重要 NPC（不含主角）
2. 识别主角当前持有/装备的关键物�?
3. 识别主角物品栏内的重要道�?材料/消耗品（含数量与状态）
4. 识别剧情中出�?变化的重要势�?
5. 识别剧情中的成就记录
6. 识别主角的副职业变化
7. 识别当前或新增的任务记录
8. 识别主角征服的女性角色（猎艳录）
9. 识别需要删除的条目（死亡的角色、卖�?分解的装备等�?
9. 生成档案式的客观第三人称描述

【筛选标准�?
- NPC：只记录有名有姓的角色，忽略杂兵、无名NPC、普通敌�?
- 装备：只记录绿色品质以上的装备，或紫色品质以上的重要物品
- 物品栏：记录与剧情有关的关键道具/材料/消耗品（避免过度琐碎）

【去重规则（重要）�?
- 仔细检查【已知人物列表】、【已知装备列表】、【已知物品栏列表】、【已知势力列表】、【已知成就列表】、【已知副职业列表】、【已知任务列表】、【已知猎艳录列表】，避免重复创建条目
- 同一角色可能有多种写法（如繁�?简体、英�?中文翻译），必须识别为同一�?
- 如果发现角色已存在于列表中，使用 isUpdated=true 更新而不是创建新条目
- 将不同名称写法添加到 aliases 数组�?

【删除条目规则�?
- 若角色在对话中明确死�?永久离开，将其加�?deletedCharacters 数组
- 若装备被卖掉/分解/丢弃/彻底损坏，将其加�?deletedEquipments 数组
- 若物品被消�?丢弃/转移且不再持有，将其加入 deletedInventories 数组
- 若势力解�?覆灭/被吞并，将其加入 deletedFactions 数组
- 若成就被撤销/失效，将其加�?deletedAchievements 数组
- 若副职业被放�?失去，将其加�?deletedSubProfessions 数组
- 若任务完�?失败/取消，将其加�?deletedQuests 数组
- 若猎艳录角色关系破裂/离开，将其加�?deletedConquests 数组

【重要�?
- 若提供了 statData，请从中提取该角�?物品�?*关键数�?*（如属性、等级、状态），精简�?-2�?
- 不要完整复制 statData，只提取最重要的信�?
- 重点描述：与主角的关系发展、角色背景、性格特点、关键事�?

【性格铆钉�?
- 为每个重要NPC提取「核心性格」：不会因剧情发展而轻易改变的根本特质
- 提取「角色动机」：该角色自己的目标/追求，不是围绕主角转
- 评估「关系阶段」：陌生/初识/熟悉/信任/亲密，关系发展应循序渐进`;
const LEGACY_STRUCTURED_ENTRIES_USER_TEMPLATE_V1 = `【楼层范围】{{fromFloor}}-{{toFloor}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【对话片段】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{chunk}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知人物列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownCharacters}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知装备列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownEquipments}}`;
const LEGACY_STRUCTURED_ENTRIES_USER_TEMPLATE_V2 = `【楼层范围】{{fromFloor}}-{{toFloor}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【对话片段】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{chunk}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知人物列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownCharacters}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知装备列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownEquipments}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知势力列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownFactions}}`;
const DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE = `【楼层范围】{{fromFloor}}-{{toFloor}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【对话片段】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{chunk}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知人物列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownCharacters}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知装备列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownEquipments}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知物品栏列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownInventories}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知势力列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownFactions}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知成就列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownAchievements}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知副职业列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownSubProfessions}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知任务列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownQuests}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【已知猎艳录列表】\        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{knownConquests}}`;
const DEFAULT_STRUCTURED_CHARACTER_ENTRY_TEMPLATE = `【人物】{{name}}
别名：{{aliases}}
阵营/身份：{{faction}}
状态：{{status}}
性格：{{personality}}
背景：{{background}}
六维属性：{{sixStats}}
装备：{{equipment}}
技�?天赋：{{skillsTalents}}
物品栏：{{inventory}}
性生活（仅女性）：{{sexLife}}
【核心性格锚点】{{corePersonality}}
【角色动机】{{motivation}}
【关系阶段】{{relationshipStage}}
与主角关系：{{relationToProtagonist}}
关键事件：{{keyEvents}}
{{extraFields}}`;

const DEFAULT_STRUCTURED_EQUIPMENT_ENTRY_TEMPLATE = `【装备】{{name}}
类型：{{type}}
稀有度：{{rarity}}
效果：{{effects}}
来源：{{source}}
当前状态：{{currentState}}
数值信息：{{statInfo}}
绑定事件：{{boundEvents}}
{{extraFields}}`;

const DEFAULT_STRUCTURED_INVENTORY_ENTRY_TEMPLATE = `【物品】{{name}}
别名：{{aliases}}
类型：{{type}}
稀有度：{{rarity}}
数量：{{quantity}}
效果：{{effects}}
来源：{{source}}
当前状态：{{currentState}}
数值信息：{{statInfo}}
绑定事件：{{boundEvents}}
{{extraFields}}`;

const DEFAULT_STRUCTURED_FACTION_ENTRY_TEMPLATE = `【势力】{{name}}
别名：{{aliases}}
性质：{{type}}
范围：{{scope}}
领导者：{{leader}}
理念：{{ideology}}
与主角关系：{{relationToProtagonist}}
状态：{{status}}
关键事件：{{keyEvents}}
数值信息：{{statInfo}}
{{extraFields}}`;

const DEFAULT_STRUCTURED_ACHIEVEMENT_ENTRY_TEMPLATE = `【成就】{{name}}
描述：{{description}}
达成条件：{{requirements}}
获得时间：{{obtainedAt}}
状态：{{status}}
影响：{{effects}}
关键事件：{{keyEvents}}
数值信息：{{statInfo}}
{{extraFields}}`;

const DEFAULT_STRUCTURED_SUBPROFESSION_ENTRY_TEMPLATE = `【副职业】{{name}}
定位：{{role}}
等级：{{level}}
进度：{{progress}}
核心技能：{{skills}}
获得方式：{{source}}
状态：{{status}}
关键事件：{{keyEvents}}
数值信息：{{statInfo}}
{{extraFields}}`;

const DEFAULT_STRUCTURED_QUEST_ENTRY_TEMPLATE = `【任务】{{name}}
目标：{{goal}}
发布者：{{issuer}}
进度：{{progress}}
奖励：{{reward}}
期限：{{deadline}}
地点：{{location}}
状态：{{status}}
关键事件：{{keyEvents}}
数值信息：{{statInfo}}
{{extraFields}}`;
const DEFAULT_STRUCTURED_CHARACTER_PROMPT = `只记录有名有姓的重要NPC（不含主角），忽略杂兵、无名敌人、路人�?

【必填字段】阵营身份、性格特点、背景故事、与主角关系及发展、关键事件、六维属性、技�?天赋、当前装备、物品栏
【仅女性字段】性生活（仅女性时填写 sexLife，非女性留空）

【性格铆钉字段（重要）�?
- corePersonality：核心性格锚点，不会轻易改变的根本特质（如"傲慢"�?多疑"�?重义"），即使与主角关系改善也会保�?
- motivation：角色自己的独立目标/动机，不应为了主角而放�?
- relationshipStage：与主角的关系阶段（陌生/初识/熟悉/信任/亲密），关系不应跳跃式发�?

若角色死�?永久离开，将其名字加�?deletedCharacters。若�?statData，请用于补全六维属�?装备/技�?物品栏。信息不足写"待确�?。`;
const DEFAULT_STRUCTURED_EQUIPMENT_PROMPT = `只记录绿色品质以上的装备，或紫色品质以上的重要物品（忽略白色/灰色普通物品）。必须记录：获得时间、获得地点、来源（掉落/购买/锻�?奖励等）、当前状态。若有强�?升级，描述主角如何培养这件装备。若装备被卖�?分解/丢弃/损坏，将其名字加�?deletedEquipments。若�?statData，精简总结其属性。`;
const DEFAULT_STRUCTURED_INVENTORY_PROMPT = `记录主角物品栏中的重要道�?材料/消耗品（避免过度琐碎）。必须记录：数量、来源、当前状�?用途。若物品被消�?丢弃/转移且不再持有，将其名字加入 deletedInventories。若�?statData，精简总结其属性。`;
const DEFAULT_STRUCTURED_FACTION_PROMPT = `记录重要势力/组织/阵营。说明性质、范围、领导者、理念、与主角关系、当前状态。若势力解散/覆灭/被吞并，将其名字加入 deletedFactions。若�?statData，精简总结其数值。`;
const DEFAULT_STRUCTURED_ACHIEVEMENT_PROMPT = `记录主角获得的成就。说明达成条件、影响、获得时间与当前状态。若成就被撤销/失效，将其名字加�?deletedAchievements。若�?statData，精简总结其数值。`;
const DEFAULT_STRUCTURED_SUBPROFESSION_PROMPT = `记录主角的副职业/第二职业。说明定位、等�?进度、核心技能、获得方式、当前状态。若副职业被放弃/失去，将其名字加�?deletedSubProfessions。若�?statData，精简总结其数值。`;
const DEFAULT_STRUCTURED_QUEST_PROMPT = `记录任务/委托。说明目标、发布者、进度、奖励、期�?地点。若任务完成/失败/取消，将其名字加�?deletedQuests。若�?statData，精简总结其数值。`;
const DEFAULT_STRUCTURED_CONQUEST_ENTRY_TEMPLATE = `【猎艳录】{{name}}
别名：{{aliases}}
身份：{{identity}}
初遇：{{firstEncounter}}
征服过程：{{conquestProcess}}
征服时间：{{conquestTime}}
当前关系：{{currentRelation}}
特殊技巧：{{specialTechniques}}
身体特征：{{bodyFeatures}}
状态：{{status}}
关键事件：{{keyEvents}}
数值信息：{{statInfo}}
{{extraFields}}`;
const DEFAULT_STRUCTURED_CONQUEST_PROMPT = `记录主角征服/攻略的女性角色。说明身份背景、初遇情境、征服过程、征服时间、当前关系状态、特殊技�?喜好、身体特征。若关系破裂/角色离开，将其名字加�?deletedConquests。若�?statData，精简总结其数值。`;

// ===== 平行世界（NPC离屏模拟）默认提示词 =====
const DEFAULT_PARALLEL_WORLD_SYSTEM_PROMPT = `你是一�?平行世界模拟�?，负责推演主角视角之外的NPC离屏活动以及势力/组织的动态变化�?

【核心任务�?
1. 为每个被追踪的NPC生成 1~3 件离屏事件（在主角不在场时发生的事）
2. 为每个被追踪的势�?组织生成 1~2 件势力事件（势力扩张、冲突、联盟、资源变动等�?
3. 事件必须符合角色/势力的特点和当前处境
4. NPC之间、势力之间可以产生互动（合作、冲突、交易、对话等�?
5. 推进世界时钟，反映时间流�?

【推演原则�?
- NPC有自己的生活和目标，不应始终围绕主角
- 势力有自己的议程和内部动�?
- 事件应有合理的因果关系，不能凭空出现
- 重大变化应循序渐�?
- 保持世界的内在一致�?

【事件类型参考�?
NPC: 日常活动、目标推进、意外遭遇、关系变化、情�?状态变�?
势力: 领地扩张/收缩、资源采�?消耗、内部政治变动、外交结�?对立、战�?冲突、经济活�?

【输出要求�?
- 只输出严�?JSON，不�?Markdown 代码�?
- 每个NPC/势力的事件应简洁但有意义（每件�?1~2 句话�?
- impact 说明此事件的具体影响`;

const DEFAULT_PARALLEL_WORLD_USER_TEMPLATE = `【世界时钟】{{worldTime}}

【最近剧情上下文�?
{{recentContext}}

【被追踪的NPC档案�?
{{npcProfiles}}

【被追踪的势�?组织�?
{{factionProfiles}}

请为以上每个NPC和势力推演离屏事件，推进世界时钟。`;

const PARALLEL_WORLD_JSON_REQUIREMENT = `输出要求�?
- 只输出严�?JSON，不�?Markdown、不要代码块、不要任何多余文字�?
- JSON 结构必须为：
{
  "worldTime": "更新后的世界时间（如：第3�?傍晚�?,
  "npcUpdates": [
    {
      "name": "NPC名称",
      "location": "当前位置",
      "mood": "当前情绪/状�?,
      "currentGoal": "当前目标",
      "events": [
        { "time": "事件时间", "event": "事件描述", "impact": "对NPC的影�? }
      ]
    }
  ],
  "factionUpdates": [
    {
      "name": "势力/组织名称",
      "events": [
        { "time": "事件时间", "event": "事件描述", "impact": "对势力的影响" }
      ]
    }
  ]
}
- npcUpdates 数组中每�?NPC 对应一个对象，events �?1~3 件离屏事件�?
- factionUpdates 数组中每个势力对应一个对象，events �?1~2 件势力事件�?
- 如果没有被追踪的势力，factionUpdates 可为空数组。`;

const STRUCTURED_ENTRIES_JSON_REQUIREMENT = `输出要求：只输出严格 JSON�?
对于【已知条目】（已出现在已知列表中）：你只需要输出有变化或新增的字段，未变内容无需输出。对于【新条目】：必须输出完整字段�?
statInfo 只填关键数值的精简总结�?-2行）。人物条目请使用 sixStats/skillsTalents 等字段，不输�?statInfo�?

结构：{"characters":[...],"equipments":[...],"inventories":[...],"factions":[...],"achievements":[...],"subProfessions":[...],"quests":[...],"conquests":[...],"deletedCharacters":[...],"deletedEquipments":[...],"deletedInventories":[...],"deletedFactions":[...],"deletedAchievements":[...],"deletedSubProfessions":[...],"deletedQuests":[...],"deletedConquests":[...]}

characters 条目结构：{name,uid,aliases[],gender,faction,status,personality,corePersonality:"核心性格锚点（不轻易改变�?,motivation:"角色独立动机/目标",relationshipStage:"陌生|初识|熟悉|信任|亲密",background,relationToProtagonist,keyEvents[],sixStats,equipment,skillsTalents,inventory,sexLife(仅女�?,isNew,isUpdated}

equipments 条目结构：{name,uid,type,rarity,effects,source,currentState,statInfo,boundEvents[],isNew}

inventories 条目结构：{name,uid,aliases[],type,rarity,quantity,effects,source,currentState,statInfo,boundEvents[],isNew,isUpdated}

factions 条目结构：{name,uid,aliases[],type,scope,leader,ideology,relationToProtagonist,status,keyEvents[],statInfo,isNew,isUpdated}

achievements 条目结构：{name,uid,description,requirements,obtainedAt,status,effects,keyEvents[],statInfo,isNew,isUpdated}

subProfessions 条目结构：{name,uid,role,level,progress,skills,source,status,keyEvents[],statInfo,isNew,isUpdated}

quests 条目结构：{name,uid,goal,progress,status,issuer,reward,deadline,location,keyEvents[],statInfo,isNew,isUpdated}

conquests 条目结构：{name,uid,aliases[],identity,firstEncounter,conquestProcess,conquestTime,currentRelation,specialTechniques,bodyFeatures,status,keyEvents[],statInfo,isNew,isUpdated}`;

// ===== ROLL 判定默认配置 =====
const DEFAULT_ROLL_ACTIONS = Object.freeze([
  { key: 'combat', label: '战斗', keywords: ['战斗', '攻击', '出手', '挥剑', '射击', '格挡', '闪避', '搏斗', '�?, '杀', '�?, 'fight', 'attack', 'strike'] },
  { key: 'persuade', label: '劝说', keywords: ['劝说', '说服', '谈判', '交涉', '威胁', '恐吓', '欺骗', 'persuade', 'negotiate', 'intimidate', 'deceive'] },
  { key: 'learn', label: '学习', keywords: ['学习', '修炼', '练习', '研究', '掌握', '学会', '技�?, 'learn', 'train', 'practice'] },
]);
const DEFAULT_ROLL_FORMULAS = Object.freeze({
  combat: '(PC.str + PC.dex + PC.atk + MOD.total + CTX.bonus + CTX.penalty) / 4',
  persuade: '(PC.cha + PC.int + MOD.total) / 3',
  learn: '(PC.int + PC.wis + MOD.total) / 3',
  default: 'MOD.total',
});
const DEFAULT_ROLL_MODIFIER_SOURCES = Object.freeze(['skill', 'talent', 'trait', 'buff', 'equipment']);
const DEFAULT_ROLL_SYSTEM_PROMPT = `你是一个专业的TRPG/ROLL点裁判�?

【任务�?
- 根据用户行为与属性数�?(statDataJson) 进行动作判定�?
- 难度模式 difficulty：simple (简�? / normal (普�? / hard (困难) / hell (地狱)�?
- 设定 成功阈�?DC (Difficulty Class)�?
  - normal: DC 15~20
  - hard: DC 20~25
  - hell: DC 25~30
  - 成功判定基于 margin (final - threshold)�?
    - margin >= 8 : critical_success (大成�?
    - margin 0 ~ 7 : success (成功)
    - margin -1 ~ -7 : failure (失败)
    - margin <= -8 : fumble (大失�?

【数值映射建议�?
- 将文本描述的等级转化为数值修�?(MOD)�?
  - F=0, E=+0.5, D=+1, C=+2, B=+3, A=+4, S=+6, SS=+8, SSS=+10
  - 若为数�?(�?Lv.5)，则直接取�?(�?+5)�?
- 品级修正：若装备/技能有稀有度划分，可参考上述映射给予额外加值�?
- Buff/Debuff：根据上下文给予 +/- 1~5 的临时调整�?

【D20 规则参考�?
- 核心公式：d20 + 属性修�?+ 熟练�?+ 其他修正 >= DC
- randomRoll (1~100) 换算�?d20 = ceil(randomRoll / 5)�?
- 大成�?大失败：
  - d20 = 20 (�?randomRoll 96~100) 视为“大成功�?不论数值，除非 DC 极高)�?
  - d20 = 1 (�?randomRoll 1~5) 视为“大失败”�?

【计算流程�?
1. 确定 action (动作类型) �?formula (计算公式)�?
2. 计算 base (基础�? �?mods (所有修正来源之�?�?
3. 计算 final = base + mods + 随机要素�?
4. 比较 final �?threshold，得�?success (true/false) �?outcomeTier�?

【输出要求�?
- 必须输出符合 JSON Requirement �?JSON 格式�?
- explanation: 简短描述判定过程与结果 (1~2�?�?
- analysisSummary: 汇总修正来源与关键映射逻辑�?
`;

const DEFAULT_ROLL_USER_TEMPLATE = `动作={{action}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n公式={{formula}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;nrandomWeight={{randomWeight}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;ndifficulty={{difficulty}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;nrandomRoll={{randomRoll}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;nmodifierSources={{modifierSourcesJson}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;nstatDataJson={{statDataJson}}`;
const ROLL_JSON_REQUIREMENT = `输出要求（严�?JSON）：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{"action": string, "formula": string, "base": number, "mods": [{"source": string, "value": number}], "random": {"roll": number, "weight": number}, "final": number, "threshold": number, "success": boolean, "outcomeTier": string, "explanation": string, "analysisSummary"?: string}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n- analysisSummary 可选，用于日志显示，建议包含“修正来源汇�?映射应用”两段；explanation 建议 1~2 句。`;
const ROLL_DECISION_JSON_REQUIREMENT = `输出要求（严�?JSON）：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n- 若无需判定：只输出 {"needRoll": false}。\n- 若需要判定：输出 {"needRoll": true, "result": {action, formula, base, mods, random, final, threshold, success, outcomeTier, explanation, analysisSummary?}}。\n- 不要 Markdown、不要代码块、不要任何多余文字。`;

const DEFAULT_ROLL_DECISION_SYSTEM_PROMPT = `你是一个判定动作是否需要ROLL点的辅助AI�?

【任务�?
- 核心任务是判断用户的行为是否需要进行随机性判�?(ROLL)�?
- 只有当行为具有不确定性、挑战性或对抗性时才需�?ROLL�?
- �?needRoll=true，则同时进行判定计算�?

【判定原�?(needRoll)�?
- needRoll = false: 
  - 日常行为 (吃饭/走路/闲聊)�?
  - 必定成功的行�?(没有干扰/难度极低)�?
  - 纯粹的情感表达或心理活动�?
- needRoll = true:
  - 战斗/攻击/防御�?
  - 尝试说服/欺骗/恐吓他人�?
  - 具有风险或难度的动作 (撬锁/攀�?潜行)�?
  - 知识检�?感知检�?(发现隐藏线索)�?

【若 needRoll=true，计算参考�?
- 难度模式 difficulty �?成功阈�?DC (simple/normal/hard/hell)�?
- 数值映射建议：F=0, E=+0.5, D=+1, C=+2, B=+3, A=+4, S=+6, SS=+8, SSS=+10�?
- 品级修正：参考装�?技能品级�?
- margin 判定�?=8 大成功，0~7 成功�?1~-7 失败�?=-8 大失败�?

【输出要求�?
- 若无需判定：{"needRoll": false}
- 若需要判定：{"needRoll": true, "result": { ...完整计算过程... }}
- 严格遵循 JSON Requirement 格式，不要输�?Markdown 代码块�?
`;

const DEFAULT_ROLL_DECISION_USER_TEMPLATE = `用户输入={{userText}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;nrandomWeight={{randomWeight}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;ndifficulty={{difficulty}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;nrandomRoll={{randomRoll}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;nstatDataJson={{statDataJson}}`;

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,

  // 输入截取
  maxMessages: 40,
  maxCharsPerMessage: 1600,
  includeUser: true,
  includeAssistant: true,

  // 生成控制（仍保留剧透与 temperature；更多风格可通过自定�?system/constraints 做）
  spoilerLevel: 'mild', // none | mild | full
  temperature: 0.4,

  // 自动刷新（面板报告）
  autoRefresh: false,
  autoRefreshOn: 'received', // received | sent | both
  debounceMs: 1200,

  // 自动追加到正文末�?
  autoAppendBox: true,
  appendMode: 'compact', // compact | standard
  appendDebounceMs: 700,

  // 追加框展示哪些模�?
  inlineModulesSource: 'inline', // inline | panel | all
  inlineShowEmpty: false,        // 是否显示空字段占�?

  // provider
  provider: 'st', // st | custom

  // custom API（建议填“API基础URL”，�?https://api.openai.com/v1 �?
  customEndpoint: '',
  customApiKey: '',
  customModel: 'gpt-4o-mini',
  customModelsCache: [],
  customTopP: 0.95,
  customMaxTokens: 8192,
  customStream: false,

  // 预设导入/导出
  presetIncludeApiKey: false,
  imageGenPresetList: '[]',
  imageGenPresetActive: '',


  // 世界书（World Info/Lorebook）导入与注入
  worldbookEnabled: false,
  worldbookMode: 'active', // active | all
  worldbookMaxChars: 6000,
  worldbookWindowMessages: 18,
  worldbookJson: '',

  // ===== 性爱指导模块 =====
  sexGuideEnabled: false,
  sexGuideProvider: 'st', // st | custom
  sexGuideTemperature: 0.6,
  sexGuideSystemPrompt: DEFAULT_SEX_GUIDE_SYSTEM_PROMPT,
  sexGuideUserTemplate: DEFAULT_SEX_GUIDE_USER_TEMPLATE,
  sexGuideIncludeUserInput: true,
  sexGuideCustomEndpoint: '',
  sexGuideCustomApiKey: '',
  sexGuideCustomModel: 'gpt-4o-mini',
  sexGuideCustomModelsCache: [],
  sexGuideCustomMaxTokens: 2048,
  sexGuideCustomTopP: 0.95,
  sexGuideCustomStream: false,
  sexGuideWorldbookEnabled: true,
  sexGuideWorldbookMaxChars: 6000,
  sexGuideWorldbooks: [],
  sexGuideUserNeed: '',
  sexGuidePresetList: '[]',
  sexGuidePresetActive: '',

  // ===== 总结功能（独立于剧情提示�?API 设置�?=====
  summaryEnabled: false,
  // 多少“楼层”总结一次（楼层统计方式�?summaryCountMode�?
  summaryEvery: 20,
  // 手动楼层范围总结：是否按“每 N 层”拆分生成多条（N=summaryEvery�?
  summaryManualSplit: false,
  // assistant: 仅统�?AI 回复；all: 统计全部消息（用�?AI�?
  summaryCountMode: 'assistant',
  // 自动总结时，默认只总结“上次总结之后新增”的内容；首次则总结最�?summaryEvery �?
  summaryMaxCharsPerMessage: 4000,
  summaryMaxTotalChars: 24000,

  // 是否读取 stat_data 变量作为总结上下文（类似 roll 点模块）
  summaryReadStatData: false,
  summaryStatVarName: 'stat_data',

  // 结构化条目频率（按楼层计数）
  structuredEntriesEvery: 1,
  // 结构化条目读取楼层（最多读取最�?N 层）
  structuredEntriesReadFloors: 1,
  structuredEntriesCountMode: 'assistant',
  // 结构化条目读取蓝灯世界书（与索引设置一致）
  structuredWorldbookEnabled: false,
  structuredWorldbookMode: 'active', // active | all
  // 结构化条目内容格�?
  structuredEntryContentFormat: 'markdown', // text | markdown
  // Character entry template (optional)
  structuredCharacterEntryTemplate: '',
  structuredEquipmentEntryTemplate: '',
  structuredInventoryEntryTemplate: '',
  structuredFactionEntryTemplate: '',
  structuredAchievementEntryTemplate: '',
  structuredSubProfessionEntryTemplate: '',
  structuredQuestEntryTemplate: '',
  structuredConquestEntryTemplate: '',

  // 总结调用方式：st=走酒馆当前已连接�?LLM；custom=独立 OpenAI 兼容 API
  summaryProvider: 'st',
  summaryTemperature: 0.4,

  // ===== 大总结 =====
  megaSummaryEnabled: false,
  megaSummaryEvery: 40,
  megaSummarySystemPrompt: '',
  megaSummaryUserTemplate: '',
  megaSummaryCommentPrefix: '大总结',
  megaSummaryIndexPrefix: 'R-',
  megaSummaryIndexPad: 3,
  megaSummaryIndexStart: 1,

  // 自定义总结提示词（可选）
  // - system：决定总结风格/重点
  // - userTemplate：决定如何把楼层范围/对话片段塞给模型（支持占位符�?
  summarySystemPrompt: DEFAULT_SUMMARY_SYSTEM_PROMPT,
  summaryUserTemplate: DEFAULT_SUMMARY_USER_TEMPLATE,
  summaryCustomEndpoint: '',
  summaryCustomApiKey: '',
  summaryCustomModel: 'gpt-4o-mini',
  summaryCustomModelsCache: [],
  // 缓存世界书文件列表（来自 ST 后端，用于下拉选择�?
  summaryWorldInfoFilesCache: [],
  summaryCustomMaxTokens: 2048,
  summaryCustomStream: false,

  // 总结结果写入世界书（Lorebook / World Info�?
  // —�?绿灯世界书（关键词触发）—�?
  summaryToWorldInfo: true,
  // 写入指定世界书文件名
  summaryWorldInfoTarget: 'file',
  summaryWorldInfoFile: '',
  summaryWorldInfoCommentPrefix: '剧情总结',

  // 总结写入世界�?key（触发词）的来源
  // - keywords: 使用模型输出�?keywords（默认）
  // - indexId: 使用自动生成的索引编号（�?A-001），只写 1 个触发词，触发更精确
  summaryWorldInfoKeyMode: 'keywords',
  // �?keyMode=indexId 时：索引编号格式
  summaryIndexPrefix: 'A-',
  summaryIndexPad: 3,
  summaryIndexStart: 1,
  // 是否把索引编号写入条目标题（comment），便于世界书列表定�?
  summaryIndexInComment: true,

  // —�?蓝灯世界书（常开索引：给本插件做检索用）—�?
  // 注意：蓝灯世界书建议写入“指定世界书文件名”，因为 chatbook 通常只有一个�?
  summaryToBlueWorldInfo: true,
  summaryBlueWorldInfoFile: '',
  summaryBlueWorldInfoCommentPrefix: '剧情总结',
  summaryAutoRollback: false,
  structuredAutoRollback: false,

  // —�?蓝灯索引 �?绿灯触发 —�?
  wiTriggerEnabled: false,

  // 匹配方式：local=本地相似度；llm=LLM 综合判断（可自定义提示词 & 独立 API�?
  wiTriggerMatchMode: 'local',

  // —�?索引 LLM（独立于总结 API 的第二套配置）—�?
  wiIndexProvider: 'st',         // st | custom
  wiIndexTemperature: 0.2,
  wiIndexTopP: 0.95,
  wiIndexSystemPrompt: DEFAULT_INDEX_SYSTEM_PROMPT,
  wiIndexUserTemplate: DEFAULT_INDEX_USER_TEMPLATE,

  // LLM 模式：先用本地相似度预筛�?TopK，再交给模型综合判断（更�?tokens�?
  wiIndexPrefilterTopK: 24,
  // 每条候选摘要截断字符（控制 tokens�?
  wiIndexCandidateMaxChars: 420,

  // 索引独立 OpenAI 兼容 API
  wiIndexCustomEndpoint: '',
  wiIndexCustomApiKey: '',
  wiIndexCustomModel: 'gpt-4o-mini',
  wiIndexCustomModelsCache: [],
  wiIndexCustomMaxTokens: 1024,
  wiIndexCustomStream: false,

  // 在用户发送消息前（MESSAGE_SENT）读取“最�?N 条消息正文”（不含当前条），从蓝灯索引里挑相关条目�?
  wiTriggerLookbackMessages: 20,
  // 是否把“本次用户输入”纳入索引匹配（综合判断）�?
  wiTriggerIncludeUserMessage: true,
  // 本次用户输入在相似度向量中的权重（越大越看重用户输入�?=与最近正文同权重�?
  wiTriggerUserMessageWeight: 1.6,
  // 至少已有 N �?AI 回复（楼层）才开始索引触发；0=立即
  wiTriggerStartAfterAssistantMessages: 0,
  // 最多选择多少�?summary 条目来触�?
  wiTriggerMaxEntries: 4,
  // 分类最大索引数
  wiTriggerMaxCharacters: 2, // 最多索引多少个人物条目
  wiTriggerMaxEquipments: 2, // 最多索引多少个装备条目
  wiTriggerMaxFactions: 2,
  wiTriggerMaxAchievements: 2,
  wiTriggerMaxSubProfessions: 2,
  wiTriggerMaxQuests: 2,
  wiTriggerMaxPlot: 3,       // 最多索引多少个剧情条目（优先较久远的）
  // 相关度阈值（0~1，越大越严格�?
  wiTriggerMinScore: 0.08,
  // 最多注入多少个触发词（去重后）
  wiTriggerMaxKeywords: 24,
  // 注入模式：appendToUser = 追加到用户消息末�?
  wiTriggerInjectMode: 'appendToUser',
  // 注入样式：hidden=HTML 注释隐藏；plain=直接文本（更稳）
  wiTriggerInjectStyle: 'hidden',
  wiTriggerTag: 'SG_WI_TRIGGERS',
  wiTriggerDebugLog: false,

  // ROLL 判定（本回合行动判定�?
  wiRollEnabled: false,
  wiRollStatSource: 'variable', // variable (综合多来�? | template | latest
  wiRollStatVarName: 'stat_data',
  wiRollRandomWeight: 0.3,
  wiRollDifficulty: 'normal',
  wiRollInjectStyle: 'hidden',
  wiRollTag: 'SG_ROLL',
  wiRollDebugLog: false,
  wiRollStatParseMode: 'json', // json | kv
  wiRollProvider: 'custom', // custom | local
  wiRollSystemPrompt: DEFAULT_ROLL_SYSTEM_PROMPT,
  wiRollCustomEndpoint: '',
  wiRollCustomApiKey: '',
  wiRollCustomModel: 'gpt-4o-mini',
  wiRollCustomMaxTokens: 512,
  wiRollCustomTopP: 0.95,
  wiRollCustomTemperature: 0.2,
  wiRollCustomStream: false,

  // 蓝灯索引读取方式：默认“实时读取蓝灯世界书文件�?
  // - live：每次触发前会按需拉取蓝灯世界书（带缓�?节流�?
  // - cache：只使用导入/缓存�?summaryBlueIndex
  wiBlueIndexMode: 'live',
  // 读取蓝灯索引时使用的世界书文件名；留空则回退使用 summaryBlueWorldInfoFile
  wiBlueIndexFile: '',
  // 实时读取的最小刷新间隔（秒），防止每条消息都请求一�?
  wiBlueIndexMinRefreshSec: 20,

  // 蓝灯索引缓存（可选：用于检索；每条�?{title, summary, keywords, range?}�?
  summaryBlueIndex: [],

  // 模块自定义（JSON 字符�?+ 解析备份�?
  modulesJson: '',
  // 额外可自定义提示词“骨架�?
  customSystemPreamble: '',     // 附加在默�?system 之后
  customConstraints: '',        // 附加在默�?constraints 之后

  // ===== 结构化世界书条目（人�?装备/物品�?势力/成就/副职�?任务�?=====
  structuredEntriesEnabled: true,
  characterEntriesEnabled: true,
  equipmentEntriesEnabled: true,
  inventoryEntriesEnabled: false,
  factionEntriesEnabled: false, // 默认关闭
  structuredReenableEntriesEnabled: false,
  achievementEntriesEnabled: false,
  subProfessionEntriesEnabled: false,
  questEntriesEnabled: false,
  conquestEntriesEnabled: false,
  characterEntryPrefix: '人物',
  equipmentEntryPrefix: '装备',
  inventoryEntryPrefix: '物品�?,
  factionEntryPrefix: '势力',
  achievementEntryPrefix: '成就',
  subProfessionEntryPrefix: '副职�?,
  questEntryPrefix: '任务',
  conquestEntryPrefix: '猎艳�?,
  structuredEntriesSystemPrompt: '',
  structuredEntriesUserTemplate: '',
  structuredPresetList: '[]',
  structuredPresetActive: '',
  structuredCharacterPrompt: '',
  structuredEquipmentPrompt: '',
  structuredInventoryPrompt: '',
  structuredFactionPrompt: '',
  structuredAchievementPrompt: '',
  structuredSubProfessionPrompt: '',
  structuredQuestPrompt: '',
  structuredConquestPrompt: '',

  // ===== 快捷选项功能 =====
  quickOptionsEnabled: true,
  quickOptionsShowIn: 'inline', // inline | panel | both
  // 预设默认选项（JSON 字符串）: [{label, prompt}]
  quickOptionsJson: JSON.stringify([
    { label: '继续', prompt: '继续当前剧情发展' },
    { label: '详述', prompt: '请更详细地描述当前场�? },
    { label: '对话', prompt: '让角色之间展开更多对话' },
    { label: '行动', prompt: '描述接下来的具体行动' },
  ], null, 2),

  // ===== 地图功能 =====
  mapEnabled: false,
  mapAutoUpdate: true,
  mapSystemPrompt: `从对话中提取地点信息，并尽量还原空间关系�?
  1. 识别当前主角所在的地点名称
  2. 识别提及的新地点
  3. 判断地点之间的连接关系（哪些地点相邻/可通行，方向感如：�?�?�?�?楼上/楼下�?
  4. 记录该地点发生的重要事件（事件用一句话，包含触发条�?影响�?
  5. 若文本明确提到相对位�?楼层/方位，请给出 row/col（网格坐标）或相邻关�?
  6. 在原著世界观下，结合谷歌搜索的原著资料补充“待探索地点”，并为每个地点写明可能触发的任�?简�?
  7. 待探索地点数量不超过 6 个，避免与已有地点重复；若对话中地点较少，至少补�?2 个待探索地点
  8. 若无法给�?row/col，至少给�?connectedTo 或方位词
  9. 没有明确依据时用“待确认”描述，不要乱猜
  10. 必须输出 currentLocation/newLocations/events 三个字段，数组可为空但字段必须存在；newLocations 总数不少�?3（含待探索地点）
  11. 为地点补充分�?图层信息：group（室�?室内/楼层区域等），layer（如“一�?二层/地下”）
  12. 事件允许附带 tags（如：战�?任务/对话/解谜/探索），每个事件 1~3 个标�?
  13. 避免同义地点重复：输出前先合并同义词（如 豪宅/宅邸/府邸/公馆；学�?学院/学校；城�?要塞/王城；寺�?神殿/道观/教堂；洞�?洞窟；遗�?秘境�?
  14. 仅依据对�?设定/原著信息进行推断，不要引入无根据的信�?
  
  输出 JSON 格式�?
  {
    "currentLocation": "主角当前所在地�?,
    "newLocations": [
      { "name": "地点�?, "description": "简�?, "connectedTo": ["相邻地点1"], "row": 0, "col": 0, "group": "室外", "layer": "一�? }
    ],
    "events": [
      { "location": "地点�?, "event": "事件描述", "tags": ["任务"] }
    ]
  }`,

  // ===== 图像生成模块 =====
  imageGenEnabled: false,
  novelaiApiKey: '',
  novelaiModel: 'nai-diffusion-4-5-full', // V4.5 Full | V4 Full | V4 Curated | V3
  novelaiResolution: '832x1216', // 默认立绘尺寸
  novelaiSteps: 28,
  novelaiScale: 5,
  novelaiSampler: 'k_euler',
  novelaiFixedSeedEnabled: false,
  novelaiFixedSeed: 0,
  novelaiLegacy: true,
  novelaiCfgRescale: 0,
  novelaiNoiseSchedule: 'native',
  novelaiVarietyBoost: false,
  novelaiNegativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',

  imageGenAutoSave: false,
  imageGenSavePath: '',
  imageGenLookbackMessages: 5,
  imageGenReadStatData: false,
  imageGenStatVarName: 'stat_data',
  imageGenLlmProvider: 'custom', // custom
  imageGenCustomEndpoint: '',
  imageGenCustomApiKey: '',
  imageGenCustomModel: 'gpt-4o-mini',
  imageGenCustomMaxTokens: 1024,

  imageGenSystemPrompt: `你是专业�?AI 绘画提示词生成器。根据提供的故事内容，分析场景或角色，只输出 Novel AI 可用�?Danbooru 标签�?

目标：尽可能完整地还原正文中出现的角�?场景细节，让标签更丰富、更具体�?

要求�?
1. 仅输出英文标签，逗号分隔；不要解释、不要额外文�?
2. positive / negative 字段必须是标签串（只�?Novel AI 看）
3. 标签要“多且具体”，优先补齐以下信息�?
   - 角色：发�?瞳色/发型/发长、体型、年龄段、肤色、表情、动作、姿势、服装材�?风格/配饰、鞋袜、武�?道具
   - 场景：地点类型、建�?室内外、时�?白天/夜晚/黄昏)、天气、光�?光影、氛围、主色调、构图视�?镜头距离
4. 若正文信息不足，使用常见合理标签补全（如 light rays, depth of field, cinematic lighting），但不要臆造关键设�?
5. 标签按重要性排序，重要的放前面；避免重�?
6. 如果是角色，�?"1girl" �?"1boy" 等人数标签开�?
7. 如果是场景，以场景类型标签开头（�?scenery, landscape, indoor�?
8. 输出严格 JSON，不�?Markdown、不要代码块

输出格式�?
{
  "type": "character" �?"scene",
  "subject": "简短中文描述生成对象（如：黑发少女战斗姿态）",
  "positive": "1girl, long black hair, red eyes, ...",
  "negative": "额外的负面标签（可选，留空则使用默认）"
}`,
  imageGenArtistPromptEnabled: true,
  imageGenArtistPrompt: '5::masterpiece, best quality ::, 3.65::3D, realistic, photorealistic ::,2.25::Artist:bm94199 ::,1.85::Artist:yueko (jiayue wu) ::,1.35::Artist:ruanjia ::,1.35::Artist:wo_jiushi_kanbudong ::,1.05::artist:seven_(sixplusone) ::,1.05::Artist:slash (slash-soft) ::,0.85::Artist:shal.e ::,0.75::Artist:nixeu ::,0.55::Artist:billyhhyb ::,-5::2D ::,-1::vivid::, year2025, cinematic , 0.9::lighting, volumetric lighting, no text, realistic, photo, real, artbook ::, 0.2::monochrome ::, 1.2::small eyes ::, 0.8::clean, normal ::,',
  imageGenPromptRulesEnabled: false,
  imageGenPromptRules: '',
  imageGenCharacterProfilesEnabled: false,
  imageGenCharacterProfiles: [],
  imageGenProfilesExpanded: false,
  imageGenBatchEnabled: true,
  imageGenBatchPatterns: JSON.stringify([
    { label: '剧情-1', type: 'story', detail: '正文第一段的代表性画�? },
    { label: '剧情-2', type: 'story', detail: '正文第二段的代表性画�? },
    { label: '剧情-3', type: 'story', detail: '正文第三段的代表性画�? },
    { label: '剧情-4', type: 'story', detail: '正文第四段的代表性画�? },
    { label: '剧情-5', type: 'story', detail: '正文第五段的代表性画�? },
    { label: '单人-近景', type: 'character_close', detail: '单人女性近景特写，强调脸部与表�? },
    { label: '单人-全身', type: 'character_full', detail: '单人女性全身立绘，展示服装与姿�? },
    { label: '双人', type: 'duo', detail: '双人同框互动，突出动作关系与情绪交流' },
    { label: '场景', type: 'scene', detail: '场景为主，强调空间、环境细节与氛围光影' },
    { label: '彩蛋', type: 'bonus', detail: '当前角色/场景做与剧情无关的轻松行为，自由发挥' },
    { label: '自定�?1', type: 'custom_female_1', detail: '使用自定义女性提示词 1' },
    { label: '自定�?2', type: 'custom_female_2', detail: '使用自定义女性提示词 2' }
  ], null, 2),



  // 在线图库设置
  imageGalleryEnabled: false,
  imageGalleryUrl: '',
  imageGalleryCache: [],
  imageGalleryCacheTime: 0,
  imageGalleryMatchPrompt: '你是图片选择助手。根据故事内容，从图库中选择最合适的图片。规则：1.优先匹配角色名称 2.其次匹配场景类型 3.再匹配情�?氛围。输出JSON：{"matchedId":"图片id","reason":"匹配原因"}',

  imageGenCharacterProfilesEnabled: false,
  imageGenCharacterProfiles: [],

  // ===== 自定义角色生�?=====
  characterProvider: 'st',
  characterTemperature: 0.7,
  characterCustomEndpoint: '',
  characterCustomApiKey: '',
  characterCustomModel: 'gpt-4o-mini',
  characterCustomMaxTokens: 2048,
  characterCustomStream: false,
  characterDifficulty: 30,
  characterPark: '',
  characterParkCustom: '',
  characterParkTraits: '',
  characterRace: '',
  characterRaceCustom: '',
  characterTalent: '',
  characterTalentCustom: '',
  characterContractId: '',
  characterAttributes: { con: 0, int: 0, cha: 0, str: 0, agi: 0, luk: 0 },

  // ===== 平行世界（NPC离屏模拟�?=====
  parallelWorldEnabled: false,
  parallelWorldAutoTrigger: false,
  parallelWorldAutoEvery: 5,
  parallelWorldProvider: 'st',
  parallelWorldTemperature: 0.7,
  parallelWorldCustomEndpoint: '',
  parallelWorldCustomApiKey: '',
  parallelWorldCustomModel: 'gpt-4o-mini',
  parallelWorldCustomModelsCache: [],
  parallelWorldCustomMaxTokens: 4096,
  parallelWorldCustomTopP: 0.95,
  parallelWorldCustomStream: false,
  parallelWorldSystemPrompt: DEFAULT_PARALLEL_WORLD_SYSTEM_PROMPT,
  parallelWorldUserTemplate: DEFAULT_PARALLEL_WORLD_USER_TEMPLATE,
  parallelWorldTrackedNpcs: [],
  parallelWorldTrackedFactions: [],
  parallelWorldClock: '�?�?,
  parallelWorldWriteToWorldbook: true,
  parallelWorldInjectContext: true,
  parallelWorldMaxEventsPerNpc: 10,
  parallelWorldReadFloors: 5,
  parallelWorldPresetList: '[]',
  parallelWorldPresetActive: '',

});

const META_KEYS = Object.freeze({
  canon: 'storyguide_canon_outline',
  world: 'storyguide_world_setup',
  summaryMeta: 'storyguide_summary_meta',
  staticModulesCache: 'storyguide_static_modules_cache',
  mapData: 'storyguide_map_data',
  parallelWorldData: 'storyguide_parallel_world_data',
});

const SG_SUMMARY_WI_FILE_KEY = 'storyguide_summary_worldinfo_file_v1';
const SG_SUMMARY_BLUE_WI_FILE_KEY = 'storyguide_summary_blue_worldinfo_file_v1';

let lastReport = null;
let lastJsonText = '';
let lastSummary = null; // { title, summary, keywords, ... }
let lastSummaryText = '';
let lastSexGuideText = '';
let refreshTimer = null;
let appendTimer = null;
let summaryTimer = null;
let structuredTimer = null;
let isSummarizing = false;
let isStructuring = false;
let summaryCancelled = false;
let summaryAbortController = null;
let structuredCancelled = false;
let structuredAbortController = null;
let sgToastTimer = null;

// 图像生成批次状态（悬浮面板�?
let imageGenBatchPrompts = [];
let imageGenBatchIndex = 0;
let imageGenImageUrls = [];
let imageGenPreviewIndex = 0;
let imageGenBatchStatus = '';
let imageGenBatchBusy = false;
let lastNovelaiPayload = null;
let imageGenPreviewExpanded = true;



// 蓝灯索引“实时读取”缓存（防止每条消息都请求一次）
let blueIndexLiveCache = { file: '', loadedAt: 0, entries: [], lastError: '' };
let structuredWorldbookLiveCache = { file: '', loadedAt: 0, mode: 'active', totalEntries: 0, usedEntries: 0, tokens: 0, text: '', lastError: '' };

// ============== 关键：DOM 追加缓存 & 观察者（抗重渲染�?==============
/**
 * inlineCache: Map<mesKey, { htmlInner: string, collapsed: boolean, createdAt: number }>
 * mesKey 优先�?DOM �?mesid（如果拿不到则用 chatIndex�?
 */
const inlineCache = new Map();
const panelCache = new Map(); // <mesKey, { htmlInner, collapsed, createdAt }>
let chatDomObserver = null;
let generationIdleTimer = null;
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

function readLocalStorageString(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? '' : String(raw);
  } catch {
    return '';
  }
}

function writeLocalStorageString(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ''));
  } catch { /* ignore */ }
}

function normalizeWorldInfoFileName(fileName) {
  const raw = String(fileName || '').trim();
  if (!raw) return '';
  return raw.endsWith('.json') ? raw.slice(0, -5) : raw;
}

function ensureMvuPlotPrefix(text) {
  const raw = String(text || '').trim();
  if (!raw) return '[mvu_plot]';
  return raw.startsWith('[mvu_plot]') ? raw : `[mvu_plot]${raw}`;
}

function resolveGreenWorldInfoTarget(settings) {
  const s = settings || ensureSettings();
  const file = normalizeWorldInfoFileName(s.summaryWorldInfoFile);
  if (file) return { target: 'file', file };
  return { target: 'file', file: '' };
}

function ensureSettings() {
  const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
  if (!extensionSettings[MODULE_NAME]) {
    extensionSettings[MODULE_NAME] = clone(DEFAULT_SETTINGS);
    // 初始写入默认 modulesJson
    extensionSettings[MODULE_NAME].modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);
    saveSettingsDebounced();
  } else {
    const hasStructuredReadFloors = Object.hasOwn(extensionSettings[MODULE_NAME], 'structuredEntriesReadFloors');
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (!Object.hasOwn(extensionSettings[MODULE_NAME], k)) extensionSettings[MODULE_NAME][k] = DEFAULT_SETTINGS[k];
    }
    if (!Array.isArray(extensionSettings[MODULE_NAME].sexGuideWorldbooks)) {
      extensionSettings[MODULE_NAME].sexGuideWorldbooks = [];
      saveSettingsDebounced();
    }
    if (!hasStructuredReadFloors) {
      extensionSettings[MODULE_NAME].structuredEntriesReadFloors = extensionSettings[MODULE_NAME].structuredEntriesEvery ?? DEFAULT_SETTINGS.structuredEntriesReadFloors;
      saveSettingsDebounced();
    }
    // 兼容旧版：若 modulesJson 为空，补默认
    if (!extensionSettings[MODULE_NAME].modulesJson) {
      extensionSettings[MODULE_NAME].modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);
    }
  }
  if (typeof extensionSettings[MODULE_NAME].wiRollSystemPrompt === 'string') {
    const cur = extensionSettings[MODULE_NAME].wiRollSystemPrompt;
    const hasMojibake = /        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;?{5,}/.test(cur);
    if (hasMojibake) {
      extensionSettings[MODULE_NAME].wiRollSystemPrompt = DEFAULT_ROLL_SYSTEM_PROMPT;
      saveSettingsDebounced();
    }
  }
  if (typeof extensionSettings[MODULE_NAME].wiRollUserTemplate === 'string') {
    const curTpl = extensionSettings[MODULE_NAME].wiRollUserTemplate;
    if (curTpl.includes('{{threshold}}')) {
      extensionSettings[MODULE_NAME].wiRollUserTemplate = DEFAULT_ROLL_USER_TEMPLATE;
      saveSettingsDebounced();
    }
  }
  // 迁移：删除了 chatbook 选项，强制使�?file 模式
  if (extensionSettings[MODULE_NAME].summaryWorldInfoTarget === 'chatbook') {
    extensionSettings[MODULE_NAME].summaryWorldInfoTarget = 'file';
    saveSettingsDebounced();
  }
  // 迁移：蓝灯世界书默认开�?
  if (extensionSettings[MODULE_NAME].summaryToBlueWorldInfo === false) {
    extensionSettings[MODULE_NAME].summaryToBlueWorldInfo = true;
    saveSettingsDebounced();
  }

  if (!String(extensionSettings[MODULE_NAME].summaryWorldInfoFile || '').trim()) {
    const storedGreen = readLocalStorageString(SG_SUMMARY_WI_FILE_KEY).trim();
    if (storedGreen) {
      extensionSettings[MODULE_NAME].summaryWorldInfoFile = normalizeWorldInfoFileName(storedGreen);
      saveSettingsDebounced();
    }
  }

  // 迁移：结构化条目从“能力”改为“势力�?
  let factionSettingsMigrated = false;
  if (extensionSettings[MODULE_NAME].factionEntriesEnabled === undefined && extensionSettings[MODULE_NAME].abilityEntriesEnabled !== undefined) {
    extensionSettings[MODULE_NAME].factionEntriesEnabled = extensionSettings[MODULE_NAME].abilityEntriesEnabled;
    factionSettingsMigrated = true;
  }
  if (extensionSettings[MODULE_NAME].factionEntryPrefix === undefined && extensionSettings[MODULE_NAME].abilityEntryPrefix) {
    extensionSettings[MODULE_NAME].factionEntryPrefix = extensionSettings[MODULE_NAME].abilityEntryPrefix;
    factionSettingsMigrated = true;
  }
  if (!extensionSettings[MODULE_NAME].structuredFactionPrompt && extensionSettings[MODULE_NAME].structuredAbilityPrompt) {
    extensionSettings[MODULE_NAME].structuredFactionPrompt = extensionSettings[MODULE_NAME].structuredAbilityPrompt;
    factionSettingsMigrated = true;
  }
  if (factionSettingsMigrated) saveSettingsDebounced();

  // 迁移：批量提示词模板更新（仅在仍为旧模板或为空时�?
  const batchRaw = String(extensionSettings[MODULE_NAME].imageGenBatchPatterns || '').trim();
  const isOldBatch = batchRaw && batchRaw.includes('单人-1') && !batchRaw.includes('单人-近景');
  if (!batchRaw || isOldBatch) {
    extensionSettings[MODULE_NAME].imageGenBatchPatterns = DEFAULT_SETTINGS.imageGenBatchPatterns;
    saveSettingsDebounced();
  }

  // 迁移：结构化提取模板补充更多条目列表
  const structuredTpl = String(extensionSettings[MODULE_NAME].structuredEntriesUserTemplate || '').trim();
  const isLegacyStructuredTpl = (
    !structuredTpl
    || structuredTpl === LEGACY_STRUCTURED_ENTRIES_USER_TEMPLATE_V1
    || structuredTpl === LEGACY_STRUCTURED_ENTRIES_USER_TEMPLATE_V2
  );
  if (isLegacyStructuredTpl) {
    extensionSettings[MODULE_NAME].structuredEntriesUserTemplate = DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE;
    saveSettingsDebounced();
  }

  return extensionSettings[MODULE_NAME];
}

function saveSettings() { SillyTavern.getContext().saveSettingsDebounced(); }

// 导出全局预设
function exportPreset() {
  const s = ensureSettings();
  const preset = {
    _type: 'StoryGuide_Preset',
    _version: '1.0',
    _exportedAt: new Date().toISOString(),
    settings: { ...s }
  };
  // 移除敏感信息（API Key�?
  delete preset.settings.customApiKey;
  delete preset.settings.summaryCustomApiKey;
  delete preset.settings.wiIndexCustomApiKey;
  delete preset.settings.wiRollCustomApiKey;
  delete preset.settings.sexGuideCustomApiKey;
  // 移除缓存数据
  delete preset.settings.customModelsCache;
  delete preset.settings.summaryCustomModelsCache;
  delete preset.settings.summaryWorldInfoFilesCache;
  delete preset.settings.wiIndexCustomModelsCache;
  delete preset.settings.wiRollCustomModelsCache;
  delete preset.settings.sexGuideCustomModelsCache;

  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `StoryGuide_Preset_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('预设已导�?�?, { kind: 'ok' });
}

// 导入全局预设
async function importPreset(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const preset = JSON.parse(text);

    // 验证格式
    if (preset._type !== 'StoryGuide_Preset') {
      showToast('无效的预设文件格�?, { kind: 'err' });
      return;
    }

    if (!preset.settings || typeof preset.settings !== 'object') {
      showToast('预设文件内容无效', { kind: 'err' });
      return;
    }

    // 获取当前设置并保留敏感信�?
    const currentSettings = ensureSettings();
    const preservedKeys = [
      'customApiKey', 'summaryCustomApiKey', 'wiIndexCustomApiKey', 'wiRollCustomApiKey',
      'customModelsCache', 'summaryCustomModelsCache', 'wiIndexCustomModelsCache', 'wiRollCustomModelsCache',
      'sexGuideCustomApiKey', 'sexGuideCustomModelsCache'
    ];

    // 合并设置（保留敏感信息）
    const newSettings = { ...preset.settings };
    for (const key of preservedKeys) {
      if (currentSettings[key]) {
        newSettings[key] = currentSettings[key];
      }
    }

    // 应用新设�?
    const { extensionSettings } = SillyTavern.getContext();
    Object.assign(extensionSettings[MODULE_NAME], newSettings);
    saveSettings();

    // 刷新 UI
    pullSettingsToUi();

    showToast(`预设已导�?✅\n版本: ${preset._version || '未知'}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n导出时间: ${preset._exportedAt || '未知'}`, { kind: 'ok', duration: 3000 });
  } catch (e) {
    console.error('[StoryGuide] Import preset failed:', e);
    showToast(`导入失败: ${e.message}`, { kind: 'err' });
  }
}

function stripHtml(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]*>/g, '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n').trim();
}

function escapeHtml(input) {
  const s = String(input ?? '');
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
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

// 简易模板替换：支持 {{fromFloor}} / {{toFloor}} / {{chunk}} 等占位符
function renderTemplate(tpl, vars = {}) {
  const str = String(tpl ?? '');
  return str.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*([a-zA-Z0-9_]+)        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/g, (_, k) => {
    const v = vars?.[k];
    return v == null ? '' : String(v);
  });
}

function safeJsonParse(maybeJson) {
  if (!maybeJson) return null;
  let t = String(maybeJson).trim();
  t = t.replace(/^```(?: json) ? /i, '').replace(/```$/i, '').trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  try { return JSON.parse(t); } catch { return null; }
}

function parseJsonArrayAttr(maybeJsonArray) {
  if (!maybeJsonArray) return [];
  const t = String(maybeJsonArray || '').trim();
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function applyPromptRules(text, rulesText) {
  const input = String(text || '');
  const raw = String(rulesText || '').trim();
  if (!raw) return input;

  const lines = raw.split(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;r?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
  if (!lines.length) return input;

  let output = input;
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const trigger = line.slice(0, eq).trim();
    const rest = line.slice(eq + 1).trim();
    if (!trigger || !rest) continue;

    const pipe = rest.indexOf('|');
    const action = pipe === -1 ? 'replace' : rest.slice(0, pipe).trim();
    const payload = pipe === -1 ? rest : rest.slice(pipe + 1).trim();
    if (!payload) continue;

    const escapedTrigger = trigger.replace(/[.*+?^${}()|[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;$&');
    const re = new RegExp(escapedTrigger, 'gi');

    if (action === '前置�?) {
      output = output.replace(re, (match) => `${payload}, ${match}`);
    } else if (action === '前置�?) {
      output = output.replace(re, (match) => `${match}, ${payload}`);
    } else if (action === '后置�?) {
      output = output.replace(re, (match) => `${payload}, ${match}`);
    } else if (action === '后置�?) {
      output = output.replace(re, (match) => `${match}, ${payload}`);
    } else if (action === '最后置' || action === '末尾') {
      if (re.test(output)) output = `${output}, ${payload}`;
    } else if (action === '替换') {
      output = output.replace(re, payload);
    } else {
      output = output.replace(re, payload);
    }
  }

  return output;
}


function normalizeMapName(name) {
  let out = String(name || '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, ' ').trim();
  // common CN place variants (reduce duplicates like "豪宅/宅邸/府邸/公馆")
  out = out.replace(/(家|�?(豪宅|宅邸|府邸|公馆|别墅|庄园|大宅|府|宅|宅子)$/g, '宅邸');
  out = out.replace(/(豪宅|府邸|公馆|别墅|庄园|大宅|府|宅|宅子)$/g, '宅邸');
  out = out.replace(/宅邸$/g, '宅邸');
  // broader suffix normalization
  const rules = [
    [/学校$/g, '学校'],
    [/学园$/g, '学校'],
    [/学院$/g, '学校'],
    [/大学$/g, '学校'],
    [/大桥$/g, '�?],
    [/桥梁$/g, '�?],
    [/�?/g, '�?],
    [/大道$/g, '�?],
    [/大街$/g, '�?],
    [/街道$/g, '�?],
    [/�?/g, '�?],
    [/商业街区$/g, '商业�?],
    [/商业�?/g, '商业�?],
    [/步行�?/g, '商业�?],
    [/购物中心$/g, '商场'],
    [/商城$/g, '商场'],
    [/商场$/g, '商场'],
    [/商业�?/g, '商业�?],
    [/广场$/g, '广场'],
    [/公园$/g, '公园'],
    [/园区$/g, '公园'],
    [/体育�?/g, '体育�?],
    [/运动�?/g, '体育�?],
    [/体育中心$/g, '体育�?],
    [/图书�?/g, '图书�?],
    [/阅览�?/g, '图书�?],
    [/医院$/g, '医院'],
    [/诊所$/g, '医院'],
    [/车站$/g, '车站'],
    [/站点$/g, '车站'],
    [/地铁�?/g, '地铁�?],
    [/地铁�?/g, '地铁�?],
    [/机场$/g, '机场'],
    [/港口$/g, '港口'],
    [/码头$/g, '港口'],
    [/旅馆$/g, '旅馆'],
    [/酒店$/g, '旅馆'],
    [/宾馆$/g, '旅馆'],
    [/大厦$/g, '大楼'],
    [/大楼$/g, '大楼'],
    [/楼宇$/g, '大楼'],
    [/楼栋$/g, '大楼'],
    [/中心$/g, '中心'],
    [/森林$/g, '森林'],
    [/林地$/g, '森林'],
    [/树林$/g, '森林'],
    [/山脉$/g, '�?],
    [/高地$/g, '�?],
    [/河流$/g, '�?],
    [/�?/g, '�?],
    [/湖泊$/g, '�?],
    [/�?/g, '�?],
    [/海岸$/g, '海边'],
    [/海滩$/g, '海边'],
    [/海边$/g, '海边'],
    [/地下�?/g, '地下'],
    [/地底$/g, '地下'],
    [/地下$/g, '地下'],
    // fantasy/setting-specific systems
    [/宫殿$/g, '城堡'],
    [/王城$/g, '城堡'],
    [/城堡$/g, '城堡'],
    [/要塞$/g, '城堡'],
    [/城邦$/g, '城堡'],
    [/堡垒$/g, '城堡'],
    [/神殿$/g, '寺庙'],
    [/寺庙$/g, '寺庙'],
    [/道观$/g, '寺庙'],
    [/教堂$/g, '寺庙'],
    [/大教�?/g, '寺庙'],
    [/修道�?/g, '寺庙'],
    [/洞穴$/g, '洞穴'],
    [/洞窟$/g, '洞穴'],
    [/遗迹$/g, '遗迹'],
    [/秘境$/g, '遗迹'],
    [/秘境之门$/g, '遗迹'],
    [/遗址$/g, '遗迹'],
    [/门派$/g, '宗门'],
    [/宗门$/g, '宗门'],
    [/帮会$/g, '宗门'],
    [/门派驻地$/g, '宗门'],
    [/宗门驻地$/g, '宗门'],
  ];
  for (const [re, rep] of rules) out = out.replace(re, rep);
  return out.toLowerCase();
}

let sgMapPopoverEl = null;
let sgMapPopoverHost = null;
let sgMapEventHandlerBound = false;

function isMapAutoUpdateEnabled(s) {
  const v = s?.mapAutoUpdate;
  if (v === undefined || v === null) return true;
  if (v === false) return false;
  if (typeof v === 'string') return !['false', '0', 'off', 'no'].includes(v.toLowerCase());
  if (typeof v === 'number') return v !== 0;
  return Boolean(v);
}

function bindMapEventPanelHandler() {
  if (sgMapEventHandlerBound) return;
  sgMapEventHandlerBound = true;

  $(document).on('click', '.sg-map-location', (e) => {
    const $cell = $(e.currentTarget);
    const $wrap = $cell.closest('.sg-map-wrapper');
    let $panel = $wrap.find('.sg-map-event-panel');
    if (!$panel.length) {
      $wrap.append('<div class="sg-map-event-panel"></div>');
      $panel = $wrap.find('.sg-map-event-panel');
    }

    const name = String($cell.attr('data-name') || '').trim();
    const desc = String($cell.attr('data-desc') || '').trim();
    const group = String($cell.attr('data-group') || '').trim();
    const layer = String($cell.attr('data-layer') || '').trim();
    const events = parseJsonArrayAttr($cell.attr('data-events'));

    const headerBits = [];
    if (name) headerBits.push(`<span class= "sg-map-event-title" > ${escapeHtml(name)}</span> `);
    if (layer) headerBits.push(`<span class= "sg-map-event-chip" > ${escapeHtml(layer)}</span> `);
    if (group) headerBits.push(`<span class= "sg-map-event-chip" > ${escapeHtml(group)}</span> `);
    const header = headerBits.length ? `<div class= "sg-map-event-header" > ${headerBits.join('')}</div> ` : '';
    const descHtml = desc ? `<div class= "sg-map-event-desc" > ${escapeHtml(desc)}</div> ` : '';

    let listHtml = '';
    if (events.length) {
      const items = events.map((ev) => {
        const text = escapeHtml(String(ev?.text || ev?.event || ev || '').trim());
        const tags = Array.isArray(ev?.tags) ? ev.tags : [];
        const tagsHtml = tags.length
          ? `<span class= "sg-map-event-tags" > ${tags.map(t => `<span class="sg-map-event-tag">${escapeHtml(String(t || ''))}</span>`).join('')}</span> `
          : '';
        return `<li > <span class="sg-map-event-text">${text || '（无内容�?}</span>${tagsHtml}</li> `;
      }).join('');
      listHtml = `<ul class= "sg-map-event-list" > ${items}</ul> `;
    } else {
      listHtml = '<div class="sg-map-event-empty">暂无事件</div>';
    }

    const deleteBtn = name
      ? `<button class= "sg-map-event-delete" data-name="${escapeHtml(name)}" > 删除地点</button> `
      : '';
    $panel.html(`${header}${descHtml}${listHtml}${deleteBtn}`);
    $panel.addClass('sg-map-event-panel--floating');
  });

  $(document).on('click', '.sg-map-wrapper', (e) => {
    if ($(e.target).closest('.sg-map-location, .sg-map-event-panel').length) return;
    const $wrap = $(e.currentTarget);
    $wrap.find('.sg-map-event-panel').remove();
  });

  $(document).on('click', '.sg-map-event-delete', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = String($(e.currentTarget).attr('data-name') || '').trim();
    if (!name) return;
    try {
      const map = getMapData();
      const key = map.locations?.[name] ? name : (normalizeMapName(name) ? Array.from(Object.keys(map.locations || {})).find(k => normalizeMapName(k) === normalizeMapName(name)) : null);
      if (key && map.locations && map.locations[key]) {
        delete map.locations[key];
      }
      for (const loc of Object.values(map.locations || {})) {
        if (!Array.isArray(loc.connections)) continue;
        loc.connections = loc.connections.filter(c => normalizeMapName(c) !== normalizeMapName(name));
      }
      if (map.protagonistLocation && normalizeMapName(map.protagonistLocation) === normalizeMapName(name)) {
        map.protagonistLocation = '';
      }
      await setMapData(map);
      updateMapPreview();
    } catch (err) {
      console.warn('[StoryGuide] delete map location failed:', err);
    }
  });
}

function showMapPopover($cell) {
  const name = String($cell.attr('data-name') || '').trim();
  const desc = String($cell.attr('data-desc') || '').trim();
  const events = parseJsonArrayAttr($cell.attr('data-events'));

  const parts = [];
  if (name) parts.push(`<div class= "sg-map-popover-title" > ${escapeHtml(name)}</div> `);
  if (desc) parts.push(`<div class= "sg-map-popover-desc" > ${escapeHtml(desc)}</div> `);
  if (events.length) {
    const items = events.map(e => `<li > ${escapeHtml(String(e || ''))}</li> `).join('');
    parts.push(`<div class="sg-map-popover-events" ><div class="sg-map-popover-label">事件</div><ul>${items}</ul></div> `);
  } else {
    parts.push('<div class="sg-map-popover-empty">暂无事件</div>');
  }

  const $panelHost = $cell.closest('#sg_floating_panel, .sg-modal');
  const usePanel = $panelHost.length > 0;
  const hostEl = usePanel ? $panelHost[0] : document.body;

  if (!sgMapPopoverEl || sgMapPopoverHost !== hostEl) {
    if (sgMapPopoverEl && sgMapPopoverEl.parentElement) {
      sgMapPopoverEl.parentElement.removeChild(sgMapPopoverEl);
    }
    sgMapPopoverEl = document.createElement('div');
    sgMapPopoverEl.className = usePanel ? 'sg-map-popover sg-map-popover-inpanel' : 'sg-map-popover';
    hostEl.appendChild(sgMapPopoverEl);
    sgMapPopoverHost = hostEl;
  } else {
    sgMapPopoverEl.className = usePanel ? 'sg-map-popover sg-map-popover-inpanel' : 'sg-map-popover';
  }

  sgMapPopoverEl.innerHTML = parts.join('');

  const rect = $cell[0].getBoundingClientRect();
  const pop = sgMapPopoverEl;
  pop.style.display = 'block';
  pop.style.visibility = 'hidden';

  const popRect = pop.getBoundingClientRect();
  if (usePanel) {
    const hostRect = hostEl.getBoundingClientRect();
    let left = rect.left - hostRect.left + rect.width / 2 - popRect.width / 2;
    let top = rect.top - hostRect.top - popRect.height - 8;
    if (top < 8) top = rect.bottom - hostRect.top + 8;
    const maxLeft = hostEl.clientWidth - popRect.width - 8;
    const maxTop = hostEl.clientHeight - popRect.height - 8;
    if (left < 8) left = 8;
    if (left > maxLeft) left = maxLeft;
    if (top < 8) top = 8;
    if (top > maxTop) top = maxTop;
    pop.style.left = `${Math.round(left)} px`;
    pop.style.top = `${Math.round(top)} px`;
  } else {
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    let top = rect.top - popRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
    pop.style.left = `${Math.round(left)} px`;
    pop.style.top = `${Math.round(top)} px`;
  }

  pop.style.visibility = 'visible';
}

// ===== 快捷选项功能 =====

function getQuickOptions() {
  const s = ensureSettings();
  if (!s.quickOptionsEnabled) return [];

  const raw = String(s.quickOptionsJson || '').trim();
  if (!raw) return [];

  try {
    let arr = JSON.parse(raw);
    // 支持 [[label, prompt], ...] �?[{label, prompt}, ...] 两种格式
    if (!Array.isArray(arr)) return [];
    return arr.map((item, i) => {
      if (Array.isArray(item)) {
        return { label: String(item[0] || `选项${i + 1} `), prompt: String(item[1] || '') };
      }
      if (item && typeof item === 'object') {
        return { label: String(item.label || `选项${i + 1} `), prompt: String(item.prompt || '') };
      }
      return null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function injectToUserInput(text) {
  // 尝试多种可能的输入框选择�?
  const selectors = ['#send_textarea', 'textarea#send_textarea', '.send_textarea', 'textarea.send_textarea'];
  let textarea = null;

  for (const sel of selectors) {
    textarea = document.querySelector(sel);
    if (textarea) break;
  }

  if (!textarea) {
    console.warn('[StoryGuide] 未找到聊天输入框');
    return false;
  }

  // 设置文本�?
  textarea.value = String(text || '');

  // 触发 input 事件以通知 SillyTavern
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // 聚焦输入�?
  textarea.focus();

  // 将光标移到末�?
  if (textarea.setSelectionRange) {
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  return true;
}

function renderQuickOptionsHtml(context = 'inline') {
  const s = ensureSettings();
  if (!s.quickOptionsEnabled) return '';

  const showIn = String(s.quickOptionsShowIn || 'inline');
  // 检查当前上下文是否应该显示
  if (showIn !== 'both' && showIn !== context) return '';

  const options = getQuickOptions();
  if (!options.length) return '';

  const buttons = options.map((opt, i) => {
    const label = escapeHtml(opt.label || `选项${i + 1} `);
    const prompt = escapeHtml(opt.prompt || '');
    return `<button class="sg-quick-option" data-sg-prompt="${prompt}" title="${prompt}">${label}</button>`;
  }).join('');

  return `<div class="sg-quick-options" > ${buttons}</div> `;
}

// 渲染AI生成的动态快捷选项（从分析结果的quick_actions数组生成按钮，直接显示选项内容�?
function renderDynamicQuickActionsHtml(quickActions, context = 'inline') {
  const s = ensureSettings();

  // 如果没有动态选项，返回空
  if (!Array.isArray(quickActions) || !quickActions.length) {
    return '';
  }

  const buttons = quickActions.map((action, i) => {
    const text = String(action || '').trim();
    if (!text) return '';

    // 移除可能的编号前缀�?"�?�? �?"1."
    const cleaned = text.replace(/^【\d+】\s*/, '').replace(/^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;.        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;)        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;:：]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*/, '').trim();
    if (!cleaned) return '';

    const escapedText = escapeHtml(cleaned);
    // 按钮直接显示完整选项内容，点击后输入到聊天框
    return `<button class="sg-quick-option sg-dynamic-option" data-sg-prompt="${escapedText}" title="点击输入到聊天框">${escapedText}</button>`;
  }).filter(Boolean).join('');

  if (!buttons) return '';

  return `<div class="sg-quick-options sg-dynamic-options" >
  <div class="sg-quick-options-title">💡 快捷选项（点击输入）</div>
    ${buttons}
  </div> `;
}

function installQuickOptionsClickHandler() {
  if (window.__storyguide_quick_options_installed) return;
  window.__storyguide_quick_options_installed = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.sg-quick-option');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const prompt = btn.dataset.sgPrompt || '';
    if (prompt) {
      injectToUserInput(prompt);
    }
  }, true);
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

// -------------------- summary meta (per chat) --------------------
function getDefaultSummaryMeta() {
  return {
    lastFloor: 0,
    lastChatLen: 0,
    lastStructuredFloor: 0,
    lastStructuredChatLen: 0,
    // 用于“索引编号触发”（A-001/A-002…）的递增计数器（按聊天存储）
    nextIndex: 1,
    nextMegaIndex: 1,
    megaSummaryCount: 0,
    history: [], // [{title, summary, keywords, createdAt, range:{fromFloor,toFloor,fromIdx,toIdx}, worldInfo:{file,uid}}]
    structuredHistory: [], // [{createdAt, range:{fromFloor,toFloor,fromIdx,toIdx}, structuredChanges:[]}]
    wiTriggerLogs: [], // [{ts,userText,picked:[{title,score,keywordsPreview}], injectedKeywords, lookback, style, tag}]
    rollLogs: [], // [{ts, action, summary, final, success, userText}]
    // 结构化条目缓存（用于去重与更�?- 方案C混合策略�?
    characterEntries: {}, // { uid: { name, aliases, lastUpdated, wiEntryUid, content } }
    equipmentEntries: {}, // { uid: { name, aliases, lastUpdated, wiEntryUid, content } }
    inventoryEntries: {}, // { uid: { name, aliases, lastUpdated, wiEntryUid, content } }
    factionEntries: {}, // { uid: { name, lastUpdated, wiEntryUid, content } }
    achievementEntries: {}, // { uid: { name, lastUpdated, wiEntryUid, content } }
    subProfessionEntries: {}, // { uid: { name, lastUpdated, wiEntryUid, content } }
    questEntries: {}, // { uid: { name, lastUpdated, wiEntryUid, content } }
    conquestEntries: {}, // { uid: { name, aliases, lastUpdated, wiEntryUid, content } }
    nextCharacterIndex: 1, // NPC-001, NPC-002...
    nextEquipmentIndex: 1, // EQP-001, EQP-002...
    nextInventoryIndex: 1, // INV-001, INV-002...
    nextFactionIndex: 1, // FCT-001, FCT-002...
    nextAchievementIndex: 1, // ACH-001, ACH-002...
    nextSubProfessionIndex: 1, // SUB-001, SUB-002...
    nextQuestIndex: 1, // QUE-001, QUE-002...
    nextConquestIndex: 1, // CON-001, CON-002...
  };
}

function getSummaryMeta() {
  const raw = String(getChatMetaValue(META_KEYS.summaryMeta) || '').trim();
  if (!raw) return getDefaultSummaryMeta();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return getDefaultSummaryMeta();
    const merged = {
      ...getDefaultSummaryMeta(),
      ...data,
      history: Array.isArray(data.history) ? data.history : [],
      structuredHistory: Array.isArray(data.structuredHistory) ? data.structuredHistory : [],
      wiTriggerLogs: Array.isArray(data.wiTriggerLogs) ? data.wiTriggerLogs : [],
      rollLogs: Array.isArray(data.rollLogs) ? data.rollLogs : [],
    };
    if (!Object.hasOwn(data, 'factionEntries') && data.abilityEntries) {
      merged.factionEntries = data.abilityEntries;
    }
    if (!Object.hasOwn(data, 'nextFactionIndex') && data.nextAbilityIndex) {
      merged.nextFactionIndex = data.nextAbilityIndex;
    }
    return merged;
  } catch {
    return getDefaultSummaryMeta();
  }
}

async function setSummaryMeta(meta) {
  await setChatMetaValue(META_KEYS.summaryMeta, JSON.stringify(meta ?? getDefaultSummaryMeta()));
}

function appendStructuredHistory(meta, rec) {
  if (!meta || typeof meta !== 'object') return;
  meta.structuredHistory = Array.isArray(meta.structuredHistory) ? meta.structuredHistory : [];
  if (rec && typeof rec === 'object') meta.structuredHistory.push(rec);
  if (meta.structuredHistory.length > 160) meta.structuredHistory = meta.structuredHistory.slice(-160);
}

function updateStructuredProgressFromHistory(meta) {
  if (!meta || typeof meta !== 'object') return;
  const hist = Array.isArray(meta.structuredHistory) ? meta.structuredHistory : [];
  const last = [...hist].reverse().find(h => h && h.range && h.affectsProgress !== false);
  if (!last) {
    meta.lastStructuredFloor = 0;
    meta.lastStructuredChatLen = 0;
    return;
  }
  meta.lastStructuredFloor = last.range?.toFloor ? Number(last.range.toFloor) : 0;
  if (last.range?.toIdx !== undefined && last.range?.toIdx !== null) {
    meta.lastStructuredChatLen = Number(last.range.toIdx) + 1;
  } else {
    meta.lastStructuredChatLen = 0;
  }
}

function updateStructuredProgressFromSummaryHistory(meta) {
  if (!meta || typeof meta !== 'object') return;
  const hist = Array.isArray(meta.history) ? meta.history : [];
  const last = [...hist].reverse().find(h => h && h.range && Array.isArray(h.structuredChanges) && h.structuredChanges.length);
  if (!last) {
    meta.lastStructuredFloor = 0;
    meta.lastStructuredChatLen = 0;
    return;
  }
  meta.lastStructuredFloor = last.range?.toFloor ? Number(last.range.toFloor) : 0;
  if (last.range?.toIdx !== undefined && last.range?.toIdx !== null) {
    meta.lastStructuredChatLen = Number(last.range.toIdx) + 1;
  } else {
    meta.lastStructuredChatLen = 0;
  }
}

// ===== 静态模块缓存（只在首次或手动刷新时生成的模块结果）=====
function getStaticModulesCache() {
  const raw = String(getChatMetaValue(META_KEYS.staticModulesCache) || '').trim();
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return {};
  }
}

async function setStaticModulesCache(cache) {
  await setChatMetaValue(META_KEYS.staticModulesCache, JSON.stringify(cache ?? {}));
}

// ===== 地图数据（网格地图功能）=====
function getDefaultMapData() {
  return {
    locations: {},
    protagonistLocation: '',
    gridSize: { rows: 5, cols: 7 },
    lastUpdated: null,
  };
}

function getMapData() {
  const raw = String(getChatMetaValue(META_KEYS.mapData) || '').trim();
  if (!raw) return getDefaultMapData();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return getDefaultMapData();
    return {
      ...getDefaultMapData(),
      ...data,
      locations: (data.locations && typeof data.locations === 'object') ? data.locations : {},
    };
  } catch {
    return getDefaultMapData();
  }
}

async function setMapData(mapData) {
  await setChatMetaValue(META_KEYS.mapData, JSON.stringify(mapData ?? getDefaultMapData()));
}

// ===== 平行世界（NPC离屏模拟）核心函�?=====

function getDefaultParallelWorldData() {
  return {
    worldClock: '�?�?,
    trackedNpcs: [],   // [{ name, enabled }]
    eventLog: [],      // [{ npcName, time, event, impact, simRunId }]
    lastRunFloor: 0,
    runCount: 0,
  };
}

function getParallelWorldData() {
  const raw = String(getChatMetaValue(META_KEYS.parallelWorldData) || '').trim();
  if (!raw) return getDefaultParallelWorldData();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return getDefaultParallelWorldData();
    return {
      ...getDefaultParallelWorldData(),
      ...data,
      trackedNpcs: Array.isArray(data.trackedNpcs) ? data.trackedNpcs : [],
      eventLog: Array.isArray(data.eventLog) ? data.eventLog : [],
    };
  } catch {
    return getDefaultParallelWorldData();
  }
}

async function setParallelWorldData(data) {
  await setChatMetaValue(META_KEYS.parallelWorldData, JSON.stringify(data ?? getDefaultParallelWorldData()));
}

function setParallelWorldStatus(text, kind = '') {
  const $el = $('#sg_parallelWorldStatus');
  if (!$el.length) return;
  $el.text(text || '');
  $el.attr('class', 'sg-status' + (kind ? ` sg-status-${kind}` : ''));
}

/**
 * 收集被追踪NPC的档案信息（从结构化条目缓存中获取）
 */
/**
 * 通用：从蓝灯世界书中�?prefix 提取条目（去重）�?
 * 如果蓝灯读取失败或为空，回退�?meta[metaFallbackKey]�?
 * @param {string} prefix  条目前缀，如 "人物" "势力"
 * @param {string} metaFallbackKey  meta 中的回退 key，如 "characterEntries" "factionEntries"
 * @param {string} label  日志标签，如 "角色" "势力"
 */
async function collectBlueWorldbookEntriesByPrefix(prefix, metaFallbackKey, label) {
  const file = pickBlueIndexFileName();
  const cleanPrefix = prefix.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[[^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*/g, '').trim();
  console.log(`[StoryGuide][平行世界] 蓝灯世界书查�?{label}: 文件="${file}", 前缀="${cleanPrefix}"`);

  if (file) {
    try {
      const json = await fetchWorldInfoFileJsonCompat(file);
      const entries = parseWorldbookJson(JSON.stringify(json || {}));
      const resultMap = {};

      for (const e of entries) {
        let comment = String(e.comment || e.title || '').trim();
        const cleanComment = comment.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[[^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*/g, '').trim();
        if (!cleanComment.startsWith(cleanPrefix)) continue;

        const parts = comment.split(/[｜|]/);
        const namePart = (parts.length >= 2 ? parts[1] : comment.replace(prefix, '')).replace(/^[-_�?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s]+/, '').trim();

        const content = String(e.content || '');
        let parsed = null;
        const jsonBlockMatch = content.match(/```json        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*([        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*?)```/);
        if (jsonBlockMatch) { try { parsed = JSON.parse(jsonBlockMatch[1]); } catch { } }
        if (!parsed) { try { parsed = JSON.parse(content); } catch { } }
        if (!parsed) {
          const braceMatch = content.match(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/);
          if (braceMatch) { try { parsed = JSON.parse(braceMatch[0]); } catch { } }
        }

        const finalName = (parsed?.name ? String(parsed.name).trim() : namePart) || namePart;
        if (finalName && !resultMap[finalName]) {
          const entry = parsed || { name: finalName };
          entry._rawContent = content;
          resultMap[finalName] = entry;
        }
      }

      if (Object.keys(resultMap).length > 0) {
        console.log(`[StoryGuide][平行世界] 从蓝灯世界书提取 ${Object.keys(resultMap).length} �?{label}`);
        return resultMap;
      }
      console.warn(`[StoryGuide][平行世界] 蓝灯世界书未找到${label}条目，回退 meta`);
    } catch (e) {
      console.warn(`[StoryGuide][平行世界] 读取蓝灯${label}失败:`, e);
    }
  }

  // 回退: �?meta 读取
  const meta = getSummaryMeta();
  const fallback = meta[metaFallbackKey] || {};
  const resultMap = {};
  for (const [k, ce] of Object.entries(fallback)) {
    const name = String(ce.name || '').trim();
    if (name && !resultMap[name]) {
      resultMap[name] = ce;
    }
  }
  console.log(`[StoryGuide][平行世界] 回退 meta: ${Object.keys(resultMap).length} �?{label}`);
  return resultMap;
}

/** 角色条目快捷方法 */
async function collectBlueWorldbookCharacterEntries() {
  const s = ensureSettings();
  return collectBlueWorldbookEntriesByPrefix(
    String(s.characterEntryPrefix || '人物').trim(),
    'characterEntries', '角色'
  );
}

/** 势力条目快捷方法 */
async function collectBlueWorldbookFactionEntries() {
  const s = ensureSettings();
  return collectBlueWorldbookEntriesByPrefix(
    String(s.factionEntryPrefix || '势力').trim(),
    'factionEntries', '势力'
  );
}

function collectTrackedNpcProfiles(trackedNpcs, pwData) {
  // 使用上层传入的蓝灯角色缓存（如果有），否则回退�?meta
  const charEntries = pwData._blueCharEntries || getSummaryMeta().characterEntries || {};
  const profiles = [];

  for (const tn of trackedNpcs) {
    if (!tn.enabled) continue;
    const name = String(tn.name || '').trim();
    if (!name) continue;

    // 在角色缓存中查找
    let found = charEntries[name] || null;
    if (!found) {
      for (const [k, ce] of Object.entries(charEntries)) {
        const ceName = String(ce.name || '').trim();
        const ceAliases = Array.isArray(ce.aliases) ? ce.aliases : [];
        if (ceName === name || ceAliases.some(a => String(a).trim() === name)) {
          found = ce;
          break;
        }
      }
    }

    // 构建档案文本：优先使用世界书条目的原始内�?
    let profile = `�?{name}】\n`;
    if (found && found._rawContent) {
      // 直接使用蓝灯世界书中的条目内�?
      profile += found._rawContent + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n';
    } else if (found) {
      if (found.personality) profile += `性格: ${found.personality}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (found.corePersonality) profile += `核心性格: ${found.corePersonality}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (found.motivation) profile += `动机: ${found.motivation}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (found.faction) profile += `阵营: ${found.faction}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (found.status) profile += `状�? ${found.status}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (found.relationToProtagonist) profile += `与主角关�? ${found.relationToProtagonist}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (found.relationshipStage) profile += `关系阶段: ${found.relationshipStage}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (found.background) profile += `背景: ${found.background}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
    } else {
      profile += `(无详细档�?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
    }

    // 附加最近的离屏事件
    const recentEvents = (pwData.eventLog || []).filter(e => e.npcName === name).slice(-3);
    if (recentEvents.length > 0) {
      profile += `最近离屏事�?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      for (const ev of recentEvents) {
        profile += `  - [${ev.time}] ${ev.event}${ev.impact ? ` (影响: ${ev.impact})` : ''}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      }
    }

    profiles.push(profile);
  }
  return profiles.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

/**
 * 收集势力/组织的档案信息，用于平行世界推演
 */
function collectFactionProfiles(factionEntries, pwData) {
  if (!factionEntries || Object.keys(factionEntries).length === 0) return '(无势�?组织数据)';

  const profiles = [];
  for (const [name, entry] of Object.entries(factionEntries)) {
    let profile = `【势�? ${name}】\n`;
    if (entry._rawContent) {
      profile += entry._rawContent + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n';
    } else {
      if (entry.description) profile += `描述: ${entry.description}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (entry.leader) profile += `领袖: ${entry.leader}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (entry.territory) profile += `领地: ${entry.territory}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (entry.status) profile += `状�? ${entry.status}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      if (entry.goal) profile += `目标: ${entry.goal}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
    }

    // 附加最近的离屏事件
    const recentEvents = (pwData.factionEventLog || []).filter(e => e.factionName === name).slice(-3);
    if (recentEvents.length > 0) {
      profile += `最近势力事�?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      for (const ev of recentEvents) {
        profile += `  - [${ev.time}] ${ev.event}${ev.impact ? ` (影响: ${ev.impact})` : ''}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
      }
    }
    profiles.push(profile);
  }
  return profiles.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}
/**
 * 从聊天记录中读取最�?N 楼的正文内容，用于平行世界推�?
 */
function readRecentChatForParallelWorld(n = 5) {
  const ctx = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
  const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
  if (chat.length === 0) return '(无可用正�?';

  const floors = Math.max(1, Math.min(50, n));
  const picked = [];
  for (let i = chat.length - 1; i >= 0 && picked.length < floors; i--) {
    const m = chat[i];
    if (!m) continue;
    const isUser = m.is_user === true;
    const name = stripHtml(m.name || (isUser ? 'User' : 'Assistant'));
    let text = stripHtml(m.mes ?? m.message ?? '');
    if (!text) continue;
    // 限制每条消息最大字符数
    if (text.length > 4000) text = text.slice(0, 4000) + '�?截断)';
    picked.push(`�?{name}�?{text}`);
  }
  picked.reverse();
  if (picked.length === 0) return '(无可用正�?';
  return picked.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

/**
 * 从聊天文本中提取时间信息，用于更新世界时钟�?
 * 优先提取最接近末尾（最新）的时间描述�?
 */
function extractTimeFromChat(chatText) {
  if (!chatText || chatText === '(无可用正�?') return null;

  // 常见时间模式（中文叙事常见格式）
  const patterns = [
    // "第X�? "第X�? "第X�?
    /第\s*[零一二三四五六七八九十百千万        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d]+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[天日夜]/g,
    // "X月X�? "X年X�?
    /[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d一二三四五六七八九十]+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[月年]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d一二三四五六七八九十]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[日号]?/g,
    // 具体时间：上�?下午/清晨/黄昏/午夜/傍晚/正午/深夜/拂晓/黎明
    /(?:清晨|拂晓|黎明|早晨|早上|上午|中午|正午|下午|傍晚|黄昏|日落|夜晚|深夜|午夜|凌晨|子时|丑时|寅时|卯时|辰时|巳时|午时|未时|申时|酉时|戌时|亥时)/g,
    // "XX:XX" 时钟格式
    /        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d{1,2}:        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d{2}/g,
    // "X�? "X�?
    /[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d一二三四五六七八九十]+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[时点](?:        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d一二三四五六七八九十]+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*�??/g,
  ];

  let lastMatch = null;
  let lastPos = -1;

  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(chatText)) !== null) {
      if (m.index > lastPos) {
        lastPos = m.index;
        lastMatch = m[0].trim();
      }
    }
  }

  // 尝试组合：如�?"第X�? + 时间�?相邻，合�?
  if (lastMatch) {
    // �?lastMatch 附近也查找日期组�?
    const nearbyText = chatText.slice(Math.max(0, lastPos - 30), lastPos + lastMatch.length + 30);
    const dayMatch = nearbyText.match(/第\s*[零一二三四五六七八九十百千万        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d]+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[天日夜]/);
    const timeMatch = nearbyText.match(/(?:清晨|拂晓|黎明|早晨|早上|上午|中午|正午|下午|傍晚|黄昏|日落|夜晚|深夜|午夜|凌晨)/);
    if (dayMatch && timeMatch) {
      return `${dayMatch[0]} ${timeMatch[0]}`;
    }
    return lastMatch;
  }

  return null;
}

/**
 * 构建推演 prompt messages
 */
function buildParallelWorldPromptMessages(snapshotText, npcProfilesText, worldClock, factionProfilesText) {
  const s = ensureSettings();
  const sysTpl = String(s.parallelWorldSystemPrompt || DEFAULT_PARALLEL_WORLD_SYSTEM_PROMPT);
  const usrTpl = String(s.parallelWorldUserTemplate || DEFAULT_PARALLEL_WORLD_USER_TEMPLATE);

  const userContent = renderTemplate(usrTpl, {
    worldTime: worldClock || '�?�?,
    recentContext: snapshotText || '(无可用上下文)',
    npcProfiles: npcProfilesText || '(无NPC)',
    factionProfiles: factionProfilesText || '(无势�?组织)',
  });

  return [
    { role: 'system', content: sysTpl + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + PARALLEL_WORLD_JSON_REQUIREMENT },
    { role: 'user', content: userContent },
  ];
}

/**
 * 核心推演函数：调�?LLM 推演所有被追踪 NPC 的离屏事�?
 */
async function runParallelWorldSimulation() {
  const s = ensureSettings();
  if (!s.parallelWorldEnabled) {
    setParallelWorldStatus('平行世界未启�?, 'warn');
    return false;
  }

  const pwData = getParallelWorldData();

  const trackedNpcs = (s.parallelWorldTrackedNpcs || []).filter(t => t.enabled);
  const trackedFactions = (s.parallelWorldTrackedFactions || []).filter(t => t.enabled);

  if (trackedNpcs.length === 0 && trackedFactions.length === 0) {
    setParallelWorldStatus('没有被追踪的NPC或势力，请刷新列表并勾�?, 'warn');
    return false;
  }

  setParallelWorldStatus('正在推演离屏事件�?, 'warn');
  showToast('🌍 平行世界推演中�?, { kind: 'info', spinner: true, sticky: true });

  try {
    // 1. 收集上下文（从蓝灯世界书读取角色+势力 + 最新正文）
    const blueCharEntries = await collectBlueWorldbookCharacterEntries();
    const blueFactionEntries = await collectBlueWorldbookFactionEntries();
    pwData._blueCharEntries = blueCharEntries;
    const readFloors = clampInt(s.parallelWorldReadFloors, 1, 50, 5);
    const chatContext = readRecentChatForParallelWorld(readFloors);
    const npcProfilesText = collectTrackedNpcProfiles(trackedNpcs, pwData);

    // 过滤只处理被追踪的势�?
    const trackedFactionNames = new Set(trackedFactions.map(t => t.name));
    const filteredFactionEntries = {};
    for (const [k, v] of Object.entries(blueFactionEntries)) {
      if (trackedFactionNames.has(k)) filteredFactionEntries[k] = v;
    }
    const factionProfilesText = collectFactionProfiles(filteredFactionEntries, pwData);
    delete pwData._blueCharEntries;

    // 世界时钟：从正文中提取时�?
    const extractedTime = extractTimeFromChat(chatContext);
    if (extractedTime) {
      pwData.worldClock = extractedTime;
    }
    const worldClock = pwData.worldClock || s.parallelWorldClock || '�?�?;

    // 2. 构建 prompt
    const messages = buildParallelWorldPromptMessages(chatContext, npcProfilesText, worldClock, factionProfilesText);

    // 3. 调用 LLM
    let responseText;
    if (s.parallelWorldProvider === 'custom') {
      responseText = await callViaCustom(
        s.parallelWorldCustomEndpoint,
        s.parallelWorldCustomApiKey,
        s.parallelWorldCustomModel,
        messages,
        s.parallelWorldTemperature,
        s.parallelWorldCustomMaxTokens,
        s.parallelWorldCustomTopP,
        s.parallelWorldCustomStream
      );
    } else {
      responseText = await callViaSillyTavern(messages, null, s.parallelWorldTemperature);
    }

    // 4. 解析结果
    const parsed = safeJsonParse(responseText);
    if (!parsed || !Array.isArray(parsed.npcUpdates)) {
      setParallelWorldStatus('推演结果解析失败', 'err');
      hideToast();
      return false;
    }

    // 5. 处理结果：更新事件日�?
    const maxEvents = s.parallelWorldMaxEventsPerNpc || 10;
    const simRunId = Date.now();

    if (parsed.worldTime) {
      pwData.worldClock = parsed.worldTime;
    }

    for (const npcUpdate of parsed.npcUpdates) {
      const npcName = String(npcUpdate.name || '').trim();
      if (!npcName) continue;

      // 添加事件到日�?
      if (Array.isArray(npcUpdate.events)) {
        for (const evt of npcUpdate.events) {
          pwData.eventLog.push({
            npcName,
            time: String(evt.time || parsed.worldTime || ''),
            event: String(evt.event || ''),
            impact: String(evt.impact || ''),
            simRunId,
          });
        }
      }

      // 按NPC修剪事件�?
      const npcEvents = pwData.eventLog.filter(e => e.npcName === npcName);
      if (npcEvents.length > maxEvents) {
        const excess = npcEvents.length - maxEvents;
        let removed = 0;
        pwData.eventLog = pwData.eventLog.filter(e => {
          if (e.npcName === npcName && removed < excess) {
            removed++;
            return false;
          }
          return true;
        });
      }

    }

    // 5b. 处理势力事件
    if (!pwData.factionEventLog) pwData.factionEventLog = [];
    if (Array.isArray(parsed.factionUpdates)) {
      for (const factionUpdate of parsed.factionUpdates) {
        const factionName = String(factionUpdate.name || '').trim();
        if (!factionName) continue;

        if (Array.isArray(factionUpdate.events)) {
          for (const evt of factionUpdate.events) {
            pwData.factionEventLog.push({
              factionName,
              time: String(evt.time || parsed.worldTime || ''),
              event: String(evt.event || ''),
              impact: String(evt.impact || ''),
              simRunId,
            });
          }
        }

        // 修剪势力事件�?
        const fEvents = pwData.factionEventLog.filter(e => e.factionName === factionName);
        if (fEvents.length > maxEvents) {
          const excess = fEvents.length - maxEvents;
          let removed = 0;
          pwData.factionEventLog = pwData.factionEventLog.filter(e => {
            if (e.factionName === factionName && removed < excess) {
              removed++;
              return false;
            }
            return true;
          });
        }
      }
    }

    // 6. 可选：写回世界书（创建/更新专用「平行事件」条目）
    if (s.parallelWorldWriteToWorldbook) {
      try {
        await writeParallelEventsEntry(pwData, s);
      } catch (e) {
        console.warn('[StoryGuide] 平行世界: 写回平行事件条目失败:', e);
      }
    }

    pwData.lastRunFloor = computeFloorCount(
      (typeof SillyTavern !== 'undefined' && SillyTavern?.getContext?.()?.chat) || [],
      'assistant'
    );
    pwData.runCount = (pwData.runCount || 0) + 1;

    await setParallelWorldData(pwData);

    // 更新 UI
    renderParallelWorldEventLog(pwData);
    updateParallelWorldClockDisplay(pwData.worldClock);

    const totalNewEvents = parsed.npcUpdates.reduce((sum, u) => sum + (u.events?.length || 0), 0);
    const totalFactionEvents = Array.isArray(parsed.factionUpdates) ? parsed.factionUpdates.reduce((sum, u) => sum + (u.events?.length || 0), 0) : 0;
    const factionPart = totalFactionEvents > 0 ? `, ${parsed.factionUpdates.length} 个势�? ${totalFactionEvents} 件势力事件` : '';
    setParallelWorldStatus(`�?推演完成�?{parsed.npcUpdates.length} 个NPC, ${totalNewEvents} 件事�?{factionPart}`, 'ok');
    hideToast();
    return true;

  } catch (e) {
    console.error('[StoryGuide] 平行世界推演失败:', e);
    setParallelWorldStatus(`�?推演失败: ${e?.message || e}`, 'err');
    hideToast();
    return false;
  }
}

/**
 * 将推演结果写入专用「平行事件」世界书条目（同时写入蓝灯和绿灯）�?
 * 条目以所有被追踪NPC的名字为关键�?由索引模块负责触发与上下文注入�?
 */
async function writeParallelEventsEntry(pwData, settings) {
  const s = settings || ensureSettings();
  const prefix = String(s.characterEntryPrefix || '人物').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[[^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*/g, '').trim();
  const trackedNpcs = (s.parallelWorldTrackedNpcs || []).filter(t => t.enabled);
  const trackedFactions = (s.parallelWorldTrackedFactions || []).filter(t => t.enabled);

  if (trackedNpcs.length === 0 && trackedFactions.length === 0) return;

  const maxEvents = s.parallelWorldMaxEventsPerNpc || 10;
  const eventLog = pwData.eventLog || [];
  const factionEventLog = pwData.factionEventLog || [];

  // Find latest run ID to overwrite content with only new events
  const allEvents = [...eventLog, ...factionEventLog];
  const lastRunId = allEvents.reduce((max, ev) => Math.max(max, ev.simRunId || 0), 0);

  const worldClock = pwData.worldClock || s.parallelWorldClock || '�?�?;

  // �?NPC 分组构建内容
  const lines = [`[平行世界事件记录]`, `世界时间: ${worldClock}`, ''];
  for (const tn of trackedNpcs) {
    const name = String(tn.name || '').trim();
    if (!name) continue;
    // Only show events from the LATEST run
    const npcEvents = eventLog.filter(e => e.npcName === name && e.simRunId === lastRunId);
    if (npcEvents.length === 0) continue;
    lines.push(`�?{name}】`);
    for (const ev of npcEvents) {
      let line = `- [${ev.time}] ${ev.event}`;
      if (ev.impact) line += ` (影响: ${ev.impact})`;
      lines.push(line);
    }
    lines.push('');
  }

  // 按势力分组构建内�?(只包含最新一次推演的事件)
  // const factionEventLog = ... (already declared at top)
  const currentFactionEvents = factionEventLog.filter(e => e.simRunId === lastRunId);
  const factionNames = new Set();

  if (currentFactionEvents.length > 0) {
    const factionGroups = {};
    for (const fe of currentFactionEvents) {
      const fn = fe.factionName;
      if (!fn) continue;
      if (!factionGroups[fn]) factionGroups[fn] = [];
      factionGroups[fn].push(fe);
      factionNames.add(fn);
    }
    for (const [fn, recent] of Object.entries(factionGroups)) {
      lines.push(`【势�? ${fn}】`);
      for (const ev of recent) {
        let line = `- [${ev.time}] ${ev.event}`;
        if (ev.impact) line += ` (影响: ${ev.impact})`;
        lines.push(line);
      }
      lines.push('');
    }
  }

  if (lines.length <= 3) return; // 无事件，不写�?

  const content = lines.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
  // 关键�?= 所有被追踪NPC的名�?+ 被追踪势力名�?以便索引模块能匹配触�?
  // 关键词只保留 "平行事件" + 唯一标识�?(用户要求)
  const keywords = ['平行事件', '__SG_PARALLEL_WORLD_EVENT__'];

  const entryComment = `[mvu_plot]平行事件`;
  const meta = getSummaryMeta();

  // 使用 writeOrUpdateStructuredEntry 写入蓝灯和绿�?
  const entryData = {
    name: '[mvu_plot]平行事件',
    isUpdated: true,
    isNew: false,
  };

  // 构建写入数据（直接使用底�?STscript 写入,不走角色条目流程�?
  const dualWriteSettings = { ...s, summaryToWorldInfo: true, summaryToBlueWorldInfo: true };

  // 写绿�?
  try {
    const greenTarget = resolveGreenWorldInfoTarget(dualWriteSettings);
    if (greenTarget.file) {
      await writeWorldInfoEntryDirect({
        file: greenTarget.file,
        comment: entryComment,
        content,
        keys: keywords,
        constant: 1,  // 绿灯改为常驻 (用户要求)
        searchKey: '__SG_PARALLEL_WORLD_EVENT__',
      });
      console.log('[StoryGuide][平行世界] 平行事件条目已写入绿灯世界书');
    }
  } catch (e) {
    console.warn('[StoryGuide][平行世界] 写入绿灯失败:', e);
  }

  // 写蓝�?
  try {
    const blueFile = normalizeWorldInfoFileName(dualWriteSettings.summaryBlueWorldInfoFile);
    if (blueFile) {
      await writeWorldInfoEntryDirect({
        file: blueFile,
        comment: entryComment,
        content,
        keys: keywords,
        constant: 1,  // 蓝灯=常开
        searchKey: '__SG_PARALLEL_WORLD_EVENT__',
      });
      console.log('[StoryGuide][平行世界] 平行事件条目已写入蓝灯世界书');
    }
  } catch (e) {
    console.warn('[StoryGuide][平行世界] 写入蓝灯失败:', e);
  }
}

/**
 * 直接使用 STscript 写入/更新世界书条目（通用底层方法�?
 */
async function writeWorldInfoEntryDirect({ file, comment, content, keys, constant = 0, searchKey }) {
  if (!file || (!comment && !searchKey)) return;

  const qFile = quoteSlashValue(file);
  // SillyTavern might parse [bracket] as macro, so escape them in comment/title
  const qComment = quoteSlashValue(comment ? comment.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]') : '');
  const qContent = quoteSlashValue(content.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?));
  const keyStr = Array.isArray(keys) ? keys.join(',') : String(keys || '');
  const qKey = quoteSlashValue(keyStr);
  const uidVar = '__sg_pw_uid';

  let uid = null;

  // 1. 优先尝试�?searchKey 查找 (更精�?避免同名覆盖)
  if (searchKey) {
    try {
      const qSearchKey = quoteSlashValue(searchKey);
      const findScriptKey = `/findentry file=${qFile} field=key ${qSearchKey} | /setvar key=${uidVar}`;
      const findResultKey = await execSlash(findScriptKey);
      uid = parseFindEntryUid(findResultKey);
      if (uid) console.log(`[StoryGuide] Found entry by unique key: ${searchKey}, uid=${uid}`);
    } catch { }
  }

  // 2. 如果没找到，再尝试按 comment 查找 (兼容旧数�?
  if (!uid && comment) {
    try {
      const findScript = `/findentry file=${qFile} field=comment ${qComment} | /setvar key=${uidVar}`;
      const findResult = await execSlash(findScript);
      uid = parseFindEntryUid(findResult);
    } catch { }
  }

  if (uid) {
    // 已有条目 -> 更新内容和关键词
    const updateParts = [
      `/setentryfield file=${qFile} uid=${uid} field=content ${qContent}`,
      `/setentryfield file=${qFile} uid=${uid} field=key ${qKey}`,
      `/setentryfield file=${qFile} uid=${uid} field=comment ${qComment}`, // 确保标题也更�?
      `/setentryfield file=${qFile} uid=${uid} field=disable 0`,
    ];
    await execSlash(updateParts.join(' | '));
    console.log(`[StoryGuide][平行世界] 已更新条�?uid=${uid} (file=${file})`);
    return;
  }

  // 新建条目
  const createParts = [
    `/createentry file=${qFile} key=${qKey} ${qContent}`,
    `/setvar key=${uidVar}`,
  ];
  await execSlash(createParts.join(' | '));

  // 使用 {{getvar::}} 引用刚创建的 uid 来设置字�?
  const setupParts = [
    `/setentryfield file=${qFile} uid={{getvar::${uidVar}}} field=comment ${qComment}`,
    `/setentryfield file=${qFile} uid={{getvar::${uidVar}}} field=content ${qContent}`,
    `/setentryfield file=${qFile} uid={{getvar::${uidVar}}} field=constant ${constant}`,
    `/setentryfield file=${qFile} uid={{getvar::${uidVar}}} field=disable 0`,
    `/flushvar ${uidVar}`,
  ];
  await execSlash(setupParts.join(' | '));
  console.log(`[StoryGuide][平行世界] 新建条目 (file=${file})`);
}

/**
 * 自动触发检查：判断是否应该自动推演
 */
async function maybeAutoRunParallelWorld() {
  const s = ensureSettings();
  if (!s.parallelWorldEnabled || !s.parallelWorldAutoTrigger) return;

  const chat = (typeof SillyTavern !== 'undefined' && SillyTavern?.getContext?.()?.chat) || [];
  const currentFloor = computeFloorCount(chat, 'assistant');
  const pwData = getParallelWorldData();
  const lastFloor = pwData.lastRunFloor || 0;
  const every = Math.max(1, s.parallelWorldAutoEvery || 5);

  if (currentFloor - lastFloor >= every) {
    console.log(`[StoryGuide] 平行世界: 自动推演触发 (楼层 ${lastFloor} �?${currentFloor}, 间隔 ${every})`);
    await runParallelWorldSimulation();
  }
}

/**
 * 构建平行世界上下文注入（注入�?AI 回复前的消息中）
 */
function buildParallelWorldContextInjection() {
  const s = ensureSettings();
  if (!s.parallelWorldEnabled || !s.parallelWorldInjectContext) return '';

  const pwData = getParallelWorldData();
  const tracked = (s.parallelWorldTrackedNpcs || []).filter(t => t.enabled);
  if (tracked.length === 0) return '';

  const parts = [];
  for (const tn of tracked) {
    const name = String(tn.name || '').trim();
    if (!name) continue;

    const recentEvents = (pwData.eventLog || [])
      .filter(e => e.npcName === name)
      .slice(-3);

    if (recentEvents.length === 0) continue;

    let npcInfo = `[${name}的近况]`;
    for (const ev of recentEvents) {
      npcInfo += ` ${ev.time}: ${ev.event}。`;
    }
    parts.push(npcInfo);
  }

  if (parts.length === 0) return '';
  return `<!-- SG_PARALLEL_WORLD -->${parts.join(' ')}<!-- /SG_PARALLEL_WORLD -->`;
}

/**
 * 渲染事件日志到UI
 */
function renderParallelWorldEventLog(pwDataOverride) {
  const $container = $('#sg_pwEventLog');
  if (!$container.length) return;

  const pwData = pwDataOverride || getParallelWorldData();
  const events = pwData.eventLog || [];
  const factionEvents = pwData.factionEventLog || [];

  if (events.length === 0 && factionEvents.length === 0) {
    $container.html('<div class="sg-hint">暂无事件记录。点击「立即推演」开始模拟�?/div>');
    return;
  }

  // 按NPC分组
  const grouped = {};
  for (const ev of events) {
    const name = ev.npcName || '未知';
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(ev);
  }

  let html = '';
  for (const [npcName, npcEvents] of Object.entries(grouped)) {
    html += `<div class="sg-pw-npc-group">`;
    html += `<div class="sg-pw-npc-group-title">${escapeHtml(npcName)} <span class="sg-pw-count">(${npcEvents.length}�?</span></div>`;
    html += `<div class="sg-pw-npc-events">`;
    const recent = npcEvents.slice(-5).reverse();
    for (const ev of recent) {
      html += `<div class="sg-pw-event-item">`;
      html += `<span class="sg-pw-event-time">${escapeHtml(ev.time || '')}</span> `;
      html += `<span class="sg-pw-event-text">${escapeHtml(ev.event || '')}</span>`;
      if (ev.impact) {
        html += `<span class="sg-pw-event-impact"> �?${escapeHtml(ev.impact)}</span>`;
      }
      html += `</div>`;
    }
    if (npcEvents.length > 5) {
      html += `<div class="sg-hint">…还�?${npcEvents.length - 5} 条更早的记录</div>`;
    }
    html += `</div></div>`;
  }

  // 按势力分�?
  if (factionEvents.length > 0) {
    const factionGrouped = {};
    for (const ev of factionEvents) {
      const name = ev.factionName || '未知势力';
      if (!factionGrouped[name]) factionGrouped[name] = [];
      factionGrouped[name].push(ev);
    }
    for (const [fName, fEvents] of Object.entries(factionGrouped)) {
      html += `<div class="sg-pw-npc-group">`;
      html += `<div class="sg-pw-npc-group-title">[势力] ${escapeHtml(fName)} <span class="sg-pw-count">(${fEvents.length}�?</span></div>`;
      html += `<div class="sg-pw-npc-events">`;
      const recent = fEvents.slice(-5).reverse();
      for (const ev of recent) {
        html += `<div class="sg-pw-event-item">`;
        html += `<span class="sg-pw-event-time">${escapeHtml(ev.time || '')}</span> `;
        html += `<span class="sg-pw-event-text">${escapeHtml(ev.event || '')}</span>`;
        if (ev.impact) {
          html += `<span class="sg-pw-event-impact"> �?${escapeHtml(ev.impact)}</span>`;
        }
        html += `</div>`;
      }
      if (fEvents.length > 5) {
        html += `<div class="sg-hint">…还�?${fEvents.length - 5} 条更早的记录</div>`;
      }
      html += `</div></div>`;
    }
  }

  $container.html(html);
}

function updateParallelWorldClockDisplay(clockText) {
  const $el = $('#sg_pwClockDisplay');
  if ($el.length) $el.text(clockText || '�?�?);
}

/**
 * 刷新 NPC �?势力 追踪列表（从蓝灯世界书中获取�?
 */
async function refreshParallelWorldTrackedLists() {
  try {
    const $npcList = $('#sg_pwNpcList');
    const $factionList = $('#sg_pwFactionList');

    if (!$npcList.length && !$factionList.length) return;

    const s = ensureSettings();
    $npcList.html('<div class="sg-hint">正在读取蓝灯世界书�?/div>');
    $factionList.html('<div class="sg-hint">正在读取蓝灯世界书�?/div>');

    // 并行读取
    const [blueCharEntries, blueFactionEntries] = await Promise.all([
      collectBlueWorldbookCharacterEntries().catch(e => { console.error(e); return {}; }),
      collectBlueWorldbookFactionEntries().catch(e => { console.error(e); return {}; })
    ]);

    // --- 渲染 NPC 列表 ---
    if ($npcList.length) {
      const allNames = [];
      const seen = new Set();
      for (const [k, ce] of Object.entries(blueCharEntries || {})) {
        const name = String(ce.name || k).trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          allNames.push(name);
        }
      }

      if (allNames.length === 0) {
        $npcList.html('<div class="sg-hint">暂无角色条目�?/div>');
      } else {
        const trackedMap = {};
        for (const t of (s.parallelWorldTrackedNpcs || [])) {
          trackedMap[String(t.name || '').trim()] = t.enabled !== false;
        }

        let html = '';
        for (const name of allNames) {
          const checked = trackedMap[name] ? 'checked' : '';
          html += `<label class="sg-pw-list-item">
            <input type="checkbox" class="sg-pw-check-npc" data-name="${escapeHtml(name)}" ${checked}>
            <span>${escapeHtml(name)}</span>
          </label>`;
        }
        $npcList.html(html);
      }
    }

    // --- 渲染 势力 列表 ---
    if ($factionList.length) {
      const allNames = [];
      const seen = new Set();
      for (const [k, fe] of Object.entries(blueFactionEntries || {})) {
        const name = String(fe.name || k).trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          allNames.push(name);
        }
      }

      if (allNames.length === 0) {
        $factionList.html('<div class="sg-hint">暂无势力条目�?/div>');
      } else {
        const trackedMap = {};
        for (const t of (s.parallelWorldTrackedFactions || [])) {
          trackedMap[String(t.name || '').trim()] = t.enabled !== false;
        }

        let html = '';
        for (const name of allNames) {
          const checked = trackedMap[name] ? 'checked' : '';
          html += `<label class="sg-pw-list-item">
            <input type="checkbox" class="sg-pw-check-faction" data-name="${escapeHtml(name)}" ${checked}>
            <span>${escapeHtml(name)}</span>
          </label>`;
        }
        $factionList.html(html);
      }
    }

    // 绑定事件：NPC Checkbox
    $npcList.off('change', '.sg-pw-check-npc').on('change', '.sg-pw-check-npc', function () {
      const name = $(this).data('name');
      const enabled = $(this).prop('checked');
      const s2 = ensureSettings();
      if (!s2.parallelWorldTrackedNpcs) s2.parallelWorldTrackedNpcs = [];

      const existing = s2.parallelWorldTrackedNpcs.find(t => t.name === name);
      if (existing) {
        existing.enabled = enabled;
      } else {
        s2.parallelWorldTrackedNpcs.push({ name, enabled });
      }
      saveSettings();
    });

    // 绑定事件：Faction Checkbox
    $factionList.off('change', '.sg-pw-check-faction').on('change', '.sg-pw-check-faction', function () {
      const name = $(this).data('name');
      const enabled = $(this).prop('checked');
      const s2 = ensureSettings();
      if (!s2.parallelWorldTrackedFactions) s2.parallelWorldTrackedFactions = [];

      const existing = s2.parallelWorldTrackedFactions.find(t => t.name === name);
      if (existing) {
        existing.enabled = enabled;
      } else {
        s2.parallelWorldTrackedFactions.push({ name, enabled });
      }
      saveSettings();
    });
  } catch (e) {
    console.error('[StoryGuide] refreshParallelWorldTrackedLists error:', e);
    $('#sg_pwNpcList, #sg_pwFactionList').html('<div class="sg-hint" style="color:red">加载列表失败</div>');
  }
}

/**
 * 刷新平行世界模型列表
 */
async function refreshParallelWorldModels() {
  const s = ensureSettings();
  const $sel = $('#sg_parallelWorldCustomModel');
  const $btn = $('#sg_refreshParallelWorldModels');
  const base = normalizeBaseUrl(s.parallelWorldCustomEndpoint);
  if (!base) {
    setParallelWorldStatus('请先填写 API 基础URL', 'warn');
    return;
  }
  $btn.prop('disabled', true);
  setParallelWorldStatus('正在刷新模型列表�?, 'warn');
  try {
    const modelsUrl = base.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/$/, '') + '/models';
    const headers = {};
    if (s.parallelWorldCustomApiKey) headers['Authorization'] = `Bearer ${s.parallelWorldCustomApiKey}`;

    let modelIds = [];
    try {
      const res = await fetchJsonCompat(modelsUrl, { method: 'GET', headers });
      if (res && Array.isArray(res.data)) {
        modelIds = res.data.map(m => m.id || m.name).filter(Boolean);
      }
    } catch {
      const proxyRes = await fetchJsonCompat('/api/oai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStRequestHeadersCompat() },
        body: JSON.stringify({ api_url: base, api_key_openai: s.parallelWorldCustomApiKey }),
      });
      if (proxyRes && Array.isArray(proxyRes.data)) {
        modelIds = proxyRes.data.map(m => m.id || m.name).filter(Boolean);
      }
    }

    if (modelIds.length === 0) {
      setParallelWorldStatus('未获取到模型', 'warn');
    } else {
      s.parallelWorldCustomModelsCache = modelIds;
      saveSettings();
      fillParallelWorldModelSelect(modelIds, s.parallelWorldCustomModel);
      setParallelWorldStatus(`�?获取�?${modelIds.length} 个模型`, 'ok');
    }
  } catch (e) {
    setParallelWorldStatus(`�?刷新失败: ${e?.message || e}`, 'err');
  } finally {
    $btn.prop('disabled', false);
  }
}

function fillParallelWorldModelSelect(modelIds, selected) {
  const $sel = $('#sg_parallelWorldCustomModel');
  if (!$sel.length) return;
  $sel.empty();
  for (const id of modelIds) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (id === selected) opt.selected = true;
    $sel.append(opt);
  }
  if (modelIds.length && !modelIds.includes(selected)) {
    const opt = document.createElement('option');
    opt.value = selected;
    opt.textContent = selected + ' (当前)';
    opt.selected = true;
    $sel.prepend(opt);
  }
}

// 更新地图预览
function updateMapPreview() {
  try {
    const mapData = getMapData();
    const html = renderGridMap(mapData);
    const $preview = $('#sg_mapPreview');
    if ($preview.length) {
      $preview.html(html);
    }
  } catch (e) {
    console.warn('[StoryGuide] updateMapPreview error:', e);
  }
}

const MAP_JSON_REQUIREMENT = `输出要求�?
- 只输出严�?JSON，不�?Markdown、不要代码块、不要任何多余文字。`;

function getMapSchema() {
  return {
    type: 'object',
    properties: {
      currentLocation: { type: 'string' },
      newLocations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            connectedTo: { type: 'array', items: { type: 'string' } },
            group: { type: 'string' },
            layer: { type: 'string' },
            row: { type: 'number' },
            col: { type: 'number' },
          },
          required: ['name'],
          additionalProperties: true,
        },
      },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            event: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['location', 'event'],
          additionalProperties: true,
        },
      },
    },
    required: ['currentLocation', 'newLocations', 'events'],
    additionalProperties: true,
  };
}

function buildMapPromptMessages(snapshotText) {
  const s = ensureSettings();
  let sys = String(s.mapSystemPrompt || '').trim();
  if (!sys) sys = String(DEFAULT_SETTINGS.mapSystemPrompt || '').trim();
  sys = sys + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + MAP_JSON_REQUIREMENT;
  const user = String(snapshotText || '').trim();
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

async function updateMapFromSnapshot(snapshotText) {
  const s = ensureSettings();
  if (!s.mapEnabled) return;
  if (!isMapAutoUpdateEnabled(s)) return;
  const user = String(snapshotText || '').trim();
  if (!user) return;

  try {
    const messages = buildMapPromptMessages(user);
    let jsonText = '';
    if (s.provider === 'custom') {
      jsonText = await callViaCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream);
    } else {
      jsonText = await callViaSillyTavern(messages, getMapSchema(), s.temperature);
      if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
    }

    let parsed = parseMapLLMResponse(jsonText);
    if (!parsed) {
      try {
        const retryText = (s.provider === 'custom')
          ? await fallbackAskJsonCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream)
          : await fallbackAskJson(messages, s.temperature);
        parsed = parseMapLLMResponse(retryText);
      } catch { /* ignore */ }
    }
    if (!parsed) return;

    if (parsed?.newLocations) {
      parsed.newLocations = normalizeNewLocations(parsed.newLocations);
    }
    parsed = ensureMapMinimums(parsed);

    const merged = mergeMapData(getMapData(), parsed);
    await setMapData(merged);
    updateMapPreview();
  } catch (e) {
    console.warn('[StoryGuide] map update failed:', e);
  }
}

// 合并静态模块缓存到分析结果�?
function mergeStaticModulesIntoResult(parsedJson, modules) {
  const cache = getStaticModulesCache();
  const result = { ...parsedJson };

  for (const m of modules) {
    if (m.static && cache[m.key] !== undefined) {
      // 使用缓存值替代（如果AI此次没生成或我们跳过了生成）
      if (result[m.key] === undefined || result[m.key] === null || result[m.key] === '') {
        result[m.key] = cache[m.key];
      }
    }
  }

  return result;
}

// 更新静态模块缓�?
async function updateStaticModulesCache(parsedJson, modules) {
  const cache = getStaticModulesCache();
  let changed = false;

  for (const m of modules) {
    if (m.static && parsedJson[m.key] !== undefined && parsedJson[m.key] !== null && parsedJson[m.key] !== '') {
      // 只在首次生成或值有变化时更新缓�?
      if (cache[m.key] === undefined || JSON.stringify(cache[m.key]) !== JSON.stringify(parsedJson[m.key])) {
        cache[m.key] = parsedJson[m.key];
        changed = true;
      }
    }
  }

  if (changed) {
    await setStaticModulesCache(cache);
  }
}

// ===== 地图功能：提取和渲染 =====

// �?LLM 响应中提取地图数�?
function parseMapLLMResponse(responseText) {
  const parsed = safeJsonParse(responseText);
  if (!parsed) return null;
  return {
    currentLocation: String(parsed.currentLocation || '').trim(),
    newLocations: Array.isArray(parsed.newLocations) ? parsed.newLocations : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
  };
}

function ensureMapMinimums(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const out = {
    currentLocation: String(parsed.currentLocation || '').trim(),
    newLocations: Array.isArray(parsed.newLocations) ? parsed.newLocations.slice() : [],
    events: Array.isArray(parsed.events) ? parsed.events.slice() : [],
  };

  const existingNames = new Set(
    out.newLocations.map(l => String(l?.name || '').trim()).filter(Boolean)
  );

  let exploreCount = 0;
  for (const loc of out.newLocations) {
    const desc = String(loc?.description || '').trim();
    if (desc.includes('待探�?)) exploreCount += 1;
  }

  const desiredMin = 3;
  const desiredExploreMin = 2;
  const neededTotal = Math.max(0, desiredMin - out.newLocations.length);
  const neededExplore = Math.max(0, desiredExploreMin - exploreCount);
  const addCount = Math.max(neededTotal, neededExplore);

  if (addCount > 0) {
    const baseName = out.currentLocation ? `${out.currentLocation}·待探索` : '待探索地�?;
    for (let i = 0; i < addCount; i++) {
      let name = `${baseName}${i + 1} `;
      let n = 1;
      while (existingNames.has(name)) {
        n += 1;
        name = `${baseName}${i + 1} -${n} `;
      }
      existingNames.add(name);
      out.newLocations.push({
        name,
        description: '待探�?,
        connectedTo: out.currentLocation ? [out.currentLocation] : [],
        group: '',
        layer: '',
      });
    }
  }

  return out;
}

function normalizeNewLocations(list) {
  const result = [];
  const seen = new Map();
  for (const loc of Array.isArray(list) ? list : []) {
    const rawName = String(loc?.name || '').trim();
    if (!rawName) continue;
    const key = normalizeMapName(rawName);
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, {
        ...loc,
        name: rawName,
        connectedTo: Array.isArray(loc.connectedTo) ? loc.connectedTo.slice() : [],
      });
      result.push(seen.get(key));
      continue;
    }
    const existing = seen.get(key);
    // Merge connections
    const conn = Array.isArray(loc.connectedTo) ? loc.connectedTo : [];
    for (const c of conn) {
      if (!existing.connectedTo.includes(c)) existing.connectedTo.push(c);
    }
    // Prefer non-empty description/group/layer
    if (!existing.description && loc.description) existing.description = loc.description;
    if (!existing.group && loc.group) existing.group = loc.group;
    if (!existing.layer && loc.layer) existing.layer = loc.layer;
    // Prefer valid coordinates if existing lacks
    const hasRow = Number.isFinite(Number(existing.row));
    const hasCol = Number.isFinite(Number(existing.col));
    const newRow = Number.isFinite(Number(loc.row)) ? Number(loc.row) : null;
    const newCol = Number.isFinite(Number(loc.col)) ? Number(loc.col) : null;
    if ((!hasRow || !hasCol) && newRow != null && newCol != null) {
      existing.row = newRow;
      existing.col = newCol;
    }
  }
  return result;
}

function normalizeMapEvent(evt) {
  if (typeof evt === 'string') return { text: evt, tags: [] };
  if (!evt || typeof evt !== 'object') return null;
  const text = String(evt.event || evt.text || '').trim();
  if (!text) return null;
  const tags = Array.isArray(evt.tags) ? evt.tags.map(t => String(t || '').trim()).filter(Boolean) : [];
  return { text, tags };
}

function formatMapEventText(evt) {
  const text = typeof evt === 'string' ? evt : String(evt?.text || evt?.event || '').trim();
  const tags = Array.isArray(evt?.tags) ? evt.tags : [];
  const tagText = tags.length ? ` [${tags.join('/')}]` : '';
  return `${text}${tagText} `.trim();
}


// 合并新地图数据到现有地图
function mergeMapData(existingMap, newData) {
  if (!newData) return existingMap;

  const map = { ...existingMap, locations: { ...existingMap.locations } };
  const existingNameMap = new Map();
  for (const key of Object.keys(map.locations)) {
    const norm = normalizeMapName(key);
    if (norm) existingNameMap.set(norm, key);
  }

  // 更新主角位置
  if (newData.currentLocation) {
    const normalized = normalizeMapName(newData.currentLocation);
    const existingKey = existingNameMap.get(normalized);
    map.protagonistLocation = existingKey || newData.currentLocation;
    // 确保当前位置存在
    if (!map.locations[map.protagonistLocation]) {
      map.locations[map.protagonistLocation] = {
        row: 0, col: 0, connections: [], events: [], visited: true, description: ''
      };
    }
    map.locations[map.protagonistLocation].visited = true;
  }

  // 添加新地�?
  for (const loc of newData.newLocations) {
    const name = String(loc.name || '').trim();
    if (!name) continue;
    const normalized = normalizeMapName(name);
    const existingKey = existingNameMap.get(normalized);
    const targetKey = existingKey || name;

    if (!map.locations[targetKey]) {
      let row = Number.isFinite(Number(loc.row)) ? Number(loc.row) : null;
      let col = Number.isFinite(Number(loc.col)) ? Number(loc.col) : null;
      if (row == null || col == null) {
        const anchorName = Array.isArray(loc.connectedTo)
          ? loc.connectedTo.map(x => String(x || '').trim()).find(n => map.locations[n])
          : null;
        if (anchorName) {
          const anchor = map.locations[anchorName];
          const pos = findAdjacentGridPosition(map, anchor.row, anchor.col);
          row = pos.row;
          col = pos.col;
        } else {
          const pos = findNextGridPosition(map);
          row = pos.row;
          col = pos.col;
        }
      }
      map.locations[targetKey] = {
        row, col,
        connections: Array.isArray(loc.connectedTo) ? loc.connectedTo : [],
        events: [],
        visited: targetKey === map.protagonistLocation,
        description: String(loc.description || ''),
        group: String(loc.group || '').trim(),
        layer: String(loc.layer || '').trim(),
      };
      ensureGridSize(map, row, col);
      if (!existingKey && normalized) existingNameMap.set(normalized, targetKey);
    } else {
      // 更新现有地点的连�?
      if (Array.isArray(loc.connectedTo)) {
        for (const conn of loc.connectedTo) {
          if (!map.locations[targetKey].connections.includes(conn)) {
            map.locations[targetKey].connections.push(conn);
          }
        }
      }
      if (loc.group) map.locations[targetKey].group = String(loc.group || '').trim();
      if (loc.layer) map.locations[targetKey].layer = String(loc.layer || '').trim();
      const hasRow = Number.isFinite(Number(map.locations[targetKey].row));
      const hasCol = Number.isFinite(Number(map.locations[targetKey].col));
      const newRow = Number.isFinite(Number(loc.row)) ? Number(loc.row) : null;
      const newCol = Number.isFinite(Number(loc.col)) ? Number(loc.col) : null;
      if ((!hasRow || !hasCol) && newRow != null && newCol != null) {
        map.locations[targetKey].row = newRow;
        map.locations[targetKey].col = newCol;
        ensureGridSize(map, map.locations[targetKey].row, map.locations[targetKey].col);
      }
    }
  }

  // 添加事件
  for (const evt of newData.events) {
    const locName = String(evt.location || '').trim();
    const normalized = normalizeMapName(locName);
    const targetKey = existingNameMap.get(normalized) || locName;
    const eventObj = normalizeMapEvent(evt);
    if (locName && eventObj && map.locations[targetKey]) {
      const list = Array.isArray(map.locations[targetKey].events) ? map.locations[targetKey].events : [];
      const exists = list.some(e => String(e?.text || e?.event || e || '').trim() === eventObj.text);
      if (!exists) list.push(eventObj);
      map.locations[targetKey].events = list;
    }
  }

  // 更新双向连接
  for (const [name, loc] of Object.entries(map.locations)) {
    for (const conn of loc.connections) {
      if (map.locations[conn] && !map.locations[conn].connections.includes(name)) {
        map.locations[conn].connections.push(name);
      }
    }
  }

  map.lastUpdated = new Date().toISOString();
  return map;
}

function findAdjacentGridPosition(map, baseRow, baseCol) {
  const occupied = new Set();
  for (const loc of Object.values(map.locations)) {
    occupied.add(`${loc.row},${loc.col} `);
  }
  const candidates = [
    { row: baseRow - 1, col: baseCol },
    { row: baseRow + 1, col: baseCol },
    { row: baseRow, col: baseCol - 1 },
    { row: baseRow, col: baseCol + 1 },
    { row: baseRow - 1, col: baseCol - 1 },
    { row: baseRow - 1, col: baseCol + 1 },
    { row: baseRow + 1, col: baseCol - 1 },
    { row: baseRow + 1, col: baseCol + 1 },
  ];
  for (const pos of candidates) {
    if (pos.row < 0 || pos.col < 0) continue;
    if (!occupied.has(`${pos.row},${pos.col} `)) return pos;
  }
  return findNextGridPosition(map);
}

function ensureGridSize(map, row, col) {
  if (!map || !map.gridSize) return;
  const r = Number(row);
  const c = Number(col);
  if (!Number.isFinite(r) || !Number.isFinite(c)) return;
  if (r >= map.gridSize.rows) map.gridSize.rows = r + 1;
  if (c >= map.gridSize.cols) map.gridSize.cols = c + 1;
}

// 寻找网格中的下一个空�?
function findNextGridPosition(map) {
  const occupied = new Set();
  for (const loc of Object.values(map.locations)) {
    occupied.add(`${loc.row},${loc.col} `);
  }

  for (let r = 0; r < map.gridSize.rows; r++) {
    for (let c = 0; c < map.gridSize.cols; c++) {
      if (!occupied.has(`${r},${c} `)) {
        return { row: r, col: c };
      }
    }
  }
  // 扩展网格
  map.gridSize.rows++;
  return { row: map.gridSize.rows - 1, col: 0 };
}

// 渲染网格地图�?HTML（纯 HTML/CSS 网格�?
function renderGridMap(mapData) {
  if (!mapData || Object.keys(mapData.locations).length === 0) {
    return `<div class="sg-map-empty" > 暂无地图数据。开启地图功能并进行剧情分析后，地图将自动生成�?/div> `;
  }

  const locList = Object.values(mapData.locations);
  const rawRows = locList.map(l => Number(l.row)).filter(Number.isFinite);
  const rawCols = locList.map(l => Number(l.col)).filter(Number.isFinite);
  const rowVals = Array.from(new Set(rawRows)).sort((a, b) => a - b);
  const colVals = Array.from(new Set(rawCols)).sort((a, b) => a - b);
  const maxDim = 20;
  const rowCount = Math.max(mapData.gridSize.rows, rowVals.length || mapData.gridSize.rows);
  const colCount = Math.max(mapData.gridSize.cols, colVals.length || mapData.gridSize.cols);
  const rows = Math.min(maxDim, rowCount);
  const cols = Math.min(maxDim, colCount);

  const mapIndex = (vals, v, limit) => {
    const idx = vals.indexOf(v);
    if (idx < 0) return null;
    if (vals.length <= limit) return idx;
    return Math.round(idx * (limit - 1) / Math.max(1, vals.length - 1));
  };

  const findNextEmptyCell = (grid, startRow, startCol) => {
    const rLen = grid.length;
    const cLen = grid[0]?.length || 0;
    for (let r = startRow; r < rLen; r++) {
      for (let c = (r === startRow ? startCol : 0); c < cLen; c++) {
        if (!grid[r][c]) return { row: r, col: c };
      }
    }
    for (let r = 0; r < rLen; r++) {
      for (let c = 0; c < cLen; c++) {
        if (!grid[r][c]) return { row: r, col: c };
      }
    }
    return null;
  };

  const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));

  // 填充网格
  for (const [name, loc] of Object.entries(mapData.locations)) {
    const rr = mapIndex(rowVals, Number(loc.row), rows);
    const cc = mapIndex(colVals, Number(loc.col), cols);
    if (Number.isFinite(rr) && Number.isFinite(cc) && rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
      if (!grid[rr][cc]) {
        grid[rr][cc] = { name, ...loc };
      } else {
        const next = findNextEmptyCell(grid, rr, cc);
        if (next) grid[next.row][next.col] = { name, ...loc };
      }
    }
  }

  // 渲染 HTML（使�?CSS Grid�?
  const gridInlineStyle = `display: grid; grid-template-columns: repeat(${cols}, 80px); grid-auto-rows: 50px; gap: 4px; justify-content: center; `;
  const baseCellStyle = 'width:80px;height:50px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;text-align:center;position:relative;';
  const emptyCellStyle = baseCellStyle + 'background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.08);';
  const locationBaseStyle = baseCellStyle + 'background:rgba(100,150,200,0.2);border:1px solid rgba(100,150,200,0.35);';

  let html = `<div class="sg-map-wrapper" > `;
  html += `<div class="sg-map-grid" style= "--sg-map-cols:${cols};${gridInlineStyle}" > `;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell) {
        const isProtagonist = cell.name === mapData.protagonistLocation;
        const hasEvents = cell.events && cell.events.length > 0;
        const classes = ['sg-map-cell', 'sg-map-location'];
        if (isProtagonist) classes.push('sg-map-protagonist');
        if (hasEvents) classes.push('sg-map-has-events');
        if (!cell.visited) classes.push('sg-map-unvisited');

        const eventList = hasEvents ? cell.events.map(e => `�?${formatMapEventText(e)} `).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n') : '';
        const tooltip = `${cell.name}${cell.description ? '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + cell.description : ''}${eventList ? '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n---        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + eventList : ''} `;

        let inlineStyle = locationBaseStyle;
        if (isProtagonist) inlineStyle += 'background:rgba(100,200,100,0.25);border-color:rgba(100,200,100,0.5);box-shadow:0 0 8px rgba(100,200,100,0.3);';
        if (hasEvents) inlineStyle += 'border-color:rgba(255,180,80,0.5);';
        if (!cell.visited) inlineStyle += 'background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);opacity:0.6;';
        const eventsJson = escapeHtml(JSON.stringify(Array.isArray(cell.events) ? cell.events : []));
        const descAttr = escapeHtml(String(cell.description || ''));
        const nameAttr = escapeHtml(String(cell.name || ''));
        const groupAttr = escapeHtml(String(cell.group || ''));
        const layerAttr = escapeHtml(String(cell.layer || ''));
        html += `<div class="${classes.join(' ')}" style= "${inlineStyle}" title= "${escapeHtml(tooltip)}" data-name="${nameAttr}" data-desc="${descAttr}" data-events="${eventsJson}" data-group="${groupAttr}" data-layer="${layerAttr}" > `;
        if (cell.layer || cell.group) {
          html += `<div class="sg-map-badges" > `;
          if (cell.layer) html += `<span class="sg-map-badge sg-map-badge-layer" title= "${escapeHtml(String(cell.layer))}" > ${escapeHtml(String(cell.layer || '').slice(0, 2))}</span> `;
          if (cell.group) html += `<span class="sg-map-badge sg-map-badge-group" title= "${escapeHtml(String(cell.group))}" > ${escapeHtml(String(cell.group || '').slice(0, 2))}</span> `;
          html += `</div> `;
        }
        html += `<span class="sg-map-name" > ${escapeHtml(cell.name)}</span> `;
        if (isProtagonist) html += '<span class="sg-map-marker">�?/span>';
        if (hasEvents) html += '<span class="sg-map-event-marker">�?/span>';
        html += '</div>';
      } else {
        html += `<div class="sg-map-cell sg-map-empty-cell" style= "${emptyCellStyle}" ></div> `;
      }
    }
  }

  html += '</div>';
  html += '<div class="sg-map-legend">�?主角位置 | �?有事�?| 灰色 = 未探�?/div>';
  html += '<div class="sg-map-event-panel">点击地点查看事件列表</div>';
  html += '</div>';

  return html;
}

// 清除静态模块缓存（手动刷新时使用）
async function clearStaticModulesCache() {
  await setStaticModulesCache({});
}

// 清除结构化条目缓存（人物/装备/势力/成就/副职�?任务�?
async function clearStructuredEntriesCache() {
  const meta = getSummaryMeta();
  meta.characterEntries = {};
  meta.equipmentEntries = {};
  meta.inventoryEntries = {};
  meta.factionEntries = {};
  meta.achievementEntries = {};
  meta.subProfessionEntries = {};
  meta.questEntries = {};
  meta.conquestEntries = {};
  meta.nextCharacterIndex = 1;
  meta.nextEquipmentIndex = 1;
  meta.nextInventoryIndex = 1;
  meta.nextFactionIndex = 1;
  meta.nextAchievementIndex = 1;
  meta.nextSubProfessionIndex = 1;
  meta.nextQuestIndex = 1;
  meta.nextConquestIndex = 1;
  await setSummaryMeta(meta);
}


function setStatus(text, kind = '') {
  const $s = $('#sg_status');
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
}

// -------------------- character builder --------------------

function setCharacterStatus(text, kind = '') {
  const $s = $('#sg_char_status');
  if (!$s.length) return;
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
}

function setSexGuideStatus(text, kind = '') {
  const $s = $('#sg_sex_status');
  if (!$s.length) return;
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
}

function setSexGuidePanelStatus(text, kind = '') {
  const $s = $('#sg_sex_panel_status');
  if (!$s.length) return;
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
}

function updateCharacterCustomRows() {
  const parkVal = String($('#sg_char_park').val() || '');
  const raceVal = String($('#sg_char_race').val() || '');
  const talentVal = String($('#sg_char_talent').val() || '');
  $('#sg_char_park_custom_row').toggle(parkVal === 'CUSTOM');
  $('#sg_char_park_traits_row').toggle(parkVal === 'CUSTOM' || !!$('#sg_char_park_traits').val());
  $('#sg_char_race_custom_row').toggle(raceVal === 'CUSTOM');
  $('#sg_char_race_desc_row').toggle(raceVal === 'CUSTOM' || !!$('#sg_char_race_desc').val());
  $('#sg_char_talent_custom_row').toggle(talentVal === 'CUSTOM');
  $('#sg_char_talent_desc_row').toggle(talentVal === 'CUSTOM' || !!$('#sg_char_talent_desc').val());
}

function getCharacterDifficulty() {
  return clampInt($('#sg_char_difficulty').val(), 10, 50, 30);
}

function getCharacterAttributes() {
  return {
    con: clampInt($('#sg_char_attr_con').val(), 0, 20, 0),
    int: clampInt($('#sg_char_attr_int').val(), 0, 20, 0),
    cha: clampInt($('#sg_char_attr_cha').val(), 0, 20, 0),
    str: clampInt($('#sg_char_attr_str').val(), 0, 20, 0),
    agi: clampInt($('#sg_char_attr_agi').val(), 0, 20, 0),
    luk: clampInt($('#sg_char_attr_luk').val(), 0, 20, 0),
  };
}

function updateCharacterAttributeSummary() {
  const max = getCharacterDifficulty();
  const attrs = getCharacterAttributes();
  const total = Object.values(attrs).reduce((sum, val) => sum + val, 0);
  const remain = max - total;
  $('#sg_char_attr_total').text(`已分配：${total}`);
  $('#sg_char_attr_remain').text(`剩余�?{remain}`).toggleClass('sg-character-over', remain < 0);
}

function updateCharacterForm() {
  updateCharacterCustomRows();
  updateCharacterAttributeSummary();
}

function applyCharacterSelectValue($select, value, $customInput) {
  const val = String(value || '').trim();
  // Safe filtering that handles quotes correctly
  const hasOption = val && $select.find('option').filter(function () {
    return this.value === val;
  }).length > 0;

  if (hasOption) {
    $select.val(val);
    if ($customInput) $customInput.val('');
    return;
  }
  if (val) {
    $select.val('CUSTOM');
    if ($customInput) $customInput.val(val);
    return;
  }
  $select.val('');
  if ($customInput) $customInput.val('');
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomSelectOption($select, allowCustom, customSetter) {
  const values = $select.find('option').map((_, opt) => opt.value).get().filter(Boolean);
  let pick = randomChoice(values);
  if (allowCustom && Math.random() < 0.25) pick = 'CUSTOM';
  $select.val(pick);
  if (pick === 'CUSTOM' && typeof customSetter === 'function') customSetter();
}

function allocateRandomAttributes(maxPoints) {
  const keys = ['con', 'int', 'cha', 'str', 'agi', 'luk'];
  const values = Object.fromEntries(keys.map((key) => [key, 0]));
  let remaining = Math.max(0, maxPoints);
  while (remaining > 0) {
    const available = keys.filter((key) => values[key] < 20);
    if (!available.length) break;
    const key = randomChoice(available);
    values[key] += 1;
    remaining -= 1;
  }
  $('#sg_char_attr_con').val(values.con);
  $('#sg_char_attr_int').val(values.int);
  $('#sg_char_attr_cha').val(values.cha);
  $('#sg_char_attr_str').val(values.str);
  $('#sg_char_attr_agi').val(values.agi);
  $('#sg_char_attr_luk').val(values.luk);
}

function randomizeCharacterLocal() {
  const parkCustomNames = ['灰雾乐园', '霜烬乐园', '星痕乐园', '寂潮乐园', '暮影乐园'];
  const parkTraits = [
    '规则偏向高风险试炼，奖励倾向增幅型契约�?,
    '惩罚与补偿并行，任务节奏偏向短而密集�?,
    '鼓励情报交换与团队协同，独行者收益衰减�?,
    '以存活为先，任务失败会触发连锁惩戒�?,
    '偏向潜行与智谋型任务，正面突破收益降低�?
  ];
  const raceCustomNames = ['灰雾�?, '霜纹�?, '星砂�?, '赤潮�?, '幽烬�?];
  const talentCustomNames = ['雾行�?, '刻印猎手', '逆光共鸣', '星幕行旅', '零度誓约'];

  randomSelectOption($('#sg_char_park'), true, () => {
    $('#sg_char_park_custom').val(randomChoice(parkCustomNames));
    $('#sg_char_park_traits').val(randomChoice(parkTraits));
  });

  randomSelectOption($('#sg_char_race'), true, () => {
    $('#sg_char_race_custom').val(randomChoice(raceCustomNames));
  });

  randomSelectOption($('#sg_char_talent'), true, () => {
    $('#sg_char_talent_custom').val(randomChoice(talentCustomNames));
  });

  $('#sg_char_contract').val(`R-${Math.floor(Math.random() * 9000) + 1000}`);

  const difficultyValues = ['10', '20', '30', '40', '50'];
  $('#sg_char_difficulty').val(randomChoice(difficultyValues));
  allocateRandomAttributes(getCharacterDifficulty());

  updateCharacterForm();
  setCharacterStatus('· 已随机生成，可继续调整后生成文本 ·', 'ok');
}


async function randomizeCharacterWithLLM() {
  const s = ensureSettings();
  setCharacterStatus('· 正在请求 AI 随机设定�?·', 'warn');

  // Construct prompt
  const customPrompt = String(s.characterRandomPrompt || '').trim();
  const userPrompt = customPrompt || `请为“轮回乐园”设计一个全新的契约者角色�?
要求�?
1. 随机选择一个乐园（轮回/圣域/守望/圣光/死亡/天启）�?
2. 随机选择一个种族（人类/精灵/兽人/半魔/机巧/异界）�?
3. 随机设计一个初始天赋（名字+简述）�?
4. 设定难度�?30"（灰雾常阶）�?
5. 分配30点属性（体质/智力/魅力/力量/敏捷/幸运），每项0-20，总和必须等于30�?
6. 输出 JSON 格式�?
{
  "park": "乐园�?,
  "race": "种族�?,
  "talent": "天赋�?,
  "attrs": { "con": 5, "int": 5, "cha": 5, "str": 5, "agi": 5, "luk": 5 }
}`;

  try {
    let result = '';
    // Use the character provider settings (same as character text generation)
    if (String(s.characterProvider || 'st') === 'custom') {
      result = await callViaCustom(
        s.characterCustomEndpoint,
        s.characterCustomApiKey,
        s.characterCustomModel,
        [{ role: 'user', content: userPrompt }],
        0.7,
        s.characterCustomMaxTokens || 2048,
        0.95,
        false
      );
    } else {
      result = await callViaSillyTavern([{ role: 'user', content: userPrompt }], null, 0.7);
    }

    // Parse JSON
    // 1. Try to find JSON block code
    let text = result;
    const codeBlockMatch = text.match(/```(?:json)?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;})        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*```/i);
    if (codeBlockMatch) {
      text = codeBlockMatch[1];
    } else {
      // 2. Fallback: match first { to last }
      const braceMatch = text.match(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/);
      if (braceMatch) text = braceMatch[0];
    }

    // 3. Cleanup comments if any (simple)
    // text = text.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/.*$/gm, ''); // risky if url contains //

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error('JSON Parse Error:', err, text);
      throw new Error('AI 返回数据格式错误（非标准 JSON�?);
    }

    if (!data.park || !data.race || !data.talent || !data.attrs) throw new Error('JSON 缺少必要字段');

    // Helper to sanitize
    const sanitize = (val) => {
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0) return sanitize(val[0]);
      if (typeof val === 'object' && val !== null) {
        if (val.name) return String(val.name);
        if (val.title) return String(val.title);
        if (val.value) return String(val.value);
        // fallback to stringify
        return JSON.stringify(val);
      }
      return String(val || '');
    };

    const getDesc = (val) => {
      if (typeof val === 'object' && val !== null) {
        if (val.desc) return String(val.desc);
        // Construct desc from talent fields if available
        let parts = [];
        if (val.mechanism) parts.push(`机制�?{val.mechanism}`);
        if (val.benefit) parts.push(`收益�?{val.benefit}`);
        if (val.cost) parts.push(`代价�?{val.cost}`);
        if (val.trigger) parts.push(`触发�?{val.trigger}`);
        if (val.growth) parts.push(`成长�?{val.growth}`);
        if (parts.length) return parts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
      }
      return '';
    };

    // Fill UI
    $('#sg_char_park').val('CUSTOM');
    $('#sg_char_park_custom').val(sanitize(data.park));
    // If park is object with desc, fill traits
    if (typeof data.park === 'object' && data.park.desc) {
      $('#sg_char_park_traits').val(String(data.park.desc));
    }

    $('#sg_char_race').val('CUSTOM');
    $('#sg_char_race_custom').val(sanitize(data.race));
    $('#sg_char_race_desc').val(getDesc(data.race));

    $('#sg_char_talent').val('CUSTOM');
    $('#sg_char_talent_custom').val(sanitize(data.talent));
    $('#sg_char_talent_desc').val(getDesc(data.talent));

    // Difficulty
    let diffVal = '30';
    if (data.difficulty) {
      if (typeof data.difficulty === 'object') diffVal = String(data.difficulty.value || '30');
      else diffVal = String(data.difficulty);
    }
    $('#sg_char_difficulty').val(diffVal);

    // Attributes
    const attrs = data.attrs || {};
    $('#sg_char_attr_con').val(attrs.con || 0);
    $('#sg_char_attr_int').val(attrs.int || 0);
    $('#sg_char_attr_cha').val(attrs.cha || 0);
    $('#sg_char_attr_str').val(attrs.str || 0);
    $('#sg_char_attr_agi').val(attrs.agi || 0);
    $('#sg_char_attr_luk').val(attrs.luk || 0);

    // Contract ID (Stage if present, or generate)
    if (data.stage && !data.contractId) {
      // Just keep existing or random? 
    }
    if (data.contractId) $('#sg_char_contract').val(data.contractId);
    else if (!$('#sg_char_contract').val()) {
      $('#sg_char_contract').val(`R-${Math.floor(Math.random() * 9000) + 1000}`);
    }

    updateCharacterForm(); // Will handle visibility of custom rows

    // Explicitly show desc rows if they have content
    if ($('#sg_char_race_desc').val()) $('#sg_char_race_desc_row').show();
    if ($('#sg_char_talent_desc').val()) $('#sg_char_talent_desc_row').show();
    setCharacterStatus('· AI 随机设定已完�?·', 'ok');

  } catch (e) {
    console.error('AI Random Failed:', e);
    setCharacterStatus(`· AI 随机失败�?{e.message} ·`, 'err');
  }
}

function buildCharacterPayload() {
  const parkValue = String($('#sg_char_park').val() || '');
  const raceValue = String($('#sg_char_race').val() || '');
  const talentValue = String($('#sg_char_talent').val() || '');
  const parkCustom = String($('#sg_char_park_custom').val() || '').trim();
  const parkTraits = String($('#sg_char_park_traits').val() || '').trim();
  const raceCustom = String($('#sg_char_race_custom').val() || '').trim();
  const raceDesc = String($('#sg_char_race_desc').val() || '').trim();
  const talentCustom = String($('#sg_char_talent_custom').val() || '').trim();
  const talentDesc = String($('#sg_char_talent_desc').val() || '').trim();
  const contractId = String($('#sg_char_contract').val() || '').trim();

  const park = parkValue === 'CUSTOM' ? parkCustom : parkValue;
  const race = raceValue === 'CUSTOM' ? raceCustom : raceValue;
  const talent = talentValue === 'CUSTOM' ? talentCustom : talentValue;
  const difficulty = getCharacterDifficulty();
  const attrs = getCharacterAttributes();
  const total = Object.values(attrs).reduce((sum, val) => sum + val, 0);

  if (!park) return { error: '请选择乐园或填写自定义乐园�? };
  if (!race) return { error: '请选择种族或填写自定义种族�? };
  if (!talent) return { error: '请选择天赋或填写自定义天赋�? };
  if (total > difficulty) return { error: '属性点超出当前难度上限�? };
  if (Object.values(attrs).some((v) => v > 20)) return { error: '单项属性不得超�?0�? };

  return {
    park,
    parkTraits,
    race,
    raceDesc,
    talent,
    talentDesc,
    contractId,
    difficulty,
    attrs,
    total
  };
}

async function generateCharacterText() {
  const s = ensureSettings();
  const payload = buildCharacterPayload();
  if (payload.error) {
    setCharacterStatus(`· ${payload.error} ·`, 'warn');
    return;
  }

  const attributeText = `体质${payload.attrs.con} 智力${payload.attrs.int} 魅力${payload.attrs.cha} 力量${payload.attrs.str} 敏捷${payload.attrs.agi} 幸运${payload.attrs.luk}`;
  const parkTraits = payload.parkTraits ? payload.parkTraits : '未登�?;
  const raceDesc = payload.raceDesc ? payload.raceDesc : '未详细描�?;
  const talentDesc = payload.talentDesc ? payload.talentDesc : '未详细描�?;
  const contractId = payload.contractId || '随机分配�?;

  const customOpeningPrompt = String(s.characterOpeningPrompt || '').trim();
  const systemPrompt = customOpeningPrompt || '你是“轮回乐园”世界观的开场文本写作助手。只输出正文文本，不�?JSON，不要代码块�?;

  const userPrompt =
    `根据以下设定生成开场文本，中文，约 500~900 字：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 所属乐园：${payload.park}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 乐园特点�?{parkTraits}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 种族�?{payload.race}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 种族描述�?{raceDesc}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 初始天赋�?{payload.talent}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 天赋详情�?{talentDesc}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 契约者编号：${contractId}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
    `- 六维属性：${attributeText}（总计${payload.total}/${payload.difficulty}，单�?=20）\n` +
    `要求：必须包含一段系统提示块（Markdown 引用 >），其中列出乐园/种族/天赋/编号/六维属�?乐园特点。最后以“触碰印记”作为收束。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  setCharacterStatus('· 正在生成开场文本�?·', 'warn');

  try {
    let text = '';
    if (String(s.characterProvider || 'st') === 'custom') {
      text = await callViaCustom(
        s.characterCustomEndpoint,
        s.characterCustomApiKey,
        s.characterCustomModel,
        messages,
        s.characterTemperature,
        s.characterCustomMaxTokens,
        0.95,
        s.characterCustomStream
      );
    } else {
      text = await callViaSillyTavern(messages, null, s.characterTemperature);
    }
    $('#sg_char_output').val(String(text || '').trim());
    setCharacterStatus('· 已生成：可复制或填入聊天输入框（不会自动发送） ·', 'ok');
  } catch (e) {
    console.error('[StoryGuide] 角色生成失败:', e);
    setCharacterStatus(`· 生成失败�?{e?.message ?? e} ·`, 'err');
  }
}


function ensureToast() {
  if ($('#sg_toast').length) return;
  $('body').append(`
    <div id="sg_toast" class="sg-toast info" style="display:none" role="status" aria-live="polite">
      <div class="sg-toast-inner">
        <div class="sg-toast-spinner" aria-hidden="true"></div>
        <div class="sg-toast-text" id="sg_toast_text"></div>
      </div>
    </div>
  `);
}

function hideToast() {
  const $t = $('#sg_toast');
  if (!$t.length) return;
  $t.removeClass('visible spinner');
  // delay hide for transition
  setTimeout(() => { $t.hide(); }, 180);
}

function showToast(text, { kind = 'info', spinner = false, sticky = false, duration = 1700 } = {}) {
  ensureToast();
  const $t = $('#sg_toast');
  const $txt = $('#sg_toast_text');
  $txt.text(text || '');
  $t.removeClass('ok warn err info').addClass(kind || 'info');
  $t.toggleClass('spinner', !!spinner);
  $t.show(0);
  // trigger transition
  requestAnimationFrame(() => { $t.addClass('visible'); });

  if (sgToastTimer) { clearTimeout(sgToastTimer); sgToastTimer = null; }
  if (!sticky) {
    sgToastTimer = setTimeout(() => { hideToast(); }, clampInt(duration, 500, 10000, 1700));
  }
}


function updateButtonsEnabled() {
  const ok = Boolean(lastReport?.markdown);
  $('#sg_copyMd').prop('disabled', !ok);
  $('#sg_copyJson').prop('disabled', !Boolean(lastJsonText));
  $('#sg_injectTips').prop('disabled', !ok);
  $('#sg_copySum').prop('disabled', !Boolean(lastSummaryText));
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
  if (!mods) return { ok: false, error: '模块配置必须�?JSON 数组�?, modules: null };

  const seen = new Set();
  const normalized = [];

  for (const m of mods) {
    if (!m || typeof m !== 'object') continue;
    const key = String(m.key || '').trim();
    if (!key) continue;
    if (seen.has(key)) return { ok: false, error: `模块 key 重复�?{key}`, modules: null };
    seen.add(key);

    const type = String(m.type || 'text').trim();
    if (type !== 'text' && type !== 'list') return { ok: false, error: `模块 ${key} �?type 必须�?"text" �?"list"`, modules: null };

    const title = String(m.title || key).trim();
    const prompt = String(m.prompt || '').trim();

    const required = m.required !== false; // default true
    const panel = m.panel !== false;       // default true
    const inline = m.inline === true;      // default false unless explicitly true
    const isStatic = m.static === true;    // default false: 静态模块只在首次或手动刷新时生�?

    const maxItems = (type === 'list' && Number.isFinite(Number(m.maxItems))) ? clampInt(m.maxItems, 1, 50, 8) : undefined;

    normalized.push({ key, title, type, prompt, required, panel, inline, static: isStatic, ...(maxItems ? { maxItems } : {}) });
  }

  if (!normalized.length) return { ok: false, error: '模块配置为空：至少需�?1 个模块�?, modules: null };
  return { ok: true, error: '', modules: normalized };
}



// -------------------- presets & worldbook --------------------

function normalizeImageGenPresetName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return trimmed.slice(0, 64);
}

function getImageGenPresetList() {
  const s = ensureSettings();
  const raw = String(s.imageGenPresetList || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setImageGenPresetList(list) {
  const s = ensureSettings();
  s.imageGenPresetList = JSON.stringify(list || [], null, 2);
  saveSettings();
}

function getImageGenPresetSnapshot() {
  const s = ensureSettings();
  return {
    imageGenSystemPrompt: s.imageGenSystemPrompt,
    imageGenArtistPromptEnabled: s.imageGenArtistPromptEnabled,
    imageGenArtistPrompt: s.imageGenArtistPrompt,
    imageGenPromptRulesEnabled: s.imageGenPromptRulesEnabled,
    imageGenPromptRules: s.imageGenPromptRules,
    imageGenBatchEnabled: s.imageGenBatchEnabled,
    imageGenBatchPatterns: s.imageGenBatchPatterns,
    imageGenCustomMaxTokens: s.imageGenCustomMaxTokens,
    imageGenCharacterProfilesEnabled: s.imageGenCharacterProfilesEnabled,
    imageGenCharacterProfiles: s.imageGenCharacterProfiles,
    imageGenCustomFemalePrompt1: s.imageGenCustomFemalePrompt1,
    imageGenCustomFemalePrompt2: s.imageGenCustomFemalePrompt2,
    imageGenProfilesExpanded: s.imageGenProfilesExpanded


  };
}

function normalizeSexGuidePresetName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return trimmed.slice(0, 64);
}

function getSexGuidePresetList() {
  const s = ensureSettings();
  const raw = String(s.sexGuidePresetList || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSexGuidePresetList(list) {
  const s = ensureSettings();
  s.sexGuidePresetList = JSON.stringify(list || [], null, 2);
  saveSettings();
}

function getSexGuidePresetSnapshot() {
  const s = ensureSettings();
  return {
    sexGuideSystemPrompt: s.sexGuideSystemPrompt,
    sexGuideUserTemplate: s.sexGuideUserTemplate,
    sexGuideUserNeed: s.sexGuideUserNeed,
    sexGuideIncludeUserInput: s.sexGuideIncludeUserInput,
    sexGuideTemperature: s.sexGuideTemperature,
    sexGuideCustomMaxTokens: s.sexGuideCustomMaxTokens,
    sexGuideCustomTopP: s.sexGuideCustomTopP,
    sexGuideWorldbookEnabled: s.sexGuideWorldbookEnabled,
    sexGuideWorldbookMaxChars: s.sexGuideWorldbookMaxChars
  };
}

function applySexGuidePresetSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const s = ensureSettings();
  const keys = Object.keys(getSexGuidePresetSnapshot());
  for (const k of keys) {
    if (!Object.hasOwn(snapshot, k)) continue;
    if (k === 'sexGuideCustomMaxTokens') {
      s[k] = clampInt(snapshot[k], 128, 200000, s[k] || 2048);
      continue;
    }
    if (k === 'sexGuideWorldbookMaxChars') {
      s[k] = clampInt(snapshot[k], 500, 200000, s[k] || 6000);
      continue;
    }
    s[k] = snapshot[k];
  }
  saveSettings();
  pullSettingsToUi();
}

function resolveSexGuidePresetFromSillyPreset(rawText, nameFallback) {
  const normalizedText = normalizeJsonPresetText(rawText);
  if (!normalizedText) return null;
  let data = null;
  try { data = JSON.parse(normalizedText); } catch { return null; }
  if (!data || typeof data !== 'object') return null;

  const name = normalizeSexGuidePresetName(
    data.name || data.preset_name || data.title || data.presetTitle || nameFallback || '对话预设'
  );
  const snapshot = {
    sexGuideCustomMaxTokens: clampInt(
      data.openai_max_tokens ?? data.max_tokens ?? data.maxTokens,
      128,
      200000,
      2048
    )
  };

  if (data.temperature !== undefined && data.temperature !== null) {
    snapshot.sexGuideTemperature = clampFloat(data.temperature, 0, 2, 0.6);
  }

  const prompts = findPromptPresetValue(data);
  if (Array.isArray(prompts)) {
    const systemParts = prompts
      .filter(p => p && typeof p === 'object' && String(p.role || '').toLowerCase() === 'system')
      .map(p => String(p.content || '').trim())
      .filter(Boolean);
    if (systemParts.length) {
      snapshot.sexGuideSystemPrompt = systemParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
    }
  }

  return { name, snapshot };
}

function normalizeStructuredPresetName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return trimmed.slice(0, 64);
}

function getStructuredPresetList() {
  const s = ensureSettings();
  const raw = String(s.structuredPresetList || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setStructuredPresetList(list) {
  const s = ensureSettings();
  s.structuredPresetList = JSON.stringify(list || [], null, 2);
  saveSettings();
}

function getStructuredPresetSnapshot() {
  const s = ensureSettings();
  return {
    structuredEntriesSystemPrompt: s.structuredEntriesSystemPrompt,
    structuredEntriesUserTemplate: s.structuredEntriesUserTemplate,
    structuredCharacterPrompt: s.structuredCharacterPrompt,
    structuredCharacterEntryTemplate: s.structuredCharacterEntryTemplate,
    structuredEquipmentPrompt: s.structuredEquipmentPrompt,
    structuredEquipmentEntryTemplate: s.structuredEquipmentEntryTemplate,
    structuredInventoryPrompt: s.structuredInventoryPrompt,
    structuredInventoryEntryTemplate: s.structuredInventoryEntryTemplate,
    structuredFactionPrompt: s.structuredFactionPrompt,
    structuredFactionEntryTemplate: s.structuredFactionEntryTemplate,
    structuredAchievementPrompt: s.structuredAchievementPrompt,
    structuredAchievementEntryTemplate: s.structuredAchievementEntryTemplate,
    structuredSubProfessionPrompt: s.structuredSubProfessionPrompt,
    structuredSubProfessionEntryTemplate: s.structuredSubProfessionEntryTemplate,
    structuredQuestPrompt: s.structuredQuestPrompt,
    structuredQuestEntryTemplate: s.structuredQuestEntryTemplate,
    structuredConquestPrompt: s.structuredConquestPrompt,
    structuredConquestEntryTemplate: s.structuredConquestEntryTemplate
  };
}

function applyStructuredPresetSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const s = ensureSettings();
  const keys = Object.keys(getStructuredPresetSnapshot());
  for (const k of keys) {
    if (!Object.hasOwn(snapshot, k)) continue;
    s[k] = snapshot[k];
  }
  saveSettings();
  pullSettingsToUi();
}

function resolveStructuredPresetFromSillyPreset(rawText, nameFallback) {
  const normalizedText = normalizeJsonPresetText(rawText);
  if (!normalizedText) return null;
  let data = null;
  try { data = JSON.parse(normalizedText); } catch { return null; }
  if (!data || typeof data !== 'object') return null;

  const name = normalizeStructuredPresetName(
    data.name || data.preset_name || data.title || data.presetTitle || nameFallback || '对话预设'
  );
  const snapshot = {};

  const prompts = findPromptPresetValue(data);
  if (Array.isArray(prompts)) {
    const systemParts = prompts
      .filter(p => p && typeof p === 'object' && String(p.role || '').toLowerCase() === 'system')
      .map(p => String(p.content || '').trim())
      .filter(Boolean);
    if (systemParts.length) {
      snapshot.structuredEntriesSystemPrompt = systemParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
    }
  }

  return { name, snapshot };
}

function applyImageGenPresetSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const s = ensureSettings();
  const keys = Object.keys(getImageGenPresetSnapshot());
  for (const k of keys) {
    if (!Object.hasOwn(snapshot, k)) continue;
    if (k === 'imageGenCustomMaxTokens') {
      s[k] = clampInt(snapshot[k], 128, 200000, s[k] || DEFAULT_SETTINGS.imageGenCustomMaxTokens || 1024);
      continue;
    }
    s[k] = snapshot[k];
  }
  saveSettings();
  pullSettingsToUi();
}

function downloadTextFile(filename, text, mime = 'application/json') {

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

function normalizeJsonPresetText(rawText) {
  if (!rawText) return '';
  let data = null;
  try { data = JSON.parse(rawText); } catch { return ''; }
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return ''; }
  }
  for (let i = 0; i < 4; i += 1) {
    if (!data || typeof data !== 'object') break;
    const wrappers = ['data', 'payload', 'preset', 'result', 'settings'];
    let changed = false;
    for (const k of wrappers) {
      const v = data?.[k];
      if (typeof v === 'string') {
        const t = v.trim();
        if (t && (t.startsWith('{') || t.startsWith('['))) {
          try { data = JSON.parse(t); changed = true; break; } catch { /* ignore */ }
        }
      } else if (v && typeof v === 'object') {
        data = v;
        changed = true;
        break;
      }
    }
    if (!changed) break;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { break; }
    }
  }
  if (!data || typeof data !== 'object') return '';
  return JSON.stringify(data);
}

function findPromptPresetValue(data) {
  if (!data || typeof data !== 'object') return null;
  const directKeys = ['prompts', 'prompt', 'prompt_array', 'promptArray'];
  for (const key of directKeys) {
    if (!Object.hasOwn(data, key)) continue;
    const v = data[key];
    if (Array.isArray(v)) return v;
  }
  if (data.prompts && typeof data.prompts === 'object') {
    const arr = Object.values(data.prompts).filter(item => item && typeof item === 'object');
    if (arr.length) return arr;
  }
  return null;
}

function resolveImageGenPresetFromSillyPreset(rawText, nameFallback) {
  const normalizedText = normalizeJsonPresetText(rawText);
  if (!normalizedText) return null;
  let data = null;
  try { data = JSON.parse(normalizedText); } catch { return null; }
  if (!data || typeof data !== 'object') return null;

  const name = normalizeImageGenPresetName(
    data.name || data.preset_name || data.title || data.presetTitle || nameFallback || '对话预设'
  );
  const snapshot = {
    imageGenCustomMaxTokens: clampInt(
      data.openai_max_tokens ?? data.max_tokens ?? data.maxTokens,
      128,
      200000,
      DEFAULT_SETTINGS.imageGenCustomMaxTokens || 1024
    )
  };

  if (data.temperature !== undefined && data.temperature !== null) {
    snapshot.imageGenSystemPrompt = DEFAULT_SETTINGS.imageGenSystemPrompt;
    snapshot.imageGenPromptRulesEnabled = false;
    snapshot.imageGenPromptRules = '';
  }

  const prompts = findPromptPresetValue(data);
  if (Array.isArray(prompts)) {
    const systemParts = prompts
      .filter(p => p && typeof p === 'object' && String(p.role || '').toLowerCase() === 'system')
      .map(p => String(p.content || '').trim())
      .filter(Boolean);
    if (systemParts.length) {
      snapshot.imageGenSystemPrompt = systemParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
    }
  }

  return { name, snapshot };
}


// 尝试解析 SillyTavern 世界书导�?JSON（不同版本结构可能不同）
// 返回：[{ title, keys: string[], content: string }]
function parseWorldbookJson(rawText) {
  if (!rawText) return [];
  let data = null;
  try { data = JSON.parse(rawText); } catch { return []; }

  // Some exports embed JSON as a string field (double-encoded)
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { /* ignore */ }
  }
  // Some ST endpoints wrap the lorebook JSON inside a string field (e.g. { data: "<json>" }).
  // Try to unwrap a few common wrapper fields.
  for (let i = 0; i < 4; i++) {
    if (!data || typeof data !== 'object') break;
    const wrappers = ['data', 'world_info', 'worldInfo', 'lorebook', 'book', 'worldbook', 'worldBook', 'payload', 'result'];
    let changed = false;
    for (const k of wrappers) {
      const v = data?.[k];
      if (typeof v === 'string') {
        const t = v.trim();
        if (t && (t.startsWith('{') || t.startsWith('['))) {
          try { data = JSON.parse(t); changed = true; break; } catch { /* ignore */ }
        }
      } else if (v && typeof v === 'object') {
        // Sometimes the real file is nested under a wrapper object
        if (v.entries || v.world_info || v.worldInfo || v.lorebook || v.items) {
          data = v;
          changed = true;
          break;
        }
        // Or a nested string field again
        if (typeof v.data === 'string') {
          const t2 = String(v.data || '').trim();
          if (t2 && (t2.startsWith('{') || t2.startsWith('['))) {
            try { data = JSON.parse(t2); changed = true; break; } catch { /* ignore */ }
          }
        }
      }
    }
    if (!changed) break;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { break; }
    }
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
      .split(/[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n,�?；\|]+/g)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const norm = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;

    const comment = String(e.comment ?? '').trim();
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

    const disabledRaw =
      e.disable ??
      e.disabled ??
      e.isDisabled ??
      (Object.hasOwn(e, 'enabled') ? !e.enabled : null);
    const disabled = (disabledRaw === 1 || disabledRaw === '1' || disabledRaw === true);

    if (!content) continue;
    const resolvedTitle = title || (keys[0] ? `条目�?{keys[0]}` : '条目');
    norm.push({ title: resolvedTitle, comment: comment || resolvedTitle, keys, content, disabled });
  }
  return norm;
}

// -------------------- 实时读取蓝灯世界书（World Info / Lorebook�?--------------------

function pickBlueIndexFileName() {
  const s = ensureSettings();
  const explicit = String(s.wiBlueIndexFile || '').trim();
  if (explicit) return explicit;
  const fromBlueWrite = String(s.summaryBlueWorldInfoFile || '').trim();
  if (fromBlueWrite) return fromBlueWrite;
  // 最后兜底：若用户把蓝灯索引建在绿灯同文件里，也能读到（不推荐，但不阻断�?
  const fromGreen = String(s.summaryWorldInfoFile || '').trim();
  return fromGreen;
}

async function fetchJsonCompat(url, options) {
  const headers = { ...getStRequestHeadersCompat(), ...(options?.headers || {}) };
  const res = await fetch(url, { ...(options || {}), headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${res.statusText}${text ? `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${text}` : ''}`);
    err.status = res.status;
    throw err;
  }
  // some ST endpoints may return plain text
  const ct = String(res.headers.get('content-type') || '');
  if (ct.includes('application/json')) return await res.json();
  const t = await res.text().catch(() => '');
  try { return JSON.parse(t); } catch { return { text: t }; }
}

// 尝试�?ST 后端读取指定世界书文件（不同版本的参数名/方法可能不同�?
async function fetchWorldInfoFileJsonCompat(fileName) {
  const raw = String(fileName || '').trim();
  if (!raw) throw new Error('蓝灯世界书文件名为空');

  // Some ST versions store lorebook names with/without .json extension.
  const names = Array.from(new Set([
    raw,
    raw.endsWith('.json') ? raw.slice(0, -5) : (raw + '.json'),
  ].filter(Boolean)));

  const tryList = [];
  for (const name of names) {
    // POST JSON body
    tryList.push(
      { method: 'POST', url: '/api/worldinfo/get', body: { name } },
      { method: 'POST', url: '/api/worldinfo/get', body: { file: name } },
      { method: 'POST', url: '/api/worldinfo/get', body: { filename: name } },
      { method: 'POST', url: '/api/worldinfo/get', body: { world: name } },
      { method: 'POST', url: '/api/worldinfo/get', body: { lorebook: name } },
      // GET query
      { method: 'GET', url: `/api/worldinfo/get?name=${encodeURIComponent(name)}` },
      { method: 'GET', url: `/api/worldinfo/get?file=${encodeURIComponent(name)}` },
      { method: 'GET', url: `/api/worldinfo/get?filename=${encodeURIComponent(name)}` },

      // Some forks/versions use /read instead of /get
      { method: 'POST', url: '/api/worldinfo/read', body: { name } },
      { method: 'POST', url: '/api/worldinfo/read', body: { file: name } },
      { method: 'GET', url: `/api/worldinfo/read?name=${encodeURIComponent(name)}` },
      { method: 'GET', url: `/api/worldinfo/read?file=${encodeURIComponent(name)}` },

      // Rare: /load
      { method: 'POST', url: '/api/worldinfo/load', body: { name } },
      { method: 'GET', url: `/api/worldinfo/load?name=${encodeURIComponent(name)}` },
    );
  }

  let lastErr = null;
  for (const t of tryList) {
    try {
      if (t.method === 'POST') {
        const data = await fetchJsonCompat(t.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(t.body),
        });
        if (data) return data;
      } else {
        const data = await fetchJsonCompat(t.url, { method: 'GET' });
        if (data) return data;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('读取世界书失�?);
}

function parseWorldbookList(raw) {
  const out = [];
  const pushName = (name) => {
    const n = normalizeWorldInfoFileName(String(name || '').trim());
    if (!n) return;
    out.push(n);
  };

  const extractName = (item) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item !== 'object') return '';
    return (
      item.name || item.file || item.filename || item.title || item.id
      || item.lorebook || item.worldbook || item.worldBook
    );
  };

  const collectFrom = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach((it) => {
        const n = extractName(it);
        if (n) pushName(n);
      });
      return;
    }
    if (typeof val === 'object') {
      const n = extractName(val);
      if (n) pushName(n);
    }
  };

  if (!raw) return [];
  if (typeof raw === 'string') {
    pushName(raw);
  } else {
    const candidates = [
      raw,
      raw?.data,
      raw?.result,
      raw?.worldbooks,
      raw?.worldBooks,
      raw?.worldbook,
      raw?.lorebooks,
      raw?.lorebook,
      raw?.books,
      raw?.book,
      raw?.list,
      raw?.items,
      raw?.files,
      raw?.file_list,
    ];
    candidates.forEach(collectFrom);

    if (!out.length && typeof raw === 'object') {
      Object.values(raw).forEach(collectFrom);
    }
  }

  return Array.from(new Set(out)).sort((a, b) => String(a).localeCompare(String(b)));
}

function collectWorldbookNamesFromAny(root) {
  const out = new Set();
  const add = (name) => {
    const n = normalizeWorldInfoFileName(String(name || '').trim());
    if (!n) return;
    out.add(n);
  };

  const extractName = (item) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item !== 'object') return '';
    return (
      item.name || item.file || item.filename || item.title || item.id
      || item.lorebook || item.worldbook || item.worldBook
    );
  };

  const collectFromList = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach((it) => {
        const n = extractName(it);
        if (n) add(n);
      });
      return;
    }
    if (typeof val === 'object') {
      const n = extractName(val);
      if (n) add(n);
    }
  };

  const roots = Array.isArray(root) ? root : [root];
  for (const r of roots) {
    if (!r || typeof r !== 'object') continue;

    // 只从“可能是世界书列表”的键里取，避免扫出条目/预设�?
    const candidates = [
      r.worldInfo,
      r.world_info,
      r.worldbooks,
      r.worldBooks,
      r.worldbook,
      r.worldBook,
      r.lorebooks,
      r.lorebook,
      r.books,
      r.book,
      r.list,
      r.items,
      r.files,
      r.file_list,
    ];
    candidates.forEach(collectFromList);
  }

  return Array.from(out).sort((a, b) => String(a).localeCompare(String(b)));
}

async function fetchWorldInfoListCompat() {
  const tryList = [
    { method: 'GET', url: '/api/worldinfo/list' },
    { method: 'POST', url: '/api/worldinfo/list', body: {} },
    { method: 'GET', url: '/api/worldinfo/getall' },
    { method: 'POST', url: '/api/worldinfo/getall', body: {} },
    { method: 'GET', url: '/api/worldinfo/all' },
    { method: 'GET', url: '/api/worldinfo/listall' },
    { method: 'GET', url: '/api/lorebook/list' },
    { method: 'GET', url: '/api/lorebooks/list' },
    { method: 'GET', url: '/api/lorebook/getall' },
    { method: 'GET', url: '/api/lorebooks/getall' },
  ];

  let lastErr = null;
  for (const t of tryList) {
    try {
      const data = (t.method === 'POST')
        ? await fetchJsonCompat(t.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t.body || {}) })
        : await fetchJsonCompat(t.url, { method: 'GET' });
      const names = parseWorldbookList(data);
      if (names.length) return names;
    } catch (e) {
      const status = e?.status;
      // Ignore 404s (endpoint not available), keep trying others
      if (status !== 404) lastErr = e;
    }
  }

  // Fallback 1: try to read from DOM (#world_info select element in SillyTavern UI)
  // NOTE: ST's #world_info option values are often numeric indices; use text() for the name
  try {
    const names = [];
    const extractFromSelect = ($sel) => {
      if (!$sel || !$sel.length) return;
      $sel.find('option').each(function () {
        // prefer text (display name), fall back to value
        const txt = String($(this).text() || '').trim();
        const val = String($(this).val() || '').trim();
        // skip empty / placeholder / pure-number-index values
        const raw = (txt && !/^[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;-�?)（）]*$/.test(txt) && txt !== 'None' && txt !== '---') ? txt : val;
        if (!raw || /^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+$/.test(raw)) return; // skip numeric-only (index)
        const n = normalizeWorldInfoFileName(raw);
        if (n) names.push(n);
      });
    };
    extractFromSelect($('#world_info'));
    extractFromSelect($('#world_editor_select'));
    if (names.length) {
      const unique = Array.from(new Set(names)).sort((a, b) => String(a).localeCompare(String(b)));
      return unique;
    }
  } catch { /* ignore */ }

  // Fallback 2: try global world_names (common in many ST versions)
  try {
    const wn = globalThis.world_names
      ?? globalThis?.SillyTavern?.getContext?.()?.world_names
      ?? globalThis?.SillyTavern?.getContext?.()?.worldNames;
    if (Array.isArray(wn) && wn.length) {
      const names = wn
        .map(n => normalizeWorldInfoFileName(String(n || '').trim()))
        .filter(Boolean);
      if (names.length) return Array.from(new Set(names)).sort((a, b) => String(a).localeCompare(String(b)));
    }
  } catch { /* ignore */ }

  // Fallback 3: try context cache if available
  try {
    const ctx = SillyTavern.getContext?.() ?? {};
    const fallback = collectWorldbookNamesFromAny([
      ctx?.worldInfo,
      ctx?.world_info,
      ctx?.lorebook,
      ctx?.lorebooks,
      ctx?.worldbooks,
      ctx?.worldBooks,
      globalThis?.SillyTavern?.getContext?.()?.worldInfo,
      globalThis?.SillyTavern?.getContext?.()?.world_info,
    ]);
    if (fallback.length) return fallback;
  } catch { /* ignore */ }

  // Fallback 4: try chat_metadata.world and selected character lore
  try {
    const ctx = SillyTavern.getContext?.() ?? {};
    const meta = ctx?.chatMetadata ?? ctx?.chat_metadata ?? {};
    const names = [];
    // chat-level world info
    if (meta?.world) {
      const n = normalizeWorldInfoFileName(String(meta.world).trim());
      if (n) names.push(n);
    }
    // character-level world info
    const charId = ctx?.characterId ?? ctx?.this_chid;
    if (charId != null && Array.isArray(ctx?.characters)) {
      const char = ctx.characters[charId];
      if (char?.data?.extensions?.world) {
        const n = normalizeWorldInfoFileName(String(char.data.extensions.world).trim());
        if (n) names.push(n);
      }
    }
    if (names.length) return Array.from(new Set(names)).sort((a, b) => String(a).localeCompare(String(b)));
  } catch { /* ignore */ }

  if (lastErr) throw lastErr;
  return [];
}

function buildBlueIndexFromWorldInfoJson(worldInfoJson, prefixFilter = '') {
  // 复用 parseWorldbookJson 的“兼容解析”逻辑
  const parsed = parseWorldbookJson(JSON.stringify(worldInfoJson || {}));
  const prefix = String(prefixFilter || '').trim();

  const base = parsed.filter(e => e && e.content && !e.disabled);

  // 蓝灯索引使用“全量条目”，以便结构化条目也能被索引命中
  const items = base
    .map(e => ({
      title: String(e.comment || e.title || '').trim() || (e.keys?.[0] ? `条目�?{e.keys[0]}` : '条目'),
      summary: String(e.content || '').trim(),
      keywords: Array.isArray(e.keys) ? e.keys.slice(0, 120) : [],
      importedAt: Date.now(),
    }))
    .filter(x => x.summary);

  return items;
}

async function ensureBlueIndexLive(force = false, forceRead = false) {
  const s = ensureSettings();
  const mode = String(s.wiBlueIndexMode || 'live');
  if (mode !== 'live' && !forceRead) {
    const arr = Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : [];
    return arr;
  }

  const file = pickBlueIndexFileName();
  if (!file) return [];

  const minSec = clampInt(s.wiBlueIndexMinRefreshSec, 5, 600, 20);
  const now = Date.now();
  const ageMs = now - Number(blueIndexLiveCache.loadedAt || 0);
  const need = force || blueIndexLiveCache.file !== file || ageMs > (minSec * 1000);

  if (!need && Array.isArray(blueIndexLiveCache.entries) && blueIndexLiveCache.entries.length) {
    return blueIndexLiveCache.entries;
  }

  try {
    const json = await fetchWorldInfoFileJsonCompat(file);
    const prefix = String(s.summaryBlueWorldInfoCommentPrefix || '').trim();
    const entries = buildBlueIndexFromWorldInfoJson(json, prefix);

    blueIndexLiveCache = { file, loadedAt: now, entries, lastError: '' };

    // 同步到设置里，便�?UI 显示（同时也是“缓存”兜底）
    s.summaryBlueIndex = entries;
    saveSettings();
    updateBlueIndexInfoLabel();

    return entries;
  } catch (e) {
    blueIndexLiveCache.lastError = String(e?.message ?? e);
    // 读取失败就回退到现有缓�?
    const fallback = Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : [];
    return fallback;
  }
}

function buildStructuredWorldbookText(entries, maxChars) {
  const limit = Number.isFinite(maxChars) ? maxChars : 0;
  let acc = '';
  let used = 0;
  for (const e of (entries || [])) {
    const content = String(e?.content || '').trim();
    if (!content) continue;
    const title = getWorldInfoEntryLabel(e) || (Array.isArray(e?.keys) && e.keys[0] ? `条目�?{e.keys[0]}` : '条目');
    const keys = Array.isArray(e?.keys) ? e.keys.filter(Boolean) : [];
    const head = `- �?{title}�?{keys.length ? `（触发：${keys.slice(0, 6).join(' / ')}）` : ''}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
    const chunk = head + content + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n';
    if (limit > 0 && (acc.length + chunk.length) > limit) break;
    acc += chunk;
    used += 1;
  }
  return { text: acc.trim(), used };
}

async function ensureStructuredWorldbookLive(force = false) {
  const s = ensureSettings();
  const enabled = !!s.structuredWorldbookEnabled;
  const mode = String(s.structuredWorldbookMode || 'active');
  if (!enabled) {
    structuredWorldbookLiveCache = {
      ...structuredWorldbookLiveCache,
      mode,
      totalEntries: 0,
      usedEntries: 0,
      tokens: 0,
      text: '',
      lastError: '',
    };
    updateStructuredWorldbookInfoLabel();
    return structuredWorldbookLiveCache;
  }

  const file = pickBlueIndexFileName();
  if (!file) {
    structuredWorldbookLiveCache = {
      ...structuredWorldbookLiveCache,
      file: '',
      mode,
      totalEntries: 0,
      usedEntries: 0,
      tokens: 0,
      text: '',
      lastError: '蓝灯世界书文件名为空',
    };
    updateStructuredWorldbookInfoLabel();
    return structuredWorldbookLiveCache;
  }

  const minSec = clampInt(s.wiBlueIndexMinRefreshSec, 5, 600, 20);
  const now = Date.now();
  const ageMs = now - Number(structuredWorldbookLiveCache.loadedAt || 0);
  const need = force
    || structuredWorldbookLiveCache.file !== file
    || structuredWorldbookLiveCache.mode !== mode
    || ageMs > (minSec * 1000);

  if (!need && structuredWorldbookLiveCache.text) return structuredWorldbookLiveCache;

  try {
    const json = await fetchWorldInfoFileJsonCompat(file);
    let entries = parseWorldbookJson(JSON.stringify(json || {}));
    if (mode === 'active') entries = entries.filter(e => !e.disabled);

    const maxChars = clampInt(s.worldbookMaxChars, 500, 50000, 6000);
    const built = buildStructuredWorldbookText(entries, maxChars);
    structuredWorldbookLiveCache = {
      file,
      loadedAt: now,
      mode,
      totalEntries: entries.length,
      usedEntries: built.used,
      tokens: estimateTokens(built.text),
      text: built.text,
      lastError: '',
    };
  } catch (e) {
    structuredWorldbookLiveCache = {
      file,
      loadedAt: now,
      mode,
      totalEntries: 0,
      usedEntries: 0,
      tokens: 0,
      text: '',
      lastError: String(e?.message ?? e),
    };
  }
  updateStructuredWorldbookInfoLabel();
  return structuredWorldbookLiveCache;
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
  const cjk = (s.match(/[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e00-        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9fff]/g) || []).length;
  const rest = s.replace(/[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e00-        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9fff]/g, '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, '');
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

  // 如果未启用注入：仅返回“导入数量”，不计算注入内容（UI 也能看到导入成功�?
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
  const recentText = pickedMsgs.reverse().join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');

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
    const head = `- �?{e.title}�?{(e.keys && e.keys.length) ? `（触发：${e.keys.slice(0, 6).join(' / ')}）` : ''}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
    const body = e.content.trim() + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n';
    const chunk = head + body + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n';
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
  return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【世界书/World Info（已导入�?{info.importedEntries}条，本次注入�?{info.injectedEntries}条，�?{info.injectedTokens} tokens）】\n${info.text}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
}

// -------------------- sex guide worldbooks --------------------

let sexGuideWorldbookStats = {
  enabled: false,
  totalWorldbooks: 0,
  enabledWorldbooks: 0,
  importedEntries: 0,
  injectedEntries: 0,
  injectedChars: 0,
  injectedTokens: 0,
  usedWorldbooks: [],
  perBookStats: [],
  text: ''
};

function normalizeSexGuideWorldbooks(list) {
  if (!Array.isArray(list)) return [];
  const usedIds = new Set();
  const now = Date.now();
  return list.map((wb, idx) => {
    if (!wb || typeof wb !== 'object') return null;
    const name = String(wb.name || wb.file || wb.title || `世界�?{idx + 1}`).trim() || `世界�?{idx + 1}`;
    const json = String(wb.json || wb.raw || wb.text || '').trim();
    if (!json) return null;
    let id = String(wb.id || '').trim();
    if (!id || usedIds.has(id)) id = `sexwb_${now}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
    usedIds.add(id);
    return {
      id,
      name,
      json,
      enabled: wb.enabled !== false
    };
  }).filter(Boolean);
}

function getSexGuideWorldbooks() {
  const s = ensureSettings();
  const list = normalizeSexGuideWorldbooks(s.sexGuideWorldbooks || []);
  if (list.length !== (s.sexGuideWorldbooks || []).length) {
    s.sexGuideWorldbooks = list;
    saveSettings();
  }
  return list;
}

function setSexGuideWorldbooks(list) {
  const s = ensureSettings();
  s.sexGuideWorldbooks = normalizeSexGuideWorldbooks(list || []);
  saveSettings();
  renderSexGuideWorldbookList();
  updateSexGuideWorldbookInfoLabel();
}

function computeSexGuideWorldbookInjection() {
  const s = ensureSettings();
  const enabled = !!s.sexGuideWorldbookEnabled;
  const list = getSexGuideWorldbooks();

  const result = {
    enabled,
    totalWorldbooks: list.length,
    enabledWorldbooks: list.filter(w => w.enabled !== false).length,
    importedEntries: 0,
    injectedEntries: 0,
    injectedChars: 0,
    injectedTokens: 0,
    usedWorldbooks: [],
    perBookStats: [],
    text: ''
  };

  if (!enabled || !list.length) return result;

  const maxChars = clampInt(s.sexGuideWorldbookMaxChars, 500, 200000, 6000);
  let acc = '';

  for (const wb of list) {
    const entriesAll = parseWorldbookJson(wb.json).filter(e => e && !e.disabled);
    const full = buildStructuredWorldbookText(entriesAll, 0);
    const fullTokens = estimateTokens(full.text || '');

    if (!wb.enabled || !entriesAll.length || (maxChars > 0 && acc.length >= maxChars)) {
      result.perBookStats.push({
        id: wb.id,
        name: wb.name,
        enabled: !!wb.enabled,
        entries: entriesAll.length,
        injectedEntries: 0,
        tokens: fullTokens
      });
      continue;
    }

    result.importedEntries += entriesAll.length;

    const remain = maxChars > 0 ? Math.max(0, maxChars - acc.length) : 0;
    const partial = buildStructuredWorldbookText(entriesAll, remain);
    if (partial.text) {
      if (acc) acc += '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n';
      acc += partial.text.trim() + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n';
      result.injectedEntries += partial.used;
      result.usedWorldbooks.push(wb.name);
    }

    result.perBookStats.push({
      id: wb.id,
      name: wb.name,
      enabled: true,
      entries: entriesAll.length,
      injectedEntries: partial.used || 0,
      tokens: fullTokens
    });
  }

  result.injectedChars = acc.length;
  result.injectedTokens = estimateTokens(acc);
  result.text = acc.trim();

  return result;
}

function buildSexGuideWorldbookBlock() {
  const info = computeSexGuideWorldbookInjection();
  sexGuideWorldbookStats = info;
  if (!info.enabled || !info.text) return '';
  const enabledNames = getSexGuideWorldbooks().filter(w => w.enabled).map(w => w.name);
  const dirs = enabledNames.length ? enabledNames.join(' / ') : '�?;
  return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【性爱指导世界书（目录�?{dirs}，本次注入：${info.injectedEntries}条，�?{info.injectedTokens} tokens）】\n${info.text}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
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
    case 'none': return `【剧透策略】严格不剧透：不要透露原著明确未来事件与真相；只给“行动建�?风险提示”，避免点名关键反转。`;
    case 'full': return `【剧透策略】允许全剧透：可以直接指出原著后续的关键事�?真相，并解释如何影响当前路线。`;
    case 'mild':
    default: return `【剧透策略】轻剧透：可以用“隐晦提�?+ 关键风险点”，避免把原著后续完整摊开；必要时可点到为止。`;
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
  // 每个模块一行：key: title �?prompt
  const lines = [];
  for (const m of modules) {
    const p = m.prompt ? ` �?${m.prompt}` : '';
    const t = m.title ? `�?{m.title}）` : '';
    if (m.type === 'list') {
      lines.push(`- ${m.key}${t}: string[]${m.maxItems ? ` (<=${m.maxItems})` : ''}${p}`);
    } else {
      lines.push(`- ${m.key}${t}: string${p}`);
    }
  }
  return lines.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
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
    `你是执行型“剧情指�?编剧顾问”。从“正在经历的世界”（聊天+设定）提炼结构，并给出后续引导。`,
    spoilerPolicyText(spoilerLevel),
    compactHint,
    extraSystem ? `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【自定义 System 补充】\n${extraSystem}` : ``,
    ``,
    `[Constraints]`,
    `1) 不要凭空杜撰世界�?人物/地点；不确定写“未�?待确认”。`,
    `2) 不要复述流水账；只提炼关键矛盾、动机、风险与走向。`,
    `3) 输出必须�?JSON 对象本体（无 Markdown、无代码块、无多余解释）。`,
    `4) 只输出下面列出的字段，不要额外字段。`,
    extraConstraints ? `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【自定义 Constraints 补充】\n${extraConstraints}` : ``,
    ``,
    `[Output Fields]`,
    buildOutputFieldsText(modules),
    `---END PROMPT---`
  ].filter(Boolean).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');

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
          `- 名称�?{stripHtml(name)}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
          `- 描述�?{stripHtml(desc)}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
          `- 性格�?{stripHtml(personality)}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
          `- 场景/设定�?{stripHtml(scenario)}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` +
          (first ? `- 开场白�?{stripHtml(first)}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` : '');
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
    if (text.length > maxChars) text = text.slice(0, maxChars) + '�?截断)';
    picked.push(`�?{name}�?{text}`);
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
    world ? `【世界观/设定补充】\n${world}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` : `【世界观/设定补充】（未提供）        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`,
    canon ? `【原著后�?大纲】\n${canon}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` : `【原著后�?大纲】（未提供）        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`,
    buildWorldbookBlock(),
    `【聊天记录（最�?{picked.length}条）】`,
    picked.length ? picked.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n') : '（空�?
  ].join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');

  return { snapshotText, sourceSummary };
}

function getLastUserMessageText(chat) {
  const arr = Array.isArray(chat) ? chat : [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    if (m && m.is_user === true) {
      const text = stripHtml(m.mes ?? m.message ?? '');
      if (text) return text;
    }
  }
  return '';
}

function buildRecentChatTextSexGuide(chat, maxMessages = 6, maxCharsPerMessage = 800) {
  const arr = Array.isArray(chat) ? chat : [];
  const picked = [];
  for (let i = arr.length - 1; i >= 0 && picked.length < maxMessages; i--) {
    const m = arr[i];
    if (!m) continue;
    const name = stripHtml(m.name || (m.is_user ? 'User' : 'Assistant'));
    let text = stripHtml(m.mes ?? m.message ?? '');
    if (!text) continue;
    if (text.length > maxCharsPerMessage) text = text.slice(0, maxCharsPerMessage) + '�?截断)';
    picked.push(`�?{name}�?{text}`);
  }
  return picked.reverse().join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

function buildSexGuidePromptMessages(snapshotText, worldbookText, settings, options = {}) {
  const s = settings || ensureSettings();
  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];

  const system = String(s.sexGuideSystemPrompt || DEFAULT_SEX_GUIDE_SYSTEM_PROMPT).trim() || DEFAULT_SEX_GUIDE_SYSTEM_PROMPT;
  const tpl = String(s.sexGuideUserTemplate || DEFAULT_SEX_GUIDE_USER_TEMPLATE).trim() || DEFAULT_SEX_GUIDE_USER_TEMPLATE;

  const overrideNeed = String(options.userNeedOverride || '').trim();
  let lastUser = getLastUserMessageText(chat);
  // If user provided explicit need, don't use last user chat text to avoid echoing previous output.
  if (overrideNeed) lastUser = '';
  // If last user equals last generated sex guide text, ignore it.
  if (lastUser && lastSexGuideText && lastUser.trim() === String(lastSexGuideText).trim()) lastUser = '';
  const includeUserInput = s.sexGuideIncludeUserInput !== false;
  const recentText = includeUserInput ? buildRecentChatTextSexGuide(chat, 6, 800) : '';
  if (!includeUserInput) lastUser = '';
  const userNeed = overrideNeed || String(s.sexGuideUserNeed || '').trim();
  let user = renderTemplate(tpl, {
    snapshot: snapshotText,
    worldbook: String(worldbookText || '').trim(),
    lastUser,
    recentText,
    userNeed
  });
  if (worldbookText && !/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*worldbook        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/i.test(tpl)) {
    user = String(user || '').trim() + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【性爱指导世界书】\n${worldbookText}`;
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

// -------------------- provider=st --------------------

async function callViaSillyTavern(messages, schema, temperature, signal) {
  const ctx = SillyTavern.getContext();
  const optsRaw = { prompt: messages, jsonSchema: schema, temperature };
  const optsQuiet = { messages, jsonSchema: schema, temperature };
  if (signal) {
    optsRaw.signal = signal;
    optsRaw.abortSignal = signal;
    optsQuiet.signal = signal;
    optsQuiet.abortSignal = signal;
  }
  if (typeof ctx.generateRaw === 'function') return await ctx.generateRaw(optsRaw);
  if (typeof ctx.generateQuietPrompt === 'function') return await ctx.generateQuietPrompt(optsQuiet);
  if (globalThis.TavernHelper && typeof globalThis.TavernHelper.generateRaw === 'function') {
    const txt = await globalThis.TavernHelper.generateRaw({ ordered_prompts: messages, should_stream: false });
    return String(txt || '');
  }
  throw new Error('未找到可用的生成函数（generateRaw/generateQuietPrompt）�?);
}

async function fallbackAskJson(messages, temperature) {
  const ctx = SillyTavern.getContext();
  const retry = clone(messages);
  retry.unshift({ role: 'system', content: `再次强调：只输出 JSON 对象本体，不要任何额外文字。` });
  if (typeof ctx.generateRaw === 'function') return await ctx.generateRaw({ prompt: retry, temperature });
  if (typeof ctx.generateQuietPrompt === 'function') return await ctx.generateQuietPrompt({ messages: retry, temperature });
  throw new Error('fallback 失败：缺�?generateRaw/generateQuietPrompt');
}

async function fallbackAskJsonCustom(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream, signal) {
  const retry = clone(messages);
  retry.unshift({ role: 'system', content: `再次强调：只输出 JSON 对象本体，不要任何额外文字，不要代码块。` });
  return await callViaCustom(apiBaseUrl, apiKey, model, retry, temperature, maxTokens, topP, stream, signal);
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
  u = u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '');
  u = u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/chat        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/completions$/i, '');
  u = u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/chat        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/completions$/i, '');
  u = u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/completions$/i, '');
  u = u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/completions$/i, '');
  return u;
}
function deriveChatCompletionsUrl(base) {
  const u = normalizeBaseUrl(base);
  if (!u) return '';
  if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1$/.test(u)) return u + '/chat/completions';
  if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i.test(u)) return u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '') + '/chat/completions';
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
    while ((idx = buffer.indexOf('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n')) !== -1) {
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

async function callViaCustomBackendProxy(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream, signal) {
  const url = '/api/backends/chat-completions/generate';

  const requestBody = {
    messages,
    model: String(model || '').replace(/^models        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;//, '') || 'gpt-4o-mini',
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
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(requestBody), signal });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`后端代理请求失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${text}`);
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

  // Standard OpenAI
  if (data?.choices?.[0]?.message?.content) return String(data.choices[0].message.content);
  // Flattened
  if (typeof data?.content === 'string') return data.content;
  // Google Gemini (candidates) - sometimes leaks through proxy
  if (data?.candidates?.[0]?.content?.parts?.[0]?.text) return String(data.candidates[0].content.parts[0].text);

  if (!Object.keys(data).length) throw new Error('API 返回了空数据 ({})。请检查网络，或尝试取消勾选“流式返回”�?);

  return JSON.stringify(data ?? '');
}

async function callViaCustomBrowserDirect(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream, signal) {
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

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`直连请求失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${text}`);
  }

  const ct = String(res.headers.get('content-type') || '');
  if (stream && (ct.includes('text/event-stream') || ct.includes('ndjson') || ct.includes('stream'))) {
    const streamed = await readStreamedChatCompletionToText(res);
    return String(streamed || '');
  }

  const json = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? '');
}

async function callViaCustom(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream, signal) {
  const base = normalizeBaseUrl(apiBaseUrl);
  if (!base) throw new Error('custom 模式需要填�?API基础URL');

  try {
    return await callViaCustomBackendProxy(base, apiKey, model, messages, temperature, maxTokens, topP, stream, signal);
  } catch (e) {
    const status = e?.status;
    if (status === 404 || status === 405) {
      console.warn('[StoryGuide] backend proxy unavailable; fallback to browser direct');
      return await callViaCustomBrowserDirect(base, apiKey, model, messages, temperature, maxTokens, topP, stream, signal);
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
        lines.push('（空�?);
      } else {
        // tips 用有序列表更舒服
        if (m.key === 'tips') {
          arr.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
        } else {
          arr.forEach(t => lines.push(`- ${t}`));
        }
      }
    } else {
      lines.push(val ? String(val) : '（空�?);
    }
    lines.push('');
  }

  return lines.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n').trim();
}

// -------------------- panel analysis --------------------

async function runAnalysis() {
  const s = ensureSettings();
  if (!s.enabled) { setStatus('插件未启�?, 'warn'); return; }

  setStatus('分析中�?, 'warn');
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
      throw new Error('模型输出无法解析�?JSON（已切到 JSON 标签，看看原文）');
    }

    const md = renderReportMarkdownFromModules(parsed, modules);
    lastReport = { json: parsed, markdown: md, createdAt: Date.now(), sourceSummary };
    renderMarkdownInto($('#sg_md'), md);

    await updateMapFromSnapshot(snapshotText);

    // 同步面板报告到聊天末�?
    try { syncPanelOutputToChat(md, false); } catch { /* ignore */ }

    updateButtonsEnabled();
    showPane('md');
    setStatus('完成 �?, 'ok');
  } catch (e) {
    console.error('[StoryGuide] analysis failed:', e);
    setStatus(`分析失败�?{e?.message ?? e}`, 'err');
  } finally {
    $('#sg_analyze').prop('disabled', false);
  }
}

// -------------------- sex guide --------------------

async function runSexGuide(options = {}) {
  const s = ensureSettings();
  if (!s.sexGuideEnabled) {
    setSexGuideStatus('性爱指导未启�?, 'warn');
    setSexGuidePanelStatus('性爱指导未启�?, 'warn');
    return;
  }

  const updateNeed = options?.userNeedOverride !== undefined;
  const userNeed = updateNeed ? String(options.userNeedOverride || '').trim() : String(s.sexGuideUserNeed || '').trim();

  setSexGuideStatus('正在生成�?, 'warn');
  setSexGuidePanelStatus('正在生成�?, 'warn');
  $('#sg_sex_generate, #sg_sex_panel_generate').prop('disabled', true);

  try {
    const { snapshotText } = buildSnapshot();
    const wbInfo = computeSexGuideWorldbookInjection();
    const messages = buildSexGuidePromptMessages(snapshotText, wbInfo.text, { ...s, sexGuideUserNeed: userNeed }, { userNeedOverride: userNeed });

    let text = '';
    if (String(s.sexGuideProvider || 'st') === 'custom') {
      if (!s.sexGuideCustomEndpoint) throw new Error('请先填写性爱指导独立API基础URL');
      text = await callViaCustom(
        s.sexGuideCustomEndpoint,
        s.sexGuideCustomApiKey,
        s.sexGuideCustomModel,
        messages,
        s.sexGuideTemperature,
        s.sexGuideCustomMaxTokens,
        s.sexGuideCustomTopP,
        s.sexGuideCustomStream
      );
    } else {
      text = await callViaSillyTavern(messages, null, s.sexGuideTemperature);
    }

    if (typeof text !== 'string') text = JSON.stringify(text ?? '');
    lastSexGuideText = String(text || '').trim();
    $('#sg_sex_output').val(lastSexGuideText);
    $('#sg_sex_copy, #sg_sex_insert').prop('disabled', !lastSexGuideText);
    $('#sg_sex_panel_output').val(lastSexGuideText);
    $('#sg_sex_panel_send').prop('disabled', !lastSexGuideText);
    setSexGuideStatus('生成完成', 'ok');
    setSexGuidePanelStatus('生成完成', 'ok');
  } catch (e) {
    console.error('[StoryGuide] sex guide failed:', e);
    setSexGuideStatus(`生成失败�?{e?.message ?? e}`, 'err');
    setSexGuidePanelStatus(`生成失败�?{e?.message ?? e}`, 'err');
  } finally {
    $('#sg_sex_generate, #sg_sex_panel_generate').prop('disabled', false);
  }
}

// -------------------- summary (auto + world info) --------------------

function isCountableMessage(m, includeHidden = false, includeSystem = false) {
  if (!m) return false;
  if (!includeSystem && m.is_system === true) return false;
  if (!includeHidden && m.is_hidden === true) return false;
  const txt = String(m.mes ?? '').trim();
  return Boolean(txt);
}

function isCountableAssistantMessage(m, includeHidden = false, includeSystem = false) {
  return isCountableMessage(m, includeHidden, includeSystem) && m.is_user !== true;
}

function computeFloorCount(chat, mode, includeHidden = false, includeSystem = false) {
  const arr = Array.isArray(chat) ? chat : [];
  let c = 0;
  for (const m of arr) {
    if (mode === 'assistant') {
      if (isCountableAssistantMessage(m, includeHidden, includeSystem)) c++;
    } else {
      if (isCountableMessage(m, includeHidden, includeSystem)) c++;
    }
  }
  return c;
}

function findStartIndexForLastNFloors(chat, mode, n, includeHidden = false, includeSystem = false) {
  const arr = Array.isArray(chat) ? chat : [];
  let remaining = Math.max(1, Number(n) || 1);
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    const hit = (mode === 'assistant')
      ? isCountableAssistantMessage(m, includeHidden, includeSystem)
      : isCountableMessage(m, includeHidden, includeSystem);
    if (!hit) continue;
    remaining -= 1;
    if (remaining <= 0) return i;
  }
  return 0;
}

function buildSummaryChunkText(chat, startIdx, maxCharsPerMessage, maxTotalChars, includeHidden = false, includeSystem = false) {
  const arr = Array.isArray(chat) ? chat : [];
  const start = Math.max(0, Math.min(arr.length, Number(startIdx) || 0));
  const perMsg = clampInt(maxCharsPerMessage, 200, 8000, 4000);
  const totalMax = clampInt(maxTotalChars, 2000, 80000, 24000);

  const parts = [];
  let total = 0;
  for (let i = start; i < arr.length; i++) {
    const m = arr[i];
    if (!isCountableMessage(m, includeHidden, includeSystem)) continue;
    const who = m.is_user === true ? '用户' : (m.name || 'AI');
    let txt = stripHtml(m.mes || '');
    if (!txt) continue;
    if (txt.length > perMsg) txt = txt.slice(0, perMsg) + '�?;
    const block = `�?{who}�?{txt}`;
    if (total + block.length + 2 > totalMax) break;
    parts.push(block);
    total += block.length + 2;
  }
  return parts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

// 手动楼层范围总结：按 floor 号定位到聊天索引
function findChatIndexByFloor(chat, mode, floorNo, includeHidden = false, includeSystem = false) {
  const arr = Array.isArray(chat) ? chat : [];
  const target = Math.max(1, Number(floorNo) || 1);
  let c = 0;
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i];
    const hit = (mode === 'assistant')
      ? isCountableAssistantMessage(m, includeHidden, includeSystem)
      : isCountableMessage(m, includeHidden, includeSystem);
    if (!hit) continue;
    c += 1;
    if (c === target) return i;
  }
  return -1;
}

function resolveChatRangeByFloors(chat, mode, fromFloor, toFloor, includeHidden = false, includeSystem = false) {
  const floorNow = computeFloorCount(chat, mode, includeHidden, includeSystem);
  if (floorNow <= 0) return null;
  let a = clampInt(fromFloor, 1, floorNow, 1);
  let b = clampInt(toFloor, 1, floorNow, floorNow);
  if (b < a) { const t = a; a = b; b = t; }

  let startIdx = findChatIndexByFloor(chat, mode, a, includeHidden, includeSystem);
  let endIdx = findChatIndexByFloor(chat, mode, b, includeHidden, includeSystem);
  if (startIdx < 0 || endIdx < 0) return null;

  // �?assistant 模式下，为了更贴近“回合”，把起�?assistant 楼层前一条用户消息也纳入（若存在）�?
  if (mode === 'assistant' && startIdx > 0) {
    const prev = chat[startIdx - 1];
    if (prev && prev.is_user === true && isCountableMessage(prev, includeHidden, includeSystem)) startIdx -= 1;
  }

  if (startIdx > endIdx) { const t = startIdx; startIdx = endIdx; endIdx = t; }
  return { fromFloor: a, toFloor: b, startIdx, endIdx, floorNow };
}

function buildSummaryChunkTextRange(chat, startIdx, endIdx, maxCharsPerMessage, maxTotalChars, includeHidden = false, includeSystem = false) {
  const arr = Array.isArray(chat) ? chat : [];
  const start = Math.max(0, Math.min(arr.length - 1, Number(startIdx) || 0));
  const end = Math.max(start, Math.min(arr.length - 1, Number(endIdx) || 0));
  const perMsg = clampInt(maxCharsPerMessage, 200, 8000, 4000);
  const totalMax = clampInt(maxTotalChars, 2000, 80000, 24000);

  const parts = [];
  let total = 0;
  for (let i = start; i <= end; i++) {
    const m = arr[i];
    if (!isCountableMessage(m, includeHidden, includeSystem)) continue;
    const who = m.is_user === true ? '用户' : (m.name || 'AI');
    let txt = stripHtml(m.mes || '');
    if (!txt) continue;
    if (txt.length > perMsg) txt = txt.slice(0, perMsg) + '�?;
    const block = `�?{who}�?{txt}`;
    if (total + block.length + 2 > totalMax) break;
    parts.push(block);
    total += block.length + 2;
  }
  return parts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

function getSummarySchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      keywords: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'keywords'],
  };
}

function buildMegaSummaryItemsText(items) {
  return items.map((h, idx) => {
    const title = String(h.title || '').trim() || `条目${idx + 1}`;
    const range = h?.range ? `�?{h.range.fromFloor}-${h.range.toFloor}）` : '';
    const kws = Array.isArray(h.keywords) ? h.keywords.filter(Boolean) : [];
    const summary = String(h.summary || '').trim();
    const lines = [`�?{idx + 1}�?{title}${range}`];
    if (kws.length) lines.push(`关键词：${kws.join('�?)}`);
    if (summary) lines.push(`摘要�?{summary}`);
    return lines.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
  }).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

function buildMegaSummaryPromptMessages(items, settings) {
  const s = settings || ensureSettings();
  let sys = String(s.megaSummarySystemPrompt || '').trim();
  if (!sys) sys = DEFAULT_MEGA_SUMMARY_SYSTEM_PROMPT;
  sys = sys + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + SUMMARY_JSON_REQUIREMENT;

  const itemsText = buildMegaSummaryItemsText(items);
  let tpl = String(s.megaSummaryUserTemplate || '').trim();
  if (!tpl) tpl = DEFAULT_MEGA_SUMMARY_USER_TEMPLATE;

  let user = renderTemplate(tpl, { items: itemsText });
  if (!/{{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*items        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*}}/i.test(tpl) && !String(user).includes(itemsText.slice(0, 12))) {
    user = String(user || '').trim() + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【待汇总条目】\n${itemsText}`;
  }
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

function parseSummaryIndexInput(input, settings) {
  const s = settings || ensureSettings();
  const raw = String(input || '').trim();
  if (!raw) return 0;
  const num = Number.parseInt(raw, 10);
  if (Number.isFinite(num)) return num;
  const prefix = String(s.summaryIndexPrefix || 'A-');
  const re = new RegExp('^' + escapeRegExp(prefix) + '(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+)$', 'i');
  const m = raw.match(re);
  return m ? (Number.parseInt(m[1], 10) || 0) : 0;
}

function extractWorldbookEntriesDetailed(rawJson) {
  if (!rawJson) return [];
  let data = rawJson;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return []; }
  }
  for (let i = 0; i < 4; i++) {
    if (!data || typeof data !== 'object') break;
    const wrappers = ['data', 'world_info', 'worldInfo', 'lorebook', 'book', 'worldbook', 'worldBook', 'payload', 'result'];
    let changed = false;
    for (const k of wrappers) {
      const v = data?.[k];
      if (typeof v === 'string') {
        const t = v.trim();
        if (t && (t.startsWith('{') || t.startsWith('['))) {
          try { data = JSON.parse(t); changed = true; break; } catch { /* ignore */ }
        }
      } else if (v && typeof v === 'object') {
        if (v.entries || v.world_info || v.worldInfo || v.lorebook || v.items) {
          data = v;
          changed = true;
          break;
        }
        if (typeof v.data === 'string') {
          const t2 = String(v.data || '').trim();
          if (t2 && (t2.startsWith('{') || t2.startsWith('['))) {
            try { data = JSON.parse(t2); changed = true; break; } catch { /* ignore */ }
          }
        }
      }
    }
    if (!changed) break;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { break; }
    }
  }

  function toArray(maybe) {
    if (!maybe) return null;
    if (Array.isArray(maybe)) return maybe;
    if (typeof maybe === 'object') {
      const vals = Object.values(maybe);
      if (vals.length && vals.every(v => typeof v === 'object')) return vals;
    }
    return null;
  }

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
    if (c && typeof c === 'object') {
      const inner = toArray(c.entries);
      if (inner && inner.length) { entries = inner; break; }
    }
  }
  if (!entries) return [];

  function splitKeys(str) {
    return String(str || '')
      .split(/[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n,�?；\|]+/g)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const norm = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const comment = String(e.comment ?? e.title ?? e.name ?? e.uid ?? e.id ?? '').trim();
    const title = comment || (Array.isArray(e.keys) && e.keys[0] ? `条目�?{e.keys[0]}` : '条目');
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

    const disabledRaw = e.disable ?? e.disabled ?? e.isDisabled ?? e.disable_entry ?? e.disabled_entry;
    const disabled = disabledRaw === true || String(disabledRaw) === '1';

    norm.push({ title, comment, keys, content, disabled });
  }
  return norm;
}

function extractIndexFromText(text, settings) {
  const s = settings || ensureSettings();
  const prefix = String(s.summaryIndexPrefix || 'A-');
  const re = new RegExp(escapeRegExp(prefix) + '(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+)', 'i');
  const m = String(text || '').match(re);
  return m ? `${prefix}${String(m[1]).padStart(3, '0')}` : '';
}

function extractIndexIdFromEntry(entry, settings) {
  const s = settings || ensureSettings();
  if (Array.isArray(entry.keys)) {
    for (const k of entry.keys) {
      const id = extractIndexFromText(k, s);
      if (id) return id;
    }
  }
  return extractIndexFromText(entry.comment || entry.title || '', s);
}

async function fetchBlueSummarySourceEntries(settings) {
  const s = settings || ensureSettings();
  const file = String(s.summaryBlueWorldInfoFile || '').trim();
  if (!file) return [];
  const prefix = String(s.summaryBlueWorldInfoCommentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结').trim() || '剧情总结';
  const raw = await fetchWorldInfoFileJsonCompat(file);
  const entries = extractWorldbookEntriesDetailed(raw);
  return entries
    .filter(e => e && e.content)
    .filter(e => !e.disabled)
    .filter(e => !String(e.comment || '').startsWith('[已汇总]'))
    .filter(e => !String(e.comment || '').startsWith('[已删除]'))
    .filter(e => {
      if (!prefix) return true;
      return String(e.comment || e.title || '').includes(prefix);
    })
    .map(e => {
      const indexId = extractIndexIdFromEntry(e, s);
      return {
        title: String(e.title || '').trim(),
        summary: String(e.content || '').trim(),
        keywords: Array.isArray(e.keys) ? e.keys : [],
        indexId,
        sourceComment: String(e.comment || e.title || '').trim(),
        sourcePrefix: prefix,
      };
    });
}

function filterMegaSummaryCandidates(meta, settings) {
  const s = settings || ensureSettings();
  const sourcePrefix = String(s.summaryWorldInfoCommentPrefix || '剧情总结').trim() || '剧情总结';
  const indexPrefix = String(s.summaryIndexPrefix || 'A-');
  const indexRe = new RegExp('^' + escapeRegExp(indexPrefix) + '(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+)$');
  const parseIndex = (id) => {
    const m = String(id || '').trim().match(indexRe);
    return m ? (Number.parseInt(m[1], 10) || 0) : 0;
  };
  return (Array.isArray(meta.history) ? meta.history : [])
    .filter(h => h && !h.isMega && !h.megaArchived && String(h.commentPrefix || '').trim() === sourcePrefix)
    .sort((a, b) => {
      const ai = parseIndex(a.indexId);
      const bi = parseIndex(b.indexId);
      if (ai && bi) return ai - bi;
      return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
    });
}

async function createMegaSummaryForSlice(slice, meta, settings) {
  const s = settings || ensureSettings();
  if (!slice.length) return false;

  const messages = buildMegaSummaryPromptMessages(slice, s);
  const schema = getSummarySchema();

  let jsonText = '';
  if (String(s.summaryProvider || 'st') === 'custom') {
    jsonText = await callViaCustom(s.summaryCustomEndpoint, s.summaryCustomApiKey, s.summaryCustomModel, messages, s.summaryTemperature, s.summaryCustomMaxTokens, 0.95, s.summaryCustomStream);
    const parsedTry = safeJsonParse(jsonText);
    if (!parsedTry || !parsedTry.summary) {
      try { jsonText = await fallbackAskJsonCustom(s.summaryCustomEndpoint, s.summaryCustomApiKey, s.summaryCustomModel, messages, s.summaryTemperature, s.summaryCustomMaxTokens, 0.95, s.summaryCustomStream); }
      catch { /* ignore */ }
    }
  } else {
    jsonText = await callViaSillyTavern(messages, schema, s.summaryTemperature);
    if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
    const parsedTry = safeJsonParse(jsonText);
    if (!parsedTry || !parsedTry.summary) jsonText = await fallbackAskJson(messages, s.summaryTemperature);
  }

  const parsed = safeJsonParse(jsonText);
  if (!parsed || !parsed.summary) return false;

  const megaPrefix = String(s.megaSummaryCommentPrefix || '大总结').trim() || '大总结';
  const rawTitle = String(parsed.title || '').trim();
  const summary = String(parsed.summary || '').trim();
  const modelKeywords = sanitizeKeywords(parsed.keywords);
  let indexId = '';
  let keywords = modelKeywords;

  if (String(s.summaryWorldInfoKeyMode || 'keywords') === 'indexId') {
    if (!Number.isFinite(Number(meta.nextMegaIndex))) {
      let maxN = 0;
      const pref = String(s.megaSummaryIndexPrefix || 'R-');
      const re = new RegExp('^' + escapeRegExp(pref) + '(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+)$');
      for (const h of (Array.isArray(meta.history) ? meta.history : [])) {
        if (!h?.isMega) continue;
        const id0 = String(h?.indexId || '').trim();
        const m = id0.match(re);
        if (m) maxN = Math.max(maxN, Number.parseInt(m[1], 10) || 0);
      }
      meta.nextMegaIndex = Math.max(clampInt(s.megaSummaryIndexStart, 1, 1000000, 1), maxN + 1);
    }
    const pref = String(s.megaSummaryIndexPrefix || 'R-');
    const pad = clampInt(s.megaSummaryIndexPad, 1, 12, 3);
    const n = clampInt(meta.nextMegaIndex, 1, 100000000, 1);
    indexId = `${pref}${String(n).padStart(pad, '0')}`;
    keywords = [indexId];
    meta.nextMegaIndex = clampInt(Number(meta.nextMegaIndex) + 1, 1, 1000000000, Number(meta.nextMegaIndex) + 1);
  }

  const range = {
    fromFloor: slice[0]?.range?.fromFloor ?? 0,
    toFloor: slice[slice.length - 1]?.range?.toFloor ?? 0,
  };
  const rec = {
    title: rawTitle || megaPrefix,
    summary,
    keywords,
    indexId: indexId || undefined,
    modelKeywords: (String(s.summaryWorldInfoKeyMode || 'keywords') === 'indexId') ? modelKeywords : undefined,
    createdAt: Date.now(),
    range,
    isMega: true,
    megaSourceCount: slice.length,
    commentPrefix: megaPrefix,
    commentPrefixBlue: megaPrefix,
  };

  meta.history = Array.isArray(meta.history) ? meta.history : [];
  meta.history.push(rec);
  meta.megaSummaryCount = clampInt(Number(meta.megaSummaryCount || 0) + 1, 0, 1000000, Number(meta.megaSummaryCount || 0) + 1);
  await setSummaryMeta(meta);

  if (s.summaryToWorldInfo) {
    try {
      const greenTarget = resolveGreenWorldInfoTarget(s);
      if (!greenTarget.file) {
        console.warn('[StoryGuide] Green world info file missing, skip mega summary write');
      } else {
        await writeSummaryToWorldInfoEntry(rec, meta, {
          target: greenTarget.target,
          file: greenTarget.file,
          commentPrefix: megaPrefix,
          constant: 0,
        });
      }
    } catch (e) {
      console.warn('[StoryGuide] write mega summary (green) failed:', e);
    }
  }
  if (s.summaryToBlueWorldInfo) {
    try {
      await writeSummaryToWorldInfoEntry(rec, meta, {
        target: 'file',
        file: String(s.summaryBlueWorldInfoFile || ''),
        commentPrefix: ensureMvuPlotPrefix(megaPrefix),
        constant: 1,
      });
    } catch (e) {
      console.warn('[StoryGuide] write mega summary (blue) failed:', e);
    }
  }

  const hist = Array.isArray(meta.history) ? meta.history : [];
  for (const h of slice) {
    const histHit = h.indexId ? hist.find(x => x && x.indexId === h.indexId && !x.isMega) : null;
    if (histHit) {
      histHit.megaArchived = true;
      histHit.megaArchivedAt = Date.now();
    }

    const blueComment = String(h.sourceComment || '').trim();
    const bluePrefix = String(h.sourcePrefix || s.summaryBlueWorldInfoCommentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结').trim();
    const greenPrefix = String(s.summaryWorldInfoCommentPrefix || '剧情总结').trim();
    let greenComment = blueComment;
    if (blueComment && bluePrefix && greenPrefix && blueComment.startsWith(bluePrefix)) {
      greenComment = greenPrefix + blueComment.slice(bluePrefix.length);
    }

    const blueFile = String(s.summaryBlueWorldInfoFile || '').trim();
    if (blueComment && blueFile) {
      try {
        await disableWorldInfoEntryByComment(blueComment, s, {
          target: 'file',
          file: blueFile,
        });
      } catch (e) {
        console.warn('[StoryGuide] disable summary entry (blue) failed:', e);
      }
    }
    if (greenComment) {
      try {
        const greenTarget = resolveGreenWorldInfoTarget(s);
        await disableWorldInfoEntryByComment(greenComment, s, {
          target: greenTarget.target,
          file: greenTarget.file,
        });
      } catch (e) {
        console.warn('[StoryGuide] disable summary entry failed:', e);
      }
    }
  }

  await setSummaryMeta(meta);
  return true;
}

async function runMegaSummaryManual(fromIndex, toIndex) {
  const s = ensureSettings();
  const meta = getSummaryMeta();
  const fromNum = parseSummaryIndexInput(fromIndex, s);
  const toNum = parseSummaryIndexInput(toIndex, s);
  if (!fromNum || !toNum || fromNum > toNum) {
    setStatus('大总结范围无效，请填写正确索引�?, 'warn');
    return 0;
  }

  let candidates = [];
  try {
    candidates = await fetchBlueSummarySourceEntries(s);
  } catch (e) {
    setStatus(`读取蓝灯世界书失败：${e?.message ?? e}`, 'err');
    return 0;
  }
  candidates = candidates.filter(h => {
    const idx = parseSummaryIndexInput(h.indexId, s);
    return idx >= fromNum && idx <= toNum;
  });
  if (!candidates.length) {
    setStatus('大总结范围内无可用条目', 'warn');
    return 0;
  }

  const every = clampInt(s.megaSummaryEvery, 5, 5000, 40);
  let created = 0;
  for (let i = 0; i < candidates.length; i += every) {
    const slice = candidates.slice(i, i + every);
    const ok = await createMegaSummaryForSlice(slice, meta, s);
    if (!ok) break;
    created += 1;
  }

  renderSummaryPaneFromMeta();
  if (created > 0) {
    setStatus(`已生成大总结 ${created} �?✅`, 'ok');
  }
  return created;
}

function buildSummaryCoreTitle(rawTitle, indexId, settings, commentPrefix = '', forceIndex = false) {
  const s = settings || ensureSettings();
  const prefix = String(commentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结').trim() || '剧情总结';
  const id = String(indexId || '').trim();
  const includeIndex = (forceIndex || !!s.summaryIndexInComment) && id;

  let name = String(rawTitle || '').trim();
  if (name === prefix) name = '';

  const parts = [prefix];
  if (name) parts.push(name);
  if (indexId && includeIndex) parts.push(indexId);

  return parts.join('�?).replace(/｜｜+/g, '�?);
}

function buildSummaryComment(rec, settings, commentPrefix = '') {
  const s = settings || ensureSettings();
  const range = rec?.range ? `${rec.range.fromFloor}-${rec.range.toFloor}` : '';
  const base = buildSummaryCoreTitle(rec.title, rec.indexId, s, commentPrefix);
  return `${base}${range ? `�?{range}）` : ''}`;
}

async function disableSummaryWorldInfoEntry(rec, settings, {
  target = 'file',
  file = '',
  commentPrefix = '',
} = {}) {
  const s = settings || ensureSettings();
  const comment = buildSummaryComment(rec, s, commentPrefix || rec?.commentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结');
  if (!comment) return null;
  return disableWorldInfoEntryByComment(comment, settings, { target, file });
}

async function disableWorldInfoEntryByComment(comment, settings, {
  target = 'file',
  file = '',
} = {}) {
  const s = settings || ensureSettings();
  const targetMode = String(target || 'file');
  const fileName = normalizeWorldInfoFileName(file || '');
  if (targetMode === 'file' && !fileName) return null;

  let findExpr;
  const findFileVar = 'sgTmpFindSummaryFile';
  if (targetMode === 'chatbook') {
    await execSlash(`/getchatbook | /setvar key=${findFileVar}`);
    findExpr = `/findentry file={{getvar::${findFileVar}}} field=comment ${quoteSlashValue(comment)}`;
  } else {
    findExpr = `/findentry file=${quoteSlashValue(fileName)} field=comment ${quoteSlashValue(comment)}`;
  }

  const findResult = await execSlash(findExpr);
  const findText = slashOutputToText(findResult);

  if (targetMode === 'chatbook') {
    await execSlash(`/flushvar ${findFileVar}`);
  }

  let uid = null;
  if (findText && findText !== 'null' && findText !== 'undefined') {
    const parsed = safeJsonParse(findText);
    if (parsed && parsed.uid) uid = parsed.uid;
    else if (/^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+$/.test(findText.trim())) uid = findText.trim();
  }
  if (!uid) return null;

  let fileExpr;
  const fileVar = 'sgTmpDisableSummaryFile';
  if (targetMode === 'chatbook') {
    await execSlash(`/getchatbook | /setvar key=${fileVar}`);
    fileExpr = `{{getvar::${fileVar}}}`;
  } else {
    fileExpr = quoteSlashValue(fileName);
  }

  await execSlash(`/setentryfield file=${fileExpr} uid=${uid} field=disable 1`);
  const archivedComment = `[已汇总] ${comment}`;
  await execSlash(`/setentryfield file=${fileExpr} uid=${uid} field=comment ${quoteSlashValue(archivedComment)}`);
  await execSlash(`/setentryfield file=${fileExpr} uid=${uid} field=key ""`);

  if (targetMode === 'chatbook') {
    await execSlash(`/flushvar ${fileVar}`);
  }

  return { uid };
}

async function deleteWorldInfoEntryByComment(comment, settings, {
  target = 'file',
  file = '',
} = {}) {
  const s = settings || ensureSettings();
  const targetMode = String(target || 'file');
  const fileName = normalizeWorldInfoFileName(file || '');
  if (targetMode === 'file' && !fileName) return null;

  let findExpr;
  const findFileVar = 'sgTmpFindSummaryFile';
  if (targetMode === 'chatbook') {
    await execSlash(`/getchatbook | /setvar key=${findFileVar}`);
    findExpr = `/findentry file={{getvar::${findFileVar}}} field=comment ${quoteSlashValue(comment)}`;
  } else {
    findExpr = `/findentry file=${quoteSlashValue(fileName)} field=comment ${quoteSlashValue(comment)}`;
  }

  const findResult = await execSlash(findExpr);
  const findText = slashOutputToText(findResult);

  if (targetMode === 'chatbook') {
    await execSlash(`/flushvar ${findFileVar}`);
  }

  let uid = null;
  if (findText && findText !== 'null' && findText !== 'undefined') {
    const parsed = safeJsonParse(findText);
    if (parsed && parsed.uid) uid = parsed.uid;
    else if (/^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+$/.test(findText.trim())) uid = findText.trim();
  }
  if (!uid) return null;

  let fileExpr;
  const fileVar = 'sgTmpDeleteSummaryFile';
  if (targetMode === 'chatbook') {
    await execSlash(`/getchatbook | /setvar key=${fileVar}`);
    fileExpr = `{{getvar::${fileVar}}}`;
  } else {
    fileExpr = quoteSlashValue(fileName);
  }

  await execSlash(`/setentryfield file=${fileExpr} uid=${uid} field=disable 1`);
  await execSlash(`/setentryfield file=${fileExpr} uid=${uid} field=key ""`);
  await execSlash(`/setentryfield file=${fileExpr} uid=${uid} field=content ""`);

  if (targetMode === 'chatbook') {
    await execSlash(`/flushvar ${fileVar}`);
  }

  return { uid };
}

async function updateWorldInfoEntryByComment(comment, settings, {
  target = 'file',
  file = '',
  newComment = undefined,
  key = undefined,
  content = undefined,
  disable = undefined,
  constant = undefined,
} = {}) {
  const targetMode = String(target || 'file');
  const fileName = normalizeWorldInfoFileName(file || '');
  if (targetMode === 'file' && !fileName) return null;

  const safeFindComment = String(comment || '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?).trim();
  if (!safeFindComment) return null;

  let findExpr;
  const findFileVar = 'sgTmpUpdateFindFile';
  if (targetMode === 'chatbook') {
    await execSlash(`/getchatbook | /setvar key=${findFileVar}`);
    findExpr = `/findentry file={{getvar::${findFileVar}}} field=comment ${quoteSlashValue(safeFindComment)}`;
  } else {
    findExpr = `/findentry file=${quoteSlashValue(fileName)} field=comment ${quoteSlashValue(safeFindComment)}`;
  }

  const findResult = await execSlash(findExpr);
  const uid = parseFindEntryUid(findResult);

  if (targetMode === 'chatbook') {
    await execSlash(`/flushvar ${findFileVar}`);
  }

  if (!uid) return null;

  let fileExpr;
  const fileVar = 'sgTmpUpdateSummaryFile';
  if (targetMode === 'chatbook') {
    await execSlash(`/getchatbook | /setvar key=${fileVar}`);
    fileExpr = `{{getvar::${fileVar}}}`;
  } else {
    fileExpr = quoteSlashValue(fileName);
  }

  const parts = [];
  if (content !== undefined) {
    const safeContent = String(content ?? '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?);
    parts.push(`/setentryfield file=${fileExpr} uid=${uid} field=content ${quoteSlashValue(safeContent)}`);
  }
  if (key !== undefined) {
    const safeKey = String(key ?? '');
    parts.push(`/setentryfield file=${fileExpr} uid=${uid} field=key ${quoteSlashValue(safeKey)}`);
  }
  if (newComment !== undefined) {
    const safeComment = String(newComment ?? '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?).trim();
    parts.push(`/setentryfield file=${fileExpr} uid=${uid} field=comment ${quoteSlashValue(safeComment)}`);
  }
  if (disable !== undefined) {
    const disableVal = (Number(disable) === 1) ? 1 : 0;
    parts.push(`/setentryfield file=${fileExpr} uid=${uid} field=disable ${disableVal}`);
  }
  if (constant !== undefined) {
    const constantVal = (Number(constant) === 1) ? 1 : 0;
    parts.push(`/setentryfield file=${fileExpr} uid=${uid} field=constant ${constantVal}`);
  }

  if (parts.length) await execSlash(parts.join(' | '));

  if (targetMode === 'chatbook') {
    await execSlash(`/flushvar ${fileVar}`);
  }

  return { uid };
}

function getWorldInfoEntryLabel(entry) {
  return String(entry?.comment || entry?.title || '').trim();
}

function parseFindEntryUid(findResult) {
  if (findResult === null || findResult === undefined) return null;
  if (typeof findResult === 'number') return String(findResult);
  if (typeof findResult === 'string') {
    const trimmed = findResult.trim();
    if (trimmed.match(/^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+$/)) return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'number') return String(parsed);
      if (parsed?.pipe !== undefined) return String(parsed.pipe);
      if (parsed?.result !== undefined) return String(parsed.result);
    } catch { /* not JSON */ }
    return null;
  }
  if (typeof findResult === 'object') {
    if (findResult?.pipe !== undefined) return String(findResult.pipe);
    if (findResult?.result !== undefined) return String(findResult.result);
  }
  return null;
}

function filterWorldInfoEntriesByPrefix(entries, prefix) {
  const p = String(prefix || '').trim();
  if (!p) return Array.isArray(entries) ? entries : [];
  const list = Array.isArray(entries) ? entries : [];
  const filtered = list.filter(e => getWorldInfoEntryLabel(e).includes(p));
  return filtered.length ? filtered : list;
}

async function createWorldInfoEntryInFile(fileName, { keys = [], content = '', comment = '' }, {
  constant = 0,
  disable = 0,
} = {}) {
  const file = normalizeWorldInfoFileName(fileName);
  if (!file) throw new Error('世界书文件名为空');

  const keyValue = Array.isArray(keys) ? keys.filter(Boolean).join(',') : String(keys || '');
  const safeContent = String(content || '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?).trim();
  const safeComment = String(comment || '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?).trim();
  const uidVar = '__sg_sync_uid';
  const fileExpr = quoteSlashValue(file);
  const constantVal = (Number(constant) === 1) ? 1 : 0;
  const disableVal = (Number(disable) === 1) ? 1 : 0;

  const parts = [];
  parts.push(`/createentry file=${fileExpr} key=${quoteSlashValue(keyValue)} ${quoteSlashValue(safeContent)}`);
  parts.push(`/setvar key=${uidVar}`);
  if (safeComment) parts.push(`/setentryfield file=${fileExpr} uid={{getvar::${uidVar}}} field=comment ${quoteSlashValue(safeComment)}`);
  parts.push(`/setentryfield file=${fileExpr} uid={{getvar::${uidVar}}} field=disable ${disableVal}`);
  parts.push(`/setentryfield file=${fileExpr} uid={{getvar::${uidVar}}} field=constant ${constantVal}`);
  if (keyValue) parts.push(`/setentryfield file=${fileExpr} uid={{getvar::${uidVar}}} field=key ${quoteSlashValue(keyValue)}`);
  parts.push(`/flushvar ${uidVar}`);

  const out = await execSlash(parts.join(' | '));
  if (out && typeof out === 'object' && (out.isError || out.isAborted || out.isQuietlyAborted)) {
    throw new Error(`写入世界书失败（返回�?{safeStringifyShort(out)}）`);
  }
}

async function createWorldInfoEntryInTarget(targetMode, fileName, { key = '', content = '', comment = '' }, {
  constant = 0,
  disable = 0,
} = {}) {
  const mode = String(targetMode || 'file');
  if (mode === 'file') {
    await createWorldInfoEntryInFile(fileName, {
      keys: key,
      content,
      comment,
    }, { constant, disable });
    return;
  }

  const uidVar = '__sg_create_uid';
  const fileVar = '__sg_create_wbfile';
  const keyValue = String(key || '');
  const safeContent = String(content || '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?).trim();
  const safeComment = String(comment || '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?).trim();
  const constantVal = (Number(constant) === 1) ? 1 : 0;
  const disableVal = (Number(disable) === 1) ? 1 : 0;

  const parts = [];
  parts.push('/getchatbook');
  parts.push(`/setvar key=${fileVar}`);
  parts.push(`/createentry file={{getvar::${fileVar}}} key=${quoteSlashValue(keyValue)} ${quoteSlashValue(safeContent)}`);
  parts.push(`/setvar key=${uidVar}`);
  if (safeComment) parts.push(`/setentryfield file={{getvar::${fileVar}}} uid={{getvar::${uidVar}}} field=comment ${quoteSlashValue(safeComment)}`);
  parts.push(`/setentryfield file={{getvar::${fileVar}}} uid={{getvar::${uidVar}}} field=disable ${disableVal}`);
  parts.push(`/setentryfield file={{getvar::${fileVar}}} uid={{getvar::${uidVar}}} field=constant ${constantVal}`);
  if (keyValue) parts.push(`/setentryfield file={{getvar::${fileVar}}} uid={{getvar::${uidVar}}} field=key ${quoteSlashValue(keyValue)}`);
  parts.push(`/flushvar ${uidVar}`);
  parts.push(`/flushvar ${fileVar}`);

  const out = await execSlash(parts.join(' | '));
  if (out && typeof out === 'object' && (out.isError || out.isAborted || out.isQuietlyAborted)) {
    throw new Error(`写入世界书失败（返回�?{safeStringifyShort(out)}）`);
  }
}

async function syncGreenWorldInfoFromBlue() {
  const s = ensureSettings();
  const greenTarget = resolveGreenWorldInfoTarget(s);
  const greenFile = greenTarget.file;
  const blueFile = normalizeWorldInfoFileName(s.summaryBlueWorldInfoFile);
  if (!greenFile) {
    setStatus('绿灯世界书文件名为空', 'warn');
    return;
  }
  if (!blueFile) {
    setStatus('蓝灯世界书文件名为空', 'warn');
    return;
  }

  setStatus('正在对齐蓝灯→绿灯�?, 'warn');
  showToast('正在对齐绿灯世界书�?, { kind: 'warn', spinner: true, sticky: true });

  try {
    const [blueJson, greenJson] = await Promise.all([
      fetchWorldInfoFileJsonCompat(blueFile),
      fetchWorldInfoFileJsonCompat(greenFile),
    ]);

    let blueEntries = parseWorldbookJson(JSON.stringify(blueJson || {}));
    let greenEntries = parseWorldbookJson(JSON.stringify(greenJson || {}));

    if (!blueEntries.length) {
      setStatus('对齐完成 ✅（蓝灯世界书为空）', 'ok');
      return;
    }

    const greenSet = new Set(greenEntries.map(getWorldInfoEntryLabel).filter(Boolean));
    let created = 0;

    for (const entry of blueEntries) {
      const label = getWorldInfoEntryLabel(entry);
      if (!label) continue;
      if (greenSet.has(label)) continue;
      await createWorldInfoEntryInFile(greenFile, {
        keys: Array.isArray(entry.keys) ? entry.keys : [],
        content: entry.content || '',
        comment: label,
      }, { constant: 0, disable: entry?.disabled ? 1 : 0 });
      greenSet.add(label);
      created += 1;
    }

    if (created > 0) setStatus(`对齐完成 ✅（补全 ${created} 条）`, 'ok');
    else setStatus('对齐完成 ✅（无缺失条目）', 'ok');
  } catch (e) {
    setStatus(`对齐失败�?{e?.message ?? e}`, 'err');
  } finally {
    try { if ($('#sg_toast').hasClass('spinner')) hideToast(); } catch { /* ignore */ }
  }
}

async function maybeGenerateMegaSummary(meta, settings) {
  const s = settings || ensureSettings();
  if (!s.megaSummaryEnabled) return 0;

  const every = clampInt(s.megaSummaryEvery, 5, 5000, 40);
  let created = 0;
  while (true) {
    let pending = [];
    try {
      pending = await fetchBlueSummarySourceEntries(s);
    } catch (e) {
      console.warn('[StoryGuide] read blue world info for mega summary failed:', e);
      break;
    }
    if (pending.length < every) break;

    const sorted = pending.sort((a, b) => {
      const ai = parseSummaryIndexInput(a.indexId, s);
      const bi = parseSummaryIndexInput(b.indexId, s);
      if (ai && bi) return ai - bi;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    const slice = sorted.slice(0, every);
    const ok = await createMegaSummaryForSlice(slice, meta, s);
    if (!ok) break;
    created += 1;
  }

  return created;
}

function buildSummaryPromptMessages(chunkText, fromFloor, toFloor, statData = null) {
  const s = ensureSettings();

  // system prompt
  let sys = String(s.summarySystemPrompt || '').trim();
  if (!sys) sys = DEFAULT_SUMMARY_SYSTEM_PROMPT;
  // 强制追加 JSON 结构要求，避免用户自定义提示词导致解析失�?
  sys = sys + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + SUMMARY_JSON_REQUIREMENT;

  // user template (supports placeholders)
  let tpl = String(s.summaryUserTemplate || '').trim();
  if (!tpl) tpl = DEFAULT_SUMMARY_USER_TEMPLATE;

  // 格式�?statData（如果有�?
  let statDataJson = '';
  if (statData) {
    if (typeof statData === 'string') statDataJson = statData.trim();
    else statDataJson = JSON.stringify(statData, null, 2);
  }

  let user = renderTemplate(tpl, {
    fromFloor: String(fromFloor),
    toFloor: String(toFloor),
    chunk: String(chunkText || ''),
    statData: statDataJson,
  });
  // 如果用户模板里没有包�?chunk，占位补回去，防止误配导致无内容
  if (!/{{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*chunk        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*}}/i.test(tpl) && !String(user).includes(String(chunkText || '').slice(0, 12))) {
    user = String(user || '').trim() + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【对话片段】\n${chunkText}`;
  }
  // 如果�?statData 且用户模板里没有包含，追加到末尾
  if (statData && !/{{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*statData        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*}}/i.test(tpl)) {
    user = String(user || '').trim() + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【角色状态数据】\n${statDataJson}`;
  }
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

function sanitizeKeywords(kws, opts = {}) {
  const minLen = clampInt(opts.minLen ?? 2, 1, 64, 2);
  const maxLen = clampInt(opts.maxLen ?? 24, 2, 200, 24);
  const out = [];
  const seen = new Set();
  for (const k of (Array.isArray(kws) ? kws : [])) {
    let t = String(k ?? '').trim();
    if (!t) continue;
    t = t.replace(/[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;r        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;t]/g, ' ').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, ' ').trim();
    // split by common delimiters
    const split = t.split(/[,，�?�?|]+/g).map(x => x.trim()).filter(Boolean);
    for (const s of split) {
      if (s.length < minLen) continue;
      if (s.length > maxLen) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= 16) return out;
    }
  }
  return out;
}

function appendToBlueIndexCache(rec) {
  const s = ensureSettings();
  const item = {
    title: String(rec?.title || '').trim(),
    summary: String(rec?.summary || '').trim(),
    keywords: sanitizeKeywords(rec?.keywords),
    createdAt: Number(rec?.createdAt) || Date.now(),
    range: rec?.range ?? undefined,
  };
  if (!item.summary) return;
  if (!item.title) item.title = item.keywords?.[0] ? `条目�?{item.keywords[0]}` : '条目';
  const arr = Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : [];
  // de-dup (only check recent items)
  for (let i = arr.length - 1; i >= 0 && i >= arr.length - 10; i--) {
    const prev = arr[i];
    if (!prev) continue;
    if (String(prev.title || '') === item.title && String(prev.summary || '') === item.summary) {
      return;
    }
  }
  arr.push(item);
  // keep bounded
  if (arr.length > 600) arr.splice(0, arr.length - 600);
  s.summaryBlueIndex = arr;
  saveSettings();
  updateBlueIndexInfoLabel();
}

// 深合并助手：�?source 合并�?target，处理对象和数组
function deepMergeStructuredData(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      // 数组处理：去重合�?
      const oldArr = Array.isArray(target[key]) ? target[key] : [];
      result[key] = Array.from(new Set([...oldArr, ...value]));
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // 对象处理：递归合并
      result[key] = deepMergeStructuredData(target[key] || {}, value);
    } else {
      // 基本类型：覆�?
      result[key] = value;
    }
  }
  return result;
}

// ===== 结构化世界书条目核心函数 =====

async function buildStructuredEntriesPromptMessages(chunkText, fromFloor, toFloor, meta, statData = null) {
  const s = ensureSettings();
  let sys = String(s.structuredEntriesSystemPrompt || '').trim();
  if (!sys) sys = DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT;
  const charPrompt = String(s.structuredCharacterPrompt || '').trim() || DEFAULT_STRUCTURED_CHARACTER_PROMPT;
  const equipPrompt = String(s.structuredEquipmentPrompt || '').trim() || DEFAULT_STRUCTURED_EQUIPMENT_PROMPT;
  const inventoryPrompt = String(s.structuredInventoryPrompt || '').trim() || DEFAULT_STRUCTURED_INVENTORY_PROMPT;
  const factionPrompt = String(s.structuredFactionPrompt || '').trim() || DEFAULT_STRUCTURED_FACTION_PROMPT;
  const achievementPrompt = String(s.structuredAchievementPrompt || '').trim() || DEFAULT_STRUCTURED_ACHIEVEMENT_PROMPT;
  const subProfessionPrompt = String(s.structuredSubProfessionPrompt || '').trim() || DEFAULT_STRUCTURED_SUBPROFESSION_PROMPT;
  const questPrompt = String(s.structuredQuestPrompt || '').trim() || DEFAULT_STRUCTURED_QUEST_PROMPT;
  const conquestPrompt = String(s.structuredConquestPrompt || '').trim() || DEFAULT_STRUCTURED_CONQUEST_PROMPT;
  sys = [
    sys,
    `【人物条目要求】\n${charPrompt}`,
    `【装备条目要求】\n${equipPrompt}`,
    `【物品栏条目要求】\n${inventoryPrompt}`,
    `【势力条目要求】\n${factionPrompt}`,
    `【成就条目要求】\n${achievementPrompt}`,
    `【副职业条目要求】\n${subProfessionPrompt}`,
    `【任务条目要求】\n${questPrompt}`,
    `【猎艳录条目要求】\n${conquestPrompt}`,
    STRUCTURED_ENTRIES_JSON_REQUIREMENT,
  ].join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');

  const formatKnown = (entries) => {
    return Object.values(entries || {}).map(c => {
      const aliases = Array.isArray(c.aliases) && c.aliases.length > 0 ? `[别名:${c.aliases.join('/')}]` : '';
      const flag = !c.raw ? '(!需要完整信息进行初始化)' : '';
      return `${c.name}${aliases}${flag}`;
    }).join('�?) || '�?;
  };

  const knownChars = formatKnown(meta.characterEntries);
  const knownEquips = formatKnown(meta.equipmentEntries);
  const knownInventories = formatKnown(meta.inventoryEntries);
  const knownFactions = formatKnown(meta.factionEntries);
  const knownAchievements = formatKnown(meta.achievementEntries);
  const knownSubProfessions = formatKnown(meta.subProfessionEntries);
  const knownQuests = formatKnown(meta.questEntries);
  const knownConquests = formatKnown(meta.conquestEntries);


  // 格式�?statData
  let statDataJson = '';
  if (statData) {
    if (typeof statData === 'string') statDataJson = statData.trim();
    else statDataJson = JSON.stringify(statData, null, 2);
  }

  let structuredWorldbookText = '';
  if (s.structuredWorldbookEnabled) {
    try {
      const wb = await ensureStructuredWorldbookLive(false);
      structuredWorldbookText = String(wb?.text || '').trim();
    } catch { /* ignore */ }
  }

  let tpl = String(s.structuredEntriesUserTemplate || '').trim();
  if (!tpl) tpl = DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE;
  let user = renderTemplate(tpl, {
    fromFloor: String(fromFloor),
    toFloor: String(toFloor),
    chunk: String(chunkText || ''),
    knownCharacters: knownChars,
    knownEquipments: knownEquips,
    knownInventories: knownInventories,
    knownFactions: knownFactions,
    knownAchievements: knownAchievements,
    knownSubProfessions: knownSubProfessions,
    knownQuests: knownQuests,
    knownConquests: knownConquests,
    structuredWorldbook: structuredWorldbookText,
    statData: statDataJson,
  });

  if (user.includes('(!需要完整信息进行初始化)')) {
    user += `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【注意】：标记�?(!需要完整信息进行初始化) 的已知条目，请务必在 JSON 中输出其所有字段（即使未变化），以便系统初始化长期记忆。`;
  }

  if (structuredWorldbookText && !/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*structuredWorldbook        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/i.test(tpl)) {
    user = String(user || '').trim() + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【蓝灯世界书】\n${structuredWorldbookText}`;
  }
  // 如果�?statData 且模板里没有包含，追加到末尾
  if (statData && !/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*statData        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/i.test(tpl)) {
    user = String(user || '').trim() + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【角色状态数�?statData】\n${statDataJson}`;
  }
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

async function generateStructuredEntries(chunkText, fromFloor, toFloor, meta, settings, statData = null) {
  const messages = await buildStructuredEntriesPromptMessages(chunkText, fromFloor, toFloor, meta, statData);
  let jsonText = '';
  structuredAbortController = new AbortController();
  const structuredSignal = structuredAbortController.signal;
  try {
    if (String(settings.summaryProvider || 'st') === 'custom') {
      jsonText = await callViaCustom(settings.summaryCustomEndpoint, settings.summaryCustomApiKey, settings.summaryCustomModel, messages, settings.summaryTemperature, settings.summaryCustomMaxTokens, 0.95, settings.summaryCustomStream, structuredSignal);
      if (!String(jsonText || '').trim()) {
        try {
          jsonText = await fallbackAskJsonCustom(settings.summaryCustomEndpoint, settings.summaryCustomApiKey, settings.summaryCustomModel, messages, settings.summaryTemperature, settings.summaryCustomMaxTokens, 0.95, settings.summaryCustomStream, structuredSignal);
        } catch { /* ignore */ }
      }
    } else {
      jsonText = await callViaSillyTavern(messages, null, settings.summaryTemperature, structuredSignal);
      if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
      if (!String(jsonText || '').trim()) {
        try { jsonText = await fallbackAskJson(messages, settings.summaryTemperature); } catch { /* ignore */ }
      }
    }
  } catch (e) {
    if (structuredCancelled || isAbortError(e)) return null;
    throw e;
  } finally {
    structuredAbortController = null;
  }

  if (structuredCancelled) return null;
  const parsed = safeJsonParse(jsonText);
  if (!parsed) {
    console.warn('[StoryGuide] structured entries parse failed (empty or invalid JSON).');
    return null;
  }
  return {
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    equipments: Array.isArray(parsed.equipments) ? parsed.equipments : [],
    inventories: Array.isArray(parsed.inventories) ? parsed.inventories : (Array.isArray(parsed.inventory) ? parsed.inventory : []),
    factions: Array.isArray(parsed.factions) ? parsed.factions : (Array.isArray(parsed.abilities) ? parsed.abilities : []),
    achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    subProfessions: Array.isArray(parsed.subProfessions) ? parsed.subProfessions : [],
    quests: Array.isArray(parsed.quests) ? parsed.quests : [],
    conquests: Array.isArray(parsed.conquests) ? parsed.conquests : [],
    deletedCharacters: Array.isArray(parsed.deletedCharacters) ? parsed.deletedCharacters : [],
    deletedEquipments: Array.isArray(parsed.deletedEquipments) ? parsed.deletedEquipments : [],
    deletedInventories: Array.isArray(parsed.deletedInventories) ? parsed.deletedInventories : [],
    deletedFactions: Array.isArray(parsed.deletedFactions) ? parsed.deletedFactions : (Array.isArray(parsed.deletedAbilities) ? parsed.deletedAbilities : []),
    deletedAchievements: Array.isArray(parsed.deletedAchievements) ? parsed.deletedAchievements : [],
    deletedSubProfessions: Array.isArray(parsed.deletedSubProfessions) ? parsed.deletedSubProfessions : [],
    deletedQuests: Array.isArray(parsed.deletedQuests) ? parsed.deletedQuests : [],
    deletedConquests: Array.isArray(parsed.deletedConquests) ? parsed.deletedConquests : [],
  };
}

async function processStructuredEntriesChunk(chunkText, fromFloor, toFloor, meta, settings, statData = null, changeLog = null) {
  const s = settings || ensureSettings();
  if (!chunkText) return false;
  if (!s.structuredEntriesEnabled) return false;
  if (!s.summaryToWorldInfo && !s.summaryToBlueWorldInfo) return false;

  const recordChange = (results) => {
    if (!changeLog) return;
    const list = Array.isArray(results) ? results : (results ? [results] : []);
    for (const r of list) {
      if (!r) continue;
      if (r.deleted && r.source === 'cache_only') continue;
      if (!(r.created || r.updated || r.deleted)) continue;
      const action = r.created ? 'create' : (r.updated ? 'update' : 'delete');
      changeLog.push({
        action,
        entryType: r.entryType,
        targetType: r.targetType,
        name: r.name,
        indexId: r.indexId,
        comment: r.comment,
        key: r.key,
        content: r.content,
        prevContent: r.prevContent,
        cacheKey: r.cacheKey,
        prevCacheEntry: r.prevCacheEntry,
        cacheEntry: r.cacheEntry,
      });
    }
  };

  const structuredResult = await generateStructuredEntries(chunkText, fromFloor, toFloor, meta, s, statData);
  if (!structuredResult) return false;

  // 写入/更新人物条目（去重由 writeOrUpdate 内部处理�?
  if (s.characterEntriesEnabled && structuredResult.characters?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.characters.length} character(s)`);
    for (const char of structuredResult.characters) {
      const r = await writeOrUpdateCharacterEntry(char, meta, s);
      recordChange(r);
    }
  }
  // 写入/更新装备条目
  if (s.equipmentEntriesEnabled && structuredResult.equipments?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.equipments.length} equipment(s)`);
    for (const equip of structuredResult.equipments) {
      const r = await writeOrUpdateEquipmentEntry(equip, meta, s);
      recordChange(r);
    }
  }
  if (s.inventoryEntriesEnabled && structuredResult.inventories?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.inventories.length} inventory item(s)`);
    for (const item of structuredResult.inventories) {
      const r = await writeOrUpdateInventoryEntry(item, meta, s);
      recordChange(r);
    }
  }
  // 写入/更新势力条目
  if (s.factionEntriesEnabled && structuredResult.factions?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.factions.length} faction(s)`);
    for (const faction of structuredResult.factions) {
      const r = await writeOrUpdateFactionEntry(faction, meta, s);
      recordChange(r);
    }
  }
  // 写入/更新成就条目
  if (s.achievementEntriesEnabled && structuredResult.achievements?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.achievements.length} achievement(s)`);
    for (const achievement of structuredResult.achievements) {
      const r = await writeOrUpdateAchievementEntry(achievement, meta, s);
      recordChange(r);
    }
  }
  // 写入/更新副职业条�?
  if (s.subProfessionEntriesEnabled && structuredResult.subProfessions?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.subProfessions.length} sub profession(s)`);
    for (const subProfession of structuredResult.subProfessions) {
      const r = await writeOrUpdateSubProfessionEntry(subProfession, meta, s);
      recordChange(r);
    }
  }
  // 写入/更新任务条目
  if (s.questEntriesEnabled && structuredResult.quests?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.quests.length} quest(s)`);
    for (const quest of structuredResult.quests) {
      const r = await writeOrUpdateQuestEntry(quest, meta, s);
      recordChange(r);
    }
  }
  // 写入/更新猎艳录条�?
  if (s.conquestEntriesEnabled && structuredResult.conquests?.length) {
    console.log(`[StoryGuide] Processing ${structuredResult.conquests.length} conquest(s)`);
    for (const conquest of structuredResult.conquests) {
      const r = await writeOrUpdateConquestEntry(conquest, meta, s);
      recordChange(r);
    }
  }

  // 处理删除的条�?
  if (structuredResult.deletedCharacters?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedCharacters.length} character(s)`);
    for (const charName of structuredResult.deletedCharacters) {
      const r = await deleteCharacterEntry(charName, meta, s);
      recordChange(r);
    }
  }
  if (structuredResult.deletedEquipments?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedEquipments.length} equipment(s)`);
    for (const equipName of structuredResult.deletedEquipments) {
      const r = await deleteEquipmentEntry(equipName, meta, s);
      recordChange(r);
    }
  }
  if (structuredResult.deletedInventories?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedInventories.length} inventory item(s)`);
    for (const itemName of structuredResult.deletedInventories) {
      const r = await deleteInventoryEntry(itemName, meta, s);
      recordChange(r);
    }
  }
  if (structuredResult.deletedFactions?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedFactions.length} faction(s)`);
    for (const factionName of structuredResult.deletedFactions) {
      const r = await deleteFactionEntry(factionName, meta, s);
      recordChange(r);
    }
  }
  if (structuredResult.deletedAchievements?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedAchievements.length} achievement(s)`);
    for (const achievementName of structuredResult.deletedAchievements) {
      const r = await deleteAchievementEntry(achievementName, meta, s);
      recordChange(r);
    }
  }
  if (structuredResult.deletedSubProfessions?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedSubProfessions.length} sub profession(s)`);
    for (const subProfessionName of structuredResult.deletedSubProfessions) {
      const r = await deleteSubProfessionEntry(subProfessionName, meta, s);
      recordChange(r);
    }
  }
  if (structuredResult.deletedQuests?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedQuests.length} quest(s)`);
    for (const questName of structuredResult.deletedQuests) {
      const r = await deleteQuestEntry(questName, meta, s);
      recordChange(r);
    }
  }
  if (structuredResult.deletedConquests?.length) {
    console.log(`[StoryGuide] Deleting ${structuredResult.deletedConquests.length} conquest(s)`);
    for (const conquestName of structuredResult.deletedConquests) {
      const r = await deleteConquestEntry(conquestName, meta, s);
      recordChange(r);
    }
  }

  await setSummaryMeta(meta);
  return true;
}

// 构建条目�?key（用于世界书触发词和去重�?
function buildStructuredEntryKey(prefix, name, indexId) {
  return `${prefix}�?{name}�?{indexId}`;
}

const STRUCTURED_ENTRY_CACHE_FIELDS = Object.freeze({
  character: 'characterEntries',
  equipment: 'equipmentEntries',
  inventory: 'inventoryEntries',
  faction: 'factionEntries',
  achievement: 'achievementEntries',
  subProfession: 'subProfessionEntries',
  quest: 'questEntries',
  conquest: 'conquestEntries',
});

function getStructuredEntriesCache(meta, entryType) {
  if (!meta || typeof meta !== 'object') return null;
  const key = STRUCTURED_ENTRY_CACHE_FIELDS[entryType];
  if (!key) return null;
  if (!meta[key] || typeof meta[key] !== 'object') meta[key] = {};
  return meta[key];
}

function formatStructuredValue(value, mode = 'text', depth = 0) {
  if (value === null || value === undefined) return '';
  const t = typeof value;
  if (t === 'string') return String(value).trim();
  if (t === 'number' || t === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map(v => formatStructuredValue(v, mode, depth + 1)).filter(Boolean);
    if (!items.length) return '';
    if (mode === 'markdown') {
      return items.map(v => `- ${v.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n  ')}`).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
    }
    return items.join('�?);
  }
  if (t === 'object') {
    const pairs = [];
    for (const [k, v] of Object.entries(value)) {
      const rendered = formatStructuredValue(v, mode, depth + 1);
      if (!rendered) continue;
      if (mode === 'markdown' && rendered.includes('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n')) {
        pairs.push(`${k}：\n${rendered}`);
      } else {
        pairs.push(`${k}�?{rendered}`);
      }
    }
    if (!pairs.length) return '';
    if (mode === 'markdown') {
      return pairs.map(p => `- ${p.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n  ')}`).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
    }
    return pairs.join('�?);
  }
  return String(value).trim();
}

function pushStructuredLabel(parts, label, value, mode) {
  const rendered = formatStructuredValue(value, mode);
  if (!rendered) return;
  if (mode === 'markdown' && rendered.includes('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n')) {
    parts.push(`${label}：\n${rendered}`);
  } else {
    parts.push(`${label}�?{rendered}`);
  }
}

const STRUCTURED_ENTRY_META_KEYS = new Set([
  'isNew',
  'isUpdated',
  'indexId',
  'index',
  'uid',
  'id',
  'type',
  'comment',
  'key',
  'keys',
  'disabled',
  'disable',
  'constant',
  'targetType',
]);

function appendExtraFields(parts, data, knownKeys) {
  if (!data || typeof data !== 'object') return;
  const mode = String(knownKeys?.__mode || '').trim() || 'text';
  const known = new Set([...(knownKeys || []), ...STRUCTURED_ENTRY_META_KEYS]);
  for (const [key, value] of Object.entries(data)) {
    if (known.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;

    const rendered = formatStructuredValue(value, mode);
    if (!rendered) continue;
    if (mode === 'markdown' && rendered.includes('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n')) {
      parts.push(`${key}：\n${rendered}`);
    } else {
      parts.push(`${key}�?{rendered}`);
    }
  }
}

// 构建条目内容（档案式描述�?
function formatTemplateField(value, mode) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    const simple = value.every(v => v == null || ['string', 'number', 'boolean'].includes(typeof v));
    if (simple) {
      const items = value.map(v => String(v ?? '').trim()).filter(Boolean);
      if (!items.length) return '';
      if (mode === 'markdown') {
        const list = items.map(item => `- ${item}`).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
        return list ? `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${list}` : '';
      }
      return items.join(', ');
    }
    const rendered = formatStructuredValue(value, mode);
    if (mode === 'markdown' && rendered.includes('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n') && !rendered.startsWith('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n')) return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${rendered}`;
    return rendered;
  }
  if (typeof value === 'object') {
    const rendered = formatStructuredValue(value, mode);
    if (mode === 'markdown' && rendered.includes('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n') && !rendered.startsWith('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n')) return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${rendered}`;
    return rendered;
  }
  const text = String(value).trim();
  return text;
}

function cleanupStructuredTemplateOutput(text) {
  const lines = String(text || '').split(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;r?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n/);
  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/[:        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;uFF1A]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*$/.test(trimmed)) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && /^([-*]|        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;.)/.test(lines[j].trim())) {
        cleaned.push(line);
      }
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

function isFemaleCharacter(char) {
  const gender = String(char?.gender || '').trim().toLowerCase();
  if (!gender) return false;
  if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5973/.test(gender)) return true;
  if (gender === 'f') return true;
  if (gender.includes('female') || gender.includes('woman') || gender.includes('girl')) return true;
  return false;
}

// Build entry content (profile format)
function buildCharacterContent(char) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredCharacterEntryTemplate || '').trim() || DEFAULT_STRUCTURED_CHARACTER_ENTRY_TEMPLATE;
  const knownKeys = [
    'name',
    'aliases',
    'gender',
    'faction',
    'status',
    'personality',
    'corePersonality',
    'motivation',
    'relationshipStage',
    'background',
    'relationToProtagonist',
    'keyEvents',
    'sixStats',
    'equipment',
    'skillsTalents',
    'inventory',
    'sexLife',
  ];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, char, knownKeys);
  const extraFields = extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
  const vars = {
    name: formatTemplateField(char?.name, mode),
    aliases: formatTemplateField(char?.aliases, mode),
    gender: formatTemplateField(char?.gender, mode),
    faction: formatTemplateField(char?.faction, mode),
    status: formatTemplateField(char?.status, mode),
    personality: formatTemplateField(char?.personality, mode),
    background: formatTemplateField(char?.background, mode),
    sixStats: formatTemplateField(char?.sixStats, mode),
    equipment: formatTemplateField(char?.equipment, mode),
    skillsTalents: formatTemplateField(char?.skillsTalents, mode),
    inventory: formatTemplateField(char?.inventory, mode),
    sexLife: isFemaleCharacter(char) ? formatTemplateField(char?.sexLife, mode) : '',
    corePersonality: formatTemplateField(char?.corePersonality, mode),
    motivation: formatTemplateField(char?.motivation, mode),
    relationshipStage: formatTemplateField(char?.relationshipStage, mode),
    relationToProtagonist: formatTemplateField(char?.relationToProtagonist, mode),
    keyEvents: formatTemplateField(char?.keyEvents, mode),
    extraFields,
  };
  const output = renderTemplate(template, vars);
  return cleanupStructuredTemplateOutput(output);
}

function buildEquipmentContent(equip) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredEquipmentEntryTemplate || '').trim() || DEFAULT_STRUCTURED_EQUIPMENT_ENTRY_TEMPLATE;
  const knownKeys = ['name', 'aliases', 'type', 'rarity', 'effects', 'source', 'currentState', 'statInfo', 'boundEvents'];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, equip, knownKeys);
  const vars = {
    name: formatTemplateField(equip?.name, mode),
    aliases: formatTemplateField(equip?.aliases, mode),
    type: formatTemplateField(equip?.type, mode),
    rarity: formatTemplateField(equip?.rarity, mode),
    effects: formatTemplateField(equip?.effects, mode),
    source: formatTemplateField(equip?.source, mode),
    currentState: formatTemplateField(equip?.currentState, mode),
    statInfo: formatTemplateField(equip?.statInfo, mode),
    boundEvents: formatTemplateField(equip?.boundEvents, mode),
    extraFields: extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n'),
  };
  return cleanupStructuredTemplateOutput(renderTemplate(template, vars));
}

function buildInventoryContent(item) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredInventoryEntryTemplate || '').trim() || DEFAULT_STRUCTURED_INVENTORY_ENTRY_TEMPLATE;
  const knownKeys = ['name', 'aliases', 'type', 'rarity', 'quantity', 'effects', 'source', 'currentState', 'statInfo', 'boundEvents'];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, item, knownKeys);
  const vars = {
    name: formatTemplateField(item?.name, mode),
    aliases: formatTemplateField(item?.aliases, mode),
    type: formatTemplateField(item?.type, mode),
    rarity: formatTemplateField(item?.rarity, mode),
    quantity: formatTemplateField(item?.quantity, mode),
    effects: formatTemplateField(item?.effects, mode),
    source: formatTemplateField(item?.source, mode),
    currentState: formatTemplateField(item?.currentState, mode),
    statInfo: formatTemplateField(item?.statInfo, mode),
    boundEvents: formatTemplateField(item?.boundEvents, mode),
    extraFields: extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n'),
  };
  return cleanupStructuredTemplateOutput(renderTemplate(template, vars));
}

function buildFactionContent(faction) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredFactionEntryTemplate || '').trim() || DEFAULT_STRUCTURED_FACTION_ENTRY_TEMPLATE;
  const knownKeys = ['name', 'aliases', 'type', 'scope', 'leader', 'ideology', 'relationToProtagonist', 'status', 'keyEvents', 'statInfo'];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, faction, knownKeys);
  const vars = {
    name: formatTemplateField(faction?.name, mode),
    aliases: formatTemplateField(faction?.aliases, mode),
    type: formatTemplateField(faction?.type, mode),
    scope: formatTemplateField(faction?.scope, mode),
    leader: formatTemplateField(faction?.leader, mode),
    ideology: formatTemplateField(faction?.ideology, mode),
    relationToProtagonist: formatTemplateField(faction?.relationToProtagonist, mode),
    status: formatTemplateField(faction?.status, mode),
    keyEvents: formatTemplateField(faction?.keyEvents, mode),
    statInfo: formatTemplateField(faction?.statInfo, mode),
    extraFields: extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n'),
  };
  return cleanupStructuredTemplateOutput(renderTemplate(template, vars));
}

function buildAchievementContent(achievement) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredAchievementEntryTemplate || '').trim() || DEFAULT_STRUCTURED_ACHIEVEMENT_ENTRY_TEMPLATE;
  const knownKeys = ['name', 'description', 'requirements', 'obtainedAt', 'status', 'effects', 'keyEvents', 'statInfo'];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, achievement, knownKeys);
  const vars = {
    name: formatTemplateField(achievement?.name, mode),
    description: formatTemplateField(achievement?.description, mode),
    requirements: formatTemplateField(achievement?.requirements, mode),
    obtainedAt: formatTemplateField(achievement?.obtainedAt, mode),
    status: formatTemplateField(achievement?.status, mode),
    effects: formatTemplateField(achievement?.effects, mode),
    keyEvents: formatTemplateField(achievement?.keyEvents, mode),
    statInfo: formatTemplateField(achievement?.statInfo, mode),
    extraFields: extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n'),
  };
  return cleanupStructuredTemplateOutput(renderTemplate(template, vars));
}

function buildSubProfessionContent(subProfession) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredSubProfessionEntryTemplate || '').trim() || DEFAULT_STRUCTURED_SUBPROFESSION_ENTRY_TEMPLATE;
  const knownKeys = ['name', 'role', 'level', 'progress', 'skills', 'source', 'status', 'keyEvents', 'statInfo'];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, subProfession, knownKeys);
  const vars = {
    name: formatTemplateField(subProfession?.name, mode),
    role: formatTemplateField(subProfession?.role, mode),
    level: formatTemplateField(subProfession?.level, mode),
    progress: formatTemplateField(subProfession?.progress, mode),
    skills: formatTemplateField(subProfession?.skills, mode),
    source: formatTemplateField(subProfession?.source, mode),
    status: formatTemplateField(subProfession?.status, mode),
    keyEvents: formatTemplateField(subProfession?.keyEvents, mode),
    statInfo: formatTemplateField(subProfession?.statInfo, mode),
    extraFields: extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n'),
  };
  return cleanupStructuredTemplateOutput(renderTemplate(template, vars));
}

function buildQuestContent(quest) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredQuestEntryTemplate || '').trim() || DEFAULT_STRUCTURED_QUEST_ENTRY_TEMPLATE;
  const knownKeys = ['name', 'goal', 'progress', 'status', 'issuer', 'reward', 'deadline', 'location', 'keyEvents', 'statInfo'];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, quest, knownKeys);
  const vars = {
    name: formatTemplateField(quest?.name, mode),
    goal: formatTemplateField(quest?.goal, mode),
    progress: formatTemplateField(quest?.progress, mode),
    status: formatTemplateField(quest?.status, mode),
    issuer: formatTemplateField(quest?.issuer, mode),
    reward: formatTemplateField(quest?.reward, mode),
    deadline: formatTemplateField(quest?.deadline, mode),
    location: formatTemplateField(quest?.location, mode),
    keyEvents: formatTemplateField(quest?.keyEvents, mode),
    statInfo: formatTemplateField(quest?.statInfo, mode),
    extraFields: extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n'),
  };
  return cleanupStructuredTemplateOutput(renderTemplate(template, vars));
}

function buildConquestContent(conquest) {
  const s = ensureSettings();
  const mode = String(s.structuredEntryContentFormat || 'text');
  const template = String(s.structuredConquestEntryTemplate || '').trim() || DEFAULT_STRUCTURED_CONQUEST_ENTRY_TEMPLATE;
  const knownKeys = ['name', 'aliases', 'identity', 'firstEncounter', 'conquestProcess', 'conquestTime', 'currentRelation', 'specialTechniques', 'bodyFeatures', 'status', 'keyEvents', 'statInfo'];
  const extraParts = [];
  knownKeys.__mode = mode;
  appendExtraFields(extraParts, conquest, knownKeys);
  const vars = {
    name: formatTemplateField(conquest?.name, mode),
    aliases: formatTemplateField(conquest?.aliases, mode),
    identity: formatTemplateField(conquest?.identity, mode),
    firstEncounter: formatTemplateField(conquest?.firstEncounter, mode),
    conquestProcess: formatTemplateField(conquest?.conquestProcess, mode),
    conquestTime: formatTemplateField(conquest?.conquestTime, mode),
    currentRelation: formatTemplateField(conquest?.currentRelation, mode),
    specialTechniques: formatTemplateField(conquest?.specialTechniques, mode),
    bodyFeatures: formatTemplateField(conquest?.bodyFeatures, mode),
    status: formatTemplateField(conquest?.status, mode),
    keyEvents: formatTemplateField(conquest?.keyEvents, mode),
    statInfo: formatTemplateField(conquest?.statInfo, mode),
    extraFields: extraParts.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n'),
  };
  return cleanupStructuredTemplateOutput(renderTemplate(template, vars));
}

// 写入或更新结构化条目（方案C：混合策略）
// targetType: 'green' = 绿灯世界书（触发词触发）, 'blue' = 蓝灯世界书（常开索引�?
async function writeOrUpdateStructuredEntry(entryType, entryData, meta, settings, {
  buildContent,
  entriesCache,
  nextIndexKey,
  prefix,
  targetType = 'green', // 'green' | 'blue'
}) {
  // 使用规范化的名称作为唯一标识符（忽略 LLM 提供�?uid，因为不可靠�?
  const entryName = String(entryData.name || '').trim();
  if (!entryName) return null;

  // 规范化名称：移除特殊字符，用于缓�?key
  const normalizedName = entryName.replace(/[|�?，\s]/g, '_').toLowerCase();
  const cacheKey = `${normalizedName}_${targetType}`;

  // 首先�?cacheKey 直接查找
  let cached = entriesCache[cacheKey];

  // 如果直接查找失败，遍历缓存按名称模糊匹配（处理同一人物不同写法�?
  if (!cached) {
    for (const [key, value] of Object.entries(entriesCache)) {
      if (!key.endsWith(`_${targetType}`)) continue;
      const cachedNameNorm = String(value.name || '').replace(/[|�?，\s]/g, '_').toLowerCase();
      const cachedAliases = Array.isArray(value.aliases) ? value.aliases.map(a => String(a).toLowerCase().trim()) : [];
      const newAliases = Array.isArray(entryData.aliases) ? entryData.aliases.map(a => String(a).toLowerCase().trim()) : [];
      const nameMatch = cachedNameNorm === normalizedName; // Disable aggressive fuzzy match: || cachedNameNorm.includes(normalizedName) || normalizedName.includes(cachedNameNorm);
      const newNameInCachedAliases = cachedAliases.some(a => a === normalizedName); // || a.includes(normalizedName) || normalizedName.includes(a));
      const cachedNameInNewAliases = newAliases.some(a => a === cachedNameNorm); // || a.includes(cachedNameNorm) || cachedNameNorm.includes(a));
      // const aliasesOverlap = cachedAliases.some(ca => newAliases.some(na => ca === na || ca.includes(na) || na.includes(ca)));
      const aliasesOverlap = cachedAliases.some(ca => newAliases.some(na => ca === na));

      if (nameMatch || newNameInCachedAliases || cachedNameInNewAliases || aliasesOverlap) {
        cached = value;
        if (entryName.toLowerCase() !== String(value.name).toLowerCase()) {
          console.log(`[StoryGuide] Found cached ${entryType} by smart match: "${entryName}" -> "${value.name}" (Strict Match)`);
          cached.aliases = cached.aliases || [];
          if (!cached.aliases.some(a => String(a).toLowerCase() === entryName.toLowerCase())) {
            cached.aliases.push(entryName);
            console.log(`[StoryGuide] Added "${entryName}" as alias for "${value.name}"`);
          }
        }
        break;
      }
    }
  }

  // 合并数据：如果已有缓存，则将新数据合并到旧数据中
  let finalEntryData = entryData;
  if (cached && cached.raw) {
    finalEntryData = deepMergeStructuredData(cached.raw, entryData);
    console.log(`[StoryGuide] Deep merged incremental data for ${entryType}: ${entryName}`);
  }

  const content = buildContent(finalEntryData).replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?);

  // 根据 targetType 选择世界书目�?
  let target, file, constant;
  if (targetType === 'blue') {
    target = 'file';
    file = normalizeWorldInfoFileName(settings.summaryBlueWorldInfoFile);
    constant = 1; // 蓝灯=常开
    if (!file) return null; // 蓝灯必须指定文件�?
  } else {
    const greenTarget = resolveGreenWorldInfoTarget(settings);
    target = greenTarget.target;
    file = greenTarget.file;
    constant = 0; // 绿灯=触发词触�?
    if (!file) return null; // 绿灯强制 file，无文件名直接跳�?
  }
  const fileExprForQuery = (target === 'chatbook') ? '{{getchatbook}}' : file;

  // 去重和更新检查：如果本地缓存已有此条�?
  if (cached) {
    const prevCacheEntry = clone(cached);
    // 内容相同 -> 跳过
    if (cached.content === content) {
      console.log(`[StoryGuide] Skip unchanged ${entryType} (${targetType}): ${entryName}`);
      return { skipped: true, name: entryName, entryType, targetType, cacheKey, reason: 'unchanged' };
    }

    // 内容不同 -> 尝试使用 /findentry 查找并更�?
    console.log(`[StoryGuide] Content changed for ${entryType} (${targetType}): ${entryName}, attempting update via /findentry...`);
    try {
      // 使用 /findentry 通过 comment 字段查找条目 UID
      // comment 格式�? "人物｜角色名｜CHA-001"
      const searchName = String(cached?.name || entryName).trim() || entryName;
      const searchIndexSuffix = cached?.indexId ? `�?{cached.indexId}` : '';
      const searchPatterns = [
        `${prefix}�?{searchName}${searchIndexSuffix}`,
        `[已删除] ${prefix}�?{searchName}${searchIndexSuffix}`
      ];
      if (searchIndexSuffix) {
        searchPatterns.push(`${prefix}�?{searchName}`);
        // searchPatterns.push(`[已删除] ${prefix}�?{searchName}`);
      }

      console.log(`[StoryGuide] DEBUG Update Search: Patterns=${JSON.stringify(searchPatterns)}`);

      let foundUid = null;
      for (const searchPattern of searchPatterns) {
        // 构建查找脚本
        let findParts = [];
        const findUidVar = '__sg_find_uid';
        const findFileVar = '__sg_find_file';

        if (target === 'chatbook') {
          findParts.push('/getchatbook');
          findParts.push(`/setvar key=${findFileVar}`);
          findParts.push(`/findentry file={{getvar::${findFileVar}}} field=comment ${quoteSlashValue(searchPattern)}`);
        } else {
          findParts.push(`/findentry file=${quoteSlashValue(file)} field=comment ${quoteSlashValue(searchPattern)}`);
        }
        findParts.push(`/setvar key=${findUidVar}`);
        findParts.push(`/getvar ${findUidVar}`);

        const findResult = await execSlash(findParts.join(' | '));

        // DEBUG: 查看 findentry 返回�?
        console.log(`[StoryGuide] DEBUG /findentry result:`, findResult, `type:`, typeof findResult, `pattern:`, searchPattern);

        foundUid = parseFindEntryUid(findResult);
        console.log(`[StoryGuide] DEBUG parsed foundUid:`, foundUid);

        // 清理临时变量
        try { await execSlash(`/flushvar ${findUidVar}`); } catch { /* ignore */ }
        if (target === 'chatbook') {
          try { await execSlash(`/flushvar ${findFileVar}`); } catch { /* ignore */ }
        }

        if (foundUid) break;
      }

      if (foundUid) {
        // 找到条目，更新内�?
        let updateParts = [];
        const updateFileVar = '__sg_update_file';

        const shouldReenable = !!settings.structuredReenableEntriesEnabled;
        const commentName = String(cached?.name || entryName).trim() || entryName;
        const indexSuffix = cached?.indexId ? `�?{cached.indexId}` : '';
        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;
        const newKey = cached?.indexId ? buildStructuredEntryKey(prefix, commentName, cached.indexId) : '';

        if (target === 'chatbook') {
          // chatbook 模式需要先获取文件�?
          updateParts.push('/getchatbook');
          updateParts.push(`/setvar key=${updateFileVar}`);
          updateParts.push(`/setentryfield file={{getvar::${updateFileVar}}} uid=${foundUid} field=content ${quoteSlashValue(content)}`);
          if (shouldReenable) {
            updateParts.push(`/setentryfield file={{getvar::${updateFileVar}}} uid=${foundUid} field=disable 0`);
            if (newKey) updateParts.push(`/setentryfield file={{getvar::${updateFileVar}}} uid=${foundUid} field=key ${quoteSlashValue(newKey)}`);
          }
          updateParts.push(`/flushvar ${updateFileVar}`);
        } else {
          updateParts.push(`/setentryfield file=${quoteSlashValue(file)} uid=${foundUid} field=content ${quoteSlashValue(content)}`);
          if (shouldReenable) {
            updateParts.push(`/setentryfield file=${quoteSlashValue(file)} uid=${foundUid} field=disable 0`);
            if (newKey) updateParts.push(`/setentryfield file=${quoteSlashValue(file)} uid=${foundUid} field=key ${quoteSlashValue(newKey)}`);
          }
        }

        await execSlash(updateParts.join(' | '));
        cached.content = content;
        cached.raw = finalEntryData;
        cached.lastUpdated = Date.now();
        if (!cached.comment && stableComment) cached.comment = stableComment;
        console.log(`[StoryGuide] Updated ${entryType} (${targetType}): ${entryName} -> UID ${foundUid}`);
        const comment = stableComment;
        const key = newKey;
        return {
          updated: true,
          name: entryName,
          entryType,
          targetType,
          uid: foundUid,
          indexId: cached?.indexId,
          comment,
          key,
          prevContent: prevCacheEntry?.content,
          content,
          cacheKey,
          prevCacheEntry,
        };
      }
    } catch (e) {
      console.warn(`[StoryGuide] Update ${entryType} (${targetType}) via /findentry failed:`, e);
    }
  }

  // 创建新条�?(或更新查无此人的缓存条目)
  // 对于蓝灯条目，先检查是否有对应的绿灯条目，复用�?indexId
  let indexId = cached?.indexId;
  if (!indexId) {
    const greenCacheKey = `${normalizedName}_green`;
    const existingGreenEntry = entriesCache[greenCacheKey];

    if (targetType === 'blue' && existingGreenEntry?.indexId) {
      // 蓝灯复用绿灯�?indexId
      indexId = existingGreenEntry.indexId;
      console.log(`[StoryGuide] Reusing green indexId for blue: ${entryName} -> ${indexId}`);
    } else {
      // 绿灯或没有对应绿灯条目时，生成新 indexId
      const indexNum = meta[nextIndexKey] || 1;
      indexId = `${entryType.substring(0, 3).toUpperCase()}-${String(indexNum).padStart(3, '0')}`;
      meta[nextIndexKey] = Number(indexNum) + 1;
      await setSummaryMeta(meta);
    }
  }

  const keyValue = buildStructuredEntryKey(prefix, entryName, indexId);
  const comment = `${prefix}�?{entryName}�?{indexId}`;

  const uidVar = '__sg_struct_uid';
  const fileVar = '__sg_struct_wbfile';
  const createFileExpr = (target === 'chatbook') ? `{{getvar::${fileVar}}}` : file;

  const parts = [];
  if (target === 'chatbook') {
    parts.push('/getchatbook');
    parts.push(`/setvar key=${fileVar}`);
  }
  parts.push(`/createentry file=${quoteSlashValue(createFileExpr)} key=${quoteSlashValue(keyValue)} ${quoteSlashValue(content)}`);
  parts.push(`/setvar key=${uidVar}`);
  parts.push(`/setentryfield file=${quoteSlashValue(createFileExpr)} uid={{getvar::${uidVar}}} field=comment ${quoteSlashValue(comment)}`);
  parts.push(`/setentryfield file=${quoteSlashValue(createFileExpr)} uid={{getvar::${uidVar}}} field=disable 0`);
  parts.push(`/setentryfield file=${quoteSlashValue(createFileExpr)} uid={{getvar::${uidVar}}} field=constant ${constant}`);
  parts.push(`/flushvar ${uidVar}`);
  if (target === 'chatbook') parts.push(`/flushvar ${fileVar}`);

  try {
    await execSlash(parts.join(' | '));
    // 更新缓存
    entriesCache[cacheKey] = {
      name: entryName,
      aliases: entryData.aliases || [],
      content,
      lastUpdated: Date.now(),
      indexId,
      targetType,
      comment,
      raw: finalEntryData,
    };
    if (targetType === 'green' && !existingGreenEntry) {
      // 只在绿灯首次创建时递增索引
      meta[nextIndexKey] = (meta[nextIndexKey] || 1) + 1;
    }
    console.log(`[StoryGuide] Created ${entryType} (${targetType}): ${entryName} -> ${indexId}`);
    return {
      created: true,
      name: entryName,
      entryType,
      indexId,
      targetType,
      comment,
      key: keyValue,
      content,
      cacheKey,
    };
  } catch (e) {
    console.warn(`[StoryGuide] Create ${entryType} (${targetType}) entry failed:`, e);
    return null;
  }
}


async function writeOrUpdateCharacterEntry(char, meta, settings) {
  if (!char?.name) return null;
  const results = [];
  // 写入绿灯世界�?
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('character', char, meta, settings, {
      buildContent: buildCharacterContent,
      entriesCache: meta.characterEntries,
      nextIndexKey: 'nextCharacterIndex',
      prefix: settings.characterEntryPrefix || '人物',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  // 写入蓝灯世界�?
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('character', char, meta, settings, {
      buildContent: buildCharacterContent,
      entriesCache: meta.characterEntries,
      nextIndexKey: 'nextCharacterIndex',
      prefix: settings.characterEntryPrefix || '人物',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateEquipmentEntry(equip, meta, settings) {
  if (!equip?.name) return null;
  const results = [];
  // 写入绿灯世界�?
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('equipment', equip, meta, settings, {
      buildContent: buildEquipmentContent,
      entriesCache: meta.equipmentEntries,
      nextIndexKey: 'nextEquipmentIndex',
      prefix: settings.equipmentEntryPrefix || '装备',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  // 写入蓝灯世界�?
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('equipment', equip, meta, settings, {
      buildContent: buildEquipmentContent,
      entriesCache: meta.equipmentEntries,
      nextIndexKey: 'nextEquipmentIndex',
      prefix: settings.equipmentEntryPrefix || '装备',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateFactionEntry(faction, meta, settings) {
  if (!faction?.name) return null;
  const results = [];
  // 写入绿灯世界�?
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('faction', faction, meta, settings, {
      buildContent: buildFactionContent,
      entriesCache: meta.factionEntries,
      nextIndexKey: 'nextFactionIndex',
      prefix: settings.factionEntryPrefix || '势力',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  // 写入蓝灯世界�?
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('faction', faction, meta, settings, {
      buildContent: buildFactionContent,
      entriesCache: meta.factionEntries,
      nextIndexKey: 'nextFactionIndex',
      prefix: settings.factionEntryPrefix || '势力',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateInventoryEntry(item, meta, settings) {
  if (!item?.name) return null;
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('inventory', item, meta, settings, {
      buildContent: buildInventoryContent,
      entriesCache: meta.inventoryEntries,
      nextIndexKey: 'nextInventoryIndex',
      prefix: settings.inventoryEntryPrefix || '物品�?,
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('inventory', item, meta, settings, {
      buildContent: buildInventoryContent,
      entriesCache: meta.inventoryEntries,
      nextIndexKey: 'nextInventoryIndex',
      prefix: settings.inventoryEntryPrefix || '物品�?,
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateAchievementEntry(achievement, meta, settings) {
  if (!achievement?.name) return null;
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('achievement', achievement, meta, settings, {
      buildContent: buildAchievementContent,
      entriesCache: meta.achievementEntries,
      nextIndexKey: 'nextAchievementIndex',
      prefix: settings.achievementEntryPrefix || '成就',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('achievement', achievement, meta, settings, {
      buildContent: buildAchievementContent,
      entriesCache: meta.achievementEntries,
      nextIndexKey: 'nextAchievementIndex',
      prefix: settings.achievementEntryPrefix || '成就',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateSubProfessionEntry(subProfession, meta, settings) {
  if (!subProfession?.name) return null;
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('subProfession', subProfession, meta, settings, {
      buildContent: buildSubProfessionContent,
      entriesCache: meta.subProfessionEntries,
      nextIndexKey: 'nextSubProfessionIndex',
      prefix: settings.subProfessionEntryPrefix || '副职�?,
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('subProfession', subProfession, meta, settings, {
      buildContent: buildSubProfessionContent,
      entriesCache: meta.subProfessionEntries,
      nextIndexKey: 'nextSubProfessionIndex',
      prefix: settings.subProfessionEntryPrefix || '副职�?,
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateQuestEntry(quest, meta, settings) {
  if (!quest?.name) return null;
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('quest', quest, meta, settings, {
      buildContent: buildQuestContent,
      entriesCache: meta.questEntries,
      nextIndexKey: 'nextQuestIndex',
      prefix: settings.questEntryPrefix || '任务',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('quest', quest, meta, settings, {
      buildContent: buildQuestContent,
      entriesCache: meta.questEntries,
      nextIndexKey: 'nextQuestIndex',
      prefix: settings.questEntryPrefix || '任务',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateConquestEntry(conquest, meta, settings) {
  if (!conquest?.name) return null;
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('conquest', conquest, meta, settings, {
      buildContent: buildConquestContent,
      entriesCache: meta.conquestEntries,
      nextIndexKey: 'nextConquestIndex',
      prefix: settings.conquestEntryPrefix || '猎艳�?,
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('conquest', conquest, meta, settings, {
      buildContent: buildConquestContent,
      entriesCache: meta.conquestEntries,
      nextIndexKey: 'nextConquestIndex',
      prefix: settings.conquestEntryPrefix || '猎艳�?,
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除结构化条目（从世界书中删除死亡角色、卖掉装备等�?
async function deleteStructuredEntry(entryType, entryName, meta, settings, {
  entriesCache,
  prefix,
  targetType = 'green',
}) {
  if (!entryName) return null;
  const normalizedName = String(entryName || '').trim().toLowerCase();

  // 查找缓存中的条目
  const cacheKey = `${normalizedName}_${targetType}`;
  const cached = entriesCache[cacheKey];
  if (!cached) {
    console.log(`[StoryGuide] Delete ${entryType} (${targetType}): ${entryName} not found in cache`);
    return null;
  }
  const cacheEntry = clone(cached);

  // 构建 comment 用于查找世界书条�?
  const comment = `${prefix}�?{cached.name}�?{cached.indexId}`;
  const key = cached?.indexId ? buildStructuredEntryKey(prefix, cached.name, cached.indexId) : '';

  // [Safety Check] 防止删除别名/合并条目时误删主条目
  // 如果当前要删除的名字 (entryName) 与缓存的主名�?(cached.name) 不一致，
  // 说明这是一个“被合并”的条目（指针）。删除它不应影响主条目�?
  const cachedNameNormCheck = String(cached.name || '').trim().toLowerCase();
  if (normalizedName !== cachedNameNormCheck) {
    console.log(`[StoryGuide] Safety Guard: Deleting alias "${entryName}" (points to "${cached.name}"). Skipping Worldbook deletion.`);
    if (entriesCache[cacheKey]) entriesCache[cacheKey].disabled = true;
    return {
      deleted: true,
      name: entryName,
      entryType,
      targetType,
      source: 'cache_alias_only',
      comment,
      key,
      content: cacheEntry?.content,
      cacheKey,
      cacheEntry,
    };
  }

  // 确定目标世界�?
  let target = 'chatbook';
  let file = '';
  if (targetType === 'blue') {
    target = 'file';
    file = normalizeWorldInfoFileName(settings.summaryBlueWorldInfoFile);
    if (!file) {
      console.warn(`[StoryGuide] No blue world info file configured for deletion`);
      return null;
    }
  } else {
    const greenTarget = resolveGreenWorldInfoTarget(settings);
    target = greenTarget.target;
    file = greenTarget.file;
  }

  // 使用 /findentry 查找条目 UID
  try {
    let findExpr;
    const findFileVar = 'sgTmpFindFile';
    if (target === 'chatbook') {
      // 使用 setvar/getvar 管道获取 chatbook 文件�?
      await execSlash(`/getchatbook | /setvar key=${findFileVar}`);
      findExpr = `/findentry file={{getvar::${findFileVar}}} field=comment ${quoteSlashValue(comment)}`;
    } else {
      findExpr = `/findentry file=${quoteSlashValue(file)} field=comment ${quoteSlashValue(comment)}`;
    }

    const findResult = await execSlash(findExpr);
    const findText = slashOutputToText(findResult);

    console.log(`[StoryGuide] DEBUG Delete Search: EntryName="${entryName}", CacheKey="${cacheKey}", Comment="${comment}", Result="${findText}"`);

    // 清理临时变量
    if (target === 'chatbook') {
      await execSlash(`/flushvar ${findFileVar}`);
    }

    // 解析 UID
    let uid = null;
    if (findText && findText !== 'null' && findText !== 'undefined') {
      const parsed = safeJsonParse(findText);
      if (parsed && parsed.uid) {
        uid = parsed.uid;
      } else if (/^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+$/.test(findText.trim())) {
        uid = findText.trim();
      }
    }

    console.log(`[StoryGuide] DEBUG Delete Target: UID="${uid}"`);

    if (!uid) {
      console.log(`[StoryGuide] Delete ${entryType} (${targetType}): ${entryName} not found in world book`);
      // 仍然从缓存中删除
      // 仍然标记为已停用
      if (entriesCache[cacheKey]) entriesCache[cacheKey].disabled = true;
      return {
        deleted: true,
        name: entryName,
        entryType,
        targetType,
        source: 'cache_only',
        comment,
        key,
        content: cacheEntry?.content,
        cacheKey,
        cacheEntry,
      };
    }

    // SillyTavern 没有 /delentry 命令，改为禁用条目并标记为已删除
    // 1. 设置 disable=1（禁用条目）
    // 2. 清空内容或标记为已删�?

    // 构建文件表达式（chatbook 需要特殊处理）
    let fileExpr;
    const fileVar = 'sgTmpDeleteFile';
    if (target === 'chatbook') {
      // 使用 setvar/getvar 管道获取 chatbook 文件�?
      await execSlash(`/getchatbook | /setvar key=${fileVar}`);
      fileExpr = `{{getvar::${fileVar}}}`;
    } else {
      fileExpr = quoteSlashValue(file);
    }

    const disableExpr = `/setentryfield file=${fileExpr} uid=${uid} field=disable 1`;
    await execSlash(disableExpr);

    // 修改 comment 为已删除标记
    // 清空触发词（避免被触发）
    const keyExpr = `/setentryfield file=${fileExpr} uid=${uid} field=key ""`;
    await execSlash(keyExpr);

    // 清理临时变量
    if (target === 'chatbook') {
      await execSlash(`/flushvar ${fileVar}`);
    }

    // 标记为已停用
    if (entriesCache[cacheKey]) entriesCache[cacheKey].disabled = true;

    console.log(`[StoryGuide] Disabled ${entryType} (${targetType}): ${entryName} (UID: ${uid})`);
    return {
      deleted: true,
      name: entryName,
      entryType,
      uid,
      targetType,
      comment,
      key,
      content: cacheEntry?.content,
      cacheKey,
      cacheEntry,
    };
  } catch (e) {
    console.warn(`[StoryGuide] Delete ${entryType} (${targetType}) failed:`, e);
    // 仍然标记为已停用
    if (entriesCache[cacheKey]) entriesCache[cacheKey].disabled = true;
    return null;
  }
}

// 删除角色条目
async function deleteCharacterEntry(charName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('character', charName, meta, settings, {
      entriesCache: meta.characterEntries,
      prefix: settings.characterEntryPrefix || '人物',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('character', charName, meta, settings, {
      entriesCache: meta.characterEntries,
      prefix: settings.characterEntryPrefix || '人物',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除装备条目
async function deleteEquipmentEntry(equipName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('equipment', equipName, meta, settings, {
      entriesCache: meta.equipmentEntries,
      prefix: settings.equipmentEntryPrefix || '装备',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('equipment', equipName, meta, settings, {
      entriesCache: meta.equipmentEntries,
      prefix: settings.equipmentEntryPrefix || '装备',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除势力条目
async function deleteFactionEntry(factionName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('faction', factionName, meta, settings, {
      entriesCache: meta.factionEntries,
      prefix: settings.factionEntryPrefix || '势力',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('faction', factionName, meta, settings, {
      entriesCache: meta.factionEntries,
      prefix: settings.factionEntryPrefix || '势力',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除物品栏条�?
async function deleteInventoryEntry(itemName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('inventory', itemName, meta, settings, {
      entriesCache: meta.inventoryEntries,
      prefix: settings.inventoryEntryPrefix || '物品�?,
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('inventory', itemName, meta, settings, {
      entriesCache: meta.inventoryEntries,
      prefix: settings.inventoryEntryPrefix || '物品�?,
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除成就条目
async function deleteAchievementEntry(achievementName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('achievement', achievementName, meta, settings, {
      entriesCache: meta.achievementEntries,
      prefix: settings.achievementEntryPrefix || '成就',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('achievement', achievementName, meta, settings, {
      entriesCache: meta.achievementEntries,
      prefix: settings.achievementEntryPrefix || '成就',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除副职业条�?
async function deleteSubProfessionEntry(subProfessionName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('subProfession', subProfessionName, meta, settings, {
      entriesCache: meta.subProfessionEntries,
      prefix: settings.subProfessionEntryPrefix || '副职�?,
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('subProfession', subProfessionName, meta, settings, {
      entriesCache: meta.subProfessionEntries,
      prefix: settings.subProfessionEntryPrefix || '副职�?,
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除任务条目
async function deleteQuestEntry(questName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('quest', questName, meta, settings, {
      entriesCache: meta.questEntries,
      prefix: settings.questEntryPrefix || '任务',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('quest', questName, meta, settings, {
      entriesCache: meta.questEntries,
      prefix: settings.questEntryPrefix || '任务',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 删除猎艳录条�?
async function deleteConquestEntry(conquestName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('conquest', conquestName, meta, settings, {
      entriesCache: meta.conquestEntries,
      prefix: settings.conquestEntryPrefix || '猎艳�?,
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('conquest', conquestName, meta, settings, {
      entriesCache: meta.conquestEntries,
      prefix: settings.conquestEntryPrefix || '猎艳�?,
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

let cachedSlashExecutor = null;

async function getSlashExecutor() {
  if (cachedSlashExecutor) return cachedSlashExecutor;

  const ctx = SillyTavern.getContext?.();
  // SillyTavern has renamed / refactored slash command executors multiple times.
  // We support a broad set of known entry points (newest first), and then best-effort
  // call them with compatible signatures.
  const candidates = [
    // Newer ST versions expose this via getContext()
    ctx?.executeSlashCommandsWithOptions,
    ctx?.executeSlashCommands,
    ctx?.processChatSlashCommands,
    ctx?.executeSlashCommandsOnChatInput,

    // Some builds expose the parser/executor objects
    ctx?.SlashCommandParser?.executeSlashCommandsWithOptions,
    ctx?.SlashCommandParser?.execute,
    globalThis.SlashCommandParser?.executeSlashCommandsWithOptions,
    globalThis.SlashCommandParser?.execute,

    // Global fallbacks
    globalThis.executeSlashCommandsWithOptions,
    globalThis.executeSlashCommands,
    globalThis.processChatSlashCommands,
    globalThis.executeSlashCommandsOnChatInput,
  ].filter(fn => typeof fn === 'function');

  if (candidates.length) {
    cachedSlashExecutor = async (cmd) => {
      // best-effort signature compatibility
      for (const fn of candidates) {
        // common signatures:
        // - fn(text)
        // - fn(text, boolean)
        // - fn(text, { quiet, silent, execute, ... })
        // - fn({ input: text, ... })
        try { return await fn(cmd); } catch { /* try next */ }
        try { return await fn(cmd, true); } catch { /* try next */ }
        try { return await fn(cmd, { quiet: true, silent: true }); } catch { /* try next */ }
        try { return await fn(cmd, { shouldDisplayMessage: false, quiet: true, silent: true }); } catch { /* try next */ }
        try { return await fn({ input: cmd, quiet: true, silent: true }); } catch { /* try next */ }
        try { return await fn({ command: cmd, quiet: true, silent: true }); } catch { /* try next */ }
      }
      throw new Error('Slash command executor found but failed to run.');
    };
    return cachedSlashExecutor;
  }

  try {
    const mod = await import(/* webpackIgnore: true */ '/script.js');
    const modFns = [
      mod?.executeSlashCommandsWithOptions,
      mod?.executeSlashCommands,
      mod?.processChatSlashCommands,
      mod?.executeSlashCommandsOnChatInput,
    ].filter(fn => typeof fn === 'function');
    if (modFns.length) {
      cachedSlashExecutor = async (cmd) => {
        for (const fn of modFns) {
          try { return await fn(cmd); } catch { /* try next */ }
          try { return await fn(cmd, true); } catch { /* try next */ }
          try { return await fn(cmd, { quiet: true, silent: true }); } catch { /* try next */ }
        }
        throw new Error('Slash command executor from /script.js failed to run.');
      };
      return cachedSlashExecutor;
    }
  } catch {
    // ignore
  }

  cachedSlashExecutor = null;
  throw new Error('未找到可用的 STscript/SlashCommand 执行函数（无法自动写入世界书）�?);
}

async function execSlash(cmd) {
  const exec = await getSlashExecutor();
  return await exec(String(cmd || '').trim());
}

function safeStringifyShort(v, maxLen = 260) {
  try {
    const s = (typeof v === 'string') ? v : JSON.stringify(v);
    if (!s) return '';
    return s.length > maxLen ? (s.slice(0, maxLen) + '...') : s;
  } catch {
    try {
      const s = String(v);
      if (!s) return '';
      return s.length > maxLen ? (s.slice(0, maxLen) + '...') : s;
    } catch {
      return '';
    }
  }
}

/**
 * 兼容不同版本 SlashCommand 执行器的返回值形态：
 * - string
 * - number/boolean
 * - array
 * - object（常见字段：text/output/message/result/value/data/html...�?
 */
function slashOutputToText(out, seen = new Set()) {
  if (out == null) return '';
  const t = typeof out;
  if (t === 'string') return out;
  if (t === 'number' || t === 'boolean') return String(out);

  if (Array.isArray(out)) {
    return out.map(x => slashOutputToText(x, seen)).filter(Boolean).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
  }

  if (t === 'object') {
    if (seen.has(out)) return '';
    seen.add(out);

    // common fields in different ST builds
    const common = ['text', 'output', 'message', 'content', 'result', 'value', 'data', 'html', 'return', 'payload', 'response'];
    for (const k of common) {
      if (Object.hasOwn(out, k)) {
        const s = slashOutputToText(out[k], seen);
        if (s) return s;
      }
    }

    // any non-empty string field
    for (const v of Object.values(out)) {
      if (typeof v === 'string' && v.trim()) return v;
    }

    return '';
  }

  try { return String(out); } catch { return ''; }
}

/**
 * �?SlashCommand 输出中提取世界书条目 UID
 * - 支持 text / object / array 多种形�?
 * - 支持 uid=123、UID:123、以及返回对象里直接包含 uid 字段
 */
function extractUid(out, seen = new Set()) {
  if (out == null) return null;

  const t = typeof out;

  if (t === 'number') {
    const n = Math.trunc(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (t === 'string') {
    const s = out;
    const m1 = s.match(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;buid        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[:=]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d{1,12})        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i);
    if (m1) return Number.parseInt(m1[1], 10);
    const m2 = s.match(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d{1,12})        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/);
    if (m2) return Number.parseInt(m2[1], 10);
    return null;
  }

  if (Array.isArray(out)) {
    for (const it of out) {
      const r = extractUid(it, seen);
      if (r) return r;
    }
    return null;
  }

  if (t === 'object') {
    if (seen.has(out)) return null;
    seen.add(out);

    // direct uid/id fields
    const directKeys = ['uid', 'id', 'entryId', 'entry_id', 'worldInfoUid', 'worldinfoUid'];
    for (const k of directKeys) {
      if (Object.hasOwn(out, k)) {
        const n = Number(out[k]);
        if (Number.isFinite(n) && n > 0) return Math.trunc(n);
      }
    }

    // nested containers
    const nestedKeys = ['result', 'data', 'value', 'output', 'return', 'payload', 'response', 'entry'];
    for (const k of nestedKeys) {
      if (Object.hasOwn(out, k)) {
        const r = extractUid(out[k], seen);
        if (r) return r;
      }
    }

    // scan all values (shallow + recursion)
    for (const v of Object.values(out)) {
      const r = extractUid(v, seen);
      if (r) return r;
    }

    // fallback: parse from textified output
    const s = slashOutputToText(out, seen);
    if (s) return extractUid(s, seen);

    return null;
  }

  // fallback
  return extractUid(String(out), seen);
}

function quoteSlashValue(v) {
  const s = String(v ?? '').replace(/"/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;"');
  return `"${s}"`;
}

async function writeSummaryToWorldInfoEntry(rec, meta, {
  target = 'file',
  file = '',
  commentPrefix = '剧情总结',
  constant = 0,
} = {}) {
  const kws = sanitizeKeywords(rec.keywords);
  const s = ensureSettings();
  const comment = buildSummaryComment(rec, s, commentPrefix || rec?.commentPrefix || '剧情总结');

  // normalize content and make it safe for slash parser (avoid accidental pipe split)
  const content = String(rec.summary || '')
    .replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*/g, ' ')
    .replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, ' ')
    .trim()
    .replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;|/g, '�?);

  const t = String(target || 'file');
  const f = normalizeWorldInfoFileName(file || '');
  if (t === 'file' && !f) throw new Error('WorldInfo 目标�?file 时必须填写世界书文件名�?);

  // We purposely avoid parsing UID in JS, because some ST builds return only a status object
  // (e.g. {pipe:"0", ...}) even when the command pipes the UID internally.
  // Instead, we build a single STscript pipeline that:
  // 1) resolves chatbook file name (if needed)
  // 2) creates the entry (UID goes into pipe)
  // 3) stores UID into a local var
  // 4) sets fields using the stored UID
  const uidVar = '__sg_summary_uid';
  const fileVar = '__sg_summary_wbfile';

  const keyMode = String(s.summaryWorldInfoKeyMode || 'keywords');
  const keyValue = (keyMode === 'indexId')
    ? comment
    : (kws.length ? kws.join(',') : (commentPrefix || '剧情总结'));
  const constantVal = (Number(constant) === 1) ? 1 : 0;

  const fileExpr = (t === 'chatbook') ? `{{getvar::${fileVar}}}` : f;

  const parts = [];
  if (t === 'chatbook') {
    parts.push('/getchatbook');
    parts.push(`/setvar key=${fileVar}`);
  }

  // create entry + capture uid
  parts.push(`/createentry file=${quoteSlashValue(fileExpr)} key=${quoteSlashValue(keyValue)} ${quoteSlashValue(content)}`);
  parts.push(`/setvar key=${uidVar}`);

  // update fields
  parts.push(`/setentryfield file=${quoteSlashValue(fileExpr)} uid={{getvar::${uidVar}}} field=content ${quoteSlashValue(content)}`);
  parts.push(`/setentryfield file=${quoteSlashValue(fileExpr)} uid={{getvar::${uidVar}}} field=key ${quoteSlashValue(keyValue)}`);
  parts.push(`/setentryfield file=${quoteSlashValue(fileExpr)} uid={{getvar::${uidVar}}} field=comment ${quoteSlashValue(comment)}`);
  parts.push(`/setentryfield file=${quoteSlashValue(fileExpr)} uid={{getvar::${uidVar}}} field=disable 0`);
  parts.push(`/setentryfield file=${quoteSlashValue(fileExpr)} uid={{getvar::${uidVar}}} field=constant ${constantVal}`);

  // cleanup temp vars
  parts.push(`/flushvar ${uidVar}`);
  if (t === 'chatbook') parts.push(`/flushvar ${fileVar}`);

  const script = parts.join(' | ');
  const out = await execSlash(script);
  if (out && typeof out === 'object' && (out.isError || out.isAborted || out.isQuietlyAborted)) {
    throw new Error(`写入世界书失败（返回�?{safeStringifyShort(out)}）`);
  }

  // store link (UID is intentionally omitted because it may be inaccessible from JS in some ST builds)
  const keyName = (constantVal === 1) ? 'worldInfoBlue' : 'worldInfoGreen';
  rec[keyName] = { file: (t === 'file') ? f : 'chatbook', uid: null };
  if (meta && Array.isArray(meta.history) && meta.history.length) {
    meta.history[meta.history.length - 1] = rec;
    await setSummaryMeta(meta);
  }

  return { file: (t === 'file') ? f : 'chatbook', uid: null };
}

function removeSummaryFromBlueIndexCache(rec) {
  const s = ensureSettings();
  const arr = Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : [];
  if (!arr.length) return 0;
  const title = String(rec?.title || '').trim();
  const summary = String(rec?.summary || '').trim();
  let removed = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    const it = arr[i] || {};
    if (String(it.summary || '').trim() !== summary) continue;
    if (title && String(it.title || '').trim() !== title) continue;
    arr.splice(i, 1);
    removed = 1;
    break;
  }
  if (removed) {
    s.summaryBlueIndex = arr;
    saveSettings();
    updateBlueIndexInfoLabel();
  }
  return removed;
}

function buildSummaryDeleteComments(rec, settings, prefix) {
  const s = settings || ensureSettings();
  const out = [];
  const base = buildSummaryComment(rec, s, prefix);
  if (base) out.push(base);
  const noIndex = buildSummaryComment(rec, { ...s, summaryWorldInfoKeyMode: 'keywords', summaryIndexInComment: false }, prefix);
  if (noIndex) out.push(noIndex);
  if (rec?.indexId) {
    const withIndex = buildSummaryComment(rec, { ...s, summaryWorldInfoKeyMode: 'indexId', summaryIndexInComment: true }, prefix);
    if (withIndex) out.push(withIndex);
  }
  return Array.from(new Set(out)).filter(Boolean);
}

async function rollbackStructuredChangesForRecord(rec, meta, settings, {
  clearChanges = false,
} = {}) {
  const s = settings || ensureSettings();
  const structuredChanges = Array.isArray(rec?.structuredChanges) ? rec.structuredChanges : [];
  if (!structuredChanges.length) return { total: 0, rolled: 0, errors: [] };

  const errors = [];
  let rolled = 0;
  const greenTarget = resolveGreenWorldInfoTarget(s);

  const updateStructuredCache = (change) => {
    if (!change?.cacheKey) return;
    const entriesCache = getStructuredEntriesCache(meta, change.entryType);
    if (!entriesCache) return;
    if (change.action === 'create') {
      delete entriesCache[change.cacheKey];
    } else if (change.action === 'update') {
      if (change.prevCacheEntry) entriesCache[change.cacheKey] = change.prevCacheEntry;
    } else if (change.action === 'delete') {
      if (change.cacheEntry) entriesCache[change.cacheKey] = change.cacheEntry;
    }
  };

  for (const change of [...structuredChanges].reverse()) {
    if (!change || !change.action) continue;
    const targetInfo = (change.targetType === 'blue')
      ? { target: 'file', file: String(s.summaryBlueWorldInfoFile || '').trim() }
      : greenTarget;
    if (!targetInfo?.file) {
      errors.push(`结构化：${change.entryType || '条目'}�?{change.targetType || 'green'}）世界书文件名为空`);
      continue;
    }

    const comment = String(change.comment || '').trim();
    const key = (change.key !== undefined) ? String(change.key) : '';
    const content = (change.content !== undefined) ? String(change.content) : '';
    const prevContent = (change.prevContent !== undefined) ? String(change.prevContent) : '';
    let ok = false;

    if (change.action === 'create') {
      console.log(`[StoryGuide] Rolling back "create" for ${change.entryType}: ${change.name} (disabling entry)`);
      const r = await deleteWorldInfoEntryByComment(comment, s, {
        target: targetInfo.target,
        file: targetInfo.file,
      });
      ok = !!r;
      if (!ok) console.warn(`[StoryGuide] Failed to disable entry for "create" rollback: ${comment}`);
    } else if (change.action === 'update') {
      console.log(`[StoryGuide] Rolling back "update" for ${change.entryType}: ${change.name} (restoring previous content)`);
      const r = await updateWorldInfoEntryByComment(comment, s, {
        target: targetInfo.target,
        file: targetInfo.file,
        content: prevContent,
      });
      ok = !!r;
      if (!ok) {
        // 尝试使用 [已删除] 前缀兜底（以防回滚前条目正好被手动禁用了�?
        const fallbackComment = `[已删除] ${comment}`;
        const r2 = await updateWorldInfoEntryByComment(fallbackComment, s, {
          target: targetInfo.target,
          file: targetInfo.file,
          content: prevContent,
        });
        ok = !!r2;
      }
      if (!ok) console.warn(`[StoryGuide] Failed to restore content for "update" rollback: ${comment}`);
    } else if (change.action === 'delete') {
      console.log(`[StoryGuide] Rolling back "delete" for ${change.entryType}: ${change.name} (restoring/enabling entry)`);
      const commentVariants = [
        comment,
        comment ? `[已删除] ${comment}` : '',
        comment ? `[已汇总] ${comment}` : '',
        comment ? `[已删除] [已汇总] ${comment}` : '',
      ].filter(Boolean);
      let restored = null;
      for (const c of commentVariants) {
        restored = await updateWorldInfoEntryByComment(c, s, {
          target: targetInfo.target,
          file: targetInfo.file,
          content,
          key,
          newComment: comment,
          disable: 0,
        });
        if (restored) break;
      }
      if (!restored) {
        console.log(`[StoryGuide] Entry not found for "delete" rollback, re-creating: ${comment}`);
        try {
          await createWorldInfoEntryInTarget(targetInfo.target, targetInfo.file, {
            key,
            content,
            comment,
          }, {
            constant: (change.targetType === 'blue') ? 1 : 0,
            disable: 0,
          });
          restored = { created: true };
        } catch (e) {
          errors.push(`结构化：${change.entryType || '条目'}恢复失败�?{e?.message ?? e}）`);
        }
      }
      ok = !!restored;
    }

    if (ok) {
      rolled += 1;
      updateStructuredCache(change);
    } else if (change.action !== 'delete') {
      errors.push(`结构化：${change.entryType || '条目'}回滚失败`);
    }
  }

  if (rolled === structuredChanges.length && clearChanges) {
    rec.structuredChanges = [];
  }

  return { total: structuredChanges.length, rolled, errors };
}

async function rollbackLastSummary(options = {}) {
  const { silent = false } = options;
  const s = ensureSettings();
  if (silent && !s.summaryAutoRollback) return;

  const meta = getSummaryMeta();
  const hist = Array.isArray(meta.history) ? meta.history : [];

  let idx = hist.length - 1;
  while (idx >= 0 && hist[idx] && hist[idx].isMega) idx--;
  if (idx < 0) {
    if (!silent) setStatus('没有可撤销的总结', 'warn');
    return;
  }

  const rec = hist[idx];
  if (!silent) {
    setStatus('正在撤销最近一次总结�?, 'warn');
    showToast('正在撤销最近一次总结�?, { kind: 'warn', spinner: true, sticky: true });
  } else {
    console.log('[StoryGuide] Auto-rolling back last summary due to message deletion');
  }

  const errors = [];
  let greenOk = false;
  let blueOk = false;

  const greenPrefix = String(rec.commentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结').trim() || '剧情总结';
  const greenTarget = resolveGreenWorldInfoTarget(s);
  if (greenTarget.file) {
    try {
      const comments = buildSummaryDeleteComments(rec, s, greenPrefix);
      for (const c of comments) {
        const r = await deleteWorldInfoEntryByComment(c, s, {
          target: greenTarget.target,
          file: greenTarget.file,
        });
        if (r) { greenOk = true; break; }
      }
      if (!greenOk) errors.push('绿灯：未找到条目');
    } catch (e) {
      errors.push(`绿灯�?{e?.message ?? e}`);
    }
  } else {
    errors.push('绿灯：世界书文件名为�?);
  }

  const blueFile = String(s.summaryBlueWorldInfoFile || '').trim();
  if (blueFile) {
    const bluePrefixBase = String(rec.commentPrefixBlue || s.summaryBlueWorldInfoCommentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结').trim() || '剧情总结';
    const bluePrefix = ensureMvuPlotPrefix(bluePrefixBase);
    try {
      const comments = buildSummaryDeleteComments(rec, s, bluePrefix);
      for (const c of comments) {
        const r = await deleteWorldInfoEntryByComment(c, s, {
          target: 'file',
          file: blueFile,
        });
        if (r) { blueOk = true; break; }
      }
      if (!blueOk) errors.push('蓝灯：未找到条目');
    } catch (e) {
      errors.push(`蓝灯�?{e?.message ?? e}`);
    }
  } else {
    errors.push('蓝灯：世界书文件名为�?);
  }

  hist.splice(idx, 1);
  meta.history = hist;

  if (rec?.indexId) {
    const idNum = parseSummaryIndexInput(rec.indexId, s);
    if (idNum && Number(meta.nextIndex) === idNum + 1) {
      meta.nextIndex = idNum;
    }
  }

  const prev = [...hist].reverse().find(h => h && !h.isMega);
  meta.lastFloor = prev?.range?.toFloor ? Number(prev.range.toFloor) : 0;
  if (prev?.range?.toIdx !== undefined && prev?.range?.toIdx !== null) {
    meta.lastChatLen = Number(prev.range.toIdx) + 1;
  } else {
    meta.lastChatLen = 0;
  }
  await setSummaryMeta(meta);

  removeSummaryFromBlueIndexCache(rec);
  renderSummaryPaneFromMeta();
  updateSummaryInfoLabel();

  try { if ($('#sg_toast').hasClass('spinner')) hideToast(); } catch { /* ignore */ }

  if (errors.length) {
    setStatus(`撤销完成�?{errors[0]}）`, 'warn');
  } else {
    setStatus(`已撤销最近一次总结 ✅（绿灯${greenOk ? '已删' : '未删'}｜蓝�?{blueOk ? '已删' : '未删'}）`, 'ok');
  }
}

async function rollbackLastStructuredEntries(options = {}) {
  const { silent = false } = options;
  const s = ensureSettings();
  if (silent && !s.structuredAutoRollback) return;

  const meta = getSummaryMeta();
  const hist = Array.isArray(meta.structuredHistory) ? meta.structuredHistory : [];

  let idx = hist.length - 1;
  while (idx >= 0) {
    const rec = hist[idx];
    if (Array.isArray(rec?.structuredChanges) && rec.structuredChanges.length) break;
    idx--;
  }

  let fromSummary = false;
  let sumIdx = -1;
  let sumRec = null;
  if (idx < 0) {
    const sumHist = Array.isArray(meta.history) ? meta.history : [];
    sumIdx = sumHist.length - 1;
    while (sumIdx >= 0) {
      const rec = sumHist[sumIdx];
      if (Array.isArray(rec?.structuredChanges) && rec.structuredChanges.length) { sumRec = rec; break; }
      sumIdx--;
    }
    if (sumIdx >= 0 && sumRec) {
      fromSummary = true;
    }
  }

  if (idx < 0) {
    if (!fromSummary) {
      if (!silent) setStatus('没有可撤销的结构化条目', 'warn');
      return;
    }
  }

  const rec = fromSummary ? sumRec : hist[idx];
  if (!silent) {
    setStatus('正在撤销最近一次结构化条目�?, 'warn');
    showToast('正在撤销最近一次结构化条目�?, { kind: 'warn', spinner: true, sticky: true });
  } else {
    console.log('[StoryGuide] Auto-rolling back last structured entries due to message deletion');
  }

  const result = await rollbackStructuredChangesForRecord(rec, meta, s, { clearChanges: true });
  if (fromSummary) {
    const sumHist = Array.isArray(meta.history) ? meta.history : [];
    if (sumIdx >= 0 && sumIdx < sumHist.length) sumHist[sumIdx] = rec;
    meta.history = sumHist;
    updateStructuredProgressFromSummaryHistory(meta);
  } else {
    if (result.total && result.rolled === result.total) {
      hist.splice(idx, 1);
    } else {
      hist[idx] = rec;
    }
    meta.structuredHistory = hist;
    updateStructuredProgressFromHistory(meta);
  }
  await setSummaryMeta(meta);

  renderSummaryPaneFromMeta();
  updateSummaryInfoLabel();

  try { if ($('#sg_toast').hasClass('spinner')) hideToast(); } catch { /* ignore */ }

  if (!result.total) {
    if (!silent) setStatus('没有可撤销的结构化条目', 'warn');
    return;
  }
  if (result.errors.length) {
    if (!silent) setStatus(`结构化撤销完成�?{result.errors[0]}）`, 'warn');
  } else {
    if (!silent) setStatus(`已撤销最近一次结构化条目 ✅（${result.rolled}/${result.total}）`, 'ok');
    else setStatus(`已自动撤回结构化条目 ✅`, 'ok');
  }
}

/**
 * Handle automatic rollback when a message is deleted.
 * @param {any} data The event data from MESSAGE_DELETED
 */
async function handleAutoRollbackOnDeletion(data) {
  const s = ensureSettings();
  if (!s.summaryAutoRollback && !s.structuredAutoRollback) return;

  const meta = getSummaryMeta();
  const lastSummary = (Array.isArray(meta.history) && meta.history.length) ? meta.history[meta.history.length - 1] : null;
  const lastStructured = (Array.isArray(meta.structuredHistory) && meta.structuredHistory.length) ? meta.structuredHistory[meta.structuredHistory.length - 1] : null;

  if (!lastSummary && !lastStructured) return;

  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];

  // SillyTavern passes the deleted message index in some versions, or it's handled by CHAT_CHANGED.
  // We check if the last summarized floor is now missing or if the chat shortened.
  const mode = String(s.summaryCountMode || 'assistant');
  const floorNow = computeFloorCount(chat, mode, true, true);

  let triggerSummary = false;
  if (s.summaryAutoRollback && lastSummary?.range?.toFloor > floorNow) {
    triggerSummary = true;
  }

  let triggerStructured = false;
  if (s.structuredAutoRollback) {
    // Check both dedicated structured history and summary-based structured history
    if (lastStructured?.range?.toFloor > floorNow) {
      triggerStructured = true;
    } else if (lastSummary?.range?.toFloor > floorNow && lastSummary.structuredChanges) {
      triggerStructured = true;
    }
  }

  if (triggerSummary) {
    await rollbackLastSummary({ silent: true });
  }
  if (triggerStructured) {
    await rollbackLastStructuredEntries({ silent: true });
  }
}

function stopSummary() {
  if (isSummarizing) {
    summaryCancelled = true;
    if (summaryAbortController) {
      try { summaryAbortController.abort(); } catch { /* ignore */ }
    }
    try {
      const ctx = SillyTavern.getContext?.();
      if (typeof ctx?.abortGeneration === 'function') ctx.abortGeneration();
      else if (typeof ctx?.stopGeneration === 'function') ctx.stopGeneration();
      else if (typeof globalThis.abortGeneration === 'function') globalThis.abortGeneration();
      else if (typeof globalThis.stopGeneration === 'function') globalThis.stopGeneration();
    } catch { /* ignore */ }
    console.log('[StoryGuide] Summary stop requested');
  }
  if (isStructuring) {
    structuredCancelled = true;
    if (structuredAbortController) {
      try { structuredAbortController.abort(); } catch { /* ignore */ }
    }
    console.log('[StoryGuide] Structured stop requested');
  }
}

function isAbortError(err) {
  const name = err?.name || err?.code || '';
  const msg = String(err?.message || '');
  return name === 'AbortError' || name === 'ERR_ABORTED' || /aborted|abort/i.test(msg);
}

async function runSummary({ reason = 'manual', manualFromFloor = null, manualToFloor = null, manualSplit = null } = {}) {
  const s = ensureSettings();
  const ctx = SillyTavern.getContext();

  if (reason === 'auto' && !s.enabled) return;

  if (isSummarizing) return;
  isSummarizing = true;
  summaryCancelled = false;
  setStatus('总结中�?, 'warn');
  showToast('正在总结�?, { kind: 'warn', spinner: true, sticky: true });

  try {
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const mode = String(s.summaryCountMode || 'assistant');
    const floorNow = computeFloorCount(chat, mode, true, true);

    let meta = getSummaryMeta();
    if (!meta || typeof meta !== 'object') meta = getDefaultSummaryMeta();
    // choose range(s)
    const every = clampInt(s.summaryEvery, 1, 200, 20);
    const segments = [];

    if (reason === 'manual_range') {
      const resolved0 = resolveChatRangeByFloors(chat, mode, manualFromFloor, manualToFloor, true, true);
      if (!resolved0) {
        setStatus('手动楼层范围无效（请检查起止层号）', 'warn');
        showToast('手动楼层范围无效（请检查起止层号）', { kind: 'warn', spinner: false, sticky: false, duration: 2200 });
        return;
      }

      const splitEnabled = (manualSplit === null || manualSplit === undefined)
        ? !!s.summaryManualSplit
        : !!manualSplit;

      if (splitEnabled && every > 0) {
        const a0 = resolved0.fromFloor;
        const b0 = resolved0.toFloor;
        for (let f = a0; f <= b0; f += every) {
          const g = Math.min(b0, f + every - 1);
          const r = resolveChatRangeByFloors(chat, mode, f, g, true, true);
          if (r) segments.push(r);
        }
        if (!segments.length) segments.push(resolved0);
      } else {
        segments.push(resolved0);
      }
    } else if (reason === 'auto' && meta.lastChatLen > 0 && meta.lastChatLen < chat.length) {
      const startIdx = meta.lastChatLen;
      const fromFloor = Math.max(1, Number(meta.lastFloor || 0) + 1);
      const toFloor = floorNow;
      const endIdx = Math.max(0, chat.length - 1);
      segments.push({ startIdx, endIdx, fromFloor, toFloor, floorNow });
    } else {
      const startIdx = findStartIndexForLastNFloors(chat, mode, every, true, true);
      const fromFloor = Math.max(1, floorNow - every + 1);
      const toFloor = floorNow;
      const endIdx = Math.max(0, chat.length - 1);
      segments.push({ startIdx, endIdx, fromFloor, toFloor, floorNow });
    }

    const totalSeg = segments.length;
    if (!totalSeg) {
      setStatus('没有可总结的内容（范围为空�?, 'warn');
      showToast('没有可总结的内容（范围为空�?, { kind: 'warn', spinner: false, sticky: false, duration: 2200 });
      return;
    }

    const affectsProgress = (reason !== 'manual_range');
    const keyMode = String(s.summaryWorldInfoKeyMode || 'keywords');

    let created = 0;
    let wroteGreenOk = 0;
    let wroteBlueOk = 0;
    const writeErrs = [];
    const runErrs = [];
    let cancelledEarly = false;

    // 读取 stat_data（如果启用）
    let summaryStatData = null;
    if (s.summaryReadStatData) {
      try {
        const statSettings = {
          ...s,
          wiRollStatVarName: s.summaryStatVarName || 'stat_data'
        };
        const { statData } = await resolveStatDataComprehensive(chat, statSettings);
        if (statData) {
          summaryStatData = statData;
          console.log('[StoryGuide] Summary loaded stat_data:', summaryStatData);
        } else {
          const rawText = await resolveStatDataRawText(chat, statSettings);
          if (rawText) {
            summaryStatData = rawText;
            console.log('[StoryGuide] Summary loaded raw stat_data text');
          }
        }
      } catch (e) {
        console.warn('[StoryGuide] Failed to load stat_data for summary:', e);
      }
    }

    for (let i = 0; i < segments.length; i++) {
      // 检查是否被取消
      if (summaryCancelled) {
        setStatus('总结已取�?, 'warn');
        showToast('总结已取�?, { kind: 'warn', spinner: false, sticky: false, duration: 2000 });
        cancelledEarly = true;
        break;
      }

      const seg = segments[i];
      const startIdx = seg.startIdx;
      const endIdx = seg.endIdx;
      const fromFloor = seg.fromFloor;
      const toFloor = seg.toFloor;

      if (totalSeg > 1) setStatus(`手动分段总结中…（${i + 1}/${totalSeg}�?{fromFloor}-${toFloor}）`, 'warn');
      else setStatus('总结中�?, 'warn');

      const chunkText = buildSummaryChunkTextRange(chat, startIdx, endIdx, s.summaryMaxCharsPerMessage, s.summaryMaxTotalChars, true, true);
      if (!chunkText) {
        runErrs.push(`${fromFloor}-${toFloor}：片段为空`);
        continue;
      }

      const messages = buildSummaryPromptMessages(chunkText, fromFloor, toFloor, summaryStatData);
      const schema = getSummarySchema();

      let jsonText = '';
      summaryAbortController = new AbortController();
      const summarySignal = summaryAbortController.signal;
      try {
        if (String(s.summaryProvider || 'st') === 'custom') {
          jsonText = await callViaCustom(s.summaryCustomEndpoint, s.summaryCustomApiKey, s.summaryCustomModel, messages, s.summaryTemperature, s.summaryCustomMaxTokens, 0.95, s.summaryCustomStream, summarySignal);
          const parsedTry = safeJsonParse(jsonText);
          if (!parsedTry || !parsedTry.summary) {
            try { jsonText = await fallbackAskJsonCustom(s.summaryCustomEndpoint, s.summaryCustomApiKey, s.summaryCustomModel, messages, s.summaryTemperature, s.summaryCustomMaxTokens, 0.95, s.summaryCustomStream, summarySignal); }
            catch { /* ignore */ }
          }
        } else {
          jsonText = await callViaSillyTavern(messages, schema, s.summaryTemperature, summarySignal);
          if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
          const parsedTry = safeJsonParse(jsonText);
          if (!parsedTry || !parsedTry.summary) jsonText = await fallbackAskJson(messages, s.summaryTemperature);
        }
      } catch (e) {
        if (summaryCancelled || isAbortError(e)) {
          setStatus('总结已取�?, 'warn');
          showToast('总结已取�?, { kind: 'warn', spinner: false, sticky: false, duration: 2000 });
          cancelledEarly = true;
          break;
        }
        throw e;
      } finally {
        summaryAbortController = null;
      }

      if (summaryCancelled) {
        setStatus('总结已取�?, 'warn');
        showToast('总结已取�?, { kind: 'warn', spinner: false, sticky: false, duration: 2000 });
        cancelledEarly = true;
        break;
      }

      const parsed = safeJsonParse(jsonText);
      if (!parsed || !parsed.summary) {
        runErrs.push(`${fromFloor}-${toFloor}：总结输出无法解析�?JSON`);
        continue;
      }

      const prefix = String(s.summaryWorldInfoCommentPrefix || '剧情总结').trim() || '剧情总结';
      const rawTitle = String(parsed.title || '').trim();
      const summary = String(parsed.summary || '').trim();
      const modelKeywords = sanitizeKeywords(parsed.keywords);
      let indexId = '';
      let keywords = modelKeywords;

      if (keyMode === 'indexId' || s.summaryIndexInComment) {
        // init nextIndex
        if (!Number.isFinite(Number(meta.nextIndex))) {
          let maxN = 0;
          const pref = String(s.summaryIndexPrefix || 'A-');
          const re = new RegExp('^' + escapeRegExp(pref) + '(        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+)$');
          for (const h of (Array.isArray(meta.history) ? meta.history : [])) {
            const id0 = String(h?.indexId || '').trim();
            const m = id0.match(re);
            if (m) maxN = Math.max(maxN, Number.parseInt(m[1], 10) || 0);
          }
          meta.nextIndex = Math.max(clampInt(s.summaryIndexStart, 1, 1000000, 1), maxN + 1);
        }

        const pref = String(s.summaryIndexPrefix || 'A-');
        const pad = clampInt(s.summaryIndexPad, 1, 12, 3);
        const n = clampInt(meta.nextIndex, 1, 100000000, 1);
        indexId = `${pref}${String(n).padStart(pad, '0')}`;

        if (keyMode === 'indexId') {
          // Keywords match Title (Structured style: Prefix｜Name｜Index)
          keywords = [buildSummaryCoreTitle(rawTitle, indexId, s, prefix, true)];
        }
      }

      const title = rawTitle || `${prefix}`;

      const rec = {
        title,
        summary,
        keywords,
        indexId: indexId || undefined,
        modelKeywords: (keyMode === 'indexId') ? modelKeywords : undefined,
        createdAt: Date.now(),
        range: { fromFloor, toFloor, fromIdx: startIdx, toIdx: endIdx },
        commentPrefix: prefix,
        commentPrefixBlue: String(s.summaryBlueWorldInfoCommentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结'),
      };

      if (keyMode === 'indexId' || s.summaryIndexInComment) {
        meta.nextIndex = clampInt(Number(meta.nextIndex) + 1, 1, 1000000000, Number(meta.nextIndex) + 1);
      }

      meta.history = Array.isArray(meta.history) ? meta.history : [];
      meta.history.push(rec);
      if (meta.history.length > 120) meta.history = meta.history.slice(-120);
      if (affectsProgress) {
        meta.lastFloor = toFloor;
        meta.lastChatLen = chat.length;
      }
      await setSummaryMeta(meta);
      created += 1;

      // 同步进蓝灯索引缓存（用于本地匹配/预筛选）
      try { appendToBlueIndexCache(rec); } catch { /* ignore */ }

      // 生成结构化世界书条目（人�?装备/物品�?势力/成就/副职�?任务 - 与剧情总结同一事务�?
      if (s.structuredEntriesEnabled && (s.summaryToWorldInfo || s.summaryToBlueWorldInfo)) {
        const structuredChanges = [];
        try {
          const structuredOk = await processStructuredEntriesChunk(chunkText, fromFloor, toFloor, meta, s, summaryStatData, structuredChanges);
          if (structuredOk) {
            if (structuredChanges.length) {
              rec.structuredChanges = structuredChanges;
              appendStructuredHistory(meta, {
                createdAt: rec.createdAt || Date.now(),
                range: rec.range,
                structuredChanges,
                affectsProgress,
              });
              if (Array.isArray(meta.history) && meta.history.length) {
                meta.history[meta.history.length - 1] = rec;
              }
            }
            if (affectsProgress) {
              meta.lastStructuredFloor = toFloor;
              meta.lastStructuredChatLen = chat.length;
            }
            if (structuredChanges.length || affectsProgress) {
              await setSummaryMeta(meta);
            }
          }
        } catch (e) {
          console.warn('[StoryGuide] Structured entries generation failed:', e);
          // 结构化条目生成失败不阻断主流�?
        }
      }

      // world info write
      if (s.summaryToWorldInfo || s.summaryToBlueWorldInfo) {
        if (s.summaryToWorldInfo) {
          try {
            const greenTarget = resolveGreenWorldInfoTarget(s);
            if (!greenTarget.file) {
              console.warn('[StoryGuide] Green world info file missing, skip summary write');
            } else {
              await writeSummaryToWorldInfoEntry(rec, meta, {
                target: greenTarget.target,
                file: greenTarget.file,
                commentPrefix: String(s.summaryWorldInfoCommentPrefix || '剧情总结'),
                constant: 0,
              });
              wroteGreenOk += 1;
            }
          } catch (e) {
            console.warn('[StoryGuide] write green world info failed:', e);
            writeErrs.push(`${fromFloor}-${toFloor} 绿灯�?{e?.message ?? e}`);
          }
        }

        if (s.summaryToBlueWorldInfo) {
          try {
            await writeSummaryToWorldInfoEntry(rec, meta, {
              target: 'file',
              file: String(s.summaryBlueWorldInfoFile || ''),
              commentPrefix: ensureMvuPlotPrefix(String(s.summaryBlueWorldInfoCommentPrefix || s.summaryWorldInfoCommentPrefix || '剧情总结')),
              constant: 1,
            });
            wroteBlueOk += 1;
          } catch (e) {
            console.warn('[StoryGuide] write blue world info failed:', e);
            writeErrs.push(`${fromFloor}-${toFloor} 蓝灯�?{e?.message ?? e}`);
          }
        }

        // 生成大总结（到达阈值时自动触发�?
        try {
          const megaCreated = await maybeGenerateMegaSummary(meta, s);
          if (megaCreated > 0) {
            console.log(`[StoryGuide] Mega summary created: ${megaCreated}`);
          }
        } catch (e) {
          console.warn('[StoryGuide] Mega summary generation failed:', e);
        }
      }
    }

    updateSummaryInfoLabel();
    renderSummaryPaneFromMeta();

    // 若启用实时读取索引：在手动分段写入蓝灯后，尽快刷新一次缓�?
    if (s.summaryToBlueWorldInfo && String(ensureSettings().wiBlueIndexMode || 'live') === 'live') {
      ensureBlueIndexLive(true).catch(() => void 0);
    }

    if (created <= 0) {
      setStatus(`总结未生成（${runErrs.length ? runErrs[0] : '未知原因'}）`, 'warn');
      showToast(`总结未生成（${runErrs.length ? runErrs[0] : '未知原因'}）`, { kind: 'warn', spinner: false, sticky: false, duration: 2600 });
      return;
    }

    // final status
    if (cancelledEarly) return;
    if (totalSeg > 1) {
      const parts = [`生成 ${created} 条`];
      if (s.summaryToWorldInfo || s.summaryToBlueWorldInfo) {
        const wrote = [];
        if (s.summaryToWorldInfo) wrote.push(`绿灯 ${wroteGreenOk}/${created}`);
        if (s.summaryToBlueWorldInfo) wrote.push(`蓝灯 ${wroteBlueOk}/${created}`);
        if (wrote.length) parts.push(`写入�?{wrote.join('�?)}`);
      }
      const errCount = writeErrs.length + runErrs.length;
      if (errCount) {
        const sample = (writeErrs.concat(runErrs)).slice(0, 2).join('�?);
        setStatus(`手动分段总结完成 ✅（${parts.join('�?)}｜失败：${errCount}�?{sample}${errCount > 2 ? '�? : ''}）`, 'warn');
      } else {
        setStatus(`手动分段总结完成 ✅（${parts.join('�?)}）`, 'ok');
      }
    } else {
      // single
      if (s.summaryToWorldInfo || s.summaryToBlueWorldInfo) {
        const ok = [];
        const err = [];
        if (s.summaryToWorldInfo) {
          if (wroteGreenOk >= 1) ok.push('绿灯世界�?);
          else if (writeErrs.find(x => x.includes('绿灯'))) err.push(writeErrs.find(x => x.includes('绿灯')));
        }
        if (s.summaryToBlueWorldInfo) {
          if (wroteBlueOk >= 1) ok.push('蓝灯世界�?);
          else if (writeErrs.find(x => x.includes('蓝灯'))) err.push(writeErrs.find(x => x.includes('蓝灯')));
        }
        if (!err.length) setStatus(`总结完成 ✅（已写入：${ok.join(' + ') || '（无�?}）`, 'ok');
        else setStatus(`总结完成 ✅（写入失败�?{err.join('�?)}）`, 'warn');
      } else {
        setStatus('总结完成 �?, 'ok');
      }
    }

    // toast notify (non-blocking)
    try {
      const errCount = (writeErrs?.length || 0) + (runErrs?.length || 0);
      const kind = errCount ? 'warn' : 'ok';
      const text = (totalSeg > 1)
        ? (errCount ? '分段总结完成 ⚠️' : '分段总结完成 �?)
        : (errCount ? '总结完成 ⚠️' : '总结完成 �?);
      showToast(text, { kind, spinner: false, sticky: false, duration: errCount ? 2600 : 1700 });
    } catch { /* ignore toast errors */ }



  } catch (e) {
    console.error('[StoryGuide] Summary failed:', e);
    const msg = (e && (e.message || String(e))) ? (e.message || String(e)) : '未知错误';
    setStatus(`总结失败 ❌（${msg}）`, 'err');
    showToast(`总结失败 ❌（${msg}）`, { kind: 'err', spinner: false, sticky: false, duration: 3200 });
  } finally {

    isSummarizing = false;
    updateButtonsEnabled();
    // avoid stuck "正在总结" toast on unexpected exits
    try { if ($('#sg_toast').hasClass('spinner')) hideToast(); } catch { /* ignore */ }
  }
}

function scheduleAutoSummary(reason = '') {
  const s = ensureSettings();
  if (!s.enabled) return;
  if (!s.summaryEnabled) return;
  const delay = clampInt(s.debounceMs, 300, 10000, DEFAULT_SETTINGS.debounceMs);
  if (summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => {
    summaryTimer = null;
    maybeAutoSummary(reason).catch(() => void 0);
  }, delay);
}

function schedulePostGenerationAuto(reason = '') {
  const s = ensureSettings();
  if (!s.enabled) return;
  if (!s.summaryEnabled && !s.structuredEntriesEnabled) return;
  const delay = clampInt(s.debounceMs, 300, 10000, DEFAULT_SETTINGS.debounceMs);
  if (generationIdleTimer) clearTimeout(generationIdleTimer);
  generationIdleTimer = setTimeout(() => {
    generationIdleTimer = null;
    maybeAutoSummary(reason).catch(() => void 0);
    maybeAutoStructuredEntries(reason).catch(() => void 0);
  }, delay);
}

async function maybeAutoSummary(reason = '') {
  const s = ensureSettings();
  if (!s.enabled) return;
  if (!s.summaryEnabled) return;
  if (isSummarizing) return;

  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  const mode = String(s.summaryCountMode || 'assistant');
  const every = clampInt(s.summaryEvery, 1, 200, 20);
  const floorNow = computeFloorCount(chat, mode, true, true);
  if (floorNow <= 0) return;
  if (floorNow % every !== 0) return;

  const meta = getSummaryMeta();
  const last = Number(meta?.lastFloor || 0);
  if (floorNow <= last) return;

  await runSummary({ reason: 'auto' });
}

function scheduleAutoStructuredEntries(reason = '') {
  const s = ensureSettings();
  if (!s.enabled) return;
  if (!s.structuredEntriesEnabled) return;
  if (!s.summaryToWorldInfo && !s.summaryToBlueWorldInfo) return;
  const delay = clampInt(s.debounceMs, 300, 10000, DEFAULT_SETTINGS.debounceMs);
  if (structuredTimer) clearTimeout(structuredTimer);
  structuredTimer = setTimeout(() => {
    structuredTimer = null;
    maybeAutoStructuredEntries(reason).catch(() => void 0);
  }, delay);
}

async function maybeAutoStructuredEntries(reason = '') {
  const s = ensureSettings();
  if (!s.enabled) return;
  if (!s.structuredEntriesEnabled) return;
  if (!s.summaryToWorldInfo && !s.summaryToBlueWorldInfo) return;
  if (isStructuring || isSummarizing) return;

  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  const mode = String(s.structuredEntriesCountMode || s.summaryCountMode || 'assistant');
  const every = clampInt(s.structuredEntriesEvery, 1, 200, 1);
  const floorNow = computeFloorCount(chat, mode, true, true);
  if (floorNow <= 0) return;
  if (floorNow % every !== 0) return;

  const meta = getSummaryMeta();
  const last = Number(meta?.lastStructuredFloor || 0);
  if (floorNow <= last) return;

  await runStructuredEntries({ reason: 'auto' });
}

async function runStructuredEntries({ reason = 'auto' } = {}) {
  const s = ensureSettings();
  if (!s.enabled) return 0;
  if (!s.structuredEntriesEnabled) return 0;
  if (!s.summaryToWorldInfo && !s.summaryToBlueWorldInfo) return 0;
  if (isStructuring) return 0;

  isStructuring = true;
  structuredCancelled = false;
  setStatus('正在生成结构化条目�?, 'warn');
  showToast('正在生成结构化条目�?, { kind: 'warn', spinner: true, sticky: true });
  try {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    if (!chat.length) return 0;

    const mode = String(s.structuredEntriesCountMode || s.summaryCountMode || 'assistant');
    const every = clampInt(s.structuredEntriesEvery, 1, 200, 1);
    const readFloors = clampInt(s.structuredEntriesReadFloors || every, 1, 200, every);
    const floorNow = computeFloorCount(chat, mode, true, true);

    let meta = getSummaryMeta();
    if (!meta || typeof meta !== 'object') meta = getDefaultSummaryMeta();

    const segments = [];
    const readFromFloor = Math.max(1, floorNow - readFloors + 1);
    const resolved = resolveChatRangeByFloors(chat, mode, readFromFloor, floorNow, true, true);
    if (resolved) segments.push(resolved);

    if (!segments.length) return 0;

    let summaryStatData = null;
    if (s.summaryReadStatData) {
      try {
        const statSettings = {
          ...s,
          wiRollStatVarName: s.summaryStatVarName || 'stat_data'
        };
        const { statData } = await resolveStatDataComprehensive(chat, statSettings);
        if (statData) summaryStatData = statData;
      } catch (e) {
        console.warn('[StoryGuide] Structured entries read stat_data failed:', e);
      }
    }

    let processed = 0;
    let cancelledEarly = false;
    for (const seg of segments) {
      if (structuredCancelled) {
        setStatus('结构化总结已取�?, 'warn');
        showToast('结构化总结已取�?, { kind: 'warn', spinner: false, sticky: false, duration: 2000 });
        cancelledEarly = true;
        break;
      }
      const chunkText = buildSummaryChunkTextRange(chat, seg.startIdx, seg.endIdx, s.summaryMaxCharsPerMessage, s.summaryMaxTotalChars, true, true);
      if (!chunkText) continue;
      const structuredChanges = [];
      const ok = await processStructuredEntriesChunk(chunkText, seg.fromFloor, seg.toFloor, meta, s, summaryStatData, structuredChanges);
      if (ok && structuredChanges.length) {
        appendStructuredHistory(meta, {
          createdAt: Date.now(),
          range: { fromFloor: seg.fromFloor, toFloor: seg.toFloor, fromIdx: seg.startIdx, toIdx: seg.endIdx },
          structuredChanges,
          affectsProgress: true,
        });
      }
      if (ok) processed += 1;
    }

    if (cancelledEarly) return 0;
    if (processed > 0) {
      const lastSeg = segments[segments.length - 1];
      meta.lastStructuredFloor = lastSeg.toFloor;
      meta.lastStructuredChatLen = chat.length;
      await setSummaryMeta(meta);
    }

    if (processed > 0) setStatus(`结构化条目完�?✅（${processed} 段）`, 'ok');
    else setStatus('结构化条目未生成', 'warn');
    return processed;
  } catch (e) {
    console.warn('[StoryGuide] Structured entries run failed:', e);
    setStatus(`结构化条目生成失败：${e?.message ?? e}`, 'err');
    return 0;
  } finally {
    try { if ($('#sg_toast').hasClass('spinner')) hideToast(); } catch { /* ignore */ }
    isStructuring = false;
  }
}

// -------------------- 蓝灯索引 �?绿灯触发（发送消息时注入触发词） --------------------

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]/g, '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;$&');
}

function stripTriggerInjection(text, tag = 'SG_WI_TRIGGERS') {
  const t = String(text || '');
  const et = escapeRegExp(tag);
  // remove all existing injections of this tag (safe)
  const reComment = new RegExp(`        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*<!--        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*${et}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*?-->`, 'g');
  const rePlain = new RegExp(`        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[${et}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;][^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n?`, 'g');
  return t.replace(reComment, '').replace(rePlain, '').trimEnd();
}

function buildTriggerInjection(keywords, tag = 'SG_WI_TRIGGERS', style = 'hidden') {
  const kws = sanitizeKeywords(Array.isArray(keywords) ? keywords : [], { maxLen: 120 });
  if (!kws.length) return '';
  if (String(style || 'hidden') === 'plain') {
    // Visible but most reliable for world-info scan.
    return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n[${tag}] ${kws.join(' ')}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  }
  // Hidden comment: put each keyword on its own line, so substring match is very likely to hit.
  const body = kws.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
  return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n<!--${tag}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${body}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n-->`;
}

// -------------------- ROLL 判定 --------------------
function rollDice(sides = 100) {
  const s = Math.max(2, Number(sides) || 100);
  return Math.floor(Math.random() * s) + 1;
}

function makeNumericProxy(obj) {
  const src = (obj && typeof obj === 'object') ? obj : {};
  return new Proxy(src, {
    get(target, prop) {
      if (prop === Symbol.toStringTag) return 'NumericProxy';
      if (prop in target) {
        const v = target[prop];
        if (v && typeof v === 'object') return makeNumericProxy(v);
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    },
  });
}

function detectRollAction(text, actions) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  const list = Array.isArray(actions) ? actions : DEFAULT_ROLL_ACTIONS;
  for (const a of list) {
    const kws = Array.isArray(a?.keywords) ? a.keywords : [];
    for (const kw of kws) {
      const k = String(kw || '').toLowerCase();
      if (k && t.includes(k)) return { key: String(a.key || ''), label: String(a.label || a.key || '') };
    }
  }
  return null;
}

function extractStatusBlock(text, tagName = 'status_current_variable') {
  const t = String(text || '');
  if (!t) return '';
  const re = new RegExp(`<${tagName}>([        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*?)<        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/${tagName}>`, 'gi');
  let m = null;
  let last = '';
  while ((m = re.exec(t))) {
    if (m && m[1]) last = m[1];
  }
  return String(last || '').trim();
}

function parseStatData(text, mode = 'json') {
  const raw = String(text || '').trim();
  if (!raw) return null;

  if (String(mode || 'json') === 'kv') {
    const out = { pc: {}, mods: {}, context: {} };
    const lines = raw.split(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;r?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^([a-zA-Z0-9_.        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]-]+)        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*[:=]        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*([+-]?        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+(?:        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;.        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+)?)        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*$/);
      if (!m) continue;
      const path = m[1];
      const val = Number(m[2]);
      if (!Number.isFinite(val)) continue;
      if (path.startsWith('pc.')) {
        const k = path.slice(3);
        out.pc[k] = val;
      } else if (path.startsWith('mods.')) {
        const k = path.slice(5);
        out.mods[k] = val;
      } else if (path.startsWith('context.')) {
        const k = path.slice(8);
        out.context[k] = val;
      }
    }
    return out;
  }

  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
}

function normalizeStatData(data) {
  const obj = (data && typeof data === 'object') ? data : {};
  const pc = (obj.pc && typeof obj.pc === 'object') ? obj.pc : {};
  const mods = (obj.mods && typeof obj.mods === 'object') ? obj.mods : {};
  const context = (obj.context && typeof obj.context === 'object') ? obj.context : {};
  return { pc, mods, context };
}

function buildModifierBreakdown(mods, sources) {
  const srcList = Array.isArray(sources) && sources.length
    ? sources
    : DEFAULT_ROLL_MODIFIER_SOURCES;
  const out = [];
  for (const key of srcList) {
    const raw = mods?.[key];
    let v = 0;
    if (Number.isFinite(Number(raw))) {
      v = Number(raw);
    } else if (raw && typeof raw === 'object') {
      for (const val of Object.values(raw)) {
        const n = Number(val);
        if (Number.isFinite(n)) v += n;
      }
    }
    out.push({ source: String(key), value: Number.isFinite(v) ? v : 0 });
  }
  const total = out.reduce((acc, x) => acc + (Number.isFinite(x.value) ? x.value : 0), 0);
  return { list: out, total };
}

function evaluateRollFormula(formula, ctx) {
  const expr = String(formula || '').trim();
  if (!expr) return 0;
  try {
    const fn = new Function('ctx', 'with(ctx){ return (' + expr + '); }');
    const v = fn(ctx);
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function computeRollLocal(actionKey, statData, settings) {
  const s = settings || ensureSettings();
  const { pc, mods, context } = normalizeStatData(statData);
  const modBreakdown = buildModifierBreakdown(mods, safeJsonParse(s.wiRollModifierSourcesJson) || null);

  const formulas = safeJsonParse(s.wiRollFormulaJson) || DEFAULT_ROLL_FORMULAS;
  const formula = String(formulas?.[actionKey] || formulas?.default || DEFAULT_ROLL_FORMULAS.default);

  const ctx = {
    PC: makeNumericProxy(pc),
    MOD: {
      total: modBreakdown.total,
      bySource: makeNumericProxy(modBreakdown.list.reduce((acc, x) => { acc[x.source] = x.value; return acc; }, {})),
    },
    CTX: makeNumericProxy(context),
    ACTION: String(actionKey || ''),
    CLAMP: (v, lo, hi) => clampFloat(v, lo, hi, v),
  };

  const base = evaluateRollFormula(formula, ctx);
  const randWeight = clampFloat(s.wiRollRandomWeight, 0, 1, 0.3);
  const roll = rollDice(100);
  const randFactor = (roll - 50) / 50;
  const final = base + base * randWeight * randFactor;
  const threshold = 50;
  const success = final >= threshold;

  return {
    action: String(actionKey || ''),
    formula,
    base,
    mods: modBreakdown.list,
    random: { roll, weight: randWeight },
    final,
    threshold,
    success,
  };
}

function normalizeRollMods(mods, sources) {
  const srcList = Array.isArray(sources) && sources.length ? sources : DEFAULT_ROLL_MODIFIER_SOURCES;
  const map = new Map();
  for (const m of (Array.isArray(mods) ? mods : [])) {
    const key = String(m?.source || '').trim();
    if (!key) continue;
    const v = Number(m?.value);
    map.set(key, Number.isFinite(v) ? v : 0);
  }
  return srcList.map(s => ({ source: String(s), value: map.has(s) ? map.get(s) : 0 }));
}

function getRollAnalysisSummary(res) {
  if (!res || typeof res !== 'object') return '';
  const raw = res.analysisSummary ?? res.analysis_summary ?? res.explanation ?? res.reason ?? '';
  if (raw && typeof raw === 'object') {
    const pick = raw.summary ?? raw.text ?? raw.message;
    if (pick != null) return String(pick).trim();
    try { return JSON.stringify(raw); } catch { return String(raw); }
  }
  return String(raw || '').trim();
}

function buildRollPromptMessages(actionKey, statData, settings, formula, randomWeight, randomRoll) {
  const s = settings || ensureSettings();
  const sys = String(s.wiRollSystemPrompt || DEFAULT_ROLL_SYSTEM_PROMPT).trim() || DEFAULT_ROLL_SYSTEM_PROMPT;
  const tmpl = String(s.wiRollUserTemplate || DEFAULT_ROLL_USER_TEMPLATE).trim() || DEFAULT_ROLL_USER_TEMPLATE;
  const difficulty = String(s.wiRollDifficulty || 'normal');
  const statDataJson = JSON.stringify(statData || {}, null, 0);
  const modifierSourcesJson = String(s.wiRollModifierSourcesJson || JSON.stringify(DEFAULT_ROLL_MODIFIER_SOURCES));
  const user = tmpl
    .replaceAll('{{action}}', String(actionKey || ''))
    .replaceAll('{{formula}}', String(formula || ''))
    .replaceAll('{{randomWeight}}', String(randomWeight))
    .replaceAll('{{difficulty}}', difficulty)
    .replaceAll('{{randomRoll}}', String(randomRoll))
    .replaceAll('{{modifierSourcesJson}}', modifierSourcesJson)
    .replaceAll('{{statDataJson}}', statDataJson);

  const enforced = user + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` + ROLL_JSON_REQUIREMENT;
  return [
    { role: 'system', content: sys },
    { role: 'user', content: enforced },
  ];
}

function buildRollDecisionPromptMessages(userText, statData, settings, randomRoll) {
  const s = settings || ensureSettings();
  const rawSys = String(s.wiRollSystemPrompt || '').trim();
  const sys = (rawSys && rawSys !== DEFAULT_ROLL_SYSTEM_PROMPT)
    ? rawSys
    : DEFAULT_ROLL_DECISION_SYSTEM_PROMPT;
  const randomWeight = clampFloat(s.wiRollRandomWeight, 0, 1, 0.3);
  const difficulty = String(s.wiRollDifficulty || 'normal');
  const statDataJson = JSON.stringify(statData || {}, null, 0);

  const user = DEFAULT_ROLL_DECISION_USER_TEMPLATE
    .replaceAll('{{userText}}', String(userText || ''))
    .replaceAll('{{randomWeight}}', String(randomWeight))
    .replaceAll('{{difficulty}}', difficulty)
    .replaceAll('{{randomRoll}}', String(randomRoll))
    .replaceAll('{{statDataJson}}', statDataJson);

  const enforced = user + `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n` + ROLL_DECISION_JSON_REQUIREMENT;
  return [
    { role: 'system', content: sys },
    { role: 'user', content: enforced },
  ];
}

async function computeRollViaCustomProvider(actionKey, statData, settings, randomRoll) {
  const s = settings || ensureSettings();
  const formulas = safeJsonParse(s.wiRollFormulaJson) || DEFAULT_ROLL_FORMULAS;
  const formula = String(formulas?.[actionKey] || formulas?.default || DEFAULT_ROLL_FORMULAS.default);
  const randomWeight = clampFloat(s.wiRollRandomWeight, 0, 1, 0.3);
  const messages = buildRollPromptMessages(actionKey, statData, s, formula, randomWeight, randomRoll);

  const jsonText = await callViaCustom(
    s.wiRollCustomEndpoint,
    s.wiRollCustomApiKey,
    s.wiRollCustomModel,
    messages,
    clampFloat(s.wiRollCustomTemperature, 0, 2, 0.2),
    clampInt(s.wiRollCustomMaxTokens, 128, 200000, 512),
    clampFloat(s.wiRollCustomTopP, 0, 1, 0.95),
    !!s.wiRollCustomStream
  );

  const parsed = safeJsonParse(jsonText);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.mods)) return null;

  if (!Array.isArray(parsed.mods)) parsed.mods = [];
  parsed.action = String(parsed.action || actionKey || '');
  parsed.formula = String(parsed.formula || formula || '');
  return parsed;
}

async function computeRollDecisionViaCustom(userText, statData, settings, randomRoll) {
  const s = settings || ensureSettings();
  const messages = buildRollDecisionPromptMessages(userText, statData, s, randomRoll);

  const jsonText = await callViaCustom(
    s.wiRollCustomEndpoint,
    s.wiRollCustomApiKey,
    s.wiRollCustomModel,
    messages,
    clampFloat(s.wiRollCustomTemperature, 0, 2, 0.2),
    clampInt(s.wiRollCustomMaxTokens, 128, 200000, 512),
    clampFloat(s.wiRollCustomTopP, 0, 1, 0.95),
    !!s.wiRollCustomStream
  );

  const parsed = safeJsonParse(jsonText);
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.needRoll === false) return { noRoll: true };

  const res = parsed.result && typeof parsed.result === 'object' ? parsed.result : parsed;
  if (!res || typeof res !== 'object') return null;

  return res;
}

function buildRollInjectionFromResult(res, tag = 'SG_ROLL', style = 'hidden') {
  if (!res) return '';
  const action = String(res.actionLabel || res.action || '').trim();
  const formula = String(res.formula || '').trim();
  const base = Number.isFinite(Number(res.base)) ? Number(res.base) : 0;
  const final = Number.isFinite(Number(res.final)) ? Number(res.final) : 0;
  const threshold = Number.isFinite(Number(res.threshold)) ? Number(res.threshold) : null;
  const success = res.success == null ? null : !!res.success;
  const roll = Number.isFinite(Number(res.random?.roll)) ? Number(res.random?.roll) : 0;
  const weight = Number.isFinite(Number(res.random?.weight)) ? Number(res.random?.weight) : 0;
  const mods = Array.isArray(res.mods) ? res.mods : [];
  const modLine = mods.map(m => `${m.source}:${Number(m.value) >= 0 ? '+' : ''}${Number(m.value) || 0}`).join(' | ');
  const outcome = String(res.outcomeTier || '').trim() || (success == null ? 'N/A' : (success ? '成功' : '失败'));

  if (String(style || 'hidden') === 'plain') {
    return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n[${tag}] 动作=${action} | 结果=${outcome} | 最�?${final.toFixed(2)} | 阈�?=${threshold == null ? 'N/A' : threshold} | 基础=${base.toFixed(2)} | 随机=1d100:${roll}*${weight} | 修正=${modLine} | 公式=${formula}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  }

  return `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n<!--${tag}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n动作=${action}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n结果=${outcome}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n最�?${final.toFixed(2)}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n阈�?=${threshold == null ? 'N/A' : threshold}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n基础=${base.toFixed(2)}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n随机=1d100:${roll}*${weight}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n修正=${modLine}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n公式=${formula}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n-->`;
}

function getLatestAssistantText(chat, strip = true) {
  const arr = Array.isArray(chat) ? chat : [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    if (!m) continue;
    if (m.is_system === true) continue;
    if (m.is_user === true) continue;
    const raw = String(m.mes ?? m.message ?? '');
    return strip ? stripHtml(raw) : raw;
  }
  return '';
}

function resolveStatDataFromLatestAssistant(chat, settings) {
  const s = settings || ensureSettings();
  const lastText = getLatestAssistantText(chat, false);
  const block = extractStatusBlock(lastText);
  const parsed = parseStatData(block, s.wiRollStatParseMode || 'json');
  return { statData: parsed, rawText: block };
}

function resolveStatDataFromVariableStore(settings) {
  const s = settings || ensureSettings();
  const key = String(s.wiRollStatVarName || 'stat_data').trim();
  if (!key) return { statData: null, rawText: '' };
  const ctx = SillyTavern.getContext?.() ?? {};

  // 扩展所有可能的变量来源，按优先级排�?
  const sources = [
    // 优先�?context 获取（最新值）
    ctx?.variables,
    ctx?.chatMetadata?.variables,
    ctx?.chatMetadata,
    // 全局变量存储
    globalThis?.SillyTavern?.chatVariables,
    globalThis?.SillyTavern?.variables,
    globalThis?.variables,
    globalThis?.chatVariables,
    // extension_settings 中可能存储的变量
    ctx?.extensionSettings?.variables,
    // window 对象上的变量
    window?.variables,
    window?.chatVariables,
  ].filter(Boolean);

  let raw = null;
  for (const src of sources) {
    if (src && Object.prototype.hasOwnProperty.call(src, key)) {
      raw = src[key];
      break;
    }
  }

  // 如果上述来源都没找到，尝试从 chat 数组中的最后一条消息的 extra 字段读取
  if (raw == null && Array.isArray(ctx?.chat)) {
    for (let i = ctx.chat.length - 1; i >= Math.max(0, ctx.chat.length - 5); i--) {
      const msg = ctx.chat[i];
      if (msg?.extra?.variables && Object.prototype.hasOwnProperty.call(msg.extra.variables, key)) {
        raw = msg.extra.variables[key];
        break;
      }
      if (msg?.variables && Object.prototype.hasOwnProperty.call(msg.variables, key)) {
        raw = msg.variables[key];
        break;
      }
    }
  }

  if (raw == null) return { statData: null, rawText: '' };
  if (typeof raw === 'string') {
    const parsed = parseStatData(raw, s.wiRollStatParseMode || 'json');
    return { statData: parsed, rawText: raw };
  }
  if (typeof raw === 'object') {
    return { statData: raw, rawText: JSON.stringify(raw) };
  }
  return { statData: null, rawText: '' };
}

async function resolveStatDataFromTemplate(settings) {
  const s = settings || ensureSettings();
  const tpl = `<status_current_variable>        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{{format_message_variable::stat_data}}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n</status_current_variable>`;
  const ctx = SillyTavern.getContext?.() ?? {};
  const fns = [
    ctx?.renderTemplateAsync,
    ctx?.renderTemplate,
    ctx?.formatMessageVariables,
    ctx?.replaceMacros,
    globalThis?.renderTemplate,
    globalThis?.formatMessageVariables,
    globalThis?.replaceMacros,
  ].filter(Boolean);
  let rendered = '';
  for (const fn of fns) {
    try {
      const out = await fn(tpl);
      if (typeof out === 'string' && out.trim()) {
        rendered = out;
        break;
      }
    } catch { /* ignore */ }
  }
  if (!rendered || rendered.includes('{{format_message_variable::stat_data}}')) {
    return { statData: null, rawText: '' };
  }
  const block = extractStatusBlock(rendered);
  const parsed = parseStatData(block, s.wiRollStatParseMode || 'json');
  return { statData: parsed, rawText: block };
}

/**
 * 最稳定的变量读取方式：通过 /getvar 斜杠命令读取变量
 * 由于 SillyTavern 变量系统可能存在缓存或上下文不同步问题，
 * 使用 slash command 可以确保读取到最新的变量�?
 */
async function resolveStatDataViaSlashCommand(settings) {
  const s = settings || ensureSettings();
  const key = String(s.wiRollStatVarName || 'stat_data').trim();
  if (!key) return { statData: null, rawText: '' };

  try {
    // 尝试使用 /getvar 命令读取变量（最稳定的方式）
    const result = await execSlash(`/getvar ${key}`);
    const raw = slashOutputToText(result);

    if (!raw || raw.trim() === '' || raw.trim() === 'undefined' || raw.trim() === 'null') {
      return { statData: null, rawText: '' };
    }

    // 解析变量内容
    if (typeof raw === 'string') {
      // 尝试 JSON 解析
      const parsed = parseStatData(raw, s.wiRollStatParseMode || 'json');
      if (parsed) {
        return { statData: parsed, rawText: raw };
      }
    }

    return { statData: null, rawText: raw };
  } catch (e) {
    // /getvar 命令失败时静默处理，回退到其他方�?
    console.debug('[StoryGuide] resolveStatDataViaSlashCommand failed:', e);
    return { statData: null, rawText: '' };
  }
}

/**
 * 扩展的变量读取：尝试�?chat 数组中的最新消息读取变量（直接读取 DOM�?
 * 作为变量存储和模板方法的补充回退方案
 */
function resolveStatDataFromChatDOM(settings) {
  const s = settings || ensureSettings();
  const key = String(s.wiRollStatVarName || 'stat_data').trim();
  if (!key) return { statData: null, rawText: '' };

  try {
    // 尝试�?DOM 中查找最近的状态块
    const chatContainer = document.querySelector('#chat, .chat, [id*="chat"]');
    if (!chatContainer) return { statData: null, rawText: '' };

    // 查找所有消息块
    const messages = chatContainer.querySelectorAll('.mes, [class*="message"]');
    if (!messages.length) return { statData: null, rawText: '' };

    // 从后往前查找包含状态数据的消息
    for (let i = messages.length - 1; i >= Math.max(0, messages.length - 10); i--) {
      const msg = messages[i];
      if (!msg) continue;

      // 跳过用户消息
      const isUser = msg.classList.contains('user_mes') || msg.dataset.isUser === 'true';
      if (isUser) continue;

      const textEl = msg.querySelector('.mes_text, .message-text, [class*="mes_text"]');
      if (!textEl) continue;

      const text = textEl.innerText || textEl.textContent || '';
      if (!text) continue;

      // 尝试提取状态块
      const block = extractStatusBlock(text);
      if (block) {
        const parsed = parseStatData(block, s.wiRollStatParseMode || 'json');
        if (parsed) {
          return { statData: parsed, rawText: block };
        }
      }
    }

    return { statData: null, rawText: '' };
  } catch (e) {
    console.debug('[StoryGuide] resolveStatDataFromChatDOM failed:', e);
    return { statData: null, rawText: '' };
  }
}

/**
 * 综合查找变量数据：尝试多种来源以确保能读取到最新数�?
 * 按优先级依次尝试�?
 * 1. /getvar 斜杠命令（最稳定�?
 * 2. 变量存储对象
 * 3. 模板渲染
 * 4. �?DOM 读取
 * 5. 从最�?AI 回复读取
 */
async function resolveStatDataComprehensive(chat, settings) {
  const s = settings || ensureSettings();

  // 方法1：使�?/getvar 斜杠命令（最稳定�?
  try {
    const { statData, rawText } = await resolveStatDataViaSlashCommand(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via /getvar slash command');
      return { statData, rawText, source: 'slashCommand' };
    }
  } catch { /* continue */ }

  // 方法2：从变量存储对象读取
  try {
    const { statData, rawText } = resolveStatDataFromVariableStore(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via variable store');
      return { statData, rawText, source: 'variableStore' };
    }
  } catch { /* continue */ }

  // 方法3：通过模板渲染读取
  try {
    const { statData, rawText } = await resolveStatDataFromTemplate(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via template rendering');
      return { statData, rawText, source: 'template' };
    }
  } catch { /* continue */ }

  // 方法4：从 DOM 读取
  try {
    const { statData, rawText } = resolveStatDataFromChatDOM(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via DOM');
      return { statData, rawText, source: 'dom' };
    }
  } catch { /* continue */ }

  // 方法5：从最�?AI 回复读取
  try {
    const { statData, rawText } = resolveStatDataFromLatestAssistant(chat, s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via latest assistant message');
      return { statData, rawText, source: 'latestAssistant' };
    }
  } catch { /* continue */ }

  return { statData: null, rawText: '', source: null };
}

async function resolveStatDataRawText(chat, settings) {
  const s = settings || ensureSettings();
  const steps = [
    async () => resolveStatDataViaSlashCommand(s),
    async () => resolveStatDataFromVariableStore(s),
    async () => resolveStatDataFromTemplate(s),
    async () => resolveStatDataFromChatDOM(s),
    async () => resolveStatDataFromLatestAssistant(chat, s),
  ];
  for (const step of steps) {
    try {
      const { rawText } = await step();
      if (rawText && String(rawText).trim()) return String(rawText).trim();
    } catch { /* ignore */ }
  }
  return '';
}

async function maybeInjectRollResult(reason = 'msg_sent') {
  const s = ensureSettings();
  if (!s.wiRollEnabled) return;

  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  if (!chat.length) return;

  const modalOpen = $('#sg_modal_backdrop').is(':visible');
  const shouldLog = modalOpen || s.wiRollDebugLog;
  const logStatus = (msg, kind = 'info') => {
    if (!shouldLog) return;
    if (modalOpen) setStatus(msg, kind);
    else showToast(msg, { kind, spinner: false, sticky: false, duration: 2200 });
  };

  const last = chat[chat.length - 1];
  if (!last || last.is_user !== true) return; // only on user send
  let lastText = String(last.mes ?? last.message ?? '').trim();
  if (!lastText || lastText.startsWith('/')) return;
  const rollTag = String(s.wiRollTag || 'SG_ROLL').trim() || 'SG_ROLL';
  if (lastText.includes(rollTag)) return;
  lastText = stripTriggerInjection(lastText, rollTag);

  const source = String(s.wiRollStatSource || 'variable');
  let statData = null;
  let varSource = '';
  if (source === 'latest') {
    ({ statData } = resolveStatDataFromLatestAssistant(chat, s));
    varSource = 'latest';
  } else if (source === 'template') {
    ({ statData } = await resolveStatDataFromTemplate(s));
    varSource = 'template';
    if (!statData) {
      ({ statData } = await resolveStatDataViaSlashCommand(s));
      varSource = 'slashCommand';
    }
    if (!statData) {
      ({ statData } = resolveStatDataFromVariableStore(s));
      varSource = 'variableStore';
    }
    if (!statData) {
      ({ statData } = resolveStatDataFromLatestAssistant(chat, s));
      varSource = 'latestAssistant';
    }
  } else {
    // 默认使用综合方法（最稳定�?
    const result = await resolveStatDataComprehensive(chat, s);
    statData = result.statData;
    varSource = result.source || '';
  }
  if (!statData) {
    const name = String(s.wiRollStatVarName || 'stat_data').trim() || 'stat_data';
    logStatus(`ROLL 未触发：未读取到变量�?{name}）`, 'warn');
    return;
  }
  if (s.wiRollDebugLog && varSource) {
    console.debug(`[StoryGuide] ROLL 变量读取来源: ${varSource}`);
  }

  const randomRoll = rollDice(100);
  let res = null;
  const canUseCustom = String(s.wiRollProvider || 'custom') === 'custom' && String(s.wiRollCustomEndpoint || '').trim();
  if (canUseCustom) {
    try {
      res = await computeRollDecisionViaCustom(lastText, statData, s, randomRoll);
      if (res?.noRoll) {
        logStatus('ROLL 未触发：AI 判定无需判定', 'info');
        return;
      }
    } catch (e) {
      console.warn('[StoryGuide] roll custom provider failed; fallback to local', e);
    }
  }
  if (!res) {
    logStatus('ROLL 未触发：AI 判定失败或无结果', 'warn');
    return;
  }

  if (res) {
    if (!Array.isArray(res.mods)) res.mods = [];
    res.actionLabel = res.actionLabel || res.action || '';
    res.formula = res.formula || '';
    if (!res.random) res.random = { roll: randomRoll, weight: clampFloat(s.wiRollRandomWeight, 0, 1, 0.3) };
    if (res.final == null && Number.isFinite(Number(res.base))) {
      const randWeight = Number(res.random?.weight) || clampFloat(s.wiRollRandomWeight, 0, 1, 0.3);
      const randRoll = Number(res.random?.roll) || randomRoll;
      res.final = Number(res.base) + Number(res.base) * randWeight * ((randRoll - 50) / 50);
    }
    if (res.success == null && Number.isFinite(Number(res.final)) && Number.isFinite(Number(res.threshold))) {
      res.success = Number(res.final) >= Number(res.threshold);
    }
    const summary = getRollAnalysisSummary(res);
    if (summary) {
      appendRollLog({
        ts: Date.now(),
        action: res.actionLabel || res.action,
        outcomeTier: res.outcomeTier,
        summary,
        final: res.final,
        success: res.success,
        userText: lastText,
      });
    }
    const style = String(s.wiRollInjectStyle || 'hidden').trim() || 'hidden';
    const rollText = buildRollInjectionFromResult(res, rollTag, style);
    if (rollText) {
      const cleaned = stripTriggerInjection(last.mes ?? last.message ?? '', rollTag);
      last.mes = cleaned + rollText;
      logStatus('ROLL 已注入：判定完成', 'ok');
    }
  }

  // try save
  try {
    if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
    else if (typeof ctx.saveChat === 'function') ctx.saveChat();
  } catch { /* ignore */ }
}

async function buildRollInjectionForText(userText, chat, settings, logStatus) {
  const s = settings || ensureSettings();
  const rollTag = String(s.wiRollTag || 'SG_ROLL').trim() || 'SG_ROLL';
  if (String(userText || '').includes(rollTag)) return null;
  const source = String(s.wiRollStatSource || 'variable');
  let statData = null;
  let varSource = '';
  if (source === 'latest') {
    ({ statData } = resolveStatDataFromLatestAssistant(chat, s));
    varSource = 'latest';
  } else if (source === 'template') {
    ({ statData } = await resolveStatDataFromTemplate(s));
    varSource = 'template';
    if (!statData) {
      ({ statData } = await resolveStatDataViaSlashCommand(s));
      varSource = 'slashCommand';
    }
    if (!statData) {
      ({ statData } = resolveStatDataFromVariableStore(s));
      varSource = 'variableStore';
    }
    if (!statData) {
      ({ statData } = resolveStatDataFromLatestAssistant(chat, s));
      varSource = 'latestAssistant';
    }
  } else {
    // 默认使用综合方法（最稳定�?
    const result = await resolveStatDataComprehensive(chat, s);
    statData = result.statData;
    varSource = result.source || '';
  }
  if (!statData) {
    const name = String(s.wiRollStatVarName || 'stat_data').trim() || 'stat_data';
    logStatus?.(`ROLL 未触发：未读取到变量�?{name}）`, 'warn');
    return null;
  }
  if (s.wiRollDebugLog && varSource) {
    console.debug(`[StoryGuide] buildRollInjectionForText 变量读取来源: ${varSource}`);
  }

  const randomRoll = rollDice(100);
  let res = null;
  const canUseCustom = String(s.wiRollProvider || 'custom') === 'custom' && String(s.wiRollCustomEndpoint || '').trim();
  if (canUseCustom) {
    try {
      res = await computeRollDecisionViaCustom(userText, statData, s, randomRoll);
      if (res?.noRoll) {
        logStatus?.('ROLL 未触发：AI 判定无需判定', 'info');
        return null;
      }
    } catch (e) {
      console.warn('[StoryGuide] roll custom provider failed; fallback to local', e);
    }
  }
  if (!res) {
    logStatus?.('ROLL 未触发：AI 判定失败或无结果', 'warn');
    return null;
  }
  if (!res) return null;

  if (!Array.isArray(res.mods)) res.mods = [];
  res.actionLabel = res.actionLabel || res.action || '';
  res.formula = res.formula || '';
  if (!res.random) res.random = { roll: randomRoll, weight: clampFloat(s.wiRollRandomWeight, 0, 1, 0.3) };
  if (res.final == null && Number.isFinite(Number(res.base))) {
    const randWeight = Number(res.random?.weight) || clampFloat(s.wiRollRandomWeight, 0, 1, 0.3);
    const randRoll = Number(res.random?.roll) || randomRoll;
    res.final = Number(res.base) + Number(res.base) * randWeight * ((randRoll - 50) / 50);
  }
  if (res.success == null && Number.isFinite(Number(res.final)) && Number.isFinite(Number(res.threshold))) {
    res.success = Number(res.final) >= Number(res.threshold);
  }
  const summary = getRollAnalysisSummary(res);
  if (summary) {
    appendRollLog({
      ts: Date.now(),
      action: res.actionLabel || res.action,
      outcomeTier: res.outcomeTier,
      summary,
      final: res.final,
      success: res.success,
      userText: String(userText || ''),
    });
  }
  if (!res.random) res.random = { roll: randomRoll, weight: clampFloat(s.wiRollRandomWeight, 0, 1, 0.3) };
  const style = String(s.wiRollInjectStyle || 'hidden').trim() || 'hidden';
  const rollText = buildRollInjectionFromResult(res, rollTag, style);
  if (rollText) logStatus?.('ROLL 已注入：判定完成', 'ok');
  return rollText || null;
}

async function buildTriggerInjectionForText(userText, chat, settings, logStatus) {
  const s = settings || ensureSettings();
  if (!s.wiTriggerEnabled) return null;

  const startAfter = clampInt(s.wiTriggerStartAfterAssistantMessages, 0, 200000, 0);
  if (startAfter > 0) {
    const assistantFloors = computeFloorCount(chat, 'assistant');
    if (assistantFloors < startAfter) {
      logStatus?.(`索引未触发：AI 楼层不足 ${assistantFloors}/${startAfter}`, 'info');
      return null;
    }
  }

  const lookback = clampInt(s.wiTriggerLookbackMessages, 5, 120, 20);
  const tagForStrip = String(s.wiTriggerTag || 'SG_WI_TRIGGERS').trim() || 'SG_WI_TRIGGERS';
  const rollTag = String(s.wiRollTag || 'SG_ROLL').trim() || 'SG_ROLL';
  const recentText = buildRecentChatText(chat, lookback, true, [tagForStrip, rollTag]);
  if (!recentText) return null;

  const candidates = collectBlueIndexCandidates();
  if (!candidates.length) return null;

  const maxEntries = clampInt(s.wiTriggerMaxEntries, 1, 20, 4);
  const minScore = clampFloat(s.wiTriggerMinScore, 0, 1, 0.08);
  const includeUser = !!s.wiTriggerIncludeUserMessage;
  const userWeight = clampFloat(s.wiTriggerUserMessageWeight, 0, 10, 1.6);
  const matchMode = String(s.wiTriggerMatchMode || 'local');

  let picked = [];
  if (matchMode === 'llm') {
    try {
      picked = await pickRelevantIndexEntriesLLM(recentText, userText, candidates, maxEntries, includeUser, userWeight);
    } catch (e) {
      console.warn('[StoryGuide] index LLM failed; fallback to local similarity', e);
      picked = pickRelevantIndexEntries(recentText, userText, candidates, maxEntries, minScore, includeUser, userWeight);
    }
    if (!picked.length) {
      picked = pickRelevantIndexEntries(recentText, userText, candidates, maxEntries, minScore, includeUser, userWeight);
    }
  } else {
    picked = pickRelevantIndexEntries(recentText, userText, candidates, maxEntries, minScore, includeUser, userWeight);
  }
  if (!picked.length) return null;

  const maxKeywords = clampInt(s.wiTriggerMaxKeywords, 1, 200, 24);
  const kwSet = new Set();
  const pickedNames = [];
  for (const { e } of picked) {
    const name = String(e.title || '').trim() || '条目';
    pickedNames.push(name);
    for (const k of (Array.isArray(e.keywords) ? e.keywords : [])) {
      const kk = String(k || '').trim();
      if (!kk) continue;
      kwSet.add(kk);
      if (kwSet.size >= maxKeywords) break;
    }
    if (kwSet.size < maxKeywords && name && !kwSet.has(name)) {
      kwSet.add(name);
    }
    if (kwSet.size >= maxKeywords) break;
  }
  const keywords = Array.from(kwSet);
  if (!keywords.length) return null;

  const style = String(s.wiTriggerInjectStyle || 'hidden').trim() || 'hidden';
  const injected = buildTriggerInjection(keywords, tagForStrip, style);
  if (injected) logStatus?.(`索引已注入：${pickedNames.slice(0, 4).join('�?)}${pickedNames.length > 4 ? '�? : ''}`, 'ok');
  return injected || null;
}

function installRollPreSendHook() {
  if (window.__storyguide_roll_presend_installed) return;
  window.__storyguide_roll_presend_installed = true;
  let guard = false;
  let preSendPromise = null;

  function findTextarea() {
    return document.querySelector('#send_textarea, textarea#send_textarea, .send_textarea, textarea.send_textarea');
  }

  function findForm(textarea) {
    if (textarea && textarea.closest) {
      const f = textarea.closest('form');
      if (f) return f;
    }
    return document.getElementById('chat_input_form') || null;
  }

  function findSendButton(form) {
    if (form) {
      const btn = form.querySelector('button[type="submit"]');
      if (btn) return btn;
    }
    return document.querySelector('#send_button, #send_but, button.send_button, .send_button');
  }

  function buildPreSendLogger(s) {
    const modalOpen = $('#sg_modal_backdrop').is(':visible');
    const shouldLog = modalOpen || s.wiRollDebugLog || s.wiTriggerDebugLog;
    if (!shouldLog) return null;
    return (msg, kind = 'info') => {
      if (modalOpen) setStatus(msg, kind);
      else showToast(msg, { kind, spinner: false, sticky: false, duration: 2200 });
    };
  }

  async function applyPreSendInjectionsToText(raw, chat, s, logStatus) {
    const text = String(raw ?? '').trim();
    if (!text || text.startsWith('/')) return null;

    const rollText = s.wiRollEnabled ? await buildRollInjectionForText(text, chat, s, logStatus) : null;
    const triggerText = s.wiTriggerEnabled ? await buildTriggerInjectionForText(text, chat, s, logStatus) : null;
    if (!rollText && !triggerText) return null;

    let cleaned = stripTriggerInjection(text, String(s.wiRollTag || 'SG_ROLL').trim() || 'SG_ROLL');
    cleaned = stripTriggerInjection(cleaned, String(s.wiTriggerTag || 'SG_WI_TRIGGERS').trim() || 'SG_WI_TRIGGERS');
    return cleaned + (rollText || '') + (triggerText || '');
  }

  function findMessageArg(args) {
    if (!Array.isArray(args) || !args.length) return null;
    if (typeof args[0] === 'string') return { type: 'string', index: 0 };
    if (args[0] && typeof args[0] === 'object') {
      if (typeof args[0].mes === 'string') return { type: 'object', index: 0, key: 'mes' };
      if (typeof args[0].message === 'string') return { type: 'object', index: 0, key: 'message' };
    }
    if (typeof args[1] === 'string') return { type: 'string', index: 1 };
    return null;
  }

  async function applyPreSendInjectionsToArgs(args, chat, s, logStatus) {
    const msgArg = findMessageArg(args);
    if (!msgArg) return false;
    const raw = msgArg.type === 'string' ? args[msgArg.index] : args[msgArg.index]?.[msgArg.key];
    const injected = await applyPreSendInjectionsToText(raw, chat, s, logStatus);
    if (!injected) return false;
    if (msgArg.type === 'string') args[msgArg.index] = injected;
    else args[msgArg.index][msgArg.key] = injected;
    return true;
  }

  async function runPreSendInjections(textarea) {
    const s = ensureSettings();
    if (!s.wiRollEnabled && !s.wiTriggerEnabled) return false;
    const raw = String(textarea?.value ?? '');
    const logStatus = buildPreSendLogger(s);
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const injected = await applyPreSendInjectionsToText(raw, chat, s, logStatus);
    if (injected && textarea) {
      textarea.value = injected;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }

  async function ensurePreSend(textarea) {
    if (preSendPromise) return preSendPromise;
    preSendPromise = (async () => {
      await runPreSendInjections(textarea);
    })();
    try {
      await preSendPromise;
    } finally {
      preSendPromise = null;
    }
  }

  function triggerSend(form) {
    const btn = findSendButton(form);
    if (btn && typeof btn.click === 'function') {
      btn.click();
      return;
    }
    if (form && typeof form.requestSubmit === 'function') {
      form.requestSubmit();
      return;
    }
    if (form && typeof form.dispatchEvent === 'function') {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  document.addEventListener('submit', async (e) => {
    const form = e.target;
    const textarea = findTextarea();
    if (!form || !textarea || !form.contains(textarea)) return;
    if (guard) return;
    const s = ensureSettings();
    if (!s.wiRollEnabled && !s.wiTriggerEnabled) return;

    e.preventDefault();
    e.stopPropagation();
    guard = true;

    try {
      await ensurePreSend(textarea);
    } finally {
      guard = false;
      window.__storyguide_presend_guard = true;
      try {
        triggerSend(form);
      } finally {
        window.__storyguide_presend_guard = false;
      }
    }
  }, true);

  document.addEventListener('keydown', async (e) => {
    const textarea = findTextarea();
    if (!textarea || e.target !== textarea) return;
    if (e.key !== 'Enter') return;
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const s = ensureSettings();
    if (!s.wiRollEnabled && !s.wiTriggerEnabled) return;
    if (guard) return;

    e.preventDefault();
    e.stopPropagation();
    guard = true;

    try {
      await ensurePreSend(textarea);
    } finally {
      guard = false;
      const form = findForm(textarea);
      window.__storyguide_presend_guard = true;
      try {
        triggerSend(form);
      } finally {
        window.__storyguide_presend_guard = false;
      }
    }
  }, true);

  async function handleSendButtonEvent(e) {
    const btn = e.target && e.target.closest
      ? e.target.closest('#send_but, #send_button, button.send_button, .send_button')
      : null;
    if (!btn) return;
    if (guard || window.__storyguide_presend_guard) return;
    const s = ensureSettings();
    if (!s.wiRollEnabled && !s.wiTriggerEnabled) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    guard = true;

    try {
      const textarea = findTextarea();
      if (textarea) await ensurePreSend(textarea);
    } finally {
      guard = false;
      window.__storyguide_presend_guard = true;
      try {
        if (typeof btn.click === 'function') btn.click();
      } finally {
        window.__storyguide_presend_guard = false;
      }
    }
  }

  document.addEventListener('click', handleSendButtonEvent, true);

  function wrapSendFunction(obj, key) {
    if (!obj || typeof obj[key] !== 'function' || obj[key].__sg_wrapped) return;
    const original = obj[key];
    obj[key] = async function (...args) {
      if (window.__storyguide_presend_guard) return original.apply(this, args);
      const s = ensureSettings();
      if (!s.wiRollEnabled && !s.wiTriggerEnabled) return original.apply(this, args);
      const textarea = findTextarea();
      if (textarea) {
        await ensurePreSend(textarea);
      } else {
        const logStatus = buildPreSendLogger(s);
        const ctx = SillyTavern.getContext?.() ?? {};
        const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
        await applyPreSendInjectionsToArgs(args, chat, s, logStatus);
      }
      window.__storyguide_presend_guard = true;
      try {
        return await original.apply(this, args);
      } finally {
        window.__storyguide_presend_guard = false;
      }
    };
    obj[key].__sg_wrapped = true;
  }

  function installSendWrappers() {
    const ctx = SillyTavern.getContext?.() ?? {};
    const candidates = ['sendMessage', 'sendUserMessage', 'sendUserMessageInChat', 'submitUserMessage'];
    for (const k of candidates) wrapSendFunction(ctx, k);
    for (const k of candidates) wrapSendFunction(SillyTavern, k);
    for (const k of candidates) wrapSendFunction(globalThis, k);
  }

  installSendWrappers();
  setInterval(installSendWrappers, 2000);
}

function tokenizeForSimilarity(text) {
  const s = String(text || '').toLowerCase();
  const tokens = new Map();

  function add(tok, w = 1) {
    if (!tok) return;
    const k = String(tok).trim();
    if (!k) return;
    tokens.set(k, (tokens.get(k) || 0) + w);
  }

  // latin words
  const latin = s.match(/[a-z0-9_]{2,}/g) || [];
  for (const w of latin) add(w, 1);

  // CJK sequences -> bigrams (better than single-char)
  const cjkSeqs = s.match(/[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e00-        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9fff]{2,}/g) || [];
  for (const seq of cjkSeqs) {
    // include short full seq for exact hits
    if (seq.length <= 6) add(seq, 2);
    for (let i = 0; i < seq.length - 1; i++) {
      add(seq.slice(i, i + 2), 1);
    }
  }

  return tokens;
}

function cosineSimilarity(mapA, mapB) {
  if (!mapA?.size || !mapB?.size) return 0;
  // iterate smaller
  const small = mapA.size <= mapB.size ? mapA : mapB;
  const large = mapA.size <= mapB.size ? mapB : mapA;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const v of mapA.values()) normA += v * v;
  for (const v of mapB.values()) normB += v * v;
  if (!normA || !normB) return 0;
  for (const [k, va] of small.entries()) {
    const vb = large.get(k);
    if (vb) dot += va * vb;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function buildRecentChatText(chat, lookback, excludeLast = true, stripTags = '') {
  const tags = Array.isArray(stripTags) ? stripTags : (stripTags ? [stripTags] : []);
  const msgs = [];
  const arr = Array.isArray(chat) ? chat : [];
  let i = arr.length - 1;
  if (excludeLast) i -= 1;
  for (; i >= 0 && msgs.length < lookback; i--) {
    const m = arr[i];
    if (!m) continue;
    if (m.is_system === true) continue;
    let t = stripHtml(m.mes ?? m.message ?? '');
    if (tags.length) {
      for (const tag of tags) {
        if (tag) t = stripTriggerInjection(t, tag);
      }
    }
    if (t) msgs.push(t);
  }
  return msgs.reverse().join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

function getBlueIndexEntriesFast() {
  const s = ensureSettings();
  const mode = String(s.wiBlueIndexMode || 'live');
  const cached = Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : [];
  const live = Array.isArray(blueIndexLiveCache.entries) ? blueIndexLiveCache.entries : [];
  if (mode !== 'live') {
    const file = pickBlueIndexFileName();
    if (!cached.length && file) {
      ensureBlueIndexLive(false, true).catch(() => void 0);
    }
    if (cached.length) return cached;
    if (live.length) return live;
    return cached;
  }

  const file = pickBlueIndexFileName();
  if (!file) return cached;

  const minSec = clampInt(s.wiBlueIndexMinRefreshSec, 5, 600, 20);
  const now = Date.now();
  const ageMs = now - Number(blueIndexLiveCache.loadedAt || 0);
  const need = (blueIndexLiveCache.file !== file) || ageMs > (minSec * 1000);

  // 注意：为了尽量不阻塞 MESSAGE_SENT（确保触发词注入在生成前完成），这里�?await�?
  // 如果需要刷新，就后台拉取一次，下次消息即可使用最新索引�?
  if (need) {
    ensureBlueIndexLive(false).catch(() => void 0);
  }

  if (live.length) return live;
  return cached;
}

function detectIndexEntryTypeByTitle(title, settings) {
  const s = settings || ensureSettings();
  const t = String(title || '').trim();
  if (!t) return 'plot';
  const prefixes = [
    { type: 'character', prefix: String(s.characterEntryPrefix || '人物') },
    { type: 'equipment', prefix: String(s.equipmentEntryPrefix || '装备') },
    { type: 'faction', prefix: String(s.factionEntryPrefix || '势力') },
    { type: 'achievement', prefix: String(s.achievementEntryPrefix || '成就') },
    { type: 'subProfession', prefix: String(s.subProfessionEntryPrefix || '副职�?) },
    { type: 'quest', prefix: String(s.questEntryPrefix || '任务') },
  ];
  for (const p of prefixes) {
    const pref = String(p.prefix || '').trim();
    if (!pref) continue;
    if (t.startsWith(`${pref}｜`) || t.includes(`${pref}｜`)) return p.type;
  }
  return 'plot';
}

function addStructuredIndexCandidates(out, entriesCache, prefix, type, seen) {
  for (const entry of Object.values(entriesCache || {})) {
    if (!entry) continue;
    if (!entry.name || !entry.indexId) continue;
    const key = buildStructuredEntryKey(prefix, entry.name, entry.indexId);
    const kws = [key];
    if (Array.isArray(entry.aliases)) {
      for (const a of entry.aliases) {
        const alias = String(a || '').trim();
        if (!alias) continue;
        if (kws.length >= 6) break;
        kws.push(alias);
      }
    }
    const dedupKey = `${prefix}__${entry.name}__${entry.indexId}`;
    if (seen && seen.has(dedupKey)) continue;
    if (seen) seen.add(dedupKey);
    out.push({
      title: `${prefix}�?{entry.name}`,
      summary: String(entry.content || '').trim(),
      keywords: kws,
      type,
    });
  }
}

function collectBlueIndexCandidates() {
  const s = ensureSettings();
  const out = [];
  const seen = new Set();

  const fromImported = getBlueIndexEntriesFast();
  for (const r of fromImported) {
    const title = String(r?.title || '').trim();
    const summary = String(r?.summary || '').trim();
    const keywords = sanitizeKeywords(r?.keywords);
    if (!summary) continue;
    const key = `${title}__${summary.slice(0, 24)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: title || (keywords[0] ? `条目�?{keywords[0]}` : '条目'),
      summary,
      keywords,
      type: detectIndexEntryTypeByTitle(title, s),
    });
  }

  return out;
}

function getIndexTypeLimits(settings) {
  const s = settings || ensureSettings();
  return {
    maxCharacters: clampInt(s.wiTriggerMaxCharacters, 0, 10, 2),
    maxEquipments: clampInt(s.wiTriggerMaxEquipments, 0, 10, 2),
    maxFactions: clampInt(s.wiTriggerMaxFactions, 0, 10, 2),
    maxAchievements: clampInt(s.wiTriggerMaxAchievements, 0, 10, 2),
    maxSubProfessions: clampInt(s.wiTriggerMaxSubProfessions, 0, 10, 2),
    maxQuests: clampInt(s.wiTriggerMaxQuests, 0, 10, 2),
    maxPlot: clampInt(s.wiTriggerMaxPlot, 0, 10, 3),
  };
}

function normalizeIndexEntryType(entry, settings) {
  if (entry?.type) return entry.type;
  return detectIndexEntryTypeByTitle(entry?.title || '', settings);
}

function applyIndexTypeLimits(picked, settings, maxEntries) {
  const limits = getIndexTypeLimits(settings);
  const counts = {
    character: 0,
    equipment: 0,
    faction: 0,
    achievement: 0,
    subProfession: 0,
    quest: 0,
    plot: 0,
  };
  const maxByType = {
    character: limits.maxCharacters,
    equipment: limits.maxEquipments,
    faction: limits.maxFactions,
    achievement: limits.maxAchievements,
    subProfession: limits.maxSubProfessions,
    quest: limits.maxQuests,
    plot: limits.maxPlot,
  };

  const out = [];
  for (const item of picked) {
    const e = item?.e || item;
    const type = normalizeIndexEntryType(e, settings);
    const maxAllowed = maxByType[type] ?? maxEntries;
    if (Number.isFinite(maxAllowed) && maxAllowed >= 0 && counts[type] >= maxAllowed) continue;
    counts[type] += 1;
    out.push(item);
    if (out.length >= maxEntries) break;
  }
  return out;
}

function pickRelevantIndexEntries(recentText, userText, candidates, maxEntries, minScore, includeUser = true, userWeight = 1.0) {
  const recentVec = tokenizeForSimilarity(recentText);
  if (includeUser && userText) {
    const uvec = tokenizeForSimilarity(userText);
    const w = Number(userWeight);
    const mul = Number.isFinite(w) ? Math.max(0, Math.min(10, w)) : 1;
    for (const [k, v] of uvec.entries()) {
      recentVec.set(k, (recentVec.get(k) || 0) + v * mul);
    }
  }
  const scored = [];
  for (const e of candidates) {
    const txt = `${e.title || ''}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${e.summary || ''}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${(Array.isArray(e.keywords) ? e.keywords.join(' ') : '')}`;
    const vec = tokenizeForSimilarity(txt);
    const score = cosineSimilarity(recentVec, vec);
    if (score >= minScore) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return applyIndexTypeLimits(scored, ensureSettings(), maxEntries);
}

function buildIndexPromptMessages(recentText, userText, candidatesForModel, maxPick) {
  const s = ensureSettings();
  const maxCharacters = clampInt(s.wiTriggerMaxCharacters, 0, 10, 2);
  const maxEquipments = clampInt(s.wiTriggerMaxEquipments, 0, 10, 2);
  const maxFactions = clampInt(s.wiTriggerMaxFactions, 0, 10, 2);
  const maxAchievements = clampInt(s.wiTriggerMaxAchievements, 0, 10, 2);
  const maxSubProfessions = clampInt(s.wiTriggerMaxSubProfessions, 0, 10, 2);
  const maxQuests = clampInt(s.wiTriggerMaxQuests, 0, 10, 2);
  const maxPlot = clampInt(s.wiTriggerMaxPlot, 0, 10, 3);

  const sys = String(s.wiIndexSystemPrompt || DEFAULT_INDEX_SYSTEM_PROMPT).trim() || DEFAULT_INDEX_SYSTEM_PROMPT;
  const tmpl = String(s.wiIndexUserTemplate || DEFAULT_INDEX_USER_TEMPLATE).trim() || DEFAULT_INDEX_USER_TEMPLATE;

  const candidatesJson = JSON.stringify(candidatesForModel, null, 0);
  const replaceTokens = (str) => String(str || '')
    .replaceAll('{{userMessage}}', String(userText || ''))
    .replaceAll('{{recentText}}', String(recentText || ''))
    .replaceAll('{{candidates}}', candidatesJson)
    .replaceAll('{{maxPick}}', String(maxPick))
    .replaceAll('{{maxCharacters}}', String(maxCharacters))
    .replaceAll('{{maxEquipments}}', String(maxEquipments))
    .replaceAll('{{maxFactions}}', String(maxFactions))
    .replaceAll('{{maxAchievements}}', String(maxAchievements))
    .replaceAll('{{maxSubProfessions}}', String(maxSubProfessions))
    .replaceAll('{{maxQuests}}', String(maxQuests))
    .replaceAll('{{maxPlot}}', String(maxPlot));

  const user = replaceTokens(tmpl);
  const enforced = user + `

` + INDEX_JSON_REQUIREMENT.replaceAll('maxPick', String(maxPick));

  return [
    { role: 'system', content: replaceTokens(sys) },
    { role: 'user', content: enforced },
  ];
}

async function pickRelevantIndexEntriesLLM(recentText, userText, candidates, maxEntries, includeUser, userWeight) {
  const s = ensureSettings();

  const candMaxChars = clampInt(s.wiIndexCandidateMaxChars, 120, 2000, 420);

  const shortlist = candidates.map(e => ({ e, score: 0 }));

  const candidatesForModel = shortlist.map((x, i) => {
    const e = x.e || x;
    const title = String(e.title || '').trim();
    const summary0 = String(e.summary || '').trim();
    const summary = summary0.length > candMaxChars ? (summary0.slice(0, candMaxChars) + '�?) : summary0;
    const kws = Array.isArray(e.keywords) ? e.keywords.slice(0, 24) : [];
    const name = title || '条目';
    return { id: i, name, title: name, summary, keywords: kws, type: normalizeIndexEntryType(e, s) };
  });

  const messages = buildIndexPromptMessages(recentText, userText, candidatesForModel, maxEntries);

  let jsonText = '';
  if (String(s.wiIndexProvider || 'st') === 'custom') {
    jsonText = await callViaCustom(
      s.wiIndexCustomEndpoint,
      s.wiIndexCustomApiKey,
      s.wiIndexCustomModel,
      messages,
      clampFloat(s.wiIndexTemperature, 0, 2, 0.2),
      clampInt(s.wiIndexCustomMaxTokens, 128, 200000, 1024),
      clampFloat(s.wiIndexTopP, 0, 1, 0.95),
      !!s.wiIndexCustomStream
    );
    const parsedTry = safeJsonParse(jsonText);
    if (!parsedTry || !Array.isArray(parsedTry?.pickedIds)) {
      try {
        jsonText = await fallbackAskJsonCustom(
          s.wiIndexCustomEndpoint,
          s.wiIndexCustomApiKey,
          s.wiIndexCustomModel,
          messages,
          clampFloat(s.wiIndexTemperature, 0, 2, 0.2),
          clampInt(s.wiIndexCustomMaxTokens, 128, 200000, 1024),
          clampFloat(s.wiIndexTopP, 0, 1, 0.95),
          !!s.wiIndexCustomStream
        );
      } catch { /* ignore */ }
    }
  } else {
    const schema = {
      type: 'object',
      properties: { pickedNames: { type: 'array', items: { type: 'string' } } },
      required: ['pickedNames'],
    };
    jsonText = await callViaSillyTavern(messages, schema, clampFloat(s.wiIndexTemperature, 0, 2, 0.2));
    if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
    const parsedTry = safeJsonParse(jsonText);
    if (!parsedTry || !Array.isArray(parsedTry?.pickedIds)) {
      jsonText = await fallbackAskJson(messages, clampFloat(s.wiIndexTemperature, 0, 2, 0.2));
    }
  }

  const parsed = safeJsonParse(jsonText);
  const pickedNames = Array.isArray(parsed?.pickedNames) ? parsed.pickedNames : [];
  const pickedIds = Array.isArray(parsed?.pickedIds) ? parsed.pickedIds : [];
  const uniqIds = Array.from(new Set(pickedIds.map(x => Number(x)).filter(n => Number.isFinite(n))));

  const nameToIndex = new Map();
  for (let i = 0; i < shortlist.length; i++) {
    const title = String(shortlist[i]?.e?.title || '').trim();
    if (!title) continue;
    const norm = title.toLowerCase();
    if (!nameToIndex.has(norm)) nameToIndex.set(norm, i);
  }

  const picked = [];
  const seenIdx = new Set();
  const pushByIndex = (idx) => {
    if (!Number.isFinite(idx)) return;
    if (seenIdx.has(idx)) return;
    const origin = shortlist[idx]?.e || null;
    if (!origin) return;
    seenIdx.add(idx);
    picked.push({ e: origin, score: Number(shortlist[idx]?.score || 0) });
  };

  for (const name of pickedNames) {
    const raw = String(name || '').trim();
    if (!raw) continue;
    const norm = raw.toLowerCase();
    if (nameToIndex.has(norm)) {
      pushByIndex(nameToIndex.get(norm));
      if (picked.length >= maxEntries) break;
      continue;
    }
    if (/^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;d+$/.test(norm)) {
      pushByIndex(Number(norm));
      if (picked.length >= maxEntries) break;
    }
  }

  if (picked.length < maxEntries) {
    for (const id of uniqIds) {
      pushByIndex(id);
      if (picked.length >= maxEntries) break;
    }
  }

  return applyIndexTypeLimits(picked, s, maxEntries);
}


async function maybeInjectWorldInfoTriggers(reason = 'msg_sent') {
  const s = ensureSettings();
  if (!s.wiTriggerEnabled) return;

  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  if (!chat.length) return;

  const last = chat[chat.length - 1];
  if (!last || last.is_user !== true) return; // only on user send
  const lastText = String(last.mes ?? last.message ?? '').trim();
  if (!lastText || lastText.startsWith('/')) return;
  if (lastText.includes(String(s.wiTriggerTag || 'SG_WI_TRIGGERS'))) return;

  // 仅在达到指定 AI 楼层后才开始索引触发（避免前期噪声/浪费�?
  const startAfter = clampInt(s.wiTriggerStartAfterAssistantMessages, 0, 200000, 0);
  if (startAfter > 0) {
    const assistantFloors = computeFloorCount(chat, 'assistant');
    if (assistantFloors < startAfter) {
      // log (optional)
      appendWiTriggerLog({
        ts: Date.now(),
        reason: String(reason || 'msg_sent'),
        userText: lastText,
        skipped: true,
        skippedReason: 'minAssistantFloors',
        assistantFloors,
        startAfter,
      });
      const modalOpen = $('#sg_modal_backdrop').is(':visible');
      if (modalOpen || s.wiTriggerDebugLog) {
        setStatus(`索引未启动：AI 回复楼层 ${assistantFloors}/${startAfter}`, 'info');
      }
      return;
    }
  }

  const lookback = clampInt(s.wiTriggerLookbackMessages, 5, 120, 20);
  // 最近正文（不含本次用户输入）；为避免“触发词注入”污染相似度，先剔除�?tag 的注入片段�?
  const tagForStrip = String(s.wiTriggerTag || 'SG_WI_TRIGGERS').trim() || 'SG_WI_TRIGGERS';
  lastText = stripTriggerInjection(lastText, tagForStrip);
  const recentText = buildRecentChatText(chat, lookback, true, [tagForStrip, rollTag]);
  if (!recentText) return;

  const candidates = collectBlueIndexCandidates();
  if (!candidates.length) return;

  const maxEntries = clampInt(s.wiTriggerMaxEntries, 1, 20, 4);
  const minScore = clampFloat(s.wiTriggerMinScore, 0, 1, 0.08);
  const includeUser = !!s.wiTriggerIncludeUserMessage;
  const userWeight = clampFloat(s.wiTriggerUserMessageWeight, 0, 10, 1.6);
  const matchMode = String(s.wiTriggerMatchMode || 'local');
  let picked = [];
  if (matchMode === 'llm') {
    try {
      picked = await pickRelevantIndexEntriesLLM(recentText, lastText, candidates, maxEntries, includeUser, userWeight);
    } catch (e) {
      console.warn('[StoryGuide] index LLM failed; fallback to local similarity', e);
      picked = pickRelevantIndexEntries(recentText, lastText, candidates, maxEntries, minScore, includeUser, userWeight);
    }
  } else {
    picked = pickRelevantIndexEntries(recentText, lastText, candidates, maxEntries, minScore, includeUser, userWeight);
  }
  if (!picked.length) return;

  const maxKeywords = clampInt(s.wiTriggerMaxKeywords, 1, 200, 24);
  const kwSet = new Set();
  const pickedTitles = []; // debug display with score
  const pickedNames = [];  // entry names (等价于将触发的绿灯条目名�?
  const pickedForLog = [];
  for (const { e, score } of picked) {
    const name = String(e.title || '').trim() || '条目';
    pickedNames.push(name);
    pickedTitles.push(`${name}�?{score.toFixed(2)}）`);
    pickedForLog.push({
      title: name,
      score: Number(score),
      keywordsPreview: (Array.isArray(e.keywords) ? e.keywords.slice(0, 24) : []),
    });
    for (const k of (Array.isArray(e.keywords) ? e.keywords : [])) {
      const kk = String(k || '').trim();
      if (!kk) continue;
      kwSet.add(kk);
      if (kwSet.size >= maxKeywords) break;
    }
    if (kwSet.size >= maxKeywords) break;
  }
  const keywords = Array.from(kwSet);
  if (!keywords.length) return;

  const tag = tagForStrip;
  const style = String(s.wiTriggerInjectStyle || 'hidden').trim() || 'hidden';
  const cleaned = stripTriggerInjection(last.mes ?? last.message ?? '', tag);
  const injected = cleaned + buildTriggerInjection(keywords, tag, style);
  last.mes = injected;

  // append log (fire-and-forget)
  appendWiTriggerLog({
    ts: Date.now(),
    reason: String(reason || 'msg_sent'),
    userText: lastText,
    lookback,
    style,
    tag,
    picked: pickedForLog,
    injectedKeywords: keywords,
  });

  // try save
  try {
    if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
    else if (typeof ctx.saveChat === 'function') ctx.saveChat();
  } catch { /* ignore */ }

  // debug status (only when pane open or explicitly enabled)
  const modalOpen = $('#sg_modal_backdrop').is(':visible');
  if (modalOpen || s.wiTriggerDebugLog) {
    setStatus(`已注入触发词�?{keywords.slice(0, 12).join('�?)}${keywords.length > 12 ? '�? : ''}${s.wiTriggerDebugLog ? `｜命中：${pickedTitles.join('�?)}` : `｜将触发�?{pickedNames.slice(0, 4).join('�?)}${pickedNames.length > 4 ? '�? : ''}`}`, 'ok');
  }
}

// -------------------- inline append (dynamic modules) --------------------

function indentForListItem(md) {
  const s = String(md || '');
  const pad = '    '; // 4 spaces to ensure nested blocks stay inside the module card
  if (!s) return pad + '（空�?;
  return s.split('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n').map(line => pad + line).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

function normalizeNumberedHints(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const t = String(arr[i] ?? '').trim();
    if (!t) continue;
    // If the item already starts with 【n�? keep it; else prefix with 【i+1�?
    if (/^【\d+�?.test(t)) out.push(t);
    else out.push(`�?{i + 1}�?${t}`);
  }
  return out;
}

function buildInlineMarkdownFromModules(parsedJson, modules, mode, showEmpty) {
  // mode: compact|standard
  const lines = [];
  lines.push(`**剧情指导**`);

  for (const m of modules) {
    // quick_actions 模块不在 Markdown 中渲染，而是单独渲染为可点击按钮
    if (m.key === 'quick_actions') continue;

    const hasKey = parsedJson && Object.hasOwn(parsedJson, m.key);
    const val = hasKey ? parsedJson[m.key] : undefined;
    const title = m.title || m.key;

    if (m.type === 'list') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) {
        if (showEmpty) lines.push(`- **${title}**        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${indentForListItem('（空�?)}`);
        continue;
      }

      if (mode === 'compact') {
        const limit = Math.min(arr.length, 3);
        const picked = arr.slice(0, limit).map(x => String(x ?? '').trim()).filter(Boolean);
        lines.push(`- **${title}**
${indentForListItem(picked.join(' / '))}`);
      } else {
        // 标准模式：把整个列表合并到同一个模块卡片内（以�?】等为分隔提示）
        const normalized = normalizeNumberedHints(arr);
        const joined = normalized.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
        lines.push(`- **${title}**        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${indentForListItem(joined)}`);
      }
    } else {
      const text = (val !== undefined && val !== null) ? String(val).trim() : '';
      if (!text) {
        if (showEmpty) lines.push(`- **${title}**        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${indentForListItem('（空�?)}`);
        continue;
      }

      if (mode === 'compact') {
        const short = (text.length > 140 ? text.slice(0, 140) + '�? : text);
        lines.push(`- **${title}**
${indentForListItem(short)}`);
      } else {
        // 标准模式：把内容缩进�?list item 内，避免内部列表/编号变成“同级卡片�?
        lines.push(`- **${title}**        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${indentForListItem(text)}`);
      }
    }
  }

  return lines.join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
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

  const bind = (el, isFooter = false) => {
    if (!el) return;
    const flag = isFooter ? 'sgBoundFoot' : 'sgBound';
    if (el.dataset[flag] === '1') return;
    el.dataset[flag] = '1';

    el.addEventListener('click', (e) => {
      if (e.target && (e.target.closest('a'))) return;

      const cur = boxEl.classList.contains('collapsed');
      const next = !cur;
      setCollapsed(boxEl, next);

      const cached = inlineCache.get(String(mesKey));
      if (cached) {
        cached.collapsed = next;
        inlineCache.set(String(mesKey), cached);
      }

      // Footer button: collapse then scroll back to the message正文
      if (isFooter && next) {
        const mesEl = boxEl.closest('.mes');
        (mesEl || boxEl).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  bind(boxEl.querySelector('.sg-inline-head'), false);
  bind(boxEl.querySelector('.sg-inline-foot'), true);
}


function createInlineBoxElement(mesKey, htmlInner, collapsed, quickActions) {
  const box = document.createElement('div');
  box.className = 'sg-inline-box';
  box.dataset.sgMesKey = String(mesKey);

  // 只渲染AI生成的动态选项（不再使用静态配置的选项�?
  let quickOptionsHtml = '';
  if (Array.isArray(quickActions) && quickActions.length) {
    quickOptionsHtml = renderDynamicQuickActionsHtml(quickActions, 'inline');
  }

  box.innerHTML = `
    <div class="sg-inline-head" title="点击折叠/展开（不会自动生成）">
      <span class="sg-inline-badge">📘</span>
      <span class="sg-inline-title">剧情指导</span>
      <span class="sg-inline-sub">（剧情分析）</span>
      <span class="sg-inline-chevron">�?/span>
    </div>
    <div class="sg-inline-body">${htmlInner}</div>
    ${quickOptionsHtml}
    <div class="sg-inline-foot" title="点击折叠并回到正�?>
      <span class="sg-inline-foot-icon">�?/span>
      <span class="sg-inline-foot-text">收起并回到正�?/span>
      <span class="sg-inline-foot-icon">�?/span>
    </div>`.trim();

  setCollapsed(box, !!collapsed);
  attachToggleHandler(box, mesKey);
  return box;
}



function attachPanelToggleHandler(boxEl, mesKey) {
  if (!boxEl) return;

  const bind = (el, isFooter = false) => {
    if (!el) return;
    const flag = isFooter ? 'sgBoundFoot' : 'sgBound';
    if (el.dataset[flag] === '1') return;
    el.dataset[flag] = '1';

    el.addEventListener('click', (e) => {
      if (e.target && (e.target.closest('a'))) return;

      const cur = boxEl.classList.contains('collapsed');
      const next = !cur;
      setCollapsed(boxEl, next);

      const cached = panelCache.get(String(mesKey));
      if (cached) {
        cached.collapsed = next;
        panelCache.set(String(mesKey), cached);
      }

      if (isFooter && next) {
        const mesEl = boxEl.closest('.mes');
        (mesEl || boxEl).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  bind(boxEl.querySelector('.sg-panel-head'), false);
  bind(boxEl.querySelector('.sg-panel-foot'), true);
}


function createPanelBoxElement(mesKey, htmlInner, collapsed) {
  const box = document.createElement('div');
  box.className = 'sg-panel-box';
  box.dataset.sgMesKey = String(mesKey);

  // panel 模式暂不显示快捷选项（只�?inline 模式显示�?
  const quickOptionsHtml = '';

  box.innerHTML = `
    <div class="sg-panel-head" title="点击折叠/展开（面板分析结果）">
      <span class="sg-inline-badge">🧭</span>
      <span class="sg-inline-title">剧情指导</span>
      <span class="sg-inline-sub">（面板报告）</span>
      <span class="sg-inline-chevron">�?/span>
    </div>
    <div class="sg-panel-body">${htmlInner}</div>
    ${quickOptionsHtml}
    <div class="sg-panel-foot" title="点击折叠并回到正�?>
      <span class="sg-inline-foot-icon">�?/span>
      <span class="sg-inline-foot-text">收起并回到正�?/span>
      <span class="sg-inline-foot-icon">�?/span>
    </div>`.trim();

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
    md = '```text        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + md + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n```';
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
    // 更新动态选项（如果有变化�?
    const optionsContainer = existing.querySelector('.sg-dynamic-options');
    if (!optionsContainer && Array.isArray(cached.quickActions) && cached.quickActions.length) {
      const newOptionsHtml = renderDynamicQuickActionsHtml(cached.quickActions, 'inline');
      existing.querySelector('.sg-inline-body')?.insertAdjacentHTML('afterend', newOptionsHtml);
    }
    return true;
  }

  const box = createInlineBoxElement(mesKey, cached.htmlInner, cached.collapsed, cached.quickActions);
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
  // 手动按钮允许在关闭“自动追加”时也生�?
  if (!s.autoAppendBox && !allow) return;

  const ref = getLastAssistantMessageRef();
  if (!ref) return;

  const { mesKey } = ref;

  if (force) {
    inlineCache.delete(String(mesKey));
  }

  // 如果已经缓存过：非强制则只补贴一次；强制则重新请�?
  if (inlineCache.has(String(mesKey)) && !force) {
    ensureInlineBoxPresent(mesKey);
    return;
  }

  try {
    const { snapshotText } = buildSnapshot();

    const modules = getModules('append');
    // append �?schema �?inline 模块生成；如果用户把 inline 全关了，就不生成
    if (!modules.length) return;

    await updateMapFromSnapshot(snapshotText);

    // �?“compact/standard�?给一点暗示（不强制），避免用户模�?prompt 很长时没起作�?
    const modeHint = (s.appendMode === 'standard')
      ? `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【附加要求】inline 输出可比面板更短，但不要丢掉关键信息。\n`
      : `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【附加要求】inline 输出尽量短：每个字段尽量 1~2 �?2 条以内。\n`;

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
      // 解析失败：也把原文追加到聊天末尾，避免“有输出但看不到�?
      const raw = String(jsonText || '').trim();
      const rawMd = raw ? ('```text        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n' + raw + '        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n```') : '（空�?;
      const mdFail = `**剧情指导（解析失败）**        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${rawMd}`;
      const htmlInnerFail = renderMarkdownToHtml(mdFail);

      inlineCache.set(String(mesKey), { htmlInner: htmlInnerFail, collapsed: false, createdAt: Date.now() });
      requestAnimationFrame(() => { ensureInlineBoxPresent(mesKey); });
      setTimeout(() => ensureInlineBoxPresent(mesKey), 800);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 1800);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 3500);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 6500);
      return;
    }

    // 合并静态模块缓存（使用之前缓存的静态模块值）
    const mergedParsed = mergeStaticModulesIntoResult(parsed, modules);

    // 更新静态模块缓存（首次生成的静态模块会被缓存）
    updateStaticModulesCache(mergedParsed, modules).catch(() => void 0);

    const md = buildInlineMarkdownFromModules(mergedParsed, modules, s.appendMode, !!s.inlineShowEmpty);
    const htmlInner = renderMarkdownToHtml(md);

    // 提取 quick_actions 用于动态渲染可点击按钮
    const quickActions = Array.isArray(mergedParsed.quick_actions) ? mergedParsed.quick_actions : [];

    inlineCache.set(String(mesKey), { htmlInner, collapsed: false, createdAt: Date.now(), quickActions });

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
  $sel.append(`<option value="">（选择模型�?/option>`);
  (modelIds || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (selected && id === selected) opt.selected = true;
    $sel.append(opt);
  });
}


function fillSummaryModelSelect(modelIds, selected) {
  const $sel = $('#sg_summaryModelSelect');
  if (!$sel.length) return;
  $sel.empty();
  $sel.append(`<option value="">（选择模型�?/option>`);
  (modelIds || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (selected && id === selected) opt.selected = true;
    $sel.append(opt);
  });
}


function fillWorldbookSelect($sel, names, selected) {
  if (!$sel || !$sel.length) return;
  $sel.empty();
  $sel.append(`<option value="">(选择世界�?</option>`);
  (names || []).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (selected && name === selected) opt.selected = true;
    $sel.append(opt);
  });
}


function fillIndexModelSelect(modelIds, selected) {
  const $sel = $('#sg_wiIndexModelSelect');
  if (!$sel.length) return;
  $sel.empty();
  $sel.append(`<option value="">(选择模型)</option>`);
  (modelIds || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (selected && id === selected) opt.selected = true;
    $sel.append(opt);
  });
}


function fillRollModelSelect(modelIds, selected) {
  const $sel = $('#sg_wiRollModelSelect');
  if (!$sel.length) return;
  $sel.empty();
  $sel.append(`<option value="">(选择模型)</option>`);
  (modelIds || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (selected && id === selected) opt.selected = true;
    $sel.append(opt);
  });
}

function fillSexGuideModelSelect(modelIds, selected) {
  const $sel = $('#sg_sexModelSelect');
  if (!$sel.length) return;
  $sel.empty();
  $sel.append(`<option value="">(选择模型)</option>`);
  (modelIds || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (selected && id === selected) opt.selected = true;
    $sel.append(opt);
  });
}


async function refreshSummaryModels() {
  const s = ensureSettings();
  const raw = String($('#sg_summaryCustomEndpoint').val() || s.summaryCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('请先填写“总结独立API基础URL”再刷新模型', 'warn'); return; }

  setStatus('正在刷新“总结独立API”模型列表�?, 'warn');

  const apiKey = String($('#sg_summaryCustomApiKey').val() || s.summaryCustomApiKey || '');
  const statusUrl = '/api/backends/chat-completions/status';

  const body = {
    reverse_proxy: apiBase,
    chat_completion_source: 'custom',
    custom_url: apiBase,
    custom_include_headers: apiKey ? `Authorization: Bearer ${apiKey}` : ''
  };

  // prefer backend status (兼容 ST 后端代理)
  try {
    const headers = { ...getStRequestHeadersCompat(), 'Content-Type': 'application/json' };
    const res = await fetch(statusUrl, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`状态检查失�? HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
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

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) {
      setStatus('刷新成功，但未解析到模型列表（返回格式不兼容�?, 'warn');
      return;
    }

    s.summaryCustomModelsCache = ids;
    saveSettings();
    fillSummaryModelSelect(ids, s.summaryCustomModel);
    setStatus(`已刷新总结模型�?{ids.length} 个（后端代理）`, 'ok');
    return;
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) console.warn('[StoryGuide] summary status check failed; fallback to direct /models', e);
  }

  // fallback direct /models
  try {
    const modelsUrl = (function (base) {
      const u = normalizeBaseUrl(base);
      if (!u) return '';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1$/.test(u)) return u + '/models';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i.test(u)) return u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '') + '/models';
      return u + '/v1/models';
    })(apiBase);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { method: 'GET', headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`直连 /models 失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('直连刷新失败：未解析到模型列�?, 'warn'); return; }

    s.summaryCustomModelsCache = ids;
    saveSettings();
    fillSummaryModelSelect(ids, s.summaryCustomModel);
    setStatus(`已刷新总结模型�?{ids.length} 个（直连 fallback）`, 'ok');
  } catch (e) {
    setStatus(`刷新总结模型失败�?{e?.message ?? e}`, 'err');
  }
}

async function refreshWorldbookList() {
  const s = ensureSettings();
  setStatus('正在读取酒馆世界书列表�?, 'warn');
  try {
    const names = await fetchWorldInfoListCompat();
    if (!names.length) {
      setStatus('未能从后端读取世界书列表（该版本可能未开放列表接口），请手动填写名称', 'warn');
      return;
    }
    s.summaryWorldInfoFilesCache = names;
    saveSettings();
    fillWorldbookSelect($('#sg_summaryWorldbookSelect'), names, normalizeWorldInfoFileName(s.summaryWorldInfoFile));
    fillWorldbookSelect($('#sg_summaryBlueWorldbookSelect'), names, normalizeWorldInfoFileName(s.summaryBlueWorldInfoFile));
    setStatus(`已刷新世界书列表�?{names.length} 本`, 'ok');
  } catch (e) {
    setStatus(`刷新世界书列表失败：${e?.message ?? e}`, 'err');
  }
}

async function refreshSexGuideModels() {
  const s = ensureSettings();
  const raw = String($('#sg_sexCustomEndpoint').val() || s.sexGuideCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setSexGuideStatus('请先填写“性爱指导独立API基础URL”再刷新模型', 'warn'); return; }

  setSexGuideStatus('正在刷新“性爱指导独立API”模型列表�?, 'warn');

  const apiKey = String($('#sg_sexCustomApiKey').val() || s.sexGuideCustomApiKey || '');
  const statusUrl = '/api/backends/chat-completions/status';

  const body = {
    reverse_proxy: apiBase,
    chat_completion_source: 'custom',
    custom_url: apiBase,
    custom_include_headers: apiKey ? `Authorization: Bearer ${apiKey}` : ''
  };

  try {
    const headers = { ...getStRequestHeadersCompat(), 'Content-Type': 'application/json' };
    const res = await fetch(statusUrl, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`状态检查失�? HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
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

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) {
      setSexGuideStatus('刷新成功，但未解析到模型列表（返回格式不兼容�?, 'warn');
      return;
    }

    s.sexGuideCustomModelsCache = ids;
    saveSettings();
    fillSexGuideModelSelect(ids, s.sexGuideCustomModel);
    setSexGuideStatus(`已刷新性爱指导模型�?{ids.length} 个（后端代理）`, 'ok');
    return;
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) console.warn('[StoryGuide] sex guide status check failed; fallback to direct /models', e);
  }

  try {
    const modelsUrl = (function (base) {
      const u = normalizeBaseUrl(base);
      if (!u) return '';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1$/.test(u)) return u + '/models';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i.test(u)) return u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '') + '/models';
      return u + '/v1/models';
    })(apiBase);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { method: 'GET', headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`直连 /models 失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setSexGuideStatus('直连刷新失败：未解析到模型列�?, 'warn'); return; }

    s.sexGuideCustomModelsCache = ids;
    saveSettings();
    fillSexGuideModelSelect(ids, s.sexGuideCustomModel);
    setSexGuideStatus(`已刷新性爱指导模型�?{ids.length} 个（直连 fallback）`, 'ok');
  } catch (e) {
    setSexGuideStatus(`刷新性爱指导模型失败�?{e?.message ?? e}`, 'err');
  }
}


async function refreshIndexModels() {
  const s = ensureSettings();
  const raw = String($('#sg_wiIndexCustomEndpoint').val() || s.wiIndexCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('请先填写“索引独立API基础URL”再刷新模型', 'warn'); return; }

  setStatus('正在刷新“索引独立API”模型列表�?, 'warn');

  const apiKey = String($('#sg_wiIndexCustomApiKey').val() || s.wiIndexCustomApiKey || '');
  const statusUrl = '/api/backends/chat-completions/status';

  const body = {
    reverse_proxy: apiBase,
    chat_completion_source: 'custom',
    custom_url: apiBase,
    custom_include_headers: apiKey ? `Authorization: Bearer ${apiKey}` : ''
  };

  try {
    const headers = { ...getStRequestHeadersCompat(), 'Content-Type': 'application/json' };
    const res = await fetch(statusUrl, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`状态检查失�? HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
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

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) {
      setStatus('刷新成功，但未解析到模型列表（返回格式不兼容�?, 'warn');
      return;
    }

    s.wiIndexCustomModelsCache = ids;
    saveSettings();
    fillIndexModelSelect(ids, s.wiIndexCustomModel);
    setStatus(`已刷新索引模型：${ids.length} 个（后端代理）`, 'ok');
    return;
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) console.warn('[StoryGuide] index status check failed; fallback to direct /models', e);
  }

  try {
    const modelsUrl = (function (base) {
      const u = normalizeBaseUrl(base);
      if (!u) return '';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1$/.test(u)) return u + '/models';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i.test(u)) return u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '') + '/models';
      return u + '/v1/models';
    })(apiBase);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { method: 'GET', headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`直连 /models 失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('直连刷新失败：未解析到模型列�?, 'warn'); return; }

    s.wiIndexCustomModelsCache = ids;
    saveSettings();
    fillIndexModelSelect(ids, s.wiIndexCustomModel);
    setStatus(`已刷新索引模型：${ids.length} 个（直连 fallback）`, 'ok');
  } catch (e) {
    setStatus(`刷新索引模型失败�?{e?.message ?? e}`, 'err');
  }
}



async function refreshRollModels() {
  const s = ensureSettings();
  const raw = String($('#sg_wiRollCustomEndpoint').val() || s.wiRollCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('请先填写"ROLL独立API基础URL"再刷新模�?, 'warn'); return; }

  setStatus('正在刷新"ROLL独立API"模型列表�?, 'warn');

  const apiKey = String($('#sg_wiRollCustomApiKey').val() || s.wiRollCustomApiKey || '');
  const statusUrl = '/api/backends/chat-completions/status';

  const body = {
    reverse_proxy: apiBase,
    chat_completion_source: 'custom',
    custom_url: apiBase,
    custom_include_headers: apiKey ? `Authorization: Bearer ${apiKey}` : ''
  };

  try {
    const headers = { ...getStRequestHeadersCompat(), 'Content-Type': 'application/json' };
    const res = await fetch(statusUrl, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`状态检查失�? HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
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

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) {
      setStatus('刷新成功，但未解析到模型列表（返回格式不兼容�?, 'warn');
      return;
    }

    s.wiRollCustomModelsCache = ids;
    saveSettings();
    fillRollModelSelect(ids, s.wiRollCustomModel);
    setStatus(`已刷新ROLL模型�?{ids.length} 个（后端代理）`, 'ok');
    return;
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) console.warn('[StoryGuide] roll status check failed; fallback to direct /models', e);
  }

  try {
    const modelsUrl = (function (base) {
      const u = normalizeBaseUrl(base);
      if (!u) return '';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1$/.test(u)) return u + '/models';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i.test(u)) return u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '') + '/models';
      return u + '/v1/models';
    })(apiBase);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { method: 'GET', headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`直连 /models 失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('直连刷新失败：未解析到模型列�?, 'warn'); return; }

    s.wiRollCustomModelsCache = ids;
    saveSettings();
    fillRollModelSelect(ids, s.wiRollCustomModel);
    setStatus(`已刷新ROLL模型�?{ids.length} 个（直连 fallback）`, 'ok');
  } catch (e) {
    setStatus(`刷新ROLL模型失败�?{e?.message ?? e}`, 'err');
  }
}


// -------------------- 图像生成模块 --------------------

function getRecentStoryContent(count) {
  const chat = SillyTavern.getContext().chat || [];
  const messages = chat.slice(-count).filter(m => m.mes && !m.is_system);
  return messages.map(m => m.mes).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');
}

function setImageGenStatus(text, kind = '') {
  const $s = $('#sg_imageGenStatus');
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
}

function closeImagePreviewModal() {
  $('#sg_image_preview_backdrop').removeClass('show');
  $('body').removeClass('sg-image-preview-open');
}

function openImagePreviewModal(src, altText = 'Image preview') {
  if (!src) return;
  if (!$('#sg_image_preview_backdrop').length) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="sg_image_preview_backdrop" class="sg-image-preview-backdrop">
        <div class="sg-image-preview-panel">
          <button class="sg-image-preview-close" type="button" aria-label="Close">×</button>
          <img id="sg_image_preview_img" alt="${escapeHtml(altText)}">
        </div>
      </div>
    `);

    $('#sg_image_preview_backdrop').on('click', (e) => {
      if (e.target && e.target.id === 'sg_image_preview_backdrop') closeImagePreviewModal();
    });

    $(document).on('keydown', (e) => {
      if (e.key === 'Escape') closeImagePreviewModal();
    });

    $(document).on('click', '#sg_image_preview_backdrop .sg-image-preview-close', (e) => {
      e.preventDefault();
      closeImagePreviewModal();
    });
  }

  $('#sg_image_preview_img').attr('src', src);
  $('#sg_image_preview_img').attr('alt', altText || 'Image preview');
  $('#sg_image_preview_backdrop').addClass('show');
  $('body').addClass('sg-image-preview-open');
}


// 通用 LLM 调用函数（使用图像生成模块独�?API�?
async function callLLM(messages, opts = {}) {
  const s = ensureSettings();
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.max_tokens ?? s.imageGenCustomMaxTokens ?? 1024;


  // 使用图像生成模块独立�?API 配置
  const endpoint = s.imageGenCustomEndpoint || '';
  const apiKey = s.imageGenCustomApiKey || '';
  const model = s.imageGenCustomModel || 'gpt-4o-mini';

  if (!endpoint) {
    throw new Error('请先在「图像生成」标签页配置 LLM API 基础URL');
  }

  return await callViaCustom(endpoint, apiKey, model, messages, temperature, maxTokens, 0.95, false);
}

// 刷新图像生成 LLM 模型列表
async function refreshImageGenModels() {
  const s = ensureSettings();
  const raw = String($('#sg_imageGenCustomEndpoint').val() || s.imageGenCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setImageGenStatus('请先填写 LLM API 基础URL', 'warn'); return; }

  setImageGenStatus('正在刷新模型列表�?, 'warn');

  try {
    const apiKey = String($('#sg_imageGenCustomApiKey').val() || s.imageGenCustomApiKey || '').trim();
    const url = apiBase + '/v1/models';
    const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const models = (data.data || data.models || data || [])
      .map(m => typeof m === 'string' ? m : (m.id || m.name || ''))
      .filter(Boolean)
      .sort();

    if (!models.length) { setImageGenStatus('未找到可用模�?, 'warn'); return; }

    const $sel = $('#sg_imageGenCustomModel');
    const cur = $sel.val();
    $sel.empty();
    for (const m of models) {
      $sel.append($('<option>').val(m).text(m));
    }
    if (models.includes(cur)) $sel.val(cur);
    else if (models.length) $sel.val(models[0]);

    pullUiToSettings(); saveSettings();
    setImageGenStatus(`�?已加�?${models.length} 个模型`, 'ok');
  } catch (e) {
    console.error('[ImageGen] Refresh models failed:', e);
    setImageGenStatus(`�?刷新失败: ${e?.message || e}`, 'err');
  }
}

function normalizeCharacterProfiles(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getCharacterProfilesFromSettings(options = {}) {
  const s = ensureSettings();
  const list = normalizeCharacterProfiles(s.imageGenCharacterProfiles);
  const mapped = list.map((entry) => ({
    name: String(entry?.name || '').trim(),
    keys: Array.isArray(entry?.keys) ? entry.keys.map(k => String(k || '').toLowerCase().trim()).filter(Boolean) : [],
    tags: String(entry?.tags || '').trim(),
    enabled: entry?.enabled !== false
  }));
  if (options.includeEmpty) {
    return mapped.filter(entry => entry.name || entry.tags || (entry.keys && entry.keys.length));
  }
  return mapped.filter(entry => entry.name && entry.tags);
}

function renderCharacterProfilesUi() {
  const s = ensureSettings();
  const list = getCharacterProfilesFromSettings({ includeEmpty: true });
  const $wrap = $('#sg_imageGenProfiles');
  if (!$wrap.length) return;
  if (!list.length) {
    $wrap.html('<div class="sg-hint">暂无人物形象，点击“添加人物”创建�?/div>');
    return;
  }

  const rows = list.map((entry, idx) => {
    const keys = (entry.keys || []).join(', ');
    return `
      <div class="sg-profile-row" data-index="${idx}">
        <div class="sg-grid2">
          <div class="sg-field">
            <label>人物�?/label>
            <input type="text" class="sg-profile-name" value="${escapeHtml(entry.name)}">
          </div>
          <div class="sg-field">
            <label>关键词（逗号分隔�?/label>
            <input type="text" class="sg-profile-keys" value="${escapeHtml(keys)}">
          </div>
        </div>
        <div class="sg-field" style="margin-top:6px;">
          <label>形象标签</label>
          <textarea rows="3" class="sg-profile-tags" placeholder="1girl, silver hair, ...">${escapeHtml(entry.tags)}</textarea>
        </div>
        <div class="sg-row sg-inline" style="margin-top:6px; gap:12px;">
          <label class="sg-check"><input type="checkbox" class="sg-profile-enabled" ${entry.enabled ? 'checked' : ''}>启用</label>
          <button class="menu_button sg-btn sg-profile-delete" type="button">删除</button>
        </div>
      </div>
    `;
  }).join('');
  $wrap.html(rows);
}

function collectCharacterProfilesFromUi() {
  const list = [];
  $('#sg_imageGenProfiles .sg-profile-row').each((_, el) => {
    const $row = $(el);
    const name = String($row.find('.sg-profile-name').val() || '').trim();
    const keysRaw = String($row.find('.sg-profile-keys').val() || '').trim();
    const tags = String($row.find('.sg-profile-tags').val() || '').trim();
    const enabled = $row.find('.sg-profile-enabled').is(':checked');
    if (!name && !tags && !keysRaw) return;
    const keys = keysRaw
      .split(',')
      .map(k => String(k || '').toLowerCase().trim())
      .filter(Boolean);
    list.push({ name, keys, tags, enabled });
  });
  return list;
}

function matchCharacterTagsFromProfiles(textOverride = null) {
  const s = ensureSettings();
  if (!s.imageGenCharacterProfilesEnabled) return '';
  const entries = getCharacterProfilesFromSettings();
  if (!entries.length) return '';

  let storyContent = textOverride;
  if (!storyContent) {
    const lookback = s.imageGenLookbackMessages || 5;
    storyContent = getRecentStoryContent(lookback);
  }

  const text = String(storyContent || '').toLowerCase();
  const matched = [];

  for (const entry of entries) {
    if (!entry.enabled) continue;
    const nameMatch = entry.name && text.includes(entry.name.toLowerCase());
    const keyMatch = entry.keys?.some(k => text.includes(k));
    if (nameMatch || keyMatch) matched.push(entry);
  }

  if (!matched.length) return '';

  const allTags = matched.map(e => e.tags).join(', ');
  console.log('[ImageGen] Matched profiles:', matched.map(e => e.name));
  return allTags;
}


function getImageGenBatchPatterns() {
  const s = ensureSettings();
  const raw = String(s.imageGenBatchPatterns || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, i) => ({
      label: String(item?.label || `�?{i + 1}`),
      type: String(item?.type || 'character'),
      detail: String(item?.detail || '').trim()
    }));
  } catch {
    return [];
  }
}

function splitStoryIntoParts(text, count) {
  const clean = String(text || '').trim();
  if (!clean) return Array(count).fill('');
  const paras = clean.split(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paras.length >= count) return paras.slice(0, count);
  const parts = [];
  const total = clean.length;
  const chunk = Math.max(1, Math.floor(total / count));
  for (let i = 0; i < count; i += 1) {
    const start = i * chunk;
    const end = i === count - 1 ? total : Math.min(total, (i + 1) * chunk);
    parts.push(clean.slice(start, end).trim());
  }
  return parts;
}




function getBatchDistinctHint(index, total) {
  if (!Number.isFinite(index)) return '';
  const hints = [
    '使用近景构图，强调面部表�?,
    '使用中景构图，强调姿态与动作',
    '使用互动构图，强调人物关�?,
    '使用远景构图，强调环境与气氛',
    '使用趣味构图，强调轻松彩蛋动�?,
    '使用全身构图，强调姿态与服装',
    '使用对战构图，强调动感与张力',
    '使用对话构图，强调视线互�?,
    '使用场景构图，强调空间层�?,
    '使用光影构图，强调氛�?,
    '使用情绪构图，强调情�?,
    '使用静态构图，强调安静氛围'
  ];
  return hints[index % hints.length];
}

function renderImageGenBatchPreview() {
  const s = ensureSettings();
  const $wrap = $('#sg_imagegen_batch');
  if (!$wrap.length) return;
  if (!imageGenBatchPrompts.length) {
    const status = imageGenBatchBusy ? '生成中�? : (imageGenBatchStatus || '尚未生成提示�?);
    $wrap.html(`
      <div class="sg-floating-row">
        <div class="sg-floating-title-sm">提示词预�?/div>
        <div class="sg-floating-status">${escapeHtml(status)}</div>
      </div>
      <div class="sg-floating-empty">尚未生成提示�?/div>
    `);
    return;
  }

  const current = imageGenBatchPrompts[imageGenPreviewIndex] || imageGenBatchPrompts[0];
  const counter = `${imageGenPreviewIndex + 1}/${imageGenBatchPrompts.length}`;
  const status = imageGenBatchBusy ? '生成中�? : (imageGenBatchStatus || '就绪');
  const imgUrl = imageGenImageUrls[imageGenPreviewIndex] || '';
  const imgHtml = imgUrl
    ? `<img class="sg-floating-image sg-image-zoom" src="${escapeHtml(imgUrl)}" data-full="${escapeHtml(imgUrl)}" alt="Generated" style="cursor: zoom-in;" />`
    : '<div class="sg-floating-empty">暂无图像</div>';
  const regenDisabled = (!imgUrl || imageGenBatchBusy) ? 'disabled' : '';
  const model = String(s.novelaiModel || DEFAULT_SETTINGS.novelaiModel || 'nai-diffusion-4-5-full');
  const resolution = String(s.novelaiResolution || '832x1216');
  const steps = s.novelaiSteps || 28;
  const scale = s.novelaiScale || 5;
  const sampler = String(s.novelaiSampler || (model.includes('diffusion-4') ? 'k_euler_ancestral' : 'k_euler'));
  const legacy = model.includes('diffusion-4') ? (s.novelaiLegacy !== false) : true;
  const cfgRescale = clampFloat(s.novelaiCfgRescale, 0, 1, 0);
  const noiseSchedule = String(s.novelaiNoiseSchedule || 'native');
  const varietyBoost = s.novelaiVarietyBoost ? '开' : '�?;
  const seedLabel = s.novelaiFixedSeedEnabled ? `固定:${clampInt(s.novelaiFixedSeed, 0, 4294967295, 0)}` : '随机';
  const negative = String((s.novelaiNegativePrompt || '').trim());
  const negativePreview = negative ? `${negative.slice(0, 160)}${negative.length > 160 ? '�? : ''}` : '（空�?;
  const legacyLabel = legacy ? '开' : '�?;
  const expandLabel = imageGenPreviewExpanded ? '折叠预览' : '展开预览';
  const previewHiddenClass = imageGenPreviewExpanded ? '' : 'sg-floating-preview-collapsed';
  const paramsHtml = `
    <div class="sg-floating-params ${previewHiddenClass}">
      <div><b>模型</b>�?{escapeHtml(model)}</div>
      <div><b>分辨�?/b>�?{escapeHtml(resolution)}</div>
      <div><b>Steps</b>�?{escapeHtml(String(steps))}�?b>Scale</b>�?{escapeHtml(String(scale))}</div>
      <div><b>Sampler</b>�?{escapeHtml(sampler)}�?b>Seed</b>�?{escapeHtml(seedLabel)}�?b>Legacy</b>�?{escapeHtml(legacyLabel)}</div>
      <div><b>CFG Rescale</b>�?{escapeHtml(String(cfgRescale))}�?b>Noise</b>�?{escapeHtml(noiseSchedule)}�?b>Variety</b>�?{escapeHtml(varietyBoost)}</div>
      <div><b>负面</b>�?{escapeHtml(negativePreview)}</div>
    </div>
    <div class="sg-floating-row sg-floating-row-actions" style="margin-top:-2px;">
      <button class="sg-floating-mini-btn" id="sg_imagegen_toggle_preview">${escapeHtml(expandLabel)}</button>
      <button class="sg-floating-mini-btn" id="sg_imagegen_copy_payload">复制请求参数</button>
    </div>
  `;
  $wrap.html(`
    <div class="sg-floating-row">
      <div class="sg-floating-title-sm">提示词预览（${escapeHtml(counter)}�?/div>
      <div class="sg-floating-status">${escapeHtml(status)}</div>
    </div>
    <div class="sg-floating-prompt">${escapeHtml(String(current.positive || ''))}</div>
    ${paramsHtml}
    <div class="sg-floating-row sg-floating-row-actions">
      <button class="sg-floating-mini-btn" id="sg_imagegen_prev">◀</button>
      <button class="sg-floating-mini-btn" id="sg_imagegen_next">�?/button>
      <div class="sg-floating-spacer"></div>
      <button class="sg-floating-mini-btn" id="sg_imagegen_regen" ${regenDisabled}>重生�?/button>
      <button class="sg-floating-mini-btn" id="sg_imagegen_clear">清空</button>
    </div>
    <div class="sg-floating-image-wrap">${imgHtml}</div>
    <div class="sg-floating-row sg-floating-row-actions" style="margin-top:6px;">
      <button class="sg-floating-mini-btn" id="sg_imagegen_download">下载图像</button>
    </div>
  `);


  if (!imgUrl) $('#sg_imagegen_regen').prop('disabled', true);
}

async function generateImagePromptBatch() {
  const s = ensureSettings();
  if (!s.imageGenBatchEnabled) return [];

  const lookback = s.imageGenLookbackMessages || 5;
  let storyContent = getRecentStoryContent(lookback);
  if (s.imageGenPromptRulesEnabled && s.imageGenPromptRules) {
    storyContent = applyPromptRules(storyContent, s.imageGenPromptRules);
  }
  if (!storyContent.trim()) throw new Error('没有找到对话内容');

  let statData = null;
  if (s.imageGenReadStatData) {
    try {
      const ctx = SillyTavern.getContext();
      const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
      const { statData: loaded } = await resolveStatDataComprehensive(chat, {
        ...s,
        wiRollStatVarName: s.imageGenStatVarName || 'stat_data'
      });
      if (loaded) {
        statData = loaded;
        console.log('[ImageGen] Loaded stat_data for image batch prompt:', statData);
      }
    } catch (e) {
      console.warn('[ImageGen] Failed to load stat_data for image batch prompt:', e);
    }
  }

  const statDataJson = statData ? JSON.stringify(statData, null, 2) : '';
  const globalProfileTags = matchCharacterTagsFromProfiles(storyContent);

  const patterns = getImageGenBatchPatterns();
  if (!patterns.length) throw new Error('未配置批次模�?);

  const storyParts = splitStoryIntoParts(storyContent, 5);
  const results = [];

  let batchPrompt = `请根据以下故事内容生成一组图像提示词列表（JSON 数组）。\n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  if (statDataJson) {
    batchPrompt += `【角色状态数据】：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${statDataJson}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  }

  batchPrompt += `需要生�?${patterns.length} 组，每组输出 JSON 对象：{ "label":"", "type":"", "subject":"", "positive":"", "negative":"" }。\n`;
  batchPrompt += `要求：只输出 JSON 数组，不要其它文字。positive/negative 必须是英文标签串（逗号分隔）。\n`;

  const patternLines = patterns.map((pattern, idx) => {
    let rule = '';
    if (pattern.type === 'story') {
      const part = storyParts[idx] || storyContent;
      rule = `剧情代表性画面。剧情片段：${part}`;
    } else if (pattern.type === 'character_close') {
      rule = '单人女性近景特写，强调脸部与表情�?;
    } else if (pattern.type === 'character_full') {
      rule = '单人女性全身立绘，展示服装与姿态�?;
    } else if (pattern.type === 'duo') {
      rule = '双人同框互动，突出动作关系与情绪交流；即使剧情没有双人也要生成双人构图�?;
    } else if (pattern.type === 'scene') {
      rule = '场景图提示词，重点描述环境和氛围�?;
    } else if (pattern.type === 'custom_female_1') {
      const custom = String(s.imageGenCustomFemalePrompt1 || '').trim();
      rule = `女性角色提示词，融合自定义描述�?{custom || '（空�?}`;
    } else if (pattern.type === 'custom_female_2') {
      const custom = String(s.imageGenCustomFemalePrompt2 || '').trim();
      rule = `女性角色提示词，融合自定义描述�?{custom || '（空�?}`;
    } else {
      rule = '彩蛋图提示词，使用当前角�?场景，但内容与剧情不同�?;
    }
    const distinctHint = getBatchDistinctHint(idx, patterns.length);
    const detail = pattern.detail ? `细化�?{pattern.detail}` : '';
    const hint = distinctHint ? `构图提示�?{distinctHint}` : '';
    const parts = [rule, hint, detail].filter(Boolean).join(' | ');
    return `${idx + 1}. label=${pattern.label}, type=${pattern.type} => ${parts}`;
  }).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');

  batchPrompt += `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【模板列表】：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${patternLines}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  batchPrompt += `        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【故事内容】：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${storyContent}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;

  const messages = [
    { role: 'system', content: s.imageGenSystemPrompt || DEFAULT_SETTINGS.imageGenSystemPrompt },
    { role: 'user', content: batchPrompt }
  ];

  const result = await callLLM(messages, { temperature: 0.7 });
  let parsedList;
  try {
    const jsonMatch = result.match(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;[[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;]/);
    if (jsonMatch) parsedList = JSON.parse(jsonMatch[0]);
  } catch {
    parsedList = null;
  }

  if (!Array.isArray(parsedList)) {
    throw new Error('批量提示词解析失败，请重�?);
  }

  for (let i = 0; i < patterns.length; i += 1) {
    const pattern = patterns[i];
    const parsed = parsedList[i] || {};
    const positive = parsed?.positive || '';
    const negative = parsed?.negative || '';
    const isScene = (parsed?.type === 'scene' || pattern.type === 'scene');

    let finalPositive = positive || '';

    if (!isScene) {
      // For story type, try to match profile from the specific part
      let itemProfileTags = globalProfileTags;
      if (pattern.type === 'story' && storyParts[i]) {
        const partMatch = matchCharacterTagsFromProfiles(storyParts[i]);
        if (partMatch) itemProfileTags = partMatch;
      }

      if (itemProfileTags) finalPositive = `${itemProfileTags}, ${finalPositive}`;
    }

    if (s.imageGenArtistPromptEnabled && s.imageGenArtistPrompt) {
      const artist = String(s.imageGenArtistPrompt || '').trim();
      if (artist) finalPositive = `${artist}, ${finalPositive}`;
    }

    results.push({
      label: parsed?.label || pattern.label,
      type: parsed?.type || pattern.type,
      positive: finalPositive || positive || '',
      negative: negative || '',
      subject: parsed?.subject || ''
    });
  }

  return results;

}

async function generateImageFromBatch() {
  const s = ensureSettings();
  if (!imageGenBatchPrompts.length) {
    imageGenBatchStatus = '未生成提示词';
    renderImageGenBatchPreview();
    return;
  }
  if (imageGenBatchIndex >= imageGenBatchPrompts.length) imageGenBatchIndex = 0;

  const item = imageGenBatchPrompts[imageGenBatchIndex];
  imageGenBatchBusy = true;
  imageGenBatchStatus = `生成中：${item.label}`;
  renderImageGenBatchPreview();

  try {
    const url = await generateImageWithNovelAI(item.positive, item.negative);
    imageGenImageUrls[imageGenBatchIndex] = url;
    imageGenPreviewIndex = imageGenBatchIndex;
    imageGenBatchStatus = `已生成：${item.label}`;
    imageGenBatchIndex = (imageGenBatchIndex + 1) % imageGenBatchPrompts.length;
  } catch (e) {
    imageGenBatchStatus = `生成失败�?{e?.message || e}`;
  } finally {
    imageGenBatchBusy = false;
    renderImageGenBatchPreview();
  }
}

async function generateAllImagesFromBatch() {
  if (!imageGenBatchPrompts.length) {
    imageGenBatchStatus = '未生成提示词';
    renderImageGenBatchPreview();
    return;
  }
  if (imageGenBatchBusy) return;

  imageGenBatchBusy = true;
  for (let i = 0; i < imageGenBatchPrompts.length; i += 1) {
    const item = imageGenBatchPrompts[i];
    imageGenBatchStatus = `生成中：${item.label} (${i + 1}/${imageGenBatchPrompts.length})`;
    imageGenPreviewIndex = i;
    renderImageGenBatchPreview();
    try {
      const url = await generateImageWithNovelAI(item.positive, item.negative);
      imageGenImageUrls[i] = url;
      imageGenBatchStatus = `已生成：${item.label} (${i + 1}/${imageGenBatchPrompts.length})`;
      renderImageGenBatchPreview();
    } catch (e) {
      imageGenBatchStatus = `生成失败�?{item.label} (${i + 1}/${imageGenBatchPrompts.length})`;
      renderImageGenBatchPreview();
      break;
    }
  }
  imageGenBatchBusy = false;
  renderImageGenBatchPreview();
}


function clearImageGenBatch() {
  imageGenBatchPrompts = [];
  imageGenImageUrls = [];
  imageGenBatchIndex = 0;
  imageGenPreviewIndex = 0;
  imageGenBatchStatus = '已清�?;
  renderImageGenBatchPreview();
}


async function generateImagePromptWithLLM(storyContent, genType, statData = null) {
  const s = ensureSettings();
  const systemPrompt = s.imageGenSystemPrompt || DEFAULT_SETTINGS.imageGenSystemPrompt;

  const statDataJson = statData ? JSON.stringify(statData, null, 2) : '';
  let userPrompt = `请根据以下故事内容生成图像提示词。\n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  if (genType === 'character') {
    userPrompt += `【要求】：生成角色立绘的提示词，重点描述角色外观。\n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  } else if (genType === 'scene') {
    userPrompt += `【要求】：生成场景图的提示词，重点描述环境和氛围。\n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  } else {
    userPrompt += `【要求】：自动判断应该生成角色还是场景。\n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  }
  userPrompt += `【故事内容】：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${storyContent}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n`;
  userPrompt += `请输�?JSON 格式的提示词。`;


  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const result = await callLLM(messages, { temperature: 0.7 });


    let parsed;
    try {
      const jsonMatch = result.match(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('未找�?JSON');
      }
    } catch (e) {
      console.warn('[ImageGen] Failed to parse LLM response:', e, result);
      return { type: genType || 'auto', subject: '(解析失败)', positive: result.slice(0, 500), negative: '' };
    }

    return { type: parsed.type || genType || 'auto', subject: parsed.subject || '', positive: parsed.positive || '', negative: parsed.negative || '' };
  } catch (e) {
    console.error('[ImageGen] LLM call failed:', e);
    const errMsg = e?.message || String(e);
    if (errMsg.includes('not found') || errMsg.includes('404')) {
      throw new Error(`LLM 模型不存在，请点击「�?刷新模型」获取可用模型列表`);
    }
    throw new Error(`LLM 调用失败: ${errMsg}`);
  }
}

async function generateImageWithNovelAI(positive, negative) {
  const s = ensureSettings();
  const apiKey = s.novelaiApiKey;

  if (!apiKey) throw new Error('请先填写 Novel AI API Key');

  const [width, height] = (s.novelaiResolution || '832x1216').split('x').map(Number);
  const defaultNegative = s.novelaiNegativePrompt || DEFAULT_SETTINGS.novelaiNegativePrompt;
  const finalNegative = negative ? `${defaultNegative}, ${negative}` : defaultNegative;

  const model = String(s.novelaiModel || DEFAULT_SETTINGS.novelaiModel || 'nai-diffusion-4-5-full');
  const isV4 = model.includes('diffusion-4');
  const fixedSeedEnabled = !!s.novelaiFixedSeedEnabled;
  const fixedSeed = clampInt(s.novelaiFixedSeed, 0, 4294967295, 0);
  const seed = fixedSeedEnabled ? fixedSeed : Math.floor(Math.random() * 4294967295);
  const sampler = String(s.novelaiSampler || (isV4 ? 'k_euler_ancestral' : 'k_euler'));
  const legacy = isV4 ? (s.novelaiLegacy !== false) : true;
  const cfgRescale = clampFloat(s.novelaiCfgRescale, 0, 1, 0);
  const noiseSchedule = String(s.novelaiNoiseSchedule || 'native');
  const varietyBoost = !!s.novelaiVarietyBoost;


  // V4/V4.5 需要完全不同的参数格式
  let payload;

  if (isV4) {
    // V4/V4.5 格式 - 基于 novelai-python SDK
    payload = {
      input: positive,
      model: model,
      action: 'generate',
      parameters: {
        width: width || 832,
        height: height || 1216,
        scale: s.novelaiScale || 5,
        steps: s.novelaiSteps || 28,
        sampler: sampler,

        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        seed: seed,
        negative_prompt: finalNegative,
        // V4/V4.5 特有参数
        cfg_rescale: cfgRescale,
        sm: false,
        sm_dyn: false,
        noise_schedule: noiseSchedule,
        legacy: legacy,  // 启用以支�?V3 风格�?:: 权重语法
        legacy_v3_extend: false,
        skip_cfg_above_sigma: null,
        variety_boost: varietyBoost,

        decrisp_mode: false,
        use_coords: false,
        v4_prompt: {
          caption: {
            base_caption: positive,
            char_captions: []
          },
          use_coords: false,
          use_order: false
        },
        v4_negative_prompt: {
          caption: {
            base_caption: finalNegative,
            char_captions: []
          }
        }
      }
    };
  } else {
    // V3 格式
    payload = {
      input: positive,
      model: model,
      action: 'generate',
      parameters: {
        width: width || 832,
        height: height || 1216,
        scale: s.novelaiScale || 5,
        steps: s.novelaiSteps || 28,
        sampler: sampler,

        negative_prompt: finalNegative,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        seed: seed
      }
    };
  }

  setImageGenStatus('正在调用 Novel AI API 生成图像�?, 'warn');

  console.log('[ImageGen] NovelAI request params:', {
    model,
    width: width || 832,
    height: height || 1216,
    steps: s.novelaiSteps || 28,
    scale: s.novelaiScale || 5,
    sampler,
    seed,
    fixedSeedEnabled,
    legacy,
    cfgRescale,
    noiseSchedule,
    varietyBoost,
    negative: finalNegative,
    isV4
  });

  lastNovelaiPayload = payload;

  const response = await fetch('https://image.novelai.net/ai/generate-image', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/zip' },
    body: JSON.stringify(payload)
  });


  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Novel AI API 错误: ${response.status} ${response.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${errText}`);
  }

  const blob = await response.blob();

  // 尝试�?JSZip 解压
  try {
    if (typeof JSZip !== 'undefined') {
      const zip = await JSZip.loadAsync(blob);
      const files = Object.keys(zip.files);
      if (files.length > 0) {
        const imageBlob = await zip.files[files[0]].async('blob');
        return URL.createObjectURL(imageBlob);
      }
    }
  } catch (e) { console.warn('[ImageGen] JSZip failed:', e); }

  return URL.createObjectURL(blob);
}

async function runImageGeneration() {
  const s = ensureSettings();

  if (!s.novelaiApiKey) { setImageGenStatus('请先填写 Novel AI API Key', 'err'); return; }

  const genType = $('#sg_imageGenType').val() || 'auto';
  const lookback = s.imageGenLookbackMessages || 5;

  try {
    setImageGenStatus('正在读取最近对话�?, 'warn');
    let storyContent = getRecentStoryContent(lookback);
    if (s.imageGenPromptRulesEnabled && s.imageGenPromptRules) {
      storyContent = applyPromptRules(storyContent, s.imageGenPromptRules);
    }


    if (!storyContent.trim()) { setImageGenStatus('没有找到对话内容', 'err'); return; }

    setImageGenStatus('正在使用 LLM 生成图像提示词�?, 'warn');
    let statData = null;
    if (s.imageGenReadStatData) {
      try {
        const ctx = SillyTavern.getContext();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
        const { statData: loaded } = await resolveStatDataComprehensive(chat, {
          ...s,
          wiRollStatVarName: s.imageGenStatVarName || 'stat_data'
        });
        if (loaded) {
          statData = loaded;
          console.log('[ImageGen] Loaded stat_data for image prompt:', statData);
        }
      } catch (e) {
        console.warn('[ImageGen] Failed to load stat_data for image prompt:', e);
      }
    }
    const promptResult = await generateImagePromptWithLLM(storyContent, genType, statData);

    const normalizePositive = (text) => String(text || '')
      .replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, ' ')
      .replace(/^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*,+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*/g, '')
      .replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*,+        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s*$/g, '')
      .trim();

    const normalizeStatText = (data) => {
      if (!data) return '';
      try {
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    };

    const profileTags = (genType === 'scene' || promptResult.type === 'scene') ? '' : matchCharacterTagsFromProfiles(storyContent);
    let finalPositive = normalizePositive(promptResult.positive);
    if (profileTags) {
      finalPositive = `${normalizePositive(profileTags)}, ${finalPositive}`;
      console.log('[ImageGen] Added character profile tags:', profileTags);
    }


    if (s.imageGenArtistPromptEnabled && s.imageGenArtistPrompt) {
      const artistPrompt = normalizePositive(s.imageGenArtistPrompt);
      if (artistPrompt) {
        finalPositive = `${artistPrompt}, ${finalPositive}`;
      }
    }

    $('#sg_imagePositivePrompt').val(finalPositive);


    $('#sg_imagePromptPreview').show();

    const imageUrl = await generateImageWithNovelAI(finalPositive, promptResult.negative);

    $('#sg_generatedImage').attr('src', imageUrl);
    $('#sg_generatedImage').attr('data-full', imageUrl);
    $('#sg_imageResult').show();


    setImageGenStatus(`�?生成成功！类�? ${promptResult.type}，主�? ${promptResult.subject}`, 'ok');

    if (s.imageGenAutoSave && s.imageGenSavePath) {
      try { await saveGeneratedImage(imageUrl); setImageGenStatus(`�?生成成功并已保存！`, 'ok'); }
      catch (e) { console.warn('[ImageGen] Auto-save failed:', e); }
    }
  } catch (e) {
    console.error('[ImageGen] Generation failed:', e);
    setImageGenStatus(`�?生成失败: ${e?.message || e}`, 'err');
  }
}

async function saveGeneratedImage(imageUrl) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `sg_image_${timestamp}.png`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}


// -------------------- 在线图库功能 --------------------

async function loadGalleryFromGitHub() {
  const s = ensureSettings();
  const url = String($('#sg_imageGalleryUrl').val() || s.imageGalleryUrl || '').trim();

  if (!url) {
    setImageGenStatus('请先填写图库索引 URL', 'err');
    return false;
  }

  setImageGenStatus('正在加载图库�?, 'warn');
  $('#sg_galleryInfo').text('(加载中�?');

  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.images || !Array.isArray(data.images)) throw new Error('格式错误：缺�?images 数组');

    s.imageGalleryCache = data.images;
    s.imageGalleryCacheTime = Date.now();
    s.imageGalleryBaseUrl = data.baseUrl || url.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/[^        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/]+$/, '/');
    saveSettings();

    $('#sg_galleryInfo').text(`(已加�?${data.images.length} �?`);
    setImageGenStatus(`�?图库加载成功�?{data.images.length} 张图片`, 'ok');
    return true;
  } catch (e) {
    console.error('[ImageGallery] Load failed:', e);
    $('#sg_galleryInfo').text('(加载失败)');
    setImageGenStatus(`�?图库加载失败: ${e?.message || e}`, 'err');
    return false;
  }
}

async function matchGalleryImage() {
  const s = ensureSettings();

  if (!s.imageGalleryCache || s.imageGalleryCache.length === 0) {
    setImageGenStatus('请先加载图库', 'err');
    return;
  }

  const storyContent = getRecentStoryContent(s.imageGenLookbackMessages || 5);
  if (!storyContent.trim()) { setImageGenStatus('没有找到对话内容', 'err'); return; }

  setImageGenStatus('正在分析剧情并匹配图片�?, 'warn');

  const galleryList = s.imageGalleryCache.map(img =>
    `- id:${img.id}, tags:[${(img.tags || []).join(',')}], desc:${img.description || ''}`
  ).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');

  const messages = [
    { role: 'system', content: s.imageGalleryMatchPrompt || DEFAULT_SETTINGS.imageGalleryMatchPrompt },
    { role: 'user', content: `【剧情】：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${storyContent}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n【图库】：        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${galleryList}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n选择最匹配的图片。` }
  ];

  try {
    const result = await callLLM(messages, { temperature: 0.3, max_tokens: 256 });
    const jsonMatch = result.match(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;{[        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;S]*        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;}/);
    if (!jsonMatch) { setImageGenStatus('�?匹配失败：无法解析响�?, 'err'); return; }

    const parsed = JSON.parse(jsonMatch[0]);
    const matchedImage = s.imageGalleryCache.find(img => img.id === parsed.matchedId);

    if (!matchedImage) { setImageGenStatus(`�?未找�?ID "${parsed.matchedId}"`, 'err'); return; }

    const baseUrl = s.imageGalleryBaseUrl || '';
    const imageUrl = matchedImage.path.startsWith('http') ? matchedImage.path : baseUrl + matchedImage.path;

    $('#sg_matchedGalleryImage').attr('src', imageUrl);
    $('#sg_matchedGalleryImage').attr('data-full', imageUrl);
    $('#sg_galleryMatchReason').text(`🎯 ${parsed.reason || ''}`);
    $('#sg_galleryResult').show();

    setImageGenStatus(`�?匹配�?{matchedImage.description || parsed.matchedId}`, 'ok');
  } catch (e) {
    console.error('[ImageGallery] Match failed:', e);
    setImageGenStatus(`�?匹配失败: ${e?.message || e}`, 'err');
  }
}


async function refreshModels() {
  const s = ensureSettings();
  const raw = String($('#sg_customEndpoint').val() || s.customEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('请先填写 API基础URL 再刷新模�?, 'warn'); return; }

  setStatus('正在刷新模型列表�?, 'warn');

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
      const err = new Error(`状态检查失�? HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
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

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) {
      setStatus('刷新成功，但未解析到模型列表（返回格式不兼容�?, 'warn');
      return;
    }

    s.customModelsCache = ids;
    saveSettings();
    fillModelSelect(ids, s.customModel);

    // Update character model datalist
    const $dl = $('#sg_char_model_list');
    $dl.empty();
    ids.forEach(id => {
      $dl.append($('<option>').val(id));
    });

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
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1$/.test(u)) return u + '/models';
      if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i.test(u)) return u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '') + '/models';
      return u + '/v1/models';
    })(apiBase);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { method: 'GET', headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`直连 /models 失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('直连刷新失败：未解析到模型列�?, 'warn'); return; }

    s.customModelsCache = ids;
    saveSettings();
    fillModelSelect(ids, s.customModel);
    setStatus(`已刷新模型：${ids.length} 个`, 'ok');
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) {
      setStatus(`刷新失败�?{e?.message ?? e}`, 'err');
      return;
    }

    // Fallback: direct /models
    console.warn('[StoryGuide] custom character status check failed; fallback to direct /models', e);
    try {
      const modelsUrl = (function (base) {
        const u = normalizeBaseUrl(base);
        if (!u) return '';
        if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1$/.test(u)) return u + '/models';
        if (/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/v1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;b/i.test(u)) return u.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;/+$/, '') + '/models';
        return u + '/v1/models';
      })(apiBase);

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(modelsUrl, { method: 'GET', headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`直连 /models 失败: HTTP ${res.status} ${res.statusText}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${txt}`);
      }

      const data = await res.json().catch(() => ({}));
      let modelsList = [];
      if (Array.isArray(data?.models)) modelsList = data.models;
      else if (Array.isArray(data?.data)) modelsList = data.data;
      else if (Array.isArray(data)) modelsList = data;

      let ids = [];
      if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);
      ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

      if (!ids.length) {
        setStatus('刷新成功，但未解析到模型列表', 'warn');
        return;
      }

      s.customModelsCache = ids;
      saveSettings();
      const $dl = $('#sg_char_model_list');
      $dl.empty();
      ids.forEach(id => {
        $dl.append($('<option>').val(id));
      });
      setStatus(`已刷新模型（直连）：${ids.length} 个`, 'ok');

    } catch (e2) {
      setStatus(`刷新失败�?{e2?.message ?? e2}`, 'err');
    }
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

const SG_FLOATING_POS_KEY = 'storyguide_floating_panel_pos_v1';
let sgFloatingPinnedLoaded = false;
let sgFloatingPinnedPos = null;

function loadFloatingPanelPos() {
  if (sgFloatingPinnedLoaded) return;
  sgFloatingPinnedLoaded = true;
  try {
    const raw = localStorage.getItem(SG_FLOATING_POS_KEY);
    if (!raw) return;
    const j = JSON.parse(raw);
    if (j && typeof j.left === 'number' && typeof j.top === 'number') {
      sgFloatingPinnedPos = { left: j.left, top: j.top };
    }
  } catch { /* ignore */ }
}

function saveFloatingPanelPos(left, top) {
  try {
    sgFloatingPinnedPos = { left: Number(left) || 0, top: Number(top) || 0 };
    localStorage.setItem(SG_FLOATING_POS_KEY, JSON.stringify(sgFloatingPinnedPos));
  } catch { /* ignore */ }
}

function clearFloatingPanelPos() {
  try {
    sgFloatingPinnedPos = null;
    localStorage.removeItem(SG_FLOATING_POS_KEY);
  } catch { /* ignore */ }
}

function clampToViewport(left, top, w, h) {
  // 放宽边界限制：允许窗口越�?50%（即至少保留 50% 或标题栏 40px 可见�?
  const minVisibleRatio = 0.5; // 至少 50% 可见（允许另�?50% 在屏幕外�?
  const minVisiblePx = 40;     // 或至�?40px（保证标题栏可拖回）

  // 计算水平方向需要保持可见的最小宽�?
  const minVisibleW = Math.max(minVisiblePx, w * minVisibleRatio);
  // 计算垂直方向需要保持可见的最小高�?
  const minVisibleH = Math.max(minVisiblePx, h * minVisibleRatio);

  // 左边界：允许负值，但确保右侧至�?minVisibleW 在屏幕内
  // �?left + w >= minVisibleW �?left >= minVisibleW - w
  const minLeft = minVisibleW - w;
  // 右边界：确保左侧至少 minVisibleW 在屏幕内
  // �?left + minVisibleW <= window.innerWidth �?left <= window.innerWidth - minVisibleW
  const maxLeft = window.innerWidth - minVisibleW;

  // 上边界：严格限制 >= 0，保证标题栏不被遮挡
  const minTop = 0;
  // 下边界：确保顶部至少 minVisibleH 在屏幕内
  const maxTop = window.innerHeight - minVisibleH;

  const L = Math.max(minLeft, Math.min(left, maxLeft));
  const T = Math.max(minTop, Math.min(top, maxTop));
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
    try { positionChatActionButtons(); } catch { }
  }, 60);
}

// Removed: ensureChatActionButtons feature (Generate/Reroll buttons near input)
function ensureChatActionButtons() {
  // Feature disabled/removed as per user request.
  const el = document.getElementById('sg_chat_controls');
  if (el) el.remove();
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
  if (window.__storyguide_card_toggle_installed) return;
  window.__storyguide_card_toggle_installed = true;

  clearLegacyZoomArtifacts();

  document.addEventListener('click', (e) => {
    const target = e.target;
    // don't hijack interactive elements
    if (target.closest('a, button, input, textarea, select, label')) return;

    // Handle Title Click -> Collapse Section
    // Target headers h1-h6 inside floating or inline body
    // We strictly look for headers that are direct children or wrapped in simple divs of the body
    const header = target.closest('.sg-floating-body h1, .sg-floating-body h2, .sg-floating-body h3, .sg-floating-body h4, .sg-floating-body h5, .sg-floating-body h6, .sg-inline-body h1, .sg-inline-body h2, .sg-inline-body h3, .sg-inline-body h4, .sg-inline-body h5, .sg-inline-body h6');

    if (header) {
      e.preventDefault();
      e.stopPropagation();

      // Find the next sibling that is usually the content (ul, p, or div)
      let next = header.nextElementSibling;
      let handled = false;

      // Toggle class on header for styling (arrow)
      header.classList.toggle('sg-section-collapsed');

      while (next) {
        // Stop if we hit another header of same or higher level, or if end of container
        const tag = next.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) break;

        // Toggle visibility
        if (next.style.display === 'none') {
          next.style.display = '';
        } else {
          next.style.display = 'none';
        }

        next = next.nextElementSibling;
        handled = true;
      }
      return;
    }

    // Fallback: If inline cards still need collapsing (optional, keeping for compatibility if user wants inline msg boxes to toggle)
    const card = target.closest('.sg-inline-body > ul > li');
    if (card) {
      // Check selection
      try {
        const sel = window.getSelection();
        if (sel && String(sel).trim().length > 0) return;
      } catch { /* ignore */ }

      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle('sg-collapsed');
    }
  }, true);
}



function buildModalHtml() {
  return `
  <div id="sg_modal_backdrop" class="sg-backdrop" style="display:none;">
    <div id="sg_modal" class="sg-modal" role="dialog" aria-modal="true">
      <div class="sg-modal-head">
        <div class="sg-modal-title">
          <span class="sg-badge">📘</span>
          剧情指导 <span class="sg-sub">StoryGuide v${SG_VERSION}</span>
        </div>
        <div class="sg-modal-actions">
          <button class="menu_button sg-btn" id="sg_close">�?/button>
        </div>
      </div>


      <div class="sg-modal-body">
        <div class="sg-left">
          <div class="sg-pagetabs">
            <button class="sg-pgtab active" id="sg_pgtab_guide">剧情指导</button>
            <button class="sg-pgtab" id="sg_pgtab_summary">总结设置</button>
            <button class="sg-pgtab" id="sg_pgtab_index">索引设置</button>
            <button class="sg-pgtab" id="sg_pgtab_roll">ROLL 设置</button>
            <button class="sg-pgtab" id="sg_pgtab_image">图像生成</button>
            <button class="sg-pgtab" id="sg_pgtab_sex">性爱指导</button>
            <button class="sg-pgtab" id="sg_pgtab_character">自定义角�?/button>
            <button class="sg-pgtab" id="sg_pgtab_parallel">平行世界</button>
          </div>

          <div class="sg-page active" id="sg_page_guide">
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
                <label>剧透等�?/label>
                <select id="sg_spoiler">
                  <option value="none">不剧�?/option>
                  <option value="mild">轻剧�?/option>
                  <option value="full">全剧�?/option>
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
                <label>最近消息条�?/label>
                <input id="sg_maxMessages" type="number" min="5" max="200">
              </div>
              <div class="sg-field">
                <label>每条最大字�?/label>
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
                <option value="received">AI回复�?/option>
                <option value="sent">用户发送时</option>
                <option value="both">两者都触发</option>
              </select>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_autoAppendBox">启用分析框（手动生成/重Roll�?/label>
              <select id="sg_appendMode">
                <option value="compact">简�?/option>
                <option value="standard">标准</option>
              </select>
              <select id="sg_inlineModulesSource" title="选择追加框展示的模块来源">
                <option value="inline">�?inline=true 的模�?/option>
                <option value="panel">跟随面板（panel=true�?/option>
                <option value="all">显示全部模块</option>
              </select>
              <label class="sg-check" title="即使模型没输出该字段，也显示（空）占�?>
                <input type="checkbox" id="sg_inlineShowEmpty">显示空字�?
              </label>
              <span class="sg-hint">（点击框标题可折叠）</span>
            </div>

            <div id="sg_custom_block" class="sg-card sg-subcard" style="display:none;">
              <div class="sg-card-title">独立API 设置（建议填 API基础URL�?/div>

              <div class="sg-field">
                <label>API基础URL（例�?https://api.openai.com/v1 �?/label>
                <input id="sg_customEndpoint" type="text" placeholder="https://xxx.com/v1">
                <div class="sg-hint sg-warn">优先走酒馆后端代理接口（/api/backends/...），比浏览器直连更不容易跨域/连不上�?/div>
              </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>API Key（可选）</label>
                  <input id="sg_customApiKey" type="password" placeholder="可留�?>
                </div>

                <div class="sg-field">
                  <label>模型（可手填�?/label>
                  <input id="sg_customModel" type="text" placeholder="gpt-4o-mini">
                </div>
              </div>

              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_refreshModels">检�?刷新模型</button>
                <select id="sg_modelSelect" class="sg-model-select">
                  <option value="">（选择模型�?/option>
                </select>
              </div>

              <div class="sg-row">
                <div class="sg-field sg-field-full">
                  <label>最大回复token�?/label>
                  <input id="sg_customMaxTokens" type="number" min="256" max="200000" step="1" placeholder="例如�?0000">
                
                  <label class="sg-check" style="margin-top:8px;">
                    <input type="checkbox" id="sg_customStream"> 使用流式返回（stream=true�?
                  </label>
</div>
              </div>
            </div>

            <div class="sg-actions-row">
              <button class="menu_button sg-btn-primary" id="sg_saveSettings">保存设置</button>
              <button class="menu_button sg-btn-primary" id="sg_analyze">分析当前剧情</button>
            </div>
            <div class="sg-actions-row" style="margin-top: 8px;">
              <button class="menu_button sg-btn" id="sg_exportPreset">📤 导出全局预设</button>
              <button class="menu_button sg-btn" id="sg_importPreset">📥 导入全局预设</button>
              <input type="file" id="sg_importPresetFile" accept=".json" style="display: none;">
            </div>
          </div>

          <div class="sg-card">
            <div class="sg-card-title">快捷选项</div>
            <div class="sg-hint">点击选项可自动将提示词输入到聊天框。可自定义选项内容�?/div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_quickOptionsEnabled">启用快捷选项</label>
              <select id="sg_quickOptionsShowIn">
                <option value="inline">仅分析框</option>
                <option value="panel">仅面�?/option>
                <option value="both">两者都显示</option>
              </select>
            </div>

            <div class="sg-field" style="margin-top:10px;">
              <label>选项配置（JSON，格式：[{label, prompt}, ...]�?/label>
              <textarea id="sg_quickOptionsJson" rows="6" spellcheck="false" placeholder='[{"label": "继续", "prompt": "继续当前剧情发展"}]'></textarea>
              <div class="sg-actions-row">
                <button class="menu_button sg-btn" id="sg_resetQuickOptions">恢复默认选项</button>
                <button class="menu_button sg-btn" id="sg_applyQuickOptions">应用选项</button>
              </div>
            </div>
          </div>

          <div class="sg-card">
            <div class="sg-card-title">输出模块（JSON，可自定义字�?提示词）</div>
            <div class="sg-hint">你可以增删模块、改 key/title/type/prompt、控�?panel/inline。保存前可点“校验”�?/div>

            <div class="sg-field">
              <textarea id="sg_modulesJson" rows="12" spellcheck="false"></textarea>
              <div class="sg-hint" style="margin-top:4px;">💡 模块可添�?<code>static: true</code> 表示静态模块（只在首次生成或手动刷新时更新�?/div>
              <div class="sg-actions-row">
                <button class="menu_button sg-btn" id="sg_validateModules">校验</button>
                <button class="menu_button sg-btn" id="sg_resetModules">恢复默认</button>
                <button class="menu_button sg-btn" id="sg_applyModules">应用到设�?/button>
                <button class="menu_button sg-btn" id="sg_clearStaticCache">刷新静态模�?/button>
              </div>
            </div>

            <div class="sg-field">
              <label>自定�?System 补充（可选）</label>
              <textarea id="sg_customSystemPreamble" rows="3" placeholder="例如：更偏悬疑、强调线索、避免冗长�?></textarea>
            </div>
            <div class="sg-field">
              <label>自定�?Constraints 补充（可选）</label>
              <textarea id="sg_customConstraints" rows="3" placeholder="例如：必须提到关键人物动机、每条不超过20字�?></textarea>
            </div>
          </div>

          
          <div class="sg-card">
            <div class="sg-card-title">预设与世界书</div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_exportPreset">导出预设</button>
              <label class="sg-check"><input type="checkbox" id="sg_presetIncludeApiKey">导出包含 API Key</label>
              <button class="menu_button sg-btn" id="sg_importPreset">导入预设</button>
            </div>

            <div class="sg-hint">预设会包含：生成设置 / 独立API / 输出模块 / 世界书设�?/ 自定义提示骨架。导入会覆盖当前配置�?/div>

            <hr class="sg-hr">

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_worldbookEnabled">在分析输入中注入世界�?/label>
              <select id="sg_worldbookMode">
                <option value="active">仅注入“可能激活”的条目（推荐）</option>
                <option value="all">注入全部条目</option>
              </select>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>世界书最大注入字�?/label>
                <input id="sg_worldbookMaxChars" type="number" min="500" max="50000">
              </div>
              <div class="sg-field">
                <label>激活检测窗口（最近消息条数）</label>
                <input id="sg_worldbookWindowMessages" type="number" min="5" max="80">
              </div>
            </div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_importWorldbook">导入世界书JSON</button>
              <button class="menu_button sg-btn" id="sg_clearWorldbook">清空世界�?/button>
              <button class="menu_button sg-btn" id="sg_saveWorldbookSettings">保存世界书设�?/button>
            </div>

            <div class="sg-hint" id="sg_worldbookInfo">（未导入世界书）</div>
          </div>

          <div class="sg-card">
            <div class="sg-card-title">🗺�?网格地图</div>
            <div class="sg-hint">从剧情中自动提取地点信息，生成可视化世界地图。显示主角位置和各地事件�?/div>
            
              <div class="sg-row sg-inline" style="margin-top: 10px;">
                <label class="sg-check"><input type="checkbox" id="sg_mapEnabled">启用地图功能</label>
              </div>

              <div class="sg-field" style="margin-top: 10px;">
                <label>地图提示�?/label>
                <textarea id="sg_mapSystemPrompt" rows="6" placeholder="可自定义地图提取规则（仍需输出 JSON�?></textarea>
                <div class="sg-actions-row">
                  <button class="menu_button sg-btn" id="sg_mapResetPrompt">恢复默认提示�?/button>
                </div>
              </div>
              
              <div class="sg-field" style="margin-top: 10px;">
                <label>地图当前状�?/label>
                <div id="sg_mapPreview" class="sg-map-container">
                <div class="sg-map-empty">暂无地图数据。启用后进行剧情分析将自动生成地图�?/div>
              </div>
            </div>
            
            <div class="sg-actions-row">
              <button class="menu_button sg-btn" id="sg_resetMap">🗑 重置地图</button>
              <button class="menu_button sg-btn" id="sg_refreshMapPreview">🔄 刷新预览</button>
            </div>
          </div>

          </div> <!-- sg_page_guide -->

          <div class="sg-page" id="sg_page_summary">

          <div class="sg-card">
            <div class="sg-card-title">自动总结（写入世界书�?/div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_summaryEnabled">启用自动总结</label>
              <span>�?/span>
              <input id="sg_summaryEvery" type="number" min="1" max="200" style="width:90px">
              <span>�?/span>
              <select id="sg_summaryCountMode">
                <option value="assistant">�?AI 回复计数</option>
                <option value="all">按全部消息计�?/option>
              </select>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>总结 Provider</label>
                <select id="sg_summaryProvider">
                  <option value="st">使用酒馆当前连接的模�?/option>
                  <option value="custom">使用独立 OpenAI 兼容 API</option>
                </select>
              </div>
              <div class="sg-field">
                <label>总结 Temperature</label>
                <input id="sg_summaryTemperature" type="number" min="0" max="2" step="0.1">
              </div>
            </div>

              <div class="sg-card sg-subcard">
                <div class="sg-field">
                  <label>自定义总结提示词（System，可选）</label>
                  <textarea id="sg_summarySystemPrompt" rows="6" placeholder="例如：更强调线索/关系变化/回合制记录，或要求英文输出…（仍需输出 JSON�?></textarea>
                </div>
                <div class="sg-field">
                  <label>对话片段模板（User，可选）</label>
                  <textarea id="sg_summaryUserTemplate" rows="4" placeholder="支持占位符：{{fromFloor}} {{toFloor}} {{chunk}}"></textarea>
                </div>
              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_summaryResetPrompt">恢复默认提示�?/button>
                <div class="sg-hint" style="margin-left:auto">占位符：{{fromFloor}} {{toFloor}} {{chunk}} {{statData}}。插件会强制要求输出 JSON：{title, summary, keywords[]}�?/div>
              </div>
              <div class="sg-row sg-inline" style="margin-top:8px">
                <label class="sg-check"><input type="checkbox" id="sg_summaryReadStatData">读取角色状态变�?/label>
                <div class="sg-field" style="flex:1;margin-left:8px">
                  <input id="sg_summaryStatVarName" type="text" placeholder="stat_data" style="width:120px">
                </div>
                <div class="sg-hint" style="margin-left:8px">AI 可看到变量中的角色属性数据（类似 ROLL 点模块）</div>
              </div>
            </div>

            <div class="sg-card sg-subcard">
              <div class="sg-card-title">结构化条目（人物/装备/物品�?势力/成就/副职�?任务/猎艳录）</div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_structuredEntriesEnabled">启用结构化条�?/label>
                <label class="sg-check"><input type="checkbox" id="sg_characterEntriesEnabled">人物</label>
                <label class="sg-check"><input type="checkbox" id="sg_equipmentEntriesEnabled">装备</label>
                <label class="sg-check"><input type="checkbox" id="sg_inventoryEntriesEnabled">物品�?/label>
                <label class="sg-check"><input type="checkbox" id="sg_factionEntriesEnabled">势力</label>
              </div>
              <div class="sg-row sg-inline" style="margin-top:6px">
                <label class="sg-check"><input type="checkbox" id="sg_structuredWorldbookEnabled">读取蓝灯世界�?/label>
                <select id="sg_structuredWorldbookMode">
                  <option value="active">active（只读取未禁用条目）</option>
                  <option value="all">all（读取所有条目）</option>
                </select>
                <div class="sg-hint" id="sg_structuredWorldbookInfo" style="margin-left:auto">（未读取�?/div>
              </div>
              <div class="sg-row sg-inline" style="margin-top:6px">
                <span>更新频率</span>
                <span>�?/span>
                <input id="sg_structuredEntriesEvery" type="number" min="1" max="200" style="width:90px">
                <span>�?/span>
                <select id="sg_structuredEntriesCountMode">
                  <option value="assistant">�?AI 回复计数</option>
                  <option value="all">按全部消息计�?/option>
                </select>
              </div>
              <div class="sg-row sg-inline" style="margin-top:6px">
                <span>读取楼层</span>
                <span>最�?/span>
                <input id="sg_structuredEntriesReadFloors" type="number" min="1" max="200" style="width:90px">
                <span>�?/span>
              </div>
              <div class="sg-row sg-inline" style="margin-top:6px">
                <span>条目内容格式</span>
                <select id="sg_structuredEntryContentFormat">
                  <option value="text">简洁文�?/option>
                  <option value="markdown">Markdown</option>
                </select>
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_structuredReenableEntriesEnabled">自动重新启用人物/势力</label>
              </div>

              <div class="sg-card sg-subcard">
                <div class="sg-card-title">大总结（汇总多条剧情总结�?/div>
                <div class="sg-row sg-inline">
                  <label class="sg-check"><input type="checkbox" id="sg_megaSummaryEnabled">启用大总结</label>
                  <div class="sg-field" style="margin-left:8px">
                    <label style="margin-right:6px">�?/label>
                    <input id="sg_megaSummaryEvery" type="number" min="5" max="5000" style="width:80px">
                    <span class="sg-hint" style="margin-left:6px">条剧情总结生成一�?/span>
                  </div>
                </div>
                <div class="sg-field">
                  <label>大总结前缀</label>
                  <input id="sg_megaSummaryCommentPrefix" type="text" placeholder="大总结">
                </div>
                <div class="sg-field">
                  <label>大总结提示词（System，可选）</label>
                  <textarea id="sg_megaSummarySystemPrompt" rows="5" placeholder="例如：强调阶段性转�?主线推进…（仍需输出 JSON�?></textarea>
                </div>
                <div class="sg-field">
                  <label>大总结模板（User，可选）</label>
                  <textarea id="sg_megaSummaryUserTemplate" rows="4" placeholder="支持占位符：{{items}}"></textarea>
                </div>
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_achievementEntriesEnabled">成就</label>
                <label class="sg-check"><input type="checkbox" id="sg_subProfessionEntriesEnabled">副职�?/label>
                <label class="sg-check"><input type="checkbox" id="sg_questEntriesEnabled">任务</label>
                <label class="sg-check"><input type="checkbox" id="sg_conquestEntriesEnabled">猎艳�?/label>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>人物条目前缀</label>
                  <input id="sg_characterEntryPrefix" type="text" placeholder="人物">
                </div>
                <div class="sg-field">
                  <label>装备条目前缀</label>
                  <input id="sg_equipmentEntryPrefix" type="text" placeholder="装备">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>物品栏条目前缀</label>
                  <input id="sg_inventoryEntryPrefix" type="text" placeholder="物品�?>
                </div>
                <div class="sg-field">
                  <label>势力条目前缀</label>
                  <input id="sg_factionEntryPrefix" type="text" placeholder="势力">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>成就条目前缀</label>
                  <input id="sg_achievementEntryPrefix" type="text" placeholder="成就">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>副职业条目前缀</label>
                  <input id="sg_subProfessionEntryPrefix" type="text" placeholder="副职�?>
                </div>
                <div class="sg-field">
                  <label>任务条目前缀</label>
                  <input id="sg_questEntryPrefix" type="text" placeholder="任务">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>猎艳录条目前缀</label>
                  <input id="sg_conquestEntryPrefix" type="text" placeholder="猎艳�?>
                </div>
              </div>
              <div class="sg-field">
                <label>结构化提取提示词（System，可选）</label>
                <textarea id="sg_structuredEntriesSystemPrompt" rows="5" placeholder="例如：强调客观档案式描述、避免杜撰�?></textarea>
              </div>
              <div class="sg-field">
                <label>结构化提取模板（User，可选）</label>
                <textarea id="sg_structuredEntriesUserTemplate" rows="4" placeholder="支持占位符：{{fromFloor}} {{toFloor}} {{chunk}} {{knownCharacters}} {{knownEquipments}} {{knownInventories}} {{knownFactions}} {{knownAchievements}} {{knownSubProfessions}} {{knownQuests}} {{knownConquests}} {{structuredWorldbook}}"></textarea>
              </div>
              <div class="sg-card sg-subcard">
                <div class="sg-card-title">条目提示词与模板管理</div>
                <div class="sg-hint" style="margin-bottom:8px">为每种类型的条目配置独立的提取逻辑（提示词）和输出格式（模板）�?/div>

                <div class="sg-row sg-inline" style="margin-bottom:8px">
                  <select id="sg_structuredPresetSelect" style="min-width:160px;"></select>
                  <button class="menu_button sg-btn" id="sg_structuredApplyPreset">应用</button>
                  <button class="menu_button sg-btn" id="sg_structuredSavePreset">保存为预�?/button>
                  <button class="menu_button sg-btn" id="sg_structuredDeletePreset">删除</button>
                  <button class="menu_button sg-btn" id="sg_structuredExportPreset">导出预设</button>
                  <button class="menu_button sg-btn" id="sg_structuredImportPreset">导入预设</button>
                </div>
                
                <div class="sg-row sg-inline" style="margin-bottom:10px">
                  <label>选择条目类型</label>
                  <select id="sg_structuredTypeSelector" style="flex:1">
                    <option value="character">人物 (Character)</option>
                    <option value="equipment">装备 (Equipment)</option>
                    <option value="inventory">物品�?(Inventory)</option>
                    <option value="faction">势力 (Faction)</option>
                    <option value="achievement">成就 (Achievement)</option>
                    <option value="subProfession">副职�?(Sub-profession)</option>
                    <option value="quest">任务 (Quest)</option>
                    <option value="conquest">猎艳�?(Conquest)</option>
                  </select>
                </div>

                <!-- Template Editor Area -->
                <div id="sg_structured_template_editor">
                  <div class="sg-field">
                    <label>提取提示�?(Prompt)</label>
                    <textarea id="sg_structured_type_prompt" rows="3" placeholder="该类型的提取侧重�?.."></textarea>
                  </div>
                  <div class="sg-field">
                    <label>输出模板 (Template)</label>
                    <textarea id="sg_structured_type_template" rows="8" placeholder="该类型的输出格式..."></textarea>
                    <div class="sg-hint" id="sg_structured_type_hint">占位符：{{name}} {{uid}} ...</div>
                  </div>
                </div>

                <!-- Hidden inputs to store all values (so pullUiToSettings can read them easily) -->
                <div style="display:none">
                  <textarea id="sg_structuredCharacterPrompt"></textarea>
                  <textarea id="sg_structuredCharacterEntryTemplate"></textarea>
                  <textarea id="sg_structuredEquipmentPrompt"></textarea>
                  <textarea id="sg_structuredEquipmentEntryTemplate"></textarea>
                  <textarea id="sg_structuredInventoryPrompt"></textarea>
                  <textarea id="sg_structuredInventoryEntryTemplate"></textarea>
                  <textarea id="sg_structuredFactionPrompt"></textarea>
                  <textarea id="sg_structuredFactionEntryTemplate"></textarea>
                  <textarea id="sg_structuredAchievementPrompt"></textarea>
                  <textarea id="sg_structuredAchievementEntryTemplate"></textarea>
                  <textarea id="sg_structuredSubProfessionPrompt"></textarea>
                  <textarea id="sg_structuredSubProfessionEntryTemplate"></textarea>
                  <textarea id="sg_structuredQuestPrompt"></textarea>
                  <textarea id="sg_structuredQuestEntryTemplate"></textarea>
                  <textarea id="sg_structuredConquestPrompt"></textarea>
                  <textarea id="sg_structuredConquestEntryTemplate"></textarea>
                </div>
              </div>
              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_structuredResetPrompt">恢复默认结构化提示词</button>
                <button class="menu_button sg-btn" id="sg_clearStructuredCache">清除结构化条目缓�?/button>
                <div class="sg-hint" style="margin-left:auto">占位符：{{fromFloor}} {{toFloor}} {{chunk}} {{knownCharacters}} {{knownEquipments}} {{knownInventories}} {{knownFactions}} {{knownAchievements}} {{knownSubProfessions}} {{knownQuests}} {{knownConquests}} {{structuredWorldbook}}�?/div>
              </div>
            </div>

            <div class="sg-card sg-subcard" id="sg_summary_custom_block" style="display:none">
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>独立API基础URL</label>
                  <input id="sg_summaryCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
                </div>
                <div class="sg-field">
                  <label>API Key</label>
                  <input id="sg_summaryCustomApiKey" type="password" placeholder="sk-...">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>模型ID（可手填�?/label>
                  <input id="sg_summaryCustomModel" type="text" placeholder="gpt-4o-mini">
                  <div class="sg-row sg-inline" style="margin-top:6px;">
                    <button class="menu_button sg-btn" id="sg_refreshSummaryModels">刷新模型</button>
                    <select id="sg_summaryModelSelect" class="sg-model-select">
                      <option value="">（选择模型�?/option>
                    </select>
                  </div>
                </div>
                <div class="sg-field">
                  <label>Max Tokens</label>
                  <input id="sg_summaryCustomMaxTokens" type="number" min="128" max="200000">
                </div>
              </div>
              <label class="sg-check"><input type="checkbox" id="sg_summaryCustomStream">stream（若支持�?/label>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_summaryToWorldInfo">写入世界书（绿灯启用�?/label>
              <input id="sg_summaryWorldInfoFile" type="text" placeholder="世界书文件名" style="flex:1; min-width: 220px;">
              <select id="sg_summaryWorldbookSelect" class="sg-model-select" title="从酒馆世界书选择" style="min-width: 160px;">
                <option value="">(选择世界�?</option>
              </select>
              <button class="menu_button sg-btn" id="sg_refreshWorldbookList" title="从酒馆读取世界书列表">刷新列表</button>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_summaryToBlueWorldInfo" checked>同时写入蓝灯世界书（常开索引�?/label>
              <input id="sg_summaryBlueWorldInfoFile" type="text" placeholder="蓝灯世界书文件名（建议单独建一个）" style="flex:1; min-width: 260px;">
              <select id="sg_summaryBlueWorldbookSelect" class="sg-model-select" title="从酒馆世界书选择" style="min-width: 160px;">
                <option value="">(选择世界�?</option>
              </select>
            </div>

            <div class="sg-row sg-inline" style="gap: 20px;">
              <label class="sg-check" title="当在酒馆撤回/删除消息导致楼层减少时，自动撤销最近一次总结条目"><input type="checkbox" id="sg_summaryAutoRollback">剧本总结自动随消息撤�?/label>
              <label class="sg-check" title="当在酒馆撤回/删除消息导致楼层减少时，自动回滚最近一次结构化条目变更"><input type="checkbox" id="sg_structuredAutoRollback">结构化条目自动随消息撤回</label>
            </div>

            <div class="sg-hint" style="margin-top: 8px; color: var(--SmartThemeQuoteColor);">
              💡 请手动创建世界书文件，然后在上方填写文件名。绿灯选择「写入指定世界书文件名」模式�?
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>条目标题前缀（写�?comment，始终在最前）</label>
                <input id="sg_summaryWorldInfoCommentPrefix" type="text" placeholder="剧情总结">
              </div>
              <div class="sg-field">
                <label>限制：每条消息最多字�?/ 总字�?/label>
                <div class="sg-row" style="margin-top:0">
                  <input id="sg_summaryMaxChars" type="number" min="200" max="8000" style="width:110px">
                  <input id="sg_summaryMaxTotalChars" type="number" min="2000" max="80000" style="width:120px">
                </div>
              </div>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>世界书触发词写入 key</label>
                <select id="sg_summaryWorldInfoKeyMode">
                  <option value="keywords">使用模型输出的关键词�?~14 个）</option>
                  <option value="indexId">使用索引编号（只�?1 个，�?A-001�?/option>
                </select>
                <div class="sg-hint">想让“主要关键词”只显示 A-001，就选“索引编号”�?/div>
              </div>
              <div class="sg-field" id="sg_summaryIndexFormat" style="display:none;">
                <label>索引编号格式（keyMode=indexId�?/label>
                <div class="sg-row" style="margin-top:0; gap:8px; align-items:center;">
                  <input id="sg_summaryIndexPrefix" type="text" placeholder="A-" style="width:90px">
                  <span class="sg-hint">位数</span>
                  <input id="sg_summaryIndexPad" type="number" min="1" max="12" style="width:80px">
                  <span class="sg-hint">起始</span>
                  <input id="sg_summaryIndexStart" type="number" min="1" max="1000000" style="width:100px">
                </div>
                <label class="sg-check" style="margin-top:6px;"><input type="checkbox" id="sg_summaryIndexInComment">条目标题（comment）包含编�?/label>
              </div>
            </div>

            <div class="sg-card sg-subcard">
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_wiTriggerEnabled">启用“蓝灯索�?�?绿灯触发”（发送消息前自动注入触发词）</label>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>读取�?N 条消息正�?/label>
                  <input id="sg_wiTriggerLookbackMessages" type="number" min="5" max="120" placeholder="20">
                </div>
                <div class="sg-field">
                  <label>最多触发条目数</label>
                  <input id="sg_wiTriggerMaxEntries" type="number" min="1" max="20" placeholder="4">
                </div>

              <div class="sg-grid2" style="margin-top: 8px;">
                <div class="sg-field">
                  <label>最多索引人物数</label>
                  <input id="sg_wiTriggerMaxCharacters" type="number" min="0" max="10" placeholder="2">
                </div>
                <div class="sg-field">
                  <label>最多索引装备数</label>
                  <input id="sg_wiTriggerMaxEquipments" type="number" min="0" max="10" placeholder="2">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>最多索引势力数</label>
                  <input id="sg_wiTriggerMaxFactions" type="number" min="0" max="10" placeholder="2">
                </div>
                <div class="sg-field">
                  <label>最多索引成就数</label>
                  <input id="sg_wiTriggerMaxAchievements" type="number" min="0" max="10" placeholder="2">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>最多索引副职业�?/label>
                  <input id="sg_wiTriggerMaxSubProfessions" type="number" min="0" max="10" placeholder="2">
                </div>
                <div class="sg-field">
                  <label>最多索引任务数</label>
                  <input id="sg_wiTriggerMaxQuests" type="number" min="0" max="10" placeholder="2">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>最多索引剧情数（优先久远）</label>
                  <input id="sg_wiTriggerMaxPlot" type="number" min="0" max="10" placeholder="3">
                </div>
              </div>

<div class="sg-grid2">
  <div class="sg-field">
    <label>匹配方式</label>
    <select id="sg_wiTriggerMatchMode">
      <option value="local">本地相似度（快）</option>
      <option value="llm">LLM 综合判断（可自定义提示词�?/option>
    </select>
  </div>
  <div class="sg-field">
    <label>预筛�?TopK（仅 LLM 模式�?/label>
    <input id="sg_wiIndexPrefilterTopK" type="number" min="5" max="80" placeholder="24">
    <div class="sg-hint">先用相似度挑 TopK，再交给模型选出最相关的几条（�?tokens）�?/div>
  </div>
</div>

<div class="sg-card sg-subcard" id="sg_index_llm_block" style="display:none; margin-top:10px;">
  <div class="sg-grid2">
    <div class="sg-field">
      <label>索引 Provider</label>
      <select id="sg_wiIndexProvider">
        <option value="st">使用酒馆当前连接的模�?/option>
        <option value="custom">使用独立 OpenAI 兼容 API</option>
      </select>
    </div>
    <div class="sg-field">
      <label>索引 Temperature</label>
      <input id="sg_wiIndexTemperature" type="number" min="0" max="2" step="0.1">
    </div>
  </div>

  <div class="sg-field">
    <label>自定义索引提示词（System，可选）</label>
    <textarea id="sg_wiIndexSystemPrompt" rows="6" placeholder="例如：更强调人物关系/线索回收/当前目标；或要求更严格的筛选�?></textarea>
  </div>
  <div class="sg-field">
    <label>索引模板（User，可选）</label>
    <textarea id="sg_wiIndexUserTemplate" rows="6" placeholder="支持占位符：{{userMessage}} {{recentText}} {{candidates}} {{maxPick}} {{maxCharacters}} {{maxEquipments}} {{maxFactions}} {{maxAchievements}} {{maxSubProfessions}} {{maxQuests}} {{maxPlot}}"></textarea>
  </div>
  <div class="sg-row sg-inline">
    <button class="menu_button sg-btn" id="sg_wiIndexResetPrompt">恢复默认索引提示�?/button>
    <div class="sg-hint" style="margin-left:auto">占位符：{{userMessage}} {{recentText}} {{candidates}} {{maxPick}} {{maxCharacters}} {{maxEquipments}} {{maxFactions}} {{maxAchievements}} {{maxSubProfessions}} {{maxQuests}} {{maxPlot}}。插件会强制要求输出 JSON：{pickedNames:string[]}�?/div>
  </div>

  <div class="sg-card sg-subcard" id="sg_index_custom_block" style="display:none">
    <div class="sg-grid2">
      <div class="sg-field">
        <label>索引独立API基础URL</label>
        <input id="sg_wiIndexCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
      </div>
      <div class="sg-field">
        <label>API Key</label>
        <input id="sg_wiIndexCustomApiKey" type="password" placeholder="sk-...">
      </div>
    </div>
    <div class="sg-grid2">
      <div class="sg-field">
        <label>模型ID（可手填�?/label>
        <input id="sg_wiIndexCustomModel" type="text" placeholder="gpt-4o-mini">
        <div class="sg-row sg-inline" style="margin-top:6px;">
          <button class="menu_button sg-btn" id="sg_refreshIndexModels">刷新模型</button>
          <select id="sg_wiIndexModelSelect" class="sg-model-select">
            <option value="">（选择模型�?/option>
          </select>
        </div>
      </div>
      <div class="sg-field">
        <label>Max Tokens</label>
        <input id="sg_wiIndexCustomMaxTokens" type="number" min="128" max="200000">
        <div class="sg-row sg-inline" style="margin-top:6px;">
          <span class="sg-hint">TopP</span>
          <input id="sg_wiIndexTopP" type="number" min="0" max="1" step="0.01" style="width:110px">
        </div>
      </div>
    </div>
    <label class="sg-check"><input type="checkbox" id="sg_wiIndexCustomStream">stream（若支持�?/label>
  </div>
</div>

              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label class="sg-check"><input type="checkbox" id="sg_wiTriggerIncludeUserMessage">结合本次用户输入（综合判断）</label>
                  <div class="sg-hint">开启后会综合“最�?N 条正�?+ 你这句话”来决定与当前剧情最相关的条目�?/div>
                </div>
                <div class="sg-field">
                  <label>用户输入权重�?~10�?/label>
                  <input id="sg_wiTriggerUserMessageWeight" type="number" min="0" max="10" step="0.1" placeholder="1.6">
                  <div class="sg-hint">越大越看重你这句话；1=与最近正文同权重�?/div>
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>相关度阈值（0~1�?/label>
                  <input id="sg_wiTriggerMinScore" type="number" min="0" max="1" step="0.01" placeholder="0.08">
                </div>
                <div class="sg-field">
                  <label>最多注入触发词</label>
                  <input id="sg_wiTriggerMaxKeywords" type="number" min="1" max="200" placeholder="24">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>至少已有 N �?AI 回复才开始索引（0=立即�?/label>
                  <input id="sg_wiTriggerStartAfterAssistantMessages" type="number" min="0" max="200000" placeholder="0">
                </div>
                <div class="sg-field">
                  <label>说明</label>
                  <div class="sg-hint" style="padding-top:8px;">（只统计 AI 回复楼层；例如填 100 表示�?100 层之后才注入�?/div>
                </div>
              </div>
              <div class="sg-row sg-inline">
                <label>注入方式</label>
                <select id="sg_wiTriggerInjectStyle" style="min-width:200px">
                  <option value="hidden">隐藏注释（推荐）</option>
                  <option value="plain">普通文本（更稳�?/option>
                </select>
              </div>
              <div class="sg-row sg-inline">
                <label>蓝灯索引</label>
                <select id="sg_wiBlueIndexMode" style="min-width:180px">
                  <option value="live">实时读取蓝灯世界�?/option>
                  <option value="cache">使用导入/缓存</option>
                </select>
                <input id="sg_wiBlueIndexFile" type="text" placeholder="蓝灯世界书文件名（留�?使用上方蓝灯写入文件名）" style="flex:1; min-width: 260px;">
                <button class="menu_button sg-btn" id="sg_refreshBlueIndexLive">刷新</button>
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_wiTriggerDebugLog">调试：状态栏显示命中条目/触发�?/label>
                <button class="menu_button sg-btn" id="sg_importBlueIndex">导入蓝灯世界书JSON（备用）</button>
                <button class="menu_button sg-btn" id="sg_clearBlueIndex">清空蓝灯索引</button>
                <div class="sg-hint" id="sg_blueIndexInfo" style="margin-left:auto">（蓝灯索引：0 条）</div>
              </div>
              <div class="sg-hint">
                说明：本功能会用“蓝灯索引”里的每条总结（title/summary/keywords）与 <b>最�?N 条正�?/b>（可选再加上 <b>本次用户输入</b>）做相似度匹配，选出最相关的几条，把它们的 <b>keywords</b> 追加到你刚发送的消息末尾（可选隐藏注�?普通文本），从而触发“绿灯世界书”的对应条目�?
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-row sg-inline" style="margin-top:0;">
                  <div class="sg-hint">ROLL 设置已移至独立的「ROLL 设置」标签页�?/div>
                  <div class="sg-spacer"></div>
                  <button class="menu_button sg-btn" id="sg_gotoRollPage">打开 ROLL 设置</button>
                </div>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-row sg-inline" style="margin-top:0;">
                  <div class="sg-card-title" style="margin:0;">索引日志</div>
                  <div class="sg-spacer"></div>
                  <button class="menu_button sg-btn" id="sg_clearWiLogs">清空</button>
                </div>
                <div class="sg-loglist" id="sg_wiLogs" style="margin-top:8px;">(暂无)</div>
                <div class="sg-hint" style="margin-top:8px;">提示：日志记录“这次发送消息时命中了哪些索引条目（等价于将触发的绿灯条目）”以及注入了哪些关键词�?/div>
              </div>
            </div>

            <div class="sg-card sg-subcard" id="sg_indexMovedHint" style="margin-top:10px;">
              <div class="sg-row sg-inline" style="margin-top:0;">
                <div class="sg-hint">索引相关设置已移至上方“索引设置”页�?/div>
                <div class="sg-spacer"></div>
                <button class="menu_button sg-btn" id="sg_gotoIndexPage">打开索引设置</button>
              </div>
            </div>

            <div class="sg-row sg-inline">
              <label>手动楼层范围</label>
              <input id="sg_summaryManualFrom" type="number" min="1" style="width:110px" placeholder="起始�?>
              <span> - </span>
              <input id="sg_summaryManualTo" type="number" min="1" style="width:110px" placeholder="结束�?>
              <button class="menu_button sg-btn" id="sg_summarizeRange">立即总结该范�?/button>
              <div class="sg-hint" id="sg_summaryManualHint" style="margin-left:auto">（可选范围：1-0�?/div>
            </div>

            <div class="sg-row sg-inline" style="margin-top:6px;">
              <label>手动大总结范围</label>
              <input id="sg_megaSummaryFrom" type="text" style="width:120px" placeholder="A-001">
              <span> - </span>
              <input id="sg_megaSummaryTo" type="text" style="width:120px" placeholder="A-080">
              <button class="menu_button sg-btn" id="sg_megaSummarizeRange">生成大总结</button>
              <div class="sg-hint" style="margin-left:auto">按索引号范围汇总，步长=大总结阈�?/div>
            </div>

            <div class="sg-row sg-inline" style="margin-top:6px;">
              <label class="sg-check" style="margin:0;"><input type="checkbox" id="sg_summaryManualSplit">手动范围按每 N 层拆分生成多条（N=上方“每 N 层总结一次”）</label>
              <div class="sg-hint" style="margin-left:auto">例如 1-80 �?N=40 �?2 �?/div>
            </div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_summarizeNow">立即总结</button>
              <button class="menu_button sg-btn" id="sg_stopSummary" style="background: var(--SmartThemeBodyColor); color: var(--SmartThemeQuoteColor);">停止总结</button>
              <button class="menu_button sg-btn" id="sg_resetSummaryState">重置本聊天总结进度</button>
              <button class="menu_button sg-btn" id="sg_undoLastSummary">撤销最近一次总结</button>
              <button class="menu_button sg-btn" id="sg_undoLastStructured">撤销最近一次结构化条目</button>
              <button class="menu_button sg-btn" id="sg_syncGreenFromBlue">对齐蓝灯→绿�?/button>
              <div class="sg-hint" id="sg_summaryInfo" style="margin-left:auto">（未生成�?/div>
            </div>

            <div class="sg-hint">
              自动总结会按“每 N 层”触发；每次输出会生�?<b>摘要</b> + <b>关键�?/b>，并可自动创建世界书条目（disable=0 绿灯启用，关键词写入 key 作为触发词）�?
            </div>
          </div>
          </div> <!-- sg_page_summary -->

          <div class="sg-page" id="sg_page_index">
            <div class="sg-card">
              <div class="sg-card-title">索引设置（蓝灯索�?�?绿灯触发�?/div>
              <div class="sg-hint" style="margin-bottom:10px;">索引会从“蓝灯世界书”里挑选与当前剧情最相关的总结条目，并把对应触发词注入到你发送的消息末尾，以触发绿灯世界书条目�?/div>
              <div id="sg_index_mount"></div>
            </div>
          </div> <!-- sg_page_index -->

          <div class="sg-page" id="sg_page_roll">
            <div class="sg-card">
              <div class="sg-card-title">ROLL 设置（判定）</div>
              <div class="sg-hint" style="margin-bottom:10px;">用于行动判定�?ROLL 注入与计算规则。ROLL 模块独立运行，不依赖总结或索引功能�?/div>
              
              <label class="sg-check"><input type="checkbox" id="sg_wiRollEnabled">启用 ROLL 点（战斗/劝说/学习等判定；与用户输入一起注入）</label>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>随机权重�?~1�?/label>
                  <input id="sg_wiRollRandomWeight" type="number" min="0" max="1" step="0.01" placeholder="0.3">
                </div>
                <div class="sg-field">
                  <label>难度模式</label>
                  <select id="sg_wiRollDifficulty">
                    <option value="simple">简�?/option>
                    <option value="normal">普�?/option>
                    <option value="hard">困难</option>
                    <option value="hell">地狱</option>
                  </select>
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>变量来源</label>
                  <select id="sg_wiRollStatSource">
                    <option value="variable">综合多来源（最稳定，推荐）</option>
                    <option value="template">模板渲染（stat_data�?/option>
                    <option value="latest">最新正文末�?/option>
                  </select>
                  <div class="sg-hint">综合模式按优先级尝试�?getvar命令 �?变量存储 �?模板渲染 �?DOM读取 �?最新AI回复</div>
                </div>
                <div class="sg-field">
                  <label>变量解析模式</label>
                  <select id="sg_wiRollStatParseMode">
                    <option value="json">JSON</option>
                    <option value="kv">键值行（pc.atk=10�?/option>
                  </select>
                </div>
              </div>
              <div class="sg-field">
                <label>变量名（用于"变量存储"来源�?/label>
                <input id="sg_wiRollStatVarName" type="text" placeholder="stat_data">
              </div>
              <div class="sg-row sg-inline">
                <label>注入方式</label>
                <select id="sg_wiRollInjectStyle">
                  <option value="hidden">隐藏注释</option>
                  <option value="plain">普通文�?/option>
                </select>
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check" style="margin:0;"><input type="checkbox" id="sg_wiRollDebugLog">调试：状态栏显示判定细节/未触发原�?/label>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>ROLL Provider</label>
                  <select id="sg_wiRollProvider">
                    <option value="custom">独立 API</option>
                    <option value="local">本地计算</option>
                  </select>
                </div>
              </div>
              <div class="sg-card sg-subcard" id="sg_roll_custom_block" style="display:none; margin-top:8px;">
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>ROLL 独立 API 基础URL</label>
                    <input id="sg_wiRollCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
                  </div>
                  <div class="sg-field">
                    <label>API Key</label>
                    <input id="sg_wiRollCustomApiKey" type="password" placeholder="sk-...">
                  </div>
                </div>
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>模型ID</label>
                    <input id="sg_wiRollCustomModel" type="text" placeholder="gpt-4o-mini">
                    <div class="sg-row sg-inline" style="margin-top:6px;">
                      <button class="menu_button sg-btn" id="sg_refreshRollModels">刷新模型</button>
                      <select id="sg_wiRollModelSelect" class="sg-model-select">
                        <option value="">（选择模型�?/option>
                      </select>
                    </div>
                  </div>
                  <div class="sg-field">
                    <label>Max Tokens</label>
                    <input id="sg_wiRollCustomMaxTokens" type="number" min="128" max="200000">
                  </div>
                </div>
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>Temperature</label>
                    <input id="sg_wiRollCustomTemperature" type="number" min="0" max="2" step="0.1">
                  </div>
                  <div class="sg-field">
                    <label>TopP</label>
                    <input id="sg_wiRollCustomTopP" type="number" min="0" max="1" step="0.01">
                  </div>
                </div>
                <label class="sg-check"><input type="checkbox" id="sg_wiRollCustomStream">stream（若支持�?/label>
                <div class="sg-field" style="margin-top:8px;">
                  <label>ROLL 系统提示�?/label>
                  <textarea id="sg_wiRollSystemPrompt" rows="5"></textarea>
                </div>
              </div>
              <div class="sg-hint">AI 会先判断是否需要判定，再计算并注入结果�?综合多来�?模式会尝试多种方式读取变量，确保最大兼容性�?/div>
            </div>
            <div class="sg-card sg-subcard" style="margin-top:10px;">
              <div class="sg-row sg-inline" style="margin-top:0;">
                <div class="sg-card-title" style="margin:0;">ROLL 日志</div>
                <div class="sg-spacer"></div>
                <button class="menu_button sg-btn" id="sg_clearRollLogs">清空</button>
              </div>
              <div class="sg-loglist" id="sg_rollLogs" style="margin-top:8px;">(暂无)</div>
              <div class="sg-hint" style="margin-top:8px;">提示：仅记录�?ROLL API 返回的简要计算摘要�?/div>
            </div>
          </div> <!-- sg_page_roll -->

          <div class="sg-page" id="sg_page_image">
            <div class="sg-card">
              <div class="sg-card-title">🎨 图像生成设置</div>
              <div class="sg-hint" style="margin-bottom:10px;">读取最新剧情内容，使用 LLM 生成标签，调�?Novel AI API 生成角色/场景图像�?/div>

              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_imageGenEnabled">启用图像生成模块</label>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">LLM 提示词生�?API</div>
                <div class="sg-hint">用于将剧情内容转换为图像生成标签（Tag�?/div>
                <div class="sg-grid2" style="margin-top:8px;">
                  <div class="sg-field">
                    <label>API 基础URL</label>
                    <input id="sg_imageGenCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
                  </div>
                  <div class="sg-field">
                    <label>API Key</label>
                    <input id="sg_imageGenCustomApiKey" type="password" placeholder="sk-...">
                  </div>
                </div>
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>模型</label>
                    <select id="sg_imageGenCustomModel">
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                    </select>
                  </div>
                  <div class="sg-field">
                    <label>Max Tokens</label>
                    <input id="sg_imageGenCustomMaxTokens" type="number" min="128" max="200000">
                  </div>
                </div>
                <div class="sg-row sg-inline" style="margin-top:6px; justify-content:flex-end;">
                  <button class="menu_button sg-btn" id="sg_imageGenRefreshModels">🔄 刷新模型</button>
                </div>

              </div>

               <div class="sg-card sg-subcard" style="margin-top:10px;">
                 <div class="sg-card-title" style="font-size:0.95em;">🧍 人物形象�?/div>
                 <div class="sg-hint">在剧情中匹配角色�?关键词后，会将该人物的标签自动拼到正向提示词前面�?/div>
                 <div class="sg-row sg-inline" style="margin-top:8px; gap:12px;">
                   <label class="sg-check"><input type="checkbox" id="sg_imageGenProfilesEnabled">启用人物形象匹配</label>
                   <button class="menu_button sg-btn" id="sg_imageGenProfileAdd">添加人物</button>
                   <div class="sg-row sg-inline sg-profile-scale-controls" style="gap:6px;">
                     <button class="menu_button sg-btn" id="sg_imageGenProfilesToggle">展开/折叠</button>
                   </div>
                 </div>
                 <div id="sg_imageGenProfiles" style="margin-top:8px;"></div>
               </div>


              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">Novel AI 图像 API</div>
                <div class="sg-field">
                  <label>Novel AI API Key</label>
                  <input id="sg_novelaiApiKey" type="password" placeholder="pst-...">
                  <div class="sg-hint">需�?Novel AI 订阅才能使用 API</div>
                </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>模型</label>
                  <select id="sg_novelaiModel">
                    <option value="nai-diffusion-4-5-full">NAI Diffusion V4.5 Full</option>
                    <option value="nai-diffusion-4-full">NAI Diffusion V4 Full</option>
                    <option value="nai-diffusion-4-curated-preview">NAI Diffusion V4 Curated</option>
                    <option value="nai-diffusion-3">NAI Diffusion V3</option>
                  </select>
                </div>
                <div class="sg-field">
                  <label>分辨�?/label>
                  <select id="sg_novelaiResolution">
                    <option value="832x1216">832×1216 (立绘)</option>
                    <option value="1216x832">1216×832 (横向)</option>
                    <option value="1024x1024">1024×1024 (方形)</option>
                    <option value="640x640">640×640 (�?</option>
                  </select>
                </div>
              </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>Steps</label>
                  <input id="sg_novelaiSteps" type="number" min="1" max="50">
                </div>
                <div class="sg-field">
                  <label>Scale (Guidance)</label>
                  <input id="sg_novelaiScale" type="number" min="1" max="10" step="0.5">
                </div>
              </div>

                <div class="sg-field">
                  <label>默认负面提示�?/label>
                  <textarea id="sg_novelaiNegativePrompt" rows="2" placeholder="lowres, bad anatomy, ..."></textarea>
                </div>

                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>Sampler</label>
                    <select id="sg_novelaiSampler">
                      <option value="k_euler">k_euler</option>
                      <option value="k_euler_ancestral">k_euler_ancestral</option>
                      <option value="k_dpmpp_2m">k_dpmpp_2m</option>
                      <option value="k_dpmpp_2m_sde">k_dpmpp_2m_sde</option>
                      <option value="k_dpmpp_sde">k_dpmpp_sde</option>
                      <option value="k_dpmpp_2s_a">k_dpmpp_2s_a</option>
                      <option value="k_dpmpp_sde_ancestral">k_dpmpp_sde_ancestral</option>
                      <option value="k_lms">k_lms</option>
                      <option value="k_heun">k_heun</option>
                      <option value="k_dpm_2">k_dpm_2</option>
                      <option value="k_dpm_2_ancestral">k_dpm_2_ancestral</option>
                    </select>
                  </div>
                  <div class="sg-field">
                    <label>固定 Seed</label>
                    <div class="sg-row sg-inline" style="gap:8px; align-items:center;">
                      <label class="sg-check"><input type="checkbox" id="sg_novelaiFixedSeedEnabled">启用</label>
                      <input id="sg_novelaiFixedSeed" type="number" min="0" max="4294967295" step="1" style="flex:1; min-width:120px;">
                    </div>
                  </div>
                </div>

                <div class="sg-grid2" style="margin-top:6px;">
                  <div class="sg-field">
                    <label>Prompt Guidance Rescale</label>
                    <input id="sg_novelaiCfgRescale" type="number" min="0" max="1" step="0.01">
                  </div>
                  <div class="sg-field">
                    <label>Noise Schedule</label>
                    <select id="sg_novelaiNoiseSchedule">
                      <option value="native">native</option>
                      <option value="karras">karras</option>
                      <option value="exponential">exponential</option>
                      <option value="polyexponential">polyexponential</option>
                    </select>
                  </div>
                </div>

                <div class="sg-row sg-inline" style="margin-top:6px; gap:12px;">
                  <label class="sg-check"><input type="checkbox" id="sg_novelaiLegacy">V4 Legacy (支持 :: 权重语法)</label>
                  <label class="sg-check"><input type="checkbox" id="sg_novelaiVarietyBoost">Variety Boost</label>
                </div>


                <hr class="sg-hr">

                <div class="sg-row sg-inline">
                  <label class="sg-check"><input type="checkbox" id="sg_imageGenAutoSave">自动保存生成的图�?/label>
                </div>

              <div class="sg-field">
                <label>保存路径（留空则仅显示不保存�?/label>
                <input id="sg_imageGenSavePath" type="text" placeholder="例如：C:/Images/Generated">
                <div class="sg-hint">图像会以时间戳命名保存到此目�?/div>
              </div>

              <hr class="sg-hr">

              <div class="sg-field">
                <label>读取最近消息数</label>
                <input id="sg_imageGenLookbackMessages" type="number" min="1" max="30">
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_imageGenReadStatData">读取角色状态变�?/label>
                <input id="sg_imageGenStatVarName" type="text" placeholder="stat_data" style="width:120px">
              </div>

              <div class="sg-field">
                <label>标签生成提示�?(System)</label>
                <textarea id="sg_imageGenSystemPrompt" rows="8" placeholder="用于�?LLM 生成 Danbooru 风格标签的提示词"></textarea>
                <div class="sg-actions-row">
                  <button class="menu_button sg-btn" id="sg_imageGenResetPrompt">恢复默认提示�?/button>
                </div>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">画师/正向提示�?/div>
                <div class="sg-hint">启用后会把该权重串追加到正向提示词最前面�?/div>
                <div class="sg-row sg-inline" style="margin-top:6px;">
                  <label class="sg-check"><input type="checkbox" id="sg_imageGenArtistPromptEnabled">启用画师/正向提示�?/label>
                </div>
                <div class="sg-field" style="margin-top:6px;">
                  <textarea id="sg_imageGenArtistPrompt" rows="4" placeholder="请输入权重串，如 1.2::artist:name ::, masterpiece"></textarea>
                </div>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">提示词替�?/div>
                <div class="sg-hint">对剧情文本进行替�?插入，再交给 LLM 生成标签（命中规则时生效）�?/div>
                <div class="sg-row sg-inline" style="margin-top:6px;">
                  <label class="sg-check"><input type="checkbox" id="sg_imageGenPromptRulesEnabled">启用提示词替�?/label>
                </div>
                <div class="sg-field" style="margin-top:6px;">
                  <textarea id="sg_imageGenPromptRules" rows="6" placeholder="触发�?前置前|插入�?
触发�?前置后|插入�?
触发�?替换|替换�?
# �?# �?// 开头为注释"></textarea>
                </div>
              </div>

               <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">批量提示词模�?/div>
                <div class="sg-hint">默认会生�?12 张：5 张剧情拆�?+ 7 张固定类型。一般不需要手动修改�?/div>
                <div class="sg-row sg-inline" style="margin-top:6px;">
                  <label class="sg-check"><input type="checkbox" id="sg_imageGenBatchEnabled">启用批量提示�?/label>
                </div>
                <div class="sg-grid2" style="margin-top:6px;">
                  <div class="sg-field">
                    <label>自定义女性提示词 1</label>
                    <textarea id="sg_imageGenCustomFemalePrompt1" rows="3" placeholder="例如�?girl, close-up, soft light, ..."></textarea>
                  </div>
                  <div class="sg-field">
                    <label>自定义女性提示词 2</label>
                    <textarea id="sg_imageGenCustomFemalePrompt2" rows="3" placeholder="例如�?girl, full body, dynamic pose, ..."></textarea>
                  </div>
                </div>
                <div class="sg-field" style="margin-top:6px;">
                  <textarea id="sg_imageGenBatchPatterns" rows="8" placeholder='[{"label":"剧情-1","type":"story","detail":"..."}]'></textarea>
                </div>
                <div class="sg-actions-row" style="margin-top:6px;">
                  <button class="menu_button sg-btn" id="sg_imageGenResetBatch">恢复默认模板</button>
                </div>
              </div>


              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">图像生成预设</div>
                <div class="sg-hint">保存/导入用于“正文→标签”的预设配置（支持导�?SillyTavern 对话预设 JSON）�?/div>
                <div class="sg-row sg-inline" style="margin-top:6px;">
                  <select id="sg_imageGenPresetSelect" style="min-width:160px;"></select>
                  <button class="menu_button sg-btn" id="sg_imageGenApplyPreset">应用</button>
                  <button class="menu_button sg-btn" id="sg_imageGenSavePreset">保存为预�?/button>
                  <button class="menu_button sg-btn" id="sg_imageGenDeletePreset">删除</button>
                </div>
                <div class="sg-row sg-inline" style="margin-top:6px;">
                  <button class="menu_button sg-btn" id="sg_imageGenExportPreset">导出预设</button>
                  <button class="menu_button sg-btn" id="sg_imageGenImportPreset">导入预设</button>
                </div>
              </div>

            </div>

            <div class="sg-card">
              <div class="sg-card-title">生成图像</div>

              <div class="sg-row sg-inline">
                <label>生成类型</label>
                <select id="sg_imageGenType">
                  <option value="auto">自动识别</option>
                  <option value="character">角色立绘</option>
                  <option value="scene">场景�?/option>
                </select>
                <button class="menu_button sg-btn-primary" id="sg_generateImage">🎨 根据剧情生成图像</button>
              </div>

              <div class="sg-field" id="sg_imagePromptPreview" style="display:none; margin-top:10px;">
                <label>生成的提示词</label>
                <textarea id="sg_imagePositivePrompt" rows="3" readonly style="background: var(--SmartThemeBlurTintColor);"></textarea>
                <div class="sg-row sg-inline" style="margin-top:6px;">
                  <button class="menu_button sg-btn" id="sg_editPromptAndGenerate">编辑并重新生�?/button>
                  <button class="menu_button sg-btn" id="sg_copyImagePrompt">📋 复制提示�?/button>
                </div>
              </div>

              <div id="sg_imageResult" class="sg-image-result" style="display:none; margin-top:12px;">
                <img id="sg_generatedImage" src="" alt="Generated Image" class="sg-image-zoom" style="max-width:100%; max-height:500px; border-radius:6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: zoom-in;">
                <div class="sg-row sg-inline" style="margin-top:8px; justify-content:center;">
                  <button class="menu_button sg-btn" id="sg_regenImage">🔄 重生�?/button>
                  <button class="menu_button sg-btn" id="sg_downloadImage">💾 保存图像</button>
                </div>
              </div>


              <div class="sg-hint" id="sg_imageGenStatus" style="margin-top:10px;"></div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">📚 在线图库（作者预设图片）</div>
              <div class="sg-hint" style="margin-bottom:10px;">�?GitHub 加载作者预先生成的图片库，AI 会根据剧情自动选择最匹配的图片�?/div>
              
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_imageGalleryEnabled">启用在线图库</label>
              </div>

              <div class="sg-field">
                <label>图库索引 URL</label>
                <input id="sg_imageGalleryUrl" type="text" placeholder="https://raw.githubusercontent.com/用户�?仓库/main/index.json">
                <div class="sg-hint">填入 GitHub Raw URL 指向图库�?index.json 文件</div>
              </div>

              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_loadGallery">📥 加载/刷新图库</button>
                <span class="sg-hint" id="sg_galleryInfo" style="margin-left:10px;">(未加�?</span>
              </div>

              <div class="sg-row sg-inline" style="margin-top:10px;">
                <button class="menu_button sg-btn-primary" id="sg_matchGalleryImage">🔍 根据剧情匹配图片</button>
              </div>

              <div id="sg_galleryResult" class="sg-image-result" style="display:none; margin-top:12px;">
                <div class="sg-hint" id="sg_galleryMatchReason" style="margin-bottom:8px;"></div>
                <img id="sg_matchedGalleryImage" src="" alt="Matched Image" class="sg-image-zoom" style="max-width:100%; max-height:500px; border-radius:6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: zoom-in;">
              </div>

            </div>
          </div>
          </div> <!-- sg_page_image -->

          <div class="sg-page" id="sg_page_sex">
            <div class="sg-card">
              <div class="sg-card-title">性爱指导</div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>启用</label>
                  <label class="sg-switch">
                    <input type="checkbox" id="sg_sexEnabled">
                    <span class="sg-slider"></span>
                  </label>
                </div>

                <div class="sg-field">
                  <label>Provider</label>
                  <select id="sg_sex_provider">
                    <option value="st">使用当前 SillyTavern API</option>
                    <option value="custom">独立API（OpenAI 兼容�?/option>
                  </select>
                </div>
              </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>temperature</label>
                  <input id="sg_sex_temperature" type="number" step="0.05" min="0" max="2">
                </div>
              </div>

              <div id="sg_sex_custom_block" class="sg-card sg-subcard" style="display:none;">
                <div class="sg-card-title">独立API 设置</div>

                <div class="sg-field">
                  <label>API基础URL（例�?https://api.openai.com/v1�?/label>
                  <input id="sg_sexCustomEndpoint" type="text" placeholder="https://xxx.com/v1">
                </div>

                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>API Key（可选）</label>
                    <input id="sg_sexCustomApiKey" type="password" placeholder="可留�?>
                  </div>
                  <div class="sg-field">
                    <label>模型（可手填�?/label>
                    <input id="sg_sexCustomModel" type="text" placeholder="gpt-4o-mini">
                  </div>
                </div>

                <div class="sg-row sg-inline">
                  <button class="menu_button sg-btn" id="sg_sexRefreshModels">检�?刷新模型</button>
                  <select id="sg_sexModelSelect" class="sg-model-select">
                    <option value="">(选择模型)</option>
                  </select>
                </div>

                <div class="sg-row">
                  <div class="sg-field sg-field-full">
                    <label>最大回复token�?/label>
                    <input id="sg_sexCustomMaxTokens" type="number" min="256" max="200000" step="1" placeholder="例如 2048">
                    <label class="sg-check" style="margin-top:8px;">
                      <input type="checkbox" id="sg_sexCustomStream"> 使用流式返回（stream=true�?
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">性爱指导世界�?/div>

              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_sexWorldbookEnabled">启用注入</label>
                <button class="menu_button sg-btn" id="sg_sexWorldbookImport">导入世界书（可多选）</button>
                <button class="menu_button sg-btn" id="sg_sexWorldbookClear">清空</button>
                <input type="file" id="sg_sexWorldbookImportFile" accept=".json" multiple style="display:none;">
              </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>最大注入字�?/label>
                <input id="sg_sexWorldbookMaxChars" type="number" min="500" max="200000">
                </div>
              </div>

              <div id="sg_sexWorldbookList" class="sg-wb-list"></div>
              <div class="sg-hint" id="sg_sexWorldbookInfo">(未导入世界书)</div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">自定义提示词</div>
              <div class="sg-field">
                <label>System</label>
                <textarea id="sg_sexSystemPrompt" rows="6" placeholder="用于控制风格与安全边�?></textarea>
              </div>
              <div class="sg-field">
                <label>User 模板</label>
                <textarea id="sg_sexUserTemplate" rows="4" placeholder="支持占位符：{{snapshot}} {{worldbook}} {{lastUser}} {{recentText}}"></textarea>
                <div class="sg-hint">占位符：{{snapshot}} {{worldbook}} {{lastUser}} {{recentText}} {{userNeed}}</div>
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_sexIncludeUserInput">Include user input (last user + recent chat)</label>
              </div>
              <div class="sg-row sg-inline" style="margin-top:6px;">
                <select id="sg_sexPresetSelect" style="min-width:160px;"></select>
                <button class="menu_button sg-btn" id="sg_sexApplyPreset">应用</button>
                <button class="menu_button sg-btn" id="sg_sexSavePreset">保存为预�?/button>
                <button class="menu_button sg-btn" id="sg_sexDeletePreset">删除</button>
                <button class="menu_button sg-btn" id="sg_sexExportPreset">导出预设</button>
                <button class="menu_button sg-btn" id="sg_sexImportPreset">导入预设</button>
              </div>
              <div class="sg-actions-row">
                <button class="menu_button sg-btn" id="sg_sexResetPrompt">恢复默认提示�?/button>
              </div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">生成</div>
              <div class="sg-field" style="margin-top:6px;">
                <label>用户需求（可选）</label>
                <textarea id="sg_sexUserNeed" rows="3" placeholder="例如：更温柔/更主�?更慢节奏/强调沟通与安全�?></textarea>
              </div>
              <div class="sg-actions-row">
                <button class="menu_button sg-btn-primary" id="sg_sex_generate">生成性爱指导</button>
                <button class="menu_button sg-btn" id="sg_sex_copy" disabled>复制</button>
                <button class="menu_button sg-btn" id="sg_sex_insert" disabled>插入输入�?/button>
              </div>
              <div class="sg-field" style="margin-top:10px;">
                <label>输出</label>
                <textarea id="sg_sex_output" rows="10" spellcheck="false"></textarea>
                <div class="sg-hint" id="sg_sex_status">· 生成后可复制或插入输入框 ·</div>
              </div>
            </div>
          </div> <!-- sg_page_sex -->

          <div class="sg-page" id="sg_page_character">
            <div class="sg-card sg-character-card">
              <div class="sg-card-title sg-character-title">轮回乐园 · 自定义角�?/div>

              <div class="sg-character-grid">
                <div class="sg-field">
                  <label>乐园</label>
                  <select id="sg_char_park">
                    <option value="">请选择所属乐�?/option>
                    <option value="轮回乐园">轮回乐园</option>
                    <option value="圣域乐园">圣域乐园</option>
                    <option value="守望乐园">守望乐园</option>
                    <option value="圣光乐园">圣光乐园</option>
                    <option value="死亡乐园">死亡乐园</option>
                    <option value="天启乐园">天启乐园</option>
                    <option value="CUSTOM">自定义乐�?/option>
                  </select>
                </div>
                <div class="sg-field" id="sg_char_park_custom_row" style="display:none;">
                  <label>自定义乐�?/label>
                  <input id="sg_char_park_custom" type="text" placeholder="输入乐园名称，例如：灰雾乐园">
                </div>
                <div class="sg-field sg-character-full" id="sg_char_park_traits_row" style="display:none;">
                  <label>乐园特点</label>
                  <textarea id="sg_char_park_traits" rows="3" placeholder="可选：描述该乐园的规则倾向、奖惩逻辑、常见任务风格等"></textarea>
                </div>

                <div class="sg-field">
                  <label>种族</label>
                  <select id="sg_char_race">
                    <option value="">请选择初始种族</option>
                    <option value="人类">人类</option>
                    <option value="精灵">精灵</option>
                    <option value="兽人">兽人</option>
                    <option value="半魔">半魔</option>
                    <option value="机巧">机巧</option>
                    <option value="异界">异界</option>
                    <option value="CUSTOM">自定义种�?/option>
                  </select>
                </div>
                <div class="sg-field" id="sg_char_race_custom_row" style="display:none;">
                  <label>自定义种�?/label>
                  <input id="sg_char_race_custom" type="text" placeholder="输入种族名称，例如：灰雾�?>
                </div>
                <div class="sg-field sg-character-full" id="sg_char_race_desc_row" style="display:none;">
                  <label>种族描述</label>
                  <textarea id="sg_char_race_desc" rows="2" placeholder="种族详细设定..."></textarea>
                </div>

                <div class="sg-field">
                  <label>天赋</label>
                  <select id="sg_char_talent">
                    <option value="">请选择初始天赋</option>
                    <option value="刀术专�?>刀术专�?/option>
                    <option value="重装精�?>重装精�?/option>
                    <option value="雷霆亲和">雷霆亲和</option>
                    <option value="死灵契印">死灵契印</option>
                    <option value="狙击专精">狙击专精</option>
                    <option value="元素疗愈">元素疗愈</option>
                    <option value="符文锻刻">符文锻刻</option>
                    <option value="幻象支配">幻象支配</option>
                    <option value="时空敏锐">时空敏锐</option>
                    <option value="违约追猎">违约追猎</option>
                    <option value="血脉觉�?>血脉觉�?/option>
                    <option value="机械改�?>机械改�?/option>
                    <option value="CUSTOM">自定义天�?/option>
                  </select>
                </div>
                <div class="sg-field" id="sg_char_talent_custom_row" style="display:none;">
                  <label>自定义天�?/label>
                  <input id="sg_char_talent_custom" type="text" placeholder="输入天赋名称，例如：灰雾行旅�?>
                </div>
                <div class="sg-field sg-character-full" id="sg_char_talent_desc_row" style="display:none;">
                  <label>天赋详情</label>
                  <textarea id="sg_char_talent_desc" rows="3" placeholder="天赋机制、收益、代�?.."></textarea>
                </div>

                <div class="sg-field sg-character-full">
                  <label>契约者编�?/label>
                  <input id="sg_char_contract" type="text" placeholder="可选：自定义契约者编号，例如：R-1037">
                </div>
              </div>

              <div class="sg-character-section-title">属性点分配</div>
              <div class="sg-character-attr-panel">
                <div class="sg-character-attr-header">
                  <div class="sg-character-attr-title">六维基础属�?/div>
                  <div class="sg-character-attr-actions">
                    <div class="sg-field sg-character-field-inline">
                      <label>难度</label>
                      <select id="sg_char_difficulty">
                        <option value="10">烬火绝境�?0�?/option>
                        <option value="20">断崖试炼�?0�?/option>
                        <option value="30">灰雾常阶�?0�?/option>
                        <option value="40">星辉晋阶�?0�?/option>
                        <option value="50">曙光恩典�?0�?/option>
                      </select>
                    </div>
                    <button class="menu_button sg-btn sg-character-mini" id="sg_char_random">随机设定</button>
                    <label class="sg-check sg-character-mini" style="margin-left:8px; font-size:12px; height:28px;" title="勾选后使用 AI 生成设定（API�?>
                      <input type="checkbox" id="sg_char_random_llm">AI
                    </label>
                  </div>
                </div>

                <div class="sg-character-attr-grid">
                  <div class="sg-character-attr-row">
                    <label>体质</label>
                    <input id="sg_char_attr_con" type="number" min="0" max="20" value="0">
                  </div>
                  <div class="sg-character-attr-row">
                    <label>智力</label>
                    <input id="sg_char_attr_int" type="number" min="0" max="20" value="0">
                  </div>
                  <div class="sg-character-attr-row">
                    <label>魅力</label>
                    <input id="sg_char_attr_cha" type="number" min="0" max="20" value="0">
                  </div>
                  <div class="sg-character-attr-row">
                    <label>力量</label>
                    <input id="sg_char_attr_str" type="number" min="0" max="20" value="0">
                  </div>
                  <div class="sg-character-attr-row">
                    <label>敏捷</label>
                    <input id="sg_char_attr_agi" type="number" min="0" max="20" value="0">
                  </div>
                  <div class="sg-character-attr-row">
                    <label>幸运</label>
                    <input id="sg_char_attr_luk" type="number" min="0" max="20" value="0">
                  </div>
                </div>

                <div class="sg-character-attr-meta">
                  <span id="sg_char_attr_total">已分配：0</span>
                  <span id="sg_char_attr_remain">剩余�?0</span>
                  <span class="sg-character-cap">单项上限�?0</span>
                </div>
              </div>

              <div class="sg-card sg-subcard sg-character-provider">
                <div class="sg-card-title">生成设置</div>
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>生成API</label>
                    <select id="sg_char_provider">
                      <option value="st">使用当前 SillyTavern API（推荐）</option>
                      <option value="custom">独立API（走酒馆后端代理�?/option>
                    </select>
                  </div>
                  <div class="sg-field">
                    <label>temperature</label>
                    <input id="sg_char_temperature" type="number" step="0.05" min="0" max="2">
                  </div>
                </div>

                <div class="sg-card sg-subcard" id="sg_char_custom_block" style="display:none;">
                  <div class="sg-card-title">独立API 设置（建议填 API基础URL�?/div>
                  <div class="sg-field">
                    <label>API基础URL（例�?https://api.openai.com/v1 �?/label>
                    <input id="sg_char_customEndpoint" type="text" placeholder="https://xxx.com/v1">
                  </div>
                  <div class="sg-grid2">
                    <div class="sg-field">
                      <label>API Key（可选）</label>
                      <input id="sg_char_customApiKey" type="password" placeholder="可留�?>
                    </div>
                    <div class="sg-field">
                      <label>模型（可手填�?/label>
                      <div class="sg-row sg-inline" style="gap:4px;">
                        <input id="sg_char_customModel" type="text" placeholder="gpt-4o-mini" style="flex:1;" list="sg_char_model_list">
                        <datalist id="sg_char_model_list"></datalist>
                        <button class="menu_button sg-btn sg-character-mini" id="sg_char_refreshModels" title="刷新模型列表（仅 Custom�?>🔄</button>
                      </div>
                    </div>
                  </div>
                  <div class="sg-row">
                    <div class="sg-field sg-field-full">
                      <label>最大回复token�?/label>
                      <input id="sg_char_customMaxTokens" type="number" min="256" max="200000" step="1" placeholder="例如�?096">
                      <label class="sg-check" style="margin-top:8px;">
                        <input type="checkbox" id="sg_char_customStream"> 使用流式返回（stream=true�?
                      </label>
                    </div>
                  </div>
                </div>
                <div class="sg-card sg-subcard sg-character-provider">
                 <div class="sg-card-title">提示词设�?/div>
                 <div class="sg-field">
                   <label>自定义随机设定提示词（留空使用默认）</label>
                   <textarea id="sg_char_prompt_random" rows="3" placeholder="默认：请为“轮回乐园”设计一个全新的契约者角�?.."></textarea>
                 </div>
                 <div class="sg-field">
                   <label>自定义开场白提示词（留空使用默认�?/label>
                   <textarea id="sg_char_prompt_opening" rows="3" placeholder="默认：请根据以上人物设定写一段开场剧�?.."></textarea>
                 </div>
              </div>
              </div>

              <div class="sg-actions-row">
                <button class="menu_button sg-btn-primary" id="sg_char_generate">生成开场文�?/button>
                <button class="menu_button sg-btn" id="sg_char_copy">复制</button>
                <button class="menu_button sg-btn" id="sg_char_insert">填入聊天�?/button>
              </div>

              <div class="sg-field" style="margin-top:10px;">
                <label>开场文本（不会自动发送）</label>
                <textarea id="sg_char_output" rows="10" spellcheck="false"></textarea>
                <div class="sg-hint" id="sg_char_status">· 生成后可复制或填入聊天输入框 ·</div>
              </div>
            </div>
          </div> <!-- sg_page_character -->

          <div class="sg-page" id="sg_page_parallel">
            <div class="sg-card">
              <div class="sg-card-title">🌍 平行世界（NPC离屏模拟�?/div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>启用</label>
                  <label class="sg-switch">
                    <input type="checkbox" id="sg_parallelWorldEnabled">
                    <span class="sg-slider"></span>
                  </label>
                </div>
                <div class="sg-field">
                  <label>写回世界�?/label>
                  <label class="sg-switch">
                    <input type="checkbox" id="sg_parallelWorldWriteToWorldbook">
                    <span class="sg-slider"></span>
                  </label>
                </div>
              </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>注入AI上下�?/label>
                  <label class="sg-switch">
                    <input type="checkbox" id="sg_parallelWorldInjectContext">
                    <span class="sg-slider"></span>
                  </label>
                </div>
                <div class="sg-field">
                  <label>每NPC最大事件数</label>
                  <input id="sg_parallelWorldMaxEventsPerNpc" type="number" min="3" max="50">
                </div>
              </div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">世界时钟</div>
              <div class="sg-pw-clock-row">
                <span class="sg-pw-clock-icon">🕐</span>
                <span class="sg-pw-clock" id="sg_pwClockDisplay">�?�?/span>
                <span class="sg-hint" style="margin-left:10px;">(自动从正文提�?</span>
              </div>
              <div class="sg-grid2" style="margin-top:8px;">
                <div class="sg-field">
                  <label>读取正文楼层�?/label>
                  <input id="sg_parallelWorldReadFloors" type="number" min="1" max="50" placeholder="5">
                </div>
                <div class="sg-field">
                  <label>手动设置时间(可�?</label>
                  <div style="display:flex;gap:6px;">
                    <input id="sg_parallelWorldClock" type="text" placeholder="留空=自动提取" style="flex:1;">
                    <button class="menu_button sg-btn" id="sg_pwClockSet" style="flex-shrink:0;">设置</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">追踪列表</div>
                <div class="sg-pw-list-container">
                  <div class="sg-pw-list-header">
                    <span>NPC追踪列表</span>
                    <small>勾选需要模拟离屏事件的NPC。列表来自结构化条目中的角色�?/small>
                  </div>
                  <div id="sg_pwNpcList" class="sg-pw-list-content">
                    <div class="sg-hint">点击下方刷新按钮加载列表�?/div>
                  </div>
                </div>

                <div class="sg-pw-list-container" style="margin-top:10px;">
                  <div class="sg-pw-list-header">
                    <span>势力追踪列表</span>
                    <small>勾选需要模拟离屏事件的势力。列表来自结构化条目中的势力�?/small>
                  </div>
                  <div id="sg_pwFactionList" class="sg-pw-list-content">
                    <div class="sg-hint">点击下方刷新按钮加载列表�?/div>
                  </div>
                </div>

                <div style="margin-top:10px;">
                  <button id="sg_pwRefreshNpcList" class="menu_button sg-btn">刷新追踪列表</button>
                </div>
                <div class="sg-field" style="margin-top:8px;">
                <label>手动添加NPC名称</label>
                <div style="display:flex;gap:6px;">
                  <input id="sg_pwManualNpcName" type="text" placeholder="输入NPC名称" style="flex:1;">
                  <button class="menu_button sg-btn" id="sg_pwAddManualNpc">添加</button>
                </div>
              </div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">推演设置</div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>自动推演</label>
                  <label class="sg-switch">
                    <input type="checkbox" id="sg_parallelWorldAutoTrigger">
                    <span class="sg-slider"></span>
                  </label>
                </div>
                <div class="sg-field">
                  <label>每隔N条AI回复</label>
                  <input id="sg_parallelWorldAutoEvery" type="number" min="1" max="50">
                </div>
              </div>
              <div class="sg-actions-row" style="margin-top:10px;">
                <button class="menu_button sg-btn-primary" id="sg_pwRunSimulation">🌍 立即推演</button>
                <button class="menu_button sg-btn" id="sg_pwClearLog">🗑�?清空日志</button>
              </div>
              <div class="sg-status" id="sg_parallelWorldStatus"></div>
            </div>

            <div class="sg-card sg-subcard">
              <div class="sg-card-title">API 设置</div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>Provider</label>
                  <select id="sg_parallelWorldProvider">
                    <option value="st">使用当前 SillyTavern API</option>
                    <option value="custom">独立API</option>
                  </select>
                </div>
                <div class="sg-field">
                  <label>temperature</label>
                  <input id="sg_parallelWorldTemperature" type="number" step="0.05" min="0" max="2">
                </div>
              </div>
              <div class="sg-card sg-subcard sg-parallel-provider" id="sg_parallelCustomBlock" style="display:none;">
                <div class="sg-field">
                  <label>API 基础URL</label>
                  <input id="sg_parallelWorldCustomEndpoint" type="text" placeholder="https://api.example.com/v1">
                </div>
                <div class="sg-field">
                  <label>API Key</label>
                  <input id="sg_parallelWorldCustomApiKey" type="password" placeholder="sk-...">
                </div>
                <div class="sg-field">
                  <label>模型</label>
                  <div style="display:flex;gap:4px;">
                    <select id="sg_parallelWorldCustomModel" style="flex:1;"></select>
                    <button class="menu_button sg-btn" id="sg_refreshParallelWorldModels">🔄</button>
                  </div>
                </div>
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>Max Tokens</label>
                    <input id="sg_parallelWorldCustomMaxTokens" type="number" min="256" max="200000">
                  </div>
                  <div class="sg-field">
                    <label>top_p</label>
                    <input id="sg_parallelWorldCustomTopP" type="number" step="0.01" min="0" max="1">
                  </div>
                </div>
                <label class="sg-check"><input type="checkbox" id="sg_parallelWorldCustomStream"> 流式返回</label>
              </div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">事件日志</div>
              <div id="sg_pwEventLog" class="sg-pw-event-log">
                <div class="sg-hint">暂无事件记录。点击「立即推演」开始模拟�?/div>
              </div>
            </div>

            <div class="sg-card sg-subcard">
              <div class="sg-card-title">自定义提示词</div>
              <div class="sg-field">
                <label>System Prompt</label>
                <textarea id="sg_parallelWorldSystemPrompt" rows="6" spellcheck="false"></textarea>
              </div>
              <div class="sg-field">
                <label>User Template（支�?{{worldTime}} {{recentContext}} {{npcProfiles}}�?/label>
                <textarea id="sg_parallelWorldUserTemplate" rows="4" spellcheck="false"></textarea>
              </div>
              <button class="menu_button sg-btn" id="sg_pwResetPrompts" style="margin-top:6px;">恢复默认提示�?/button>
            </div>
          </div> <!-- sg_page_parallel -->

          <div class="sg-status" id="sg_status"></div>
        </div>

        <div class="sg-right">
          <div class="sg-card">
            <div class="sg-card-title">输出</div>

            <div class="sg-tabs">
              <button class="sg-tab active" id="sg_tab_md">报告</button>
              <button class="sg-tab" id="sg_tab_json">JSON</button>
              <button class="sg-tab" id="sg_tab_src">来源</button>
              <button class="sg-tab" id="sg_tab_sum">总结</button>
              <button class="sg-tab" id="sg_tab_sex">性爱指导</button>
              <div class="sg-spacer"></div>
              <button class="menu_button sg-btn" id="sg_copyMd" disabled>复制MD</button>
              <button class="menu_button sg-btn" id="sg_copyJson" disabled>复制JSON</button>
              <button class="menu_button sg-btn" id="sg_copySum" disabled>复制总结</button>
              <button class="menu_button sg-btn" id="sg_injectTips" disabled>注入提示</button>
            </div>

            <div class="sg-pane active" id="sg_pane_md"><div class="sg-md" id="sg_md">(尚未生成)</div></div>
            <div class="sg-pane" id="sg_pane_json"><pre class="sg-pre" id="sg_json"></pre></div>
            <div class="sg-pane" id="sg_pane_src"><pre class="sg-pre" id="sg_src"></pre></div>
            <div class="sg-pane" id="sg_pane_sum"><div class="sg-md" id="sg_sum">(尚未生成)</div></div>
            <div class="sg-pane" id="sg_pane_sex">
              <div class="sg-card">
                <div class="sg-card-title">性爱指导面板</div>
                <div class="sg-field">
                  <label>用户需�?/label>
                  <textarea id="sg_sex_panel_need" rows="3" placeholder="输入你的需求：例如更温�?更主�?更慢节奏/强调沟通与安全�?></textarea>
                </div>
                <div class="sg-actions-row">
                  <button class="menu_button sg-btn-primary" id="sg_sex_panel_generate">生成性爱指导</button>
                  <button class="menu_button sg-btn" id="sg_sex_panel_send" disabled>发送到聊天</button>
                </div>
                <div class="sg-field" style="margin-top:10px;">
                  <label>输出</label>
                  <textarea id="sg_sex_panel_output" rows="10" spellcheck="false"></textarea>
                  <div class="sg-hint" id="sg_sex_panel_status">· 生成后可发送到聊天 ·</div>
                </div>
              </div>
            </div>
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

  // --- settings pages (剧情指导 / 总结设置 / 索引设置 / ROLL 设置) ---
  setupSettingsPages();

  $('#sg_modal_backdrop').on('click', (e) => {
    if (e.target && e.target.id === 'sg_modal_backdrop') closeModal();
  });
  $('#sg_close').on('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
  $('#sg_close').on('pointerdown', (e) => {
    e.stopPropagation();
  });

  $('#sg_close').on('pointerup', (e) => {
    e.stopPropagation();
  });


  $('#sg_tab_md').on('click', () => showPane('md'));
  $('#sg_tab_json').on('click', () => showPane('json'));
  $('#sg_tab_src').on('click', () => showPane('src'));
  $('#sg_tab_sum').on('click', () => showPane('sum'));
  $('#sg_tab_sex').on('click', () => showPane('sex'));

  $('#sg_saveSettings').on('click', () => {
    pullUiToSettings();
    saveSettings();
    setStatus('已保存设�?, 'ok');
  });

  $('#sg_analyze').on('click', async () => {
    pullUiToSettings();
    saveSettings();
    await runAnalysis();
  });

  $('#sg_saveWorld').on('click', async () => {
    try { await setChatMetaValue(META_KEYS.world, String($('#sg_worldText').val() || '')); setStatus('已保存：世界�?设定补充（本聊天�?, 'ok'); }
    catch (e) { setStatus(`保存失败�?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_saveCanon').on('click', async () => {
    try { await setChatMetaValue(META_KEYS.canon, String($('#sg_canonText').val() || '')); setStatus('已保存：原著后续/大纲（本聊天�?, 'ok'); }
    catch (e) { setStatus(`保存失败�?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_copyMd').on('click', async () => {
    try { await navigator.clipboard.writeText(lastReport?.markdown ?? ''); setStatus('已复制：Markdown 报告', 'ok'); }
    catch (e) { setStatus(`复制失败�?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_copyJson').on('click', async () => {
    try { await navigator.clipboard.writeText(lastJsonText || ''); setStatus('已复制：JSON', 'ok'); }
    catch (e) { setStatus(`复制失败�?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_copySum').on('click', async () => {
    try { await navigator.clipboard.writeText(lastSummaryText || ''); setStatus('已复制：总结', 'ok'); }
    catch (e) { setStatus(`复制失败�?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_injectTips').on('click', () => {
    const tips = Array.isArray(lastReport?.json?.tips) ? lastReport.json.tips : [];
    const spoiler = ensureSettings().spoilerLevel;
    const text = tips.length
      ? `/sys 【剧情指导提示｜${spoiler}】\n` + tips.map((t, i) => `${i + 1}. ${t}`).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n')
      : (lastReport?.markdown ?? '');

    const $ta = $('#send_textarea');
    if ($ta.length) { $ta.val(text).trigger('input'); setStatus('已把提示放入输入框（你可以手动发送）', 'ok'); }
    else setStatus('找不到输入框 #send_textarea，无法注�?, 'err');
  });

  $('#sg_provider').on('change', () => {
    const provider = String($('#sg_provider').val());
    $('#sg_custom_block').toggle(provider === 'custom');
  });

  // Template Selector Logic
  const updateStructuredEditor = () => {
    const type = $('#sg_structuredTypeSelector').val();
    const typeKey = type.charAt(0).toUpperCase() + type.slice(1);
    const promptId = `#sg_structured${typeKey}Prompt`;
    const templateId = `#sg_structured${typeKey}EntryTemplate`;

    $('#sg_structured_type_prompt').val($(promptId).val());
    $('#sg_structured_type_template').val($(templateId).val());

    // Update hint based on type
    let hint = '';
    switch (type) {
      case 'character': hint = '占位符：{{name}} {{aliases}} {{gender}} {{faction}} {{status}} {{personality}} {{background}} {{sixStats}} {{equipment}} {{skillsTalents}} {{inventory}} {{sexLife}} {{corePersonality}} {{motivation}} {{relationshipStage}} {{relationToProtagonist}} {{keyEvents}} {{extraFields}}'; break;
      case 'equipment': hint = '占位符：{{name}} {{uid}} {{type}} {{rarity}} {{effects}} {{source}} {{currentState}} {{statInfo}} {{boundEvents}} {{extraFields}}'; break;
      case 'inventory': hint = '占位符：{{name}} {{uid}} {{aliases}} {{type}} {{rarity}} {{quantity}} {{effects}} {{source}} {{currentState}} {{statInfo}} {{boundEvents}} {{extraFields}}'; break;
      case 'faction': hint = '占位符：{{name}} {{uid}} {{aliases}} {{type}} {{scope}} {{leader}} {{ideology}} {{relationToProtagonist}} {{status}} {{keyEvents}} {{statInfo}} {{extraFields}}'; break;
      case 'achievement': hint = '占位符：{{name}} {{uid}} {{description}} {{requirements}} {{obtainedAt}} {{status}} {{effects}} {{keyEvents}} {{statInfo}} {{extraFields}}'; break;
      case 'subProfession': hint = '占位符：{{name}} {{uid}} {{role}} {{level}} {{progress}} {{skills}} {{source}} {{status}} {{keyEvents}} {{statInfo}} {{extraFields}}'; break;
      case 'quest': hint = '占位符：{{name}} {{uid}} {{goal}} {{progress}} {{status}} {{issuer}} {{reward}} {{deadline}} {{location}} {{keyEvents}} {{statInfo}} {{extraFields}}'; break;
      case 'conquest': hint = '占位符：{{name}} {{aliases}} {{identity}} {{firstEncounter}} {{conquestProcess}} {{conquestTime}} {{currentRelation}} {{specialTechniques}} {{bodyFeatures}} {{status}} {{keyEvents}} {{statInfo}} {{extraFields}}'; break;
    }
    $('#sg_structured_type_hint').text(hint);
  };

  $('#sg_structuredTypeSelector').on('change', updateStructuredEditor);

  $('#sg_structured_type_prompt, #sg_structured_type_template').on('input', () => {
    const type = $('#sg_structuredTypeSelector').val();
    const typeKey = type.charAt(0).toUpperCase() + type.slice(1);
    const promptId = `#sg_structured${typeKey}Prompt`;
    const templateId = `#sg_structured${typeKey}EntryTemplate`;

    $(promptId).val($('#sg_structured_type_prompt').val());
    $(templateId).val($('#sg_structured_type_template').val());

    // Trigger the change on hidden elements so auto-save logic picks it up
    $(promptId).trigger('change');
    $(templateId).trigger('change');
  });

  // Initial update
  setTimeout(updateStructuredEditor, 100);

  // structured presets
  $('#sg_structuredSavePreset').on('click', () => {
    const name = normalizeStructuredPresetName(prompt('预设名称�?) || '');
    if (!name) return;
    const list = getStructuredPresetList();
    const snapshot = getStructuredPresetSnapshot();
    const idx = list.findIndex(p => p?.name === name);
    if (idx >= 0) list[idx] = { name, snapshot };
    else list.push({ name, snapshot });
    setStructuredPresetList(list);
    const s = ensureSettings();
    s.structuredPresetActive = name;
    saveSettings();
    pullSettingsToUi();
    setStatus('预设已保�?, 'ok');
  });

  $('#sg_structuredApplyPreset').on('click', () => {
    const name = String($('#sg_structuredPresetSelect').val() || '').trim();
    if (!name) return;
    const list = getStructuredPresetList();
    const preset = list.find(p => p?.name === name);
    if (!preset) return;
    applyStructuredPresetSnapshot(preset.snapshot);
    const s = ensureSettings();
    s.structuredPresetActive = name;
    saveSettings();
    setStatus('预设已应�?, 'ok');
  });

  $('#sg_structuredDeletePreset').on('click', () => {
    const name = String($('#sg_structuredPresetSelect').val() || '').trim();
    if (!name) return;
    const list = getStructuredPresetList().filter(p => p?.name !== name);
    setStructuredPresetList(list);
    const s = ensureSettings();
    if (s.structuredPresetActive === name) s.structuredPresetActive = '';
    saveSettings();
    pullSettingsToUi();
    setStatus('预设已删�?, 'ok');
  });

  $('#sg_structuredExportPreset').on('click', () => {
    const name = String($('#sg_structuredPresetSelect').val() || '').trim();
    const list = getStructuredPresetList();
    const preset = list.find(p => p?.name === name);
    if (!preset) {
      setStatus('请选择一个预设再导出', 'warn');
      return;
    }
    const payload = {
      _type: 'StoryGuide_StructuredPreset',
      _version: '1.0',
      _exportedAt: new Date().toISOString(),
      name: preset.name,
      snapshot: preset.snapshot
    };
    downloadTextFile(`storyguide-structured-preset-${preset.name}.json`, JSON.stringify(payload, null, 2));
    setStatus('预设已导�?, 'ok');
  });

  $('#sg_structuredImportPreset').on('click', async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const txt = await readFileText(file);
      const data = JSON.parse(txt);
      let preset = null;

      if (data && data._type === 'StoryGuide_StructuredPreset') {
        const name = normalizeStructuredPresetName(data.name || '未命�?);
        if (!name) return;
        preset = { name, snapshot: data.snapshot || {} };
      } else {
        preset = resolveStructuredPresetFromSillyPreset(txt, file?.name || '对话预设');
      }

      if (!preset || !preset.name) {
        setStatus('预设文件格式不正�?, 'err');
        return;
      }

      const list = getStructuredPresetList();
      const idx = list.findIndex(p => p?.name === preset.name);
      if (idx >= 0) list[idx] = preset;
      else list.push(preset);
      setStructuredPresetList(list);
      const s = ensureSettings();
      s.structuredPresetActive = preset.name;
      saveSettings();
      pullSettingsToUi();
      setStatus('预设已导�?, 'ok');
    } catch (e) {
      setStatus(`导入失败�?{e?.message ?? e}`, 'err');
    }
  });


  // summary provider toggle
  $('#sg_summaryProvider').on('change', () => {
    const p = String($('#sg_summaryProvider').val() || 'st');
    $('#sg_summary_custom_block').toggle(p === 'custom');
    pullUiToSettings(); saveSettings();
  });

  // roll provider toggle
  $('#sg_wiRollProvider').on('change', () => {
    const p = String($('#sg_wiRollProvider').val() || 'custom');
    $('#sg_roll_custom_block').toggle(p === 'custom');
    pullUiToSettings(); saveSettings();
  });


  // wiTrigger match mode toggle
  $('#sg_wiTriggerMatchMode').on('change', () => {
    const m = String($('#sg_wiTriggerMatchMode').val() || 'local');
    $('#sg_index_llm_block').toggle(m === 'llm');
    const p = String($('#sg_wiIndexProvider').val() || 'st');
    $('#sg_index_custom_block').toggle(m === 'llm' && p === 'custom');
    pullUiToSettings(); saveSettings();
  });

  // index provider toggle (only meaningful under LLM mode)
  $('#sg_wiIndexProvider').on('change', () => {
    const m = String($('#sg_wiTriggerMatchMode').val() || 'local');
    const p = String($('#sg_wiIndexProvider').val() || 'st');
    $('#sg_index_custom_block').toggle(m === 'llm' && p === 'custom');
    pullUiToSettings(); saveSettings();
  });

  // index prompt reset
  $('#sg_wiIndexResetPrompt').on('click', () => {
    $('#sg_wiIndexSystemPrompt').val(DEFAULT_INDEX_SYSTEM_PROMPT);
    $('#sg_wiIndexUserTemplate').val(DEFAULT_INDEX_USER_TEMPLATE);
    pullUiToSettings();
    saveSettings();
    setStatus('已恢复默认索引提示词 �?, 'ok');
  });



  $('#sg_summaryToBlueWorldInfo').on('change', () => {
    const checked = $('#sg_summaryToBlueWorldInfo').is(':checked');
    $('#sg_summaryBlueWorldInfoFile').toggle(!!checked);
    pullUiToSettings(); saveSettings();
    updateBlueIndexInfoLabel();
  });

  // summary key mode toggle (keywords vs indexId)
  $('#sg_summaryWorldInfoKeyMode').on('change', () => {
    const m = String($('#sg_summaryWorldInfoKeyMode').val() || 'keywords');
    $('#sg_summaryIndexFormat').toggle(m === 'indexId');
    pullUiToSettings();
    saveSettings();
  });

  // summary prompt reset
  $('#sg_summaryResetPrompt').on('click', () => {
    $('#sg_summarySystemPrompt').val(DEFAULT_SUMMARY_SYSTEM_PROMPT);
    $('#sg_summaryUserTemplate').val(DEFAULT_SUMMARY_USER_TEMPLATE);
    pullUiToSettings();
    saveSettings();
    setStatus('已恢复默认总结提示�?�?, 'ok');
  });

  // structured entries prompt reset + cache clear
  $('#sg_structuredResetPrompt').on('click', () => {
    $('#sg_structuredEntriesSystemPrompt').val(DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT);
    $('#sg_structuredEntriesUserTemplate').val(DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE);
    $('#sg_structuredCharacterPrompt').val(DEFAULT_STRUCTURED_CHARACTER_PROMPT);
    $('#sg_structuredCharacterEntryTemplate').val(DEFAULT_STRUCTURED_CHARACTER_ENTRY_TEMPLATE);
    $('#sg_structuredEquipmentPrompt').val(DEFAULT_STRUCTURED_EQUIPMENT_PROMPT);
    $('#sg_structuredEquipmentEntryTemplate').val(DEFAULT_STRUCTURED_EQUIPMENT_ENTRY_TEMPLATE);
    $('#sg_structuredInventoryPrompt').val(DEFAULT_STRUCTURED_INVENTORY_PROMPT);
    $('#sg_structuredInventoryEntryTemplate').val(DEFAULT_STRUCTURED_INVENTORY_ENTRY_TEMPLATE);
    $('#sg_structuredFactionPrompt').val(DEFAULT_STRUCTURED_FACTION_PROMPT);
    $('#sg_structuredFactionEntryTemplate').val(DEFAULT_STRUCTURED_FACTION_ENTRY_TEMPLATE);
    $('#sg_structuredAchievementPrompt').val(DEFAULT_STRUCTURED_ACHIEVEMENT_PROMPT);
    $('#sg_structuredAchievementEntryTemplate').val(DEFAULT_STRUCTURED_ACHIEVEMENT_ENTRY_TEMPLATE);
    $('#sg_structuredSubProfessionPrompt').val(DEFAULT_STRUCTURED_SUBPROFESSION_PROMPT);
    $('#sg_structuredSubProfessionEntryTemplate').val(DEFAULT_STRUCTURED_SUBPROFESSION_ENTRY_TEMPLATE);
    $('#sg_structuredQuestPrompt').val(DEFAULT_STRUCTURED_QUEST_PROMPT);
    $('#sg_structuredQuestEntryTemplate').val(DEFAULT_STRUCTURED_QUEST_ENTRY_TEMPLATE);
    $('#sg_structuredConquestPrompt').val(DEFAULT_STRUCTURED_CONQUEST_PROMPT);
    $('#sg_structuredConquestEntryTemplate').val(DEFAULT_STRUCTURED_CONQUEST_ENTRY_TEMPLATE);
    pullUiToSettings();
    saveSettings();
    updateStructuredEditor(); // Refresh the visible textareas
    setStatus('已恢复默认结构化提示词与模板 �?, 'ok');
  });

  $('#sg_clearStructuredCache').on('click', async () => {
    try {
      await clearStructuredEntriesCache();
      setStatus('已清除结构化条目缓存 �?, 'ok');
    } catch (e) {
      setStatus(`清除结构化条目缓存失败：${e?.message ?? e}`, 'err');
    }
  });

  // manual range split toggle & hint refresh
  $('#sg_summaryManualSplit').on('change', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryManualRangeHint(false);
  });
  $('#sg_summaryManualFrom, #sg_summaryManualTo, #sg_summaryEvery, #sg_summaryCountMode, #sg_megaSummaryFrom, #sg_megaSummaryTo').on('input change', () => {
    // count mode / every affects the computed floor range and split pieces
    updateSummaryManualRangeHint(false);
  });

  // summary actions
  $('#sg_summarizeNow').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      await runSummary({ reason: 'manual' });
    } catch (e) {
      setStatus(`总结失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_syncGreenFromBlue').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      await syncGreenWorldInfoFromBlue();
    } catch (e) {
      setStatus(`对齐失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_stopSummary').on('click', () => {
    stopSummary();
    setStatus('正在停止总结�?, 'warn');
  });

  $('#sg_undoLastSummary').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      if (!confirm('确认撤销最近一次总结？将同时删除绿灯/蓝灯条目（不回滚结构化条目）�?)) return;
      await rollbackLastSummary();
    } catch (e) {
      setStatus(`撤销失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_undoLastStructured').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      if (!confirm('确认撤销最近一次结构化条目？不会删除剧情总结�?)) return;
      await rollbackLastStructuredEntries();
    } catch (e) {
      setStatus(`撤销失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_summarizeRange').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      const from = clampInt($('#sg_summaryManualFrom').val(), 1, 200000, 1);
      const to = clampInt($('#sg_summaryManualTo').val(), 1, 200000, 1);
      await runSummary({ reason: 'manual_range', manualFromFloor: from, manualToFloor: to });
    } catch (e) {
      setStatus(`手动范围总结失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_megaSummarizeRange').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      const from = String($('#sg_megaSummaryFrom').val() || '').trim();
      const to = String($('#sg_megaSummaryTo').val() || '').trim();
      await runMegaSummaryManual(from, to);
    } catch (e) {
      setStatus(`手动大总结失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_resetSummaryState').on('click', async () => {
    try {
      const meta = getDefaultSummaryMeta();
      await setSummaryMeta(meta);
      updateSummaryInfoLabel();
      renderSummaryPaneFromMeta();
      setStatus('已重置本聊天总结进度 �?, 'ok');
    } catch (e) {
      setStatus(`重置失败�?{e?.message ?? e}`, 'err');
    }
  });

  // auto-save summary settings
  $('#sg_inventoryEntriesEnabled, #sg_inventoryEntryPrefix, #sg_structuredInventoryPrompt, #sg_structuredInventoryEntryTemplate').on('input change', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
    updateSummaryManualRangeHint(false);
  });
  $('#sg_structuredEntriesEvery, #sg_structuredEntriesReadFloors, #sg_structuredEntriesCountMode, #sg_structuredEntryContentFormat').on('input change', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
    updateSummaryManualRangeHint(false);
  });
  $('#sg_summaryEnabled, #sg_summaryEvery, #sg_summaryCountMode, #sg_summaryTemperature, #sg_summarySystemPrompt, #sg_summaryUserTemplate, #sg_summaryReadStatData, #sg_summaryStatVarName, #sg_summaryAutoRollback, #sg_structuredAutoRollback, #sg_structuredEntriesEnabled, #sg_structuredWorldbookEnabled, #sg_structuredWorldbookMode, #sg_characterEntriesEnabled, #sg_equipmentEntriesEnabled, #sg_characterEntryPrefix, #sg_equipmentEntryPrefix, #sg_structuredEntriesSystemPrompt, #sg_structuredEntriesUserTemplate, #sg_structuredCharacterPrompt, #sg_structuredCharacterEntryTemplate, #sg_structuredEquipmentPrompt, #sg_structuredEquipmentEntryTemplate, #sg_summaryCustomEndpoint, #sg_summaryCustomApiKey, #sg_summaryCustomModel, #sg_summaryCustomMaxTokens, #sg_summaryCustomStream, #sg_summaryToWorldInfo, #sg_summaryWorldInfoFile, #sg_summaryWorldInfoCommentPrefix, #sg_summaryWorldInfoKeyMode, #sg_summaryIndexPrefix, #sg_summaryIndexPad, #sg_summaryIndexStart, #sg_summaryIndexInComment, #sg_summaryToBlueWorldInfo, #sg_summaryBlueWorldInfoFile, #sg_wiTriggerEnabled, #sg_wiTriggerLookbackMessages, #sg_wiTriggerIncludeUserMessage, #sg_wiTriggerUserMessageWeight, #sg_wiTriggerStartAfterAssistantMessages, #sg_wiTriggerMaxEntries, #sg_wiTriggerMaxCharacters, #sg_wiTriggerMaxEquipments, #sg_wiTriggerMaxPlot, #sg_wiTriggerMinScore, #sg_wiTriggerMaxKeywords, #sg_wiTriggerInjectStyle, #sg_wiTriggerDebugLog, #sg_wiBlueIndexMode, #sg_wiBlueIndexFile, #sg_summaryMaxChars, #sg_summaryMaxTotalChars, #sg_wiTriggerMatchMode, #sg_wiIndexPrefilterTopK, #sg_wiIndexProvider, #sg_wiIndexTemperature, #sg_wiIndexSystemPrompt, #sg_wiIndexUserTemplate, #sg_wiIndexCustomEndpoint, #sg_wiIndexCustomApiKey, #sg_wiIndexCustomModel, #sg_wiIndexCustomMaxTokens, #sg_wiIndexTopP, #sg_wiIndexCustomStream, #sg_wiRollEnabled, #sg_wiRollStatSource, #sg_wiRollStatVarName, #sg_wiRollRandomWeight, #sg_wiRollDifficulty, #sg_wiRollInjectStyle, #sg_wiRollDebugLog, #sg_wiRollStatParseMode, #sg_wiRollProvider, #sg_wiRollCustomEndpoint, #sg_wiRollCustomApiKey, #sg_wiRollCustomModel, #sg_wiRollCustomMaxTokens, #sg_wiRollCustomTopP, #sg_wiRollCustomTemperature, #sg_wiRollCustomStream, #sg_wiRollSystemPrompt, #sg_imageGenEnabled, #sg_novelaiApiKey, #sg_novelaiModel, #sg_novelaiResolution, #sg_novelaiSteps, #sg_novelaiScale, #sg_novelaiNegativePrompt, #sg_imageGenAutoSave, #sg_imageGenSavePath, #sg_imageGenLookbackMessages, #sg_imageGenReadStatData, #sg_imageGenStatVarName, #sg_imageGenCustomEndpoint, #sg_imageGenCustomApiKey, #sg_imageGenCustomModel, #sg_imageGenSystemPrompt, #sg_imageGalleryEnabled, #sg_imageGalleryUrl, #sg_imageGenWorldBookEnabled, #sg_imageGenWorldBookFile').on('change input', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
    updateStructuredWorldbookInfoLabel();
    updateSummaryManualRangeHint(false);
  });

  $('#sg_structuredWorldbookEnabled, #sg_structuredWorldbookMode').on('change input', () => {
    ensureStructuredWorldbookLive(true).catch(() => void 0);
  });

  $('#sg_factionEntriesEnabled, #sg_factionEntryPrefix, #sg_structuredFactionPrompt, #sg_structuredFactionEntryTemplate, #sg_structuredReenableEntriesEnabled, #sg_achievementEntriesEnabled, #sg_achievementEntryPrefix, #sg_structuredAchievementPrompt, #sg_structuredAchievementEntryTemplate, #sg_subProfessionEntriesEnabled, #sg_subProfessionEntryPrefix, #sg_structuredSubProfessionPrompt, #sg_structuredSubProfessionEntryTemplate, #sg_questEntriesEnabled, #sg_questEntryPrefix, #sg_structuredQuestPrompt, #sg_structuredQuestEntryTemplate, #sg_conquestEntriesEnabled, #sg_conquestEntryPrefix, #sg_structuredConquestPrompt, #sg_structuredConquestEntryTemplate, #sg_megaSummaryEnabled, #sg_megaSummaryEvery, #sg_megaSummarySystemPrompt, #sg_megaSummaryUserTemplate, #sg_megaSummaryCommentPrefix').on('input change', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
    updateSummaryManualRangeHint(false);
  });

  $('#sg_wiTriggerMaxFactions, #sg_wiTriggerMaxAchievements, #sg_wiTriggerMaxSubProfessions, #sg_wiTriggerMaxQuests').on('input change', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
    updateSummaryManualRangeHint(false);
  });

  $('#sg_imageGenCustomEndpoint, #sg_imageGenCustomApiKey, #sg_imageGenCustomModel, #sg_imageGenCustomMaxTokens, #sg_imageGenArtistPromptEnabled, #sg_imageGenArtistPrompt, #sg_imageGenPromptRulesEnabled, #sg_imageGenPromptRules, #sg_imageGenBatchEnabled, #sg_imageGenBatchPatterns, #sg_imageGenPresetSelect, #sg_imageGenProfilesEnabled, #sg_imageGenCustomFemalePrompt1, #sg_imageGenCustomFemalePrompt2, #sg_novelaiModel, #sg_novelaiResolution, #sg_novelaiSteps, #sg_novelaiScale, #sg_novelaiSampler, #sg_novelaiFixedSeedEnabled, #sg_novelaiFixedSeed, #sg_novelaiCfgRescale, #sg_novelaiNoiseSchedule, #sg_novelaiLegacy, #sg_novelaiVarietyBoost, #sg_novelaiNegativePrompt, #sg_imageGenProfiles').on('input change', () => {
    pullUiToSettings();
    saveSettings();
  });


  $('#sg_refreshModels').on('click', async () => {

    pullUiToSettings(); saveSettings();
    await refreshModels();
  });

  $('#sg_imageGenRefreshModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshImageGenModels();
  });


  $(document).on('click', '#sg_imageGenProfileAdd', () => {
    const s = ensureSettings();
    const list = getCharacterProfilesFromSettings({ includeEmpty: true });
    list.push({ name: `人物${list.length + 1}`, keys: [], tags: '', enabled: true });
    s.imageGenCharacterProfiles = list;
    saveSettings();
    renderCharacterProfilesUi();
    pullSettingsToUi();
  });

  $(document).on('click', '#sg_imageGenProfilesToggle', () => {
    const s = ensureSettings();
    s.imageGenProfilesExpanded = !s.imageGenProfilesExpanded;
    saveSettings();
    pullSettingsToUi();
  });


  $(document).on('input change', '#sg_imageGenProfiles input, #sg_imageGenProfiles textarea, #sg_imageGenProfiles .sg-profile-enabled', () => {
    const s = ensureSettings();
    s.imageGenCharacterProfiles = collectCharacterProfilesFromUi();
    saveSettings();
  });

  $(document).on('click', '#sg_imageGenProfiles .sg-profile-delete', (e) => {
    e.preventDefault();
    const $row = $(e.currentTarget).closest('.sg-profile-row');
    if (!$row.length) return;
    $row.remove();
    const s = ensureSettings();
    s.imageGenCharacterProfiles = collectCharacterProfilesFromUi();
    saveSettings();
    renderCharacterProfilesUi();
  });


  $('#sg_imageGenResetBatch').on('click', () => {
    $('#sg_imageGenBatchPatterns').val(String(DEFAULT_SETTINGS.imageGenBatchPatterns || ''));
    pullUiToSettings();
    saveSettings();
    setStatus('已恢复默认批量模�?�?, 'ok');
  });

  $('#sg_imageGenSavePreset').on('click', () => {
    const name = normalizeImageGenPresetName(prompt('预设名称�?) || '');
    if (!name) return;
    const list = getImageGenPresetList();
    const snapshot = getImageGenPresetSnapshot();
    const idx = list.findIndex(p => p?.name === name);
    if (idx >= 0) list[idx] = { name, snapshot };
    else list.push({ name, snapshot });
    setImageGenPresetList(list);
    const s = ensureSettings();
    s.imageGenPresetActive = name;
    saveSettings();
    pullSettingsToUi();
    setStatus('预设已保�?�?, 'ok');
  });

  $('#sg_imageGenApplyPreset').on('click', () => {
    const name = String($('#sg_imageGenPresetSelect').val() || '').trim();
    if (!name) return;
    const list = getImageGenPresetList();
    const preset = list.find(p => p?.name === name);
    if (!preset) return;
    applyImageGenPresetSnapshot(preset.snapshot);
    const s = ensureSettings();
    s.imageGenPresetActive = name;
    saveSettings();
    setStatus('预设已应�?�?, 'ok');
  });

  $('#sg_imageGenDeletePreset').on('click', () => {
    const name = String($('#sg_imageGenPresetSelect').val() || '').trim();
    if (!name) return;
    const list = getImageGenPresetList().filter(p => p?.name !== name);
    setImageGenPresetList(list);
    const s = ensureSettings();
    if (s.imageGenPresetActive === name) s.imageGenPresetActive = '';
    saveSettings();
    pullSettingsToUi();
    setStatus('预设已删�?, 'ok');
  });

  $('#sg_imageGenExportPreset').on('click', () => {
    const name = String($('#sg_imageGenPresetSelect').val() || '').trim();
    const list = getImageGenPresetList();
    const preset = list.find(p => p?.name === name);
    if (!preset) {
      setStatus('请选择一个预设再导出', 'warn');
      return;
    }
    const payload = {
      _type: 'StoryGuide_ImageGenPreset',
      _version: '1.0',
      _exportedAt: new Date().toISOString(),
      name: preset.name,
      snapshot: preset.snapshot
    };
    downloadTextFile(`storyguide-imagegen-preset-${preset.name}.json`, JSON.stringify(payload, null, 2));
    setStatus('预设已导�?�?, 'ok');
  });

  $('#sg_imageResult, #sg_galleryResult, #sg_imagegen_float_preview, #sg_imagegen_batch').on('click', 'img', (e) => {
    const src = String($(e.currentTarget).attr('data-full') || $(e.currentTarget).attr('src') || '').trim();
    if (!src) return;
    openImagePreviewModal(src, $(e.currentTarget).attr('alt') || 'Image preview');
  });

  $('#sg_imageGenImportPreset').on('click', async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const txt = await readFileText(file);
      const data = JSON.parse(txt);
      let preset = null;

      if (data && data._type === 'StoryGuide_ImageGenPreset') {
        const name = normalizeImageGenPresetName(data.name || '未命�?);
        if (!name) return;
        preset = { name, snapshot: data.snapshot || {} };
      } else {
        preset = resolveImageGenPresetFromSillyPreset(txt, file?.name || '对话预设');
      }

      if (!preset || !preset.name) {
        setStatus('预设文件格式不正�?, 'err');
        return;
      }

      const list = getImageGenPresetList();
      const idx = list.findIndex(p => p?.name === preset.name);
      if (idx >= 0) list[idx] = preset;
      else list.push(preset);
      setImageGenPresetList(list);
      const s = ensureSettings();
      s.imageGenPresetActive = preset.name;
      saveSettings();
      pullSettingsToUi();
      setStatus('预设已导�?�?, 'ok');
    } catch (e) {
      setStatus(`导入失败�?{e?.message ?? e}`, 'err');
    }
  });




  // 导出/导入全局预设
  $('#sg_exportPreset').on('click', () => {
    try {
      exportPreset();
    } catch (e) {
      showToast(`导出失败: ${e.message}`, { kind: 'err' });
    }
  });

  $('#sg_importPreset').on('click', () => {
    $('#sg_importPresetFile').trigger('click');
  });

  $('#sg_importPresetFile').on('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await importPreset(file);
      // 清空 input 以便再次选择同一文件
      e.target.value = '';
    }
  });

  $('#sg_refreshSummaryModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshSummaryModels();
  });


  $('#sg_refreshIndexModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshIndexModels();
  });

  $('#sg_modelSelect').on('change', () => {
    const id = String($('#sg_modelSelect').val() || '').trim();
    if (id) $('#sg_customModel').val(id);
  });

  $('#sg_summaryModelSelect').on('change', () => {
    const id = String($('#sg_summaryModelSelect').val() || '').trim();
    if (id) $('#sg_summaryCustomModel').val(id);
  });

  $('#sg_refreshWorldbookList').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshWorldbookList();
  });

  $('#sg_summaryWorldbookSelect').on('change', () => {
    const name = String($('#sg_summaryWorldbookSelect').val() || '').trim();
    if (!name) return;
    $('#sg_summaryWorldInfoFile').val(name);
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
  });

  $('#sg_summaryBlueWorldbookSelect').on('change', () => {
    const name = String($('#sg_summaryBlueWorldbookSelect').val() || '').trim();
    if (!name) return;
    $('#sg_summaryBlueWorldInfoFile').val(name);
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
  });


  $('#sg_wiIndexModelSelect').on('change', () => {
    const id = String($('#sg_wiIndexModelSelect').val() || '').trim();
    if (id) {
      $('#sg_wiIndexCustomModel').val(id);
      pullUiToSettings();
      saveSettings();
    }
  });

  $('#sg_refreshRollModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshRollModels();
  });

  $('#sg_wiRollModelSelect').on('change', () => {
    const id = String($('#sg_wiRollModelSelect').val() || '').trim();
    if (id) $('#sg_wiRollCustomModel').val(id);
  });

  // 蓝灯索引导入/清空
  $('#sg_refreshBlueIndexLive').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      const s = ensureSettings();
      const mode = String(s.wiBlueIndexMode || 'live');
      if (mode !== 'live') {
        setStatus('当前为“缓存”模式：不会实时读取（可切换为“实时读取蓝灯世界书”）', 'warn');
        return;
      }
      const file = pickBlueIndexFileName();
      if (!file) {
        setStatus('蓝灯世界书文件名为空：请在“蓝灯索引”里填写文件名，或在“同时写入蓝灯世界书”里填写文件�?, 'err');
        return;
      }
      const entries = await ensureBlueIndexLive(true);
      setStatus(`已实时读取蓝灯世界书 ✅（${entries.length} 条）`, entries.length ? 'ok' : 'warn');
    } catch (e) {
      setStatus(`实时读取蓝灯世界书失败：${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_importBlueIndex').on('click', async () => {
    try {
      const file = await pickFile('.json,application/json');
      if (!file) return;
      const txt = await readFileText(file);
      const entries = parseWorldbookJson(txt);
      const s = ensureSettings();
      // 仅保留必要字�?
      s.summaryBlueIndex = entries.map(e => ({
        title: String(e.title || '').trim() || (e.keys?.[0] ? `条目�?{e.keys[0]}` : '条目'),
        summary: String(e.content || '').trim(),
        keywords: Array.isArray(e.keys) ? e.keys.slice(0, 80) : [],
        importedAt: Date.now(),
      })).filter(x => x.summary);
      saveSettings();
      updateBlueIndexInfoLabel();
      setStatus(`蓝灯索引已导�?✅（${s.summaryBlueIndex.length} 条）`, s.summaryBlueIndex.length ? 'ok' : 'warn');
    } catch (e) {
      setStatus(`导入蓝灯索引失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_clearBlueIndex').on('click', () => {
    const s = ensureSettings();
    s.summaryBlueIndex = [];
    saveSettings();
    updateBlueIndexInfoLabel();
    setStatus('已清空蓝灯索�?, 'ok');
  });

  $('#sg_clearWiLogs').on('click', async () => {
    try {
      const meta = getSummaryMeta();
      meta.wiTriggerLogs = [];
      await setSummaryMeta(meta);
      renderWiTriggerLogs(meta);
      setStatus('已清空索引日�?, 'ok');
    } catch (e) {
      setStatus(`清空索引日志失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_clearRollLogs').on('click', async () => {
    try {
      const meta = getSummaryMeta();
      meta.rollLogs = [];
      await setSummaryMeta(meta);
      renderRollLogs(meta);
      setStatus('已清�?ROLL 日志', 'ok');
    } catch (e) {
      setStatus(`清空 ROLL 日志失败�?{e?.message ?? e}`, 'err');
    }
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
      setStatus('已导出预�?�?, 'ok');
    } catch (e) {
      setStatus(`导出失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_importPreset').on('click', async () => {
    try {
      const file = await pickFile('.json,application/json');
      if (!file) return;
      const txt = await readFileText(file);
      const data = JSON.parse(txt);

      if (!data || typeof data !== 'object') {
        setStatus('导入失败：预设文件格式不�?, 'err');
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
      setStatus(`导入失败�?{e?.message ?? e}`, 'err');
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
      setStatus('世界书已导入 �?, entries.length ? 'ok' : 'warn');
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
      setStatus('世界书设置已保存 �?, 'ok');
    } catch (e) {
      setStatus(`保存世界书设置失败：${e?.message ?? e}`, 'err');
    }
  });

  // 自动保存：世界书相关设置变更时立刻写�?
  $('#sg_worldbookEnabled, #sg_worldbookMode').on('change', () => {
    pullUiToSettings();
    saveSettings();
    updateWorldbookInfoLabel();
  });

  // 地图功能事件处理
  $('#sg_mapEnabled').on('change', () => {
    pullUiToSettings();
    saveSettings();
  });

  $('#sg_mapSystemPrompt').on('change input', () => {
    pullUiToSettings();
    saveSettings();
  });

  $('#sg_mapResetPrompt').on('click', () => {
    $('#sg_mapSystemPrompt').val(String(DEFAULT_SETTINGS.mapSystemPrompt || ''));
    pullUiToSettings();
    saveSettings();
    setStatus('已恢复默认地图提示词 �?, 'ok');
  });

  bindMapEventPanelHandler();

  $(document).on('click', (e) => {
    const $t = $(e.target);
    if ($t.closest('.sg-map-popover, .sg-map-location').length) return;
    if (sgMapPopoverEl) sgMapPopoverEl.style.display = 'none';
  });

  $('#sg_resetMap').on('click', async () => {
    try {
      await setMapData(getDefaultMapData());
      updateMapPreview();
      setStatus('地图已重�?�?, 'ok');
    } catch (e) {
      setStatus(`重置地图失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_refreshMapPreview').on('click', () => {
    updateMapPreview();
    setStatus('地图预览已刷�?, 'ok');
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
      setStatus(`模块 JSON 解析失败�?{e?.message ?? e}`, 'err');
      return;
    }
    const v = validateAndNormalizeModules(parsed);
    if (!v.ok) {
      setStatus(`模块校验失败�?{v.error}`, 'err');
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
      setStatus(`模块 JSON 解析失败�?{e?.message ?? e}`, 'err');
      return;
    }
    const v = validateAndNormalizeModules(parsed);
    if (!v.ok) { setStatus(`模块校验失败�?{v.error}`, 'err'); return; }

    const s = ensureSettings();
    s.modulesJson = JSON.stringify(v.modules, null, 2);
    saveSettings();
    $('#sg_modulesJson').val(s.modulesJson);
    setStatus('模块已应用并保存 ✅（注意：追加框展示的模块由“追加框展示模块”控制）', 'ok');
  });

  // 刷新静态模块缓�?
  $('#sg_clearStaticCache').on('click', async () => {
    try {
      await clearStaticModulesCache();
      setStatus('已清除静态模块缓�?�?下次分析会重新生成静态模块（�?世界简�?�?, 'ok');
    } catch (e) {
      setStatus(`清除静态模块缓存失败：${e?.message ?? e}`, 'err');
    }
  });

  // 快捷选项按钮事件
  $('#sg_resetQuickOptions').on('click', () => {
    const defaultOptions = JSON.stringify([
      { label: '继续', prompt: '继续当前剧情发展' },
      { label: '详述', prompt: '请更详细地描述当前场�? },
      { label: '对话', prompt: '让角色之间展开更多对话' },
      { label: '行动', prompt: '描述接下来的具体行动' },
    ], null, 2);
    $('#sg_quickOptionsJson').val(defaultOptions);
    const s = ensureSettings();
    s.quickOptionsJson = defaultOptions;
    saveSettings();
    setStatus('已恢复默认快捷选项 �?, 'ok');
  });

  $('#sg_applyQuickOptions').on('click', () => {
    const txt = String($('#sg_quickOptionsJson').val() || '').trim();
    try {
      const arr = JSON.parse(txt || '[]');
      if (!Array.isArray(arr)) {
        setStatus('快捷选项格式错误：必须是 JSON 数组', 'err');
        return;
      }
      const s = ensureSettings();
      s.quickOptionsJson = JSON.stringify(arr, null, 2);
      saveSettings();
      $('#sg_quickOptionsJson').val(s.quickOptionsJson);
      setStatus('快捷选项已应用并保存 �?, 'ok');
    } catch (e) {
      setStatus(`快捷选项 JSON 解析失败�?{e?.message ?? e}`, 'err');
    }
  });
}

function showSettingsPage(page) {
  const p = String(page || 'guide');
  $('#sg_pgtab_guide, #sg_pgtab_summary, #sg_pgtab_index, #sg_pgtab_roll, #sg_pgtab_image, #sg_pgtab_sex, #sg_pgtab_character, #sg_pgtab_parallel').removeClass('active');
  $('#sg_page_guide, #sg_page_summary, #sg_page_index, #sg_page_roll, #sg_page_image, #sg_page_sex, #sg_page_character, #sg_page_parallel').removeClass('active');

  if (p === 'summary') {
    $('#sg_pgtab_summary').addClass('active');
    $('#sg_page_summary').addClass('active');
  } else if (p === 'index') {
    $('#sg_pgtab_index').addClass('active');
    $('#sg_page_index').addClass('active');
  } else if (p === 'roll') {
    $('#sg_pgtab_roll').addClass('active');
    $('#sg_page_roll').addClass('active');
  } else if (p === 'image') {
    $('#sg_pgtab_image').addClass('active');
    $('#sg_page_image').addClass('active');
  } else if (p === 'sex') {
    $('#sg_pgtab_sex').addClass('active');
    $('#sg_page_sex').addClass('active');
  } else if (p === 'character') {
    $('#sg_pgtab_character').addClass('active');
    $('#sg_page_character').addClass('active');
  } else if (p === 'parallel') {
    $('#sg_pgtab_parallel').addClass('active');
    $('#sg_page_parallel').addClass('active');
    // 切到平行世界页时刷新数据
    try { refreshParallelWorldTrackedLists(); renderParallelWorldEventLog(); } catch { }
  } else {
    $('#sg_pgtab_guide').addClass('active');
    $('#sg_page_guide').addClass('active');
  }

  // 切页后回到顶部，避免“看不到设置项�?
  try { $('.sg-left').scrollTop(0); } catch { }
}

function setupSettingsPages() {
  // 把“索引设置块”从总结页移到索引页（保留内部所有控�?id，不影响事件绑定�?
  try {
    const $mount = $('#sg_index_mount');
    const $idxWrapper = $('#sg_wiTriggerEnabled').closest('.sg-card.sg-subcard');
    if ($mount.length && $idxWrapper.length) {
      $mount.append($idxWrapper.children());
      $idxWrapper.remove();
    }
  } catch { /* ignore */ }

  // ROLL 设置已直接内嵌在 sg_page_roll 中，无需移动

  // tabs
  $('#sg_pgtab_guide').on('click', () => showSettingsPage('guide'));
  $('#sg_pgtab_summary').on('click', () => showSettingsPage('summary'));
  $('#sg_pgtab_index').on('click', () => showSettingsPage('index'));
  $('#sg_pgtab_roll').on('click', () => showSettingsPage('roll'));
  $('#sg_pgtab_image').on('click', () => showSettingsPage('image'));
  $('#sg_pgtab_sex').on('click', () => showSettingsPage('sex'));
  $('#sg_pgtab_character').on('click', () => showSettingsPage('character'));
  $('#sg_pgtab_parallel').on('click', () => showSettingsPage('parallel'));

  try { setupSexGuidePage(); } catch (e) { console.error('[StoryGuide] setupSexGuidePage failed:', e); }
  setupCharacterPage();
  try { setupParallelWorldPage(); } catch (e) { console.error('[StoryGuide] setupParallelWorldPage failed:', e); }

  // quick jump
  $('#sg_gotoIndexPage').on('click', () => showSettingsPage('index'));
  $('#sg_gotoRollPage').on('click', () => showSettingsPage('roll'));

  // 图像生成事件
  $('#sg_generateImage').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await runImageGeneration();
  });

  $('#sg_downloadImage').on('click', async () => {
    const src = $('#sg_generatedImage').attr('src');
    if (src) await saveGeneratedImage(src);
  });

  $('#sg_regenImage').on('click', async () => {
    const positive = String($('#sg_imagePositivePrompt').val() || '').trim();
    if (!positive) {
      setImageGenStatus('暂无提示词可重生�?, 'warn');
      return;
    }
    const negative = String($('#sg_novelaiNegativePrompt').val() || '').trim();
    setImageGenStatus('正在重新生成图像�?, 'warn');
    try {
      const imageUrl = await generateImageWithNovelAI(positive, negative);
      $('#sg_generatedImage').attr('src', imageUrl);
      $('#sg_generatedImage').attr('data-full', imageUrl);
      $('#sg_imageResult').show();
      setImageGenStatus('�?已重新生�?, 'ok');
    } catch (e) {
      setImageGenStatus(`�?重生成失�? ${e?.message || e}`, 'err');
    }
  });


  $('#sg_copyImagePrompt').on('click', () => {
    const prompt = $('#sg_imagePositivePrompt').val();
    if (prompt) {
      navigator.clipboard.writeText(prompt);
      setImageGenStatus('提示词已复制到剪贴板', 'ok');
    }
  });

  $('#sg_imageGenResetPrompt').on('click', () => {
    $('#sg_imageGenSystemPrompt').val(DEFAULT_SETTINGS.imageGenSystemPrompt);
    pullUiToSettings(); saveSettings();
    setImageGenStatus('已恢复默认提示词', 'ok');
  });

  $('#sg_editPromptAndGenerate').on('click', async () => {
    const $textarea = $('#sg_imagePositivePrompt');
    if ($textarea.prop('readonly')) {
      $textarea.prop('readonly', false);
      $('#sg_editPromptAndGenerate').text('使用编辑后的提示词生�?);
    } else {
      const positive = $textarea.val();
      if (positive) {
        const s = ensureSettings();
        setImageGenStatus('正在使用编辑后的提示词生成�?, 'warn');
        try {
          const imageUrl = await generateImageWithNovelAI(positive, '');
          $('#sg_generatedImage').attr('src', imageUrl);
          $('#sg_imageResult').show();
          setImageGenStatus('�?生成成功�?, 'ok');
        } catch (e) {
          setImageGenStatus(`�?生成失败: ${e?.message || e}`, 'err');
        }
      }
    }
  });

  // 在线图库事件
  $('#sg_loadGallery').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await loadGalleryFromGitHub();
  });

  $('#sg_matchGalleryImage').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await matchGalleryImage();
  });
}

function setupCharacterPage() {
  const autoSave = () => {
    pullUiToSettings();
    saveSettings();
  };

  $('#sg_char_provider').on('change', () => {
    const provider = String($('#sg_char_provider').val() || 'st');
    $('#sg_char_custom_block').toggle(provider === 'custom');
    autoSave();
  });

  $('#sg_char_temperature, #sg_char_customEndpoint, #sg_char_customApiKey, #sg_char_customModel, #sg_char_customMaxTokens, #sg_char_customStream').on('input change', autoSave);
  $('#sg_char_prompt_random, #sg_char_prompt_opening').on('input change', autoSave);

  $('#sg_char_refreshModels').on('click', async () => {
    autoSave();
    await refreshCharacterModels();
  });

  $('#sg_char_park, #sg_char_race, #sg_char_talent').on('change', () => {
    updateCharacterForm();
    autoSave();
  });
  $('#sg_char_park_custom, #sg_char_park_traits, #sg_char_race_custom, #sg_char_talent_custom, #sg_char_contract').on('input', () => {
    updateCharacterForm();
    autoSave();
  });
  $('#sg_char_difficulty').on('change', () => {
    updateCharacterAttributeSummary();
    autoSave();
  });
  $('#sg_char_attr_con, #sg_char_attr_int, #sg_char_attr_cha, #sg_char_attr_str, #sg_char_attr_agi, #sg_char_attr_luk').on('input', () => {
    updateCharacterAttributeSummary();
    autoSave();
  });

  $('#sg_char_random_llm').on('change', autoSave);

  $('#sg_char_random').on('click', async () => {
    if ($('#sg_char_random_llm').is(':checked')) {
      await randomizeCharacterWithLLM();
    } else {
      randomizeCharacterLocal();
    }
    autoSave();
  });

  $('#sg_char_generate').on('click', async () => {
    autoSave();
    await generateCharacterText();
  });

  $('#sg_char_copy').on('click', async () => {
    const text = String($('#sg_char_output').val() || '').trim();
    if (!text) {
      setCharacterStatus('· 暂无可复制内�?·', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCharacterStatus('· 已复制到剪贴�?·', 'ok');
    } catch (e) {
      setCharacterStatus(`· 复制失败�?{e?.message ?? e} ·`, 'err');
    }
  });

  $('#sg_char_insert').on('click', () => {
    const text = String($('#sg_char_output').val() || '').trim();
    if (!text) {
      setCharacterStatus('· 暂无可填入内�?·', 'warn');
      return;
    }
    const ok = injectToUserInput(text);
    setCharacterStatus(ok ? '· 已填入聊天输入框（未发送） ·' : '· 未找到聊天输入框 ·', ok ? 'ok' : 'err');
  });
}

function setupSexGuidePage() {
  const autoSave = () => {
    pullUiToSettings();
    saveSettings();
    renderSexGuideWorldbookList();
    updateSexGuideWorldbookInfoLabel();
  };

  $('#sg_sex_provider').on('change', () => {
    const provider = String($('#sg_sex_provider').val() || 'st');
    $('#sg_sex_custom_block').toggle(provider === 'custom');
    autoSave();
  });

  $('#sg_sexEnabled, #sg_sex_temperature, #sg_sexSystemPrompt, #sg_sexUserTemplate, #sg_sexUserNeed, #sg_sexIncludeUserInput, #sg_sexCustomEndpoint, #sg_sexCustomApiKey, #sg_sexCustomModel, #sg_sexCustomMaxTokens, #sg_sexCustomStream, #sg_sexWorldbookEnabled, #sg_sexWorldbookMaxChars')
    .on('input change', autoSave);

  $('#sg_sexModelSelect').on('change', () => {
    const val = String($('#sg_sexModelSelect').val() || '').trim();
    if (val) $('#sg_sexCustomModel').val(val);
    autoSave();
  });

  $('#sg_sexRefreshModels').on('click', async () => {
    autoSave();
    await refreshSexGuideModels();
  });

  $('#sg_sexResetPrompt').on('click', () => {
    $('#sg_sexSystemPrompt').val(DEFAULT_SEX_GUIDE_SYSTEM_PROMPT);
    $('#sg_sexUserTemplate').val(DEFAULT_SEX_GUIDE_USER_TEMPLATE);
    autoSave();
    setSexGuideStatus('已恢复默认提示词', 'ok');
  });

  $('#sg_sexSavePreset').on('click', () => {
    const name = normalizeSexGuidePresetName(prompt('预设名称�?) || '');
    if (!name) return;
    const list = getSexGuidePresetList();
    const snapshot = getSexGuidePresetSnapshot();
    const idx = list.findIndex(p => p?.name === name);
    if (idx >= 0) list[idx] = { name, snapshot };
    else list.push({ name, snapshot });
    setSexGuidePresetList(list);
    const s = ensureSettings();
    s.sexGuidePresetActive = name;
    saveSettings();
    pullSettingsToUi();
    setSexGuideStatus('预设已保�?, 'ok');
  });

  $('#sg_sexApplyPreset').on('click', () => {
    const name = String($('#sg_sexPresetSelect').val() || '').trim();
    if (!name) return;
    const list = getSexGuidePresetList();
    const preset = list.find(p => p?.name === name);
    if (!preset) return;
    applySexGuidePresetSnapshot(preset.snapshot);
    const s = ensureSettings();
    s.sexGuidePresetActive = name;
    saveSettings();
    setSexGuideStatus('预设已应�?, 'ok');
  });

  $('#sg_sexDeletePreset').on('click', () => {
    const name = String($('#sg_sexPresetSelect').val() || '').trim();
    if (!name) return;
    const list = getSexGuidePresetList().filter(p => p?.name !== name);
    setSexGuidePresetList(list);
    const s = ensureSettings();
    if (s.sexGuidePresetActive === name) s.sexGuidePresetActive = '';
    saveSettings();
    pullSettingsToUi();
    setSexGuideStatus('预设已删�?, 'ok');
  });

  $('#sg_sexExportPreset').on('click', () => {
    const name = String($('#sg_sexPresetSelect').val() || '').trim();
    const list = getSexGuidePresetList();
    const preset = list.find(p => p?.name === name);
    if (!preset) {
      setSexGuideStatus('请选择一个预设再导出', 'warn');
      return;
    }
    const payload = {
      _type: 'StoryGuide_SexGuidePreset',
      _version: '1.0',
      _exportedAt: new Date().toISOString(),
      name: preset.name,
      snapshot: preset.snapshot
    };
    downloadTextFile(`storyguide-sexguide-preset-${preset.name}.json`, JSON.stringify(payload, null, 2));
    setSexGuideStatus('预设已导�?, 'ok');
  });

  $('#sg_sexImportPreset').on('click', async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const txt = await readFileText(file);
      const data = JSON.parse(txt);
      let preset = null;

      if (data && data._type === 'StoryGuide_SexGuidePreset') {
        const name = normalizeSexGuidePresetName(data.name || '未命�?);
        if (!name) return;
        preset = { name, snapshot: data.snapshot || {} };
      } else {
        preset = resolveSexGuidePresetFromSillyPreset(txt, file?.name || '对话预设');
      }

      if (!preset || !preset.name) {
        setSexGuideStatus('预设文件格式不正�?, 'err');
        return;
      }

      const list = getSexGuidePresetList();
      const idx = list.findIndex(p => p?.name === preset.name);
      if (idx >= 0) list[idx] = preset;
      else list.push(preset);
      setSexGuidePresetList(list);
      const s = ensureSettings();
      s.sexGuidePresetActive = preset.name;
      saveSettings();
      pullSettingsToUi();
      setSexGuideStatus('预设已导�?, 'ok');
    } catch (e) {
      setSexGuideStatus(`导入失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_sex_generate').on('click', async () => {
    autoSave();
    await runSexGuide();
  });

  $('#sg_sex_panel_generate').on('click', async () => {
    const need = String($('#sg_sex_panel_need').val() || '').trim();
    await runSexGuide({ userNeedOverride: need });
  });

  $('#sg_sex_panel_send').on('click', () => {
    const text = String($('#sg_sex_panel_output').val() || '').trim();
    if (!text) { setSexGuidePanelStatus('暂无可发送内�?, 'warn'); return; }
    const ok = injectToUserInput(text);
    setSexGuidePanelStatus(ok ? '已填入输入框（未发送）' : '未找到聊天输入框', ok ? 'ok' : 'err');
  });

  $('#sg_sex_copy').on('click', async () => {
    const text = String($('#sg_sex_output').val() || '').trim();
    if (!text) { setSexGuideStatus('暂无可复制内�?, 'warn'); return; }
    try {
      await navigator.clipboard.writeText(text);
      setSexGuideStatus('已复制到剪贴�?, 'ok');
    } catch (e) {
      setSexGuideStatus(`复制失败�?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_sex_insert').on('click', () => {
    const text = String($('#sg_sex_output').val() || '').trim();
    if (!text) { setSexGuideStatus('暂无可插入内�?, 'warn'); return; }
    const ok = injectToUserInput(text);
    setSexGuideStatus(ok ? '已插入输入框（未发送）' : '未找到聊天输入框', ok ? 'ok' : 'err');
  });

  $('#sg_sexWorldbookImport').on('click', () => $('#sg_sexWorldbookImportFile').trigger('click'));

  $('#sg_sexWorldbookImportFile').on('change', async (e) => {
    const files = Array.from(e.target?.files || []);
    if (!files.length) return;
    const list = getSexGuideWorldbooks();
    const existingNames = new Set(list.map(w => w.name));
    let added = 0;

    for (const file of files) {
      try {
        const text = await file.text();
        const entries = parseWorldbookJson(text);
        if (!entries.length) {
          setSexGuideStatus(`导入失败�?{file.name}（未解析到条目）`, 'warn');
          continue;
        }
        let name = file.name || `世界�?{list.length + 1}`;
        if (existingNames.has(name)) {
          let i = 2;
          while (existingNames.has(`${name} (${i})`)) i += 1;
          name = `${name} (${i})`;
        }
        existingNames.add(name);
        list.push({ id: `sexwb_${Date.now()}_${added}`, name, json: text, enabled: true });
        added += 1;
      } catch (err) {
        console.warn('[StoryGuide] sex worldbook import failed:', err);
      }
    }

    setSexGuideWorldbooks(list);
    renderSexGuideWorldbookList();
    updateSexGuideWorldbookInfoLabel();
    if (added) setSexGuideStatus(`已导入世界书�?{added} 本`, 'ok');

    // reset file input
    e.target.value = '';
  });

  $('#sg_sexWorldbookClear').on('click', () => {
    setSexGuideWorldbooks([]);
    setSexGuideStatus('已清空世界书', 'ok');
  });

  $(document).on('change', '#sg_sexWorldbookList .sg-sex-wb-enabled', (ev) => {
    const $item = $(ev.target).closest('.sg-wb-item');
    const id = String($item.data('id') || '');
    const list = getSexGuideWorldbooks();
    const wb = list.find(w => w.id === id);
    if (wb) {
      wb.enabled = $(ev.target).is(':checked');
      setSexGuideWorldbooks(list);
    }
  });

  $(document).on('click', '#sg_sexWorldbookList .sg-sex-wb-remove', (ev) => {
    const $item = $(ev.target).closest('.sg-wb-item');
    const id = String($item.data('id') || '');
    const list = getSexGuideWorldbooks().filter(w => w.id !== id);
    setSexGuideWorldbooks(list);
  });
}

function setupParallelWorldPage() {
  const autoSave = () => {
    pullUiToSettings();
    saveSettings();
  };

  // 推演按钮
  $('#sg_pwRunSimulation').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await runParallelWorldSimulation();
  });

  // 清空日志
  $('#sg_pwClearLog').on('click', async () => {
    const pwData = getParallelWorldData();
    pwData.eventLog = [];
    pwData.factionEventLog = [];
    await setParallelWorldData(pwData);
    renderParallelWorldEventLog(pwData);
    setParallelWorldStatus('日志已清�?, 'ok');
  });

  // 刷新追踪列表
  $('#sg_pwRefreshNpcList').on('click', () => {
    refreshParallelWorldTrackedLists();
  });

  // 手动添加NPC
  $('#sg_pwAddManualNpc').on('click', () => {
    const name = String($('#sg_pwManualNpcName').val() || '').trim();
    if (!name) return;
    const s = ensureSettings();
    let list = s.parallelWorldTrackedNpcs || [];
    if (list.some(t => t.name === name)) {
      setParallelWorldStatus(`${name} 已在列表中`, 'warn');
      return;
    }
    list.push({ name, enabled: true });
    s.parallelWorldTrackedNpcs = list;
    saveSettings();
    $('#sg_pwManualNpcName').val('');
    refreshParallelWorldTrackedLists();
    setParallelWorldStatus(`已添�?${name}`, 'ok');
  });

  // 世界时钟设置
  $('#sg_pwClockSet').on('click', async () => {
    const val = String($('#sg_parallelWorldClock').val() || '').trim();
    if (!val) return;
    const pwData = getParallelWorldData();
    pwData.worldClock = val;
    await setParallelWorldData(pwData);
    updateParallelWorldClockDisplay(val);
    const s = ensureSettings();
    s.parallelWorldClock = val;
    saveSettings();
    setParallelWorldStatus(`世界时钟已设置为: ${val}`, 'ok');
  });

  // 恢复默认提示�?
  $('#sg_pwResetPrompts').on('click', () => {
    $('#sg_parallelWorldSystemPrompt').val(DEFAULT_PARALLEL_WORLD_SYSTEM_PROMPT);
    $('#sg_parallelWorldUserTemplate').val(DEFAULT_PARALLEL_WORLD_USER_TEMPLATE);
    autoSave();
    setParallelWorldStatus('已恢复默认提示词', 'ok');
  });

  // Provider 切换显示自定�?API 区域
  $('#sg_parallelWorldProvider').on('change', function () {
    const isCustom = $(this).val() === 'custom';
    $('#sg_parallelCustomBlock').toggle(isCustom);
    autoSave();
  });

  // 刷新模型列表
  $('#sg_refreshParallelWorldModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshParallelWorldModels();
  });

  // auto-save for inputs
  $('#sg_parallelWorldEnabled, #sg_parallelWorldAutoTrigger, #sg_parallelWorldWriteToWorldbook, #sg_parallelWorldInjectContext, #sg_parallelWorldCustomStream').on('change', autoSave);
  $('#sg_parallelWorldAutoEvery, #sg_parallelWorldTemperature, #sg_parallelWorldMaxEventsPerNpc, #sg_parallelWorldCustomMaxTokens, #sg_parallelWorldCustomTopP').on('change', autoSave);
  $('#sg_parallelWorldCustomEndpoint, #sg_parallelWorldCustomApiKey').on('change', autoSave);
  $('#sg_parallelWorldCustomModel').on('change', autoSave);
  $('#sg_parallelWorldSystemPrompt, #sg_parallelWorldUserTemplate').on('change', autoSave);
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

  // Character model datalist
  const $charDl = $('#sg_char_model_list');
  $charDl.empty();
  (Array.isArray(s.customModelsCache) ? s.customModelsCache : []).forEach(id => {
    $charDl.append($('<option>').val(id));
  });

  $('#sg_worldText').val(getChatMetaValue(META_KEYS.world));
  $('#sg_canonText').val(getChatMetaValue(META_KEYS.canon));

  $('#sg_modulesJson').val(String(s.modulesJson || JSON.stringify(DEFAULT_MODULES, null, 2)));
  $('#sg_customSystemPreamble').val(String(s.customSystemPreamble || ''));
  $('#sg_customConstraints').val(String(s.customConstraints || ''));

  // 快捷选项
  $('#sg_quickOptionsEnabled').prop('checked', !!s.quickOptionsEnabled);
  $('#sg_quickOptionsShowIn').val(String(s.quickOptionsShowIn || 'inline'));
  $('#sg_quickOptionsJson').val(String(s.quickOptionsJson || '[]'));

  $('#sg_presetIncludeApiKey').prop('checked', !!s.presetIncludeApiKey);

  $('#sg_worldbookEnabled').prop('checked', !!s.worldbookEnabled);
  $('#sg_worldbookMode').val(String(s.worldbookMode || 'active'));
  $('#sg_worldbookMaxChars').val(s.worldbookMaxChars);
  $('#sg_worldbookWindowMessages').val(s.worldbookWindowMessages);

  updateWorldbookInfoLabel();

  try {
    const count = parseWorldbookJson(String(s.worldbookJson || '')).length;
    $('#sg_worldbookInfo').text(count ? `已导入世界书�?{count} 条` : '（未导入世界书）');
  } catch {
    $('#sg_worldbookInfo').text('（未导入世界书）');
  }

  $('#sg_custom_block').toggle(s.provider === 'custom');

  // sex guide
  try {
    $('#sg_sexEnabled').prop('checked', !!s.sexGuideEnabled);
    $('#sg_sex_provider').val(String(s.sexGuideProvider || 'st'));
    $('#sg_sex_temperature').val(s.sexGuideTemperature ?? 0.6);
    $('#sg_sexSystemPrompt').val(String(s.sexGuideSystemPrompt || DEFAULT_SEX_GUIDE_SYSTEM_PROMPT));
    $('#sg_sexUserTemplate').val(String(s.sexGuideUserTemplate || DEFAULT_SEX_GUIDE_USER_TEMPLATE));
    $('#sg_sexUserNeed').val(String(s.sexGuideUserNeed || ''));
    $('#sg_sexIncludeUserInput').prop('checked', s.sexGuideIncludeUserInput !== false);
    $('#sg_sexCustomEndpoint').val(String(s.sexGuideCustomEndpoint || ''));
    $('#sg_sexCustomApiKey').val(String(s.sexGuideCustomApiKey || ''));
    $('#sg_sexCustomModel').val(String(s.sexGuideCustomModel || 'gpt-4o-mini'));
    $('#sg_sexCustomMaxTokens').val(s.sexGuideCustomMaxTokens || 2048);
    $('#sg_sexCustomStream').prop('checked', !!s.sexGuideCustomStream);
    $('#sg_sexWorldbookEnabled').prop('checked', !!s.sexGuideWorldbookEnabled);
    $('#sg_sexWorldbookMaxChars').val(s.sexGuideWorldbookMaxChars || 6000);
    $('#sg_sex_custom_block').toggle(String(s.sexGuideProvider || 'st') === 'custom');
    fillSexGuideModelSelect(Array.isArray(s.sexGuideCustomModelsCache) ? s.sexGuideCustomModelsCache : [], s.sexGuideCustomModel);
    // sex guide presets
    const $sexPresetSelect = $('#sg_sexPresetSelect');
    const sexPresets = getSexGuidePresetList();
    if ($sexPresetSelect.length) {
      $sexPresetSelect.empty();
      $sexPresetSelect.append('<option value="">(选择预设)</option>');
      sexPresets.forEach(p => {
        if (!p || !p.name) return;
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        $sexPresetSelect.append(opt);
      });
      if (s.sexGuidePresetActive) $sexPresetSelect.val(s.sexGuidePresetActive);
    }
    // structured presets
    const $structuredPresetSelect = $('#sg_structuredPresetSelect');
    const structuredPresets = getStructuredPresetList();
    if ($structuredPresetSelect.length) {
      $structuredPresetSelect.empty();
      $structuredPresetSelect.append('<option value="">(选择预设)</option>');
      structuredPresets.forEach(p => {
        if (!p || !p.name) return;
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        $structuredPresetSelect.append(opt);
      });
      if (s.structuredPresetActive) $structuredPresetSelect.val(s.structuredPresetActive);
    }
    renderSexGuideWorldbookList();
    updateSexGuideWorldbookInfoLabel();
    $('#sg_sex_output').val(lastSexGuideText || '');
    $('#sg_sex_copy, #sg_sex_insert').prop('disabled', !lastSexGuideText);
    $('#sg_sex_panel_output').val(lastSexGuideText || '');
    $('#sg_sex_panel_send').prop('disabled', !lastSexGuideText);
  } catch (e) {
    console.error('[StoryGuide] sex guide UI sync failed:', e);
  }

  // summary
  $('#sg_summaryEnabled').prop('checked', !!s.summaryEnabled);
  $('#sg_summaryEvery').val(s.summaryEvery);
  $('#sg_summaryManualSplit').prop('checked', !!s.summaryManualSplit);
  $('#sg_summaryCountMode').val(String(s.summaryCountMode || 'assistant'));
  $('#sg_summaryProvider').val(String(s.summaryProvider || 'st'));
  $('#sg_summaryTemperature').val(s.summaryTemperature);
  $('#sg_summarySystemPrompt').val(String(s.summarySystemPrompt || DEFAULT_SUMMARY_SYSTEM_PROMPT));
  $('#sg_summaryUserTemplate').val(String(s.summaryUserTemplate || DEFAULT_SUMMARY_USER_TEMPLATE));
  $('#sg_summaryReadStatData').prop('checked', !!s.summaryReadStatData);
  $('#sg_summaryStatVarName').val(String(s.summaryStatVarName || 'stat_data'));
  $('#sg_structuredEntriesEvery').val(s.structuredEntriesEvery ?? 1);
  $('#sg_structuredEntriesReadFloors').val(s.structuredEntriesReadFloors ?? s.structuredEntriesEvery ?? 1);
  $('#sg_structuredEntriesCountMode').val(String(s.structuredEntriesCountMode || 'assistant'));
  $('#sg_structuredEntryContentFormat').val(String(s.structuredEntryContentFormat || 'text'));
  $('#sg_megaSummaryEnabled').prop('checked', !!s.megaSummaryEnabled);
  $('#sg_megaSummaryEvery').val(s.megaSummaryEvery || 40);
  $('#sg_megaSummaryCommentPrefix').val(String(s.megaSummaryCommentPrefix || '大总结'));
  $('#sg_megaSummarySystemPrompt').val(String(s.megaSummarySystemPrompt || DEFAULT_MEGA_SUMMARY_SYSTEM_PROMPT));
  $('#sg_megaSummaryUserTemplate').val(String(s.megaSummaryUserTemplate || DEFAULT_MEGA_SUMMARY_USER_TEMPLATE));
  $('#sg_structuredEntriesEnabled').prop('checked', !!s.structuredEntriesEnabled);
  $('#sg_structuredWorldbookEnabled').prop('checked', !!s.structuredWorldbookEnabled);
  $('#sg_structuredWorldbookMode').val(String(s.structuredWorldbookMode || 'active'));
  $('#sg_characterEntriesEnabled').prop('checked', !!s.characterEntriesEnabled);
  $('#sg_equipmentEntriesEnabled').prop('checked', !!s.equipmentEntriesEnabled);
  $('#sg_inventoryEntriesEnabled').prop('checked', !!s.inventoryEntriesEnabled);
  $('#sg_factionEntriesEnabled').prop('checked', !!s.factionEntriesEnabled);
  $('#sg_structuredReenableEntriesEnabled').prop('checked', !!s.structuredReenableEntriesEnabled);
  $('#sg_achievementEntriesEnabled').prop('checked', !!s.achievementEntriesEnabled);
  $('#sg_subProfessionEntriesEnabled').prop('checked', !!s.subProfessionEntriesEnabled);
  $('#sg_questEntriesEnabled').prop('checked', !!s.questEntriesEnabled);
  $('#sg_conquestEntriesEnabled').prop('checked', !!s.conquestEntriesEnabled);
  $('#sg_characterEntryPrefix').val(String(s.characterEntryPrefix || '人物'));
  $('#sg_equipmentEntryPrefix').val(String(s.equipmentEntryPrefix || '装备'));
  $('#sg_inventoryEntryPrefix').val(String(s.inventoryEntryPrefix || '物品�?));
  $('#sg_factionEntryPrefix').val(String(s.factionEntryPrefix || '势力'));
  $('#sg_achievementEntryPrefix').val(String(s.achievementEntryPrefix || '成就'));
  $('#sg_subProfessionEntryPrefix').val(String(s.subProfessionEntryPrefix || '副职�?));
  $('#sg_questEntryPrefix').val(String(s.questEntryPrefix || '任务'));
  $('#sg_conquestEntryPrefix').val(String(s.conquestEntryPrefix || '猎艳�?));
  $('#sg_structuredEntriesSystemPrompt').val(String(s.structuredEntriesSystemPrompt || DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT));
  $('#sg_structuredEntriesUserTemplate').val(String(s.structuredEntriesUserTemplate || DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE));
  $('#sg_structuredCharacterPrompt').val(String(s.structuredCharacterPrompt || DEFAULT_STRUCTURED_CHARACTER_PROMPT));
  $('#sg_structuredCharacterEntryTemplate').val(String(s.structuredCharacterEntryTemplate || DEFAULT_STRUCTURED_CHARACTER_ENTRY_TEMPLATE));
  $('#sg_structuredEquipmentPrompt').val(String(s.structuredEquipmentPrompt || DEFAULT_STRUCTURED_EQUIPMENT_PROMPT));
  $('#sg_structuredEquipmentEntryTemplate').val(String(s.structuredEquipmentEntryTemplate || DEFAULT_STRUCTURED_EQUIPMENT_ENTRY_TEMPLATE));
  $('#sg_structuredInventoryPrompt').val(String(s.structuredInventoryPrompt || DEFAULT_STRUCTURED_INVENTORY_PROMPT));
  $('#sg_structuredInventoryEntryTemplate').val(String(s.structuredInventoryEntryTemplate || DEFAULT_STRUCTURED_INVENTORY_ENTRY_TEMPLATE));
  $('#sg_structuredFactionPrompt').val(String(s.structuredFactionPrompt || DEFAULT_STRUCTURED_FACTION_PROMPT));
  $('#sg_structuredFactionEntryTemplate').val(String(s.structuredFactionEntryTemplate || DEFAULT_STRUCTURED_FACTION_ENTRY_TEMPLATE));
  $('#sg_structuredAchievementPrompt').val(String(s.structuredAchievementPrompt || DEFAULT_STRUCTURED_ACHIEVEMENT_PROMPT));
  $('#sg_structuredAchievementEntryTemplate').val(String(s.structuredAchievementEntryTemplate || DEFAULT_STRUCTURED_ACHIEVEMENT_ENTRY_TEMPLATE));
  $('#sg_structuredSubProfessionPrompt').val(String(s.structuredSubProfessionPrompt || DEFAULT_STRUCTURED_SUBPROFESSION_PROMPT));
  $('#sg_structuredSubProfessionEntryTemplate').val(String(s.structuredSubProfessionEntryTemplate || DEFAULT_STRUCTURED_SUBPROFESSION_ENTRY_TEMPLATE));
  $('#sg_structuredQuestPrompt').val(String(s.structuredQuestPrompt || DEFAULT_STRUCTURED_QUEST_PROMPT));
  $('#sg_structuredQuestEntryTemplate').val(String(s.structuredQuestEntryTemplate || DEFAULT_STRUCTURED_QUEST_ENTRY_TEMPLATE));
  $('#sg_structuredConquestPrompt').val(String(s.structuredConquestPrompt || DEFAULT_STRUCTURED_CONQUEST_PROMPT));
  $('#sg_structuredConquestEntryTemplate').val(String(s.structuredConquestEntryTemplate || DEFAULT_STRUCTURED_CONQUEST_ENTRY_TEMPLATE));
  $('#sg_summaryCustomEndpoint').val(String(s.summaryCustomEndpoint || ''));
  $('#sg_summaryCustomApiKey').val(String(s.summaryCustomApiKey || ''));
  $('#sg_summaryCustomModel').val(String(s.summaryCustomModel || ''));
  fillSummaryModelSelect(Array.isArray(s.summaryCustomModelsCache) ? s.summaryCustomModelsCache : [], String(s.summaryCustomModel || ''));
  $('#sg_summaryCustomMaxTokens').val(s.summaryCustomMaxTokens || 2048);
  $('#sg_summaryCustomStream').prop('checked', !!s.summaryCustomStream);
  $('#sg_summaryToWorldInfo').prop('checked', !!s.summaryToWorldInfo);
  $('#sg_summaryWorldInfoTarget').val(String(s.summaryWorldInfoTarget || 'chatbook'));
  $('#sg_summaryWorldInfoFile').val(String(s.summaryWorldInfoFile || ''));
  fillWorldbookSelect(
    $('#sg_summaryWorldbookSelect'),
    Array.isArray(s.summaryWorldInfoFilesCache) ? s.summaryWorldInfoFilesCache : [],
    normalizeWorldInfoFileName(s.summaryWorldInfoFile)
  );
  $('#sg_summaryWorldInfoCommentPrefix').val(String(s.summaryWorldInfoCommentPrefix || '剧情总结'));
  $('#sg_summaryWorldInfoKeyMode').val(String(s.summaryWorldInfoKeyMode || 'keywords'));
  $('#sg_summaryIndexPrefix').val(String(s.summaryIndexPrefix || 'A-'));
  $('#sg_summaryIndexPad').val(s.summaryIndexPad ?? 3);
  $('#sg_summaryIndexStart').val(s.summaryIndexStart ?? 1);
  $('#sg_summaryIndexInComment').prop('checked', !!s.summaryIndexInComment);
  $('#sg_summaryToBlueWorldInfo').prop('checked', !!s.summaryToBlueWorldInfo);
  $('#sg_summaryAutoRollback').prop('checked', !!s.summaryAutoRollback);
  $('#sg_structuredAutoRollback').prop('checked', !!s.structuredAutoRollback);
  $('#sg_summaryBlueWorldInfoFile').val(String(s.summaryBlueWorldInfoFile || ''));
  fillWorldbookSelect(
    $('#sg_summaryBlueWorldbookSelect'),
    Array.isArray(s.summaryWorldInfoFilesCache) ? s.summaryWorldInfoFilesCache : [],
    normalizeWorldInfoFileName(s.summaryBlueWorldInfoFile)
  );

  // 地图功能
  $('#sg_mapEnabled').prop('checked', !!s.mapEnabled);
  $('#sg_mapSystemPrompt').val(String(s.mapSystemPrompt || DEFAULT_SETTINGS.mapSystemPrompt || ''));
  setTimeout(() => updateMapPreview(), 100);

  $('#sg_wiTriggerEnabled').prop('checked', !!s.wiTriggerEnabled);
  $('#sg_wiTriggerLookbackMessages').val(s.wiTriggerLookbackMessages || 20);
  $('#sg_wiTriggerIncludeUserMessage').prop('checked', !!s.wiTriggerIncludeUserMessage);
  $('#sg_wiTriggerUserMessageWeight').val(s.wiTriggerUserMessageWeight ?? 1.6);
  $('#sg_wiTriggerStartAfterAssistantMessages').val(s.wiTriggerStartAfterAssistantMessages || 0);
  $('#sg_wiTriggerMaxEntries').val(s.wiTriggerMaxEntries || 4);
  $('#sg_wiTriggerMaxCharacters').val(s.wiTriggerMaxCharacters ?? 2);
  $('#sg_wiTriggerMaxEquipments').val(s.wiTriggerMaxEquipments ?? 2);
  $('#sg_wiTriggerMaxFactions').val(s.wiTriggerMaxFactions ?? 2);
  $('#sg_wiTriggerMaxAchievements').val(s.wiTriggerMaxAchievements ?? 2);
  $('#sg_wiTriggerMaxSubProfessions').val(s.wiTriggerMaxSubProfessions ?? 2);
  $('#sg_wiTriggerMaxQuests').val(s.wiTriggerMaxQuests ?? 2);
  $('#sg_wiTriggerMaxPlot').val(s.wiTriggerMaxPlot ?? 3);
  $('#sg_wiTriggerMinScore').val(s.wiTriggerMinScore ?? 0.08);
  $('#sg_wiTriggerMaxKeywords').val(s.wiTriggerMaxKeywords || 24);
  $('#sg_wiTriggerInjectStyle').val(String(s.wiTriggerInjectStyle || 'hidden'));
  $('#sg_wiTriggerDebugLog').prop('checked', !!s.wiTriggerDebugLog);

  $('#sg_wiRollEnabled').prop('checked', !!s.wiRollEnabled);
  $('#sg_wiRollStatSource').val(String(s.wiRollStatSource || 'variable'));
  $('#sg_wiRollStatVarName').val(String(s.wiRollStatVarName || 'stat_data'));
  $('#sg_wiRollRandomWeight').val(s.wiRollRandomWeight ?? 0.3);
  $('#sg_wiRollDifficulty').val(String(s.wiRollDifficulty || 'normal'));
  $('#sg_wiRollInjectStyle').val(String(s.wiRollInjectStyle || 'hidden'));
  $('#sg_wiRollDebugLog').prop('checked', !!s.wiRollDebugLog);
  $('#sg_wiRollStatParseMode').val(String(s.wiRollStatParseMode || 'json'));
  $('#sg_wiRollProvider').val(String(s.wiRollProvider || 'custom'));
  $('#sg_wiRollCustomEndpoint').val(String(s.wiRollCustomEndpoint || ''));
  $('#sg_wiRollCustomApiKey').val(String(s.wiRollCustomApiKey || ''));
  $('#sg_wiRollCustomModel').val(String(s.wiRollCustomModel || 'gpt-4o-mini'));
  $('#sg_wiRollCustomMaxTokens').val(s.wiRollCustomMaxTokens || 512);
  $('#sg_wiRollCustomTopP').val(s.wiRollCustomTopP ?? 0.95);
  $('#sg_wiRollCustomTemperature').val(s.wiRollCustomTemperature ?? 0.2);
  $('#sg_wiRollCustomStream').prop('checked', !!s.wiRollCustomStream);
  $('#sg_wiRollSystemPrompt').val(String(s.wiRollSystemPrompt || DEFAULT_ROLL_SYSTEM_PROMPT));
  $('#sg_roll_custom_block').toggle(String(s.wiRollProvider || 'custom') === 'custom');
  fillRollModelSelect(Array.isArray(s.wiRollCustomModelsCache) ? s.wiRollCustomModelsCache : [], s.wiRollCustomModel);

  // 图像生成设置
  $('#sg_imageGenEnabled').prop('checked', !!s.imageGenEnabled);
  $('#sg_novelaiApiKey').val(String(s.novelaiApiKey || ''));
  $('#sg_novelaiModel').val(String(s.novelaiModel || DEFAULT_SETTINGS.novelaiModel || 'nai-diffusion-4-5-full'));
  $('#sg_novelaiResolution').val(String(s.novelaiResolution || '832x1216'));
  $('#sg_novelaiSteps').val(s.novelaiSteps || 28);
  $('#sg_novelaiScale').val(s.novelaiScale || 5);
  $('#sg_novelaiSampler').val(String(s.novelaiSampler || 'k_euler'));
  $('#sg_novelaiFixedSeedEnabled').prop('checked', !!s.novelaiFixedSeedEnabled);
  $('#sg_novelaiFixedSeed').val(Number.isFinite(Number(s.novelaiFixedSeed)) ? Number(s.novelaiFixedSeed) : 0);
  $('#sg_novelaiCfgRescale').val(Number.isFinite(Number(s.novelaiCfgRescale)) ? Number(s.novelaiCfgRescale) : 0);
  $('#sg_novelaiNoiseSchedule').val(String(s.novelaiNoiseSchedule || 'native'));
  $('#sg_novelaiLegacy').prop('checked', s.novelaiLegacy !== false);
  $('#sg_novelaiVarietyBoost').prop('checked', !!s.novelaiVarietyBoost);
  $('#sg_novelaiNegativePrompt').val(String(s.novelaiNegativePrompt || ''));

  $('#sg_imageGenAutoSave').prop('checked', !!s.imageGenAutoSave);
  $('#sg_imageGenSavePath').val(String(s.imageGenSavePath || ''));
  $('#sg_imageGenLookbackMessages').val(s.imageGenLookbackMessages || 5);
  $('#sg_imageGenReadStatData').prop('checked', !!s.imageGenReadStatData);
  $('#sg_imageGenStatVarName').val(String(s.imageGenStatVarName || 'stat_data'));
  $('#sg_imageGenCustomEndpoint').val(String(s.imageGenCustomEndpoint || ''));
  $('#sg_imageGenCustomApiKey').val(String(s.imageGenCustomApiKey || ''));
  $('#sg_imageGenCustomModel').val(String(s.imageGenCustomModel || 'gpt-4o-mini'));
  $('#sg_imageGenCustomMaxTokens').val(s.imageGenCustomMaxTokens || 1024);

  const presetList = getImageGenPresetList();
  const $presetSelect = $('#sg_imageGenPresetSelect');
  if ($presetSelect.length) {
    $presetSelect.empty();
    $presetSelect.append($('<option>').val('').text('选择预设'));
    for (const item of presetList) {
      $presetSelect.append($('<option>').val(item?.name || '').text(item?.name || '未命�?));
    }
    if (s.imageGenPresetActive) $presetSelect.val(s.imageGenPresetActive);
  }

  $('#sg_imageGenSystemPrompt').val(String(s.imageGenSystemPrompt || DEFAULT_SETTINGS.imageGenSystemPrompt));
  $('#sg_imageGenArtistPromptEnabled').prop('checked', !!s.imageGenArtistPromptEnabled);
  $('#sg_imageGenArtistPrompt').val(String(s.imageGenArtistPrompt || ''));
  $('#sg_imageGenPromptRulesEnabled').prop('checked', !!s.imageGenPromptRulesEnabled);
  $('#sg_imageGenPromptRules').val(String(s.imageGenPromptRules || ''));
  $('#sg_imageGenBatchEnabled').prop('checked', !!s.imageGenBatchEnabled);
  $('#sg_imageGenBatchPatterns').val(String(s.imageGenBatchPatterns || ''));


  // 在线图库设置
  $('#sg_imageGalleryEnabled').prop('checked', !!s.imageGalleryEnabled);
  $('#sg_imageGalleryUrl').val(String(s.imageGalleryUrl || ''));
  if (s.imageGalleryCache && s.imageGalleryCache.length > 0) {
    $('#sg_galleryInfo').text(`(已缓�?${s.imageGalleryCache.length} �?`);
  }

  // 自定义角色设�?
  $('#sg_char_provider').val(String(s.characterProvider || 'st'));
  $('#sg_char_temperature').val(s.characterTemperature ?? 0.7);
  $('#sg_char_customEndpoint').val(String(s.characterCustomEndpoint || ''));
  $('#sg_char_customApiKey').val(String(s.characterCustomApiKey || ''));
  $('#sg_char_customModel').val(String(s.characterCustomModel || 'gpt-4o-mini'));
  $('#sg_char_customMaxTokens').val(s.characterCustomMaxTokens || 2048);
  $('#sg_char_customStream').prop('checked', !!s.characterCustomStream);
  $('#sg_char_prompt_random').val(s.characterRandomPrompt || '');
  $('#sg_char_prompt_opening').val(s.characterOpeningPrompt || '');
  $('#sg_char_custom_block').toggle(String(s.characterProvider || 'st') === 'custom');

  const parkValue = s.characterPark === 'CUSTOM' ? s.characterParkCustom : s.characterPark;
  applyCharacterSelectValue($('#sg_char_park'), parkValue, $('#sg_char_park_custom'));
  $('#sg_char_park_traits').val(String(s.characterParkTraits || ''));
  const raceValue = s.characterRace === 'CUSTOM' ? s.characterRaceCustom : s.characterRace;
  applyCharacterSelectValue($('#sg_char_race'), raceValue, $('#sg_char_race_custom'));
  $('#sg_char_race_desc').val(String(s.characterRaceDesc || ''));

  const talentValue = s.characterTalent === 'CUSTOM' ? s.characterTalentCustom : s.characterTalent;
  applyCharacterSelectValue($('#sg_char_talent'), talentValue, $('#sg_char_talent_custom'));
  $('#sg_char_talent_desc').val(String(s.characterTalentDesc || ''));

  $('#sg_char_contract').val(String(s.characterContractId || ''));
  $('#sg_char_difficulty').val(String(s.characterDifficulty || 30));
  $('#sg_char_random_llm').prop('checked', !!s.characterRandomLLM);

  $('#sg_char_attr_con').val(s.characterAttributes?.con ?? 0);
  $('#sg_char_attr_int').val(s.characterAttributes?.int ?? 0);
  $('#sg_char_attr_cha').val(s.characterAttributes?.cha ?? 0);
  $('#sg_char_attr_str').val(s.characterAttributes?.str ?? 0);
  $('#sg_char_attr_agi').val(s.characterAttributes?.agi ?? 0);
  $('#sg_char_attr_luk').val(s.characterAttributes?.luk ?? 0);
  updateCharacterForm();

  // 角色标签世界书设�?
  $('#sg_imageGenProfilesEnabled').prop('checked', !!s.imageGenCharacterProfilesEnabled);
  renderCharacterProfilesUi();
  const expanded = !!s.imageGenProfilesExpanded;
  $('#sg_imageGenProfiles').toggleClass('sg-profiles-collapsed', !expanded);
  $('#sg_imageGenProfilesToggle').text(expanded ? '折叠' : '展开');
  $('#sg_imageGenCustomFemalePrompt1').val(String(s.imageGenCustomFemalePrompt1 || ''));
  $('#sg_imageGenCustomFemalePrompt2').val(String(s.imageGenCustomFemalePrompt2 || ''));


  $('#sg_wiTriggerMatchMode').val(String(s.wiTriggerMatchMode || 'local'));
  $('#sg_wiIndexPrefilterTopK').val(s.wiIndexPrefilterTopK ?? 24);
  $('#sg_wiIndexProvider').val(String(s.wiIndexProvider || 'st'));
  $('#sg_wiIndexTemperature').val(s.wiIndexTemperature ?? 0.2);
  $('#sg_wiIndexSystemPrompt').val(String(s.wiIndexSystemPrompt || DEFAULT_INDEX_SYSTEM_PROMPT));
  $('#sg_wiIndexUserTemplate').val(String(s.wiIndexUserTemplate || DEFAULT_INDEX_USER_TEMPLATE));
  $('#sg_wiIndexCustomEndpoint').val(String(s.wiIndexCustomEndpoint || ''));
  $('#sg_wiIndexCustomApiKey').val(String(s.wiIndexCustomApiKey || ''));
  $('#sg_wiIndexCustomModel').val(String(s.wiIndexCustomModel || 'gpt-4o-mini'));
  $('#sg_wiIndexCustomMaxTokens').val(s.wiIndexCustomMaxTokens || 1024);
  $('#sg_wiIndexTopP').val(s.wiIndexTopP ?? 0.95);
  $('#sg_wiIndexCustomStream').prop('checked', !!s.wiIndexCustomStream);
  fillIndexModelSelect(Array.isArray(s.wiIndexCustomModelsCache) ? s.wiIndexCustomModelsCache : [], s.wiIndexCustomModel);

  const mm = String(s.wiTriggerMatchMode || 'local');
  $('#sg_index_llm_block').toggle(mm === 'llm');
  $('#sg_index_custom_block').toggle(mm === 'llm' && String(s.wiIndexProvider || 'st') === 'custom');

  $('#sg_wiBlueIndexMode').val(String(s.wiBlueIndexMode || 'live'));
  $('#sg_wiBlueIndexFile').val(String(s.wiBlueIndexFile || ''));
  $('#sg_summaryMaxChars').val(s.summaryMaxCharsPerMessage || 4000);
  $('#sg_summaryMaxTotalChars').val(s.summaryMaxTotalChars || 24000);

  $('#sg_summary_custom_block').toggle(String(s.summaryProvider || 'st') === 'custom');
  $('#sg_summaryWorldInfoFile').show();
  $('#sg_summaryBlueWorldInfoFile').toggle(!!s.summaryToBlueWorldInfo);
  $('#sg_summaryIndexFormat').toggle(String(s.summaryWorldInfoKeyMode || 'keywords') === 'indexId');

  updateBlueIndexInfoLabel();
  updateStructuredWorldbookInfoLabel();

  updateSummaryInfoLabel();
  renderSummaryPaneFromMeta();
  renderWiTriggerLogs();
  renderRollLogs();

  updateButtonsEnabled();

  // ===== 平行世界 =====
  $('#sg_parallelWorldEnabled').prop('checked', !!s.parallelWorldEnabled);
  $('#sg_parallelWorldAutoTrigger').prop('checked', !!s.parallelWorldAutoTrigger);
  $('#sg_parallelWorldAutoEvery').val(s.parallelWorldAutoEvery || 5);
  $('#sg_parallelWorldProvider').val(s.parallelWorldProvider || 'st');
  $('#sg_parallelWorldTemperature').val(s.parallelWorldTemperature ?? 0.7);
  $('#sg_parallelWorldWriteToWorldbook').prop('checked', s.parallelWorldWriteToWorldbook !== false);
  $('#sg_parallelWorldInjectContext').prop('checked', s.parallelWorldInjectContext !== false);
  $('#sg_parallelWorldMaxEventsPerNpc').val(s.parallelWorldMaxEventsPerNpc || 10);
  $('#sg_parallelWorldCustomEndpoint').val(s.parallelWorldCustomEndpoint || '');
  $('#sg_parallelWorldCustomApiKey').val(s.parallelWorldCustomApiKey || '');
  $('#sg_parallelWorldCustomMaxTokens').val(s.parallelWorldCustomMaxTokens || 4096);
  $('#sg_parallelWorldCustomTopP').val(s.parallelWorldCustomTopP ?? 0.95);
  $('#sg_parallelWorldCustomStream').prop('checked', !!s.parallelWorldCustomStream);
  $('#sg_parallelWorldSystemPrompt').val(s.parallelWorldSystemPrompt || DEFAULT_PARALLEL_WORLD_SYSTEM_PROMPT);
  $('#sg_parallelWorldUserTemplate').val(s.parallelWorldUserTemplate || DEFAULT_PARALLEL_WORLD_USER_TEMPLATE);
  $('#sg_parallelWorldClock').val(s.parallelWorldClock || '');
  $('#sg_parallelWorldReadFloors').val(s.parallelWorldReadFloors || 5);
  $('#sg_parallelCustomBlock').toggle(s.parallelWorldProvider === 'custom');
  if (Array.isArray(s.parallelWorldCustomModelsCache) && s.parallelWorldCustomModelsCache.length) {
    fillParallelWorldModelSelect(s.parallelWorldCustomModelsCache, s.parallelWorldCustomModel);
  }
  // 世界时钟显示
  try {
    const pwData = getParallelWorldData();
    updateParallelWorldClockDisplay(pwData.worldClock || s.parallelWorldClock || '�?�?);
  } catch { }
}

function updateBlueIndexInfoLabel() {
  const $info = $('#sg_blueIndexInfo');
  if (!$info.length) return;
  const s = ensureSettings();
  const count = Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex.length : 0;
  const mode = String(s.wiBlueIndexMode || 'live');
  if (mode === 'live') {
    const file = pickBlueIndexFileName();
    const ts = blueIndexLiveCache?.loadedAt ? new Date(Number(blueIndexLiveCache.loadedAt)).toLocaleTimeString() : '';
    const err = String(blueIndexLiveCache?.lastError || '').trim();
    const errShort = err ? err.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, ' ').slice(0, 60) + (err.length > 60 ? '�? : '') : '';
    $info.text(`（蓝灯索引：${count} 条｜实时�?{file || '未设�?}${ts ? `｜更新：${ts}` : ''}${errShort ? `｜读取失败：${errShort}` : ''}）`);
  } else {
    $info.text(`（蓝灯索引：${count} 条｜缓存）`);
  }
}

function updateStructuredWorldbookInfoLabel() {
  const $info = $('#sg_structuredWorldbookInfo');
  if (!$info.length) return;
  const s = ensureSettings();
  if (!s.structuredWorldbookEnabled) {
    $info.text('（未启用�?);
    return;
  }
  const stats = structuredWorldbookLiveCache || {};
  const count = Number(stats.usedEntries || 0);
  const tokens = Number(stats.tokens || 0);
  const total = Number(stats.totalEntries || 0);
  const mode = String(s.structuredWorldbookMode || 'active');
  const file = pickBlueIndexFileName();
  const ts = stats.loadedAt ? new Date(Number(stats.loadedAt)).toLocaleTimeString() : '';
  const err = String(stats.lastError || '').trim();
  const errShort = err ? err.replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, ' ').slice(0, 60) + (err.length > 60 ? '...' : '') : '';

  let text = `（蓝灯世界书�?{count} 条｜�?${tokens} tokens`;
  if (total && total !== count) text += `/${total}`;
  text += `�?{mode}�?{file || '未设�?}`;
  if (ts) text += `｜更新：${ts}`;
  if (errShort) text += `｜读取失败：${errShort}`;
  text += '�?;
  $info.text(text);
}

// -------------------- wiTrigger logs (per chat meta) --------------------

function formatTimeShort(ts) {
  try {
    const d = new Date(Number(ts) || Date.now());
    return d.toLocaleTimeString();
  } catch {
    return '';
  }
}

function renderWiTriggerLogs(metaOverride = null) {
  const $box = $('#sg_wiLogs');
  if (!$box.length) return;
  const meta = metaOverride || getSummaryMeta();
  const logs = Array.isArray(meta?.wiTriggerLogs) ? meta.wiTriggerLogs : [];
  if (!logs.length) {
    $box.html('<div class="sg-hint">(暂无)</div>');
    return;
  }

  const shown = logs.slice(0, 30);
  const html = shown.map((l) => {
    const ts = formatTimeShort(l.ts);
    const skipped = l.skipped === true;
    const picked = Array.isArray(l.picked) ? l.picked : [];
    const titles = picked.map(x => String(x?.title || '').trim()).filter(Boolean);
    const titleShort = titles.length
      ? (titles.slice(0, 4).join('�?) + (titles.length > 4 ? '�? : ''))
      : '（无命中条目�?;
    const user = String(l.userText || '').replace(/        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;s+/g, ' ').trim();
    const userShort = user ? (user.slice(0, 120) + (user.length > 120 ? '�? : '')) : '';
    const kws = Array.isArray(l.injectedKeywords) ? l.injectedKeywords : [];
    const kwsShort = kws.length ? (kws.slice(0, 20).join('�?) + (kws.length > 20 ? '�? : '')) : '';

    if (skipped) {
      const assistantFloors = Number(l.assistantFloors || 0);
      const startAfter = Number(l.startAfter || 0);
      const reasonKey = String(l.skippedReason || '').trim();
      const reasonText = reasonKey === 'minAssistantFloors'
        ? `AI 回复楼层不足�?{assistantFloors}/${startAfter}）`
        : (reasonKey || '跳过');
      const detailsLines = [];
      if (userShort) detailsLines.push(`<div><b>用户输入</b>�?{escapeHtml(userShort)}</div>`);
      detailsLines.push(`<div><b>未触�?/b>�?{escapeHtml(reasonText)}</div>`);
      return `
      <details>
        <summary>${escapeHtml(`${ts}｜未触发�?{reasonText}`)}</summary>
        <div class="sg-log-body">${detailsLines.join('')}</div>
      </details>
    `;
    }

    const detailsLines = [];
    if (userShort) detailsLines.push(`<div><b>用户输入</b>�?{escapeHtml(userShort)}</div>`);
    detailsLines.push(`<div><b>将触发绿灯条�?/b>�?{escapeHtml(titles.join('�?) || '（无�?)}</div>`);
    detailsLines.push(`<div><b>注入触发�?/b>�?{escapeHtml(kwsShort || '（无�?)}</div>`);
    if (picked.length) {
      const scored = picked.map(x => `${String(x.title || '').trim()}�?{Number(x.score || 0).toFixed(2)}）`).join('�?);
      detailsLines.push(`<div class="sg-hint">相似度：${escapeHtml(scored)}</div>`);
    }
    return `
      <details>
        <summary>${escapeHtml(`${ts}｜命�?{titles.length}条：${titleShort}`)}</summary>
        <div class="sg-log-body">${detailsLines.join('')}</div>
      </details>
    `;
  }).join('');

  $box.html(html);
}

function appendWiTriggerLog(log) {
  try {
    const meta = getSummaryMeta();
    const arr = Array.isArray(meta.wiTriggerLogs) ? meta.wiTriggerLogs : [];
    arr.unshift(log);
    meta.wiTriggerLogs = arr.slice(0, 50);
    // �?await：避免阻�?MESSAGE_SENT
    setSummaryMeta(meta).catch(() => void 0);
    if ($('#sg_modal_backdrop').is(':visible')) renderWiTriggerLogs(meta);
  } catch { /* ignore */ }
}

function renderRollLogs(metaOverride = null) {
  const $box = $('#sg_rollLogs');
  if (!$box.length) return;
  const meta = metaOverride || getSummaryMeta();
  const logs = Array.isArray(meta?.rollLogs) ? meta.rollLogs : [];
  if (!logs.length) {
    $box.html('(暂无)');
    return;
  }
  const shown = logs.slice(0, 30);
  const html = shown.map((l) => {
    const ts = l?.ts ? new Date(l.ts).toLocaleString() : '';
    const action = String(l?.action || '').trim();
    const outcome = String(l?.outcomeTier || '').trim()
      || (l?.success == null ? 'N/A' : (l.success ? '成功' : '失败'));
    const finalVal = Number.isFinite(Number(l?.final)) ? Number(l.final).toFixed(2) : '';
    let summary = '';
    if (l?.summary && typeof l.summary === 'object') {
      const pick = l.summary.summary ?? l.summary.text ?? l.summary.message;
      summary = String(pick || '').trim();
      if (!summary) {
        try { summary = JSON.stringify(l.summary); } catch { summary = String(l.summary); }
      }
    } else {
      summary = String(l?.summary || '').trim();
    }
    const userShort = String(l?.userText || '').trim().slice(0, 160);

    const detailsLines = [];
    if (userShort) detailsLines.push(`<div><b>用户输入</b>�?{escapeHtml(userShort)}</div>`);
    if (summary) detailsLines.push(`<div><b>摘要</b>�?{escapeHtml(summary)}</div>`);
    return `
      <details>
        <summary>${escapeHtml(`${ts}�?{action || 'ROLL'}�?{outcome}${finalVal ? `｜最�?${finalVal}` : ''}`)}</summary>
        <div class="sg-log-body">${detailsLines.join('')}</div>
      </details>
    `;
  }).join('');
  $box.html(html);
}

function appendRollLog(log) {
  try {
    const meta = getSummaryMeta();
    const arr = Array.isArray(meta.rollLogs) ? meta.rollLogs : [];
    arr.unshift(log);
    meta.rollLogs = arr.slice(0, 50);
    setSummaryMeta(meta).catch(() => void 0);
    if ($('#sg_modal_backdrop').is(':visible')) renderRollLogs(meta);
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
    const base = `已导入世界书�?{stats.importedEntries} 条`;
    if (!s.worldbookEnabled) {
      $info.text(`${base}（未启用注入）`);
      return;
    }
    if (stats.mode === 'active' && stats.selectedEntries === 0) {
      $info.text(`${base}｜模式：active｜本次无条目命中�? 条）`);
      return;
    }
    $info.text(`${base}｜模式：${stats.mode}｜本次注入：${stats.injectedEntries} 条｜字符�?{stats.injectedChars}｜约 tokens�?{stats.injectedTokens}`);
  } catch {
    $info.text('（世界书信息解析失败�?);
  }
}

function renderSexGuideWorldbookList() {
  const $list = $('#sg_sexWorldbookList');
  if (!$list.length) return;
  const list = getSexGuideWorldbooks();
  const stats = computeSexGuideWorldbookInjection();

  if (!list.length) {
    $list.html('<div class="sg-hint">(未导入世界书)</div>');
    return;
  }

  const rows = list.map((wb) => {
    const stat = stats.perBookStats?.find(s => s.id === wb.id);
    const entries = stat?.entries ?? 0;
    const tokens = stat?.tokens ?? 0;
    const injected = stat?.injectedEntries ?? 0;
    return `
      <div class="sg-wb-item" data-id="${wb.id}">
        <label class="sg-check"><input type="checkbox" class="sg-sex-wb-enabled" ${wb.enabled ? 'checked' : ''}>启用</label>
        <div class="sg-wb-meta">
          <div class="sg-wb-name">${escapeHtml(wb.name)}</div>
          <div class="sg-wb-sub">条目�?{entries} �?tokens�?{tokens} �?本次注入�?{injected}</div>
        </div>
        <button class="menu_button sg-btn sg-sex-wb-remove">移除</button>
      </div>
    `;
  }).join('');

  $list.html(rows);
}

function updateSexGuideWorldbookInfoLabel() {
  const $info = $('#sg_sexWorldbookInfo');
  if (!$info.length) return;
  const s = ensureSettings();
  const stats = computeSexGuideWorldbookInjection();
  const enabledNames = getSexGuideWorldbooks().filter(w => w.enabled).map(w => w.name);

  if (!stats.totalWorldbooks) {
    $info.text('(未导入世界书)');
    return;
  }

  if (!s.sexGuideWorldbookEnabled) {
    $info.text(`已导入世界书�?{stats.totalWorldbooks} 本（未启用注入）`);
    return;
  }

  const dirs = enabledNames.length ? enabledNames.join(' / ') : '�?;
  $info.text(`读取目录�?{dirs} �?条目�?{stats.injectedEntries}/${stats.importedEntries} �?tokens�?{stats.injectedTokens}`);
}

function formatSummaryMetaHint(meta) {
  const last = Number(meta?.lastFloor || 0);
  const count = Array.isArray(meta?.history) ? meta.history.length : 0;
  if (!last && !count) return '（未生成�?;
  return `已生�?${count} 次｜上次触发层：${last}`;
}

function updateSummaryInfoLabel() {
  const $info = $('#sg_summaryInfo');
  if (!$info.length) return;
  try {
    const meta = getSummaryMeta();
    $info.text(formatSummaryMetaHint(meta));
  } catch {
    $info.text('（总结状态解析失败）');
  }
}


function updateSummaryManualRangeHint(setDefaults = false) {
  const $hint = $('#sg_summaryManualHint');
  if (!$hint.length) return;

  try {
    const s = ensureSettings();
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const mode = String(s.summaryCountMode || 'assistant');
    const floorNow = computeFloorCount(chat, mode, true, true);
    const every = clampInt(s.summaryEvery, 1, 200, 20);

    // Optional: show how many entries would be generated when manual split is enabled.
    const $from = $('#sg_summaryManualFrom');
    const $to = $('#sg_summaryManualTo');
    let extra = '';
    if (s.summaryManualSplit) {
      const fromVal0 = String($from.val() ?? '').trim();
      const toVal0 = String($to.val() ?? '').trim();
      const fromN = Number(fromVal0);
      const toN = Number(toVal0);
      if (Number.isFinite(fromN) && Number.isFinite(toN) && fromN > 0 && toN > 0 && floorNow > 0) {
        const a = clampInt(fromN, 1, floorNow, 1);
        const b = clampInt(toN, 1, floorNow, floorNow);
        const len = Math.abs(b - a) + 1;
        const pieces = Math.max(1, Math.ceil(len / every));
        extra = `｜分段：${pieces} 条（�?{every}层）`;
      } else {
        extra = `｜分段：�?{every}层一条`;
      }
    }

    $hint.text(`（可选范围：1-${floorNow || 0}${extra}）`);
    if (!$from.length || !$to.length) return;

    const fromVal = String($from.val() ?? '').trim();
    const toVal = String($to.val() ?? '').trim();

    if (setDefaults && floorNow > 0 && (!fromVal || !toVal)) {
      const a = Math.max(1, floorNow - every + 1);
      $from.val(a);
      $to.val(floorNow);
    }
  } catch {
    $hint.text('（可选范围：?�?);
  }
}

function renderSummaryPaneFromMeta() {
  const $el = $('#sg_sum');
  if (!$el.length) return;

  const meta = getSummaryMeta();
  const hist = Array.isArray(meta.history) ? meta.history : [];

  if (!hist.length) {
    lastSummary = null;
    lastSummaryText = '';
    $el.html('(尚未生成)');
    updateButtonsEnabled();
    return;
  }

  const last = hist[hist.length - 1];
  lastSummary = last;
  lastSummaryText = String(last?.summary || '');

  const md = hist.slice(-12).reverse().map((h, idx) => {
    const displayTitle = buildSummaryCoreTitle(h.title, h.indexId, ensureSettings(), h.commentPrefix, true);
    const kws = Array.isArray(h.keywords) ? h.keywords : [];
    const when = h.createdAt ? new Date(h.createdAt).toLocaleString() : '';
    const range = h?.range ? `�?{h.range.fromFloor}-${h.range.toFloor}）` : '';
    return `### ${displayTitle} ${range}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n- 时间�?{when}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n- 关键词：${kws.join('�?) || '（无�?}        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n${h.summary || ''}`;
  }).join('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n---        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;n');

  const mdText = String(md || '');
  renderMarkdownInto($el, mdText);
  updateButtonsEnabled();
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

  // 快捷选项写入
  s.quickOptionsEnabled = $('#sg_quickOptionsEnabled').is(':checked');
  s.quickOptionsShowIn = String($('#sg_quickOptionsShowIn').val() || 'inline');
  s.quickOptionsJson = String($('#sg_quickOptionsJson').val() || '[]');

  s.presetIncludeApiKey = $('#sg_presetIncludeApiKey').is(':checked');

  s.worldbookEnabled = $('#sg_worldbookEnabled').is(':checked');
  s.worldbookMode = String($('#sg_worldbookMode').val() || 'active');
  s.worldbookMaxChars = clampInt($('#sg_worldbookMaxChars').val(), 500, 50000, s.worldbookMaxChars || 6000);
  s.worldbookWindowMessages = clampInt($('#sg_worldbookWindowMessages').val(), 5, 80, s.worldbookWindowMessages || 18);

  // sex guide
  s.sexGuideEnabled = $('#sg_sexEnabled').is(':checked');
  s.sexGuideProvider = String($('#sg_sex_provider').val() || 'st');
  s.sexGuideTemperature = clampFloat($('#sg_sex_temperature').val(), 0, 2, s.sexGuideTemperature ?? 0.6);
  s.sexGuideSystemPrompt = String($('#sg_sexSystemPrompt').val() || '').trim() || DEFAULT_SEX_GUIDE_SYSTEM_PROMPT;
  s.sexGuideUserTemplate = String($('#sg_sexUserTemplate').val() || '').trim() || DEFAULT_SEX_GUIDE_USER_TEMPLATE;
  s.sexGuideUserNeed = String($('#sg_sexUserNeed').val() || '').trim();
  s.sexGuideIncludeUserInput = $('#sg_sexIncludeUserInput').is(':checked');
  s.sexGuideCustomEndpoint = String($('#sg_sexCustomEndpoint').val() || '').trim();
  s.sexGuideCustomApiKey = String($('#sg_sexCustomApiKey').val() || '');
  s.sexGuideCustomModel = String($('#sg_sexCustomModel').val() || '').trim() || 'gpt-4o-mini';
  s.sexGuideCustomMaxTokens = clampInt($('#sg_sexCustomMaxTokens').val(), 256, 200000, s.sexGuideCustomMaxTokens || 2048);
  s.sexGuideCustomStream = $('#sg_sexCustomStream').is(':checked');
  s.sexGuideWorldbookEnabled = $('#sg_sexWorldbookEnabled').is(':checked');
  s.sexGuideWorldbookMaxChars = clampInt($('#sg_sexWorldbookMaxChars').val(), 500, 200000, s.sexGuideWorldbookMaxChars || 6000);

  // summary
  s.summaryEnabled = $('#sg_summaryEnabled').is(':checked');
  s.summaryEvery = clampInt($('#sg_summaryEvery').val(), 1, 200, s.summaryEvery || 20);
  s.summaryManualSplit = $('#sg_summaryManualSplit').is(':checked');
  s.summaryCountMode = String($('#sg_summaryCountMode').val() || 'assistant');
  s.summaryProvider = String($('#sg_summaryProvider').val() || 'st');
  s.summaryTemperature = clampFloat($('#sg_summaryTemperature').val(), 0, 2, s.summaryTemperature || 0.4);
  s.summarySystemPrompt = String($('#sg_summarySystemPrompt').val() || '').trim() || DEFAULT_SUMMARY_SYSTEM_PROMPT;
  s.summaryUserTemplate = String($('#sg_summaryUserTemplate').val() || '').trim() || DEFAULT_SUMMARY_USER_TEMPLATE;
  s.summaryReadStatData = $('#sg_summaryReadStatData').is(':checked');
  s.summaryStatVarName = String($('#sg_summaryStatVarName').val() || 'stat_data').trim() || 'stat_data';
  s.structuredEntriesEvery = clampInt($('#sg_structuredEntriesEvery').val(), 1, 200, s.structuredEntriesEvery || 1);
  s.structuredEntriesReadFloors = clampInt($('#sg_structuredEntriesReadFloors').val(), 1, 200, s.structuredEntriesEvery || 1);
  s.structuredEntriesCountMode = String($('#sg_structuredEntriesCountMode').val() || 'assistant');
  s.structuredEntryContentFormat = String($('#sg_structuredEntryContentFormat').val() || 'text');
  s.structuredWorldbookEnabled = $('#sg_structuredWorldbookEnabled').is(':checked');
  s.structuredWorldbookMode = String($('#sg_structuredWorldbookMode').val() || 'active');
  s.megaSummaryEnabled = $('#sg_megaSummaryEnabled').is(':checked');
  s.megaSummaryEvery = clampInt($('#sg_megaSummaryEvery').val(), 5, 5000, s.megaSummaryEvery || 40);
  s.megaSummaryCommentPrefix = String($('#sg_megaSummaryCommentPrefix').val() || '大总结').trim() || '大总结';
  s.megaSummarySystemPrompt = String($('#sg_megaSummarySystemPrompt').val() || '').trim() || DEFAULT_MEGA_SUMMARY_SYSTEM_PROMPT;
  s.megaSummaryUserTemplate = String($('#sg_megaSummaryUserTemplate').val() || '').trim() || DEFAULT_MEGA_SUMMARY_USER_TEMPLATE;
  s.structuredEntriesEnabled = $('#sg_structuredEntriesEnabled').is(':checked');
  s.characterEntriesEnabled = $('#sg_characterEntriesEnabled').is(':checked');
  s.equipmentEntriesEnabled = $('#sg_equipmentEntriesEnabled').is(':checked');
  s.inventoryEntriesEnabled = $('#sg_inventoryEntriesEnabled').is(':checked');
  s.factionEntriesEnabled = $('#sg_factionEntriesEnabled').is(':checked');
  s.structuredReenableEntriesEnabled = $('#sg_structuredReenableEntriesEnabled').is(':checked');
  s.achievementEntriesEnabled = $('#sg_achievementEntriesEnabled').is(':checked');
  s.subProfessionEntriesEnabled = $('#sg_subProfessionEntriesEnabled').is(':checked');
  s.questEntriesEnabled = $('#sg_questEntriesEnabled').is(':checked');
  s.conquestEntriesEnabled = $('#sg_conquestEntriesEnabled').is(':checked');
  s.characterEntryPrefix = String($('#sg_characterEntryPrefix').val() || '人物').trim() || '人物';
  s.equipmentEntryPrefix = String($('#sg_equipmentEntryPrefix').val() || '装备').trim() || '装备';
  s.inventoryEntryPrefix = String($('#sg_inventoryEntryPrefix').val() || '物品�?).trim() || '物品�?;
  s.factionEntryPrefix = String($('#sg_factionEntryPrefix').val() || '势力').trim() || '势力';
  s.achievementEntryPrefix = String($('#sg_achievementEntryPrefix').val() || '成就').trim() || '成就';
  s.subProfessionEntryPrefix = String($('#sg_subProfessionEntryPrefix').val() || '副职�?).trim() || '副职�?;
  s.questEntryPrefix = String($('#sg_questEntryPrefix').val() || '任务').trim() || '任务';
  s.conquestEntryPrefix = String($('#sg_conquestEntryPrefix').val() || '猎艳�?).trim() || '猎艳�?;
  s.structuredEntriesSystemPrompt = String($('#sg_structuredEntriesSystemPrompt').val() || '').trim() || DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT;
  s.structuredEntriesUserTemplate = String($('#sg_structuredEntriesUserTemplate').val() || '').trim() || DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE;
  s.structuredCharacterPrompt = String($('#sg_structuredCharacterPrompt').val() || '').trim() || DEFAULT_STRUCTURED_CHARACTER_PROMPT;
  s.structuredCharacterEntryTemplate = String($('#sg_structuredCharacterEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_CHARACTER_ENTRY_TEMPLATE;
  s.structuredEquipmentPrompt = String($('#sg_structuredEquipmentPrompt').val() || '').trim() || DEFAULT_STRUCTURED_EQUIPMENT_PROMPT;
  s.structuredEquipmentEntryTemplate = String($('#sg_structuredEquipmentEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_EQUIPMENT_ENTRY_TEMPLATE;
  s.structuredInventoryPrompt = String($('#sg_structuredInventoryPrompt').val() || '').trim() || DEFAULT_STRUCTURED_INVENTORY_PROMPT;
  s.structuredInventoryEntryTemplate = String($('#sg_structuredInventoryEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_INVENTORY_ENTRY_TEMPLATE;
  s.structuredFactionPrompt = String($('#sg_structuredFactionPrompt').val() || '').trim() || DEFAULT_STRUCTURED_FACTION_PROMPT;
  s.structuredFactionEntryTemplate = String($('#sg_structuredFactionEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_FACTION_ENTRY_TEMPLATE;
  s.structuredAchievementPrompt = String($('#sg_structuredAchievementPrompt').val() || '').trim() || DEFAULT_STRUCTURED_ACHIEVEMENT_PROMPT;
  s.structuredAchievementEntryTemplate = String($('#sg_structuredAchievementEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_ACHIEVEMENT_ENTRY_TEMPLATE;
  s.structuredSubProfessionPrompt = String($('#sg_structuredSubProfessionPrompt').val() || '').trim() || DEFAULT_STRUCTURED_SUBPROFESSION_PROMPT;
  s.structuredSubProfessionEntryTemplate = String($('#sg_structuredSubProfessionEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_SUBPROFESSION_ENTRY_TEMPLATE;
  s.structuredQuestPrompt = String($('#sg_structuredQuestPrompt').val() || '').trim() || DEFAULT_STRUCTURED_QUEST_PROMPT;
  s.structuredQuestEntryTemplate = String($('#sg_structuredQuestEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_QUEST_ENTRY_TEMPLATE;
  s.structuredConquestPrompt = String($('#sg_structuredConquestPrompt').val() || '').trim() || DEFAULT_STRUCTURED_CONQUEST_PROMPT;
  s.structuredConquestEntryTemplate = String($('#sg_structuredConquestEntryTemplate').val() || '').trim() || DEFAULT_STRUCTURED_CONQUEST_ENTRY_TEMPLATE;
  s.summaryCustomEndpoint = String($('#sg_summaryCustomEndpoint').val() || '').trim();
  s.summaryCustomApiKey = String($('#sg_summaryCustomApiKey').val() || '');
  s.summaryCustomModel = String($('#sg_summaryCustomModel').val() || '').trim() || 'gpt-4o-mini';
  s.summaryCustomMaxTokens = clampInt($('#sg_summaryCustomMaxTokens').val(), 128, 200000, s.summaryCustomMaxTokens || 2048);
  s.summaryCustomStream = $('#sg_summaryCustomStream').is(':checked');
  s.summaryToWorldInfo = $('#sg_summaryToWorldInfo').is(':checked');
  s.summaryToBlueWorldInfo = $('#sg_summaryToBlueWorldInfo').is(':checked');
  s.summaryAutoRollback = $('#sg_summaryAutoRollback').is(':checked');
  s.structuredAutoRollback = $('#sg_structuredAutoRollback').is(':checked');
  s.summaryBlueWorldInfoFile = String($('#sg_summaryBlueWorldInfoFile').val() || '').trim();
  s.summaryWorldInfoTarget = String($('#sg_summaryWorldInfoTarget').val() || 'chatbook');
  s.summaryWorldInfoFile = normalizeWorldInfoFileName($('#sg_summaryWorldInfoFile').val());
  s.summaryWorldInfoCommentPrefix = String($('#sg_summaryWorldInfoCommentPrefix').val() || '剧情总结').trim() || '剧情总结';
  s.summaryWorldInfoKeyMode = String($('#sg_summaryWorldInfoKeyMode').val() || 'keywords');
  s.summaryIndexPrefix = String($('#sg_summaryIndexPrefix').val() || 'A-').trim() || 'A-';
  s.summaryIndexPad = clampInt($('#sg_summaryIndexPad').val(), 1, 12, s.summaryIndexPad ?? 3);
  s.summaryIndexStart = clampInt($('#sg_summaryIndexStart').val(), 1, 1000000, s.summaryIndexStart ?? 1);
  s.summaryIndexInComment = $('#sg_summaryIndexInComment').is(':checked');
  s.summaryToBlueWorldInfo = $('#sg_summaryToBlueWorldInfo').is(':checked');
  s.summaryBlueWorldInfoFile = normalizeWorldInfoFileName($('#sg_summaryBlueWorldInfoFile').val());

  writeLocalStorageString(SG_SUMMARY_WI_FILE_KEY, s.summaryWorldInfoFile);
  writeLocalStorageString(SG_SUMMARY_BLUE_WI_FILE_KEY, s.summaryBlueWorldInfoFile);

  // 地图功能
  s.mapEnabled = $('#sg_mapEnabled').is(':checked');
  s.mapSystemPrompt = String($('#sg_mapSystemPrompt').val() || '').trim() || DEFAULT_SETTINGS.mapSystemPrompt;

  s.wiTriggerEnabled = $('#sg_wiTriggerEnabled').is(':checked');
  s.wiTriggerLookbackMessages = clampInt($('#sg_wiTriggerLookbackMessages').val(), 5, 120, s.wiTriggerLookbackMessages || 20);
  s.wiTriggerIncludeUserMessage = $('#sg_wiTriggerIncludeUserMessage').is(':checked');
  s.wiTriggerUserMessageWeight = clampFloat($('#sg_wiTriggerUserMessageWeight').val(), 0, 10, s.wiTriggerUserMessageWeight ?? 1.6);
  s.wiTriggerStartAfterAssistantMessages = clampInt($('#sg_wiTriggerStartAfterAssistantMessages').val(), 0, 200000, s.wiTriggerStartAfterAssistantMessages || 0);
  s.wiTriggerMaxEntries = clampInt($('#sg_wiTriggerMaxEntries').val(), 1, 20, s.wiTriggerMaxEntries || 4);
  s.wiTriggerMaxCharacters = clampInt($('#sg_wiTriggerMaxCharacters').val(), 0, 10, s.wiTriggerMaxCharacters ?? 2);
  s.wiTriggerMaxEquipments = clampInt($('#sg_wiTriggerMaxEquipments').val(), 0, 10, s.wiTriggerMaxEquipments ?? 2);
  s.wiTriggerMaxFactions = clampInt($('#sg_wiTriggerMaxFactions').val(), 0, 10, s.wiTriggerMaxFactions ?? 2);
  s.wiTriggerMaxAchievements = clampInt($('#sg_wiTriggerMaxAchievements').val(), 0, 10, s.wiTriggerMaxAchievements ?? 2);
  s.wiTriggerMaxSubProfessions = clampInt($('#sg_wiTriggerMaxSubProfessions').val(), 0, 10, s.wiTriggerMaxSubProfessions ?? 2);
  s.wiTriggerMaxQuests = clampInt($('#sg_wiTriggerMaxQuests').val(), 0, 10, s.wiTriggerMaxQuests ?? 2);
  s.wiTriggerMaxPlot = clampInt($('#sg_wiTriggerMaxPlot').val(), 0, 10, s.wiTriggerMaxPlot ?? 3);
  s.wiTriggerMinScore = clampFloat($('#sg_wiTriggerMinScore').val(), 0, 1, (s.wiTriggerMinScore ?? 0.08));
  s.wiTriggerMaxKeywords = clampInt($('#sg_wiTriggerMaxKeywords').val(), 1, 200, s.wiTriggerMaxKeywords || 24);
  s.wiTriggerInjectStyle = String($('#sg_wiTriggerInjectStyle').val() || s.wiTriggerInjectStyle || 'hidden');
  s.wiTriggerDebugLog = $('#sg_wiTriggerDebugLog').is(':checked');

  s.wiRollEnabled = $('#sg_wiRollEnabled').is(':checked');
  s.wiRollStatSource = String($('#sg_wiRollStatSource').val() || s.wiRollStatSource || 'variable');
  s.wiRollStatVarName = String($('#sg_wiRollStatVarName').val() || s.wiRollStatVarName || 'stat_data').trim();
  s.wiRollRandomWeight = clampFloat($('#sg_wiRollRandomWeight').val(), 0, 1, s.wiRollRandomWeight ?? 0.3);
  s.wiRollDifficulty = String($('#sg_wiRollDifficulty').val() || s.wiRollDifficulty || 'normal');
  s.wiRollInjectStyle = String($('#sg_wiRollInjectStyle').val() || s.wiRollInjectStyle || 'hidden');
  s.wiRollDebugLog = $('#sg_wiRollDebugLog').is(':checked');
  s.wiRollStatParseMode = String($('#sg_wiRollStatParseMode').val() || s.wiRollStatParseMode || 'json');
  s.wiRollProvider = String($('#sg_wiRollProvider').val() || s.wiRollProvider || 'custom');
  s.wiRollCustomEndpoint = String($('#sg_wiRollCustomEndpoint').val() || s.wiRollCustomEndpoint || '').trim();
  s.wiRollCustomApiKey = String($('#sg_wiRollCustomApiKey').val() || s.wiRollCustomApiKey || '');
  s.wiRollCustomModel = String($('#sg_wiRollCustomModel').val() || s.wiRollCustomModel || 'gpt-4o-mini');
  s.wiRollCustomMaxTokens = clampInt($('#sg_wiRollCustomMaxTokens').val(), 128, 200000, s.wiRollCustomMaxTokens || 512);
  s.wiRollCustomTopP = clampFloat($('#sg_wiRollCustomTopP').val(), 0, 1, s.wiRollCustomTopP ?? 0.95);
  s.wiRollCustomTemperature = clampFloat($('#sg_wiRollCustomTemperature').val(), 0, 2, s.wiRollCustomTemperature ?? 0.2);
  s.wiRollCustomStream = $('#sg_wiRollCustomStream').is(':checked');
  s.wiRollSystemPrompt = String($('#sg_wiRollSystemPrompt').val() || '').trim() || DEFAULT_ROLL_SYSTEM_PROMPT;

  // 图像生成设置
  s.imageGenEnabled = $('#sg_imageGenEnabled').is(':checked');
  s.novelaiApiKey = String($('#sg_novelaiApiKey').val() || '').trim();
  s.novelaiModel = String($('#sg_novelaiModel').val() || DEFAULT_SETTINGS.novelaiModel || 'nai-diffusion-4-5-full');
  s.novelaiResolution = String($('#sg_novelaiResolution').val() || '832x1216');
  s.novelaiSteps = clampInt($('#sg_novelaiSteps').val(), 1, 50, s.novelaiSteps || 28);
  s.novelaiScale = clampFloat($('#sg_novelaiScale').val(), 1, 10, s.novelaiScale || 5);
  s.novelaiSampler = String($('#sg_novelaiSampler').val() || s.novelaiSampler || 'k_euler');
  s.novelaiFixedSeedEnabled = $('#sg_novelaiFixedSeedEnabled').is(':checked');
  s.novelaiFixedSeed = clampInt($('#sg_novelaiFixedSeed').val(), 0, 4294967295, s.novelaiFixedSeed || 0);
  s.novelaiCfgRescale = clampFloat($('#sg_novelaiCfgRescale').val(), 0, 1, s.novelaiCfgRescale ?? 0);
  s.novelaiNoiseSchedule = String($('#sg_novelaiNoiseSchedule').val() || s.novelaiNoiseSchedule || 'native');
  s.novelaiLegacy = $('#sg_novelaiLegacy').is(':checked');
  s.novelaiVarietyBoost = $('#sg_novelaiVarietyBoost').is(':checked');
  s.novelaiNegativePrompt = String($('#sg_novelaiNegativePrompt').val() || '').trim();

  s.imageGenAutoSave = $('#sg_imageGenAutoSave').is(':checked');
  s.imageGenSavePath = String($('#sg_imageGenSavePath').val() || '').trim();
  s.imageGenLookbackMessages = clampInt($('#sg_imageGenLookbackMessages').val(), 1, 30, s.imageGenLookbackMessages || 5);
  s.imageGenReadStatData = $('#sg_imageGenReadStatData').is(':checked');
  s.imageGenStatVarName = String($('#sg_imageGenStatVarName').val() || 'stat_data').trim() || 'stat_data';
  s.imageGenCustomEndpoint = String($('#sg_imageGenCustomEndpoint').val() || '').trim();
  s.imageGenCustomApiKey = String($('#sg_imageGenCustomApiKey').val() || '').trim();
  s.imageGenCustomModel = String($('#sg_imageGenCustomModel').val() || 'gpt-4o-mini');
  s.imageGenCustomMaxTokens = clampInt($('#sg_imageGenCustomMaxTokens').val(), 128, 200000, s.imageGenCustomMaxTokens || 1024);

  s.imageGenSystemPrompt = String($('#sg_imageGenSystemPrompt').val() || '').trim() || DEFAULT_SETTINGS.imageGenSystemPrompt;
  s.imageGenArtistPromptEnabled = $('#sg_imageGenArtistPromptEnabled').is(':checked');
  s.imageGenArtistPrompt = String($('#sg_imageGenArtistPrompt').val() || '').trim();
  s.imageGenPromptRulesEnabled = $('#sg_imageGenPromptRulesEnabled').is(':checked');
  s.imageGenPromptRules = String($('#sg_imageGenPromptRules').val() || '').trim();
  s.imageGenBatchEnabled = $('#sg_imageGenBatchEnabled').is(':checked');
  s.imageGenBatchPatterns = String($('#sg_imageGenBatchPatterns').val() || '').trim();

  // 在线图库设置

  s.imageGalleryEnabled = $('#sg_imageGalleryEnabled').is(':checked');
  s.imageGalleryUrl = String($('#sg_imageGalleryUrl').val() || '').trim();

  // 自定义角色设�?
  s.characterProvider = String($('#sg_char_provider').val() || 'st');
  s.characterTemperature = clampFloat($('#sg_char_temperature').val(), 0, 2, s.characterTemperature ?? 0.7);
  s.characterCustomEndpoint = String($('#sg_char_customEndpoint').val() || '').trim();
  s.characterCustomApiKey = String($('#sg_char_customApiKey').val() || '');
  s.characterCustomModel = String($('#sg_char_customModel').val() || '').trim() || 'gpt-4o-mini';
  s.characterCustomMaxTokens = clampInt($('#sg_char_customMaxTokens').val(), 256, 200000, s.characterCustomMaxTokens || 2048);
  s.characterCustomStream = $('#sg_char_customStream').is(':checked');
  s.characterRandomPrompt = String($('#sg_char_prompt_random').val() || '').trim();
  s.characterOpeningPrompt = String($('#sg_char_prompt_opening').val() || '').trim();

  s.characterPark = String($('#sg_char_park').val() || '');
  s.characterParkCustom = String($('#sg_char_park_custom').val() || '').trim();
  s.characterParkTraits = String($('#sg_char_park_traits').val() || '').trim();
  s.characterRace = String($('#sg_char_race').val() || '');
  s.characterRaceCustom = String($('#sg_char_race_custom').val() || '').trim();
  s.characterRaceDesc = String($('#sg_char_race_desc').val() || '').trim();
  s.characterTalent = String($('#sg_char_talent').val() || '');
  s.characterTalentCustom = String($('#sg_char_talent_custom').val() || '').trim();
  s.characterTalentDesc = String($('#sg_char_talent_desc').val() || '').trim();
  s.characterContractId = String($('#sg_char_contract').val() || '').trim();
  s.characterDifficulty = getCharacterDifficulty();
  s.characterRandomLLM = $('#sg_char_random_llm').is(':checked');
  s.characterAttributes = getCharacterAttributes();

  // 角色标签世界书设�?
  s.imageGenCharacterProfilesEnabled = $('#sg_imageGenProfilesEnabled').is(':checked');
  s.imageGenCharacterProfiles = collectCharacterProfilesFromUi();
  s.imageGenCharacterProfiles = s.imageGenCharacterProfiles || [];
  s.imageGenCustomFemalePrompt1 = String($('#sg_imageGenCustomFemalePrompt1').val() || '').trim();
  s.imageGenCustomFemalePrompt2 = String($('#sg_imageGenCustomFemalePrompt2').val() || '').trim();


  s.wiTriggerMatchMode = String($('#sg_wiTriggerMatchMode').val() || s.wiTriggerMatchMode || 'local');
  s.wiIndexPrefilterTopK = clampInt($('#sg_wiIndexPrefilterTopK').val(), 5, 80, s.wiIndexPrefilterTopK ?? 24);
  s.wiIndexProvider = String($('#sg_wiIndexProvider').val() || s.wiIndexProvider || 'st');
  s.wiIndexTemperature = clampFloat($('#sg_wiIndexTemperature').val(), 0, 2, s.wiIndexTemperature ?? 0.2);
  s.wiIndexSystemPrompt = String($('#sg_wiIndexSystemPrompt').val() || s.wiIndexSystemPrompt || DEFAULT_INDEX_SYSTEM_PROMPT);
  s.wiIndexUserTemplate = String($('#sg_wiIndexUserTemplate').val() || s.wiIndexUserTemplate || DEFAULT_INDEX_USER_TEMPLATE);
  s.wiIndexCustomEndpoint = String($('#sg_wiIndexCustomEndpoint').val() || s.wiIndexCustomEndpoint || '');
  s.wiIndexCustomApiKey = String($('#sg_wiIndexCustomApiKey').val() || s.wiIndexCustomApiKey || '');
  s.wiIndexCustomModel = String($('#sg_wiIndexCustomModel').val() || s.wiIndexCustomModel || 'gpt-4o-mini');
  s.wiIndexCustomMaxTokens = clampInt($('#sg_wiIndexCustomMaxTokens').val(), 128, 200000, s.wiIndexCustomMaxTokens || 1024);
  s.wiIndexTopP = clampFloat($('#sg_wiIndexTopP').val(), 0, 1, s.wiIndexTopP ?? 0.95);
  s.wiIndexCustomStream = $('#sg_wiIndexCustomStream').is(':checked');

  s.wiBlueIndexMode = String($('#sg_wiBlueIndexMode').val() || s.wiBlueIndexMode || 'live');
  s.wiBlueIndexFile = String($('#sg_wiBlueIndexFile').val() || '').trim();
  s.summaryMaxCharsPerMessage = clampInt($('#sg_summaryMaxChars').val(), 200, 8000, s.summaryMaxCharsPerMessage || 4000);
  s.summaryMaxTotalChars = clampInt($('#sg_summaryMaxTotalChars').val(), 2000, 80000, s.summaryMaxTotalChars || 24000);

  // ===== 平行世界 =====
  s.parallelWorldEnabled = $('#sg_parallelWorldEnabled').is(':checked');
  s.parallelWorldAutoTrigger = $('#sg_parallelWorldAutoTrigger').is(':checked');
  s.parallelWorldAutoEvery = clampInt($('#sg_parallelWorldAutoEvery').val(), 1, 50, s.parallelWorldAutoEvery || 5);
  s.parallelWorldProvider = String($('#sg_parallelWorldProvider').val() || s.parallelWorldProvider || 'st');
  s.parallelWorldTemperature = clampFloat($('#sg_parallelWorldTemperature').val(), 0, 2, s.parallelWorldTemperature ?? 0.7);
  s.parallelWorldWriteToWorldbook = $('#sg_parallelWorldWriteToWorldbook').is(':checked');
  s.parallelWorldInjectContext = $('#sg_parallelWorldInjectContext').is(':checked');
  s.parallelWorldMaxEventsPerNpc = clampInt($('#sg_parallelWorldMaxEventsPerNpc').val(), 3, 50, s.parallelWorldMaxEventsPerNpc || 10);
  s.parallelWorldCustomEndpoint = String($('#sg_parallelWorldCustomEndpoint').val() || '').trim();
  s.parallelWorldCustomApiKey = String($('#sg_parallelWorldCustomApiKey').val() || '').trim();
  s.parallelWorldCustomModel = String($('#sg_parallelWorldCustomModel').val() || s.parallelWorldCustomModel || 'gpt-4o-mini');
  s.parallelWorldCustomMaxTokens = clampInt($('#sg_parallelWorldCustomMaxTokens').val(), 256, 200000, s.parallelWorldCustomMaxTokens || 4096);
  s.parallelWorldCustomTopP = clampFloat($('#sg_parallelWorldCustomTopP').val(), 0, 1, s.parallelWorldCustomTopP ?? 0.95);
  s.parallelWorldCustomStream = $('#sg_parallelWorldCustomStream').is(':checked');
  s.parallelWorldSystemPrompt = String($('#sg_parallelWorldSystemPrompt').val() || DEFAULT_PARALLEL_WORLD_SYSTEM_PROMPT);
  s.parallelWorldUserTemplate = String($('#sg_parallelWorldUserTemplate').val() || DEFAULT_PARALLEL_WORLD_USER_TEMPLATE);
  s.parallelWorldClock = String($('#sg_parallelWorldClock').val() || '').trim();
  s.parallelWorldReadFloors = clampInt($('#sg_parallelWorldReadFloors').val(), 1, 50, s.parallelWorldReadFloors || 5);
}

function openModal() {
  ensureModal();
  pullSettingsToUi();
  updateWorldbookInfoLabel();
  updateSummaryManualRangeHint(true);
  // 打开面板时尝试刷新一次蓝灯索引（不阻�?UI�?
  ensureBlueIndexLive(false).catch(() => void 0);
  ensureStructuredWorldbookLive(false).catch(() => void 0);
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
        <div class="sg-min-title">剧情指导 StoryGuide <span class="sg-sub">v${SG_VERSION}</span></div>
        <button class="menu_button sg-btn" id="sg_open_from_settings">打开面板</button>
      </div>
      <div class="sg-min-hint">支持自定义输出模块（JSON），并且自动追加框会缓存+监听重渲染，尽量不被变量更新覆盖�?/div>
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

    // 预热蓝灯索引（实时读取模式下），尽量避免第一次发送消息时还没索引
    ensureBlueIndexLive(true).catch(() => void 0);

    eventSource.on(event_types.CHAT_CHANGED, async () => {
      inlineCache.clear();
      scheduleReapplyAll('chat_changed');
      ensureChatActionButtons();
      ensureBlueIndexLive(true).catch(() => void 0);

      // 切换聊天时，初始化结构化条目进度，避免自动触发已有历史的总结
      try {
        const s = ensureSettings();
        if (s.structuredEntriesEnabled) {
          const ctxNow = SillyTavern.getContext();
          const chatNow = Array.isArray(ctxNow.chat) ? ctxNow.chat : [];
          const mode = String(s.structuredEntriesCountMode || s.summaryCountMode || 'assistant');
          const floorNow = computeFloorCount(chatNow, mode, true, true);
          const meta = getSummaryMeta();
          // 如果 lastStructuredFloor �?0 且已有聊天历史，初始化为当前楼层
          if (floorNow > 0 && !meta.lastStructuredFloor) {
            meta.lastStructuredFloor = floorNow;
            meta.lastStructuredChatLen = chatNow.length;
            await setSummaryMeta(meta);
            console.log('[StoryGuide] Initialized lastStructuredFloor to', floorNow, 'for existing chat');
          }
        }
      } catch (e) {
        console.warn('[StoryGuide] Failed to init structured progress on chat change:', e);
      }

      if (document.getElementById('sg_modal_backdrop') && $('#sg_modal_backdrop').is(':visible')) {
        pullSettingsToUi();
        setStatus('已切换聊天：已同步本聊天字段', 'ok');
      }
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
      // 禁止自动生成：不在收到消息时自动分析/追加
      scheduleReapplyAll('msg_received');
      // 回复生成结束后再触发总结/结构�?
      schedulePostGenerationAuto('msg_received');
      // 平行世界自动推演
      maybeAutoRunParallelWorld().catch(e => console.warn('[StoryGuide] 平行世界自动推演异常:', e));
    });

    eventSource.on(event_types.MESSAGE_SENT, () => {
      // 禁止自动生成：不在发送消息时自动刷新面板
      // ROLL 判定（尽量在生成前完成）
      maybeInjectRollResult('msg_sent').catch(() => void 0);
      // 蓝灯索引 �?绿灯触发（尽量在生成前完成）
      maybeInjectWorldInfoTriggers('msg_sent').catch(() => void 0);
      // 记录生成活动，最终在回复完成后触�?
      schedulePostGenerationAuto('msg_sent');
    });

    eventSource.on(event_types.MESSAGE_DELETED, async (data) => {
      await handleAutoRollbackOnDeletion(data);
    });
  });
}

// -------------------- 悬浮按钮和面�?--------------------

let floatingPanelVisible = false;
let lastFloatingContent = null;
let sgFloatingResizeGuardBound = false;
let sgFloatingToggleLock = 0;

const SG_FLOATING_BTN_POS_KEY = 'storyguide_floating_btn_pos_v1';
let sgBtnPos = null;

function loadBtnPos() {
  try {
    const raw = localStorage.getItem(SG_FLOATING_BTN_POS_KEY);
    if (raw) sgBtnPos = JSON.parse(raw);
  } catch { }
}

function saveBtnPos(left, top) {
  try {
    sgBtnPos = { left, top };
    localStorage.setItem(SG_FLOATING_BTN_POS_KEY, JSON.stringify(sgBtnPos));
  } catch { }
}

// Sync CSS viewport units for mobile browsers with dynamic bars.
function updateSgVh() {
  const root = document.documentElement;
  if (!root) return;
  const h = window.visualViewport?.height || window.innerHeight || 0;
  if (!h) return;
  root.style.setProperty('--sg-vh', `${h * 0.01}px`);
}

updateSgVh();
window.addEventListener('resize', updateSgVh);
window.addEventListener('orientationchange', updateSgVh);
window.visualViewport?.addEventListener('resize', updateSgVh);

// 检测移动端/平板竖屏模式（禁用自定义定位，使�?CSS 底部弹出样式�?
// 匹配 CSS 媒体查询: (max-width: 768px), (max-aspect-ratio: 1/1)
function isMobilePortrait() {
  if (window.matchMedia) {
    return window.matchMedia('(max-width: 768px), (max-aspect-ratio: 1/1)').matches;
  }
  return window.innerWidth <= 768 || (window.innerHeight >= window.innerWidth);
}

function createFloatingButton() {
  if (document.getElementById('sg_floating_btn')) return;

  const btn = document.createElement('div');
  btn.id = 'sg_floating_btn';
  btn.className = 'sg-floating-btn';
  btn.innerHTML = '📘';
  btn.title = '剧情指导';
  // Allow dragging but also clicking. We need to distinguish click from drag.
  btn.style.touchAction = 'none';

  document.body.appendChild(btn);

  // Restore position
  loadBtnPos();
  if (sgBtnPos) {
    const w = 50; // approx width
    const h = 50;
    const clamped = clampToViewport(sgBtnPos.left, sgBtnPos.top, w, h);
    btn.style.left = `${Math.round(clamped.left)}px`;
    btn.style.top = `${Math.round(clamped.top)}px`;
    btn.style.bottom = 'auto';
    btn.style.right = 'auto';
  } else {
    // Default safe position for mobile/desktop if never moved
    // Use top positioning to avoid bottom bar interference on mobile/desktop
    // Mobile browsers often have dynamic bottom bars, so "bottom" is risky.
    btn.style.top = '150px';
    btn.style.right = '16px';
    btn.style.bottom = 'auto'; // override CSS
    btn.style.left = 'auto';
  }

  // --- Unified Interaction Logic ---
  const isMobile = window.innerWidth < 1200;

  // Variables or drag
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let moved = false;
  let longPressTimer = null; // Legacy

  // Mobile: Simple Click Mode
  if (isMobile) {
    btn.style.cursor = 'pointer';
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFloatingPanel();
    };
    return; // SKIP desktop logic
  }
  // Desktop logic continues below...

  const onDown = (ev) => {
    dragging = true;
    moved = false;
    startX = ev.clientX;
    startY = ev.clientY;

    const rect = btn.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    btn.style.transition = 'none';
    btn.setPointerCapture(ev.pointerId);

    // If needed: Visual feedback for press
  };

  const onMove = (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    if (!moved && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      moved = true;
      btn.style.bottom = 'auto';
      btn.style.right = 'auto';
    }

    if (moved) {
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;

      const w = btn.offsetWidth;
      const h = btn.offsetHeight;
      const clamped = clampToViewport(newLeft, newTop, w, h);

      btn.style.left = `${Math.round(clamped.left)}px`;
      btn.style.top = `${Math.round(clamped.top)}px`;
    }
  };

  const onUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    btn.releasePointerCapture(ev.pointerId);
    btn.style.transition = '';

    if (moved) {
      const left = parseInt(btn.style.left || '0', 10);
      const top = parseInt(btn.style.top || '0', 10);
      saveBtnPos(left, top);
    }
  };

  btn.addEventListener('pointerdown', onDown);
  btn.addEventListener('pointermove', onMove);
  btn.addEventListener('pointerup', onUp);
  btn.addEventListener('pointercancel', onUp);

  // Robust click handler
  btn.addEventListener('click', (e) => {
    // If we just dragged, 'moved' might still be true
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    toggleFloatingPanel();
  });
}

function createFloatingPanel() {
  if (document.getElementById('sg_floating_panel')) return;

  const panel = document.createElement('div');
  panel.id = 'sg_floating_panel';
  panel.className = 'sg-floating-panel';
  panel.innerHTML = `
    <div class="sg-floating-header" style="cursor: move; touch-action: none;">
      <span class="sg-floating-title">📘 剧情指导</span>
        <div class="sg-floating-actions">
          <button class="sg-floating-action-btn" id="sg_floating_show_report" title="查看分析">📖</button>
          <button class="sg-floating-action-btn" id="sg_floating_show_map" title="查看地图">🗺�?/button>
          <button class="sg-floating-action-btn" id="sg_floating_show_image" title="图像生成">🖼�?/button>
          <button class="sg-floating-action-btn" id="sg_floating_show_sex" title="性爱指导">❤️</button>
          <button class="sg-floating-action-btn" id="sg_floating_structured" title="手动结构化条目总结">🧩</button>
          <button class="sg-floating-action-btn" id="sg_floating_roll_logs" title="ROLL日志">🎲</button>
          <button class="sg-floating-action-btn" id="sg_floating_settings" title="打开设置">⚙️</button>
          <button class="sg-floating-action-btn" id="sg_floating_close" title="关闭">�?/button>
        </div>
    </div>
    <div class="sg-floating-body" id="sg_floating_body">
      <div style="padding:20px; text-align:center; color:#aaa;">
        点击 <button class="sg-inner-refresh-btn" style="background:none; border:none; cursor:pointer; font-size:1.2em;">🔄</button> 生成
      </div>
    </div>

  `;

  document.body.appendChild(panel);

  // Restore position (Only on Desktop/Large screens, NOT in mobile portrait)
  // On mobile portrait, we rely on CSS defaults (bottom sheet style) to ensure visibility
  if (!isMobilePortrait() && window.innerWidth >= 1200) {
    loadFloatingPanelPos();
    if (sgFloatingPinnedPos) {
      const w = panel.offsetWidth || 300;
      const h = panel.offsetHeight || 400;
      // Use saved position but ensure it is on screen
      const clamped = clampToViewport(sgFloatingPinnedPos.left, sgFloatingPinnedPos.top, w, h);
      panel.style.left = `${Math.round(clamped.left)}px`;
      panel.style.top = `${Math.round(clamped.top)}px`;
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
    }
  }

  // 事件绑定
  $('#sg_floating_close').on('click', () => {
    hideFloatingPanel();
  });

  $('#sg_floating_show_report').on('click', () => {
    showFloatingReport();
  });

  $('#sg_floating_show_map').on('click', () => {
    showFloatingMap();
  });

  $('#sg_floating_show_image').on('click', () => {
    showFloatingImageGen();
  });

  $('#sg_floating_show_sex').on('click', () => {
    showFloatingSexGuide();
  });

  $('#sg_floating_structured').on('click', async () => {
    const s = ensureSettings();
    if (!s.structuredEntriesEnabled) {
      setStatus('结构化条目未启用', 'warn');
      showToast('结构化条目未启用', { kind: 'warn', spinner: false, sticky: false, duration: 2000 });
      return;
    }
    if (!s.summaryToWorldInfo && !s.summaryToBlueWorldInfo) {
      setStatus('未启用写入世界书', 'warn');
      showToast('请先启用“写入世界书”（绿灯或蓝灯）', { kind: 'warn', spinner: false, sticky: false, duration: 2200 });
      return;
    }
    const $btn = $('#sg_floating_structured');
    $btn.prop('disabled', true);
    try {
      await runStructuredEntries({ reason: 'manual' });
    } finally {
      $btn.prop('disabled', false);
    }
  });


  // Delegate inner refresh click
  $(document).on('click', '.sg-inner-refresh-btn', async (e) => {
    // Only handle if inside our panel
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    await refreshFloatingPanelContent();
  });

  $(document).on('click', '.sg-inner-structured-btn', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    const s = ensureSettings();
    if (!s.structuredEntriesEnabled) {
      setStatus('结构化条目未启用', 'warn');
      showToast('结构化条目未启用', { kind: 'warn', spinner: false, sticky: false, duration: 2000 });
      return;
    }
    if (!s.summaryToWorldInfo && !s.summaryToBlueWorldInfo) {
      setStatus('未启用写入世界书', 'warn');
      showToast('请先启用“写入世界书”（绿灯或蓝灯）', { kind: 'warn', spinner: false, sticky: false, duration: 2200 });
      return;
    }
    const $btn = $(e.currentTarget);
    $btn.prop('disabled', true);
    try {
      await runStructuredEntries({ reason: 'manual' });
    } finally {
      $btn.prop('disabled', false);
    }
  });

  $(document).on('click', '.sg-inner-map-reset-btn', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    try {
      await setMapData(getDefaultMapData());
      showFloatingMap();
    } catch (err) {
      console.warn('[StoryGuide] map reset failed:', err);
    }
  });

  $(document).on('click', '.sg-inner-map-toggle-btn', (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    const s = ensureSettings();
    s.mapAutoUpdate = !isMapAutoUpdateEnabled(s);
    saveSettings();
    showFloatingMap();
  });

  $(document).on('click', '#sg_imagegen_generate', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    if (imageGenBatchBusy) return;
    await generateImageFromBatch();
  });

  $(document).on('click', '#sg_imagegen_generate_all', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    if (imageGenBatchBusy) return;
    await generateAllImagesFromBatch();
  });


  $(document).on('click', '#sg_imagegen_build_batch', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    if (imageGenBatchBusy) return;
    imageGenBatchBusy = true;
    imageGenBatchStatus = '正在生成提示词�?;
    renderImageGenBatchPreview();
    try {
      imageGenBatchPrompts = await generateImagePromptBatch();
      imageGenBatchIndex = 0;
      imageGenPreviewIndex = 0;
      imageGenBatchStatus = '提示词已生成';
    } catch (err) {
      imageGenBatchStatus = `生成失败�?{err?.message || err}`;
    } finally {
      imageGenBatchBusy = false;
      renderImageGenBatchPreview();
    }
  });

  // Floating sex guide actions
  $(document).on('click', '#sg_floating_sex_generate', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    let need = String($('#sg_floating_sex_need').val() || '').trim();
    const bdsmMode = String($('#sg_floating_sex_bdsm_mode').val() || 'default');
    const poseMode = String($('#sg_floating_sex_pose_mode').val() || 'default');
    const ejaculateMode = String($('#sg_floating_sex_ejaculate').val() || 'default');
    const outfitMode = String($('#sg_floating_sex_outfit_random').val() || 'default');
    let bdsmCustom = '';
    let poseCustom = '';
    let outfitCustom = '';
    if (bdsmMode === 'custom') bdsmCustom = String(prompt('BDSM (        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u81ea        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b9a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e49):') || '').trim();
    if (poseMode === 'custom') poseCustom = String(prompt('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f53        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f4d (        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u81ea        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b9a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e49):') || '').trim();
    if (outfitMode === 'custom') outfitCustom = String(prompt('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u670d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u88c5 (        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u81ea        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b9a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e49):') || '').trim();
    const extras = [];
    if (bdsmMode === 'none') extras.push('BDSM:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e0d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f7f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7528');
    if (bdsmMode === 'random') extras.push('BDSM:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a');
    if (bdsmMode === 'custom' && bdsmCustom) extras.push(`BDSM: ${bdsmCustom}`);
    if (poseMode === 'random') extras.push('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f53        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f4d:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a');
    if (poseMode === 'custom' && poseCustom) extras.push(`        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f53        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f4d: ${poseCustom}`);
    if (ejaculateMode === 'yes') extras.push('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5c04        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7cbe:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u662f');
    if (ejaculateMode === 'no') extras.push('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5c04        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7cbe:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5426');
    if (ejaculateMode === 'random') extras.push('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5c04        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7cbe:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a');
    if (outfitMode === 'yes') extras.push('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u670d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u88c5:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u662f');
    if (outfitMode === 'no') extras.push('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u670d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u88c5:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5426');
    if (outfitMode === 'random') extras.push('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u670d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u88c5:         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a');
    if (outfitMode === 'custom' && outfitCustom) extras.push(`        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u670d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u88c5: ${outfitCustom}`);
    if (extras.length) {
      const extraText = extras.join('; ');
      need = need ? `${need}
${extraText}` : extraText;
    }
    $('#sg_floating_sex_generate').prop('disabled', true);
    $('#sg_floating_sex_status').text('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6b63        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5728        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u751f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6210...');
    try {
      await runSexGuide({ userNeedOverride: need });
      $('#sg_floating_sex_output').val(lastSexGuideText || '');
      $('#sg_floating_sex_send').prop('disabled', !lastSexGuideText);
      $('#sg_floating_sex_status').text('        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u751f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6210        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b8c        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6210');
    } catch (err) {
      $('#sg_floating_sex_status').text(`        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u751f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6210        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5931        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8d25: ${err?.message ?? err}`);
    } finally {
      $('#sg_floating_sex_generate').prop('disabled', false);
    }
  });

  $(document).on('click', '#sg_floating_sex_send', (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    const text = String($('#sg_floating_sex_output').val() || '').trim();
    if (!text) {
      $('#sg_floating_sex_status').text('暂无可发送内�?);
      return;
    }
    const ok = injectToUserInput(text);
    $('#sg_floating_sex_status').text(ok ? '已填入输入框（未发送）' : '未找到聊天输入框');
  });

  $(document).on('click', '#sg_imagegen_clear', (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    clearImageGenBatch();
  });

  $(document).on('click', '#sg_imagegen_prev', (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    if (!imageGenBatchPrompts.length) return;
    imageGenPreviewIndex = (imageGenPreviewIndex - 1 + imageGenBatchPrompts.length) % imageGenBatchPrompts.length;
    renderImageGenBatchPreview();
  });

  $(document).on('click', '#sg_imagegen_next', (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    if (!imageGenBatchPrompts.length) return;
    imageGenPreviewIndex = (imageGenPreviewIndex + 1) % imageGenBatchPrompts.length;
    renderImageGenBatchPreview();
  });


  $('#sg_floating_roll_logs').on('click', () => {
    showFloatingRollLogs();
  });

  $('#sg_floating_settings').on('click', () => {
    openModal();
    hideFloatingPanel();
  });

  // Image regen click (floating panel)
  $(document).on('click', '#sg_imagegen_regen', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    if (imageGenBatchBusy) return;
    const current = imageGenBatchPrompts[imageGenPreviewIndex];
    if (!current || !current.positive) return;
    try {
      imageGenBatchBusy = true;
      imageGenBatchStatus = `重新生成�?{current.label || '当前'}`;
      renderImageGenBatchPreview();
      const url = await generateImageWithNovelAI(current.positive, current.negative || '');
      imageGenImageUrls[imageGenPreviewIndex] = url;
      imageGenBatchStatus = `已重新生成：${current.label || '当前'}`;
    } catch (err) {
      imageGenBatchStatus = `重生成失败：${err?.message || err}`;
    } finally {
      imageGenBatchBusy = false;
      renderImageGenBatchPreview();
    }
  });

  $(document).on('click', '#sg_imagegen_copy_payload', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    if (!lastNovelaiPayload) {
      imageGenBatchStatus = '暂无可复制的请求参数';
      renderImageGenBatchPreview();
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastNovelaiPayload, null, 2));
      imageGenBatchStatus = '已复制请求参�?;
    } catch (err) {
      imageGenBatchStatus = `复制失败�?{err?.message || err}`;
    }
    renderImageGenBatchPreview();
  });

  $(document).on('click', '#sg_imagegen_toggle_preview', (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    imageGenPreviewExpanded = !imageGenPreviewExpanded;
    renderImageGenBatchPreview();
  });

  $(document).on('click', '#sg_imagegen_download', async (e) => {
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    const url = imageGenImageUrls[imageGenPreviewIndex];
    if (!url) {
      imageGenBatchStatus = '暂无可下载图�?;
      renderImageGenBatchPreview();
      return;
    }
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const filename = `storyguide-image-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      imageGenBatchStatus = '图像已下�?;
    } catch (err) {
      imageGenBatchStatus = `下载失败�?{err?.message || err}`;
    }
    renderImageGenBatchPreview();
  });


  // Drag logic
  const header = panel.querySelector('.sg-floating-header');
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let moved = false;

  const onDown = (ev) => {
    if (ev.target.closest('button')) return; // ignore buttons
    if (isMobilePortrait()) return; // 移动端竖屏禁用拖拽，使用 CSS 底部弹出

    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;

    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    moved = false;

    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    panel.style.transition = 'none'; // disable transition during drag

    header.setPointerCapture(ev.pointerId);
  };

  const onMove = (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    if (!moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) moved = true;

    const newLeft = startLeft + dx;
    const newTop = startTop + dy;

    // Constrain to viewport
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const clamped = clampToViewport(newLeft, newTop, w, h);

    panel.style.left = `${Math.round(clamped.left)}px`;
    panel.style.top = `${Math.round(clamped.top)}px`;
  };

  const onUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    header.releasePointerCapture(ev.pointerId);
    panel.style.transition = ''; // restore transition

    if (moved) {
      const left = parseInt(panel.style.left || '0', 10);
      const top = parseInt(panel.style.top || '0', 10);
      saveFloatingPanelPos(left, top);
    }
  };

  header.addEventListener('pointerdown', onDown);
  header.addEventListener('pointermove', onMove);
  header.addEventListener('pointerup', onUp);
  header.addEventListener('pointercancel', onUp);

  // Double click to reset
  header.addEventListener('dblclick', (ev) => {
    if (ev.target.closest('button')) return; // ignore buttons
    clearFloatingPanelPos();
    panel.style.left = '';
    panel.style.top = '';
    panel.style.bottom = ''; // restore CSS default
    panel.style.right = '';  // restore CSS default
  });
}

function toggleFloatingPanel() {
  const now = Date.now();
  if (now - sgFloatingToggleLock < 280) return;
  sgFloatingToggleLock = now;
  if (floatingPanelVisible) {
    hideFloatingPanel();
  } else {
    showFloatingPanel();
  }
}


function shouldGuardFloatingPanelViewport() {
  // When the viewport is very small (mobile / narrow desktop window),
  // the panel may be pushed off-screen by fixed bottom offsets.
  return window.innerWidth < 560 || window.innerHeight < 520;
}

function ensureFloatingPanelInViewport(panel) {
  try {
    if (!panel || !panel.getBoundingClientRect) return;

    // 移动端竖屏使�?CSS 底部弹出，不需�?JS 定位
    if (isMobilePortrait()) return;

    // Remove viewport size guard to ensure panel is always kept reachable
    // if (!shouldGuardFloatingPanelViewport()) return;

    // �?clampToViewport 保持一致的边界逻辑（允�?50% 越界�?
    const minVisibleRatio = 0.5;
    const minVisiblePx = 40;

    const rect = panel.getBoundingClientRect();
    const w = rect.width || panel.offsetWidth || 300;
    const h = rect.height || panel.offsetHeight || 400;

    const minVisibleW = Math.max(minVisiblePx, w * minVisibleRatio);
    const minVisibleH = Math.max(minVisiblePx, h * minVisibleRatio);

    // Ensure the panel itself never exceeds viewport bounds for max size
    panel.style.maxWidth = `calc(100vw - ${minVisiblePx}px)`;
    panel.style.maxHeight = `calc(100dvh - ${minVisiblePx}px)`;

    // Clamp current on-screen position into viewport.
    const clamped = clampToViewport(rect.left, rect.top, w, h);

    // 检查是否需要调整位置（使用放宽的边界逻辑�?
    // 如果可见部分少于 minVisible，则需要调�?
    const visibleLeft = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(0, rect.left));
    const visibleTop = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(0, rect.top));

    if (visibleLeft < minVisibleW || visibleTop < minVisibleH || rect.top < 0) {
      panel.style.left = `${Math.round(clamped.left)}px`;
      panel.style.top = `${Math.round(clamped.top)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }
  } catch { /* ignore */ }
}

function bindFloatingPanelResizeGuard() {
  if (sgFloatingResizeGuardBound) return;
  sgFloatingResizeGuardBound = true;

  window.addEventListener('resize', () => {
    if (!floatingPanelVisible) return;
    const panel = document.getElementById('sg_floating_panel');
    if (!panel) return;
    requestAnimationFrame(() => {
      updateFloatingPanelLayoutForViewport(panel);
      ensureFloatingPanelInViewport(panel);
    });
  });
}

function applyMobileFloatingPanelStyles(panel) {
  if (!panel) return;
  panel.dataset.sgMobileSheet = '1';
  panel.style.position = 'fixed';
  panel.style.top = '0';
  panel.style.bottom = '0';
  panel.style.left = '0';
  panel.style.right = '0';
  panel.style.width = '100%';
  panel.style.maxWidth = '100%';
  panel.style.height = 'calc(var(--sg-vh, 1vh) * 100)';
  panel.style.maxHeight = 'calc(var(--sg-vh, 1vh) * 100)';
  panel.style.borderRadius = '0';
  panel.style.resize = 'none';
  panel.style.transform = 'none';
  panel.style.transition = 'none';
  panel.style.opacity = '1';
  panel.style.visibility = 'visible';
  panel.style.display = 'flex';
}

function clearMobileFloatingPanelStyles(panel) {
  if (!panel || panel.dataset.sgMobileSheet !== '1') return;
  panel.style.position = '';
  panel.style.top = '';
  panel.style.bottom = '';
  panel.style.left = '';
  panel.style.right = '';
  panel.style.width = '';
  panel.style.maxWidth = '';
  panel.style.height = '';
  panel.style.maxHeight = '';
  panel.style.borderRadius = '';
  panel.style.resize = '';
  panel.style.transform = '';
  panel.style.transition = '';
  panel.style.opacity = '';
  panel.style.visibility = '';
  panel.style.display = '';
  delete panel.dataset.sgMobileSheet;
}

function updateFloatingPanelLayoutForViewport(panel) {
  if (isMobilePortrait()) {
    applyMobileFloatingPanelStyles(panel);
  } else {
    clearMobileFloatingPanelStyles(panel);
  }
}

function showFloatingPanel() {
  createFloatingPanel();
  const panel = document.getElementById('sg_floating_panel');
  if (panel) {
    // 移动�?平板：强制使用底部弹出样�?
    if (isMobilePortrait()) {
      applyMobileFloatingPanelStyles(panel);
    } else if (window.innerWidth < 1200) {
      clearMobileFloatingPanelStyles(panel);
      // 桌面端小窗口：清除可能的内联样式，使�?CSS
      panel.style.left = '';
      panel.style.top = '';
      panel.style.bottom = '';
      panel.style.right = '';
      panel.style.transform = '';
      panel.style.maxWidth = '';
      panel.style.maxHeight = '';
      panel.style.display = 'flex';
      panel.style.height = '';
      panel.style.opacity = '';
      panel.style.visibility = '';
      panel.style.transition = '';
      panel.style.borderRadius = '';
    } else {
      clearMobileFloatingPanelStyles(panel);
      panel.style.display = 'flex';
    }


    panel.classList.add('visible');
    floatingPanelVisible = true;
    // 如果有缓存内容则显示
    if (lastFloatingContent) {
      updateFloatingPanelBody(lastFloatingContent);
    }

    // 非移动端才运行视口检�?
    if (!isMobilePortrait()) {
      bindFloatingPanelResizeGuard();
      requestAnimationFrame(() => ensureFloatingPanelInViewport(panel));
    }
  }
}

function hideFloatingPanel() {
  const panel = document.getElementById('sg_floating_panel');
  if (panel) {
    panel.classList.remove('visible');
    floatingPanelVisible = false;
    // 始终清除内联 display 样式以确保面板隐�?
    panel.style.display = 'none';
  }
}

async function refreshFloatingPanelContent() {
  const $body = $('#sg_floating_body');
  if (!$body.length) return;

  $body.html('<div class="sg-floating-loading">正在分析剧情...</div>');

  try {
    const s = ensureSettings();
    const { snapshotText } = buildSnapshot();
    const modules = getModules('panel');

    if (!modules.length) {
      $body.html('<div class="sg-floating-loading">没有配置模块</div>');
      return;
    }

    const schema = buildSchemaFromModules(modules);
    const messages = buildPromptMessages(snapshotText, s.spoilerLevel, modules, 'panel');

    let jsonText = '';
    if (s.provider === 'custom') {
      jsonText = await callViaCustom(s.customEndpoint, s.customApiKey, s.customModel, messages, s.temperature, s.customMaxTokens, s.customTopP, s.customStream);
    } else {
      jsonText = await callViaSillyTavern(messages, schema, s.temperature);
      if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
    }

    const parsed = safeJsonParse(jsonText);
    if (!parsed) {
      $body.html('<div class="sg-floating-loading">解析失败</div>');
      return;
    }

    // 合并静态模�?
    const mergedParsed = mergeStaticModulesIntoResult(parsed, modules);
    updateStaticModulesCache(mergedParsed, modules).catch(() => void 0);

    // 渲染内容
    // Filter out quick_actions from main Markdown body to avoid duplication
    const bodyModules = modules.filter(m => m.key !== 'quick_actions');
    const md = renderReportMarkdownFromModules(mergedParsed, bodyModules);
    const html = renderMarkdownToHtml(md);

    await updateMapFromSnapshot(snapshotText);

    // 添加快捷选项
    const quickActions = Array.isArray(mergedParsed.quick_actions) ? mergedParsed.quick_actions : [];
    const optionsHtml = renderDynamicQuickActionsHtml(quickActions, 'panel');

    const refreshBtnHtml = `
      <div style="padding:2px 8px; border-bottom:1px solid rgba(128,128,128,0.2); margin-bottom:4px; text-align:right; display:flex; gap:6px; justify-content:flex-end;">
        <button class="sg-inner-refresh-btn" title="重新生成分析" style="background:none; border:none; cursor:pointer; font-size:1.1em; opacity:0.8;">🔄</button>
      </div>
    `;

    const fullHtml = refreshBtnHtml + html + optionsHtml;
    lastFloatingContent = fullHtml;
    updateFloatingPanelBody(fullHtml);

  } catch (e) {
    console.warn('[StoryGuide] floating panel refresh failed:', e);
    $body.html(`<div class="sg-floating-loading">分析失败: ${e?.message ?? e}</div>`);
  }
}

function updateFloatingPanelBody(html) {
  const $body = $('#sg_floating_body');
  if ($body.length) {
    $body.html(html);
  }
}

function showFloatingImageGen() {
  const $body = $('#sg_floating_body');
  if (!$body.length) return;
  const s = ensureSettings();
  if (!s.imageGenEnabled) {
    $body.html('<div class="sg-floating-loading">图像生成功能未启�?/div>');
    return;
  }

  const header = `
    <div class="sg-floating-row">
      <div class="sg-floating-title-sm">图像生成</div>
      <div class="sg-floating-actions-mini">
        <button class="sg-floating-mini-btn" id="sg_imagegen_build_batch">生成12组提示词</button>

        <button class="sg-floating-mini-btn" id="sg_imagegen_generate">生成当前�?/button>
        <button class="sg-floating-mini-btn" id="sg_imagegen_generate_all">生成全部</button>

      </div>
    </div>
  `;

  $body.html(`${header}<div id="sg_imagegen_batch" class="sg-floating-section"></div>`);
  renderImageGenBatchPreview();
}

function showFloatingRollLogs() {

  const $body = $('#sg_floating_body');
  if (!$body.length) return;

  const meta = getSummaryMeta();
  const logs = Array.isArray(meta?.rollLogs) ? meta.rollLogs : [];

  if (!logs.length) {
    $body.html('<div class="sg-floating-loading">暂无 ROLL 日志</div>');
    return;
  }

  const html = logs.slice(0, 50).map((l) => {
    const ts = l?.ts ? new Date(l.ts).toLocaleString() : '';
    const action = String(l?.action || '').trim();
    const outcome = String(l?.outcomeTier || '').trim()
      || (l?.success == null ? 'N/A' : (l.success ? '成功' : '失败'));
    const finalVal = Number.isFinite(Number(l?.final)) ? Number(l.final).toFixed(2) : '';
    let summary = '';
    if (l?.summary && typeof l.summary === 'object') {
      const pick = l.summary.summary ?? l.summary.text ?? l.summary.message;
      summary = String(pick || '').trim();
      if (!summary) {
        try { summary = JSON.stringify(l.summary); } catch { summary = String(l.summary); }
      }
    } else {
      summary = String(l?.summary || '').trim();
    }
    const userShort = String(l?.userText || '').trim().slice(0, 160);

    const detailsLines = [];
    if (userShort) detailsLines.push(`<div><b>用户输入</b>�?{escapeHtml(userShort)}</div>`);
    if (summary) detailsLines.push(`<div><b>摘要</b>�?{escapeHtml(summary)}</div>`);
    return `
      <details style="margin-bottom:4px; padding:4px; border-bottom:1px solid rgba(128,128,128,0.3);">
        <summary style="font-size:0.9em; cursor:pointer; outline:none;">${escapeHtml(`${ts}�?{action || 'ROLL'}�?{outcome}${finalVal ? `｜最�?${finalVal}` : ''}`)}</summary>
        <div class="sg-log-body" style="padding-left:1em; opacity:0.9; font-size:0.85em; margin-top:4px;">${detailsLines.join('')}</div>
      </details>
    `;
  }).join('');

  $body.html(`<div style="padding:10px; overflow-y:auto; max-height:100%; box-sizing:border-box;">${html}</div>`);
}

function showFloatingMap() {
  const $body = $('#sg_floating_body');
  if (!$body.length) return;
  const s = ensureSettings();
  if (!s.mapEnabled) {
    $body.html('<div class="sg-floating-loading">地图功能未启�?/div>');
    return;
  }
  const mapData = getMapData();
  const html = renderGridMap(mapData);
  const autoLabel = isMapAutoUpdateEnabled(s) ? '自动更新：开' : '自动更新：关';
  const tools = `
      <div style="padding:2px 8px; border-bottom:1px solid rgba(128,128,128,0.2); margin-bottom:4px; text-align:right;">
        <button class="sg-inner-map-toggle-btn" title="切换自动更新" style="background:none; border:none; cursor:pointer; font-size:0.95em; opacity:0.85; margin-right:6px;">${autoLabel}</button>
        <button class="sg-inner-map-reset-btn" title="重置地图" style="background:none; border:none; cursor:pointer; font-size:1.1em; opacity:0.8;">🗑</button>
      </div>
    `;
  $body.html(`${tools}<div style="padding:10px; overflow:auto; max-height:100%; box-sizing:border-box;">${html}</div>`);
}

function showFloatingReport() {
  const $body = $('#sg_floating_body');
  if (!$body.length) return;

  // Use last cached content if available, otherwise show empty state
  if (lastFloatingContent) {
    updateFloatingPanelBody(lastFloatingContent);
  } else {
    $body.html(`
      <div style="padding:20px; text-align:center; color:#aaa;">
        点击 <button class="sg-inner-refresh-btn" style="background:none; border:none; cursor:pointer; font-size:1.2em;">🔄</button> 生成
      </div>
    `);
  }
}

function showFloatingSexGuide() {
  const $body = $('#sg_floating_body');
  if (!$body.length) return;
  const s = ensureSettings();
  if (!s.sexGuideEnabled) {
    $body.html('<div class="sg-floating-loading">性爱指导未启�?/div>');
    return;
  }

  const html = `
    <div style="padding:10px; overflow:auto; max-height:100%; box-sizing:border-box;">
      <div style="font-weight:700; margin-bottom:8px;">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6027        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7231        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6307        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5bfc</div>
      <div class="sg-field" style="margin-top:6px;">
        <label>        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7528        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6237        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9700        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6c42</label>
        <textarea id="sg_floating_sex_need" rows="3" placeholder="        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f8b        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5982        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;uff1a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u66f4        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6e29        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u67d4 /         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u66f4        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e3b        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u52a8 /         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u66f4        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6162        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8282        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u594f /         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5f3a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8c03        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6c9f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u901a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e0e        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b89        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5168"></textarea>
      </div>
      <div class="sg-row sg-inline" style="margin-top:6px; gap:8px; flex-wrap:wrap;">
        <label style="margin-right:4px;">BDSM</label>
        <select id="sg_floating_sex_bdsm_mode" style="min-width:90px;">
          <option value="default">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9ed8        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8ba4</option>
          <option value="none">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e0d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f7f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7528</option>
          <option value="random">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a</option>
          <option value="custom">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u81ea        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b9a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e49</option>
        </select>
        <label style="margin-right:4px;">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f53        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4f4d</label>
        <select id="sg_floating_sex_pose_mode" style="min-width:90px;">
          <option value="default">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9ed8        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8ba4</option>
          <option value="random">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a</option>
          <option value="custom">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u81ea        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b9a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e49</option>
        </select>
        <label style="margin-right:4px;">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5c04        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u7cbe</label>
        <select id="sg_floating_sex_ejaculate" style="min-width:80px;">
          <option value="default">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9ed8        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8ba4</option>
          <option value="yes">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u662f</option>
          <option value="no">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5426</option>
          <option value="random">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a</option>
        </select>
        <label style="margin-right:4px;">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u670d        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u88c5</label>
        <select id="sg_floating_sex_outfit_random" style="min-width:90px;">
          <option value="default">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9ed8        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8ba4</option>
          <option value="yes">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u662f</option>
          <option value="no">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5426</option>
          <option value="random">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u968f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u673a</option>
          <option value="custom">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u81ea        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5b9a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u4e49</option>
        </select>
      </div>
      <div class="sg-actions-row" style="justify-content:flex-end;">
        <button class="menu_button sg-btn" id="sg_floating_sex_generate">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u751f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6210</button>
        <button class="menu_button sg-btn" id="sg_floating_sex_send" ${lastSexGuideText ? '' : 'disabled'}>        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u53d1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9001        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5230        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u804a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5929</button>
      </div>
      <div class="sg-field" style="margin-top:8px;">
        <label>        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u8f93        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u51fa</label>
        <textarea id="sg_floating_sex_output" rows="10" spellcheck="false">${escapeHtml(lastSexGuideText || '')}</textarea>
        <div class="sg-hint" id="sg_floating_sex_status">        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u00b7         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u751f        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u6210        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u540e        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u53ef        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u53d1        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u9001        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5230        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u804a        const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u5929         const stableComment = String(cached?.comment || '').trim() || `${prefix}�?{commentName}${indexSuffix}`;u00b7</div>
      </div>
    </div>
  `
  $body.html(html);
}

// -------------------- init --------------------

// -------------------- fixed input button --------------------
// -------------------- fixed input button --------------------
function injectFixedInputButton() {
  if (document.getElementById('sg_fixed_input_btn')) return;

  const tryInject = () => {
    if (document.getElementById('sg_fixed_input_btn')) return true;

    // 1. Try standard extension/audit buttons container (desktop/standard themes)
    let container = document.getElementById('chat_input_audit_buttons');

    // 2. Try Quick Reply container (often where "Roll" macros live)
    if (!container) container = document.querySelector('.quick-reply-container');

    // 3. Try finding the "Roll" button specifically and use its parent
    if (!container) {
      const buttons = Array.from(document.querySelectorAll('button, .menu_button'));
      const rollBtn = buttons.find(b => b.textContent && (b.textContent.includes('ROLL') || b.textContent.includes('Roll')));
      if (rollBtn) container = rollBtn.parentElement;
    }

    // 4. Fallback: Insert before the input box wrapper
    if (!container) {
      const wrapper = document.getElementById('chat_input_form');
      if (wrapper) container = wrapper;
    }

    if (!container) return false;

    const btn = document.createElement('div');
    btn.id = 'sg_fixed_input_btn';
    btn.className = 'menu_button';
    btn.style.display = 'inline-block';
    btn.style.cursor = 'pointer';
    btn.style.marginRight = '5px';
    btn.style.padding = '5px 10px';
    btn.style.userSelect = 'none';
    btn.innerHTML = '📘 剧情';
    btn.title = '打开剧情指导悬浮�?;
    // Ensure height consistency
    btn.style.height = 'var(--input-height, auto)';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFloatingPanel();
    });

    // Check if we found 'chat_input_form' which is huge, we don't want to just appendChild
    if (container.id === 'chat_input_form') {
      container.insertBefore(btn, container.firstChild);
      return true;
    }

    // For button bars, prepend usually works best for visibility
    if (container.firstChild) {
      container.insertBefore(btn, container.firstChild);
    } else {
      container.appendChild(btn);
    }
    return true;
  };

  // Attempt immediately
  tryInject();

  // Watch for UI changes continuously (ST wipes DOM often)
  // We do NOT disconnect, so if the button is removed, it comes back.
  const observer = new MutationObserver((mutations) => {
    // Check if relevant nodes were added or removed
    let needsCheck = false;
    for (const m of mutations) {
      if (m.type === 'childList') {
        needsCheck = true;
        break;
      }
    }
    if (needsCheck) tryInject();
  });

  // observe body for new nodes
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

function init() {
  ensureSettings();
  bindMapEventPanelHandler();
  setupEventListeners();

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types } = ctx;

  eventSource.on(event_types.APP_READY, () => {
    // 不再在顶栏显示📘按钮（避免占位/重复入口�?
    const oldBtn = document.getElementById('sg_topbar_btn');
    if (oldBtn) oldBtn.remove();

    injectMinimalSettingsPanel();
    ensureChatActionButtons();
    installCardZoomDelegation();
    installQuickOptionsClickHandler();
    createFloatingButton();
    injectFixedInputButton();
    installRollPreSendHook();

    // 浮动面板图像点击放大（使�?document 级别事件委托确保动态元素可响应�?
    $(document).on('click', '#sg_floating_panel .sg-image-zoom, #sg_floating_panel .sg-floating-image', (e) => {
      const $img = $(e.currentTarget);
      const src = String($img.attr('data-full') || $img.attr('src') || '').trim();
      if (!src) return;
      e.preventDefault();
      e.stopPropagation();
      openImagePreviewModal(src, $img.attr('alt') || 'Image preview');
    });
  });

  globalThis.StoryGuide = {
    open: openModal,
    close: closeModal,
    runAnalysis,
    runSexGuide,
    runSummary,
    runInlineAppendForLastMessage,
    reapplyAllInlineBoxes,
    buildSnapshot: () => buildSnapshot(),
    getLastReport: () => lastReport,
    refreshModels,
    _inlineCache: inlineCache,
  };
}

init();

