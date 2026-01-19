'use strict';

/**
 * 鍓ф儏鎸囧 StoryGuide (SillyTavern UI Extension)
 * v0.9.8
 *
 * 鏂板锛氳緭鍑烘ā鍧楄嚜瀹氫箟锛堟洿楂樿嚜鐢卞害锛?
 * - 浣犲彲浠ヨ嚜瀹氫箟鈥滆緭鍑烘ā鍧楀垪琛ㄢ€濅互鍙婃瘡涓ā鍧楄嚜宸辩殑鎻愮ず璇嶏紙prompt锛?
 * - 闈㈡澘鎻愪緵涓€涓€屾ā鍧楅厤缃?JSON)銆嶇紪杈戝尯锛氬彲澧炲垹瀛楁銆佹敼椤哄簭銆佹敼鎻愮ず璇嶃€佹帶鍒舵槸鍚﹀湪闈㈡澘/鑷姩杩藉姞涓睍绀?
 * - 鎻掍欢浼氭牴鎹ā鍧楄嚜鍔ㄧ敓鎴?JSON Schema锛堝姩鎬佸瓧娈碉級骞惰姹傛ā鍨嬫寜璇?Schema 杈撳嚭
 *
 * 鍏煎锛氫粛鐒朵繚鎸?v0.3.x 鐨勨€滅嫭绔婣PI璧板悗绔唬鐞?+ 鎶楀彉閲忔洿鏂拌鐩栵紙鑷姩琛ヨ创锛? 鐐瑰嚮鎶樺彔鈥濊兘鍔?
 *
 * v0.8.2 淇锛氬吋瀹?SlashCommand 杩斿洖 [object Object] 鐨勬儏鍐碉紙鑷姩瑙ｆ瀽 UID / 鏂囨湰杈撳嚭锛?
 * v0.8.3 鏂板锛氭€荤粨鍔熻兘鏀寔鑷畾涔夋彁绀鸿瘝锛坰ystem + user 妯℃澘锛屾敮鎸佸崰浣嶇锛?
 * v0.8.6 淇锛氬啓鍏ヤ笘鐣屼功涓嶅啀渚濊禆 JS 瑙ｆ瀽 UID锛堟敼涓哄湪鍚屼竴娈?STscript 绠＄嚎鍐呯敤 {{pipe}} 浼犻€?UID锛夛紝閬垮厤璇姤鈥滄棤娉曡В鏋?UID鈥濄€?
 * v0.9.0 淇锛氬疄鏃惰鍙栬摑鐏笘鐣屼功鍦ㄩ儴鍒?ST 鐗堟湰杩斿洖鍖呰瀛楁锛堝 data 涓?JSON 瀛楃涓诧級鏃惰В鏋愪负 0 鏉＄殑闂锛涘苟澧炲己璇诲彇绔偣/鏂囦欢鍚嶅吋瀹广€?
 * v0.9.1 鏂板锛氳摑鐏储寮曗啋缁跨伅瑙﹀彂 鐨勨€滅储寮曟棩蹇椻€濓紙鏄剧ず鍛戒腑鏉＄洰鍚嶇О/娉ㄥ叆鍏抽敭璇嶏級锛屼究浜庢帓鏌ヨЕ鍙戞晥鏋溿€?
 * v0.9.2 淇锛氭潯鐩爣棰樺墠缂€锛坈omment锛夌幇鍦ㄥ缁堝姞鍦ㄦ渶鍓嶏紙鍗充娇妯″瀷杈撳嚭浜嗚嚜瀹氫箟 title 涔熶細淇濈暀鍓嶇紑锛夈€?
 * v0.9.4 鏂板锛氭€荤粨鍐欏叆涓栫晫涔︾殑鈥滀富瑕佸叧閿瘝(key)鈥濆彲鍒囨崲涓衡€滅储寮曠紪鍙封€濓紙濡?A-001锛夛紝鍙啓 1 涓Е鍙戣瘝锛岃Е鍙戞洿绮剧‘銆?
 * v0.9.5 鏀硅繘锛氳摑鐏储寮曞尮閰嶄細缁煎悎鈥滄渶杩?N 鏉℃秷鎭鏂?+ 鏈鐢ㄦ埛杈撳叆鈥濓紝鑰屼笉鏄彧鐪嬫渶杩戞鏂囷紙鍙湪闈㈡澘閲屽叧闂?璋冩暣鏉冮噸锛夈€?
 * v0.9.6 鏀硅繘锛氬湪闈㈡澘鏍囬澶勬樉绀虹増鏈彿锛屾柟渚跨‘璁ゆ槸鍚﹀凡姝ｇ‘鏇存柊鍒板寘鍚€滅敤鎴疯緭鍏ユ潈閲嶁€濊缃殑鐗堟湰銆?
 * v0.9.9 鏀硅繘锛氭妸鈥滃墽鎯呮寚瀵?/ 鎬荤粨璁剧疆 / 绱㈠紩璁剧疆鈥濇媶鎴愪笁椤碉紙宸︿晶鍒嗛〉鏍囩锛夛紝鐣岄潰鏇存竻鏅般€?
 * v0.9.8 鏂板锛氭墜鍔ㄩ€夋嫨鎬荤粨妤煎眰鑼冨洿锛堜緥濡?20-40锛夊苟鐐瑰嚮绔嬪嵆鎬荤粨銆?
 * v0.10.0 鏂板锛氭墜鍔ㄦゼ灞傝寖鍥存€荤粨鏀寔鈥滄寜姣?N 灞傛媶鍒嗙敓鎴愬鏉′笘鐣屼功鏉＄洰鈥濓紙渚嬪 1-80 涓?N=40 鈫?2 鏉★級銆?
 */

const SG_VERSION = '0.10.0';

const MODULE_NAME = 'storyguide';

/**
 * 妯″潡閰嶇疆鏍煎紡锛圝SON 鏁扮粍锛夌ず渚嬶細
 * [
 *   {"key":"world_summary","title":"涓栫晫绠€浠?,"type":"text","prompt":"1~3鍙ユ鎷笘鐣屼笌灞€鍔?,"required":true,"panel":true,"inline":true},
 *   {"key":"key_plot_points","title":"閲嶈鍓ф儏鐐?,"type":"list","prompt":"3~8鏉″叧閿墽鎯呯偣锛堢煭鍙ワ級","maxItems":8,"required":true,"panel":true,"inline":false}
 * ]
 *
 * 瀛楁璇存槑锛?
 * - key: JSON 杈撳嚭瀛楁鍚嶏紙鍞竴锛?
 * - title: 娓叉煋鍒版姤鍛婄殑鏍囬
 * - type: "text" 鎴?"list"锛坙ist = string[]锛?
 * - prompt: 璇ユā鍧楃殑鐢熸垚鎻愮ず璇嶏紙浼氬啓杩?Output Fields锛?
 * - required: 鏄惁寮哄埗瑕佹眰璇ュ瓧娈佃緭鍑?
 * - panel: 鏄惁鍦ㄢ€滄姤鍛娾€濋噷灞曠ず
 * - inline: 鏄惁鍦ㄢ€滆嚜鍔ㄨ拷鍔犲垎鏋愭鈥濋噷灞曠ず
 * - maxItems: type=list 鏃堕檺鍒舵渶澶ф潯鐩紙鍙€夛級
 */

const DEFAULT_MODULES = Object.freeze([
  { key: 'world_summary', title: '涓栫晫绠€浠?, type: 'text', prompt: '1~3鍙ユ鎷笘鐣屼笌灞€鍔?, required: true, panel: true, inline: true, static: true },
  { key: 'key_plot_points', title: '閲嶈鍓ф儏鐐?, type: 'list', prompt: '3~8鏉″叧閿墽鎯呯偣锛堢煭鍙ワ級', maxItems: 8, required: true, panel: true, inline: false, static: true },
  { key: 'current_scene', title: '褰撳墠鏃堕棿鐐?路 鍏蜂綋鍓ф儏', type: 'text', prompt: '鎻忚堪褰撳墠鍙戠敓浜嗕粈涔堬紙鍦扮偣/浜虹墿鍔ㄦ満/鍐茬獊/鎮康锛?, required: true, panel: true, inline: true },
  { key: 'next_events', title: '鍚庣画灏嗕細鍙戠敓鐨勪簨', type: 'list', prompt: '鎺ヤ笅鏉ユ渶鍙兘鍙戠敓鐨勪簨锛堟潯鐩級', maxItems: 6, required: true, panel: true, inline: true },
  { key: 'protagonist_impact', title: '涓昏琛屼负閫犳垚鐨勫奖鍝?, type: 'text', prompt: '涓昏琛屼负瀵瑰墽鎯?鍏崇郴/椋庨櫓閫犳垚鐨勬敼鍙?, required: true, panel: true, inline: false },
  { key: 'tips', title: '缁欎富瑙掔殑鎻愮ず锛堝熀浜庡師钁楀悗缁?澶х翰锛?, type: 'list', prompt: '缁欏嚭鍙墽琛屾彁绀猴紙灏介噺鍏蜂綋锛?, maxItems: 4, required: true, panel: true, inline: true },
  { key: 'quick_actions', title: '蹇嵎閫夐」', type: 'list', prompt: '鏍规嵁褰撳墠鍓ф儏璧板悜锛岀粰鍑?~6涓帺瀹跺彲浠ュ彂閫佺殑鍏蜂綋琛屽姩閫夐」锛堟瘡椤?5~40瀛楋紝鍙洿鎺ヤ綔涓哄璇濊緭鍏ュ彂閫侊級', maxItems: 6, required: true, panel: true, inline: true },
]);

// ===== 鎬荤粨鎻愮ず璇嶉粯璁ゅ€硷紙鍙湪闈㈡澘涓嚜瀹氫箟锛?=====
const DEFAULT_SUMMARY_SYSTEM_PROMPT = `浣犳槸涓€涓€滃墽鎯呮€荤粨/涓栫晫涔﹁蹇嗏€濆姪鎵嬨€俓n\n浠诲姟锛歕n1) 闃呰鐢ㄦ埛涓嶢I瀵硅瘽鐗囨锛岀敓鎴愪竴娈电畝娲佹憳瑕侊紙涓枃锛?50~400瀛楋紝灏介噺鍖呭惈锛氫富瑕佷汉鐗?鐩爣/鍐茬獊/鍏抽敭鐗╁搧/鍦扮偣/鍏崇郴鍙樺寲/鏈В鍐崇殑鎮康锛夈€俓n2) 鎻愬彇 6~14 涓叧閿瘝锛堜腑鏂囦紭鍏堬紝浜虹墿/鍦扮偣/鍔垮姏/鐗╁搧/浜嬩欢/鍏崇郴绛夛級锛岀敤浜庝笘鐣屼功鏉＄洰瑙﹀彂璇嶃€傚叧閿瘝灏介噺鍘婚噸銆佷笉瑕佸お娉涳紙濡傗€滅劧鍚庘€濃€滃ソ鐨勨€濓級銆俙;

const DEFAULT_SUMMARY_USER_TEMPLATE = `銆愭ゼ灞傝寖鍥淬€憑{fromFloor}}-{{toFloor}}\n\n銆愬璇濈墖娈点€慭n{{chunk}}`;

// 鏃犺鐢ㄦ埛鎬庝箞鑷畾涔夋彁绀鸿瘝锛屼粛浼氬己鍒惰拷鍔?JSON 杈撳嚭缁撴瀯瑕佹眰锛岄伩鍏嶅啓鍏ヤ笘鐣屼功澶辫触
const SUMMARY_JSON_REQUIREMENT = `杈撳嚭瑕佹眰锛歕n- 鍙緭鍑轰弗鏍?JSON锛屼笉瑕?Markdown銆佷笉瑕佷唬鐮佸潡銆佷笉瑕佷换浣曞浣欐枃瀛椼€俓n- JSON 缁撴瀯蹇呴』涓猴細{"title": string, "summary": string, "keywords": string[]}銆俓n- keywords 涓?6~14 涓瘝/鐭锛屽敖閲忓幓閲嶃€侀伩鍏嶆硾璇嶃€俙;


// ===== 绱㈠紩鎻愮ず璇嶉粯璁ゅ€硷紙鍙湪闈㈡澘涓嚜瀹氫箟锛涚敤浜?LLM 缁煎悎鍒ゆ柇"妯″紡锛?=====
const DEFAULT_INDEX_SYSTEM_PROMPT = `浣犳槸涓€涓?鍓ф儏绱㈠紩鍖归厤"鍔╂墜銆?

銆愪换鍔°€?
- 杈撳叆鍖呭惈锛氭渶杩戝墽鎯呮鏂囷紙鑺傞€夛級銆佺敤鎴峰綋鍓嶈緭鍏ャ€佷互鍙婅嫢骞插€欓€夌储寮曟潯鐩紙鍚爣棰?鎽樿/瑙﹀彂璇?绫诲瀷锛夈€?
- 浣犵殑鐩爣鏄細缁煎悎鍒ゆ柇鍝簺鍊欓€夋潯鐩笌"褰撳墠鍓ф儏"鏈€鐩稿叧锛屽苟杩斿洖杩欎簺鍊欓€夌殑 id銆?

銆愰€夋嫨浼樺厛绾с€?
1. **浜虹墿鐩稿叧**锛氬綋鍓嶅墽鎯呮秹鍙婃煇涓狽PC鏃讹紝浼樺厛绱㈠紩璇PC鐨勬。妗堟潯鐩?
2. **瑁呭鐩稿叧**锛氬綋鍓嶅墽鎯呮秹鍙婃煇浠惰澶囨椂锛屼紭鍏堢储寮曡瑁呭鐨勬潯鐩?
3. **鍘嗗彶鍓ф儏**锛氫紭鍏堥€夋嫨鏃堕棿杈冧箙杩滀絾涓庡綋鍓嶅墽鎯呯浉鍏崇殑鏉＄洰锛堥伩鍏嶇储寮曟渶杩戝凡鍦ㄤ笂涓嬫枃涓殑鍓ф儏锛?
4. **鍥犳灉鍏宠仈**锛氬綋鍓嶄簨浠剁殑鍓嶅洜銆佷紡绗斻€佹湭瑙ｆ偓蹇?

銆愰伩鍏嶃€?
- 涓嶈閫夋嫨鍒氬垰鍙戠敓鐨勫墽鎯咃紙鏈€杩?灞備互鍐呯殑鍐呭閫氬父宸插湪涓婁笅鏂囦腑锛?
- 閬垮厤閫夋嫨鏄庢樉鏃犲叧鎴栬繃浜庢硾娉涚殑鏉＄洰

銆愯繑鍥炶姹傘€?
- 杩斿洖鏉＄洰鏁伴噺搴?<= maxPick
- 鍒嗙被鎺у埗锛氫汉鐗╂潯鐩?<= maxCharacters锛岃澶囨潯鐩?<= maxEquipments锛屽墽鎯呮潯鐩?<= maxPlot`;

const DEFAULT_INDEX_USER_TEMPLATE = `銆愮敤鎴峰綋鍓嶈緭鍏ャ€?
{{userMessage}}

銆愭渶杩戝墽鎯咃紙鑺傞€夛級銆?
{{recentText}}

銆愬€欓€夌储寮曟潯鐩紙JSON锛夈€?
{{candidates}}

銆愰€夋嫨闄愬埗銆?
- 鎬绘暟涓嶈秴杩?{{maxPick}} 鏉?
- 浜虹墿鏉＄洰涓嶈秴杩?{{maxCharacters}} 鏉?
- 瑁呭鏉＄洰涓嶈秴杩?{{maxEquipments}} 鏉?
- 鍓ф儏鏉＄洰涓嶈秴杩?{{maxPlot}} 鏉?

璇蜂粠鍊欓€変腑閫夊嚭涓庡綋鍓嶅墽鎯呮渶鐩稿叧鐨勬潯鐩紝浼樺厛閫夋嫨锛氫笌褰撳墠鎻愬埌鐨勪汉鐗?瑁呭鐩稿叧鐨勬潯鐩€佹椂闂磋緝涔呰繙鐨勭浉鍏冲墽鎯呫€備粎杈撳嚭 JSON銆俙;

const INDEX_JSON_REQUIREMENT = `杈撳嚭瑕佹眰锛?
- 鍙緭鍑轰弗鏍?JSON锛屼笉瑕?Markdown銆佷笉瑕佷唬鐮佸潡銆佷笉瑕佷换浣曞浣欐枃瀛椼€?
- JSON 缁撴瀯蹇呴』涓猴細{"pickedIds": number[]}銆?
- pickedIds 蹇呴』鏄€欓€夊垪琛ㄩ噷鐨?id锛堟暣鏁帮級銆?
- 杩斿洖鐨?pickedIds 鏁伴噺 <= maxPick銆俙;


// ===== 缁撴瀯鍖栦笘鐣屼功鏉＄洰鎻愮ず璇嶉粯璁ゅ€?=====
const DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT = `浣犳槸涓€涓?鍓ф儏璁板繂绠＄悊"鍔╂墜锛岃礋璐ｄ粠瀵硅瘽鐗囨涓彁鍙栫粨鏋勫寲淇℃伅鐢ㄤ簬闀挎湡璁板繂銆?

銆愪换鍔°€?
1. 璇嗗埆鏈瀵硅瘽涓嚭鐜扮殑閲嶈 NPC锛堜笉鍚富瑙掞級
2. 璇嗗埆涓昏褰撳墠鎸佹湁/瑁呭鐨勫叧閿墿鍝?
3. 璇嗗埆涓昏鏂板鎴栧彉鍖栫殑鑳藉姏
4. 璇嗗埆闇€瑕佸垹闄ょ殑鏉＄洰锛堟浜＄殑瑙掕壊銆佸崠鎺?鍒嗚В鐨勮澶囩瓑锛?
5. 鐢熸垚妗ｆ寮忕殑瀹㈣绗笁浜虹О鎻忚堪

銆愮瓫閫夋爣鍑嗐€?
- NPC锛氬彧璁板綍鏈夊悕鏈夊鐨勮鑹诧紝蹇界暐鏉傚叺銆佹棤鍚峃PC銆佹櫘閫氭晫浜?
- 瑁呭锛氬彧璁板綍缁胯壊鍝佽川浠ヤ笂鐨勮澶囷紝鎴栫传鑹插搧璐ㄤ互涓婄殑閲嶈鐗╁搧

銆愬幓閲嶈鍒欙紙閲嶈锛夈€?
- 浠旂粏妫€鏌ャ€愬凡鐭ヤ汉鐗╁垪琛ㄣ€戝拰銆愬凡鐭ヨ澶囧垪琛ㄣ€戯紝閬垮厤閲嶅鍒涘缓鏉＄洰
- 鍚屼竴瑙掕壊鍙兘鏈夊绉嶅啓娉曪紙濡傜箒浣?绠€浣撱€佽嫳鏂?涓枃缈昏瘧锛夛紝蹇呴』璇嗗埆涓哄悓涓€浜?
- 濡傛灉鍙戠幇瑙掕壊宸插瓨鍦ㄤ簬鍒楄〃涓紝浣跨敤 isUpdated=true 鏇存柊鑰屼笉鏄垱寤烘柊鏉＄洰
- 灏嗕笉鍚屽悕绉板啓娉曟坊鍔犲埌 aliases 鏁扮粍涓?

銆愬垹闄ゆ潯鐩鍒欍€?
- 鑻ヨ鑹插湪瀵硅瘽涓槑纭浜?姘镐箙绂诲紑锛屽皢鍏跺姞鍏?deletedCharacters 鏁扮粍
- 鑻ヨ澶囪鍗栨帀/鍒嗚В/涓㈠純/褰诲簳鎹熷潖锛屽皢鍏跺姞鍏?deletedEquipments 鏁扮粍
- 鑻ヨ兘鍔涜閬楀繕/鍓ュず/褰诲簳澶辨晥锛屽皢鍏跺姞鍏?deletedAbilities 鏁扮粍

銆愰噸瑕併€?
- 鑻ユ彁渚涗簡 statData锛岃浠庝腑鎻愬彇璇ヨ鑹?鐗╁搧鐨?*鍏抽敭鏁板€?*锛堝灞炴€с€佺瓑绾с€佺姸鎬侊級锛岀簿绠€涓?-2琛?
- 涓嶈瀹屾暣澶嶅埗 statData锛屽彧鎻愬彇鏈€閲嶈鐨勪俊鎭?
- 閲嶇偣鎻忚堪锛氫笌涓昏鐨勫叧绯诲彂灞曘€佽鑹茶儗鏅€佹€ф牸鐗圭偣銆佸叧閿簨浠?

銆愭€ф牸閾嗛拤銆?
- 涓烘瘡涓噸瑕丯PC鎻愬彇銆屾牳蹇冩€ф牸銆嶏細涓嶄細鍥犲墽鎯呭彂灞曡€岃交鏄撴敼鍙樼殑鏍规湰鐗硅川
- 鎻愬彇銆岃鑹插姩鏈恒€嶏細璇ヨ鑹茶嚜宸辩殑鐩爣/杩芥眰锛屼笉鏄洿缁曚富瑙掕浆
- 璇勪及銆屽叧绯婚樁娈点€嶏細闄岀敓/鍒濊瘑/鐔熸倝/淇′换/浜插瘑锛屽叧绯诲彂灞曞簲寰簭娓愯繘`;
const DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE = `銆愭ゼ灞傝寖鍥淬€憑{fromFloor}}-{{toFloor}}\\n銆愬璇濈墖娈点€慭\n{{chunk}}\\n銆愬凡鐭ヤ汉鐗╁垪琛ㄣ€慭\n{{knownCharacters}}\\n銆愬凡鐭ヨ澶囧垪琛ㄣ€慭\n{{knownEquipments}}`;
const DEFAULT_STRUCTURED_CHARACTER_PROMPT = `鍙褰曟湁鍚嶆湁濮撶殑閲嶈NPC锛堜笉鍚富瑙掞級锛屽拷鐣ユ潅鍏点€佹棤鍚嶆晫浜恒€佽矾浜恒€?

銆愬繀濉瓧娈点€戦樀钀ヨ韩浠姐€佹€ф牸鐗圭偣銆佽儗鏅晠浜嬨€佷笌涓昏鍏崇郴鍙婂彂灞曘€佸叧閿簨浠?

銆愭€ф牸閾嗛拤瀛楁锛堥噸瑕侊級銆?
- corePersonality锛氭牳蹇冩€ф牸閿氱偣锛屼笉浼氳交鏄撴敼鍙樼殑鏍规湰鐗硅川锛堝"鍌叉參"銆?澶氱枒"銆?閲嶄箟"锛夛紝鍗充娇涓庝富瑙掑叧绯绘敼鍠勪篃浼氫繚鎸?
- motivation锛氳鑹茶嚜宸辩殑鐙珛鐩爣/鍔ㄦ満锛屼笉搴斾负浜嗕富瑙掕€屾斁寮?
- relationshipStage锛氫笌涓昏鐨勫叧绯婚樁娈碉紙闄岀敓/鍒濊瘑/鐔熸倝/淇′换/浜插瘑锛夛紝鍏崇郴涓嶅簲璺宠穬寮忓彂灞?

鑻ヨ鑹叉浜?姘镐箙绂诲紑锛屽皢鍏跺悕瀛楀姞鍏?deletedCharacters銆傝嫢鏈?statData锛屽湪 statInfo 涓簿绠€鎬荤粨銆備俊鎭笉瓒冲啓"寰呯‘璁?銆俙;
const DEFAULT_STRUCTURED_EQUIPMENT_PROMPT = `鍙褰曠豢鑹插搧璐ㄤ互涓婄殑瑁呭锛屾垨绱壊鍝佽川浠ヤ笂鐨勯噸瑕佺墿鍝侊紙蹇界暐鐧借壊/鐏拌壊鏅€氱墿鍝侊級銆傚繀椤昏褰曪細鑾峰緱鏃堕棿銆佽幏寰楀湴鐐广€佹潵婧愶紙鎺夎惤/璐拱/閿婚€?濂栧姳绛夛級銆佸綋鍓嶇姸鎬併€傝嫢鏈夊己鍖?鍗囩骇锛屾弿杩颁富瑙掑浣曞煿鍏昏繖浠惰澶囥€傝嫢瑁呭琚崠鎺?鍒嗚В/涓㈠純/鎹熷潖锛屽皢鍏跺悕瀛楀姞鍏?deletedEquipments銆傝嫢鏈?statData锛岀簿绠€鎬荤粨鍏跺睘鎬с€俙;
const DEFAULT_STRUCTURED_ABILITY_PROMPT = `璁板綍涓昏鐨勮兘鍔?鎶€鑳姐€傝鏄庣被鍨嬨€佹晥鏋溿€佽Е鍙戞潯浠躲€佷唬浠枫€傝嫢鑳藉姏琚仐蹇?鍓ュず/澶辨晥锛屽皢鍏跺悕瀛楀姞鍏?deletedAbilities銆傝嫢鏈?statData锛岀簿绠€鎬荤粨鍏舵暟鍊笺€俙;
const STRUCTURED_ENTRIES_JSON_REQUIREMENT = `杈撳嚭瑕佹眰锛氬彧杈撳嚭涓ユ牸 JSON銆傚悇瀛楁瑕佸～鍐欏畬鏁达紝statInfo 鍙～鍏抽敭鏁板€肩殑绮剧畝鎬荤粨锛?-2琛岋級銆?

缁撴瀯锛歿"characters":[...],"equipments":[...],"abilities":[...],"deletedCharacters":[...],"deletedEquipments":[...],"deletedAbilities":[...]}

characters 鏉＄洰缁撴瀯锛歿name,uid,aliases[],faction,status,personality,corePersonality:"鏍稿績鎬ф牸閿氱偣锛堜笉杞绘槗鏀瑰彉锛?,motivation:"瑙掕壊鐙珛鍔ㄦ満/鐩爣",relationshipStage:"闄岀敓|鍒濊瘑|鐔熸倝|淇′换|浜插瘑",background,relationToProtagonist,keyEvents[],statInfo,isNew,isUpdated}

equipments 鏉＄洰缁撴瀯锛歿name,uid,type,rarity,effects,source,currentState,statInfo,boundEvents[],isNew}

abilities 鏉＄洰缁撴瀯锛歿name,uid,type,effects,trigger,cost,statInfo,boundEvents[],isNegative,isNew}`;

// ===== ROLL 鍒ゅ畾榛樿閰嶇疆 =====
const DEFAULT_ROLL_ACTIONS = Object.freeze([
  { key: 'combat', label: '鎴樻枟', keywords: ['鎴樻枟', '鏀诲嚮', '鍑烘墜', '鎸ュ墤', '灏勫嚮', '鏍兼尅', '闂伩', '鎼忔枟', '鐮?, '鏉€', '鎵?, 'fight', 'attack', 'strike'] },
  { key: 'persuade', label: '鍔濊', keywords: ['鍔濊', '璇存湇', '璋堝垽', '浜ゆ秹', '濞佽儊', '鎭愬悡', '娆洪獥', 'persuade', 'negotiate', 'intimidate', 'deceive'] },
  { key: 'learn', label: '瀛︿範', keywords: ['瀛︿範', '淇偧', '缁冧範', '鐮旂┒', '鎺屾彙', '瀛︿細', '鎶€鑳?, 'learn', 'train', 'practice'] },
]);
const DEFAULT_ROLL_FORMULAS = Object.freeze({
  combat: '(PC.str + PC.dex + PC.atk + MOD.total + CTX.bonus + CTX.penalty) / 4',
  persuade: '(PC.cha + PC.int + MOD.total) / 3',
  learn: '(PC.int + PC.wis + MOD.total) / 3',
  default: 'MOD.total',
});
const DEFAULT_ROLL_MODIFIER_SOURCES = Object.freeze(['skill', 'talent', 'trait', 'buff', 'equipment']);
const DEFAULT_ROLL_SYSTEM_PROMPT = `浣犳槸涓€涓笓涓氱殑TRPG/ROLL鐐硅鍒ゃ€?

銆愪换鍔°€?
- 鏍规嵁鐢ㄦ埛琛屼负涓庡睘鎬ф暟鎹?(statDataJson) 杩涜鍔ㄤ綔鍒ゅ畾銆?
- 闅惧害妯″紡 difficulty锛歴imple (绠€鍗? / normal (鏅€? / hard (鍥伴毦) / hell (鍦扮嫳)銆?
- 璁惧畾 鎴愬姛闃堝€?DC (Difficulty Class)锛?
  - normal: DC 15~20
  - hard: DC 20~25
  - hell: DC 25~30
  - 鎴愬姛鍒ゅ畾鍩轰簬 margin (final - threshold)锛?
    - margin >= 8 : critical_success (澶ф垚鍔?
    - margin 0 ~ 7 : success (鎴愬姛)
    - margin -1 ~ -7 : failure (澶辫触)
    - margin <= -8 : fumble (澶уけ璐?

銆愭暟鍊兼槧灏勫缓璁€?
- 灏嗘枃鏈弿杩扮殑绛夌骇杞寲涓烘暟鍊间慨姝?(MOD)锛?
  - F=0, E=+0.5, D=+1, C=+2, B=+3, A=+4, S=+6, SS=+8, SSS=+10
  - 鑻ヤ负鏁板€?(濡?Lv.5)锛屽垯鐩存帴鍙栧€?(濡?+5)銆?
- 鍝佺骇淇锛氳嫢瑁呭/鎶€鑳芥湁绋€鏈夊害鍒掑垎锛屽彲鍙傝€冧笂杩版槧灏勭粰浜堥澶栧姞鍊笺€?
- Buff/Debuff锛氭牴鎹笂涓嬫枃缁欎簣 +/- 1~5 鐨勪复鏃惰皟鏁淬€?

銆怐20 瑙勫垯鍙傝€冦€?
- 鏍稿績鍏紡锛歞20 + 灞炴€т慨姝?+ 鐔熺粌鍊?+ 鍏朵粬淇 >= DC
- randomRoll (1~100) 鎹㈢畻涓?d20 = ceil(randomRoll / 5)銆?
- 澶ф垚鍔?澶уけ璐ワ細
  - d20 = 20 (鍗?randomRoll 96~100) 瑙嗕负鈥滃ぇ鎴愬姛鈥?涓嶈鏁板€硷紝闄ら潪 DC 鏋侀珮)銆?
  - d20 = 1 (鍗?randomRoll 1~5) 瑙嗕负鈥滃ぇ澶辫触鈥濄€?

銆愯绠楁祦绋嬨€?
1. 纭畾 action (鍔ㄤ綔绫诲瀷) 涓?formula (璁＄畻鍏紡)銆?
2. 璁＄畻 base (鍩虹鍊? 涓?mods (鎵€鏈変慨姝ｆ潵婧愪箣鍜?銆?
3. 璁＄畻 final = base + mods + 闅忔満瑕佺礌銆?
4. 姣旇緝 final 涓?threshold锛屽緱鍑?success (true/false) 涓?outcomeTier銆?

銆愯緭鍑鸿姹傘€?
- 蹇呴』杈撳嚭绗﹀悎 JSON Requirement 鐨?JSON 鏍煎紡銆?
- explanation: 绠€鐭弿杩板垽瀹氳繃绋嬩笌缁撴灉 (1~2鍙?銆?
- analysisSummary: 姹囨€讳慨姝ｆ潵婧愪笌鍏抽敭鏄犲皠閫昏緫銆?
`;

const DEFAULT_ROLL_USER_TEMPLATE = `鍔ㄤ綔={{action}}\n鍏紡={{formula}}\nrandomWeight={{randomWeight}}\ndifficulty={{difficulty}}\nrandomRoll={{randomRoll}}\nmodifierSources={{modifierSourcesJson}}\nstatDataJson={{statDataJson}}`;
const ROLL_JSON_REQUIREMENT = `杈撳嚭瑕佹眰锛堜弗鏍?JSON锛夛細\n{"action": string, "formula": string, "base": number, "mods": [{"source": string, "value": number}], "random": {"roll": number, "weight": number}, "final": number, "threshold": number, "success": boolean, "outcomeTier": string, "explanation": string, "analysisSummary"?: string}\n- analysisSummary 鍙€夛紝鐢ㄤ簬鏃ュ織鏄剧ず锛屽缓璁寘鍚€滀慨姝ｆ潵婧愭眹鎬?鏄犲皠搴旂敤鈥濅袱娈碉紱explanation 寤鸿 1~2 鍙ャ€俙;
const ROLL_DECISION_JSON_REQUIREMENT = `杈撳嚭瑕佹眰锛堜弗鏍?JSON锛夛細\n- 鑻ユ棤闇€鍒ゅ畾锛氬彧杈撳嚭 {"needRoll": false}銆俓n- 鑻ラ渶瑕佸垽瀹氾細杈撳嚭 {"needRoll": true, "result": {action, formula, base, mods, random, final, threshold, success, outcomeTier, explanation, analysisSummary?}}銆俓n- 涓嶈 Markdown銆佷笉瑕佷唬鐮佸潡銆佷笉瑕佷换浣曞浣欐枃瀛椼€俙;

const DEFAULT_ROLL_DECISION_SYSTEM_PROMPT = `浣犳槸涓€涓垽瀹氬姩浣滄槸鍚﹂渶瑕丷OLL鐐圭殑杈呭姪AI銆?

銆愪换鍔°€?
- 鏍稿績浠诲姟鏄垽鏂敤鎴风殑琛屼负鏄惁闇€瑕佽繘琛岄殢鏈烘€у垽瀹?(ROLL)銆?
- 鍙湁褰撹涓哄叿鏈変笉纭畾鎬с€佹寫鎴樻€ф垨瀵规姉鎬ф椂鎵嶉渶瑕?ROLL銆?
- 鑻?needRoll=true锛屽垯鍚屾椂杩涜鍒ゅ畾璁＄畻銆?

銆愬垽瀹氬師鍒?(needRoll)銆?
- needRoll = false: 
  - 鏃ュ父琛屼负 (鍚冮キ/璧拌矾/闂茶亰)銆?
  - 蹇呭畾鎴愬姛鐨勮涓?(娌℃湁骞叉壈/闅惧害鏋佷綆)銆?
  - 绾补鐨勬儏鎰熻〃杈炬垨蹇冪悊娲诲姩銆?
- needRoll = true:
  - 鎴樻枟/鏀诲嚮/闃插尽銆?
  - 灏濊瘯璇存湇/娆洪獥/鎭愬悡浠栦汉銆?
  - 鍏锋湁椋庨櫓鎴栭毦搴︾殑鍔ㄤ綔 (鎾攣/鏀€鐖?娼滆)銆?
  - 鐭ヨ瘑妫€瀹?鎰熺煡妫€瀹?(鍙戠幇闅愯棌绾跨储)銆?

銆愯嫢 needRoll=true锛岃绠楀弬鑰冦€?
- 闅惧害妯″紡 difficulty 涓?鎴愬姛闃堝€?DC (simple/normal/hard/hell)銆?
- 鏁板€兼槧灏勫缓璁細F=0, E=+0.5, D=+1, C=+2, B=+3, A=+4, S=+6, SS=+8, SSS=+10銆?
- 鍝佺骇淇锛氬弬鑰冭澶?鎶€鑳藉搧绾с€?
- margin 鍒ゅ畾锛?=8 澶ф垚鍔燂紝0~7 鎴愬姛锛?1~-7 澶辫触锛?=-8 澶уけ璐ャ€?

銆愯緭鍑鸿姹傘€?
- 鑻ユ棤闇€鍒ゅ畾锛歿"needRoll": false}
- 鑻ラ渶瑕佸垽瀹氾細{"needRoll": true, "result": { ...瀹屾暣璁＄畻杩囩▼... }}
- 涓ユ牸閬靛惊 JSON Requirement 鏍煎紡锛屼笉瑕佽緭鍑?Markdown 浠ｇ爜鍧椼€?
`;

const DEFAULT_ROLL_DECISION_USER_TEMPLATE = `鐢ㄦ埛杈撳叆={{userText}}\nrandomWeight={{randomWeight}}\ndifficulty={{difficulty}}\nrandomRoll={{randomRoll}}\nstatDataJson={{statDataJson}}`;

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,

  // 杈撳叆鎴彇
  maxMessages: 40,
  maxCharsPerMessage: 1600,
  includeUser: true,
  includeAssistant: true,

  // 鐢熸垚鎺у埗锛堜粛淇濈暀鍓ч€忎笌 temperature锛涙洿澶氶鏍煎彲閫氳繃鑷畾涔?system/constraints 鍋氾級
  spoilerLevel: 'mild', // none | mild | full
  temperature: 0.4,

  // 鑷姩鍒锋柊锛堥潰鏉挎姤鍛婏級
  autoRefresh: false,
  autoRefreshOn: 'received', // received | sent | both
  debounceMs: 1200,

  // 鑷姩杩藉姞鍒版鏂囨湯灏?
  autoAppendBox: true,
  appendMode: 'compact', // compact | standard
  appendDebounceMs: 700,

  // 杩藉姞妗嗗睍绀哄摢浜涙ā鍧?
  inlineModulesSource: 'inline', // inline | panel | all
  inlineShowEmpty: false,        // 鏄惁鏄剧ず绌哄瓧娈靛崰浣?

  // provider
  provider: 'st', // st | custom

  // custom API锛堝缓璁～鈥淎PI鍩虹URL鈥濓紝濡?https://api.openai.com/v1 锛?
  customEndpoint: '',
  customApiKey: '',
  customModel: 'gpt-4o-mini',
  customModelsCache: [],
  customTopP: 0.95,
  customMaxTokens: 8192,
  customStream: false,

  // 棰勮瀵煎叆/瀵煎嚭
  presetIncludeApiKey: false,

  // 涓栫晫涔︼紙World Info/Lorebook锛夊鍏ヤ笌娉ㄥ叆
  worldbookEnabled: false,
  worldbookMode: 'active', // active | all
  worldbookMaxChars: 6000,
  worldbookWindowMessages: 18,
  worldbookJson: '',

  // ===== 鎬荤粨鍔熻兘锛堢嫭绔嬩簬鍓ф儏鎻愮ず鐨?API 璁剧疆锛?=====
  summaryEnabled: false,
  // 澶氬皯鈥滄ゼ灞傗€濇€荤粨涓€娆★紙妤煎眰缁熻鏂瑰紡瑙?summaryCountMode锛?
  summaryEvery: 20,
  // 鎵嬪姩妤煎眰鑼冨洿鎬荤粨锛氭槸鍚︽寜鈥滄瘡 N 灞傗€濇媶鍒嗙敓鎴愬鏉★紙N=summaryEvery锛?
  summaryManualSplit: false,
  // assistant: 浠呯粺璁?AI 鍥炲锛沘ll: 缁熻鍏ㄩ儴娑堟伅锛堢敤鎴?AI锛?
  summaryCountMode: 'assistant',
  // 鑷姩鎬荤粨鏃讹紝榛樿鍙€荤粨鈥滀笂娆℃€荤粨涔嬪悗鏂板鈥濈殑鍐呭锛涢娆″垯鎬荤粨鏈€杩?summaryEvery 娈?
  summaryMaxCharsPerMessage: 4000,
  summaryMaxTotalChars: 24000,

  // 鏄惁璇诲彇 stat_data 鍙橀噺浣滀负鎬荤粨涓婁笅鏂囷紙绫讳技 roll 鐐规ā鍧楋級
  summaryReadStatData: false,
  summaryStatVarName: 'stat_data',

  // 鎬荤粨璋冪敤鏂瑰紡锛歴t=璧伴厭棣嗗綋鍓嶅凡杩炴帴鐨?LLM锛沜ustom=鐙珛 OpenAI 鍏煎 API
  summaryProvider: 'st',
  summaryTemperature: 0.4,

  // 鑷畾涔夋€荤粨鎻愮ず璇嶏紙鍙€夛級
  // - system锛氬喅瀹氭€荤粨椋庢牸/閲嶇偣
  // - userTemplate锛氬喅瀹氬浣曟妸妤煎眰鑼冨洿/瀵硅瘽鐗囨濉炵粰妯″瀷锛堟敮鎸佸崰浣嶇锛?
  summarySystemPrompt: DEFAULT_SUMMARY_SYSTEM_PROMPT,
  summaryUserTemplate: DEFAULT_SUMMARY_USER_TEMPLATE,
  summaryCustomEndpoint: '',
  summaryCustomApiKey: '',
  summaryCustomModel: 'gpt-4o-mini',
  summaryCustomModelsCache: [],
  summaryCustomMaxTokens: 2048,
  summaryCustomStream: false,

  // 鎬荤粨缁撴灉鍐欏叆涓栫晫涔︼紙Lorebook / World Info锛?
  // 鈥斺€?缁跨伅涓栫晫涔︼紙鍏抽敭璇嶈Е鍙戯級鈥斺€?
  summaryToWorldInfo: true,
  // 鍐欏叆鎸囧畾涓栫晫涔︽枃浠跺悕
  summaryWorldInfoTarget: 'file',
  summaryWorldInfoFile: '',
  summaryWorldInfoCommentPrefix: '鍓ф儏鎬荤粨',

  // 鎬荤粨鍐欏叆涓栫晫涔?key锛堣Е鍙戣瘝锛夌殑鏉ユ簮
  // - keywords: 浣跨敤妯″瀷杈撳嚭鐨?keywords锛堥粯璁わ級
  // - indexId: 浣跨敤鑷姩鐢熸垚鐨勭储寮曠紪鍙凤紙濡?A-001锛夛紝鍙啓 1 涓Е鍙戣瘝锛岃Е鍙戞洿绮剧‘
  summaryWorldInfoKeyMode: 'keywords',
  // 褰?keyMode=indexId 鏃讹細绱㈠紩缂栧彿鏍煎紡
  summaryIndexPrefix: 'A-',
  summaryIndexPad: 3,
  summaryIndexStart: 1,
  // 鏄惁鎶婄储寮曠紪鍙峰啓鍏ユ潯鐩爣棰橈紙comment锛夛紝渚夸簬涓栫晫涔﹀垪琛ㄥ畾浣?
  summaryIndexInComment: true,

  // 鈥斺€?钃濈伅涓栫晫涔︼紙甯稿紑绱㈠紩锛氱粰鏈彃浠跺仛妫€绱㈢敤锛夆€斺€?
  // 娉ㄦ剰锛氳摑鐏笘鐣屼功寤鸿鍐欏叆鈥滄寚瀹氫笘鐣屼功鏂囦欢鍚嶁€濓紝鍥犱负 chatbook 閫氬父鍙湁涓€涓€?
  summaryToBlueWorldInfo: true,
  summaryBlueWorldInfoFile: '',
  summaryBlueWorldInfoCommentPrefix: '鍓ф儏鎬荤粨',

  // 鈥斺€?鑷姩缁戝畾涓栫晫涔︼紙姣忎釜鑱婂ぉ鑷姩鐢熸垚涓撳睘涓栫晫涔︼級鈥斺€?
  autoBindWorldInfo: false,
  autoBindWorldInfoPrefix: 'SG',

  // 鈥斺€?钃濈伅绱㈠紩 鈫?缁跨伅瑙﹀彂 鈥斺€?
  wiTriggerEnabled: false,

  // 鍖归厤鏂瑰紡锛歭ocal=鏈湴鐩镐技搴︼紱llm=LLM 缁煎悎鍒ゆ柇锛堝彲鑷畾涔夋彁绀鸿瘝 & 鐙珛 API锛?
  wiTriggerMatchMode: 'local',

  // 鈥斺€?绱㈠紩 LLM锛堢嫭绔嬩簬鎬荤粨 API 鐨勭浜屽閰嶇疆锛夆€斺€?
  wiIndexProvider: 'st',         // st | custom
  wiIndexTemperature: 0.2,
  wiIndexTopP: 0.95,
  wiIndexSystemPrompt: DEFAULT_INDEX_SYSTEM_PROMPT,
  wiIndexUserTemplate: DEFAULT_INDEX_USER_TEMPLATE,

  // LLM 妯″紡锛氬厛鐢ㄦ湰鍦扮浉浼煎害棰勭瓫閫?TopK锛屽啀浜ょ粰妯″瀷缁煎悎鍒ゆ柇锛堟洿鐪?tokens锛?
  wiIndexPrefilterTopK: 24,
  // 姣忔潯鍊欓€夋憳瑕佹埅鏂瓧绗︼紙鎺у埗 tokens锛?
  wiIndexCandidateMaxChars: 420,

  // 绱㈠紩鐙珛 OpenAI 鍏煎 API
  wiIndexCustomEndpoint: '',
  wiIndexCustomApiKey: '',
  wiIndexCustomModel: 'gpt-4o-mini',
  wiIndexCustomModelsCache: [],
  wiIndexCustomMaxTokens: 1024,
  wiIndexCustomStream: false,

  // 鍦ㄧ敤鎴峰彂閫佹秷鎭墠锛圡ESSAGE_SENT锛夎鍙栤€滄渶杩?N 鏉℃秷鎭鏂団€濓紙涓嶅惈褰撳墠鏉★級锛屼粠钃濈伅绱㈠紩閲屾寫鐩稿叧鏉＄洰銆?
  wiTriggerLookbackMessages: 20,
  // 鏄惁鎶娾€滄湰娆＄敤鎴疯緭鍏モ€濈撼鍏ョ储寮曞尮閰嶏紙缁煎悎鍒ゆ柇锛夈€?
  wiTriggerIncludeUserMessage: true,
  // 鏈鐢ㄦ埛杈撳叆鍦ㄧ浉浼煎害鍚戦噺涓殑鏉冮噸锛堣秺澶ц秺鐪嬮噸鐢ㄦ埛杈撳叆锛?=涓庢渶杩戞鏂囧悓鏉冮噸锛?
  wiTriggerUserMessageWeight: 1.6,
  // 鑷冲皯宸叉湁 N 鏉?AI 鍥炲锛堟ゼ灞傦級鎵嶅紑濮嬬储寮曡Е鍙戯紱0=绔嬪嵆
  wiTriggerStartAfterAssistantMessages: 0,
  // 鏈€澶氶€夋嫨澶氬皯鏉?summary 鏉＄洰鏉ヨЕ鍙?
  wiTriggerMaxEntries: 4,
  // 鍒嗙被鏈€澶х储寮曟暟
  wiTriggerMaxCharacters: 2, // 鏈€澶氱储寮曞灏戜釜浜虹墿鏉＄洰
  wiTriggerMaxEquipments: 2, // 鏈€澶氱储寮曞灏戜釜瑁呭鏉＄洰
  wiTriggerMaxPlot: 3,       // 鏈€澶氱储寮曞灏戜釜鍓ф儏鏉＄洰锛堜紭鍏堣緝涔呰繙鐨勶級
  // 鐩稿叧搴﹂槇鍊硷紙0~1锛岃秺澶ц秺涓ユ牸锛?
  wiTriggerMinScore: 0.08,
  // 鏈€澶氭敞鍏ュ灏戜釜瑙﹀彂璇嶏紙鍘婚噸鍚庯級
  wiTriggerMaxKeywords: 24,
  // 娉ㄥ叆妯″紡锛歛ppendToUser = 杩藉姞鍒扮敤鎴锋秷鎭湯灏?
  wiTriggerInjectMode: 'appendToUser',
  // 娉ㄥ叆鏍峰紡锛歨idden=HTML 娉ㄩ噴闅愯棌锛沺lain=鐩存帴鏂囨湰锛堟洿绋筹級
  wiTriggerInjectStyle: 'hidden',
  wiTriggerTag: 'SG_WI_TRIGGERS',
  wiTriggerDebugLog: false,

  // ROLL 鍒ゅ畾锛堟湰鍥炲悎琛屽姩鍒ゅ畾锛?
  wiRollEnabled: false,
  wiRollStatSource: 'variable', // variable (缁煎悎澶氭潵婧? | template | latest
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

  // 钃濈伅绱㈠紩璇诲彇鏂瑰紡锛氶粯璁も€滃疄鏃惰鍙栬摑鐏笘鐣屼功鏂囦欢鈥?
  // - live锛氭瘡娆¤Е鍙戝墠浼氭寜闇€鎷夊彇钃濈伅涓栫晫涔︼紙甯︾紦瀛?鑺傛祦锛?
  // - cache锛氬彧浣跨敤瀵煎叆/缂撳瓨鐨?summaryBlueIndex
  wiBlueIndexMode: 'live',
  // 璇诲彇钃濈伅绱㈠紩鏃朵娇鐢ㄧ殑涓栫晫涔︽枃浠跺悕锛涚暀绌哄垯鍥為€€浣跨敤 summaryBlueWorldInfoFile
  wiBlueIndexFile: '',
  // 瀹炴椂璇诲彇鐨勬渶灏忓埛鏂伴棿闅旓紙绉掞級锛岄槻姝㈡瘡鏉℃秷鎭兘璇锋眰涓€娆?
  wiBlueIndexMinRefreshSec: 20,

  // 钃濈伅绱㈠紩缂撳瓨锛堝彲閫夛細鐢ㄤ簬妫€绱紱姣忔潯涓?{title, summary, keywords, range?}锛?
  summaryBlueIndex: [],

  // 妯″潡鑷畾涔夛紙JSON 瀛楃涓?+ 瑙ｆ瀽澶囦唤锛?
  modulesJson: '',
  // 棰濆鍙嚜瀹氫箟鎻愮ず璇嶁€滈鏋垛€?
  customSystemPreamble: '',     // 闄勫姞鍦ㄩ粯璁?system 涔嬪悗
  customConstraints: '',        // 闄勫姞鍦ㄩ粯璁?constraints 涔嬪悗

  // ===== 缁撴瀯鍖栦笘鐣屼功鏉＄洰锛堜汉鐗?瑁呭/鑳藉姏锛?=====
  structuredEntriesEnabled: true,
  characterEntriesEnabled: true,
  equipmentEntriesEnabled: true,
  abilityEntriesEnabled: false, // 榛樿鍏抽棴
  characterEntryPrefix: '浜虹墿',
  equipmentEntryPrefix: '瑁呭',
  abilityEntryPrefix: '鑳藉姏',
  structuredEntriesSystemPrompt: '',
  structuredEntriesUserTemplate: '',
  structuredCharacterPrompt: '',
  structuredEquipmentPrompt: '',
  structuredAbilityPrompt: '',

  // ===== 蹇嵎閫夐」鍔熻兘 =====
  quickOptionsEnabled: true,
  quickOptionsShowIn: 'inline', // inline | panel | both
  // 棰勮榛樿閫夐」锛圝SON 瀛楃涓诧級: [{label, prompt}]
  quickOptionsJson: JSON.stringify([
    { label: '缁х画', prompt: '缁х画褰撳墠鍓ф儏鍙戝睍' },
    { label: '璇﹁堪', prompt: '璇锋洿璇︾粏鍦版弿杩板綋鍓嶅満鏅? },
    { label: '瀵硅瘽', prompt: '璁╄鑹蹭箣闂村睍寮€鏇村瀵硅瘽' },
    { label: '琛屽姩', prompt: '鎻忚堪鎺ヤ笅鏉ョ殑鍏蜂綋琛屽姩' },
  ], null, 2),

  // ===== 鍦板浘鍔熻兘 =====
  mapEnabled: false,
  mapAutoUpdate: true,
  mapSystemPrompt: `浠庡璇濅腑鎻愬彇鍦扮偣淇℃伅锛屽苟灏介噺杩樺師绌洪棿鍏崇郴锛?
  1. 璇嗗埆褰撳墠涓昏鎵€鍦ㄧ殑鍦扮偣鍚嶇О
  2. 璇嗗埆鎻愬強鐨勬柊鍦扮偣
  3. 鍒ゆ柇鍦扮偣涔嬮棿鐨勮繛鎺ュ叧绯伙紙鍝簺鍦扮偣鐩搁偦/鍙€氳锛屾柟鍚戞劅濡傦細鍖?鍗?涓?瑗?妤间笂/妤间笅锛?
  4. 璁板綍璇ュ湴鐐瑰彂鐢熺殑閲嶈浜嬩欢锛堜簨浠剁敤涓€鍙ヨ瘽锛屽寘鍚Е鍙戞潯浠?褰卞搷锛?
  5. 鑻ユ枃鏈槑纭彁鍒扮浉瀵逛綅缃?妤煎眰/鏂逛綅锛岃缁欏嚭 row/col锛堢綉鏍煎潗鏍囷級鎴栫浉閭诲叧绯?
  6. 鍦ㄥ師钁椾笘鐣岃涓嬶紝缁撳悎璋锋瓕鎼滅储鐨勫師钁楄祫鏂欒ˉ鍏呪€滃緟鎺㈢储鍦扮偣鈥濓紝骞朵负姣忎釜鍦扮偣鍐欐槑鍙兘瑙﹀彂鐨勪换鍔?绠€浠?
  7. 寰呮帰绱㈠湴鐐规暟閲忎笉瓒呰繃 6 涓紝閬垮厤涓庡凡鏈夊湴鐐归噸澶嶏紱鑻ュ璇濅腑鍦扮偣杈冨皯锛岃嚦灏戣ˉ鍏?2 涓緟鎺㈢储鍦扮偣
  8. 鑻ユ棤娉曠粰鍑?row/col锛岃嚦灏戠粰鍑?connectedTo 鎴栨柟浣嶈瘝
  9. 娌℃湁鏄庣‘渚濇嵁鏃剁敤鈥滃緟纭鈥濇弿杩帮紝涓嶈涔辩寽
  10. 蹇呴』杈撳嚭 currentLocation/newLocations/events 涓変釜瀛楁锛屾暟缁勫彲涓虹┖浣嗗瓧娈靛繀椤诲瓨鍦紱newLocations 鎬绘暟涓嶅皯浜?3锛堝惈寰呮帰绱㈠湴鐐癸級
  11. 涓哄湴鐐硅ˉ鍏呭垎缁?鍥惧眰淇℃伅锛歡roup锛堝澶?瀹ゅ唴/妤煎眰鍖哄煙绛夛級锛宭ayer锛堝鈥滀竴灞?浜屽眰/鍦颁笅鈥濓級
  12. 浜嬩欢鍏佽闄勫甫 tags锛堝锛氭垬鏂?浠诲姟/瀵硅瘽/瑙ｈ皽/鎺㈢储锛夛紝姣忎釜浜嬩欢 1~3 涓爣绛?
  13. 閬垮厤鍚屼箟鍦扮偣閲嶅锛氳緭鍑哄墠鍏堝悎骞跺悓涔夎瘝锛堝 璞畢/瀹呴偢/搴滈偢/鍏锛涘鍥?瀛﹂櫌/瀛︽牎锛涘煄鍫?瑕佸/鐜嬪煄锛涘搴?绁炴/閬撹/鏁欏爞锛涙礊绌?娲炵獰锛涢仐杩?绉樺锛?
  14. 浠呬緷鎹璇?璁惧畾/鍘熻憲淇℃伅杩涜鎺ㄦ柇锛屼笉瑕佸紩鍏ユ棤鏍规嵁鐨勪俊鎭?
  
  杈撳嚭 JSON 鏍煎紡锛?
  {
    "currentLocation": "涓昏褰撳墠鎵€鍦ㄥ湴鐐?,
    "newLocations": [
      { "name": "鍦扮偣鍚?, "description": "绠€杩?, "connectedTo": ["鐩搁偦鍦扮偣1"], "row": 0, "col": 0, "group": "瀹ゅ", "layer": "涓€灞? }
    ],
    "events": [
      { "location": "鍦扮偣鍚?, "event": "浜嬩欢鎻忚堪", "tags": ["浠诲姟"] }
    ]
  }`,

  // ===== 鍥惧儚鐢熸垚妯″潡 =====
  imageGenEnabled: false,
  novelaiApiKey: '',
  novelaiModel: 'nai-diffusion-4-5-full', // V4.5 Full | V4 Full | V4 Curated | V3
  novelaiResolution: '832x1216', // 榛樿绔嬬粯灏哄
  novelaiSteps: 28,
  novelaiScale: 5,
  novelaiSampler: 'k_euler',
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
  imageGenSystemPrompt: `You are a NovelAI Danbooru tag generator. Produce dense, concrete prompt tags from the story content.

Rules:
1. Output JSON only, no extra text.
2. Tags are English, comma-separated; important tags may be weighted like (tag:1.2).
3. Character images must include: headcount/sex, hair style/color, eye color, age feel, body type, outfit details, expression, pose, camera angle/composition, lighting, background elements.
4. Scene images must include: scene type, time/weather/season, lighting, architecture/props, atmosphere, color palette, camera angle/composition.
5. Provide 40-80 positive tags, ordered by importance.
6. Negative tags should cover common failures (hands/face/anatomy/noise/watermark/etc.).
7. If details are missing, prefer filling scene/composition/lighting/mood rather than inventing specific character traits.

Output format:
{
  "type": "character" or "scene",
  "subject": "short subject",
  "positive": "tag1, tag2, ...",
  "negative": "tagA, tagB, ..."
}`,

  // 鍦ㄧ嚎鍥惧簱璁剧疆
  imageGalleryEnabled: false,
  imageGalleryUrl: '',
  imageGalleryCache: [],
  imageGalleryCacheTime: 0,
  imageGalleryMatchPrompt: '浣犳槸鍥剧墖閫夋嫨鍔╂墜銆傛牴鎹晠浜嬪唴瀹癸紝浠庡浘搴撲腑閫夋嫨鏈€鍚堥€傜殑鍥剧墖銆傝鍒欙細1.浼樺厛鍖归厤瑙掕壊鍚嶇О 2.鍏舵鍖归厤鍦烘櫙绫诲瀷 3.鍐嶅尮閰嶆儏缁?姘涘洿銆傝緭鍑篔SON锛歿"matchedId":"鍥剧墖id","reason":"鍖归厤鍘熷洜"}',

  // 鍥惧儚鐢熸垚涓栫晫涔︼紙瑙掕壊鏍囩搴擄級
  imageGenWorldBookEnabled: false,
  imageGenWorldBookFile: '',
  imageGenWorldBookCache: [],
});

const META_KEYS = Object.freeze({
  canon: 'storyguide_canon_outline',
  world: 'storyguide_world_setup',
  summaryMeta: 'storyguide_summary_meta',
  staticModulesCache: 'storyguide_static_modules_cache',
  boundGreenWI: 'storyguide_bound_green_wi',
  boundBlueWI: 'storyguide_bound_blue_wi',
  autoBindCreated: 'storyguide_auto_bind_created',
  mapData: 'storyguide_map_data',
});

let lastReport = null;
let lastJsonText = '';
let lastSummary = null; // { title, summary, keywords, ... }
let lastSummaryText = '';
let refreshTimer = null;
let appendTimer = null;
let summaryTimer = null;
let isSummarizing = false;
let summaryCancelled = false;
let sgToastTimer = null;

// 钃濈伅绱㈠紩鈥滃疄鏃惰鍙栤€濈紦瀛橈紙闃叉姣忔潯娑堟伅閮借姹備竴娆★級
let blueIndexLiveCache = { file: '', loadedAt: 0, entries: [], lastError: '' };

// ============== 鍏抽敭锛欴OM 杩藉姞缂撳瓨 & 瑙傚療鑰咃紙鎶楅噸娓叉煋锛?==============
/**
 * inlineCache: Map<mesKey, { htmlInner: string, collapsed: boolean, createdAt: number }>
 * mesKey 浼樺厛鐢?DOM 鐨?mesid锛堝鏋滄嬁涓嶅埌鍒欑敤 chatIndex锛?
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
    // 鍒濆鍐欏叆榛樿 modulesJson
    extensionSettings[MODULE_NAME].modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);
    saveSettingsDebounced();
  } else {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (!Object.hasOwn(extensionSettings[MODULE_NAME], k)) extensionSettings[MODULE_NAME][k] = DEFAULT_SETTINGS[k];
    }
    // 鍏煎鏃х増锛氳嫢 modulesJson 涓虹┖锛岃ˉ榛樿
    if (!extensionSettings[MODULE_NAME].modulesJson) {
      extensionSettings[MODULE_NAME].modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);
    }
  }
  if (typeof extensionSettings[MODULE_NAME].wiRollSystemPrompt === 'string') {
    const cur = extensionSettings[MODULE_NAME].wiRollSystemPrompt;
    const hasMojibake = /\?{5,}/.test(cur);
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
  // 杩佺Щ锛氬垹闄や簡 chatbook 閫夐」锛屽己鍒朵娇鐢?file 妯″紡
  if (extensionSettings[MODULE_NAME].summaryWorldInfoTarget === 'chatbook') {
    extensionSettings[MODULE_NAME].summaryWorldInfoTarget = 'file';
    saveSettingsDebounced();
  }
  // 杩佺Щ锛氳摑鐏笘鐣屼功榛樿寮€鍚?
  if (extensionSettings[MODULE_NAME].summaryToBlueWorldInfo === false) {
    extensionSettings[MODULE_NAME].summaryToBlueWorldInfo = true;
    saveSettingsDebounced();
  }
  return extensionSettings[MODULE_NAME];
}

function saveSettings() { SillyTavern.getContext().saveSettingsDebounced(); }

// 瀵煎嚭鍏ㄥ眬棰勮
function exportPreset() {
  const s = ensureSettings();
  const preset = {
    _type: 'StoryGuide_Preset',
    _version: '1.0',
    _exportedAt: new Date().toISOString(),
    settings: { ...s }
  };
  // 绉婚櫎鏁忔劅淇℃伅锛圓PI Key锛?
  delete preset.settings.customApiKey;
  delete preset.settings.summaryCustomApiKey;
  delete preset.settings.wiIndexCustomApiKey;
  delete preset.settings.wiRollCustomApiKey;
  // 绉婚櫎缂撳瓨鏁版嵁
  delete preset.settings.customModelsCache;
  delete preset.settings.summaryCustomModelsCache;
  delete preset.settings.wiIndexCustomModelsCache;
  delete preset.settings.wiRollCustomModelsCache;

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

  showToast('棰勮宸插鍑?鉁?, { kind: 'ok' });
}

// 瀵煎叆鍏ㄥ眬棰勮
async function importPreset(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const preset = JSON.parse(text);

    // 楠岃瘉鏍煎紡
    if (preset._type !== 'StoryGuide_Preset') {
      showToast('鏃犳晥鐨勯璁炬枃浠舵牸寮?, { kind: 'err' });
      return;
    }

    if (!preset.settings || typeof preset.settings !== 'object') {
      showToast('棰勮鏂囦欢鍐呭鏃犳晥', { kind: 'err' });
      return;
    }

    // 鑾峰彇褰撳墠璁剧疆骞朵繚鐣欐晱鎰熶俊鎭?
    const currentSettings = ensureSettings();
    const preservedKeys = [
      'customApiKey', 'summaryCustomApiKey', 'wiIndexCustomApiKey', 'wiRollCustomApiKey',
      'customModelsCache', 'summaryCustomModelsCache', 'wiIndexCustomModelsCache', 'wiRollCustomModelsCache'
    ];

    // 鍚堝苟璁剧疆锛堜繚鐣欐晱鎰熶俊鎭級
    const newSettings = { ...preset.settings };
    for (const key of preservedKeys) {
      if (currentSettings[key]) {
        newSettings[key] = currentSettings[key];
      }
    }

    // 搴旂敤鏂拌缃?
    const { extensionSettings } = SillyTavern.getContext();
    Object.assign(extensionSettings[MODULE_NAME], newSettings);
    saveSettings();

    // 鍒锋柊 UI
    pullSettingsToUi();

    showToast(`棰勮宸插鍏?鉁匼n鐗堟湰: ${preset._version || '鏈煡'}\n瀵煎嚭鏃堕棿: ${preset._exportedAt || '鏈煡'}`, { kind: 'ok', duration: 3000 });
  } catch (e) {
    console.error('[StoryGuide] Import preset failed:', e);
    showToast(`瀵煎叆澶辫触: ${e.message}`, { kind: 'err' });
  }
}

function stripHtml(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]*>/g, '').replace(/\s+\n/g, '\n').trim();
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

// 绠€鏄撴ā鏉挎浛鎹細鏀寔 {{fromFloor}} / {{toFloor}} / {{chunk}} 绛夊崰浣嶇
function renderTemplate(tpl, vars = {}) {
  const str = String(tpl ?? '');
  return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
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

function normalizeMapName(name) {
  let out = String(name || '').replace(/\s+/g, ' ').trim();
  // common CN place variants (reduce duplicates like "璞畢/瀹呴偢/搴滈偢/鍏")
  out = out.replace(/(瀹秥瀹?(璞畢|瀹呴偢|搴滈偢|鍏|鍒|搴勫洯|澶у畢|搴渱瀹厊瀹呭瓙)$/g, '瀹呴偢');
  out = out.replace(/(璞畢|搴滈偢|鍏|鍒|搴勫洯|澶у畢|搴渱瀹厊瀹呭瓙)$/g, '瀹呴偢');
  out = out.replace(/瀹呴偢$/g, '瀹呴偢');
  // broader suffix normalization
  const rules = [
    [/瀛︽牎$/g, '瀛︽牎'],
    [/瀛﹀洯$/g, '瀛︽牎'],
    [/瀛﹂櫌$/g, '瀛︽牎'],
    [/澶у$/g, '瀛︽牎'],
    [/澶фˉ$/g, '妗?],
    [/妗ユ$/g, '妗?],
    [/妗?/g, '妗?],
    [/澶ч亾$/g, '璺?],
    [/澶ц$/g, '琛?],
    [/琛楅亾$/g, '琛?],
    [/琛?/g, '琛?],
    [/鍟嗕笟琛楀尯$/g, '鍟嗕笟琛?],
    [/鍟嗕笟琛?/g, '鍟嗕笟琛?],
    [/姝ヨ琛?/g, '鍟嗕笟琛?],
    [/璐墿涓績$/g, '鍟嗗満'],
    [/鍟嗗煄$/g, '鍟嗗満'],
    [/鍟嗗満$/g, '鍟嗗満'],
    [/鍟嗕笟鍖?/g, '鍟嗕笟鍖?],
    [/骞垮満$/g, '骞垮満'],
    [/鍏洯$/g, '鍏洯'],
    [/鍥尯$/g, '鍏洯'],
    [/浣撹偛棣?/g, '浣撹偛棣?],
    [/杩愬姩棣?/g, '浣撹偛棣?],
    [/浣撹偛涓績$/g, '浣撹偛棣?],
    [/鍥句功棣?/g, '鍥句功棣?],
    [/闃呰瀹?/g, '鍥句功棣?],
    [/鍖婚櫌$/g, '鍖婚櫌'],
    [/璇婃墍$/g, '鍖婚櫌'],
    [/杞︾珯$/g, '杞︾珯'],
    [/绔欑偣$/g, '杞︾珯'],
    [/鍦伴搧绔?/g, '鍦伴搧绔?],
    [/鍦伴搧鍙?/g, '鍦伴搧绔?],
    [/鏈哄満$/g, '鏈哄満'],
    [/娓彛$/g, '娓彛'],
    [/鐮佸ご$/g, '娓彛'],
    [/鏃呴$/g, '鏃呴'],
    [/閰掑簵$/g, '鏃呴'],
    [/瀹鹃$/g, '鏃呴'],
    [/澶у帵$/g, '澶фゼ'],
    [/澶фゼ$/g, '澶фゼ'],
    [/妤煎畤$/g, '澶фゼ'],
    [/妤兼爧$/g, '澶фゼ'],
    [/涓績$/g, '涓績'],
    [/妫灄$/g, '妫灄'],
    [/鏋楀湴$/g, '妫灄'],
    [/鏍戞灄$/g, '妫灄'],
    [/灞辫剦$/g, '灞?],
    [/楂樺湴$/g, '灞?],
    [/娌虫祦$/g, '娌?],
    [/娌?/g, '娌?],
    [/婀栨硦$/g, '婀?],
    [/婀?/g, '婀?],
    [/娴峰哺$/g, '娴疯竟'],
    [/娴锋哗$/g, '娴疯竟'],
    [/娴疯竟$/g, '娴疯竟'],
    [/鍦颁笅瀹?/g, '鍦颁笅'],
    [/鍦板簳$/g, '鍦颁笅'],
    [/鍦颁笅$/g, '鍦颁笅'],
    // fantasy/setting-specific systems
    [/瀹$/g, '鍩庡牎'],
    [/鐜嬪煄$/g, '鍩庡牎'],
    [/鍩庡牎$/g, '鍩庡牎'],
    [/瑕佸$/g, '鍩庡牎'],
    [/鍩庨偊$/g, '鍩庡牎'],
    [/鍫″瀿$/g, '鍩庡牎'],
    [/绁炴$/g, '瀵哄簷'],
    [/瀵哄簷$/g, '瀵哄簷'],
    [/閬撹$/g, '瀵哄簷'],
    [/鏁欏爞$/g, '瀵哄簷'],
    [/澶ф暀鍫?/g, '瀵哄簷'],
    [/淇亾闄?/g, '瀵哄簷'],
    [/娲炵┐$/g, '娲炵┐'],
    [/娲炵獰$/g, '娲炵┐'],
    [/閬楄抗$/g, '閬楄抗'],
    [/绉樺$/g, '閬楄抗'],
    [/绉樺涔嬮棬$/g, '閬楄抗'],
    [/閬楀潃$/g, '閬楄抗'],
    [/闂ㄦ淳$/g, '瀹楅棬'],
    [/瀹楅棬$/g, '瀹楅棬'],
    [/甯細$/g, '瀹楅棬'],
    [/闂ㄦ淳椹诲湴$/g, '瀹楅棬'],
    [/瀹楅棬椹诲湴$/g, '瀹楅棬'],
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
    if (name) headerBits.push(`< span class= "sg-map-event-title" > ${escapeHtml(name)}</span > `);
    if (layer) headerBits.push(`< span class= "sg-map-event-chip" > ${escapeHtml(layer)}</span > `);
    if (group) headerBits.push(`< span class= "sg-map-event-chip" > ${escapeHtml(group)}</span > `);
    const header = headerBits.length ? `< div class= "sg-map-event-header" > ${headerBits.join('')}</div > ` : '';
    const descHtml = desc ? `< div class= "sg-map-event-desc" > ${escapeHtml(desc)}</div > ` : '';

    let listHtml = '';
    if (events.length) {
      const items = events.map((ev) => {
        const text = escapeHtml(String(ev?.text || ev?.event || ev || '').trim());
        const tags = Array.isArray(ev?.tags) ? ev.tags : [];
        const tagsHtml = tags.length
          ? `< span class= "sg-map-event-tags" > ${tags.map(t => `<span class="sg-map-event-tag">${escapeHtml(String(t || ''))}</span>`).join('')}</span > `
          : '';
        return `< li > <span class="sg-map-event-text">${text || '锛堟棤鍐呭锛?}</span>${tagsHtml}</li > `;
      }).join('');
      listHtml = `< ul class= "sg-map-event-list" > ${items}</ul > `;
    } else {
      listHtml = '<div class="sg-map-event-empty">鏆傛棤浜嬩欢</div>';
    }

    const deleteBtn = name
      ? `< button class= "sg-map-event-delete" data - name="${escapeHtml(name)}" > 鍒犻櫎鍦扮偣</button > `
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
  if (name) parts.push(`< div class= "sg-map-popover-title" > ${escapeHtml(name)}</div > `);
  if (desc) parts.push(`< div class= "sg-map-popover-desc" > ${escapeHtml(desc)}</div > `);
  if (events.length) {
    const items = events.map(e => `< li > ${escapeHtml(String(e || ''))}</li > `).join('');
    parts.push(`< div class="sg-map-popover-events" ><div class="sg-map-popover-label">浜嬩欢</div><ul>${items}</ul></div > `);
  } else {
    parts.push('<div class="sg-map-popover-empty">鏆傛棤浜嬩欢</div>');
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

// ===== 蹇嵎閫夐」鍔熻兘 =====

function getQuickOptions() {
  const s = ensureSettings();
  if (!s.quickOptionsEnabled) return [];

  const raw = String(s.quickOptionsJson || '').trim();
  if (!raw) return [];

  try {
    let arr = JSON.parse(raw);
    // 鏀寔 [[label, prompt], ...] 鍜?[{label, prompt}, ...] 涓ょ鏍煎紡
    if (!Array.isArray(arr)) return [];
    return arr.map((item, i) => {
      if (Array.isArray(item)) {
        return { label: String(item[0] || `閫夐」${i + 1} `), prompt: String(item[1] || '') };
      }
      if (item && typeof item === 'object') {
        return { label: String(item.label || `閫夐」${i + 1} `), prompt: String(item.prompt || '') };
      }
      return null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function injectToUserInput(text) {
  // 灏濊瘯澶氱鍙兘鐨勮緭鍏ユ閫夋嫨鍣?
  const selectors = ['#send_textarea', 'textarea#send_textarea', '.send_textarea', 'textarea.send_textarea'];
  let textarea = null;

  for (const sel of selectors) {
    textarea = document.querySelector(sel);
    if (textarea) break;
  }

  if (!textarea) {
    console.warn('[StoryGuide] 鏈壘鍒拌亰澶╄緭鍏ユ');
    return false;
  }

  // 璁剧疆鏂囨湰鍊?
  textarea.value = String(text || '');

  // 瑙﹀彂 input 浜嬩欢浠ラ€氱煡 SillyTavern
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // 鑱氱劍杈撳叆妗?
  textarea.focus();

  // 灏嗗厜鏍囩Щ鍒版湯灏?
  if (textarea.setSelectionRange) {
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  return true;
}

function renderQuickOptionsHtml(context = 'inline') {
  const s = ensureSettings();
  if (!s.quickOptionsEnabled) return '';

  const showIn = String(s.quickOptionsShowIn || 'inline');
  // 妫€鏌ュ綋鍓嶄笂涓嬫枃鏄惁搴旇鏄剧ず
  if (showIn !== 'both' && showIn !== context) return '';

  const options = getQuickOptions();
  if (!options.length) return '';

  const buttons = options.map((opt, i) => {
    const label = escapeHtml(opt.label || `閫夐」${i + 1} `);
    const prompt = escapeHtml(opt.prompt || '');
    return `< button class="sg-quick-option" data - sg - prompt="${prompt}" title = "${prompt}" > ${label}</button > `;
  }).join('');

  return `< div class="sg-quick-options" > ${buttons}</div > `;
}

// 娓叉煋AI鐢熸垚鐨勫姩鎬佸揩鎹烽€夐」锛堜粠鍒嗘瀽缁撴灉鐨剄uick_actions鏁扮粍鐢熸垚鎸夐挳锛岀洿鎺ユ樉绀洪€夐」鍐呭锛?
function renderDynamicQuickActionsHtml(quickActions, context = 'inline') {
  const s = ensureSettings();

  // 濡傛灉娌℃湁鍔ㄦ€侀€夐」锛岃繑鍥炵┖
  if (!Array.isArray(quickActions) || !quickActions.length) {
    return '';
  }

  const buttons = quickActions.map((action, i) => {
    const text = String(action || '').trim();
    if (!text) return '';

    // 绉婚櫎鍙兘鐨勭紪鍙峰墠缂€濡?"銆?銆? 鎴?"1."
    const cleaned = text.replace(/^銆怽d+銆慭s*/, '').replace(/^\d+[\.\)\:锛歖\s*/, '').trim();
    if (!cleaned) return '';

    const escapedText = escapeHtml(cleaned);
    // 鎸夐挳鐩存帴鏄剧ず瀹屾暣閫夐」鍐呭锛岀偣鍑诲悗杈撳叆鍒拌亰澶╂
    return `< button class="sg-quick-option sg-dynamic-option" data - sg - prompt="${escapedText}" title = "鐐瑰嚮杈撳叆鍒拌亰澶╂" > ${escapedText}</button > `;
  }).filter(Boolean).join('');

  if (!buttons) return '';

  return `< div class="sg-quick-options sg-dynamic-options" >
  <div class="sg-quick-options-title">馃挕 蹇嵎閫夐」锛堢偣鍑昏緭鍏ワ級</div>
    ${buttons}
  </div > `;
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
    // 鐢ㄤ簬鈥滅储寮曠紪鍙疯Е鍙戔€濓紙A-001/A-002鈥︼級鐨勯€掑璁℃暟鍣紙鎸夎亰澶╁瓨鍌級
    nextIndex: 1,
    history: [], // [{title, summary, keywords, createdAt, range:{fromFloor,toFloor,fromIdx,toIdx}, worldInfo:{file,uid}}]
    wiTriggerLogs: [], // [{ts,userText,picked:[{title,score,keywordsPreview}], injectedKeywords, lookback, style, tag}]
    rollLogs: [], // [{ts, action, summary, final, success, userText}]
    // 缁撴瀯鍖栨潯鐩紦瀛橈紙鐢ㄤ簬鍘婚噸涓庢洿鏂?- 鏂规C娣峰悎绛栫暐锛?
    characterEntries: {}, // { uid: { name, aliases, lastUpdated, wiEntryUid, content } }
    equipmentEntries: {}, // { uid: { name, aliases, lastUpdated, wiEntryUid, content } }
    abilityEntries: {}, // { uid: { name, lastUpdated, wiEntryUid, content } }
    nextCharacterIndex: 1, // NPC-001, NPC-002...
    nextEquipmentIndex: 1, // EQP-001, EQP-002...
    nextAbilityIndex: 1, // ABL-001, ABL-002...
  };
}

function getSummaryMeta() {
  const raw = String(getChatMetaValue(META_KEYS.summaryMeta) || '').trim();
  if (!raw) return getDefaultSummaryMeta();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return getDefaultSummaryMeta();
    return {
      ...getDefaultSummaryMeta(),
      ...data,
      history: Array.isArray(data.history) ? data.history : [],
      wiTriggerLogs: Array.isArray(data.wiTriggerLogs) ? data.wiTriggerLogs : [],
      rollLogs: Array.isArray(data.rollLogs) ? data.rollLogs : [],
    };
  } catch {
    return getDefaultSummaryMeta();
  }
}

async function setSummaryMeta(meta) {
  await setChatMetaValue(META_KEYS.summaryMeta, JSON.stringify(meta ?? getDefaultSummaryMeta()));
}

// ===== 闈欐€佹ā鍧楃紦瀛橈紙鍙湪棣栨鎴栨墜鍔ㄥ埛鏂版椂鐢熸垚鐨勬ā鍧楃粨鏋滐級=====
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

// ===== 鍦板浘鏁版嵁锛堢綉鏍煎湴鍥惧姛鑳斤級=====
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

// 鏇存柊鍦板浘棰勮
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

const MAP_JSON_REQUIREMENT = `杈撳嚭瑕佹眰锛?
- 鍙緭鍑轰弗鏍?JSON锛屼笉瑕?Markdown銆佷笉瑕佷唬鐮佸潡銆佷笉瑕佷换浣曞浣欐枃瀛椼€俙;

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
  sys = sys + '\n\n' + MAP_JSON_REQUIREMENT;
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

// 鍚堝苟闈欐€佹ā鍧楃紦瀛樺埌鍒嗘瀽缁撴灉涓?
function mergeStaticModulesIntoResult(parsedJson, modules) {
  const cache = getStaticModulesCache();
  const result = { ...parsedJson };

  for (const m of modules) {
    if (m.static && cache[m.key] !== undefined) {
      // 浣跨敤缂撳瓨鍊兼浛浠ｏ紙濡傛灉AI姝ゆ娌＄敓鎴愭垨鎴戜滑璺宠繃浜嗙敓鎴愶級
      if (result[m.key] === undefined || result[m.key] === null || result[m.key] === '') {
        result[m.key] = cache[m.key];
      }
    }
  }

  return result;
}

// 鏇存柊闈欐€佹ā鍧楃紦瀛?
async function updateStaticModulesCache(parsedJson, modules) {
  const cache = getStaticModulesCache();
  let changed = false;

  for (const m of modules) {
    if (m.static && parsedJson[m.key] !== undefined && parsedJson[m.key] !== null && parsedJson[m.key] !== '') {
      // 鍙湪棣栨鐢熸垚鎴栧€兼湁鍙樺寲鏃舵洿鏂扮紦瀛?
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

// ===== 鍦板浘鍔熻兘锛氭彁鍙栧拰娓叉煋 =====

// 浠?LLM 鍝嶅簲涓彁鍙栧湴鍥炬暟鎹?
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
    if (desc.includes('寰呮帰绱?)) exploreCount += 1;
  }

  const desiredMin = 3;
  const desiredExploreMin = 2;
  const neededTotal = Math.max(0, desiredMin - out.newLocations.length);
  const neededExplore = Math.max(0, desiredExploreMin - exploreCount);
  const addCount = Math.max(neededTotal, neededExplore);

  if (addCount > 0) {
    const baseName = out.currentLocation ? `${out.currentLocation}路寰呮帰绱 : '寰呮帰绱㈠湴鐐?;
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
        description: '寰呮帰绱?,
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


// 鍚堝苟鏂板湴鍥炬暟鎹埌鐜版湁鍦板浘
function mergeMapData(existingMap, newData) {
  if (!newData) return existingMap;

  const map = { ...existingMap, locations: { ...existingMap.locations } };
  const existingNameMap = new Map();
  for (const key of Object.keys(map.locations)) {
    const norm = normalizeMapName(key);
    if (norm) existingNameMap.set(norm, key);
  }

  // 鏇存柊涓昏浣嶇疆
  if (newData.currentLocation) {
    const normalized = normalizeMapName(newData.currentLocation);
    const existingKey = existingNameMap.get(normalized);
    map.protagonistLocation = existingKey || newData.currentLocation;
    // 纭繚褰撳墠浣嶇疆瀛樺湪
    if (!map.locations[map.protagonistLocation]) {
      map.locations[map.protagonistLocation] = {
        row: 0, col: 0, connections: [], events: [], visited: true, description: ''
      };
    }
    map.locations[map.protagonistLocation].visited = true;
  }

  // 娣诲姞鏂板湴鐐?
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
      // 鏇存柊鐜版湁鍦扮偣鐨勮繛鎺?
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

  // 娣诲姞浜嬩欢
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

  // 鏇存柊鍙屽悜杩炴帴
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

// 瀵绘壘缃戞牸涓殑涓嬩竴涓┖浣?
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
  // 鎵╁睍缃戞牸
  map.gridSize.rows++;
  return { row: map.gridSize.rows - 1, col: 0 };
}

// 娓叉煋缃戞牸鍦板浘涓?HTML锛堢函 HTML/CSS 缃戞牸锛?
function renderGridMap(mapData) {
  if (!mapData || Object.keys(mapData.locations).length === 0) {
    return `< div class="sg-map-empty" > 鏆傛棤鍦板浘鏁版嵁銆傚紑鍚湴鍥惧姛鑳藉苟杩涜鍓ф儏鍒嗘瀽鍚庯紝鍦板浘灏嗚嚜鍔ㄧ敓鎴愩€?/div > `;
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

  // 濉厖缃戞牸
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

  // 娓叉煋 HTML锛堜娇鐢?CSS Grid锛?
  const gridInlineStyle = `display: grid; grid - template - columns: repeat(${cols}, 80px); grid - auto - rows: 50px; gap: 4px; justify - content: center; `;
  const baseCellStyle = 'width:80px;height:50px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;text-align:center;position:relative;';
  const emptyCellStyle = baseCellStyle + 'background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.08);';
  const locationBaseStyle = baseCellStyle + 'background:rgba(100,150,200,0.2);border:1px solid rgba(100,150,200,0.35);';

  let html = `< div class="sg-map-wrapper" > `;
  html += `< div class="sg-map-grid" style = "--sg-map-cols:${cols};${gridInlineStyle}" > `;

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

        const eventList = hasEvents ? cell.events.map(e => `鈥?${formatMapEventText(e)} `).join('\n') : '';
        const tooltip = `${cell.name}${cell.description ? '\n' + cell.description : ''}${eventList ? '\n---\n' + eventList : ''} `;

        let inlineStyle = locationBaseStyle;
        if (isProtagonist) inlineStyle += 'background:rgba(100,200,100,0.25);border-color:rgba(100,200,100,0.5);box-shadow:0 0 8px rgba(100,200,100,0.3);';
        if (hasEvents) inlineStyle += 'border-color:rgba(255,180,80,0.5);';
        if (!cell.visited) inlineStyle += 'background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);opacity:0.6;';
        const eventsJson = escapeHtml(JSON.stringify(Array.isArray(cell.events) ? cell.events : []));
        const descAttr = escapeHtml(String(cell.description || ''));
        const nameAttr = escapeHtml(String(cell.name || ''));
        const groupAttr = escapeHtml(String(cell.group || ''));
        const layerAttr = escapeHtml(String(cell.layer || ''));
        html += `< div class="${classes.join(' ')}" style = "${inlineStyle}" title = "${escapeHtml(tooltip)}" data - name="${nameAttr}" data - desc="${descAttr}" data - events="${eventsJson}" data - group="${groupAttr}" data - layer="${layerAttr}" > `;
        if (cell.layer || cell.group) {
          html += `< div class="sg-map-badges" > `;
          if (cell.layer) html += `< span class="sg-map-badge sg-map-badge-layer" title = "${escapeHtml(String(cell.layer))}" > ${escapeHtml(String(cell.layer || '').slice(0, 2))}</span > `;
          if (cell.group) html += `< span class="sg-map-badge sg-map-badge-group" title = "${escapeHtml(String(cell.group))}" > ${escapeHtml(String(cell.group || '').slice(0, 2))}</span > `;
          html += `</div > `;
        }
        html += `< span class="sg-map-name" > ${escapeHtml(cell.name)}</span > `;
        if (isProtagonist) html += '<span class="sg-map-marker">鈽?/span>';
        if (hasEvents) html += '<span class="sg-map-event-marker">鈿?/span>';
        html += '</div>';
      } else {
        html += `< div class="sg-map-cell sg-map-empty-cell" style = "${emptyCellStyle}" ></div > `;
      }
    }
  }

  html += '</div>';
  html += '<div class="sg-map-legend">鈽?涓昏浣嶇疆 | 鈿?鏈変簨浠?| 鐏拌壊 = 鏈帰绱?/div>';
  html += '<div class="sg-map-event-panel">鐐瑰嚮鍦扮偣鏌ョ湅浜嬩欢鍒楄〃</div>';
  html += '</div>';

  return html;
}

// 娓呴櫎闈欐€佹ā鍧楃紦瀛橈紙鎵嬪姩鍒锋柊鏃朵娇鐢級
async function clearStaticModulesCache() {
  await setStaticModulesCache({});
}

// 娓呴櫎缁撴瀯鍖栨潯鐩紦瀛橈紙浜虹墿/瑁呭/鑳藉姏锛?
async function clearStructuredEntriesCache() {
  const meta = getSummaryMeta();
  meta.characterEntries = {};
  meta.equipmentEntries = {};
  meta.abilityEntries = {};
  meta.nextCharacterIndex = 1;
  meta.nextEquipmentIndex = 1;
  meta.nextAbilityIndex = 1;
  await setSummaryMeta(meta);
}

// -------------------- 鑷姩缁戝畾涓栫晫涔︼紙姣忎釜鑱婂ぉ涓撳睘涓栫晫涔︼級 --------------------
// 鐢熸垚鍞竴鐨勪笘鐣屼功鏂囦欢鍚?
function generateBoundWorldInfoName(type) {
  const ctx = SillyTavern.getContext();
  const charName = String(ctx.characterId || ctx.name2 || ctx.name || 'UnknownChar')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '')
    .slice(0, 20);
  const ts = Date.now().toString(36);
  const prefix = ensureSettings().autoBindWorldInfoPrefix || 'SG';
  return `${prefix}_${charName}_${ts}_${type} `;
}

// 妫€鏌ュ苟纭繚褰撳墠鑱婂ぉ鍚敤浜嗚嚜鍔ㄧ粦瀹氾紙浣跨敤 chatbook 妯″紡锛?
async function ensureBoundWorldInfo(opts = {}) {
  const s = ensureSettings();
  if (!s.autoBindWorldInfo) return false;

  const alreadyApplied = !!getChatMetaValue(META_KEYS.autoBindCreated);

  // 濡傛灉宸茬粡搴旂敤杩囷紝鍙渶閲嶆柊搴旂敤璁剧疆
  if (alreadyApplied) {
    await applyBoundWorldInfoToSettings();
    return false;
  }

  // 棣栨鍚敤锛氳缃爣璁板苟搴旂敤
  await setChatMetaValue(META_KEYS.autoBindCreated, '1');

  // 鏄剧ず鐢ㄦ埛鎻愮ず
  showToast(`宸插惎鐢ㄨ嚜鍔ㄥ啓鍏ヤ笘鐣屼功\n缁跨伅鎬荤粨灏嗗啓鍏ヨ亰澶╃粦瀹氱殑涓栫晫涔n锛堢敱 SillyTavern 鑷姩鍒涘缓鍜岀鐞嗭級`, {
    kind: 'ok', spinner: false, sticky: false, duration: 3500
  });

  // 搴旂敤璁剧疆
  await applyBoundWorldInfoToSettings();
  return true;
}

// 鍒涘缓涓栫晫涔︽枃浠讹紙閫氳繃澶氱鏂规硶灏濊瘯锛?
async function createWorldInfoFile(fileName, initialContent = '鍒濆鍖栨潯鐩?) {
  if (!fileName) throw new Error('鏂囦欢鍚嶄负绌?);

  console.log('[StoryGuide] 灏濊瘯鍒涘缓涓栫晫涔︽枃浠?', fileName);

  // 鏂规硶1: 灏濊瘯浣跨敤 SillyTavern 鍐呴儴鐨?world_info 妯″潡
  try {
    const worldInfoModule = await import('/scripts/world-info.js');
    if (worldInfoModule && typeof worldInfoModule.createNewWorldInfo === 'function') {
      await worldInfoModule.createNewWorldInfo(fileName);
      console.log('[StoryGuide] 浣跨敤鍐呴儴妯″潡鍒涘缓鎴愬姛:', fileName);
      return true;
    }
  } catch (e) {
    console.log('[StoryGuide] 鍐呴儴妯″潡鏂规硶澶辫触:', e?.message || e);
  }

  // 鏂规硶2: 灏濊瘯浣跨敤瀵煎叆 API (妯℃嫙鏂囦欢涓婁紶)
  try {
    const headers = getStRequestHeadersCompat();
    const worldInfoData = {
      entries: {
        0: {
          uid: 0,
          key: ['__SG_INIT__'],
          keysecondary: [],
          comment: '鐢?StoryGuide 鑷姩鍒涘缓',
          content: initialContent,
          constant: false,
          disable: false,
          order: 100,
          position: 0,
        }
      }
    };

    // 鍒涘缓涓€涓?Blob 浣滀负 JSON 鏂囦欢
    const blob = new Blob([JSON.stringify(worldInfoData)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('avatar', blob, `${fileName}.json`);

    const res = await fetch('/api/worldinfo/import', {
      method: 'POST',
      headers: { ...headers },
      body: formData,
    });

    if (res.ok) {
      console.log('[StoryGuide] 浣跨敤瀵煎叆 API 鍒涘缓鎴愬姛:', fileName);
      return true;
    }
    console.log('[StoryGuide] 瀵煎叆 API 鍝嶅簲:', res.status);
  } catch (e) {
    console.log('[StoryGuide] 瀵煎叆 API 鏂规硶澶辫触:', e?.message || e);
  }

  // 鏂规硶3: 灏濊瘯鐩存帴 POST 鍒?/api/worldinfo/edit (缂栬緫/鍒涘缓)
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getStRequestHeadersCompat(),
    };

    const res = await fetch('/api/worldinfo/edit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: fileName,
        data: {
          entries: {
            0: {
              uid: 0,
              key: ['__SG_INIT__'],
              content: initialContent,
              comment: '鐢?StoryGuide 鑷姩鍒涘缓',
            }
          }
        }
      }),
    });

    if (res.ok) {
      console.log('[StoryGuide] 浣跨敤 edit API 鍒涘缓鎴愬姛:', fileName);
      return true;
    }
    console.log('[StoryGuide] edit API 鍝嶅簲:', res.status);
  } catch (e) {
    console.log('[StoryGuide] edit API 鏂规硶澶辫触:', e?.message || e);
  }

  // 鏂规硶4: 鏈€鍚庡皾璇?STscript (鍙兘闇€瑕佹枃浠跺凡瀛樺湪)
  try {
    const safeFileName = quoteSlashValue(fileName);
    const safeKey = quoteSlashValue('__SG_INIT__');
    const safeContent = quoteSlashValue(initialContent);
    const cmd = `/ createentry file = ${safeFileName} key = ${safeKey} ${safeContent} `;
    await execSlash(cmd);
    console.log('[StoryGuide] STscript 鏂瑰紡鍙兘鎴愬姛');
    return true;
  } catch (e) {
    console.log('[StoryGuide] STscript 鏂瑰紡澶辫触:', e?.message || e);
  }

  // 鎵€鏈夋柟娉曢兘澶辫触 - 鏄剧ず璀﹀憡浣嗕笉闃绘柇
  console.warn('[StoryGuide] 鏃犳硶鑷姩鍒涘缓涓栫晫涔︽枃浠讹紝璇锋墜鍔ㄥ垱寤?', fileName);
  return false;
}

// 瑙ｆ瀽褰撳墠鑱婂ぉ缁戝畾鐨?chatbook 鏂囦欢鍚嶏紙鐢ㄤ簬鎸佷箙缁戝畾锛?
async function resolveChatbookFileName() {
  const varName = '__sg_chatbook_name';
  try {
    const out = await execSlash(`/ getchatbook | /setvar key=${varName} | /getvar ${varName} | /flushvar ${varName}`);
    const raw = slashOutputToText(out).trim();
    if (!raw) return '';
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const name = lines[lines.length - 1] || '';
    return name.replace(/^"+|"+$/g, '');
  } catch (e) {
    console.warn('[StoryGuide] resolveChatbookFileName failed:', e?.message || e);
    return '';
  }
}

// 灏嗙粦瀹氱殑涓栫晫涔﹀簲鐢ㄥ埌璁剧疆
async function applyBoundWorldInfoToSettings() {
  const s = ensureSettings();
  if (!s.autoBindWorldInfo) return;

  console.log('[StoryGuide] 搴旂敤鑷姩缁戝畾璁剧疆锛堜娇鐢?chatbook 妯″紡锛?);

  let greenWI = String(getChatMetaValue(META_KEYS.boundGreenWI) || '').trim();
  if (!greenWI) {
    greenWI = await resolveChatbookFileName();
    if (greenWI) await setChatMetaValue(META_KEYS.boundGreenWI, greenWI);
  }

  // 缁跨伅涓栫晫涔︼細浼樺厛浣跨敤宸茶В鏋愮殑缁戝畾鏂囦欢鍚嶏紝閬垮厤鍒囨崲/鍒锋柊鍚庝骇鐢熸柊鏂囦欢
  s.summaryToWorldInfo = true;
  if (greenWI) {
    s.summaryWorldInfoTarget = 'file';
    s.summaryWorldInfoFile = greenWI;
    console.log('[StoryGuide] 缁跨伅璁剧疆: file锛堢粦瀹氭枃浠讹級', greenWI);
  } else {
    s.summaryWorldInfoTarget = 'chatbook';
    s.summaryWorldInfoFile = '';
    console.log('[StoryGuide] 缁跨伅璁剧疆: chatbook锛堝皢浣跨敤鑱婂ぉ缁戝畾鐨勪笘鐣屼功锛?);
  }

  // 钃濈伅涓栫晫涔︼細鏆傛椂绂佺敤锛堝洜涓烘棤娉曡嚜鍔ㄥ垱寤虹嫭绔嬫枃浠讹級
  // 鐢ㄦ埛濡傞渶钃濈伅鍔熻兘锛岄渶瑕佹墜鍔ㄥ垱寤轰笘鐣屼功鏂囦欢骞跺湪璁剧疆涓寚瀹?
  s.summaryToBlueWorldInfo = false;
  console.log('[StoryGuide] 钃濈伅璁剧疆: 绂佺敤锛堟棤娉曡嚜鍔ㄥ垱寤虹嫭绔嬫枃浠讹級');

  // 鏇存柊 UI锛堝鏋滈潰鏉垮凡鎵撳紑锛?
  updateAutoBindUI();
  saveSettings();
}

// 鏇存柊鑷姩缁戝畾UI鏄剧ず
function updateAutoBindUI() {
  const s = ensureSettings();
  const $info = $('#sg_autoBindInfo');

  if ($info.length) {
    if (s.autoBindWorldInfo) {
      $info.html(`<span style="color: var(--SmartThemeQuoteColor)">鉁?宸插惎鐢細鎬荤粨灏嗗啓鍏ヨ亰澶╃粦瀹氱殑涓栫晫涔?/span>`);
      $info.show();
    } else {
      $info.hide();
    }
  }
}

// 鑱婂ぉ鍒囨崲鏃剁殑澶勭悊锛堝甫鎻愮ず锛?
async function onChatSwitched() {
  const s = ensureSettings();

  console.log('[StoryGuide] onChatSwitched 琚皟鐢? autoBindWorldInfo =', s.autoBindWorldInfo);

  if (!s.autoBindWorldInfo) {
    console.log('[StoryGuide] autoBindWorldInfo 鏈紑鍚紝璺宠繃鑷姩缁戝畾');
    return;
  }

  // 绛夊緟 chatMetadata 鍔犺浇瀹屾垚锛堝鍔犻噸璇曟満鍒讹級
  let retries = 0;
  const maxRetries = 5;
  while (retries < maxRetries) {
    await new Promise(r => setTimeout(r, 200));
    const { chatMetadata } = SillyTavern.getContext();
    if (chatMetadata && Object.keys(chatMetadata).length > 0) {
      console.log('[StoryGuide] chatMetadata 宸插姞杞斤紝keys:', Object.keys(chatMetadata).length);
      break;
    }
    retries++;
    console.log(`[StoryGuide] 绛夊緟 chatMetadata 鍔犺浇... (${retries}/${maxRetries})`);
  }

  const greenWI = getChatMetaValue(META_KEYS.boundGreenWI);
  const blueWI = getChatMetaValue(META_KEYS.boundBlueWI);
  const autoBindCreated = getChatMetaValue(META_KEYS.autoBindCreated);

  console.log('[StoryGuide] 褰撳墠鑱婂ぉ缁戝畾淇℃伅:', { greenWI, blueWI, autoBindCreated });

  // 濡傛灉宸茬粡鍒涘缓杩囩粦瀹氾紙鍗充娇 greenWI 涓虹┖涔熷皾璇曟仮澶嶏級
  if (autoBindCreated || greenWI || blueWI) {
    console.log('[StoryGuide] 鎭㈠宸叉湁缁戝畾');
    await applyBoundWorldInfoToSettings();
  } else {
    // 涓嶅啀鑷姩涓烘柊鑱婂ぉ鍒涘缓涓栫晫涔︼紙鐢ㄦ埛鍙嶉锛氭瘡娆℃柊瀵硅瘽閮戒細鍒涘缓锛?
    console.log('[StoryGuide] 鏂拌亰澶╋紝璺宠繃鑷姩鍒涘缓涓栫晫涔?);
  }
}

function setStatus(text, kind = '') {
  const $s = $('#sg_status');
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
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
  if (!mods) return { ok: false, error: '妯″潡閰嶇疆蹇呴』鏄?JSON 鏁扮粍銆?, modules: null };

  const seen = new Set();
  const normalized = [];

  for (const m of mods) {
    if (!m || typeof m !== 'object') continue;
    const key = String(m.key || '').trim();
    if (!key) continue;
    if (seen.has(key)) return { ok: false, error: `妯″潡 key 閲嶅锛?{key}`, modules: null };
    seen.add(key);

    const type = String(m.type || 'text').trim();
    if (type !== 'text' && type !== 'list') return { ok: false, error: `妯″潡 ${key} 鐨?type 蹇呴』鏄?"text" 鎴?"list"`, modules: null };

    const title = String(m.title || key).trim();
    const prompt = String(m.prompt || '').trim();

    const required = m.required !== false; // default true
    const panel = m.panel !== false;       // default true
    const inline = m.inline === true;      // default false unless explicitly true
    const isStatic = m.static === true;    // default false: 闈欐€佹ā鍧楀彧鍦ㄩ娆℃垨鎵嬪姩鍒锋柊鏃剁敓鎴?

    const maxItems = (type === 'list' && Number.isFinite(Number(m.maxItems))) ? clampInt(m.maxItems, 1, 50, 8) : undefined;

    normalized.push({ key, title, type, prompt, required, panel, inline, static: isStatic, ...(maxItems ? { maxItems } : {}) });
  }

  if (!normalized.length) return { ok: false, error: '妯″潡閰嶇疆涓虹┖锛氳嚦灏戦渶瑕?1 涓ā鍧椼€?, modules: null };
  return { ok: true, error: '', modules: normalized };
}



// -------------------- presets & worldbook --------------------

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

// 灏濊瘯瑙ｆ瀽 SillyTavern 涓栫晫涔﹀鍑?JSON锛堜笉鍚岀増鏈粨鏋勫彲鑳戒笉鍚岋級
// 杩斿洖锛歔{ title, keys: string[], content: string }]
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
      .split(/[\n,锛?锛沑|]+/g)
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
    norm.push({ title: title || (keys[0] ? `鏉＄洰锛?{keys[0]}` : '鏉＄洰'), keys, content });
  }
  return norm;
}

// -------------------- 瀹炴椂璇诲彇钃濈伅涓栫晫涔︼紙World Info / Lorebook锛?--------------------

function pickBlueIndexFileName() {
  const s = ensureSettings();
  const explicit = String(s.wiBlueIndexFile || '').trim();
  if (explicit) return explicit;
  const fromBlueWrite = String(s.summaryBlueWorldInfoFile || '').trim();
  if (fromBlueWrite) return fromBlueWrite;
  // 鏈€鍚庡厹搴曪細鑻ョ敤鎴锋妸钃濈伅绱㈠紩寤哄湪缁跨伅鍚屾枃浠堕噷锛屼篃鑳借鍒帮紙涓嶆帹鑽愶紝浣嗕笉闃绘柇锛?
  const fromGreen = String(s.summaryWorldInfoFile || '').trim();
  return fromGreen;
}

async function fetchJsonCompat(url, options) {
  const headers = { ...getStRequestHeadersCompat(), ...(options?.headers || {}) };
  const res = await fetch(url, { ...(options || {}), headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${res.statusText}${text ? `\n${text}` : ''}`);
    err.status = res.status;
    throw err;
  }
  // some ST endpoints may return plain text
  const ct = String(res.headers.get('content-type') || '');
  if (ct.includes('application/json')) return await res.json();
  const t = await res.text().catch(() => '');
  try { return JSON.parse(t); } catch { return { text: t }; }
}

// 灏濊瘯浠?ST 鍚庣璇诲彇鎸囧畾涓栫晫涔︽枃浠讹紙涓嶅悓鐗堟湰鐨勫弬鏁板悕/鏂规硶鍙兘涓嶅悓锛?
async function fetchWorldInfoFileJsonCompat(fileName) {
  const raw = String(fileName || '').trim();
  if (!raw) throw new Error('钃濈伅涓栫晫涔︽枃浠跺悕涓虹┖');

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
  throw lastErr || new Error('璇诲彇涓栫晫涔﹀け璐?);
}

function buildBlueIndexFromWorldInfoJson(worldInfoJson, prefixFilter = '') {
  // 澶嶇敤 parseWorldbookJson 鐨勨€滃吋瀹硅В鏋愨€濋€昏緫
  const parsed = parseWorldbookJson(JSON.stringify(worldInfoJson || {}));
  const prefix = String(prefixFilter || '').trim();

  const base = parsed.filter(e => e && e.content);

  // 浼樺厛鐢ㄢ€滄€荤粨鍓嶇紑鈥濈瓫閫夛紙閬垮厤鎶婂叾浠栦笘鐣屼功鏉＄洰鍏ㄥ杩涚储寮曪級
  // 浣嗗鏋滃洜涓嶅悓 ST 缁撴瀯瀵艰嚧 title/comment 涓嶄竴鑷磋€岀瓫閫夊埌 0 鏉★紝鍒欒嚜鍔ㄥ洖閫€鍒板叏閮ㄦ潯鐩紝閬垮厤鈥滄槑鏄庢湁鍐呭鍗存樉绀?0 鏉♀€濄€?
  let picked = base;
  if (prefix) {
    picked = base.filter(e =>
      String(e.title || '').includes(prefix) ||
      String(e.content || '').includes(prefix)
    );
    if (!picked.length) picked = base;
  }

  const items = picked
    .map(e => ({
      title: String(e.title || '').trim() || (e.keys?.[0] ? `鏉＄洰锛?{e.keys[0]}` : '鏉＄洰'),
      summary: String(e.content || '').trim(),
      keywords: Array.isArray(e.keys) ? e.keys.slice(0, 120) : [],
      importedAt: Date.now(),
    }))
    .filter(x => x.summary);

  return items;
}

async function ensureBlueIndexLive(force = false) {
  const s = ensureSettings();
  const mode = String(s.wiBlueIndexMode || 'live');
  if (mode !== 'live') {
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

    // 鍚屾鍒拌缃噷锛屼究浜?UI 鏄剧ず锛堝悓鏃朵篃鏄€滅紦瀛樷€濆厹搴曪級
    s.summaryBlueIndex = entries;
    saveSettings();
    updateBlueIndexInfoLabel();

    return entries;
  } catch (e) {
    blueIndexLiveCache.lastError = String(e?.message ?? e);
    // 璇诲彇澶辫触灏卞洖閫€鍒扮幇鏈夌紦瀛?
    const fallback = Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : [];
    return fallback;
  }
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

  // 濡傛灉鏈惎鐢ㄦ敞鍏ワ細浠呰繑鍥炩€滃鍏ユ暟閲忊€濓紝涓嶈绠楁敞鍏ュ唴瀹癸紙UI 涔熻兘鐪嬪埌瀵煎叆鎴愬姛锛?
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
    const head = `- 銆?{e.title}銆?{(e.keys && e.keys.length) ? `锛堣Е鍙戯細${e.keys.slice(0, 6).join(' / ')}锛塦 : ''}\n`;
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
  return `\n銆愪笘鐣屼功/World Info锛堝凡瀵煎叆锛?{info.importedEntries}鏉★紝鏈娉ㄥ叆锛?{info.injectedEntries}鏉★紝绾?{info.injectedTokens} tokens锛夈€慭n${info.text}\n`;
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
    case 'none': return `銆愬墽閫忕瓥鐣ャ€戜弗鏍间笉鍓ч€忥細涓嶈閫忛湶鍘熻憲鏄庣‘鏈潵浜嬩欢涓庣湡鐩革紱鍙粰鈥滆鍔ㄥ缓璁?椋庨櫓鎻愮ず鈥濓紝閬垮厤鐐瑰悕鍏抽敭鍙嶈浆銆俙;
    case 'full': return `銆愬墽閫忕瓥鐣ャ€戝厑璁稿叏鍓ч€忥細鍙互鐩存帴鎸囧嚭鍘熻憲鍚庣画鐨勫叧閿簨浠?鐪熺浉锛屽苟瑙ｉ噴濡備綍褰卞搷褰撳墠璺嚎銆俙;
    case 'mild':
    default: return `銆愬墽閫忕瓥鐣ャ€戣交鍓ч€忥細鍙互鐢ㄢ€滈殣鏅︽彁绀?+ 鍏抽敭椋庨櫓鐐光€濓紝閬垮厤鎶婂師钁楀悗缁畬鏁存憡寮€锛涘繀瑕佹椂鍙偣鍒颁负姝€俙;
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
    description: '鍓ф儏鎸囧鍔ㄦ€佽緭鍑猴紙鎸夋ā鍧楅厤缃敓鎴愶級',
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
  // 姣忎釜妯″潡涓€琛岋細key: title 鈥?prompt
  const lines = [];
  for (const m of modules) {
    const p = m.prompt ? ` 鈥?${m.prompt}` : '';
    const t = m.title ? `锛?{m.title}锛塦 : '';
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
    ? `銆愯緭鍑哄亸濂姐€戞洿绮剧畝锛氬皯搴熻瘽銆佸皯閾哄灚銆佺洿缁欏叧閿俊鎭€俙
    : `銆愯緭鍑哄亸濂姐€戦€傚害璇︾粏锛氫互鈥滃彲鎵ц寮曞鈥濅负涓伙紝涓嶈娴佹按璐︺€俙;

  const extraSystem = String(s.customSystemPreamble || '').trim();
  const extraConstraints = String(s.customConstraints || '').trim();

  const system = [
    `---BEGIN PROMPT---`,
    `[System]`,
    `浣犳槸鎵ц鍨嬧€滃墽鎯呮寚瀵?缂栧墽椤鹃棶鈥濄€備粠鈥滄鍦ㄧ粡鍘嗙殑涓栫晫鈥濓紙鑱婂ぉ+璁惧畾锛夋彁鐐肩粨鏋勶紝骞剁粰鍑哄悗缁紩瀵笺€俙,
    spoilerPolicyText(spoilerLevel),
    compactHint,
    extraSystem ? `\n銆愯嚜瀹氫箟 System 琛ュ厖銆慭n${extraSystem}` : ``,
    ``,
    `[Constraints]`,
    `1) 涓嶈鍑┖鏉滄挵涓栫晫瑙?浜虹墿/鍦扮偣锛涗笉纭畾鍐欌€滄湭鐭?寰呯‘璁も€濄€俙,
    `2) 涓嶈澶嶈堪娴佹按璐︼紱鍙彁鐐煎叧閿煕鐩俱€佸姩鏈恒€侀闄╀笌璧板悜銆俙,
    `3) 杈撳嚭蹇呴』鏄?JSON 瀵硅薄鏈綋锛堟棤 Markdown銆佹棤浠ｇ爜鍧椼€佹棤澶氫綑瑙ｉ噴锛夈€俙,
    `4) 鍙緭鍑轰笅闈㈠垪鍑虹殑瀛楁锛屼笉瑕侀澶栧瓧娈点€俙,
    extraConstraints ? `\n銆愯嚜瀹氫箟 Constraints 琛ュ厖銆慭n${extraConstraints}` : ``,
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
          `銆愯鑹插崱銆慭n` +
          `- 鍚嶇О锛?{stripHtml(name)}\n` +
          `- 鎻忚堪锛?{stripHtml(desc)}\n` +
          `- 鎬ф牸锛?{stripHtml(personality)}\n` +
          `- 鍦烘櫙/璁惧畾锛?{stripHtml(scenario)}\n` +
          (first ? `- 寮€鍦虹櫧锛?{stripHtml(first)}\n` : '');
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
    if (text.length > maxChars) text = text.slice(0, maxChars) + '鈥?鎴柇)';
    picked.push(`銆?{name}銆?{text}`);
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
    `銆愪换鍔°€戜綘鏄€滃墽鎯呮寚瀵尖€濄€傛牴鎹笅鏂光€滄鍦ㄧ粡鍘嗙殑涓栫晫鈥濓紙鑱婂ぉ + 璁惧畾锛夎緭鍑虹粨鏋勫寲鎶ュ憡銆俙,
    ``,
    charBlock ? charBlock : `銆愯鑹插崱銆戯紙鏈幏鍙栧埌/鍙兘鏄兢鑱婏級`,
    ``,
    world ? `銆愪笘鐣岃/璁惧畾琛ュ厖銆慭n${world}\n` : `銆愪笘鐣岃/璁惧畾琛ュ厖銆戯紙鏈彁渚涳級\n`,
    canon ? `銆愬師钁楀悗缁?澶х翰銆慭n${canon}\n` : `銆愬師钁楀悗缁?澶х翰銆戯紙鏈彁渚涳級\n`,
    buildWorldbookBlock(),
    `銆愯亰澶╄褰曪紙鏈€杩?{picked.length}鏉★級銆慲,
    picked.length ? picked.join('\n\n') : '锛堢┖锛?
  ].join('\n');

  return { snapshotText, sourceSummary };
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
  throw new Error('鏈壘鍒板彲鐢ㄧ殑鐢熸垚鍑芥暟锛坓enerateRaw/generateQuietPrompt锛夈€?);
}

async function fallbackAskJson(messages, temperature) {
  const ctx = SillyTavern.getContext();
  const retry = clone(messages);
  retry.unshift({ role: 'system', content: `鍐嶆寮鸿皟锛氬彧杈撳嚭 JSON 瀵硅薄鏈綋锛屼笉瑕佷换浣曢澶栨枃瀛椼€俙 });
  if (typeof ctx.generateRaw === 'function') return await ctx.generateRaw({ prompt: retry, temperature });
  if (typeof ctx.generateQuietPrompt === 'function') return await ctx.generateQuietPrompt({ messages: retry, temperature });
  throw new Error('fallback 澶辫触锛氱己灏?generateRaw/generateQuietPrompt');
}

async function fallbackAskJsonCustom(apiBaseUrl, apiKey, model, messages, temperature, maxTokens, topP, stream) {
  const retry = clone(messages);
  retry.unshift({ role: 'system', content: `鍐嶆寮鸿皟锛氬彧杈撳嚭 JSON 瀵硅薄鏈綋锛屼笉瑕佷换浣曢澶栨枃瀛楋紝涓嶈浠ｇ爜鍧椼€俙 });
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
    const err = new Error(`鍚庣浠ｇ悊璇锋眰澶辫触: HTTP ${res.status} ${res.statusText}\n${text}`);
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
  if (!endpoint) throw new Error('custom 妯″紡锛欰PI鍩虹URL 涓虹┖');

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
    throw new Error(`鐩磋繛璇锋眰澶辫触: HTTP ${res.status} ${res.statusText}\n${text}`);
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
  if (!base) throw new Error('custom 妯″紡闇€瑕佸～鍐?API鍩虹URL');

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
  lines.push(`# 鍓ф儏鎸囧鎶ュ憡`);
  lines.push('');

  for (const m of modules) {
    const val = parsedJson?.[m.key];
    lines.push(`## ${m.title || m.key}`);

    if (m.type === 'list') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) {
        lines.push('锛堢┖锛?);
      } else {
        // tips 鐢ㄦ湁搴忓垪琛ㄦ洿鑸掓湇
        if (m.key === 'tips') {
          arr.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
        } else {
          arr.forEach(t => lines.push(`- ${t}`));
        }
      }
    } else {
      lines.push(val ? String(val) : '锛堢┖锛?);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// -------------------- panel analysis --------------------

async function runAnalysis() {
  const s = ensureSettings();
  if (!s.enabled) { setStatus('鎻掍欢鏈惎鐢?, 'warn'); return; }

  setStatus('鍒嗘瀽涓€?, 'warn');
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
      // 鍚屾鍘熸枃鍒拌亰澶╂湯灏撅紙瑙ｆ瀽澶辫触鏃朵篃涓嶈嚦浜庘€滆亰澶╅噷鐪嬩笉鍒扳€濓級
      try { syncPanelOutputToChat(String(jsonText || lastJsonText || ''), true); } catch { /* ignore */ }
      showPane('json');
      throw new Error('妯″瀷杈撳嚭鏃犳硶瑙ｆ瀽涓?JSON锛堝凡鍒囧埌 JSON 鏍囩锛岀湅鐪嬪師鏂囷級');
    }

    const md = renderReportMarkdownFromModules(parsed, modules);
    lastReport = { json: parsed, markdown: md, createdAt: Date.now(), sourceSummary };
    renderMarkdownInto($('#sg_md'), md);

    await updateMapFromSnapshot(snapshotText);

    // 鍚屾闈㈡澘鎶ュ憡鍒拌亰澶╂湯灏?
    try { syncPanelOutputToChat(md, false); } catch { /* ignore */ }

    updateButtonsEnabled();
    showPane('md');
    setStatus('瀹屾垚 鉁?, 'ok');
  } catch (e) {
    console.error('[StoryGuide] analysis failed:', e);
    setStatus(`鍒嗘瀽澶辫触锛?{e?.message ?? e}`, 'err');
  } finally {
    $('#sg_analyze').prop('disabled', false);
  }
}

// -------------------- summary (auto + world info) --------------------

function isCountableMessage(m) {
  if (!m) return false;
  if (m.is_system === true) return false;
  if (m.is_hidden === true) return false;
  const txt = String(m.mes ?? '').trim();
  return Boolean(txt);
}

function isCountableAssistantMessage(m) {
  return isCountableMessage(m) && m.is_user !== true;
}

function computeFloorCount(chat, mode) {
  const arr = Array.isArray(chat) ? chat : [];
  let c = 0;
  for (const m of arr) {
    if (mode === 'assistant') {
      if (isCountableAssistantMessage(m)) c++;
    } else {
      if (isCountableMessage(m)) c++;
    }
  }
  return c;
}

function findStartIndexForLastNFloors(chat, mode, n) {
  const arr = Array.isArray(chat) ? chat : [];
  let remaining = Math.max(1, Number(n) || 1);
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i];
    const hit = (mode === 'assistant') ? isCountableAssistantMessage(m) : isCountableMessage(m);
    if (!hit) continue;
    remaining -= 1;
    if (remaining <= 0) return i;
  }
  return 0;
}

function buildSummaryChunkText(chat, startIdx, maxCharsPerMessage, maxTotalChars) {
  const arr = Array.isArray(chat) ? chat : [];
  const start = Math.max(0, Math.min(arr.length, Number(startIdx) || 0));
  const perMsg = clampInt(maxCharsPerMessage, 200, 8000, 4000);
  const totalMax = clampInt(maxTotalChars, 2000, 80000, 24000);

  const parts = [];
  let total = 0;
  for (let i = start; i < arr.length; i++) {
    const m = arr[i];
    if (!isCountableMessage(m)) continue;
    const who = m.is_user === true ? '鐢ㄦ埛' : (m.name || 'AI');
    let txt = stripHtml(m.mes || '');
    if (!txt) continue;
    if (txt.length > perMsg) txt = txt.slice(0, perMsg) + '鈥?;
    const block = `銆?{who}銆?{txt}`;
    if (total + block.length + 2 > totalMax) break;
    parts.push(block);
    total += block.length + 2;
  }
  return parts.join('\n');
}

// 鎵嬪姩妤煎眰鑼冨洿鎬荤粨锛氭寜 floor 鍙峰畾浣嶅埌鑱婂ぉ绱㈠紩
function findChatIndexByFloor(chat, mode, floorNo) {
  const arr = Array.isArray(chat) ? chat : [];
  const target = Math.max(1, Number(floorNo) || 1);
  let c = 0;
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i];
    const hit = (mode === 'assistant') ? isCountableAssistantMessage(m) : isCountableMessage(m);
    if (!hit) continue;
    c += 1;
    if (c === target) return i;
  }
  return -1;
}

function resolveChatRangeByFloors(chat, mode, fromFloor, toFloor) {
  const floorNow = computeFloorCount(chat, mode);
  if (floorNow <= 0) return null;
  let a = clampInt(fromFloor, 1, floorNow, 1);
  let b = clampInt(toFloor, 1, floorNow, floorNow);
  if (b < a) { const t = a; a = b; b = t; }

  let startIdx = findChatIndexByFloor(chat, mode, a);
  let endIdx = findChatIndexByFloor(chat, mode, b);
  if (startIdx < 0 || endIdx < 0) return null;

  // 鍦?assistant 妯″紡涓嬶紝涓轰簡鏇磋创杩戔€滃洖鍚堚€濓紝鎶婅捣濮?assistant 妤煎眰鍓嶄竴鏉＄敤鎴锋秷鎭篃绾冲叆锛堣嫢瀛樺湪锛夈€?
  if (mode === 'assistant' && startIdx > 0) {
    const prev = chat[startIdx - 1];
    if (prev && prev.is_user === true && isCountableMessage(prev)) startIdx -= 1;
  }

  if (startIdx > endIdx) { const t = startIdx; startIdx = endIdx; endIdx = t; }
  return { fromFloor: a, toFloor: b, startIdx, endIdx, floorNow };
}

function buildSummaryChunkTextRange(chat, startIdx, endIdx, maxCharsPerMessage, maxTotalChars) {
  const arr = Array.isArray(chat) ? chat : [];
  const start = Math.max(0, Math.min(arr.length - 1, Number(startIdx) || 0));
  const end = Math.max(start, Math.min(arr.length - 1, Number(endIdx) || 0));
  const perMsg = clampInt(maxCharsPerMessage, 200, 8000, 4000);
  const totalMax = clampInt(maxTotalChars, 2000, 80000, 24000);

  const parts = [];
  let total = 0;
  for (let i = start; i <= end; i++) {
    const m = arr[i];
    if (!isCountableMessage(m)) continue;
    const who = m.is_user === true ? '鐢ㄦ埛' : (m.name || 'AI');
    let txt = stripHtml(m.mes || '');
    if (!txt) continue;
    if (txt.length > perMsg) txt = txt.slice(0, perMsg) + '鈥?;
    const block = `銆?{who}銆?{txt}`;
    if (total + block.length + 2 > totalMax) break;
    parts.push(block);
    total += block.length + 2;
  }
  return parts.join('\n');
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

function buildSummaryPromptMessages(chunkText, fromFloor, toFloor, statData = null) {
  const s = ensureSettings();

  // system prompt
  let sys = String(s.summarySystemPrompt || '').trim();
  if (!sys) sys = DEFAULT_SUMMARY_SYSTEM_PROMPT;
  // 寮哄埗杩藉姞 JSON 缁撴瀯瑕佹眰锛岄伩鍏嶇敤鎴疯嚜瀹氫箟鎻愮ず璇嶅鑷磋В鏋愬け璐?
  sys = sys + '\n\n' + SUMMARY_JSON_REQUIREMENT;

  // user template (supports placeholders)
  let tpl = String(s.summaryUserTemplate || '').trim();
  if (!tpl) tpl = DEFAULT_SUMMARY_USER_TEMPLATE;

  // 鏍煎紡鍖?statData锛堝鏋滄湁锛?
  const statDataJson = statData ? JSON.stringify(statData, null, 2) : '';

  let user = renderTemplate(tpl, {
    fromFloor: String(fromFloor),
    toFloor: String(toFloor),
    chunk: String(chunkText || ''),
    statData: statDataJson,
  });
  // 濡傛灉鐢ㄦ埛妯℃澘閲屾病鏈夊寘鍚?chunk锛屽崰浣嶈ˉ鍥炲幓锛岄槻姝㈣閰嶅鑷存棤鍐呭
  if (!/{{\s*chunk\s*}}/i.test(tpl) && !String(user).includes(String(chunkText || '').slice(0, 12))) {
    user = String(user || '').trim() + `\n\n銆愬璇濈墖娈点€慭n${chunkText}`;
  }
  // 濡傛灉鏈?statData 涓旂敤鎴锋ā鏉块噷娌℃湁鍖呭惈锛岃拷鍔犲埌鏈熬
  if (statData && !/{{\s*statData\s*}}/i.test(tpl)) {
    user = String(user || '').trim() + `\n\n銆愯鑹茬姸鎬佹暟鎹€慭n${statDataJson}`;
  }
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

function sanitizeKeywords(kws) {
  const out = [];
  const seen = new Set();
  for (const k of (Array.isArray(kws) ? kws : [])) {
    let t = String(k ?? '').trim();
    if (!t) continue;
    t = t.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
    // split by common delimiters
    const split = t.split(/[,锛屻€?锛?|]+/g).map(x => x.trim()).filter(Boolean);
    for (const s of split) {
      if (s.length < 2) continue;
      if (s.length > 24) continue;
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
  if (!item.title) item.title = item.keywords?.[0] ? `鏉＄洰锛?{item.keywords[0]}` : '鏉＄洰';
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

// ===== 缁撴瀯鍖栦笘鐣屼功鏉＄洰鏍稿績鍑芥暟 =====

function buildStructuredEntriesPromptMessages(chunkText, fromFloor, toFloor, meta, statData = null) {
  const s = ensureSettings();
  let sys = String(s.structuredEntriesSystemPrompt || '').trim();
  if (!sys) sys = DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT;
  const charPrompt = String(s.structuredCharacterPrompt || '').trim() || DEFAULT_STRUCTURED_CHARACTER_PROMPT;
  const equipPrompt = String(s.structuredEquipmentPrompt || '').trim() || DEFAULT_STRUCTURED_EQUIPMENT_PROMPT;
  const abilityPrompt = String(s.structuredAbilityPrompt || '').trim() || DEFAULT_STRUCTURED_ABILITY_PROMPT;
  sys = [
    sys,
    `銆愪汉鐗╂潯鐩姹傘€慭n${charPrompt}`,
    `銆愯澶囨潯鐩姹傘€慭n${equipPrompt}`,
    `銆愯兘鍔涙潯鐩姹傘€慭n${abilityPrompt}`,
    STRUCTURED_ENTRIES_JSON_REQUIREMENT,
  ].join('\n\n');

  // 鏋勫缓宸茬煡鍒楄〃渚?LLM 鍒ゆ柇鏄惁鏂板/鏇存柊锛堝寘鍚埆鍚嶄互甯姪璇嗗埆涓嶅悓鍐欐硶锛?
  const knownChars = Object.values(meta.characterEntries || {}).map(c => {
    const aliases = Array.isArray(c.aliases) && c.aliases.length > 0 ? `[鍒悕:${c.aliases.join('/')}]` : '';
    return `${c.name}${aliases}`;
  }).join('銆?) || '鏃?;
  const knownEquips = Object.values(meta.equipmentEntries || {}).map(e => {
    const aliases = Array.isArray(e.aliases) && e.aliases.length > 0 ? `[鍒悕:${e.aliases.join('/')}]` : '';
    return `${e.name}${aliases}`;
  }).join('銆?) || '鏃?;

  // 鏍煎紡鍖?statData
  const statDataJson = statData ? JSON.stringify(statData, null, 2) : '';

  let tpl = String(s.structuredEntriesUserTemplate || '').trim();
  if (!tpl) tpl = DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE;
  let user = renderTemplate(tpl, {
    fromFloor: String(fromFloor),
    toFloor: String(toFloor),
    chunk: String(chunkText || ''),
    knownCharacters: knownChars,
    knownEquipments: knownEquips,
    statData: statDataJson,
  });
  // 濡傛灉鏈?statData 涓旀ā鏉块噷娌℃湁鍖呭惈锛岃拷鍔犲埌鏈熬
  if (statData && !/\{\{\s*statData\s*\}\}/i.test(tpl)) {
    user = String(user || '').trim() + `\n\n銆愯鑹茬姸鎬佹暟鎹?statData銆慭n${statDataJson}`;
  }
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

async function generateStructuredEntries(chunkText, fromFloor, toFloor, meta, settings, statData = null) {
  const messages = buildStructuredEntriesPromptMessages(chunkText, fromFloor, toFloor, meta, statData);
  let jsonText = '';
  if (String(settings.summaryProvider || 'st') === 'custom') {
    jsonText = await callViaCustom(settings.summaryCustomEndpoint, settings.summaryCustomApiKey, settings.summaryCustomModel, messages, settings.summaryTemperature, settings.summaryCustomMaxTokens, 0.95, settings.summaryCustomStream);
  } else {
    jsonText = await callViaSillyTavern(messages, null, settings.summaryTemperature);
    if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
  }
  const parsed = safeJsonParse(jsonText);
  if (!parsed) return null;
  return {
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    equipments: Array.isArray(parsed.equipments) ? parsed.equipments : [],
    abilities: Array.isArray(parsed.abilities) ? parsed.abilities : [],
    deletedCharacters: Array.isArray(parsed.deletedCharacters) ? parsed.deletedCharacters : [],
    deletedEquipments: Array.isArray(parsed.deletedEquipments) ? parsed.deletedEquipments : [],
    deletedAbilities: Array.isArray(parsed.deletedAbilities) ? parsed.deletedAbilities : [],
  };
}

// 鏋勫缓鏉＄洰鐨?key锛堢敤浜庝笘鐣屼功瑙﹀彂璇嶅拰鍘婚噸锛?
function buildStructuredEntryKey(prefix, name, indexId) {
  return `${prefix}锝?{name}锝?{indexId}`;
}

// 鏋勫缓鏉＄洰鍐呭锛堟。妗堝紡鎻忚堪锛?
function buildCharacterContent(char) {
  const parts = [];
  if (char.name) parts.push(`銆愪汉鐗┿€?{char.name}`);
  if (char.aliases?.length) parts.push(`鍒悕锛?{char.aliases.join('銆?)}`);
  if (char.faction) parts.push(`闃佃惀/韬唤锛?{char.faction}`);
  if (char.status) parts.push(`鐘舵€侊細${char.status}`);
  if (char.personality) parts.push(`鎬ф牸锛?{char.personality}`);

  // 鎬ф牸閾嗛拤锛堢敤鐗规畩鏍煎紡绐佸嚭鏄剧ず锛?
  if (char.corePersonality) parts.push(`銆愭牳蹇冩€ф牸閿氱偣銆?{char.corePersonality}锛堜笉浼氳交鏄撴敼鍙橈級`);
  if (char.motivation) parts.push(`銆愯鑹插姩鏈恒€?{char.motivation}锛堢嫭绔嬩簬涓昏鐨勭洰鏍囷級`);
  if (char.relationshipStage) parts.push(`銆愬叧绯婚樁娈点€?{char.relationshipStage}`);

  if (char.background) parts.push(`鑳屾櫙锛?{char.background}`);
  if (char.relationToProtagonist) parts.push(`涓庝富瑙掑叧绯伙細${char.relationToProtagonist}`);
  if (char.keyEvents?.length) parts.push(`鍏抽敭浜嬩欢锛?{char.keyEvents.join('锛?)}`);
  if (char.statInfo) {
    const infoStr = typeof char.statInfo === 'object' ? JSON.stringify(char.statInfo, null, 2) : String(char.statInfo);
    parts.push(`灞炴€ф暟鎹細${infoStr}`);
  }
  return parts.join('\n');
}

function buildEquipmentContent(equip) {
  const parts = [];
  if (equip.name) parts.push(`銆愯澶囥€?{equip.name}`);
  if (equip.aliases?.length) parts.push(`鍒悕锛?{equip.aliases.join('銆?)}`);
  if (equip.type) parts.push(`绫诲瀷锛?{equip.type}`);
  if (equip.rarity) parts.push(`鍝佽川锛?{equip.rarity}`);
  if (equip.effects) parts.push(`鏁堟灉锛?{equip.effects}`);
  if (equip.source) parts.push(`鏉ユ簮锛?{equip.source}`);
  if (equip.currentState) parts.push(`褰撳墠鐘舵€侊細${equip.currentState}`);
  if (equip.statInfo) {
    const infoStr = typeof equip.statInfo === 'object' ? JSON.stringify(equip.statInfo, null, 2) : String(equip.statInfo);
    parts.push(`灞炴€ф暟鎹細${infoStr}`);
  }
  if (equip.boundEvents?.length) parts.push(`鐩稿叧浜嬩欢锛?{equip.boundEvents.join('锛?)}`);
  return parts.join('\n');
}

function buildAbilityContent(ability) {
  const parts = [];
  if (ability.name) parts.push(`銆愯兘鍔涖€?{ability.name}${ability.isNegative ? '锛堣礋闈級' : ''}`);
  if (ability.type) parts.push(`绫诲瀷锛?{ability.type}`);
  if (ability.effects) parts.push(`鏁堟灉锛?{ability.effects}`);
  if (ability.trigger) parts.push(`瑙﹀彂鏉′欢锛?{ability.trigger}`);
  if (ability.cost) parts.push(`浠ｄ环/鍐峰嵈锛?{ability.cost}`);
  if (ability.statInfo) {
    const infoStr = typeof ability.statInfo === 'object' ? JSON.stringify(ability.statInfo, null, 2) : String(ability.statInfo);
    parts.push(`灞炴€ф暟鎹細${infoStr}`);
  }
  if (ability.boundEvents?.length) parts.push(`鐩稿叧浜嬩欢锛?{ability.boundEvents.join('锛?)}`);
  return parts.join('\n');
}

// 鍐欏叆鎴栨洿鏂扮粨鏋勫寲鏉＄洰锛堟柟妗圕锛氭贩鍚堢瓥鐣ワ級
// targetType: 'green' = 缁跨伅涓栫晫涔︼紙瑙﹀彂璇嶈Е鍙戯級, 'blue' = 钃濈伅涓栫晫涔︼紙甯稿紑绱㈠紩锛?
async function writeOrUpdateStructuredEntry(entryType, entryData, meta, settings, {
  buildContent,
  entriesCache,
  nextIndexKey,
  prefix,
  targetType = 'green', // 'green' | 'blue'
}) {
  // 浣跨敤瑙勮寖鍖栫殑鍚嶇О浣滀负鍞竴鏍囪瘑绗︼紙蹇界暐 LLM 鎻愪緵鐨?uid锛屽洜涓轰笉鍙潬锛?
  const entryName = String(entryData.name || '').trim();
  if (!entryName) return null;

  // 瑙勮寖鍖栧悕绉帮細绉婚櫎鐗规畩瀛楃锛岀敤浜庣紦瀛?key
  const normalizedName = entryName.replace(/[|锝?锛孿s]/g, '_').toLowerCase();
  const cacheKey = `${normalizedName}_${targetType}`;

  // 棣栧厛鎸?cacheKey 鐩存帴鏌ユ壘
  let cached = entriesCache[cacheKey];

  // 濡傛灉鐩存帴鏌ユ壘澶辫触锛岄亶鍘嗙紦瀛樻寜鍚嶇О妯＄硦鍖归厤锛堝鐞嗗悓涓€浜虹墿涓嶅悓鍐欐硶锛?
  if (!cached) {
    for (const [key, value] of Object.entries(entriesCache)) {
      if (!key.endsWith(`_${targetType}`)) continue;
      const cachedNameNorm = String(value.name || '').replace(/[|锝?锛孿s]/g, '_').toLowerCase();
      const cachedAliases = Array.isArray(value.aliases) ? value.aliases.map(a => String(a).toLowerCase().trim()) : [];
      const newAliases = Array.isArray(entryData.aliases) ? entryData.aliases.map(a => String(a).toLowerCase().trim()) : [];
      const nameMatch = cachedNameNorm === normalizedName || cachedNameNorm.includes(normalizedName) || normalizedName.includes(cachedNameNorm);
      const newNameInCachedAliases = cachedAliases.some(a => a === normalizedName || a.includes(normalizedName) || normalizedName.includes(a));
      const cachedNameInNewAliases = newAliases.some(a => a === cachedNameNorm || a.includes(cachedNameNorm) || cachedNameNorm.includes(a));
      const aliasesOverlap = cachedAliases.some(ca => newAliases.some(na => ca === na || ca.includes(na) || na.includes(ca)));
      if (nameMatch || newNameInCachedAliases || cachedNameInNewAliases || aliasesOverlap) {
        cached = value;
        console.log(`[StoryGuide] Found cached ${entryType} by smart match: "${entryName}" -> "${value.name}"`);
        if (entryName.toLowerCase() !== String(value.name).toLowerCase()) {
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

  const content = buildContent(entryData).replace(/\|/g, '锝?);

  // 鏍规嵁 targetType 閫夋嫨涓栫晫涔︾洰鏍?
  let target, file, constant;
  if (targetType === 'blue') {
    target = 'file';
    file = String(settings.summaryBlueWorldInfoFile || '');
    constant = 1; // 钃濈伅=甯稿紑
    if (!file) return null; // 钃濈伅蹇呴』鎸囧畾鏂囦欢鍚?
  } else {
    target = String(settings.summaryWorldInfoTarget || 'chatbook');
    file = String(settings.summaryWorldInfoFile || '');
    constant = 0; // 缁跨伅=瑙﹀彂璇嶈Е鍙?
  }
  const fileExprForQuery = (target === 'chatbook') ? '{{getchatbook}}' : file;

  // 鍘婚噸鍜屾洿鏂版鏌ワ細濡傛灉鏈湴缂撳瓨宸叉湁姝ゆ潯鐩?
  if (cached) {
    // 鍐呭鐩稿悓 -> 璺宠繃
    if (cached.content === content) {
      console.log(`[StoryGuide] Skip unchanged ${entryType} (${targetType}): ${entryName}`);
      return { skipped: true, name: entryName, targetType, reason: 'unchanged' };
    }

    // 鍐呭涓嶅悓 -> 灏濊瘯浣跨敤 /findentry 鏌ユ壘骞舵洿鏂?
    console.log(`[StoryGuide] Content changed for ${entryType} (${targetType}): ${entryName}, attempting update via /findentry...`);
    try {
      // 浣跨敤 /findentry 閫氳繃 comment 瀛楁鏌ユ壘鏉＄洰 UID
      // comment 鏍煎紡涓? "浜虹墿锝滆鑹插悕锝淐HA-001"
      const searchPattern = `${prefix}锝?{entryName}`;

      // 鏋勫缓鏌ユ壘鑴氭湰
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

      // DEBUG: 鏌ョ湅 findentry 杩斿洖鍊?
      console.log(`[StoryGuide] DEBUG /findentry result:`, findResult, `type:`, typeof findResult);

      // 瑙ｆ瀽 UID - 澶勭悊澶氱鍙兘鐨勮繑鍥炴牸寮?
      let foundUid = null;
      if (findResult !== null && findResult !== undefined) {
        // 濡傛灉鏄暟瀛楋紝鐩存帴浣跨敤
        if (typeof findResult === 'number') {
          foundUid = String(findResult);
        } else if (typeof findResult === 'string') {
          const trimmed = findResult.trim();
          // 鐩存帴鏄暟瀛楀瓧绗︿覆
          if (trimmed.match(/^\d+$/)) {
            foundUid = trimmed;
          } else {
            // 灏濊瘯瑙ｆ瀽 JSON
            try {
              const parsed = JSON.parse(trimmed);
              if (typeof parsed === 'number') {
                foundUid = String(parsed);
              } else if (parsed?.pipe !== undefined) {
                foundUid = String(parsed.pipe);
              } else if (parsed?.result !== undefined) {
                foundUid = String(parsed.result);
              }
            } catch { /* not JSON */ }
          }
        } else if (typeof findResult === 'object') {
          // 瀵硅薄褰㈠紡 {pipe: xxx} 鎴?{result: xxx}
          if (findResult?.pipe !== undefined) {
            foundUid = String(findResult.pipe);
          } else if (findResult?.result !== undefined) {
            foundUid = String(findResult.result);
          }
        }
      }
      console.log(`[StoryGuide] DEBUG parsed foundUid:`, foundUid);

      // 娓呯悊涓存椂鍙橀噺
      try { await execSlash(`/flushvar ${findUidVar}`); } catch { /* ignore */ }
      if (target === 'chatbook') {
        try { await execSlash(`/flushvar ${findFileVar}`); } catch { /* ignore */ }
      }

      if (foundUid) {
        // 鎵惧埌鏉＄洰锛屾洿鏂板唴瀹?
        let updateParts = [];
        const updateFileVar = '__sg_update_file';

        if (target === 'chatbook') {
          // chatbook 妯″紡闇€瑕佸厛鑾峰彇鏂囦欢鍚?
          updateParts.push('/getchatbook');
          updateParts.push(`/setvar key=${updateFileVar}`);
          updateParts.push(`/setentryfield file={{getvar::${updateFileVar}}} uid=${foundUid} field=content ${quoteSlashValue(content)}`);
          updateParts.push(`/flushvar ${updateFileVar}`);
        } else {
          updateParts.push(`/setentryfield file=${quoteSlashValue(file)} uid=${foundUid} field=content ${quoteSlashValue(content)}`);
        }

        await execSlash(updateParts.join(' | '));
        cached.content = content;
        cached.lastUpdated = Date.now();
        console.log(`[StoryGuide] Updated ${entryType} (${targetType}): ${entryName} -> UID ${foundUid}`);
        return { updated: true, name: entryName, targetType, uid: foundUid };
      } else {
        console.log(`[StoryGuide] Entry not found via /findentry: ${searchPattern}, skipping update`);
        // 鏈壘鍒版潯鐩紙鍙兘琚墜鍔ㄥ垹闄わ級锛屽彧鏇存柊缂撳瓨
        cached.content = content;
        cached.lastUpdated = Date.now();
        return { skipped: true, name: entryName, targetType, reason: 'entry_not_found' };
      }
    } catch (e) {
      console.warn(`[StoryGuide] Update ${entryType} (${targetType}) via /findentry failed:`, e);
      // 鏇存柊澶辫触锛屽彧鏇存柊缂撳瓨
      cached.content = content;
      cached.lastUpdated = Date.now();
      return { skipped: true, name: entryName, targetType, reason: 'update_failed' };
    }
  }

  // 鍒涘缓鏂版潯鐩?
  // 瀵逛簬钃濈伅鏉＄洰锛屽厛妫€鏌ユ槸鍚︽湁瀵瑰簲鐨勭豢鐏潯鐩紝澶嶇敤鍏?indexId
  let indexId;
  const greenCacheKey = `${normalizedName}_green`;
  const existingGreenEntry = entriesCache[greenCacheKey];

  if (targetType === 'blue' && existingGreenEntry?.indexId) {
    // 钃濈伅澶嶇敤缁跨伅鐨?indexId
    indexId = existingGreenEntry.indexId;
    console.log(`[StoryGuide] Reusing green indexId for blue: ${entryName} -> ${indexId}`);
  } else {
    // 缁跨伅鎴栨病鏈夊搴旂豢鐏潯鐩椂锛岀敓鎴愭柊 indexId
    const indexNum = meta[nextIndexKey] || 1;
    indexId = `${entryType.substring(0, 3).toUpperCase()}-${String(indexNum).padStart(3, '0')}`;
  }

  const keyValue = buildStructuredEntryKey(prefix, entryName, indexId);
  const comment = `${prefix}锝?{entryName}锝?{indexId}`;

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
    // 鏇存柊缂撳瓨
    entriesCache[cacheKey] = {
      name: entryName,
      aliases: entryData.aliases || [],
      content,
      lastUpdated: Date.now(),
      indexId,
      targetType,
    };
    if (targetType === 'green' && !existingGreenEntry) {
      // 鍙湪缁跨伅棣栨鍒涘缓鏃堕€掑绱㈠紩
      meta[nextIndexKey] = (meta[nextIndexKey] || 1) + 1;
    }
    console.log(`[StoryGuide] Created ${entryType} (${targetType}): ${entryName} -> ${indexId}`);
    return { created: true, name: entryName, indexId, targetType };
  } catch (e) {
    console.warn(`[StoryGuide] Create ${entryType} (${targetType}) entry failed:`, e);
    return null;
  }
}


async function writeOrUpdateCharacterEntry(char, meta, settings) {
  if (!char?.name) return null;
  const results = [];
  // 鍐欏叆缁跨伅涓栫晫涔?
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('character', char, meta, settings, {
      buildContent: buildCharacterContent,
      entriesCache: meta.characterEntries,
      nextIndexKey: 'nextCharacterIndex',
      prefix: settings.characterEntryPrefix || '浜虹墿',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  // 鍐欏叆钃濈伅涓栫晫涔?
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('character', char, meta, settings, {
      buildContent: buildCharacterContent,
      entriesCache: meta.characterEntries,
      nextIndexKey: 'nextCharacterIndex',
      prefix: settings.characterEntryPrefix || '浜虹墿',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateEquipmentEntry(equip, meta, settings) {
  if (!equip?.name) return null;
  const results = [];
  // 鍐欏叆缁跨伅涓栫晫涔?
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('equipment', equip, meta, settings, {
      buildContent: buildEquipmentContent,
      entriesCache: meta.equipmentEntries,
      nextIndexKey: 'nextEquipmentIndex',
      prefix: settings.equipmentEntryPrefix || '瑁呭',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  // 鍐欏叆钃濈伅涓栫晫涔?
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('equipment', equip, meta, settings, {
      buildContent: buildEquipmentContent,
      entriesCache: meta.equipmentEntries,
      nextIndexKey: 'nextEquipmentIndex',
      prefix: settings.equipmentEntryPrefix || '瑁呭',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

async function writeOrUpdateAbilityEntry(ability, meta, settings) {
  if (!ability?.name) return null;
  const results = [];
  // 鍐欏叆缁跨伅涓栫晫涔?
  if (settings.summaryToWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('ability', ability, meta, settings, {
      buildContent: buildAbilityContent,
      entriesCache: meta.abilityEntries,
      nextIndexKey: 'nextAbilityIndex',
      prefix: settings.abilityEntryPrefix || '鑳藉姏',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  // 鍐欏叆钃濈伅涓栫晫涔?
  if (settings.summaryToBlueWorldInfo) {
    const r = await writeOrUpdateStructuredEntry('ability', ability, meta, settings, {
      buildContent: buildAbilityContent,
      entriesCache: meta.abilityEntries,
      nextIndexKey: 'nextAbilityIndex',
      prefix: settings.abilityEntryPrefix || '鑳藉姏',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 鍒犻櫎缁撴瀯鍖栨潯鐩紙浠庝笘鐣屼功涓垹闄ゆ浜¤鑹层€佸崠鎺夎澶囩瓑锛?
async function deleteStructuredEntry(entryType, entryName, meta, settings, {
  entriesCache,
  prefix,
  targetType = 'green',
}) {
  if (!entryName) return null;
  const normalizedName = String(entryName || '').trim().toLowerCase();

  // 鏌ユ壘缂撳瓨涓殑鏉＄洰
  const cacheKey = `${normalizedName}_${targetType}`;
  const cached = entriesCache[cacheKey];
  if (!cached) {
    console.log(`[StoryGuide] Delete ${entryType} (${targetType}): ${entryName} not found in cache`);
    return null;
  }

  // 鏋勫缓 comment 鐢ㄤ簬鏌ユ壘涓栫晫涔︽潯鐩?
  const comment = `${prefix}锝?{cached.name}锝?{cached.indexId}`;

  // 纭畾鐩爣涓栫晫涔?
  let target = 'chatbook';
  let file = '';
  if (targetType === 'blue') {
    target = 'file';
    file = settings.summaryBlueWorldInfoFile || '';
    if (!file) {
      console.warn(`[StoryGuide] No blue world info file configured for deletion`);
      return null;
    }
  } else {
    const t = String(settings.summaryWorldInfoTarget || 'chatbook');
    if (t === 'file') {
      target = 'file';
      file = settings.summaryWorldInfoFile || '';
    }
  }

  // 浣跨敤 /findentry 鏌ユ壘鏉＄洰 UID
  try {
    let findExpr;
    const findFileVar = 'sgTmpFindFile';
    if (target === 'chatbook') {
      // 浣跨敤 setvar/getvar 绠￠亾鑾峰彇 chatbook 鏂囦欢鍚?
      await execSlash(`/getchatbook | /setvar key=${findFileVar}`);
      findExpr = `/findentry file={{getvar::${findFileVar}}} field=comment ${quoteSlashValue(comment)}`;
    } else {
      findExpr = `/findentry file=${quoteSlashValue(file)} field=comment ${quoteSlashValue(comment)}`;
    }

    const findResult = await execSlash(findExpr);
    const findText = slashOutputToText(findResult);

    // 娓呯悊涓存椂鍙橀噺
    if (target === 'chatbook') {
      await execSlash(`/flushvar ${findFileVar}`);
    }

    // 瑙ｆ瀽 UID
    let uid = null;
    if (findText && findText !== 'null' && findText !== 'undefined') {
      const parsed = safeJsonParse(findText);
      if (parsed && parsed.uid) {
        uid = parsed.uid;
      } else if (/^\d+$/.test(findText.trim())) {
        uid = findText.trim();
      }
    }

    if (!uid) {
      console.log(`[StoryGuide] Delete ${entryType} (${targetType}): ${entryName} not found in world book`);
      // 浠嶇劧浠庣紦瀛樹腑鍒犻櫎
      delete entriesCache[cacheKey];
      return { deleted: true, name: entryName, source: 'cache_only' };
    }

    // SillyTavern 娌℃湁 /delentry 鍛戒护锛屾敼涓虹鐢ㄦ潯鐩苟鏍囪涓哄凡鍒犻櫎
    // 1. 璁剧疆 disable=1锛堢鐢ㄦ潯鐩級
    // 2. 娓呯┖鍐呭鎴栨爣璁颁负宸插垹闄?

    // 鏋勫缓鏂囦欢琛ㄨ揪寮忥紙chatbook 闇€瑕佺壒娈婂鐞嗭級
    let fileExpr;
    const fileVar = 'sgTmpDeleteFile';
    if (target === 'chatbook') {
      // 浣跨敤 setvar/getvar 绠￠亾鑾峰彇 chatbook 鏂囦欢鍚?
      await execSlash(`/getchatbook | /setvar key=${fileVar}`);
      fileExpr = `{{getvar::${fileVar}}}`;
    } else {
      fileExpr = quoteSlashValue(file);
    }

    const disableExpr = `/setentryfield file=${fileExpr} uid=${uid} field=disable 1`;
    await execSlash(disableExpr);

    // 淇敼 comment 涓哄凡鍒犻櫎鏍囪
    const deletedComment = `[宸插垹闄 ${comment}`;
    const commentExpr = `/setentryfield file=${fileExpr} uid=${uid} field=comment ${quoteSlashValue(deletedComment)}`;
    await execSlash(commentExpr);

    // 娓呯┖瑙﹀彂璇嶏紙閬垮厤琚Е鍙戯級
    const keyExpr = `/setentryfield file=${fileExpr} uid=${uid} field=key ""`;
    await execSlash(keyExpr);

    // 娓呯悊涓存椂鍙橀噺
    if (target === 'chatbook') {
      await execSlash(`/flushvar ${fileVar}`);
    }

    // 浠庣紦瀛樹腑鍒犻櫎
    delete entriesCache[cacheKey];

    console.log(`[StoryGuide] Disabled ${entryType} (${targetType}): ${entryName} (UID: ${uid})`);
    return { deleted: true, name: entryName, uid, targetType };
  } catch (e) {
    console.warn(`[StoryGuide] Delete ${entryType} (${targetType}) failed:`, e);
    // 浠嶇劧浠庣紦瀛樹腑鍒犻櫎锛堥伩鍏嶄笅娆″啀娆″皾璇曪級
    delete entriesCache[cacheKey];
    return null;
  }
}

// 鍒犻櫎瑙掕壊鏉＄洰
async function deleteCharacterEntry(charName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('character', charName, meta, settings, {
      entriesCache: meta.characterEntries,
      prefix: settings.characterEntryPrefix || '浜虹墿',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('character', charName, meta, settings, {
      entriesCache: meta.characterEntries,
      prefix: settings.characterEntryPrefix || '浜虹墿',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 鍒犻櫎瑁呭鏉＄洰
async function deleteEquipmentEntry(equipName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('equipment', equipName, meta, settings, {
      entriesCache: meta.equipmentEntries,
      prefix: settings.equipmentEntryPrefix || '瑁呭',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('equipment', equipName, meta, settings, {
      entriesCache: meta.equipmentEntries,
      prefix: settings.equipmentEntryPrefix || '瑁呭',
      targetType: 'blue',
    });
    if (r) results.push(r);
  }
  return results.length ? results : null;
}

// 鍒犻櫎鑳藉姏鏉＄洰
async function deleteAbilityEntry(abilityName, meta, settings) {
  const results = [];
  if (settings.summaryToWorldInfo) {
    const r = await deleteStructuredEntry('ability', abilityName, meta, settings, {
      entriesCache: meta.abilityEntries,
      prefix: settings.abilityEntryPrefix || '鑳藉姏',
      targetType: 'green',
    });
    if (r) results.push(r);
  }
  if (settings.summaryToBlueWorldInfo) {
    const r = await deleteStructuredEntry('ability', abilityName, meta, settings, {
      entriesCache: meta.abilityEntries,
      prefix: settings.abilityEntryPrefix || '鑳藉姏',
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
  throw new Error('鏈壘鍒板彲鐢ㄧ殑 STscript/SlashCommand 鎵ц鍑芥暟锛堟棤娉曡嚜鍔ㄥ啓鍏ヤ笘鐣屼功锛夈€?);
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
 * 鍏煎涓嶅悓鐗堟湰 SlashCommand 鎵ц鍣ㄧ殑杩斿洖鍊煎舰鎬侊細
 * - string
 * - number/boolean
 * - array
 * - object锛堝父瑙佸瓧娈碉細text/output/message/result/value/data/html...锛?
 */
function slashOutputToText(out, seen = new Set()) {
  if (out == null) return '';
  const t = typeof out;
  if (t === 'string') return out;
  if (t === 'number' || t === 'boolean') return String(out);

  if (Array.isArray(out)) {
    return out.map(x => slashOutputToText(x, seen)).filter(Boolean).join('\n');
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
 * 浠?SlashCommand 杈撳嚭涓彁鍙栦笘鐣屼功鏉＄洰 UID
 * - 鏀寔 text / object / array 澶氱褰㈡€?
 * - 鏀寔 uid=123銆乁ID:123銆佷互鍙婅繑鍥炲璞￠噷鐩存帴鍖呭惈 uid 瀛楁
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
    const m1 = s.match(/\buid\s*[:=]\s*(\d{1,12})\b/i);
    if (m1) return Number.parseInt(m1[1], 10);
    const m2 = s.match(/\b(\d{1,12})\b/);
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
  const s = String(v ?? '').replace(/"/g, '\\"');
  return `"${s}"`;
}

async function writeSummaryToWorldInfoEntry(rec, meta, {
  target = 'file',
  file = '',
  commentPrefix = '鍓ф儏鎬荤粨',
  constant = 0,
} = {}) {
  const kws = sanitizeKeywords(rec.keywords);
  const range = rec?.range ? `${rec.range.fromFloor}-${rec.range.toFloor}` : '';
  const prefix = String(commentPrefix || '鍓ф儏鎬荤粨').trim() || '鍓ф儏鎬荤粨';
  const rawTitle = String(rec.title || '').trim();

  const s = ensureSettings();
  const keyMode = String(s.summaryWorldInfoKeyMode || 'keywords');
  const indexId = String(rec?.indexId || '').trim();
  const indexInComment = (keyMode === 'indexId') && !!s.summaryIndexInComment && !!indexId;
  // comment 瀛楁閫氬父灏辨槸涓栫晫涔﹀垪琛ㄩ噷鐨?鏍囬"銆傝繖閲屼繚璇?prefix 濮嬬粓鍦ㄦ渶鍓嶏紝閬垮厤"鍓嶇紑璁剧疆鏃犳晥"銆?
  let commentTitle = rawTitle;
  if (prefix) {
    if (!commentTitle) commentTitle = prefix;
    else if (!commentTitle.startsWith(prefix)) commentTitle = `${prefix}锝?{commentTitle}`;
  }
  // 鑻ュ惎鐢ㄢ€滅储寮曠紪鍙疯Е鍙戔€濓細鎶?A-001 鍐欒繘 comment锛屼究浜庡湪涓栫晫涔﹀垪琛ㄩ噷涓€鐪煎畾浣嶃€?
  if (indexInComment) {
    if (!commentTitle.includes(indexId)) {
      if (commentTitle === prefix) commentTitle = `${prefix}锝?{indexId}`;
      else if (commentTitle.startsWith(`${prefix}锝渀)) commentTitle = commentTitle.replace(`${prefix}锝渀, `${prefix}锝?{indexId}锝渀);
      else commentTitle = `${prefix}锝?{indexId}锝?{commentTitle}`;
      commentTitle = commentTitle.replace(/锝滐綔+/g, '锝?);
    }
  }
  if (!commentTitle) commentTitle = '鍓ф儏鎬荤粨';
  const comment = `${commentTitle}${range ? `锛?{range}锛塦 : ''}`;

  // normalize content and make it safe for slash parser (avoid accidental pipe split)
  const content = String(rec.summary || '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '锝?);

  const t = String(target || 'file');
  const f = String(file || '').trim();
  if (t === 'file' && !f) throw new Error('WorldInfo 鐩爣涓?file 鏃跺繀椤诲～鍐欎笘鐣屼功鏂囦欢鍚嶃€?);

  // We purposely avoid parsing UID in JS, because some ST builds return only a status object
  // (e.g. {pipe:"0", ...}) even when the command pipes the UID internally.
  // Instead, we build a single STscript pipeline that:
  // 1) resolves chatbook file name (if needed)
  // 2) creates the entry (UID goes into pipe)
  // 3) stores UID into a local var
  // 4) sets fields using the stored UID
  // This works regardless of whether JS can read the piped output.
  const uidVar = '__sg_summary_uid';
  const fileVar = '__sg_summary_wbfile';

  const keyValue = (kws.length ? kws.join(',') : prefix);
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
    throw new Error(`鍐欏叆涓栫晫涔﹀け璐ワ紙杩斿洖锛?{safeStringifyShort(out)}锛塦);
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

function stopSummary() {
  if (isSummarizing) {
    summaryCancelled = true;
    console.log('[StoryGuide] Summary stop requested');
  }
}

async function runSummary({ reason = 'manual', manualFromFloor = null, manualToFloor = null, manualSplit = null } = {}) {
  const s = ensureSettings();
  const ctx = SillyTavern.getContext();

  if (reason === 'auto' && !s.enabled) return;

  if (isSummarizing) return;
  isSummarizing = true;
  summaryCancelled = false;
  setStatus('鎬荤粨涓€?, 'warn');
  showToast('姝ｅ湪鎬荤粨鈥?, { kind: 'warn', spinner: true, sticky: true });

  try {
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const mode = String(s.summaryCountMode || 'assistant');
    const floorNow = computeFloorCount(chat, mode);

    let meta = getSummaryMeta();
    if (!meta || typeof meta !== 'object') meta = getDefaultSummaryMeta();
    // choose range(s)
    const every = clampInt(s.summaryEvery, 1, 200, 20);
    const segments = [];

    if (reason === 'manual_range') {
      const resolved0 = resolveChatRangeByFloors(chat, mode, manualFromFloor, manualToFloor);
      if (!resolved0) {
        setStatus('鎵嬪姩妤煎眰鑼冨洿鏃犳晥锛堣妫€鏌ヨ捣姝㈠眰鍙凤級', 'warn');
        showToast('鎵嬪姩妤煎眰鑼冨洿鏃犳晥锛堣妫€鏌ヨ捣姝㈠眰鍙凤級', { kind: 'warn', spinner: false, sticky: false, duration: 2200 });
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
          const r = resolveChatRangeByFloors(chat, mode, f, g);
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
      const startIdx = findStartIndexForLastNFloors(chat, mode, every);
      const fromFloor = Math.max(1, floorNow - every + 1);
      const toFloor = floorNow;
      const endIdx = Math.max(0, chat.length - 1);
      segments.push({ startIdx, endIdx, fromFloor, toFloor, floorNow });
    }

    const totalSeg = segments.length;
    if (!totalSeg) {
      setStatus('娌℃湁鍙€荤粨鐨勫唴瀹癸紙鑼冨洿涓虹┖锛?, 'warn');
      showToast('娌℃湁鍙€荤粨鐨勫唴瀹癸紙鑼冨洿涓虹┖锛?, { kind: 'warn', spinner: false, sticky: false, duration: 2200 });
      return;
    }

    const affectsProgress = (reason !== 'manual_range');
    const keyMode = String(s.summaryWorldInfoKeyMode || 'keywords');

    let created = 0;
    let wroteGreenOk = 0;
    let wroteBlueOk = 0;
    const writeErrs = [];
    const runErrs = [];

    // 璇诲彇 stat_data锛堝鏋滃惎鐢級
    let summaryStatData = null;
    if (s.summaryReadStatData) {
      try {
        const { statData } = await resolveStatDataComprehensive(chat, {
          ...s,
          wiRollStatVarName: s.summaryStatVarName || 'stat_data'
        });
        if (statData) {
          summaryStatData = statData;
          console.log('[StoryGuide] Summary loaded stat_data:', summaryStatData);
        }
      } catch (e) {
        console.warn('[StoryGuide] Failed to load stat_data for summary:', e);
      }
    }

    for (let i = 0; i < segments.length; i++) {
      // 妫€鏌ユ槸鍚﹁鍙栨秷
      if (summaryCancelled) {
        setStatus('鎬荤粨宸插彇娑?, 'warn');
        showToast('鎬荤粨宸插彇娑?, { kind: 'warn', spinner: false, sticky: false, duration: 2000 });
        break;
      }

      const seg = segments[i];
      const startIdx = seg.startIdx;
      const endIdx = seg.endIdx;
      const fromFloor = seg.fromFloor;
      const toFloor = seg.toFloor;

      if (totalSeg > 1) setStatus(`鎵嬪姩鍒嗘鎬荤粨涓€︼紙${i + 1}/${totalSeg}锝?{fromFloor}-${toFloor}锛塦, 'warn');
      else setStatus('鎬荤粨涓€?, 'warn');

      const chunkText = buildSummaryChunkTextRange(chat, startIdx, endIdx, s.summaryMaxCharsPerMessage, s.summaryMaxTotalChars);
      if (!chunkText) {
        runErrs.push(`${fromFloor}-${toFloor}锛氱墖娈典负绌篳);
        continue;
      }

      const messages = buildSummaryPromptMessages(chunkText, fromFloor, toFloor, summaryStatData);
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
      if (!parsed || !parsed.summary) {
        runErrs.push(`${fromFloor}-${toFloor}锛氭€荤粨杈撳嚭鏃犳硶瑙ｆ瀽涓?JSON`);
        continue;
      }

      const prefix = String(s.summaryWorldInfoCommentPrefix || '鍓ф儏鎬荤粨').trim() || '鍓ф儏鎬荤粨';
      const rawTitle = String(parsed.title || '').trim();
      const summary = String(parsed.summary || '').trim();
      const modelKeywords = sanitizeKeywords(parsed.keywords);
      let indexId = '';
      let keywords = modelKeywords;

      if (keyMode === 'indexId') {
        // init nextIndex
        if (!Number.isFinite(Number(meta.nextIndex))) {
          let maxN = 0;
          const pref = String(s.summaryIndexPrefix || 'A-');
          const re = new RegExp('^' + escapeRegExp(pref) + '(\\d+)$');
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
        keywords = [indexId];
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
      };

      if (keyMode === 'indexId') {
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

      // 鍚屾杩涜摑鐏储寮曠紦瀛橈紙鐢ㄤ簬鏈湴鍖归厤/棰勭瓫閫夛級
      try { appendToBlueIndexCache(rec); } catch { /* ignore */ }

      // 鐢熸垚缁撴瀯鍖栦笘鐣屼功鏉＄洰锛堜汉鐗?瑁呭/鑳藉姏 - 涓庡墽鎯呮€荤粨鍚屼竴浜嬪姟锛?
      if (s.structuredEntriesEnabled && (s.summaryToWorldInfo || s.summaryToBlueWorldInfo)) {
        try {
          const structuredResult = await generateStructuredEntries(chunkText, fromFloor, toFloor, meta, s, summaryStatData);
          console.log('[StoryGuide] Structured entries result:', structuredResult);
          if (structuredResult) {
            // 鍐欏叆/鏇存柊浜虹墿鏉＄洰锛堝幓閲嶇敱 writeOrUpdate 鍐呴儴澶勭悊锛?
            if (s.characterEntriesEnabled && structuredResult.characters?.length) {
              console.log(`[StoryGuide] Processing ${structuredResult.characters.length} character(s)`);
              for (const char of structuredResult.characters) {
                await writeOrUpdateCharacterEntry(char, meta, s);
              }
            }
            // 鍐欏叆/鏇存柊瑁呭鏉＄洰
            if (s.equipmentEntriesEnabled && structuredResult.equipments?.length) {
              console.log(`[StoryGuide] Processing ${structuredResult.equipments.length} equipment(s)`);
              for (const equip of structuredResult.equipments) {
                await writeOrUpdateEquipmentEntry(equip, meta, s);
              }
            }
            // 鍐欏叆/鏇存柊鑳藉姏鏉＄洰
            if (s.abilityEntriesEnabled && structuredResult.abilities?.length) {
              console.log(`[StoryGuide] Processing ${structuredResult.abilities.length} ability(s)`);
              for (const ability of structuredResult.abilities) {
                await writeOrUpdateAbilityEntry(ability, meta, s);
              }
            }

            // 澶勭悊鍒犻櫎鐨勬潯鐩?
            if (structuredResult.deletedCharacters?.length) {
              console.log(`[StoryGuide] Deleting ${structuredResult.deletedCharacters.length} character(s)`);
              for (const charName of structuredResult.deletedCharacters) {
                await deleteCharacterEntry(charName, meta, s);
              }
            }
            if (structuredResult.deletedEquipments?.length) {
              console.log(`[StoryGuide] Deleting ${structuredResult.deletedEquipments.length} equipment(s)`);
              for (const equipName of structuredResult.deletedEquipments) {
                await deleteEquipmentEntry(equipName, meta, s);
              }
            }
            if (structuredResult.deletedAbilities?.length) {
              console.log(`[StoryGuide] Deleting ${structuredResult.deletedAbilities.length} ability(s)`);
              for (const abilityName of structuredResult.deletedAbilities) {
                await deleteAbilityEntry(abilityName, meta, s);
              }
            }

            await setSummaryMeta(meta);
          }
        } catch (e) {
          console.warn('[StoryGuide] Structured entries generation failed:', e);
          // 缁撴瀯鍖栨潯鐩敓鎴愬け璐ヤ笉闃绘柇涓绘祦绋?
        }
      }

      // world info write
      if (s.summaryToWorldInfo || s.summaryToBlueWorldInfo) {
        if (s.summaryToWorldInfo) {
          try {
            await writeSummaryToWorldInfoEntry(rec, meta, {
              target: String(s.summaryWorldInfoTarget || 'chatbook'),
              file: String(s.summaryWorldInfoFile || ''),
              commentPrefix: String(s.summaryWorldInfoCommentPrefix || '鍓ф儏鎬荤粨'),
              constant: 0,
            });
            wroteGreenOk += 1;
          } catch (e) {
            console.warn('[StoryGuide] write green world info failed:', e);
            writeErrs.push(`${fromFloor}-${toFloor} 缁跨伅锛?{e?.message ?? e}`);
          }
        }

        if (s.summaryToBlueWorldInfo) {
          try {
            await writeSummaryToWorldInfoEntry(rec, meta, {
              target: 'file',
              file: String(s.summaryBlueWorldInfoFile || ''),
              commentPrefix: String(s.summaryBlueWorldInfoCommentPrefix || s.summaryWorldInfoCommentPrefix || '鍓ф儏鎬荤粨'),
              constant: 1,
            });
            wroteBlueOk += 1;
          } catch (e) {
            console.warn('[StoryGuide] write blue world info failed:', e);
            writeErrs.push(`${fromFloor}-${toFloor} 钃濈伅锛?{e?.message ?? e}`);
          }
        }
      }
    }

    updateSummaryInfoLabel();
    renderSummaryPaneFromMeta();

    // 鑻ュ惎鐢ㄥ疄鏃惰鍙栫储寮曪細鍦ㄦ墜鍔ㄥ垎娈靛啓鍏ヨ摑鐏悗锛屽敖蹇埛鏂颁竴娆＄紦瀛?
    if (s.summaryToBlueWorldInfo && String(ensureSettings().wiBlueIndexMode || 'live') === 'live') {
      ensureBlueIndexLive(true).catch(() => void 0);
    }

    if (created <= 0) {
      setStatus(`鎬荤粨鏈敓鎴愶紙${runErrs.length ? runErrs[0] : '鏈煡鍘熷洜'}锛塦, 'warn');
      showToast(`鎬荤粨鏈敓鎴愶紙${runErrs.length ? runErrs[0] : '鏈煡鍘熷洜'}锛塦, { kind: 'warn', spinner: false, sticky: false, duration: 2600 });
      return;
    }

    // final status
    if (totalSeg > 1) {
      const parts = [`鐢熸垚 ${created} 鏉];
      if (s.summaryToWorldInfo || s.summaryToBlueWorldInfo) {
        const wrote = [];
        if (s.summaryToWorldInfo) wrote.push(`缁跨伅 ${wroteGreenOk}/${created}`);
        if (s.summaryToBlueWorldInfo) wrote.push(`钃濈伅 ${wroteBlueOk}/${created}`);
        if (wrote.length) parts.push(`鍐欏叆锛?{wrote.join('锝?)}`);
      }
      const errCount = writeErrs.length + runErrs.length;
      if (errCount) {
        const sample = (writeErrs.concat(runErrs)).slice(0, 2).join('锛?);
        setStatus(`鎵嬪姩鍒嗘鎬荤粨瀹屾垚 鉁咃紙${parts.join('锝?)}锝滃け璐ワ細${errCount}锝?{sample}${errCount > 2 ? '鈥? : ''}锛塦, 'warn');
      } else {
        setStatus(`鎵嬪姩鍒嗘鎬荤粨瀹屾垚 鉁咃紙${parts.join('锝?)}锛塦, 'ok');
      }
    } else {
      // single
      if (s.summaryToWorldInfo || s.summaryToBlueWorldInfo) {
        const ok = [];
        const err = [];
        if (s.summaryToWorldInfo) {
          if (wroteGreenOk >= 1) ok.push('缁跨伅涓栫晫涔?);
          else if (writeErrs.find(x => x.includes('缁跨伅'))) err.push(writeErrs.find(x => x.includes('缁跨伅')));
        }
        if (s.summaryToBlueWorldInfo) {
          if (wroteBlueOk >= 1) ok.push('钃濈伅涓栫晫涔?);
          else if (writeErrs.find(x => x.includes('钃濈伅'))) err.push(writeErrs.find(x => x.includes('钃濈伅')));
        }
        if (!err.length) setStatus(`鎬荤粨瀹屾垚 鉁咃紙宸插啓鍏ワ細${ok.join(' + ') || '锛堟棤锛?}锛塦, 'ok');
        else setStatus(`鎬荤粨瀹屾垚 鉁咃紙鍐欏叆澶辫触锛?{err.join('锛?)}锛塦, 'warn');
      } else {
        setStatus('鎬荤粨瀹屾垚 鉁?, 'ok');
      }
    }

    // toast notify (non-blocking)
    try {
      const errCount = (writeErrs?.length || 0) + (runErrs?.length || 0);
      const kind = errCount ? 'warn' : 'ok';
      const text = (totalSeg > 1)
        ? (errCount ? '鍒嗘鎬荤粨瀹屾垚 鈿狅笍' : '鍒嗘鎬荤粨瀹屾垚 鉁?)
        : (errCount ? '鎬荤粨瀹屾垚 鈿狅笍' : '鎬荤粨瀹屾垚 鉁?);
      showToast(text, { kind, spinner: false, sticky: false, duration: errCount ? 2600 : 1700 });
    } catch { /* ignore toast errors */ }



  } catch (e) {
    console.error('[StoryGuide] Summary failed:', e);
    const msg = (e && (e.message || String(e))) ? (e.message || String(e)) : '鏈煡閿欒';
    setStatus(`鎬荤粨澶辫触 鉂岋紙${msg}锛塦, 'err');
    showToast(`鎬荤粨澶辫触 鉂岋紙${msg}锛塦, { kind: 'err', spinner: false, sticky: false, duration: 3200 });
  } finally {

    isSummarizing = false;
    updateButtonsEnabled();
    // avoid stuck "姝ｅ湪鎬荤粨" toast on unexpected exits
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

async function maybeAutoSummary(reason = '') {
  const s = ensureSettings();
  if (!s.enabled) return;
  if (!s.summaryEnabled) return;
  if (isSummarizing) return;

  const ctx = SillyTavern.getContext();
  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  const mode = String(s.summaryCountMode || 'assistant');
  const every = clampInt(s.summaryEvery, 1, 200, 20);
  const floorNow = computeFloorCount(chat, mode);
  if (floorNow <= 0) return;
  if (floorNow % every !== 0) return;

  const meta = getSummaryMeta();
  const last = Number(meta?.lastFloor || 0);
  if (floorNow <= last) return;

  await runSummary({ reason: 'auto' });
}

// -------------------- 钃濈伅绱㈠紩 鈫?缁跨伅瑙﹀彂锛堝彂閫佹秷鎭椂娉ㄥ叆瑙﹀彂璇嶏級 --------------------

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTriggerInjection(text, tag = 'SG_WI_TRIGGERS') {
  const t = String(text || '');
  const et = escapeRegExp(tag);
  // remove all existing injections of this tag (safe)
  const reComment = new RegExp(`\\n?\\s*<!--\\s*${et}\\b[\\s\\S]*?-->`, 'g');
  const rePlain = new RegExp(`\\n?\\s*\\[${et}\\][^\\n]*\\n?`, 'g');
  return t.replace(reComment, '').replace(rePlain, '').trimEnd();
}

function buildTriggerInjection(keywords, tag = 'SG_WI_TRIGGERS', style = 'hidden') {
  const kws = sanitizeKeywords(Array.isArray(keywords) ? keywords : []);
  if (!kws.length) return '';
  if (String(style || 'hidden') === 'plain') {
    // Visible but most reliable for world-info scan.
    return `\n\n[${tag}] ${kws.join(' ')}\n`;
  }
  // Hidden comment: put each keyword on its own line, so substring match is very likely to hit.
  const body = kws.join('\n');
  return `\n\n<!--${tag}\n${body}\n-->`;
}

// -------------------- ROLL 鍒ゅ畾 --------------------
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
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
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
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^([a-zA-Z0-9_.\[\]-]+)\s*[:=]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
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

  const enforced = user + `\n\n` + ROLL_JSON_REQUIREMENT;
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

  const enforced = user + `\n\n` + ROLL_DECISION_JSON_REQUIREMENT;
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
  const outcome = String(res.outcomeTier || '').trim() || (success == null ? 'N/A' : (success ? '鎴愬姛' : '澶辫触'));

  if (String(style || 'hidden') === 'plain') {
    return `\n\n[${tag}] 鍔ㄤ綔=${action} | 缁撴灉=${outcome} | 鏈€缁?${final.toFixed(2)} | 闃堝€?=${threshold == null ? 'N/A' : threshold} | 鍩虹=${base.toFixed(2)} | 闅忔満=1d100:${roll}*${weight} | 淇=${modLine} | 鍏紡=${formula}\n`;
  }

  return `\n\n<!--${tag}\n鍔ㄤ綔=${action}\n缁撴灉=${outcome}\n鏈€缁?${final.toFixed(2)}\n闃堝€?=${threshold == null ? 'N/A' : threshold}\n鍩虹=${base.toFixed(2)}\n闅忔満=1d100:${roll}*${weight}\n淇=${modLine}\n鍏紡=${formula}\n-->`;
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

  // 鎵╁睍鎵€鏈夊彲鑳界殑鍙橀噺鏉ユ簮锛屾寜浼樺厛绾ф帓搴?
  const sources = [
    // 浼樺厛浠?context 鑾峰彇锛堟渶鏂板€硷級
    ctx?.variables,
    ctx?.chatMetadata?.variables,
    ctx?.chatMetadata,
    // 鍏ㄥ眬鍙橀噺瀛樺偍
    globalThis?.SillyTavern?.chatVariables,
    globalThis?.SillyTavern?.variables,
    globalThis?.variables,
    globalThis?.chatVariables,
    // extension_settings 涓彲鑳藉瓨鍌ㄧ殑鍙橀噺
    ctx?.extensionSettings?.variables,
    // window 瀵硅薄涓婄殑鍙橀噺
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

  // 濡傛灉涓婅堪鏉ユ簮閮芥病鎵惧埌锛屽皾璇曚粠 chat 鏁扮粍涓殑鏈€鍚庝竴鏉℃秷鎭殑 extra 瀛楁璇诲彇
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
  const tpl = `<status_current_variable>\n{{format_message_variable::stat_data}}\n</status_current_variable>`;
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
 * 鏈€绋冲畾鐨勫彉閲忚鍙栨柟寮忥細閫氳繃 /getvar 鏂滄潬鍛戒护璇诲彇鍙橀噺
 * 鐢变簬 SillyTavern 鍙橀噺绯荤粺鍙兘瀛樺湪缂撳瓨鎴栦笂涓嬫枃涓嶅悓姝ラ棶棰橈紝
 * 浣跨敤 slash command 鍙互纭繚璇诲彇鍒版渶鏂扮殑鍙橀噺鍊?
 */
async function resolveStatDataViaSlashCommand(settings) {
  const s = settings || ensureSettings();
  const key = String(s.wiRollStatVarName || 'stat_data').trim();
  if (!key) return { statData: null, rawText: '' };

  try {
    // 灏濊瘯浣跨敤 /getvar 鍛戒护璇诲彇鍙橀噺锛堟渶绋冲畾鐨勬柟寮忥級
    const result = await execSlash(`/getvar ${key}`);
    const raw = slashOutputToText(result);

    if (!raw || raw.trim() === '' || raw.trim() === 'undefined' || raw.trim() === 'null') {
      return { statData: null, rawText: '' };
    }

    // 瑙ｆ瀽鍙橀噺鍐呭
    if (typeof raw === 'string') {
      // 灏濊瘯 JSON 瑙ｆ瀽
      const parsed = parseStatData(raw, s.wiRollStatParseMode || 'json');
      if (parsed) {
        return { statData: parsed, rawText: raw };
      }
    }

    return { statData: null, rawText: raw };
  } catch (e) {
    // /getvar 鍛戒护澶辫触鏃堕潤榛樺鐞嗭紝鍥為€€鍒板叾浠栨柟娉?
    console.debug('[StoryGuide] resolveStatDataViaSlashCommand failed:', e);
    return { statData: null, rawText: '' };
  }
}

/**
 * 鎵╁睍鐨勫彉閲忚鍙栵細灏濊瘯浠?chat 鏁扮粍涓殑鏈€鏂版秷鎭鍙栧彉閲忥紙鐩存帴璇诲彇 DOM锛?
 * 浣滀负鍙橀噺瀛樺偍鍜屾ā鏉挎柟娉曠殑琛ュ厖鍥為€€鏂规
 */
function resolveStatDataFromChatDOM(settings) {
  const s = settings || ensureSettings();
  const key = String(s.wiRollStatVarName || 'stat_data').trim();
  if (!key) return { statData: null, rawText: '' };

  try {
    // 灏濊瘯浠?DOM 涓煡鎵炬渶杩戠殑鐘舵€佸潡
    const chatContainer = document.querySelector('#chat, .chat, [id*="chat"]');
    if (!chatContainer) return { statData: null, rawText: '' };

    // 鏌ユ壘鎵€鏈夋秷鎭潡
    const messages = chatContainer.querySelectorAll('.mes, [class*="message"]');
    if (!messages.length) return { statData: null, rawText: '' };

    // 浠庡悗寰€鍓嶆煡鎵惧寘鍚姸鎬佹暟鎹殑娑堟伅
    for (let i = messages.length - 1; i >= Math.max(0, messages.length - 10); i--) {
      const msg = messages[i];
      if (!msg) continue;

      // 璺宠繃鐢ㄦ埛娑堟伅
      const isUser = msg.classList.contains('user_mes') || msg.dataset.isUser === 'true';
      if (isUser) continue;

      const textEl = msg.querySelector('.mes_text, .message-text, [class*="mes_text"]');
      if (!textEl) continue;

      const text = textEl.innerText || textEl.textContent || '';
      if (!text) continue;

      // 灏濊瘯鎻愬彇鐘舵€佸潡
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
 * 缁煎悎鏌ユ壘鍙橀噺鏁版嵁锛氬皾璇曞绉嶆潵婧愪互纭繚鑳借鍙栧埌鏈€鏂版暟鎹?
 * 鎸変紭鍏堢骇渚濇灏濊瘯锛?
 * 1. /getvar 鏂滄潬鍛戒护锛堟渶绋冲畾锛?
 * 2. 鍙橀噺瀛樺偍瀵硅薄
 * 3. 妯℃澘娓叉煋
 * 4. 浠?DOM 璇诲彇
 * 5. 浠庢渶鏂?AI 鍥炲璇诲彇
 */
async function resolveStatDataComprehensive(chat, settings) {
  const s = settings || ensureSettings();

  // 鏂规硶1锛氫娇鐢?/getvar 鏂滄潬鍛戒护锛堟渶绋冲畾锛?
  try {
    const { statData, rawText } = await resolveStatDataViaSlashCommand(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via /getvar slash command');
      return { statData, rawText, source: 'slashCommand' };
    }
  } catch { /* continue */ }

  // 鏂规硶2锛氫粠鍙橀噺瀛樺偍瀵硅薄璇诲彇
  try {
    const { statData, rawText } = resolveStatDataFromVariableStore(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via variable store');
      return { statData, rawText, source: 'variableStore' };
    }
  } catch { /* continue */ }

  // 鏂规硶3锛氶€氳繃妯℃澘娓叉煋璇诲彇
  try {
    const { statData, rawText } = await resolveStatDataFromTemplate(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via template rendering');
      return { statData, rawText, source: 'template' };
    }
  } catch { /* continue */ }

  // 鏂规硶4锛氫粠 DOM 璇诲彇
  try {
    const { statData, rawText } = resolveStatDataFromChatDOM(s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via DOM');
      return { statData, rawText, source: 'dom' };
    }
  } catch { /* continue */ }

  // 鏂规硶5锛氫粠鏈€鏂?AI 鍥炲璇诲彇
  try {
    const { statData, rawText } = resolveStatDataFromLatestAssistant(chat, s);
    if (statData) {
      console.debug('[StoryGuide] Variable loaded via latest assistant message');
      return { statData, rawText, source: 'latestAssistant' };
    }
  } catch { /* continue */ }

  return { statData: null, rawText: '', source: null };
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
    // 榛樿浣跨敤缁煎悎鏂规硶锛堟渶绋冲畾锛?
    const result = await resolveStatDataComprehensive(chat, s);
    statData = result.statData;
    varSource = result.source || '';
  }
  if (!statData) {
    const name = String(s.wiRollStatVarName || 'stat_data').trim() || 'stat_data';
    logStatus(`ROLL 鏈Е鍙戯細鏈鍙栧埌鍙橀噺锛?{name}锛塦, 'warn');
    return;
  }
  if (s.wiRollDebugLog && varSource) {
    console.debug(`[StoryGuide] ROLL 鍙橀噺璇诲彇鏉ユ簮: ${varSource}`);
  }

  const randomRoll = rollDice(100);
  let res = null;
  const canUseCustom = String(s.wiRollProvider || 'custom') === 'custom' && String(s.wiRollCustomEndpoint || '').trim();
  if (canUseCustom) {
    try {
      res = await computeRollDecisionViaCustom(lastText, statData, s, randomRoll);
      if (res?.noRoll) {
        logStatus('ROLL 鏈Е鍙戯細AI 鍒ゅ畾鏃犻渶鍒ゅ畾', 'info');
        return;
      }
    } catch (e) {
      console.warn('[StoryGuide] roll custom provider failed; fallback to local', e);
    }
  }
  if (!res) {
    logStatus('ROLL 鏈Е鍙戯細AI 鍒ゅ畾澶辫触鎴栨棤缁撴灉', 'warn');
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
      logStatus('ROLL 宸叉敞鍏ワ細鍒ゅ畾瀹屾垚', 'ok');
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
    // 榛樿浣跨敤缁煎悎鏂规硶锛堟渶绋冲畾锛?
    const result = await resolveStatDataComprehensive(chat, s);
    statData = result.statData;
    varSource = result.source || '';
  }
  if (!statData) {
    const name = String(s.wiRollStatVarName || 'stat_data').trim() || 'stat_data';
    logStatus?.(`ROLL 鏈Е鍙戯細鏈鍙栧埌鍙橀噺锛?{name}锛塦, 'warn');
    return null;
  }
  if (s.wiRollDebugLog && varSource) {
    console.debug(`[StoryGuide] buildRollInjectionForText 鍙橀噺璇诲彇鏉ユ簮: ${varSource}`);
  }

  const randomRoll = rollDice(100);
  let res = null;
  const canUseCustom = String(s.wiRollProvider || 'custom') === 'custom' && String(s.wiRollCustomEndpoint || '').trim();
  if (canUseCustom) {
    try {
      res = await computeRollDecisionViaCustom(userText, statData, s, randomRoll);
      if (res?.noRoll) {
        logStatus?.('ROLL 鏈Е鍙戯細AI 鍒ゅ畾鏃犻渶鍒ゅ畾', 'info');
        return null;
      }
    } catch (e) {
      console.warn('[StoryGuide] roll custom provider failed; fallback to local', e);
    }
  }
  if (!res) {
    logStatus?.('ROLL 鏈Е鍙戯細AI 鍒ゅ畾澶辫触鎴栨棤缁撴灉', 'warn');
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
  if (rollText) logStatus?.('ROLL 宸叉敞鍏ワ細鍒ゅ畾瀹屾垚', 'ok');
  return rollText || null;
}

async function buildTriggerInjectionForText(userText, chat, settings, logStatus) {
  const s = settings || ensureSettings();
  if (!s.wiTriggerEnabled) return null;

  const startAfter = clampInt(s.wiTriggerStartAfterAssistantMessages, 0, 200000, 0);
  if (startAfter > 0) {
    const assistantFloors = computeFloorCount(chat, 'assistant');
    if (assistantFloors < startAfter) {
      logStatus?.(`绱㈠紩鏈Е鍙戯細AI 妤煎眰涓嶈冻 ${assistantFloors}/${startAfter}`, 'info');
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
  } else {
    picked = pickRelevantIndexEntries(recentText, userText, candidates, maxEntries, minScore, includeUser, userWeight);
  }
  if (!picked.length) return null;

  const maxKeywords = clampInt(s.wiTriggerMaxKeywords, 1, 200, 24);
  const kwSet = new Set();
  const pickedNames = [];
  for (const { e } of picked) {
    const name = String(e.title || '').trim() || '鏉＄洰';
    pickedNames.push(name);
    for (const k of (Array.isArray(e.keywords) ? e.keywords : [])) {
      const kk = String(k || '').trim();
      if (!kk) continue;
      kwSet.add(kk);
      if (kwSet.size >= maxKeywords) break;
    }
    if (kwSet.size >= maxKeywords) break;
  }
  const keywords = Array.from(kwSet);
  if (!keywords.length) return null;

  const style = String(s.wiTriggerInjectStyle || 'hidden').trim() || 'hidden';
  const injected = buildTriggerInjection(keywords, tagForStrip, style);
  if (injected) logStatus?.(`绱㈠紩宸叉敞鍏ワ細${pickedNames.slice(0, 4).join('銆?)}${pickedNames.length > 4 ? '鈥? : ''}`, 'ok');
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
  const cjkSeqs = s.match(/[\u4e00-\u9fff]{2,}/g) || [];
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
  return msgs.reverse().join('\n');
}

function getBlueIndexEntriesFast() {
  const s = ensureSettings();
  const mode = String(s.wiBlueIndexMode || 'live');
  if (mode !== 'live') return (Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : []);

  const file = pickBlueIndexFileName();
  if (!file) return (Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : []);

  const minSec = clampInt(s.wiBlueIndexMinRefreshSec, 5, 600, 20);
  const now = Date.now();
  const ageMs = now - Number(blueIndexLiveCache.loadedAt || 0);
  const need = (blueIndexLiveCache.file !== file) || ageMs > (minSec * 1000);

  // 娉ㄦ剰锛氫负浜嗗敖閲忎笉闃诲 MESSAGE_SENT锛堢‘淇濊Е鍙戣瘝娉ㄥ叆鍦ㄧ敓鎴愬墠瀹屾垚锛夛紝杩欓噷涓?await銆?
  // 濡傛灉闇€瑕佸埛鏂帮紝灏卞悗鍙版媺鍙栦竴娆★紝涓嬫娑堟伅鍗冲彲浣跨敤鏈€鏂扮储寮曘€?
  if (need) {
    ensureBlueIndexLive(false).catch(() => void 0);
  }

  const live = Array.isArray(blueIndexLiveCache.entries) ? blueIndexLiveCache.entries : [];
  if (live.length) return live;
  return (Array.isArray(s.summaryBlueIndex) ? s.summaryBlueIndex : []);
}

function collectBlueIndexCandidates() {
  const s = ensureSettings();
  const meta = getSummaryMeta();
  const out = [];
  const seen = new Set();

  const fromMeta = Array.isArray(meta?.history) ? meta.history : [];
  for (const r of fromMeta) {
    const title = String(r?.title || '').trim();
    const summary = String(r?.summary || '').trim();
    const keywords = sanitizeKeywords(r?.keywords);
    if (!summary) continue;
    const key = `${title}__${summary.slice(0, 24)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: title || (keywords[0] ? `鏉＄洰锛?{keywords[0]}` : '鏉＄洰'), summary, keywords });
  }

  const fromImported = getBlueIndexEntriesFast();
  for (const r of fromImported) {
    const title = String(r?.title || '').trim();
    const summary = String(r?.summary || '').trim();
    const keywords = sanitizeKeywords(r?.keywords);
    if (!summary) continue;
    const key = `${title}__${summary.slice(0, 24)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: title || (keywords[0] ? `鏉＄洰锛?{keywords[0]}` : '鏉＄洰'), summary, keywords });
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
    const txt = `${e.title || ''}\n${e.summary || ''}\n${(Array.isArray(e.keywords) ? e.keywords.join(' ') : '')}`;
    const vec = tokenizeForSimilarity(txt);
    const score = cosineSimilarity(recentVec, vec);
    if (score >= minScore) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxEntries);
}

function buildIndexPromptMessages(recentText, userText, candidatesForModel, maxPick) {
  const s = ensureSettings();
  const sys = String(s.wiIndexSystemPrompt || DEFAULT_INDEX_SYSTEM_PROMPT).trim() || DEFAULT_INDEX_SYSTEM_PROMPT;
  const tmpl = String(s.wiIndexUserTemplate || DEFAULT_INDEX_USER_TEMPLATE).trim() || DEFAULT_INDEX_USER_TEMPLATE;

  const candidatesJson = JSON.stringify(candidatesForModel, null, 0);

  const user = tmpl
    .replaceAll('{{userMessage}}', String(userText || ''))
    .replaceAll('{{recentText}}', String(recentText || ''))
    .replaceAll('{{candidates}}', candidatesJson)
    .replaceAll('{{maxPick}}', String(maxPick));

  const enforced = user + `

` + INDEX_JSON_REQUIREMENT.replaceAll('maxPick', String(maxPick));

  return [
    { role: 'system', content: sys },
    { role: 'user', content: enforced },
  ];
}

async function pickRelevantIndexEntriesLLM(recentText, userText, candidates, maxEntries, includeUser, userWeight) {
  const s = ensureSettings();

  const topK = clampInt(s.wiIndexPrefilterTopK, 5, 80, 24);
  const candMaxChars = clampInt(s.wiIndexCandidateMaxChars, 120, 2000, 420);

  const pre = pickRelevantIndexEntries(
    recentText,
    userText,
    candidates,
    Math.max(topK, maxEntries),
    0,
    includeUser,
    userWeight
  );

  const shortlist = (pre.length ? pre : candidates.map(e => ({ e, score: 0 }))).slice(0, topK);

  const candidatesForModel = shortlist.map((x, i) => {
    const e = x.e || x;
    const title = String(e.title || '').trim();
    const summary0 = String(e.summary || '').trim();
    const summary = summary0.length > candMaxChars ? (summary0.slice(0, candMaxChars) + '鈥?) : summary0;
    const kws = Array.isArray(e.keywords) ? e.keywords.slice(0, 24) : [];
    return { id: i, title: title || '鏉＄洰', summary, keywords: kws };
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
      properties: { pickedIds: { type: 'array', items: { type: 'integer' } } },
      required: ['pickedIds'],
    };
    jsonText = await callViaSillyTavern(messages, schema, clampFloat(s.wiIndexTemperature, 0, 2, 0.2));
    if (typeof jsonText !== 'string') jsonText = JSON.stringify(jsonText ?? '');
    const parsedTry = safeJsonParse(jsonText);
    if (!parsedTry || !Array.isArray(parsedTry?.pickedIds)) {
      jsonText = await fallbackAskJson(messages, clampFloat(s.wiIndexTemperature, 0, 2, 0.2));
    }
  }

  const parsed = safeJsonParse(jsonText);
  const pickedIds = Array.isArray(parsed?.pickedIds) ? parsed.pickedIds : [];
  const uniq = Array.from(new Set(pickedIds.map(x => Number(x)).filter(n => Number.isFinite(n))));

  const picked = [];
  for (const id of uniq) {
    const origin = shortlist[id]?.e || null;
    if (origin) picked.push({ e: origin, score: Number(shortlist[id]?.score || 0) });
    if (picked.length >= maxEntries) break;
  }
  return picked;
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

  // 浠呭湪杈惧埌鎸囧畾 AI 妤煎眰鍚庢墠寮€濮嬬储寮曡Е鍙戯紙閬垮厤鍓嶆湡鍣０/娴垂锛?
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
        setStatus(`绱㈠紩鏈惎鍔細AI 鍥炲妤煎眰 ${assistantFloors}/${startAfter}`, 'info');
      }
      return;
    }
  }

  const lookback = clampInt(s.wiTriggerLookbackMessages, 5, 120, 20);
  // 鏈€杩戞鏂囷紙涓嶅惈鏈鐢ㄦ埛杈撳叆锛夛紱涓洪伩鍏嶁€滆Е鍙戣瘝娉ㄥ叆鈥濇薄鏌撶浉浼煎害锛屽厛鍓旈櫎鍚?tag 鐨勬敞鍏ョ墖娈点€?
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
  const pickedNames = [];  // entry names (绛変环浜庡皢瑙﹀彂鐨勭豢鐏潯鐩悕绉?
  const pickedForLog = [];
  for (const { e, score } of picked) {
    const name = String(e.title || '').trim() || '鏉＄洰';
    pickedNames.push(name);
    pickedTitles.push(`${name}锛?{score.toFixed(2)}锛塦);
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
    setStatus(`宸叉敞鍏ヨЕ鍙戣瘝锛?{keywords.slice(0, 12).join('銆?)}${keywords.length > 12 ? '鈥? : ''}${s.wiTriggerDebugLog ? `锝滃懡涓細${pickedTitles.join('锛?)}` : `锝滃皢瑙﹀彂锛?{pickedNames.slice(0, 4).join('锛?)}${pickedNames.length > 4 ? '鈥? : ''}`}`, 'ok');
  }
}

// -------------------- inline append (dynamic modules) --------------------

function indentForListItem(md) {
  const s = String(md || '');
  const pad = '    '; // 4 spaces to ensure nested blocks stay inside the module card
  if (!s) return pad + '锛堢┖锛?;
  return s.split('\n').map(line => pad + line).join('\n');
}

function normalizeNumberedHints(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const t = String(arr[i] ?? '').trim();
    if (!t) continue;
    // If the item already starts with 銆恘銆? keep it; else prefix with 銆恑+1銆?
    if (/^銆怽d+銆?.test(t)) out.push(t);
    else out.push(`銆?{i + 1}銆?${t}`);
  }
  return out;
}

function buildInlineMarkdownFromModules(parsedJson, modules, mode, showEmpty) {
  // mode: compact|standard
  const lines = [];
  lines.push(`**鍓ф儏鎸囧**`);

  for (const m of modules) {
    // quick_actions 妯″潡涓嶅湪 Markdown 涓覆鏌擄紝鑰屾槸鍗曠嫭娓叉煋涓哄彲鐐瑰嚮鎸夐挳
    if (m.key === 'quick_actions') continue;

    const hasKey = parsedJson && Object.hasOwn(parsedJson, m.key);
    const val = hasKey ? parsedJson[m.key] : undefined;
    const title = m.title || m.key;

    if (m.type === 'list') {
      const arr = Array.isArray(val) ? val : [];
      if (!arr.length) {
        if (showEmpty) lines.push(`- **${title}**\n${indentForListItem('锛堢┖锛?)}`);
        continue;
      }

      if (mode === 'compact') {
        const limit = Math.min(arr.length, 3);
        const picked = arr.slice(0, limit).map(x => String(x ?? '').trim()).filter(Boolean);
        lines.push(`- **${title}**
${indentForListItem(picked.join(' / '))}`);
      } else {
        // 鏍囧噯妯″紡锛氭妸鏁翠釜鍒楄〃鍚堝苟鍒板悓涓€涓ā鍧楀崱鐗囧唴锛堜互銆?銆戠瓑涓哄垎闅旀彁绀猴級
        const normalized = normalizeNumberedHints(arr);
        const joined = normalized.join('\n\n');
        lines.push(`- **${title}**\n${indentForListItem(joined)}`);
      }
    } else {
      const text = (val !== undefined && val !== null) ? String(val).trim() : '';
      if (!text) {
        if (showEmpty) lines.push(`- **${title}**\n${indentForListItem('锛堢┖锛?)}`);
        continue;
      }

      if (mode === 'compact') {
        const short = (text.length > 140 ? text.slice(0, 140) + '鈥? : text);
        lines.push(`- **${title}**
${indentForListItem(short)}`);
      } else {
        // 鏍囧噯妯″紡锛氭妸鍐呭缂╄繘鍒?list item 鍐咃紝閬垮厤鍐呴儴鍒楄〃/缂栧彿鍙樻垚鈥滃悓绾у崱鐗団€?
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

      // Footer button: collapse then scroll back to the message姝ｆ枃
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

  // 鍙覆鏌揂I鐢熸垚鐨勫姩鎬侀€夐」锛堜笉鍐嶄娇鐢ㄩ潤鎬侀厤缃殑閫夐」锛?
  let quickOptionsHtml = '';
  if (Array.isArray(quickActions) && quickActions.length) {
    quickOptionsHtml = renderDynamicQuickActionsHtml(quickActions, 'inline');
  }

  box.innerHTML = `
    <div class="sg-inline-head" title="鐐瑰嚮鎶樺彔/灞曞紑锛堜笉浼氳嚜鍔ㄧ敓鎴愶級">
      <span class="sg-inline-badge">馃摌</span>
      <span class="sg-inline-title">鍓ф儏鎸囧</span>
      <span class="sg-inline-sub">锛堝墽鎯呭垎鏋愶級</span>
      <span class="sg-inline-chevron">鈻?/span>
    </div>
    <div class="sg-inline-body">${htmlInner}</div>
    ${quickOptionsHtml}
    <div class="sg-inline-foot" title="鐐瑰嚮鎶樺彔骞跺洖鍒版鏂?>
      <span class="sg-inline-foot-icon">鈻?/span>
      <span class="sg-inline-foot-text">鏀惰捣骞跺洖鍒版鏂?/span>
      <span class="sg-inline-foot-icon">鈻?/span>
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

  // panel 妯″紡鏆備笉鏄剧ず蹇嵎閫夐」锛堝彧鍦?inline 妯″紡鏄剧ず锛?
  const quickOptionsHtml = '';

  box.innerHTML = `
    <div class="sg-panel-head" title="鐐瑰嚮鎶樺彔/灞曞紑锛堥潰鏉垮垎鏋愮粨鏋滐級">
      <span class="sg-inline-badge">馃Л</span>
      <span class="sg-inline-title">鍓ф儏鎸囧</span>
      <span class="sg-inline-sub">锛堥潰鏉挎姤鍛婏級</span>
      <span class="sg-inline-chevron">鈻?/span>
    </div>
    <div class="sg-panel-body">${htmlInner}</div>
    ${quickOptionsHtml}
    <div class="sg-panel-foot" title="鐐瑰嚮鎶樺彔骞跺洖鍒版鏂?>
      <span class="sg-inline-foot-icon">鈻?/span>
      <span class="sg-inline-foot-text">鏀惰捣骞跺洖鍒版鏂?/span>
      <span class="sg-inline-foot-icon">鈻?/span>
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
    // 鏇存柊 body锛堟湁鏃跺€欒瑕嗙洊鎴愮┖澹筹級
    const body = existing.querySelector('.sg-inline-body');
    if (body && cached.htmlInner && body.innerHTML !== cached.htmlInner) body.innerHTML = cached.htmlInner;
    // 鏇存柊鍔ㄦ€侀€夐」锛堝鏋滄湁鍙樺寲锛?
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
  // 鎵嬪姩鎸夐挳鍏佽鍦ㄥ叧闂€滆嚜鍔ㄨ拷鍔犫€濇椂涔熺敓鎴?
  if (!s.autoAppendBox && !allow) return;

  const ref = getLastAssistantMessageRef();
  if (!ref) return;

  const { mesKey } = ref;

  if (force) {
    inlineCache.delete(String(mesKey));
  }

  // 濡傛灉宸茬粡缂撳瓨杩囷細闈炲己鍒跺垯鍙ˉ璐翠竴娆★紱寮哄埗鍒欓噸鏂拌姹?
  if (inlineCache.has(String(mesKey)) && !force) {
    ensureInlineBoxPresent(mesKey);
    return;
  }

  try {
    const { snapshotText } = buildSnapshot();

    const modules = getModules('append');
    // append 閲?schema 鎸?inline 妯″潡鐢熸垚锛涘鏋滅敤鎴锋妸 inline 鍏ㄥ叧浜嗭紝灏变笉鐢熸垚
    if (!modules.length) return;

    await updateMapFromSnapshot(snapshotText);

    // 瀵?鈥渃ompact/standard鈥?缁欎竴鐐规殫绀猴紙涓嶅己鍒讹級锛岄伩鍏嶇敤鎴锋ā鍧?prompt 寰堥暱鏃舵病璧蜂綔鐢?
    const modeHint = (s.appendMode === 'standard')
      ? `\n銆愰檮鍔犺姹傘€慽nline 杈撳嚭鍙瘮闈㈡澘鏇寸煭锛屼絾涓嶈涓㈡帀鍏抽敭淇℃伅銆俓n`
      : `\n銆愰檮鍔犺姹傘€慽nline 杈撳嚭灏介噺鐭細姣忎釜瀛楁灏介噺 1~2 鍙?2 鏉′互鍐呫€俓n`;

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
      // 瑙ｆ瀽澶辫触锛氫篃鎶婂師鏂囪拷鍔犲埌鑱婂ぉ鏈熬锛岄伩鍏嶁€滄湁杈撳嚭浣嗙湅涓嶅埌鈥?
      const raw = String(jsonText || '').trim();
      const rawMd = raw ? ('```text\n' + raw + '\n```') : '锛堢┖锛?;
      const mdFail = `**鍓ф儏鎸囧锛堣В鏋愬け璐ワ級**\n\n${rawMd}`;
      const htmlInnerFail = renderMarkdownToHtml(mdFail);

      inlineCache.set(String(mesKey), { htmlInner: htmlInnerFail, collapsed: false, createdAt: Date.now() });
      requestAnimationFrame(() => { ensureInlineBoxPresent(mesKey); });
      setTimeout(() => ensureInlineBoxPresent(mesKey), 800);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 1800);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 3500);
      setTimeout(() => ensureInlineBoxPresent(mesKey), 6500);
      return;
    }

    // 鍚堝苟闈欐€佹ā鍧楃紦瀛橈紙浣跨敤涔嬪墠缂撳瓨鐨勯潤鎬佹ā鍧楀€硷級
    const mergedParsed = mergeStaticModulesIntoResult(parsed, modules);

    // 鏇存柊闈欐€佹ā鍧楃紦瀛橈紙棣栨鐢熸垚鐨勯潤鎬佹ā鍧椾細琚紦瀛橈級
    updateStaticModulesCache(mergedParsed, modules).catch(() => void 0);

    const md = buildInlineMarkdownFromModules(mergedParsed, modules, s.appendMode, !!s.inlineShowEmpty);
    const htmlInner = renderMarkdownToHtml(md);

    // 鎻愬彇 quick_actions 鐢ㄤ簬鍔ㄦ€佹覆鏌撳彲鐐瑰嚮鎸夐挳
    const quickActions = Array.isArray(mergedParsed.quick_actions) ? mergedParsed.quick_actions : [];

    inlineCache.set(String(mesKey), { htmlInner, collapsed: false, createdAt: Date.now(), quickActions });

    requestAnimationFrame(() => { ensureInlineBoxPresent(mesKey); });

    // 棰濆琛ヨ创锛氬浠樷€滃彉閲忔洿鏂版櫄鍒扳€濈殑浜屾瑕嗙洊
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
  $sel.append(`<option value="">锛堥€夋嫨妯″瀷锛?/option>`);
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
  $sel.append(`<option value="">锛堥€夋嫨妯″瀷锛?/option>`);
  (modelIds || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (selected && id === selected) opt.selected = true;
    $sel.append(opt);
  });
}


function fillIndexModelSelect(modelIds, selected) {
  const $sel = $('#sg_wiIndexModelSelect');
  if (!$sel.length) return;
  $sel.empty();
  $sel.append(`<option value="">(閫夋嫨妯″瀷)</option>`);
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
  $sel.append(`<option value="">(閫夋嫨妯″瀷)</option>`);
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
  if (!apiBase) { setStatus('璇峰厛濉啓鈥滄€荤粨鐙珛API鍩虹URL鈥濆啀鍒锋柊妯″瀷', 'warn'); return; }

  setStatus('姝ｅ湪鍒锋柊鈥滄€荤粨鐙珛API鈥濇ā鍨嬪垪琛ㄢ€?, 'warn');

  const apiKey = String($('#sg_summaryCustomApiKey').val() || s.summaryCustomApiKey || '');
  const statusUrl = '/api/backends/chat-completions/status';

  const body = {
    reverse_proxy: apiBase,
    chat_completion_source: 'custom',
    custom_url: apiBase,
    custom_include_headers: apiKey ? `Authorization: Bearer ${apiKey}` : ''
  };

  // prefer backend status (鍏煎 ST 鍚庣浠ｇ悊)
  try {
    const headers = { ...getStRequestHeadersCompat(), 'Content-Type': 'application/json' };
    const res = await fetch(statusUrl, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`鐘舵€佹鏌ュけ璐? HTTP ${res.status} ${res.statusText}\n${txt}`);
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
      setStatus('鍒锋柊鎴愬姛锛屼絾鏈В鏋愬埌妯″瀷鍒楄〃锛堣繑鍥炴牸寮忎笉鍏煎锛?, 'warn');
      return;
    }

    s.summaryCustomModelsCache = ids;
    saveSettings();
    fillSummaryModelSelect(ids, s.summaryCustomModel);
    setStatus(`宸插埛鏂版€荤粨妯″瀷锛?{ids.length} 涓紙鍚庣浠ｇ悊锛塦, 'ok');
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
      if (/\/v1$/.test(u)) return u + '/models';
      if (/\/v1\b/i.test(u)) return u.replace(/\/+$/, '') + '/models';
      return u + '/v1/models';
    })(apiBase);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { method: 'GET', headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`鐩磋繛 /models 澶辫触: HTTP ${res.status} ${res.statusText}\n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('鐩磋繛鍒锋柊澶辫触锛氭湭瑙ｆ瀽鍒版ā鍨嬪垪琛?, 'warn'); return; }

    s.summaryCustomModelsCache = ids;
    saveSettings();
    fillSummaryModelSelect(ids, s.summaryCustomModel);
    setStatus(`宸插埛鏂版€荤粨妯″瀷锛?{ids.length} 涓紙鐩磋繛 fallback锛塦, 'ok');
  } catch (e) {
    setStatus(`鍒锋柊鎬荤粨妯″瀷澶辫触锛?{e?.message ?? e}`, 'err');
  }
}


async function refreshIndexModels() {
  const s = ensureSettings();
  const raw = String($('#sg_wiIndexCustomEndpoint').val() || s.wiIndexCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('璇峰厛濉啓鈥滅储寮曠嫭绔婣PI鍩虹URL鈥濆啀鍒锋柊妯″瀷', 'warn'); return; }

  setStatus('姝ｅ湪鍒锋柊鈥滅储寮曠嫭绔婣PI鈥濇ā鍨嬪垪琛ㄢ€?, 'warn');

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
      const err = new Error(`鐘舵€佹鏌ュけ璐? HTTP ${res.status} ${res.statusText}\n${txt}`);
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
      setStatus('鍒锋柊鎴愬姛锛屼絾鏈В鏋愬埌妯″瀷鍒楄〃锛堣繑鍥炴牸寮忎笉鍏煎锛?, 'warn');
      return;
    }

    s.wiIndexCustomModelsCache = ids;
    saveSettings();
    fillIndexModelSelect(ids, s.wiIndexCustomModel);
    setStatus(`宸插埛鏂扮储寮曟ā鍨嬶細${ids.length} 涓紙鍚庣浠ｇ悊锛塦, 'ok');
    return;
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) console.warn('[StoryGuide] index status check failed; fallback to direct /models', e);
  }

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
      throw new Error(`鐩磋繛 /models 澶辫触: HTTP ${res.status} ${res.statusText}\n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('鐩磋繛鍒锋柊澶辫触锛氭湭瑙ｆ瀽鍒版ā鍨嬪垪琛?, 'warn'); return; }

    s.wiIndexCustomModelsCache = ids;
    saveSettings();
    fillIndexModelSelect(ids, s.wiIndexCustomModel);
    setStatus(`宸插埛鏂扮储寮曟ā鍨嬶細${ids.length} 涓紙鐩磋繛 fallback锛塦, 'ok');
  } catch (e) {
    setStatus(`鍒锋柊绱㈠紩妯″瀷澶辫触锛?{e?.message ?? e}`, 'err');
  }
}



async function refreshRollModels() {
  const s = ensureSettings();
  const raw = String($('#sg_wiRollCustomEndpoint').val() || s.wiRollCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('璇峰厛濉啓"ROLL鐙珛API鍩虹URL"鍐嶅埛鏂版ā鍨?, 'warn'); return; }

  setStatus('姝ｅ湪鍒锋柊"ROLL鐙珛API"妯″瀷鍒楄〃鈥?, 'warn');

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
      const err = new Error(`鐘舵€佹鏌ュけ璐? HTTP ${res.status} ${res.statusText}\n${txt}`);
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
      setStatus('鍒锋柊鎴愬姛锛屼絾鏈В鏋愬埌妯″瀷鍒楄〃锛堣繑鍥炴牸寮忎笉鍏煎锛?, 'warn');
      return;
    }

    s.wiRollCustomModelsCache = ids;
    saveSettings();
    fillRollModelSelect(ids, s.wiRollCustomModel);
    setStatus(`宸插埛鏂癛OLL妯″瀷锛?{ids.length} 涓紙鍚庣浠ｇ悊锛塦, 'ok');
    return;
  } catch (e) {
    const status = e?.status;
    if (!(status === 404 || status === 405)) console.warn('[StoryGuide] roll status check failed; fallback to direct /models', e);
  }

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
      throw new Error(`鐩磋繛 /models 澶辫触: HTTP ${res.status} ${res.statusText}\n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('鐩磋繛鍒锋柊澶辫触锛氭湭瑙ｆ瀽鍒版ā鍨嬪垪琛?, 'warn'); return; }

    s.wiRollCustomModelsCache = ids;
    saveSettings();
    fillRollModelSelect(ids, s.wiRollCustomModel);
    setStatus(`宸插埛鏂癛OLL妯″瀷锛?{ids.length} 涓紙鐩磋繛 fallback锛塦, 'ok');
  } catch (e) {
    setStatus(`鍒锋柊ROLL妯″瀷澶辫触锛?{e?.message ?? e}`, 'err');
  }
}


// -------------------- 鍥惧儚鐢熸垚妯″潡 --------------------

function getRecentStoryContent(count) {
  const chat = SillyTavern.getContext().chat || [];
  const messages = chat.slice(-count).filter(m => m.mes && !m.is_system);
  return messages.map(m => m.mes).join('\n\n');
}

function setImageGenStatus(text, kind = '') {
  const $s = $('#sg_imageGenStatus');
  $s.removeClass('ok err warn').addClass(kind || '');
  $s.text(text || '');
}

// 閫氱敤 LLM 璋冪敤鍑芥暟锛堜娇鐢ㄥ浘鍍忕敓鎴愭ā鍧楃嫭绔?API锛?
async function callLLM(messages, opts = {}) {
  const s = ensureSettings();
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.max_tokens ?? 1024;

  // 浣跨敤鍥惧儚鐢熸垚妯″潡鐙珛鐨?API 閰嶇疆
  const endpoint = s.imageGenCustomEndpoint || '';
  const apiKey = s.imageGenCustomApiKey || '';
  const model = s.imageGenCustomModel || 'gpt-4o-mini';

  if (!endpoint) {
    throw new Error('璇峰厛鍦ㄣ€屽浘鍍忕敓鎴愩€嶆爣绛鹃〉閰嶇疆 LLM API 鍩虹URL');
  }

  return await callViaCustom(endpoint, apiKey, model, messages, temperature, maxTokens, 0.95, false);
}

// 鍒锋柊鍥惧儚鐢熸垚 LLM 妯″瀷鍒楄〃
async function refreshImageGenModels() {
  const s = ensureSettings();
  const raw = String($('#sg_imageGenCustomEndpoint').val() || s.imageGenCustomEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setImageGenStatus('璇峰厛濉啓 LLM API 鍩虹URL', 'warn'); return; }

  setImageGenStatus('姝ｅ湪鍒锋柊妯″瀷鍒楄〃鈥?, 'warn');

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

    if (!models.length) { setImageGenStatus('鏈壘鍒板彲鐢ㄦā鍨?, 'warn'); return; }

    const $sel = $('#sg_imageGenCustomModel');
    const cur = $sel.val();
    $sel.empty();
    for (const m of models) {
      $sel.append($('<option>').val(m).text(m));
    }
    if (models.includes(cur)) $sel.val(cur);
    else if (models.length) $sel.val(models[0]);

    pullUiToSettings(); saveSettings();
    setImageGenStatus(`鉁?宸插姞杞?${models.length} 涓ā鍨媊, 'ok');
  } catch (e) {
    console.error('[ImageGen] Refresh models failed:', e);
    setImageGenStatus(`鉂?鍒锋柊澶辫触: ${e?.message || e}`, 'err');
  }
}

// 鍔犺浇鍥惧儚鐢熸垚鐢ㄧ殑涓栫晫涔︼紙瑙掕壊鏍囩搴擄級
async function loadImageGenWorldBook() {
  const s = ensureSettings();
  const fileName = String($('#sg_imageGenWorldBookFile').val() || s.imageGenWorldBookFile || '').trim();

  if (!fileName) {
    $('#sg_imageGenWorldBookInfo').text('璇疯緭鍏ヤ笘鐣屼功鏂囦欢鍚?);
    return;
  }

  $('#sg_imageGenWorldBookInfo').text('姝ｅ湪鍔犺浇涓栫晫涔︹€?);

  try {
    const json = await fetchWorldInfoFileJsonCompat(fileName);
    const parsed = parseWorldbookJson(JSON.stringify(json || {}));

    // 瑙ｆ瀽鏉＄洰涓鸿鑹叉爣绛炬牸寮?
    const entries = parsed.filter(e => e && (e.content || e.keys?.length)).map(e => ({
      name: String(e.comment || e.title || e.keys?.[0] || '').trim(),
      keys: Array.isArray(e.keys) ? e.keys.map(k => String(k).toLowerCase().trim()).filter(Boolean) : [],
      tags: String(e.content || '').trim(),
      enabled: !e.disabled
    })).filter(e => e.name && e.tags);

    if (!entries.length) {
      $('#sg_imageGenWorldBookInfo').text('鈿狅笍 鏈壘鍒版湁鏁堟潯鐩?);
      return;
    }

    // 淇濆瓨鍒拌缃?
    s.imageGenWorldBookFile = fileName;
    s.imageGenWorldBookCache = entries;
    saveSettings();

    $('#sg_imageGenWorldBookInfo').text(`鉁?宸插姞杞?${entries.length} 涓鑹?鏉＄洰`);
    console.log('[ImageGen] Loaded world book:', entries);
  } catch (e) {
    console.error('[ImageGen] Load world book failed:', e);
    $('#sg_imageGenWorldBookInfo').text(`鉂?鍔犺浇澶辫触: ${e?.message || e}`);
  }
}

// 浠庢晠浜嬪唴瀹瑰尮閰嶄笘鐣屼功涓殑瑙掕壊鏍囩
function matchCharacterTagsFromWorldBook(storyContent) {
  const s = ensureSettings();
  if (!s.imageGenWorldBookEnabled) return '';

  const entries = s.imageGenWorldBookCache || [];
  if (!entries.length) return '';

  const text = String(storyContent || '').toLowerCase();
  const matched = [];

  for (const entry of entries) {
    if (!entry.enabled) continue;
    // 妫€鏌ヨ鑹插悕鎴栧叧閿瘝鏄惁鍑虹幇鍦ㄦ晠浜嬩腑
    const nameMatch = entry.name && text.includes(entry.name.toLowerCase());
    const keyMatch = entry.keys?.some(k => text.includes(k));

    if (nameMatch || keyMatch) {
      matched.push(entry);
    }
  }

  if (!matched.length) return '';

  // 鍚堝苟鍖归厤鍒扮殑鏍囩
  const allTags = matched.map(e => e.tags).join(', ');
  console.log('[ImageGen] Matched characters:', matched.map(e => e.name));
  return allTags;
}

async function generateImagePromptWithLLM(storyContent, genType, statData = null) {
  const s = ensureSettings();
  const systemPrompt = s.imageGenSystemPrompt || DEFAULT_SETTINGS.imageGenSystemPrompt;

  const statDataJson = statData ? JSON.stringify(statData, null, 2) : '';
  let userPrompt = `璇锋牴鎹互涓嬫晠浜嬪唴瀹圭敓鎴愬浘鍍忔彁绀鸿瘝銆俓n\n`;
  if (genType === 'character') {
    userPrompt += `銆愯姹傘€戯細鐢熸垚瑙掕壊绔嬬粯鐨勬彁绀鸿瘝锛岄噸鐐规弿杩拌鑹插瑙傘€俓n\n`;
  } else if (genType === 'scene') {
    userPrompt += `銆愯姹傘€戯細鐢熸垚鍦烘櫙鍥剧殑鎻愮ず璇嶏紝閲嶇偣鎻忚堪鐜鍜屾皼鍥淬€俓n\n`;
  } else {
    userPrompt += `銆愯姹傘€戯細鑷姩鍒ゆ柇搴旇鐢熸垚瑙掕壊杩樻槸鍦烘櫙銆俓n\n`;
  }
  userPrompt += `銆愭晠浜嬪唴瀹广€戯細\n${storyContent}\n\n`;
  if (statDataJson) {
    userPrompt += `銆愯鑹茬姸鎬佹暟鎹€戯細\n${statDataJson}\n\n`;
  }
  userPrompt += `璇疯緭鍑?JSON 鏍煎紡鐨勬彁绀鸿瘝銆俙;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const result = await callLLM(messages, { temperature: 0.7, max_tokens: 1024 });

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('鏈壘鍒?JSON');
      }
    } catch (e) {
      console.warn('[ImageGen] Failed to parse LLM response:', e, result);
      return { type: genType || 'auto', subject: '(瑙ｆ瀽澶辫触)', positive: result.slice(0, 500), negative: '' };
    }

    return { type: parsed.type || genType || 'auto', subject: parsed.subject || '', positive: parsed.positive || '', negative: parsed.negative || '' };
  } catch (e) {
    console.error('[ImageGen] LLM call failed:', e);
    const errMsg = e?.message || String(e);
    if (errMsg.includes('not found') || errMsg.includes('404')) {
      throw new Error(`LLM 妯″瀷涓嶅瓨鍦紝璇风偣鍑汇€岎煍?鍒锋柊妯″瀷銆嶈幏鍙栧彲鐢ㄦā鍨嬪垪琛╜);
    }
    throw new Error(`LLM 璋冪敤澶辫触: ${errMsg}`);
  }
}

async function generateImageWithNovelAI(positive, negative) {
  const s = ensureSettings();
  const apiKey = s.novelaiApiKey;

  if (!apiKey) throw new Error('璇峰厛濉啓 Novel AI API Key');

  const [width, height] = (s.novelaiResolution || '832x1216').split('x').map(Number);
  const defaultNegative = s.novelaiNegativePrompt || DEFAULT_SETTINGS.novelaiNegativePrompt;
  const finalNegative = negative ? `${defaultNegative}, ${negative}` : defaultNegative;

  const model = s.novelaiModel || 'nai-diffusion-3';
  const isV4 = model.includes('diffusion-4');
  const seed = Math.floor(Math.random() * 4294967295);

  // V4/V4.5 闇€瑕佸畬鍏ㄤ笉鍚岀殑鍙傛暟鏍煎紡
  let payload;

  if (isV4) {
    // V4/V4.5 鏍煎紡 - 鍩轰簬 novelai-python SDK
    payload = {
      input: positive,
      model: model,
      action: 'generate',
      parameters: {
        width: width || 832,
        height: height || 1216,
        scale: s.novelaiScale || 5,
        steps: s.novelaiSteps || 28,
        sampler: s.novelaiSampler || 'k_euler_ancestral',
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        seed: seed,
        negative_prompt: finalNegative,
        // V4/V4.5 鐗规湁鍙傛暟
        cfg_rescale: 0,
        sm: false,
        sm_dyn: false,
        noise_schedule: 'native',
        legacy: false,
        legacy_v3_extend: false,
        skip_cfg_above_sigma: null,
        variety_boost: false,
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
    // V3 鏍煎紡
    payload = {
      input: positive,
      model: model,
      action: 'generate',
      parameters: {
        width: width || 832,
        height: height || 1216,
        scale: s.novelaiScale || 5,
        steps: s.novelaiSteps || 28,
        sampler: s.novelaiSampler || 'k_euler',
        negative_prompt: finalNegative,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        seed: seed
      }
    };
  }

  setImageGenStatus('姝ｅ湪璋冪敤 Novel AI API 鐢熸垚鍥惧儚鈥?, 'warn');

  const response = await fetch('https://image.novelai.net/ai/generate-image', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/zip' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Novel AI API 閿欒: ${response.status} ${response.statusText}\n${errText}`);
  }

  const blob = await response.blob();

  // 灏濊瘯鐢?JSZip 瑙ｅ帇
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

  if (!s.novelaiApiKey) { setImageGenStatus('璇峰厛濉啓 Novel AI API Key', 'err'); return; }

  const genType = $('#sg_imageGenType').val() || 'auto';
  const lookback = s.imageGenLookbackMessages || 5;

  try {
    setImageGenStatus('姝ｅ湪璇诲彇鏈€杩戝璇濃€?, 'warn');
    const storyContent = getRecentStoryContent(lookback);

    if (!storyContent.trim()) { setImageGenStatus('娌℃湁鎵惧埌瀵硅瘽鍐呭', 'err'); return; }

    setImageGenStatus('姝ｅ湪浣跨敤 LLM 鐢熸垚鍥惧儚鎻愮ず璇嶁€?, 'warn');
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

    // 浠庝笘鐣屼功鍖归厤瑙掕壊鏍囩
    const worldBookTags = matchCharacterTagsFromWorldBook(storyContent);
    let finalPositive = promptResult.positive;
    if (worldBookTags) {
      finalPositive = worldBookTags + ', ' + promptResult.positive;
      console.log('[ImageGen] Added world book tags:', worldBookTags);
    }

    $('#sg_imagePositivePrompt').val(finalPositive);
    $('#sg_imagePromptPreview').show();

    const imageUrl = await generateImageWithNovelAI(finalPositive, promptResult.negative);

    $('#sg_generatedImage').attr('src', imageUrl);
    $('#sg_imageResult').show();

    setImageGenStatus(`鉁?鐢熸垚鎴愬姛锛佺被鍨? ${promptResult.type}锛屼富棰? ${promptResult.subject}`, 'ok');

    if (s.imageGenAutoSave && s.imageGenSavePath) {
      try { await saveGeneratedImage(imageUrl); setImageGenStatus(`鉁?鐢熸垚鎴愬姛骞跺凡淇濆瓨锛乣, 'ok'); }
      catch (e) { console.warn('[ImageGen] Auto-save failed:', e); }
    }
  } catch (e) {
    console.error('[ImageGen] Generation failed:', e);
    setImageGenStatus(`鉂?鐢熸垚澶辫触: ${e?.message || e}`, 'err');
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


// -------------------- 鍦ㄧ嚎鍥惧簱鍔熻兘 --------------------

async function loadGalleryFromGitHub() {
  const s = ensureSettings();
  const url = String($('#sg_imageGalleryUrl').val() || s.imageGalleryUrl || '').trim();

  if (!url) {
    setImageGenStatus('璇峰厛濉啓鍥惧簱绱㈠紩 URL', 'err');
    return false;
  }

  setImageGenStatus('姝ｅ湪鍔犺浇鍥惧簱鈥?, 'warn');
  $('#sg_galleryInfo').text('(鍔犺浇涓€?');

  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.images || !Array.isArray(data.images)) throw new Error('鏍煎紡閿欒锛氱己灏?images 鏁扮粍');

    s.imageGalleryCache = data.images;
    s.imageGalleryCacheTime = Date.now();
    s.imageGalleryBaseUrl = data.baseUrl || url.replace(/\/[^\/]+$/, '/');
    saveSettings();

    $('#sg_galleryInfo').text(`(宸插姞杞?${data.images.length} 寮?`);
    setImageGenStatus(`鉁?鍥惧簱鍔犺浇鎴愬姛锛?{data.images.length} 寮犲浘鐗嘸, 'ok');
    return true;
  } catch (e) {
    console.error('[ImageGallery] Load failed:', e);
    $('#sg_galleryInfo').text('(鍔犺浇澶辫触)');
    setImageGenStatus(`鉂?鍥惧簱鍔犺浇澶辫触: ${e?.message || e}`, 'err');
    return false;
  }
}

async function matchGalleryImage() {
  const s = ensureSettings();

  if (!s.imageGalleryCache || s.imageGalleryCache.length === 0) {
    setImageGenStatus('璇峰厛鍔犺浇鍥惧簱', 'err');
    return;
  }

  const storyContent = getRecentStoryContent(s.imageGenLookbackMessages || 5);
  if (!storyContent.trim()) { setImageGenStatus('娌℃湁鎵惧埌瀵硅瘽鍐呭', 'err'); return; }

  setImageGenStatus('姝ｅ湪鍒嗘瀽鍓ф儏骞跺尮閰嶅浘鐗団€?, 'warn');

  const galleryList = s.imageGalleryCache.map(img =>
    `- id:${img.id}, tags:[${(img.tags || []).join(',')}], desc:${img.description || ''}`
  ).join('\n');

  const messages = [
    { role: 'system', content: s.imageGalleryMatchPrompt || DEFAULT_SETTINGS.imageGalleryMatchPrompt },
    { role: 'user', content: `銆愬墽鎯呫€戯細\n${storyContent}\n\n銆愬浘搴撱€戯細\n${galleryList}\n\n閫夋嫨鏈€鍖归厤鐨勫浘鐗囥€俙 }
  ];

  try {
    const result = await callLLM(messages, { temperature: 0.3, max_tokens: 256 });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { setImageGenStatus('鉂?鍖归厤澶辫触锛氭棤娉曡В鏋愬搷搴?, 'err'); return; }

    const parsed = JSON.parse(jsonMatch[0]);
    const matchedImage = s.imageGalleryCache.find(img => img.id === parsed.matchedId);

    if (!matchedImage) { setImageGenStatus(`鉂?鏈壘鍒?ID "${parsed.matchedId}"`, 'err'); return; }

    const baseUrl = s.imageGalleryBaseUrl || '';
    const imageUrl = matchedImage.path.startsWith('http') ? matchedImage.path : baseUrl + matchedImage.path;

    $('#sg_matchedGalleryImage').attr('src', imageUrl);
    $('#sg_galleryMatchReason').text(`馃幆 ${parsed.reason || ''}`);
    $('#sg_galleryResult').show();
    setImageGenStatus(`鉁?鍖归厤锛?{matchedImage.description || parsed.matchedId}`, 'ok');
  } catch (e) {
    console.error('[ImageGallery] Match failed:', e);
    setImageGenStatus(`鉂?鍖归厤澶辫触: ${e?.message || e}`, 'err');
  }
}


async function refreshModels() {
  const s = ensureSettings();
  const raw = String($('#sg_customEndpoint').val() || s.customEndpoint || '').trim();
  const apiBase = normalizeBaseUrl(raw);
  if (!apiBase) { setStatus('璇峰厛濉啓 API鍩虹URL 鍐嶅埛鏂版ā鍨?, 'warn'); return; }

  setStatus('姝ｅ湪鍒锋柊妯″瀷鍒楄〃鈥?, 'warn');

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
      const err = new Error(`鐘舵€佹鏌ュけ璐? HTTP ${res.status} ${res.statusText}\n${txt}`);
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
      setStatus('鍒锋柊鎴愬姛锛屼絾鏈В鏋愬埌妯″瀷鍒楄〃锛堣繑鍥炴牸寮忎笉鍏煎锛?, 'warn');
      return;
    }

    s.customModelsCache = ids;
    saveSettings();
    fillModelSelect(ids, s.customModel);
    setStatus(`宸插埛鏂版ā鍨嬶細${ids.length} 涓紙鍚庣浠ｇ悊锛塦, 'ok');
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
      throw new Error(`鐩磋繛 /models 澶辫触: HTTP ${res.status} ${res.statusText}\n${txt}`);
    }
    const data = await res.json().catch(() => ({}));

    let modelsList = [];
    if (Array.isArray(data?.models)) modelsList = data.models;
    else if (Array.isArray(data?.data)) modelsList = data.data;
    else if (Array.isArray(data)) modelsList = data;

    let ids = [];
    if (modelsList.length) ids = modelsList.map(m => (typeof m === 'string' ? m : m?.id)).filter(Boolean);

    ids = Array.from(new Set(ids)).sort((a, b) => String(a).localeCompare(String(b)));

    if (!ids.length) { setStatus('鐩磋繛鍒锋柊澶辫触锛氭湭瑙ｆ瀽鍒版ā鍨嬪垪琛?, 'warn'); return; }

    s.customModelsCache = ids;
    saveSettings();
    fillModelSelect(ids, s.customModel);
    setStatus(`宸插埛鏂版ā鍨嬶細${ids.length} 涓紙鐩磋繛 fallback锛塦, 'ok');
  } catch (e) {
    setStatus(`鍒锋柊妯″瀷澶辫触锛?{e?.message ?? e}`, 'err');
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
  btn.title = '鍓ф儏鎸囧 StoryGuide';
  btn.innerHTML = '<span class="sg-topbar-icon">馃摌</span>';
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
  // 鏀惧杈圭晫闄愬埗锛氬厑璁哥獥鍙ｈ秺鐣?50%锛堝嵆鑷冲皯淇濈暀 50% 鎴栨爣棰樻爮 40px 鍙锛?
  const minVisibleRatio = 0.5; // 鑷冲皯 50% 鍙锛堝厑璁稿彟澶?50% 鍦ㄥ睆骞曞锛?
  const minVisiblePx = 40;     // 鎴栬嚦灏?40px锛堜繚璇佹爣棰樻爮鍙嫋鍥烇級

  // 璁＄畻姘村钩鏂瑰悜闇€瑕佷繚鎸佸彲瑙佺殑鏈€灏忓搴?
  const minVisibleW = Math.max(minVisiblePx, w * minVisibleRatio);
  // 璁＄畻鍨傜洿鏂瑰悜闇€瑕佷繚鎸佸彲瑙佺殑鏈€灏忛珮搴?
  const minVisibleH = Math.max(minVisiblePx, h * minVisibleRatio);

  // 宸﹁竟鐣岋細鍏佽璐熷€硷紝浣嗙‘淇濆彸渚ц嚦灏?minVisibleW 鍦ㄥ睆骞曞唴
  // 鍗?left + w >= minVisibleW 鈫?left >= minVisibleW - w
  const minLeft = minVisibleW - w;
  // 鍙宠竟鐣岋細纭繚宸︿晶鑷冲皯 minVisibleW 鍦ㄥ睆骞曞唴
  // 鍗?left + minVisibleW <= window.innerWidth 鈫?left <= window.innerWidth - minVisibleW
  const maxLeft = window.innerWidth - minVisibleW;

  // 涓婅竟鐣岋細涓ユ牸闄愬埗 >= 0锛屼繚璇佹爣棰樻爮涓嶈閬尅
  const minTop = 0;
  // 涓嬭竟鐣岋細纭繚椤堕儴鑷冲皯 minVisibleH 鍦ㄥ睆骞曞唴
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
          <span class="sg-badge">馃摌</span>
          鍓ф儏鎸囧 <span class="sg-sub">StoryGuide v${SG_VERSION}</span>
        </div>
        <div class="sg-modal-actions">
          <button class="menu_button sg-btn" id="sg_close">鍏抽棴</button>
        </div>
      </div>

      <div class="sg-modal-body">
        <div class="sg-left">
          <div class="sg-pagetabs">
            <button class="sg-pgtab active" id="sg_pgtab_guide">鍓ф儏鎸囧</button>
            <button class="sg-pgtab" id="sg_pgtab_summary">鎬荤粨璁剧疆</button>
            <button class="sg-pgtab" id="sg_pgtab_index">绱㈠紩璁剧疆</button>
            <button class="sg-pgtab" id="sg_pgtab_roll">ROLL 璁剧疆</button>
            <button class="sg-pgtab" id="sg_pgtab_image">鍥惧儚鐢熸垚</button>
          </div>

          <div class="sg-page active" id="sg_page_guide">
          <div class="sg-card">
            <div class="sg-card-title">鐢熸垚璁剧疆</div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>鍚敤</label>
                <label class="sg-switch">
                  <input type="checkbox" id="sg_enabled">
                  <span class="sg-slider"></span>
                </label>
              </div>

              <div class="sg-field">
                <label>鍓ч€忕瓑绾?/label>
                <select id="sg_spoiler">
                  <option value="none">涓嶅墽閫?/option>
                  <option value="mild">杞诲墽閫?/option>
                  <option value="full">鍏ㄥ墽閫?/option>
                </select>
              </div>

              <div class="sg-field">
                <label>Provider</label>
                <select id="sg_provider">
                  <option value="st">浣跨敤褰撳墠 SillyTavern API锛堟帹鑽愶級</option>
                  <option value="custom">鐙珛API锛堣蛋閰掗鍚庣浠ｇ悊锛屽噺灏戣法鍩燂級</option>
                </select>
              </div>

              <div class="sg-field">
                <label>temperature</label>
                <input id="sg_temperature" type="number" step="0.05" min="0" max="2">
              </div>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>鏈€杩戞秷鎭潯鏁?/label>
                <input id="sg_maxMessages" type="number" min="5" max="200">
              </div>
              <div class="sg-field">
                <label>姣忔潯鏈€澶у瓧绗?/label>
                <input id="sg_maxChars" type="number" min="200" max="8000">
              </div>
            </div>

            <div class="sg-row">
              <label class="sg-check"><input type="checkbox" id="sg_includeUser">鍖呭惈鐢ㄦ埛娑堟伅</label>
              <label class="sg-check"><input type="checkbox" id="sg_includeAssistant">鍖呭惈AI娑堟伅</label>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_autoRefresh">鑷姩鍒锋柊闈㈡澘鎶ュ憡</label>
              <select id="sg_autoRefreshOn">
                <option value="received">AI鍥炲鏃?/option>
                <option value="sent">鐢ㄦ埛鍙戦€佹椂</option>
                <option value="both">涓よ€呴兘瑙﹀彂</option>
              </select>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_autoAppendBox">鍚敤鍒嗘瀽妗嗭紙鎵嬪姩鐢熸垚/閲峈oll锛?/label>
              <select id="sg_appendMode">
                <option value="compact">绠€娲?/option>
                <option value="standard">鏍囧噯</option>
              </select>
              <select id="sg_inlineModulesSource" title="閫夋嫨杩藉姞妗嗗睍绀虹殑妯″潡鏉ユ簮">
                <option value="inline">浠?inline=true 鐨勬ā鍧?/option>
                <option value="panel">璺熼殢闈㈡澘锛坧anel=true锛?/option>
                <option value="all">鏄剧ず鍏ㄩ儴妯″潡</option>
              </select>
              <label class="sg-check" title="鍗充娇妯″瀷娌¤緭鍑鸿瀛楁锛屼篃鏄剧ず锛堢┖锛夊崰浣?>
                <input type="checkbox" id="sg_inlineShowEmpty">鏄剧ず绌哄瓧娈?
              </label>
              <span class="sg-hint">锛堢偣鍑绘鏍囬鍙姌鍙狅級</span>
            </div>

            <div id="sg_custom_block" class="sg-card sg-subcard" style="display:none;">
              <div class="sg-card-title">鐙珛API 璁剧疆锛堝缓璁～ API鍩虹URL锛?/div>

              <div class="sg-field">
                <label>API鍩虹URL锛堜緥濡?https://api.openai.com/v1 锛?/label>
                <input id="sg_customEndpoint" type="text" placeholder="https://xxx.com/v1">
                <div class="sg-hint sg-warn">浼樺厛璧伴厭棣嗗悗绔唬鐞嗘帴鍙ｏ紙/api/backends/...锛夛紝姣旀祻瑙堝櫒鐩磋繛鏇翠笉瀹规槗璺ㄥ煙/杩炰笉涓娿€?/div>
              </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>API Key锛堝彲閫夛級</label>
                  <input id="sg_customApiKey" type="password" placeholder="鍙暀绌?>
                </div>

                <div class="sg-field">
                  <label>妯″瀷锛堝彲鎵嬪～锛?/label>
                  <input id="sg_customModel" type="text" placeholder="gpt-4o-mini">
                </div>
              </div>

              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_refreshModels">妫€鏌?鍒锋柊妯″瀷</button>
                <select id="sg_modelSelect" class="sg-model-select">
                  <option value="">锛堥€夋嫨妯″瀷锛?/option>
                </select>
              </div>

              <div class="sg-row">
                <div class="sg-field sg-field-full">
                  <label>鏈€澶у洖澶峵oken鏁?/label>
                  <input id="sg_customMaxTokens" type="number" min="256" max="200000" step="1" placeholder="渚嬪锛?0000">
                
                  <label class="sg-check" style="margin-top:8px;">
                    <input type="checkbox" id="sg_customStream"> 浣跨敤娴佸紡杩斿洖锛坰tream=true锛?
                  </label>
</div>
              </div>
            </div>

            <div class="sg-actions-row">
              <button class="menu_button sg-btn-primary" id="sg_saveSettings">淇濆瓨璁剧疆</button>
              <button class="menu_button sg-btn-primary" id="sg_analyze">鍒嗘瀽褰撳墠鍓ф儏</button>
            </div>
            <div class="sg-actions-row" style="margin-top: 8px;">
              <button class="menu_button sg-btn" id="sg_exportPreset">馃摛 瀵煎嚭鍏ㄥ眬棰勮</button>
              <button class="menu_button sg-btn" id="sg_importPreset">馃摜 瀵煎叆鍏ㄥ眬棰勮</button>
              <input type="file" id="sg_importPresetFile" accept=".json" style="display: none;">
            </div>
          </div>

          <div class="sg-card">
            <div class="sg-card-title">蹇嵎閫夐」</div>
            <div class="sg-hint">鐐瑰嚮閫夐」鍙嚜鍔ㄥ皢鎻愮ず璇嶈緭鍏ュ埌鑱婂ぉ妗嗐€傚彲鑷畾涔夐€夐」鍐呭銆?/div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_quickOptionsEnabled">鍚敤蹇嵎閫夐」</label>
              <select id="sg_quickOptionsShowIn">
                <option value="inline">浠呭垎鏋愭</option>
                <option value="panel">浠呴潰鏉?/option>
                <option value="both">涓よ€呴兘鏄剧ず</option>
              </select>
            </div>

            <div class="sg-field" style="margin-top:10px;">
              <label>閫夐」閰嶇疆锛圝SON锛屾牸寮忥細[{label, prompt}, ...]锛?/label>
              <textarea id="sg_quickOptionsJson" rows="6" spellcheck="false" placeholder='[{"label": "缁х画", "prompt": "缁х画褰撳墠鍓ф儏鍙戝睍"}]'></textarea>
              <div class="sg-actions-row">
                <button class="menu_button sg-btn" id="sg_resetQuickOptions">鎭㈠榛樿閫夐」</button>
                <button class="menu_button sg-btn" id="sg_applyQuickOptions">搴旂敤閫夐」</button>
              </div>
            </div>
          </div>

          <div class="sg-card">
            <div class="sg-card-title">杈撳嚭妯″潡锛圝SON锛屽彲鑷畾涔夊瓧娈?鎻愮ず璇嶏級</div>
            <div class="sg-hint">浣犲彲浠ュ鍒犳ā鍧椼€佹敼 key/title/type/prompt銆佹帶鍒?panel/inline銆備繚瀛樺墠鍙偣鈥滄牎楠屸€濄€?/div>

            <div class="sg-field">
              <textarea id="sg_modulesJson" rows="12" spellcheck="false"></textarea>
              <div class="sg-hint" style="margin-top:4px;">馃挕 妯″潡鍙坊鍔?<code>static: true</code> 琛ㄧず闈欐€佹ā鍧楋紙鍙湪棣栨鐢熸垚鎴栨墜鍔ㄥ埛鏂版椂鏇存柊锛?/div>
              <div class="sg-actions-row">
                <button class="menu_button sg-btn" id="sg_validateModules">鏍￠獙</button>
                <button class="menu_button sg-btn" id="sg_resetModules">鎭㈠榛樿</button>
                <button class="menu_button sg-btn" id="sg_applyModules">搴旂敤鍒拌缃?/button>
                <button class="menu_button sg-btn" id="sg_clearStaticCache">鍒锋柊闈欐€佹ā鍧?/button>
              </div>
            </div>

            <div class="sg-field">
              <label>鑷畾涔?System 琛ュ厖锛堝彲閫夛級</label>
              <textarea id="sg_customSystemPreamble" rows="3" placeholder="渚嬪锛氭洿鍋忔偓鐤戙€佸己璋冪嚎绱€侀伩鍏嶅啑闀库€?></textarea>
            </div>
            <div class="sg-field">
              <label>鑷畾涔?Constraints 琛ュ厖锛堝彲閫夛級</label>
              <textarea id="sg_customConstraints" rows="3" placeholder="渚嬪锛氬繀椤绘彁鍒板叧閿汉鐗╁姩鏈恒€佹瘡鏉′笉瓒呰繃20瀛椻€?></textarea>
            </div>
          </div>

          
          <div class="sg-card">
            <div class="sg-card-title">棰勮涓庝笘鐣屼功</div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_exportPreset">瀵煎嚭棰勮</button>
              <label class="sg-check"><input type="checkbox" id="sg_presetIncludeApiKey">瀵煎嚭鍖呭惈 API Key</label>
              <button class="menu_button sg-btn" id="sg_importPreset">瀵煎叆棰勮</button>
            </div>

            <div class="sg-hint">棰勮浼氬寘鍚細鐢熸垚璁剧疆 / 鐙珛API / 杈撳嚭妯″潡 / 涓栫晫涔﹁缃?/ 鑷畾涔夋彁绀洪鏋躲€傚鍏ヤ細瑕嗙洊褰撳墠閰嶇疆銆?/div>

            <hr class="sg-hr">

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_worldbookEnabled">鍦ㄥ垎鏋愯緭鍏ヤ腑娉ㄥ叆涓栫晫涔?/label>
              <select id="sg_worldbookMode">
                <option value="active">浠呮敞鍏モ€滃彲鑳芥縺娲烩€濈殑鏉＄洰锛堟帹鑽愶級</option>
                <option value="all">娉ㄥ叆鍏ㄩ儴鏉＄洰</option>
              </select>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>涓栫晫涔︽渶澶ф敞鍏ュ瓧绗?/label>
                <input id="sg_worldbookMaxChars" type="number" min="500" max="50000">
              </div>
              <div class="sg-field">
                <label>婵€娲绘娴嬬獥鍙ｏ紙鏈€杩戞秷鎭潯鏁帮級</label>
                <input id="sg_worldbookWindowMessages" type="number" min="5" max="80">
              </div>
            </div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_importWorldbook">瀵煎叆涓栫晫涔SON</button>
              <button class="menu_button sg-btn" id="sg_clearWorldbook">娓呯┖涓栫晫涔?/button>
              <button class="menu_button sg-btn" id="sg_saveWorldbookSettings">淇濆瓨涓栫晫涔﹁缃?/button>
            </div>

            <div class="sg-hint" id="sg_worldbookInfo">锛堟湭瀵煎叆涓栫晫涔︼級</div>
          </div>

          <div class="sg-card">
            <div class="sg-card-title">馃椇锔?缃戞牸鍦板浘</div>
            <div class="sg-hint">浠庡墽鎯呬腑鑷姩鎻愬彇鍦扮偣淇℃伅锛岀敓鎴愬彲瑙嗗寲涓栫晫鍦板浘銆傛樉绀轰富瑙掍綅缃拰鍚勫湴浜嬩欢銆?/div>
            
              <div class="sg-row sg-inline" style="margin-top: 10px;">
                <label class="sg-check"><input type="checkbox" id="sg_mapEnabled">鍚敤鍦板浘鍔熻兘</label>
              </div>

              <div class="sg-field" style="margin-top: 10px;">
                <label>鍦板浘鎻愮ず璇?/label>
                <textarea id="sg_mapSystemPrompt" rows="6" placeholder="鍙嚜瀹氫箟鍦板浘鎻愬彇瑙勫垯锛堜粛闇€杈撳嚭 JSON锛?></textarea>
                <div class="sg-actions-row">
                  <button class="menu_button sg-btn" id="sg_mapResetPrompt">鎭㈠榛樿鎻愮ず璇?/button>
                </div>
              </div>
              
              <div class="sg-field" style="margin-top: 10px;">
                <label>鍦板浘褰撳墠鐘舵€?/label>
                <div id="sg_mapPreview" class="sg-map-container">
                <div class="sg-map-empty">鏆傛棤鍦板浘鏁版嵁銆傚惎鐢ㄥ悗杩涜鍓ф儏鍒嗘瀽灏嗚嚜鍔ㄧ敓鎴愬湴鍥俱€?/div>
              </div>
            </div>
            
            <div class="sg-actions-row">
              <button class="menu_button sg-btn" id="sg_resetMap">馃棏 閲嶇疆鍦板浘</button>
              <button class="menu_button sg-btn" id="sg_refreshMapPreview">馃攧 鍒锋柊棰勮</button>
            </div>
          </div>

          </div> <!-- sg_page_guide -->

          <div class="sg-page" id="sg_page_summary">

          <div class="sg-card">
            <div class="sg-card-title">鑷姩鎬荤粨锛堝啓鍏ヤ笘鐣屼功锛?/div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_summaryEnabled">鍚敤鑷姩鎬荤粨</label>
              <span>姣?/span>
              <input id="sg_summaryEvery" type="number" min="1" max="200" style="width:90px">
              <span>灞?/span>
              <select id="sg_summaryCountMode">
                <option value="assistant">鎸?AI 鍥炲璁℃暟</option>
                <option value="all">鎸夊叏閮ㄦ秷鎭鏁?/option>
              </select>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>鎬荤粨 Provider</label>
                <select id="sg_summaryProvider">
                  <option value="st">浣跨敤閰掗褰撳墠杩炴帴鐨勬ā鍨?/option>
                  <option value="custom">浣跨敤鐙珛 OpenAI 鍏煎 API</option>
                </select>
              </div>
              <div class="sg-field">
                <label>鎬荤粨 Temperature</label>
                <input id="sg_summaryTemperature" type="number" min="0" max="2" step="0.1">
              </div>
            </div>

            <div class="sg-card sg-subcard">
              <div class="sg-field">
                <label>鑷畾涔夋€荤粨鎻愮ず璇嶏紙System锛屽彲閫夛級</label>
                <textarea id="sg_summarySystemPrompt" rows="6" placeholder="渚嬪锛氭洿寮鸿皟绾跨储/鍏崇郴鍙樺寲/鍥炲悎鍒惰褰曪紝鎴栬姹傝嫳鏂囪緭鍑衡€︼紙浠嶉渶杈撳嚭 JSON锛?></textarea>
              </div>
              <div class="sg-field">
                <label>瀵硅瘽鐗囨妯℃澘锛圲ser锛屽彲閫夛級</label>
                <textarea id="sg_summaryUserTemplate" rows="4" placeholder="鏀寔鍗犱綅绗︼細{{fromFloor}} {{toFloor}} {{chunk}}"></textarea>
              </div>
              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_summaryResetPrompt">鎭㈠榛樿鎻愮ず璇?/button>
                <div class="sg-hint" style="margin-left:auto">鍗犱綅绗︼細{{fromFloor}} {{toFloor}} {{chunk}} {{statData}}銆傛彃浠朵細寮哄埗瑕佹眰杈撳嚭 JSON锛歿title, summary, keywords[]}銆?/div>
              </div>
              <div class="sg-row sg-inline" style="margin-top:8px">
                <label class="sg-check"><input type="checkbox" id="sg_summaryReadStatData">璇诲彇瑙掕壊鐘舵€佸彉閲?/label>
                <div class="sg-field" style="flex:1;margin-left:8px">
                  <input id="sg_summaryStatVarName" type="text" placeholder="stat_data" style="width:120px">
                </div>
                <div class="sg-hint" style="margin-left:8px">AI 鍙湅鍒板彉閲忎腑鐨勮鑹插睘鎬ф暟鎹紙绫讳技 ROLL 鐐规ā鍧楋級</div>
              </div>
            </div>

            <div class="sg-card sg-subcard">
              <div class="sg-card-title">缁撴瀯鍖栨潯鐩紙浜虹墿/瑁呭/鑳藉姏锛?/div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_structuredEntriesEnabled">鍚敤缁撴瀯鍖栨潯鐩?/label>
                <label class="sg-check"><input type="checkbox" id="sg_characterEntriesEnabled">浜虹墿</label>
                <label class="sg-check"><input type="checkbox" id="sg_equipmentEntriesEnabled">瑁呭</label>
                <label class="sg-check"><input type="checkbox" id="sg_abilityEntriesEnabled">鑳藉姏</label>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>浜虹墿鏉＄洰鍓嶇紑</label>
                  <input id="sg_characterEntryPrefix" type="text" placeholder="浜虹墿">
                </div>
                <div class="sg-field">
                  <label>瑁呭鏉＄洰鍓嶇紑</label>
                  <input id="sg_equipmentEntryPrefix" type="text" placeholder="瑁呭">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>鑳藉姏鏉＄洰鍓嶇紑</label>
                  <input id="sg_abilityEntryPrefix" type="text" placeholder="鑳藉姏">
                </div>
              </div>
              <div class="sg-field">
                <label>缁撴瀯鍖栨彁鍙栨彁绀鸿瘝锛圫ystem锛屽彲閫夛級</label>
                <textarea id="sg_structuredEntriesSystemPrompt" rows="5" placeholder="渚嬪锛氬己璋冨瑙傛。妗堝紡鎻忚堪銆侀伩鍏嶆潨鎾扳€?></textarea>
              </div>
              <div class="sg-field">
                <label>缁撴瀯鍖栨彁鍙栨ā鏉匡紙User锛屽彲閫夛級</label>
                <textarea id="sg_structuredEntriesUserTemplate" rows="4" placeholder="鏀寔鍗犱綅绗︼細{{fromFloor}} {{toFloor}} {{chunk}} {{knownCharacters}} {{knownEquipments}}"></textarea>
              </div>
              <div class="sg-field">
                <label>浜虹墿鏉＄洰鎻愮ず璇嶏紙鍙€夛級</label>
                <textarea id="sg_structuredCharacterPrompt" rows="3" placeholder="渚嬪锛氫紭鍏堣褰曢樀钀?鍏崇郴/鍏抽敭浜嬩欢鈥?></textarea>
              </div>
              <div class="sg-field">
                <label>瑁呭鏉＄洰鎻愮ず璇嶏紙鍙€夛級</label>
                <textarea id="sg_structuredEquipmentPrompt" rows="3" placeholder="渚嬪锛氬己璋冩潵婧?绋€鏈夊害/褰撳墠鐘舵€佲€?></textarea>
              </div>
              <div class="sg-field">
                <label>鑳藉姏鏉＄洰鎻愮ず璇嶏紙鍙€夛級</label>
                <textarea id="sg_structuredAbilityPrompt" rows="3" placeholder="渚嬪锛氬己璋冭Е鍙戞潯浠?浠ｄ环/璐熼潰鏁堟灉鈥?></textarea>
              </div>
              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_structuredResetPrompt">鎭㈠榛樿缁撴瀯鍖栨彁绀鸿瘝</button>
                <button class="menu_button sg-btn" id="sg_clearStructuredCache">娓呴櫎缁撴瀯鍖栨潯鐩紦瀛?/button>
                <div class="sg-hint" style="margin-left:auto">鍗犱綅绗︼細{{fromFloor}} {{toFloor}} {{chunk}} {{knownCharacters}} {{knownEquipments}}銆?/div>
              </div>
            </div>

            <div class="sg-card sg-subcard" id="sg_summary_custom_block" style="display:none">
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>鐙珛API鍩虹URL</label>
                  <input id="sg_summaryCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
                </div>
                <div class="sg-field">
                  <label>API Key</label>
                  <input id="sg_summaryCustomApiKey" type="password" placeholder="sk-...">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>妯″瀷ID锛堝彲鎵嬪～锛?/label>
                  <input id="sg_summaryCustomModel" type="text" placeholder="gpt-4o-mini">
                  <div class="sg-row sg-inline" style="margin-top:6px;">
                    <button class="menu_button sg-btn" id="sg_refreshSummaryModels">鍒锋柊妯″瀷</button>
                    <select id="sg_summaryModelSelect" class="sg-model-select">
                      <option value="">锛堥€夋嫨妯″瀷锛?/option>
                    </select>
                  </div>
                </div>
                <div class="sg-field">
                  <label>Max Tokens</label>
                  <input id="sg_summaryCustomMaxTokens" type="number" min="128" max="200000">
                </div>
              </div>
              <label class="sg-check"><input type="checkbox" id="sg_summaryCustomStream">stream锛堣嫢鏀寔锛?/label>
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_summaryToWorldInfo">鍐欏叆涓栫晫涔︼紙缁跨伅鍚敤锛?/label>
              <input id="sg_summaryWorldInfoFile" type="text" placeholder="涓栫晫涔︽枃浠跺悕" style="flex:1; min-width: 220px;">
            </div>

            <div class="sg-row sg-inline">
              <label class="sg-check"><input type="checkbox" id="sg_summaryToBlueWorldInfo" checked>鍚屾椂鍐欏叆钃濈伅涓栫晫涔︼紙甯稿紑绱㈠紩锛?/label>
              <input id="sg_summaryBlueWorldInfoFile" type="text" placeholder="钃濈伅涓栫晫涔︽枃浠跺悕锛堝缓璁崟鐙缓涓€涓級" style="flex:1; min-width: 260px;">
            </div>

            <div class="sg-card sg-subcard" style="background: var(--SmartThemeBlurTintColor); margin-top: 8px; display: none;">
              <div class="sg-row sg-inline" style="align-items: center;">
                <label class="sg-check"><input type="checkbox" id="sg_autoBindWorldInfo">馃搾 鑷姩缁戝畾涓栫晫涔︼紙姣忎釜鑱婂ぉ鐢熸垚涓撳睘涓栫晫涔︼級</label>
                <input id="sg_autoBindWorldInfoPrefix" type="text" placeholder="鍓嶇紑" style="width: 80px;" title="涓栫晫涔︽枃浠跺悕鍓嶇紑锛岄粯璁?SG">
              </div>
              <div class="sg-hint" style="margin-top: 4px;">寮€鍚悗锛屾瘡涓亰澶╀細鑷姩鍒涘缓涓撳睘鐨勭豢鐏?钃濈伅涓栫晫涔︼紝鍒囨崲鑱婂ぉ鏃惰嚜鍔ㄥ姞杞姐€?/div>
              <div id="sg_autoBindInfo" class="sg-hint" style="margin-top: 6px; display: none; font-size: 12px;"></div>
            </div>

            <div class="sg-hint" style="margin-top: 8px; color: var(--SmartThemeQuoteColor);">
              馃挕 璇锋墜鍔ㄥ垱寤轰笘鐣屼功鏂囦欢锛岀劧鍚庡湪涓婃柟濉啓鏂囦欢鍚嶃€傜豢鐏€夋嫨銆屽啓鍏ユ寚瀹氫笘鐣屼功鏂囦欢鍚嶃€嶆ā寮忋€?
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>鏉＄洰鏍囬鍓嶇紑锛堝啓鍏?comment锛屽缁堝湪鏈€鍓嶏級</label>
                <input id="sg_summaryWorldInfoCommentPrefix" type="text" placeholder="鍓ф儏鎬荤粨">
              </div>
              <div class="sg-field">
                <label>闄愬埗锛氭瘡鏉℃秷鎭渶澶氬瓧绗?/ 鎬诲瓧绗?/label>
                <div class="sg-row" style="margin-top:0">
                  <input id="sg_summaryMaxChars" type="number" min="200" max="8000" style="width:110px">
                  <input id="sg_summaryMaxTotalChars" type="number" min="2000" max="80000" style="width:120px">
                </div>
              </div>
            </div>

            <div class="sg-grid2">
              <div class="sg-field">
                <label>涓栫晫涔﹁Е鍙戣瘝鍐欏叆 key</label>
                <select id="sg_summaryWorldInfoKeyMode">
                  <option value="keywords">浣跨敤妯″瀷杈撳嚭鐨勫叧閿瘝锛?~14 涓級</option>
                  <option value="indexId">浣跨敤绱㈠紩缂栧彿锛堝彧鍐?1 涓紝濡?A-001锛?/option>
                </select>
                <div class="sg-hint">鎯宠鈥滀富瑕佸叧閿瘝鈥濆彧鏄剧ず A-001锛屽氨閫夆€滅储寮曠紪鍙封€濄€?/div>
              </div>
              <div class="sg-field" id="sg_summaryIndexFormat" style="display:none;">
                <label>绱㈠紩缂栧彿鏍煎紡锛坘eyMode=indexId锛?/label>
                <div class="sg-row" style="margin-top:0; gap:8px; align-items:center;">
                  <input id="sg_summaryIndexPrefix" type="text" placeholder="A-" style="width:90px">
                  <span class="sg-hint">浣嶆暟</span>
                  <input id="sg_summaryIndexPad" type="number" min="1" max="12" style="width:80px">
                  <span class="sg-hint">璧峰</span>
                  <input id="sg_summaryIndexStart" type="number" min="1" max="1000000" style="width:100px">
                </div>
                <label class="sg-check" style="margin-top:6px;"><input type="checkbox" id="sg_summaryIndexInComment">鏉＄洰鏍囬锛坈omment锛夊寘鍚紪鍙?/label>
              </div>
            </div>

            <div class="sg-card sg-subcard">
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_wiTriggerEnabled">鍚敤鈥滆摑鐏储寮?鈫?缁跨伅瑙﹀彂鈥濓紙鍙戦€佹秷鎭墠鑷姩娉ㄥ叆瑙﹀彂璇嶏級</label>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>璇诲彇鍓?N 鏉℃秷鎭鏂?/label>
                  <input id="sg_wiTriggerLookbackMessages" type="number" min="5" max="120" placeholder="20">
                </div>
                <div class="sg-field">
                  <label>鏈€澶氳Е鍙戞潯鐩暟</label>
                  <input id="sg_wiTriggerMaxEntries" type="number" min="1" max="20" placeholder="4">
                </div>

              <div class="sg-grid2" style="margin-top: 8px;">
                <div class="sg-field">
                  <label>鏈€澶氱储寮曚汉鐗╂暟</label>
                  <input id="sg_wiTriggerMaxCharacters" type="number" min="0" max="10" placeholder="2">
                </div>
                <div class="sg-field">
                  <label>鏈€澶氱储寮曡澶囨暟</label>
                  <input id="sg_wiTriggerMaxEquipments" type="number" min="0" max="10" placeholder="2">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>鏈€澶氱储寮曞墽鎯呮暟锛堜紭鍏堜箙杩滐級</label>
                  <input id="sg_wiTriggerMaxPlot" type="number" min="0" max="10" placeholder="3">
                </div>
              </div>

<div class="sg-grid2">
  <div class="sg-field">
    <label>鍖归厤鏂瑰紡</label>
    <select id="sg_wiTriggerMatchMode">
      <option value="local">鏈湴鐩镐技搴︼紙蹇級</option>
      <option value="llm">LLM 缁煎悎鍒ゆ柇锛堝彲鑷畾涔夋彁绀鸿瘝锛?/option>
    </select>
  </div>
  <div class="sg-field">
    <label>棰勭瓫閫?TopK锛堜粎 LLM 妯″紡锛?/label>
    <input id="sg_wiIndexPrefilterTopK" type="number" min="5" max="80" placeholder="24">
    <div class="sg-hint">鍏堢敤鐩镐技搴︽寫 TopK锛屽啀浜ょ粰妯″瀷閫夊嚭鏈€鐩稿叧鐨勫嚑鏉★紙鐪?tokens锛夈€?/div>
  </div>
</div>

<div class="sg-card sg-subcard" id="sg_index_llm_block" style="display:none; margin-top:10px;">
  <div class="sg-grid2">
    <div class="sg-field">
      <label>绱㈠紩 Provider</label>
      <select id="sg_wiIndexProvider">
        <option value="st">浣跨敤閰掗褰撳墠杩炴帴鐨勬ā鍨?/option>
        <option value="custom">浣跨敤鐙珛 OpenAI 鍏煎 API</option>
      </select>
    </div>
    <div class="sg-field">
      <label>绱㈠紩 Temperature</label>
      <input id="sg_wiIndexTemperature" type="number" min="0" max="2" step="0.1">
    </div>
  </div>

  <div class="sg-field">
    <label>鑷畾涔夌储寮曟彁绀鸿瘝锛圫ystem锛屽彲閫夛級</label>
    <textarea id="sg_wiIndexSystemPrompt" rows="6" placeholder="渚嬪锛氭洿寮鸿皟浜虹墿鍏崇郴/绾跨储鍥炴敹/褰撳墠鐩爣锛涙垨瑕佹眰鏇翠弗鏍肩殑绛涢€夆€?></textarea>
  </div>
  <div class="sg-field">
    <label>绱㈠紩妯℃澘锛圲ser锛屽彲閫夛級</label>
    <textarea id="sg_wiIndexUserTemplate" rows="6" placeholder="鏀寔鍗犱綅绗︼細{{userMessage}} {{recentText}} {{candidates}} {{maxPick}}"></textarea>
  </div>
  <div class="sg-row sg-inline">
    <button class="menu_button sg-btn" id="sg_wiIndexResetPrompt">鎭㈠榛樿绱㈠紩鎻愮ず璇?/button>
    <div class="sg-hint" style="margin-left:auto">鍗犱綅绗︼細{{userMessage}} {{recentText}} {{candidates}} {{maxPick}}銆傛彃浠朵細寮哄埗瑕佹眰杈撳嚭 JSON锛歿pickedIds:number[]}銆?/div>
  </div>

  <div class="sg-card sg-subcard" id="sg_index_custom_block" style="display:none">
    <div class="sg-grid2">
      <div class="sg-field">
        <label>绱㈠紩鐙珛API鍩虹URL</label>
        <input id="sg_wiIndexCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
      </div>
      <div class="sg-field">
        <label>API Key</label>
        <input id="sg_wiIndexCustomApiKey" type="password" placeholder="sk-...">
      </div>
    </div>
    <div class="sg-grid2">
      <div class="sg-field">
        <label>妯″瀷ID锛堝彲鎵嬪～锛?/label>
        <input id="sg_wiIndexCustomModel" type="text" placeholder="gpt-4o-mini">
        <div class="sg-row sg-inline" style="margin-top:6px;">
          <button class="menu_button sg-btn" id="sg_refreshIndexModels">鍒锋柊妯″瀷</button>
          <select id="sg_wiIndexModelSelect" class="sg-model-select">
            <option value="">锛堥€夋嫨妯″瀷锛?/option>
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
    <label class="sg-check"><input type="checkbox" id="sg_wiIndexCustomStream">stream锛堣嫢鏀寔锛?/label>
  </div>
</div>

              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label class="sg-check"><input type="checkbox" id="sg_wiTriggerIncludeUserMessage">缁撳悎鏈鐢ㄦ埛杈撳叆锛堢患鍚堝垽鏂級</label>
                  <div class="sg-hint">寮€鍚悗浼氱患鍚堚€滄渶杩?N 鏉℃鏂?+ 浣犺繖鍙ヨ瘽鈥濇潵鍐冲畾涓庡綋鍓嶅墽鎯呮渶鐩稿叧鐨勬潯鐩€?/div>
                </div>
                <div class="sg-field">
                  <label>鐢ㄦ埛杈撳叆鏉冮噸锛?~10锛?/label>
                  <input id="sg_wiTriggerUserMessageWeight" type="number" min="0" max="10" step="0.1" placeholder="1.6">
                  <div class="sg-hint">瓒婂ぇ瓒婄湅閲嶄綘杩欏彞璇濓紱1=涓庢渶杩戞鏂囧悓鏉冮噸銆?/div>
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>鐩稿叧搴﹂槇鍊硷紙0~1锛?/label>
                  <input id="sg_wiTriggerMinScore" type="number" min="0" max="1" step="0.01" placeholder="0.08">
                </div>
                <div class="sg-field">
                  <label>鏈€澶氭敞鍏ヨЕ鍙戣瘝</label>
                  <input id="sg_wiTriggerMaxKeywords" type="number" min="1" max="200" placeholder="24">
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>鑷冲皯宸叉湁 N 鏉?AI 鍥炲鎵嶅紑濮嬬储寮曪紙0=绔嬪嵆锛?/label>
                  <input id="sg_wiTriggerStartAfterAssistantMessages" type="number" min="0" max="200000" placeholder="0">
                </div>
                <div class="sg-field">
                  <label>璇存槑</label>
                  <div class="sg-hint" style="padding-top:8px;">锛堝彧缁熻 AI 鍥炲妤煎眰锛涗緥濡傚～ 100 琛ㄧず绗?100 灞備箣鍚庢墠娉ㄥ叆锛?/div>
                </div>
              </div>
              <div class="sg-row sg-inline">
                <label>娉ㄥ叆鏂瑰紡</label>
                <select id="sg_wiTriggerInjectStyle" style="min-width:200px">
                  <option value="hidden">闅愯棌娉ㄩ噴锛堟帹鑽愶級</option>
                  <option value="plain">鏅€氭枃鏈紙鏇寸ǔ锛?/option>
                </select>
              </div>
              <div class="sg-row sg-inline">
                <label>钃濈伅绱㈠紩</label>
                <select id="sg_wiBlueIndexMode" style="min-width:180px">
                  <option value="live">瀹炴椂璇诲彇钃濈伅涓栫晫涔?/option>
                  <option value="cache">浣跨敤瀵煎叆/缂撳瓨</option>
                </select>
                <input id="sg_wiBlueIndexFile" type="text" placeholder="钃濈伅涓栫晫涔︽枃浠跺悕锛堢暀绌?浣跨敤涓婃柟钃濈伅鍐欏叆鏂囦欢鍚嶏級" style="flex:1; min-width: 260px;">
                <button class="menu_button sg-btn" id="sg_refreshBlueIndexLive">鍒锋柊</button>
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_wiTriggerDebugLog">璋冭瘯锛氱姸鎬佹爮鏄剧ず鍛戒腑鏉＄洰/瑙﹀彂璇?/label>
                <button class="menu_button sg-btn" id="sg_importBlueIndex">瀵煎叆钃濈伅涓栫晫涔SON锛堝鐢級</button>
                <button class="menu_button sg-btn" id="sg_clearBlueIndex">娓呯┖钃濈伅绱㈠紩</button>
                <div class="sg-hint" id="sg_blueIndexInfo" style="margin-left:auto">锛堣摑鐏储寮曪細0 鏉★級</div>
              </div>
              <div class="sg-hint">
                璇存槑锛氭湰鍔熻兘浼氱敤鈥滆摑鐏储寮曗€濋噷鐨勬瘡鏉℃€荤粨锛坱itle/summary/keywords锛変笌 <b>鏈€杩?N 鏉℃鏂?/b>锛堝彲閫夊啀鍔犱笂 <b>鏈鐢ㄦ埛杈撳叆</b>锛夊仛鐩镐技搴﹀尮閰嶏紝閫夊嚭鏈€鐩稿叧鐨勫嚑鏉★紝鎶婂畠浠殑 <b>keywords</b> 杩藉姞鍒颁綘鍒氬彂閫佺殑娑堟伅鏈熬锛堝彲閫夐殣钘忔敞閲?鏅€氭枃鏈級锛屼粠鑰岃Е鍙戔€滅豢鐏笘鐣屼功鈥濈殑瀵瑰簲鏉＄洰銆?
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-row sg-inline" style="margin-top:0;">
                  <div class="sg-hint">ROLL 璁剧疆宸茬Щ鑷崇嫭绔嬬殑銆孯OLL 璁剧疆銆嶆爣绛鹃〉銆?/div>
                  <div class="sg-spacer"></div>
                  <button class="menu_button sg-btn" id="sg_gotoRollPage">鎵撳紑 ROLL 璁剧疆</button>
                </div>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-row sg-inline" style="margin-top:0;">
                  <div class="sg-card-title" style="margin:0;">绱㈠紩鏃ュ織</div>
                  <div class="sg-spacer"></div>
                  <button class="menu_button sg-btn" id="sg_clearWiLogs">娓呯┖</button>
                </div>
                <div class="sg-loglist" id="sg_wiLogs" style="margin-top:8px;">(鏆傛棤)</div>
                <div class="sg-hint" style="margin-top:8px;">鎻愮ず锛氭棩蹇楄褰曗€滆繖娆″彂閫佹秷鎭椂鍛戒腑浜嗗摢浜涚储寮曟潯鐩紙绛変环浜庡皢瑙﹀彂鐨勭豢鐏潯鐩級鈥濅互鍙婃敞鍏ヤ簡鍝簺鍏抽敭璇嶃€?/div>
              </div>
            </div>

            <div class="sg-card sg-subcard" id="sg_indexMovedHint" style="margin-top:10px;">
              <div class="sg-row sg-inline" style="margin-top:0;">
                <div class="sg-hint">绱㈠紩鐩稿叧璁剧疆宸茬Щ鑷充笂鏂光€滅储寮曡缃€濋〉銆?/div>
                <div class="sg-spacer"></div>
                <button class="menu_button sg-btn" id="sg_gotoIndexPage">鎵撳紑绱㈠紩璁剧疆</button>
              </div>
            </div>

            <div class="sg-row sg-inline">
              <label>鎵嬪姩妤煎眰鑼冨洿</label>
              <input id="sg_summaryManualFrom" type="number" min="1" style="width:110px" placeholder="璧峰灞?>
              <span> - </span>
              <input id="sg_summaryManualTo" type="number" min="1" style="width:110px" placeholder="缁撴潫灞?>
              <button class="menu_button sg-btn" id="sg_summarizeRange">绔嬪嵆鎬荤粨璇ヨ寖鍥?/button>
              <div class="sg-hint" id="sg_summaryManualHint" style="margin-left:auto">锛堝彲閫夎寖鍥达細1-0锛?/div>
            </div>

            <div class="sg-row sg-inline" style="margin-top:6px;">
              <label class="sg-check" style="margin:0;"><input type="checkbox" id="sg_summaryManualSplit">鎵嬪姩鑼冨洿鎸夋瘡 N 灞傛媶鍒嗙敓鎴愬鏉★紙N=涓婃柟鈥滄瘡 N 灞傛€荤粨涓€娆♀€濓級</label>
              <div class="sg-hint" style="margin-left:auto">渚嬪 1-80 涓?N=40 鈫?2 鏉?/div>
            </div>

            <div class="sg-row sg-inline">
              <button class="menu_button sg-btn" id="sg_summarizeNow">绔嬪嵆鎬荤粨</button>
              <button class="menu_button sg-btn" id="sg_stopSummary" style="background: var(--SmartThemeBodyColor); color: var(--SmartThemeQuoteColor);">鍋滄鎬荤粨</button>
              <button class="menu_button sg-btn" id="sg_resetSummaryState">閲嶇疆鏈亰澶╂€荤粨杩涘害</button>
              <div class="sg-hint" id="sg_summaryInfo" style="margin-left:auto">锛堟湭鐢熸垚锛?/div>
            </div>

            <div class="sg-hint">
              鑷姩鎬荤粨浼氭寜鈥滄瘡 N 灞傗€濊Е鍙戯紱姣忔杈撳嚭浼氱敓鎴?<b>鎽樿</b> + <b>鍏抽敭璇?/b>锛屽苟鍙嚜鍔ㄥ垱寤轰笘鐣屼功鏉＄洰锛坉isable=0 缁跨伅鍚敤锛屽叧閿瘝鍐欏叆 key 浣滀负瑙﹀彂璇嶏級銆?
            </div>
          </div>
          </div> <!-- sg_page_summary -->

          <div class="sg-page" id="sg_page_index">
            <div class="sg-card">
              <div class="sg-card-title">绱㈠紩璁剧疆锛堣摑鐏储寮?鈫?缁跨伅瑙﹀彂锛?/div>
              <div class="sg-hint" style="margin-bottom:10px;">绱㈠紩浼氫粠鈥滆摑鐏笘鐣屼功鈥濋噷鎸戦€変笌褰撳墠鍓ф儏鏈€鐩稿叧鐨勬€荤粨鏉＄洰锛屽苟鎶婂搴旇Е鍙戣瘝娉ㄥ叆鍒颁綘鍙戦€佺殑娑堟伅鏈熬锛屼互瑙﹀彂缁跨伅涓栫晫涔︽潯鐩€?/div>
              <div id="sg_index_mount"></div>
            </div>
          </div> <!-- sg_page_index -->

          <div class="sg-page" id="sg_page_roll">
            <div class="sg-card">
              <div class="sg-card-title">ROLL 璁剧疆锛堝垽瀹氾級</div>
              <div class="sg-hint" style="margin-bottom:10px;">鐢ㄤ簬琛屽姩鍒ゅ畾鐨?ROLL 娉ㄥ叆涓庤绠楄鍒欍€俁OLL 妯″潡鐙珛杩愯锛屼笉渚濊禆鎬荤粨鎴栫储寮曞姛鑳姐€?/div>
              
              <label class="sg-check"><input type="checkbox" id="sg_wiRollEnabled">鍚敤 ROLL 鐐癸紙鎴樻枟/鍔濊/瀛︿範绛夊垽瀹氾紱涓庣敤鎴疯緭鍏ヤ竴璧锋敞鍏ワ級</label>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>闅忔満鏉冮噸锛?~1锛?/label>
                  <input id="sg_wiRollRandomWeight" type="number" min="0" max="1" step="0.01" placeholder="0.3">
                </div>
                <div class="sg-field">
                  <label>闅惧害妯″紡</label>
                  <select id="sg_wiRollDifficulty">
                    <option value="simple">绠€鍗?/option>
                    <option value="normal">鏅€?/option>
                    <option value="hard">鍥伴毦</option>
                    <option value="hell">鍦扮嫳</option>
                  </select>
                </div>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>鍙橀噺鏉ユ簮</label>
                  <select id="sg_wiRollStatSource">
                    <option value="variable">缁煎悎澶氭潵婧愶紙鏈€绋冲畾锛屾帹鑽愶級</option>
                    <option value="template">妯℃澘娓叉煋锛坰tat_data锛?/option>
                    <option value="latest">鏈€鏂版鏂囨湯灏?/option>
                  </select>
                  <div class="sg-hint">缁煎悎妯″紡鎸変紭鍏堢骇灏濊瘯锛?getvar鍛戒护 鈫?鍙橀噺瀛樺偍 鈫?妯℃澘娓叉煋 鈫?DOM璇诲彇 鈫?鏈€鏂癆I鍥炲</div>
                </div>
                <div class="sg-field">
                  <label>鍙橀噺瑙ｆ瀽妯″紡</label>
                  <select id="sg_wiRollStatParseMode">
                    <option value="json">JSON</option>
                    <option value="kv">閿€艰锛坧c.atk=10锛?/option>
                  </select>
                </div>
              </div>
              <div class="sg-field">
                <label>鍙橀噺鍚嶏紙鐢ㄤ簬"鍙橀噺瀛樺偍"鏉ユ簮锛?/label>
                <input id="sg_wiRollStatVarName" type="text" placeholder="stat_data">
              </div>
              <div class="sg-row sg-inline">
                <label>娉ㄥ叆鏂瑰紡</label>
                <select id="sg_wiRollInjectStyle">
                  <option value="hidden">闅愯棌娉ㄩ噴</option>
                  <option value="plain">鏅€氭枃鏈?/option>
                </select>
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check" style="margin:0;"><input type="checkbox" id="sg_wiRollDebugLog">璋冭瘯锛氱姸鎬佹爮鏄剧ず鍒ゅ畾缁嗚妭/鏈Е鍙戝師鍥?/label>
              </div>
              <div class="sg-grid2">
                <div class="sg-field">
                  <label>ROLL Provider</label>
                  <select id="sg_wiRollProvider">
                    <option value="custom">鐙珛 API</option>
                    <option value="local">鏈湴璁＄畻</option>
                  </select>
                </div>
              </div>
              <div class="sg-card sg-subcard" id="sg_roll_custom_block" style="display:none; margin-top:8px;">
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>ROLL 鐙珛 API 鍩虹URL</label>
                    <input id="sg_wiRollCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
                  </div>
                  <div class="sg-field">
                    <label>API Key</label>
                    <input id="sg_wiRollCustomApiKey" type="password" placeholder="sk-...">
                  </div>
                </div>
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>妯″瀷ID</label>
                    <input id="sg_wiRollCustomModel" type="text" placeholder="gpt-4o-mini">
                    <div class="sg-row sg-inline" style="margin-top:6px;">
                      <button class="menu_button sg-btn" id="sg_refreshRollModels">鍒锋柊妯″瀷</button>
                      <select id="sg_wiRollModelSelect" class="sg-model-select">
                        <option value="">锛堥€夋嫨妯″瀷锛?/option>
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
                <label class="sg-check"><input type="checkbox" id="sg_wiRollCustomStream">stream锛堣嫢鏀寔锛?/label>
                <div class="sg-field" style="margin-top:8px;">
                  <label>ROLL 绯荤粺鎻愮ず璇?/label>
                  <textarea id="sg_wiRollSystemPrompt" rows="5"></textarea>
                </div>
              </div>
              <div class="sg-hint">AI 浼氬厛鍒ゆ柇鏄惁闇€瑕佸垽瀹氾紝鍐嶈绠楀苟娉ㄥ叆缁撴灉銆?缁煎悎澶氭潵婧?妯″紡浼氬皾璇曞绉嶆柟寮忚鍙栧彉閲忥紝纭繚鏈€澶у吋瀹规€с€?/div>
            </div>
            <div class="sg-card sg-subcard" style="margin-top:10px;">
              <div class="sg-row sg-inline" style="margin-top:0;">
                <div class="sg-card-title" style="margin:0;">ROLL 鏃ュ織</div>
                <div class="sg-spacer"></div>
                <button class="menu_button sg-btn" id="sg_clearRollLogs">娓呯┖</button>
              </div>
              <div class="sg-loglist" id="sg_rollLogs" style="margin-top:8px;">(鏆傛棤)</div>
              <div class="sg-hint" style="margin-top:8px;">鎻愮ず锛氫粎璁板綍鐢?ROLL API 杩斿洖鐨勭畝瑕佽绠楁憳瑕併€?/div>
            </div>
          </div> <!-- sg_page_roll -->

          <div class="sg-page" id="sg_page_image">
            <div class="sg-card">
              <div class="sg-card-title">馃帹 鍥惧儚鐢熸垚璁剧疆</div>
              <div class="sg-hint" style="margin-bottom:10px;">璇诲彇鏈€鏂板墽鎯呭唴瀹癸紝浣跨敤 LLM 鐢熸垚鏍囩锛岃皟鐢?Novel AI API 鐢熸垚瑙掕壊/鍦烘櫙鍥惧儚銆?/div>

              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_imageGenEnabled">鍚敤鍥惧儚鐢熸垚妯″潡</label>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">LLM 鎻愮ず璇嶇敓鎴?API</div>
                <div class="sg-hint">鐢ㄤ簬灏嗗墽鎯呭唴瀹硅浆鎹负鍥惧儚鐢熸垚鏍囩锛圱ag锛?/div>
                <div class="sg-grid2" style="margin-top:8px;">
                  <div class="sg-field">
                    <label>API 鍩虹URL</label>
                    <input id="sg_imageGenCustomEndpoint" type="text" placeholder="https://api.openai.com/v1">
                  </div>
                  <div class="sg-field">
                    <label>API Key</label>
                    <input id="sg_imageGenCustomApiKey" type="password" placeholder="sk-...">
                  </div>
                </div>
                <div class="sg-grid2">
                  <div class="sg-field">
                    <label>妯″瀷</label>
                    <select id="sg_imageGenCustomModel">
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                    </select>
                  </div>
                  <div class="sg-field" style="display:flex; align-items:flex-end;">
                    <button class="menu_button sg-btn" id="sg_imageGenRefreshModels">馃攧 鍒锋柊妯″瀷</button>
                  </div>
                </div>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">馃摎 瑙掕壊鏍囩涓栫晫涔?/div>
                <div class="sg-hint">瀵煎叆鍖呭惈瑙掕壊 NAI 鏍囩鐨勪笘鐣屼功锛岃嚜鍔ㄥ尮閰嶅墽鎯呬腑鐨勮鑹?/div>
                <div class="sg-row sg-inline" style="margin-top:8px;">
                  <label class="sg-check"><input type="checkbox" id="sg_imageGenWorldBookEnabled">鍚敤瑙掕壊鏍囩鍖归厤</label>
                </div>
                <div class="sg-grid2" style="margin-top:8px;">
                  <div class="sg-field">
                    <label>涓栫晫涔︽枃浠跺悕</label>
                    <input id="sg_imageGenWorldBookFile" type="text" placeholder="nai4 鍙橀噺鍒嗚鑹?json">
                  </div>
                  <div class="sg-field" style="display:flex; align-items:flex-end;">
                    <button class="menu_button sg-btn" id="sg_loadImageGenWorldBook">馃摉 鍔犺浇涓栫晫涔?/button>
                  </div>
                </div>
                <div id="sg_imageGenWorldBookInfo" class="sg-hint" style="margin-top:5px;"></div>
              </div>

              <div class="sg-card sg-subcard" style="margin-top:10px;">
                <div class="sg-card-title" style="font-size:0.95em;">Novel AI 鍥惧儚 API</div>
                <div class="sg-field">
                  <label>Novel AI API Key</label>
                  <input id="sg_novelaiApiKey" type="password" placeholder="pst-...">
                  <div class="sg-hint">闇€瑕?Novel AI 璁㈤槄鎵嶈兘浣跨敤 API</div>
                </div>

              <div class="sg-grid2">
                <div class="sg-field">
                  <label>妯″瀷</label>
                  <select id="sg_novelaiModel">
                    <option value="nai-diffusion-4-5-full">NAI Diffusion V4.5 Full</option>
                    <option value="nai-diffusion-4-full">NAI Diffusion V4 Full</option>
                    <option value="nai-diffusion-4-curated-preview">NAI Diffusion V4 Curated</option>
                    <option value="nai-diffusion-3">NAI Diffusion V3</option>
                  </select>
                </div>
                <div class="sg-field">
                  <label>鍒嗚鲸鐜?/label>
                  <select id="sg_novelaiResolution">
                    <option value="832x1216">832脳1216 (绔嬬粯)</option>
                    <option value="1216x832">1216脳832 (妯悜)</option>
                    <option value="1024x1024">1024脳1024 (鏂瑰舰)</option>
                    <option value="640x640">640脳640 (灏?</option>
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
                <label>榛樿璐熼潰鎻愮ず璇?/label>
                <textarea id="sg_novelaiNegativePrompt" rows="2" placeholder="lowres, bad anatomy, ..."></textarea>
              </div>

              <hr class="sg-hr">

              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_imageGenAutoSave">鑷姩淇濆瓨鐢熸垚鐨勫浘鍍?/label>
              </div>
              <div class="sg-field">
                <label>淇濆瓨璺緞锛堢暀绌哄垯浠呮樉绀轰笉淇濆瓨锛?/label>
                <input id="sg_imageGenSavePath" type="text" placeholder="渚嬪锛欳:/Images/Generated">
                <div class="sg-hint">鍥惧儚浼氫互鏃堕棿鎴冲懡鍚嶄繚瀛樺埌姝ょ洰褰?/div>
              </div>

              <hr class="sg-hr">

              <div class="sg-field">
                <label>璇诲彇鏈€杩戞秷鎭暟</label>
                <input id="sg_imageGenLookbackMessages" type="number" min="1" max="30">
              </div>
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_imageGenReadStatData">璇诲彇瑙掕壊鐘舵€佸彉閲?/label>
                <input id="sg_imageGenStatVarName" type="text" placeholder="stat_data" style="width:120px">
              </div>

              <div class="sg-field">
                <label>鏍囩鐢熸垚鎻愮ず璇?(System)</label>
                <textarea id="sg_imageGenSystemPrompt" rows="8" placeholder="鐢ㄤ簬璁?LLM 鐢熸垚 Danbooru 椋庢牸鏍囩鐨勬彁绀鸿瘝"></textarea>
                <div class="sg-actions-row">
                  <button class="menu_button sg-btn" id="sg_imageGenResetPrompt">鎭㈠榛樿鎻愮ず璇?/button>
                </div>
              </div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">鐢熸垚鍥惧儚</div>

              <div class="sg-row sg-inline">
                <label>鐢熸垚绫诲瀷</label>
                <select id="sg_imageGenType">
                  <option value="auto">鑷姩璇嗗埆</option>
                  <option value="character">瑙掕壊绔嬬粯</option>
                  <option value="scene">鍦烘櫙鍥?/option>
                </select>
                <button class="menu_button sg-btn-primary" id="sg_generateImage">馃帹 鏍规嵁鍓ф儏鐢熸垚鍥惧儚</button>
              </div>

              <div class="sg-field" id="sg_imagePromptPreview" style="display:none; margin-top:10px;">
                <label>鐢熸垚鐨勬彁绀鸿瘝</label>
                <textarea id="sg_imagePositivePrompt" rows="3" readonly style="background: var(--SmartThemeBlurTintColor);"></textarea>
                <div class="sg-row sg-inline" style="margin-top:6px;">
                  <button class="menu_button sg-btn" id="sg_editPromptAndGenerate">缂栬緫骞堕噸鏂扮敓鎴?/button>
                  <button class="menu_button sg-btn" id="sg_copyImagePrompt">馃搵 澶嶅埗鎻愮ず璇?/button>
                </div>
              </div>

              <div id="sg_imageResult" class="sg-image-result" style="display:none; margin-top:12px;">
                <img id="sg_generatedImage" src="" alt="Generated Image" style="max-width:100%; max-height:500px; border-radius:6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                <div class="sg-row sg-inline" style="margin-top:8px; justify-content:center;">
                  <button class="menu_button sg-btn" id="sg_downloadImage">馃捑 淇濆瓨鍥惧儚</button>
                </div>
              </div>

              <div class="sg-hint" id="sg_imageGenStatus" style="margin-top:10px;"></div>
            </div>

            <div class="sg-card">
              <div class="sg-card-title">馃摎 鍦ㄧ嚎鍥惧簱锛堜綔鑰呴璁惧浘鐗囷級</div>
              <div class="sg-hint" style="margin-bottom:10px;">浠?GitHub 鍔犺浇浣滆€呴鍏堢敓鎴愮殑鍥剧墖搴擄紝AI 浼氭牴鎹墽鎯呰嚜鍔ㄩ€夋嫨鏈€鍖归厤鐨勫浘鐗囥€?/div>
              
              <div class="sg-row sg-inline">
                <label class="sg-check"><input type="checkbox" id="sg_imageGalleryEnabled">鍚敤鍦ㄧ嚎鍥惧簱</label>
              </div>

              <div class="sg-field">
                <label>鍥惧簱绱㈠紩 URL</label>
                <input id="sg_imageGalleryUrl" type="text" placeholder="https://raw.githubusercontent.com/鐢ㄦ埛鍚?浠撳簱/main/index.json">
                <div class="sg-hint">濉叆 GitHub Raw URL 鎸囧悜鍥惧簱鐨?index.json 鏂囦欢</div>
              </div>

              <div class="sg-row sg-inline">
                <button class="menu_button sg-btn" id="sg_loadGallery">馃摜 鍔犺浇/鍒锋柊鍥惧簱</button>
                <span class="sg-hint" id="sg_galleryInfo" style="margin-left:10px;">(鏈姞杞?</span>
              </div>

              <div class="sg-row sg-inline" style="margin-top:10px;">
                <button class="menu_button sg-btn-primary" id="sg_matchGalleryImage">馃攳 鏍规嵁鍓ф儏鍖归厤鍥剧墖</button>
              </div>

              <div id="sg_galleryResult" class="sg-image-result" style="display:none; margin-top:12px;">
                <div class="sg-hint" id="sg_galleryMatchReason" style="margin-bottom:8px;"></div>
                <img id="sg_matchedGalleryImage" src="" alt="Matched Image" style="max-width:100%; max-height:500px; border-radius:6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              </div>
            </div>
          </div> <!-- sg_page_image -->

          <div class="sg-status" id="sg_status"></div>
        </div>

        <div class="sg-right">
          <div class="sg-card">
            <div class="sg-card-title">杈撳嚭</div>

            <div class="sg-tabs">
              <button class="sg-tab active" id="sg_tab_md">鎶ュ憡</button>
              <button class="sg-tab" id="sg_tab_json">JSON</button>
              <button class="sg-tab" id="sg_tab_src">鏉ユ簮</button>
              <button class="sg-tab" id="sg_tab_sum">鎬荤粨</button>
              <div class="sg-spacer"></div>
              <button class="menu_button sg-btn" id="sg_copyMd" disabled>澶嶅埗MD</button>
              <button class="menu_button sg-btn" id="sg_copyJson" disabled>澶嶅埗JSON</button>
              <button class="menu_button sg-btn" id="sg_copySum" disabled>澶嶅埗鎬荤粨</button>
              <button class="menu_button sg-btn" id="sg_injectTips" disabled>娉ㄥ叆鎻愮ず</button>
            </div>

            <div class="sg-pane active" id="sg_pane_md"><div class="sg-md" id="sg_md">(灏氭湭鐢熸垚)</div></div>
            <div class="sg-pane" id="sg_pane_json"><pre class="sg-pre" id="sg_json"></pre></div>
            <div class="sg-pane" id="sg_pane_src"><pre class="sg-pre" id="sg_src"></pre></div>
            <div class="sg-pane" id="sg_pane_sum"><div class="sg-md" id="sg_sum">(灏氭湭鐢熸垚)</div></div>
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

  // --- settings pages (鍓ф儏鎸囧 / 鎬荤粨璁剧疆 / 绱㈠紩璁剧疆 / ROLL 璁剧疆) ---
  setupSettingsPages();

  $('#sg_modal_backdrop').on('click', (e) => { if (e.target && e.target.id === 'sg_modal_backdrop') closeModal(); });
  $('#sg_close').on('click', closeModal);

  $('#sg_tab_md').on('click', () => showPane('md'));
  $('#sg_tab_json').on('click', () => showPane('json'));
  $('#sg_tab_src').on('click', () => showPane('src'));
  $('#sg_tab_sum').on('click', () => showPane('sum'));

  $('#sg_saveSettings').on('click', () => {
    pullUiToSettings();
    saveSettings();
    setStatus('宸蹭繚瀛樿缃?, 'ok');
  });

  $('#sg_analyze').on('click', async () => {
    pullUiToSettings();
    saveSettings();
    await runAnalysis();
  });

  $('#sg_saveWorld').on('click', async () => {
    try { await setChatMetaValue(META_KEYS.world, String($('#sg_worldText').val() || '')); setStatus('宸蹭繚瀛橈細涓栫晫瑙?璁惧畾琛ュ厖锛堟湰鑱婂ぉ锛?, 'ok'); }
    catch (e) { setStatus(`淇濆瓨澶辫触锛?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_saveCanon').on('click', async () => {
    try { await setChatMetaValue(META_KEYS.canon, String($('#sg_canonText').val() || '')); setStatus('宸蹭繚瀛橈細鍘熻憲鍚庣画/澶х翰锛堟湰鑱婂ぉ锛?, 'ok'); }
    catch (e) { setStatus(`淇濆瓨澶辫触锛?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_copyMd').on('click', async () => {
    try { await navigator.clipboard.writeText(lastReport?.markdown ?? ''); setStatus('宸插鍒讹細Markdown 鎶ュ憡', 'ok'); }
    catch (e) { setStatus(`澶嶅埗澶辫触锛?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_copyJson').on('click', async () => {
    try { await navigator.clipboard.writeText(lastJsonText || ''); setStatus('宸插鍒讹細JSON', 'ok'); }
    catch (e) { setStatus(`澶嶅埗澶辫触锛?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_copySum').on('click', async () => {
    try { await navigator.clipboard.writeText(lastSummaryText || ''); setStatus('宸插鍒讹細鎬荤粨', 'ok'); }
    catch (e) { setStatus(`澶嶅埗澶辫触锛?{e?.message ?? e}`, 'err'); }
  });

  $('#sg_injectTips').on('click', () => {
    const tips = Array.isArray(lastReport?.json?.tips) ? lastReport.json.tips : [];
    const spoiler = ensureSettings().spoilerLevel;
    const text = tips.length
      ? `/sys 銆愬墽鎯呮寚瀵兼彁绀猴綔${spoiler}銆慭n` + tips.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : (lastReport?.markdown ?? '');

    const $ta = $('#send_textarea');
    if ($ta.length) { $ta.val(text).trigger('input'); setStatus('宸叉妸鎻愮ず鏀惧叆杈撳叆妗嗭紙浣犲彲浠ユ墜鍔ㄥ彂閫侊級', 'ok'); }
    else setStatus('鎵句笉鍒拌緭鍏ユ #send_textarea锛屾棤娉曟敞鍏?, 'err');
  });

  $('#sg_provider').on('change', () => {
    const provider = String($('#sg_provider').val());
    $('#sg_custom_block').toggle(provider === 'custom');
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
    setStatus('宸叉仮澶嶉粯璁ょ储寮曟彁绀鸿瘝 鉁?, 'ok');
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
    setStatus('宸叉仮澶嶉粯璁ゆ€荤粨鎻愮ず璇?鉁?, 'ok');
  });

  // structured entries prompt reset + cache clear
  $('#sg_structuredResetPrompt').on('click', () => {
    $('#sg_structuredEntriesSystemPrompt').val(DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT);
    $('#sg_structuredEntriesUserTemplate').val(DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE);
    $('#sg_structuredCharacterPrompt').val(DEFAULT_STRUCTURED_CHARACTER_PROMPT);
    $('#sg_structuredEquipmentPrompt').val(DEFAULT_STRUCTURED_EQUIPMENT_PROMPT);
    $('#sg_structuredAbilityPrompt').val(DEFAULT_STRUCTURED_ABILITY_PROMPT);
    pullUiToSettings();
    saveSettings();
    setStatus('宸叉仮澶嶉粯璁ょ粨鏋勫寲鎻愮ず璇?鉁?, 'ok');
  });

  $('#sg_clearStructuredCache').on('click', async () => {
    try {
      await clearStructuredEntriesCache();
      setStatus('宸叉竻闄ょ粨鏋勫寲鏉＄洰缂撳瓨 鉁?, 'ok');
    } catch (e) {
      setStatus(`娓呴櫎缁撴瀯鍖栨潯鐩紦瀛樺け璐ワ細${e?.message ?? e}`, 'err');
    }
  });

  // manual range split toggle & hint refresh
  $('#sg_summaryManualSplit').on('change', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryManualRangeHint(false);
  });
  $('#sg_summaryManualFrom, #sg_summaryManualTo, #sg_summaryEvery, #sg_summaryCountMode').on('input change', () => {
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
      setStatus(`鎬荤粨澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_stopSummary').on('click', () => {
    stopSummary();
    setStatus('姝ｅ湪鍋滄鎬荤粨鈥?, 'warn');
  });

  $('#sg_summarizeRange').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      const from = clampInt($('#sg_summaryManualFrom').val(), 1, 200000, 1);
      const to = clampInt($('#sg_summaryManualTo').val(), 1, 200000, 1);
      await runSummary({ reason: 'manual_range', manualFromFloor: from, manualToFloor: to });
    } catch (e) {
      setStatus(`鎵嬪姩鑼冨洿鎬荤粨澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_resetSummaryState').on('click', async () => {
    try {
      const meta = getDefaultSummaryMeta();
      await setSummaryMeta(meta);
      updateSummaryInfoLabel();
      renderSummaryPaneFromMeta();
      setStatus('宸查噸缃湰鑱婂ぉ鎬荤粨杩涘害 鉁?, 'ok');
    } catch (e) {
      setStatus(`閲嶇疆澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });

  // auto-save summary settings
  $('#sg_summaryEnabled, #sg_summaryEvery, #sg_summaryCountMode, #sg_summaryTemperature, #sg_summarySystemPrompt, #sg_summaryUserTemplate, #sg_summaryReadStatData, #sg_summaryStatVarName, #sg_structuredEntriesEnabled, #sg_characterEntriesEnabled, #sg_equipmentEntriesEnabled, #sg_abilityEntriesEnabled, #sg_characterEntryPrefix, #sg_equipmentEntryPrefix, #sg_abilityEntryPrefix, #sg_structuredEntriesSystemPrompt, #sg_structuredEntriesUserTemplate, #sg_structuredCharacterPrompt, #sg_structuredEquipmentPrompt, #sg_structuredAbilityPrompt, #sg_summaryCustomEndpoint, #sg_summaryCustomApiKey, #sg_summaryCustomModel, #sg_summaryCustomMaxTokens, #sg_summaryCustomStream, #sg_summaryToWorldInfo, #sg_summaryWorldInfoFile, #sg_summaryWorldInfoCommentPrefix, #sg_summaryWorldInfoKeyMode, #sg_summaryIndexPrefix, #sg_summaryIndexPad, #sg_summaryIndexStart, #sg_summaryIndexInComment, #sg_summaryToBlueWorldInfo, #sg_summaryBlueWorldInfoFile, #sg_wiTriggerEnabled, #sg_wiTriggerLookbackMessages, #sg_wiTriggerIncludeUserMessage, #sg_wiTriggerUserMessageWeight, #sg_wiTriggerStartAfterAssistantMessages, #sg_wiTriggerMaxEntries, #sg_wiTriggerMaxCharacters, #sg_wiTriggerMaxEquipments, #sg_wiTriggerMaxPlot, #sg_wiTriggerMinScore, #sg_wiTriggerMaxKeywords, #sg_wiTriggerInjectStyle, #sg_wiTriggerDebugLog, #sg_wiBlueIndexMode, #sg_wiBlueIndexFile, #sg_summaryMaxChars, #sg_summaryMaxTotalChars, #sg_wiTriggerMatchMode, #sg_wiIndexPrefilterTopK, #sg_wiIndexProvider, #sg_wiIndexTemperature, #sg_wiIndexSystemPrompt, #sg_wiIndexUserTemplate, #sg_wiIndexCustomEndpoint, #sg_wiIndexCustomApiKey, #sg_wiIndexCustomModel, #sg_wiIndexCustomMaxTokens, #sg_wiIndexTopP, #sg_wiIndexCustomStream, #sg_wiRollEnabled, #sg_wiRollStatSource, #sg_wiRollStatVarName, #sg_wiRollRandomWeight, #sg_wiRollDifficulty, #sg_wiRollInjectStyle, #sg_wiRollDebugLog, #sg_wiRollStatParseMode, #sg_wiRollProvider, #sg_wiRollCustomEndpoint, #sg_wiRollCustomApiKey, #sg_wiRollCustomModel, #sg_wiRollCustomMaxTokens, #sg_wiRollCustomTopP, #sg_wiRollCustomTemperature, #sg_wiRollCustomStream, #sg_wiRollSystemPrompt, #sg_imageGenEnabled, #sg_novelaiApiKey, #sg_novelaiModel, #sg_novelaiResolution, #sg_novelaiSteps, #sg_novelaiScale, #sg_novelaiNegativePrompt, #sg_imageGenAutoSave, #sg_imageGenSavePath, #sg_imageGenLookbackMessages, #sg_imageGenReadStatData, #sg_imageGenStatVarName, #sg_imageGenCustomEndpoint, #sg_imageGenCustomApiKey, #sg_imageGenCustomModel, #sg_imageGenSystemPrompt, #sg_imageGalleryEnabled, #sg_imageGalleryUrl, #sg_imageGenWorldBookEnabled, #sg_imageGenWorldBookFile').on('change input', () => {
    pullUiToSettings();
    saveSettings();
    updateSummaryInfoLabel();
    updateBlueIndexInfoLabel();
    updateSummaryManualRangeHint(false);
  });

  $('#sg_refreshModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshModels();
  });

  $('#sg_imageGenRefreshModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshImageGenModels();
  });

  $('#sg_loadImageGenWorldBook').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await loadImageGenWorldBook();
  });

  // 瀵煎嚭/瀵煎叆鍏ㄥ眬棰勮
  $('#sg_exportPreset').on('click', () => {
    try {
      exportPreset();
    } catch (e) {
      showToast(`瀵煎嚭澶辫触: ${e.message}`, { kind: 'err' });
    }
  });

  $('#sg_importPreset').on('click', () => {
    $('#sg_importPresetFile').trigger('click');
  });

  $('#sg_importPresetFile').on('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await importPreset(file);
      // 娓呯┖ input 浠ヤ究鍐嶆閫夋嫨鍚屼竴鏂囦欢
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


  $('#sg_wiIndexModelSelect').on('change', () => {
    const id = String($('#sg_wiIndexModelSelect').val() || '').trim();
    if (id) $('#sg_wiIndexCustomModel').val(id);
  });

  $('#sg_refreshRollModels').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await refreshRollModels();
  });

  $('#sg_wiRollModelSelect').on('change', () => {
    const id = String($('#sg_wiRollModelSelect').val() || '').trim();
    if (id) $('#sg_wiRollCustomModel').val(id);
  });

  // 钃濈伅绱㈠紩瀵煎叆/娓呯┖
  $('#sg_refreshBlueIndexLive').on('click', async () => {
    try {
      pullUiToSettings();
      saveSettings();
      const s = ensureSettings();
      const mode = String(s.wiBlueIndexMode || 'live');
      if (mode !== 'live') {
        setStatus('褰撳墠涓衡€滅紦瀛樷€濇ā寮忥細涓嶄細瀹炴椂璇诲彇锛堝彲鍒囨崲涓衡€滃疄鏃惰鍙栬摑鐏笘鐣屼功鈥濓級', 'warn');
        return;
      }
      const file = pickBlueIndexFileName();
      if (!file) {
        setStatus('钃濈伅涓栫晫涔︽枃浠跺悕涓虹┖锛氳鍦ㄢ€滆摑鐏储寮曗€濋噷濉啓鏂囦欢鍚嶏紝鎴栧湪鈥滃悓鏃跺啓鍏ヨ摑鐏笘鐣屼功鈥濋噷濉啓鏂囦欢鍚?, 'err');
        return;
      }
      const entries = await ensureBlueIndexLive(true);
      setStatus(`宸插疄鏃惰鍙栬摑鐏笘鐣屼功 鉁咃紙${entries.length} 鏉★級`, entries.length ? 'ok' : 'warn');
    } catch (e) {
      setStatus(`瀹炴椂璇诲彇钃濈伅涓栫晫涔﹀け璐ワ細${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_importBlueIndex').on('click', async () => {
    try {
      const file = await pickFile('.json,application/json');
      if (!file) return;
      const txt = await readFileText(file);
      const entries = parseWorldbookJson(txt);
      const s = ensureSettings();
      // 浠呬繚鐣欏繀瑕佸瓧娈?
      s.summaryBlueIndex = entries.map(e => ({
        title: String(e.title || '').trim() || (e.keys?.[0] ? `鏉＄洰锛?{e.keys[0]}` : '鏉＄洰'),
        summary: String(e.content || '').trim(),
        keywords: Array.isArray(e.keys) ? e.keys.slice(0, 80) : [],
        importedAt: Date.now(),
      })).filter(x => x.summary);
      saveSettings();
      updateBlueIndexInfoLabel();
      setStatus(`钃濈伅绱㈠紩宸插鍏?鉁咃紙${s.summaryBlueIndex.length} 鏉★級`, s.summaryBlueIndex.length ? 'ok' : 'warn');
    } catch (e) {
      setStatus(`瀵煎叆钃濈伅绱㈠紩澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_clearBlueIndex').on('click', () => {
    const s = ensureSettings();
    s.summaryBlueIndex = [];
    saveSettings();
    updateBlueIndexInfoLabel();
    setStatus('宸叉竻绌鸿摑鐏储寮?, 'ok');
  });

  $('#sg_clearWiLogs').on('click', async () => {
    try {
      const meta = getSummaryMeta();
      meta.wiTriggerLogs = [];
      await setSummaryMeta(meta);
      renderWiTriggerLogs(meta);
      setStatus('宸叉竻绌虹储寮曟棩蹇?, 'ok');
    } catch (e) {
      setStatus(`娓呯┖绱㈠紩鏃ュ織澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_clearRollLogs').on('click', async () => {
    try {
      const meta = getSummaryMeta();
      meta.rollLogs = [];
      await setSummaryMeta(meta);
      renderRollLogs(meta);
      setStatus('宸叉竻绌?ROLL 鏃ュ織', 'ok');
    } catch (e) {
      setStatus(`娓呯┖ ROLL 鏃ュ織澶辫触锛?{e?.message ?? e}`, 'err');
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
      setStatus('宸插鍑洪璁?鉁?, 'ok');
    } catch (e) {
      setStatus(`瀵煎嚭澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_importPreset').on('click', async () => {
    try {
      const file = await pickFile('.json,application/json');
      if (!file) return;
      const txt = await readFileText(file);
      const data = JSON.parse(txt);

      if (!data || typeof data !== 'object') {
        setStatus('瀵煎叆澶辫触锛氶璁炬枃浠舵牸寮忎笉瀵?, 'err');
        return;
      }

      const s = ensureSettings();
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (Object.hasOwn(data, k)) s[k] = data[k];
      }

      if (!s.modulesJson) s.modulesJson = JSON.stringify(DEFAULT_MODULES, null, 2);

      saveSettings();
      pullSettingsToUi();
      setStatus('宸插鍏ラ璁惧苟搴旂敤 鉁咃紙寤鸿鍒锋柊涓€娆￠〉闈級', 'ok');

      scheduleReapplyAll('import_preset');
    } catch (e) {
      setStatus(`瀵煎叆澶辫触锛?{e?.message ?? e}`, 'err');
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
      setStatus('涓栫晫涔﹀凡瀵煎叆 鉁?, entries.length ? 'ok' : 'warn');
    } catch (e) {
      setStatus(`瀵煎叆涓栫晫涔﹀け璐ワ細${e?.message ?? e}`, 'err');
    }
  });

  $('#sg_clearWorldbook').on('click', () => {
    const s = ensureSettings();
    s.worldbookJson = '';
    saveSettings();
    updateWorldbookInfoLabel();
    setStatus('宸叉竻绌轰笘鐣屼功', 'ok');
  });

  $('#sg_saveWorldbookSettings').on('click', () => {
    try {
      pullUiToSettings();
      saveSettings();
      updateWorldbookInfoLabel();
      setStatus('涓栫晫涔﹁缃凡淇濆瓨 鉁?, 'ok');
    } catch (e) {
      setStatus(`淇濆瓨涓栫晫涔﹁缃け璐ワ細${e?.message ?? e}`, 'err');
    }
  });

  // 鑷姩淇濆瓨锛氫笘鐣屼功鐩稿叧璁剧疆鍙樻洿鏃剁珛鍒诲啓鍏?
  $('#sg_worldbookEnabled, #sg_worldbookMode').on('change', () => {
    pullUiToSettings();
    saveSettings();
    updateWorldbookInfoLabel();
  });

  // 鍦板浘鍔熻兘浜嬩欢澶勭悊
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
    setStatus('宸叉仮澶嶉粯璁ゅ湴鍥炬彁绀鸿瘝 鉁?, 'ok');
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
      setStatus('鍦板浘宸查噸缃?鉁?, 'ok');
    } catch (e) {
      setStatus(`閲嶇疆鍦板浘澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });

  $('#sg_refreshMapPreview').on('click', () => {
    updateMapPreview();
    setStatus('鍦板浘棰勮宸插埛鏂?, 'ok');
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
      setStatus(`妯″潡 JSON 瑙ｆ瀽澶辫触锛?{e?.message ?? e}`, 'err');
      return;
    }
    const v = validateAndNormalizeModules(parsed);
    if (!v.ok) {
      setStatus(`妯″潡鏍￠獙澶辫触锛?{v.error}`, 'err');
      return;
    }
    setStatus(`妯″潡鏍￠獙閫氳繃 鉁咃紙${v.modules.length} 涓ā鍧楋級`, 'ok');
  });

  $('#sg_resetModules').on('click', () => {
    $('#sg_modulesJson').val(JSON.stringify(DEFAULT_MODULES, null, 2));
    setStatus('宸叉仮澶嶉粯璁ゆā鍧楋紙灏氭湭淇濆瓨锛岀偣鈥滃簲鐢ㄥ埌璁剧疆鈥濓級', 'warn');
  });

  $('#sg_applyModules').on('click', () => {
    const txt = String($('#sg_modulesJson').val() || '').trim();
    let parsed = null;
    try { parsed = JSON.parse(txt); } catch (e) {
      setStatus(`妯″潡 JSON 瑙ｆ瀽澶辫触锛?{e?.message ?? e}`, 'err');
      return;
    }
    const v = validateAndNormalizeModules(parsed);
    if (!v.ok) { setStatus(`妯″潡鏍￠獙澶辫触锛?{v.error}`, 'err'); return; }

    const s = ensureSettings();
    s.modulesJson = JSON.stringify(v.modules, null, 2);
    saveSettings();
    $('#sg_modulesJson').val(s.modulesJson);
    setStatus('妯″潡宸插簲鐢ㄥ苟淇濆瓨 鉁咃紙娉ㄦ剰锛氳拷鍔犳灞曠ず鐨勬ā鍧楃敱鈥滆拷鍔犳灞曠ず妯″潡鈥濇帶鍒讹級', 'ok');
  });

  // 鍒锋柊闈欐€佹ā鍧楃紦瀛?
  $('#sg_clearStaticCache').on('click', async () => {
    try {
      await clearStaticModulesCache();
      setStatus('宸叉竻闄ら潤鎬佹ā鍧楃紦瀛?鉁?涓嬫鍒嗘瀽浼氶噸鏂扮敓鎴愰潤鎬佹ā鍧楋紙濡?涓栫晫绠€浠?锛?, 'ok');
    } catch (e) {
      setStatus(`娓呴櫎闈欐€佹ā鍧楃紦瀛樺け璐ワ細${e?.message ?? e}`, 'err');
    }
  });

  // 鑷姩缁戝畾涓栫晫涔︿簨浠?
  $('#sg_autoBindWorldInfo').on('change', async () => {
    pullUiToSettings();
    saveSettings();
    const s = ensureSettings();
    if (s.autoBindWorldInfo) {
      await ensureBoundWorldInfo();
    }
    updateAutoBindUI();
  });

  $('#sg_autoBindWorldInfoPrefix').on('input', () => {
    pullUiToSettings();
    saveSettings();
  });

  // 蹇嵎閫夐」鎸夐挳浜嬩欢
  $('#sg_resetQuickOptions').on('click', () => {
    const defaultOptions = JSON.stringify([
      { label: '缁х画', prompt: '缁х画褰撳墠鍓ф儏鍙戝睍' },
      { label: '璇﹁堪', prompt: '璇锋洿璇︾粏鍦版弿杩板綋鍓嶅満鏅? },
      { label: '瀵硅瘽', prompt: '璁╄鑹蹭箣闂村睍寮€鏇村瀵硅瘽' },
      { label: '琛屽姩', prompt: '鎻忚堪鎺ヤ笅鏉ョ殑鍏蜂綋琛屽姩' },
    ], null, 2);
    $('#sg_quickOptionsJson').val(defaultOptions);
    const s = ensureSettings();
    s.quickOptionsJson = defaultOptions;
    saveSettings();
    setStatus('宸叉仮澶嶉粯璁ゅ揩鎹烽€夐」 鉁?, 'ok');
  });

  $('#sg_applyQuickOptions').on('click', () => {
    const txt = String($('#sg_quickOptionsJson').val() || '').trim();
    try {
      const arr = JSON.parse(txt || '[]');
      if (!Array.isArray(arr)) {
        setStatus('蹇嵎閫夐」鏍煎紡閿欒锛氬繀椤绘槸 JSON 鏁扮粍', 'err');
        return;
      }
      const s = ensureSettings();
      s.quickOptionsJson = JSON.stringify(arr, null, 2);
      saveSettings();
      $('#sg_quickOptionsJson').val(s.quickOptionsJson);
      setStatus('蹇嵎閫夐」宸插簲鐢ㄥ苟淇濆瓨 鉁?, 'ok');
    } catch (e) {
      setStatus(`蹇嵎閫夐」 JSON 瑙ｆ瀽澶辫触锛?{e?.message ?? e}`, 'err');
    }
  });
}

function showSettingsPage(page) {
  const p = String(page || 'guide');
  $('#sg_pgtab_guide, #sg_pgtab_summary, #sg_pgtab_index, #sg_pgtab_roll, #sg_pgtab_image').removeClass('active');
  $('#sg_page_guide, #sg_page_summary, #sg_page_index, #sg_page_roll, #sg_page_image').removeClass('active');

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
  } else {
    $('#sg_pgtab_guide').addClass('active');
    $('#sg_page_guide').addClass('active');
  }

  // 鍒囬〉鍚庡洖鍒伴《閮紝閬垮厤鈥滅湅涓嶅埌璁剧疆椤光€?
  try { $('.sg-left').scrollTop(0); } catch { }
}

function setupSettingsPages() {
  // 鎶娾€滅储寮曡缃潡鈥濅粠鎬荤粨椤电Щ鍒扮储寮曢〉锛堜繚鐣欏唴閮ㄦ墍鏈夋帶浠?id锛屼笉褰卞搷浜嬩欢缁戝畾锛?
  try {
    const $mount = $('#sg_index_mount');
    const $idxWrapper = $('#sg_wiTriggerEnabled').closest('.sg-card.sg-subcard');
    if ($mount.length && $idxWrapper.length) {
      $mount.append($idxWrapper.children());
      $idxWrapper.remove();
    }
  } catch { /* ignore */ }

  // ROLL 璁剧疆宸茬洿鎺ュ唴宓屽湪 sg_page_roll 涓紝鏃犻渶绉诲姩

  // tabs
  $('#sg_pgtab_guide').on('click', () => showSettingsPage('guide'));
  $('#sg_pgtab_summary').on('click', () => showSettingsPage('summary'));
  $('#sg_pgtab_index').on('click', () => showSettingsPage('index'));
  $('#sg_pgtab_roll').on('click', () => showSettingsPage('roll'));
  $('#sg_pgtab_image').on('click', () => showSettingsPage('image'));

  // quick jump
  $('#sg_gotoIndexPage').on('click', () => showSettingsPage('index'));
  $('#sg_gotoRollPage').on('click', () => showSettingsPage('roll'));

  // 鍥惧儚鐢熸垚浜嬩欢
  $('#sg_generateImage').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await runImageGeneration();
  });

  $('#sg_downloadImage').on('click', async () => {
    const src = $('#sg_generatedImage').attr('src');
    if (src) await saveGeneratedImage(src);
  });

  $('#sg_copyImagePrompt').on('click', () => {
    const prompt = $('#sg_imagePositivePrompt').val();
    if (prompt) {
      navigator.clipboard.writeText(prompt);
      setImageGenStatus('鎻愮ず璇嶅凡澶嶅埗鍒板壀璐存澘', 'ok');
    }
  });

  $('#sg_imageGenResetPrompt').on('click', () => {
    $('#sg_imageGenSystemPrompt').val(DEFAULT_SETTINGS.imageGenSystemPrompt);
    pullUiToSettings(); saveSettings();
    setImageGenStatus('宸叉仮澶嶉粯璁ゆ彁绀鸿瘝', 'ok');
  });

  $('#sg_editPromptAndGenerate').on('click', async () => {
    const $textarea = $('#sg_imagePositivePrompt');
    if ($textarea.prop('readonly')) {
      $textarea.prop('readonly', false);
      $('#sg_editPromptAndGenerate').text('浣跨敤缂栬緫鍚庣殑鎻愮ず璇嶇敓鎴?);
    } else {
      const positive = $textarea.val();
      if (positive) {
        const s = ensureSettings();
        setImageGenStatus('姝ｅ湪浣跨敤缂栬緫鍚庣殑鎻愮ず璇嶇敓鎴愨€?, 'warn');
        try {
          const imageUrl = await generateImageWithNovelAI(positive, '');
          $('#sg_generatedImage').attr('src', imageUrl);
          $('#sg_imageResult').show();
          setImageGenStatus('鉁?鐢熸垚鎴愬姛锛?, 'ok');
        } catch (e) {
          setImageGenStatus(`鉂?鐢熸垚澶辫触: ${e?.message || e}`, 'err');
        }
      }
    }
  });

  // 鍦ㄧ嚎鍥惧簱浜嬩欢
  $('#sg_loadGallery').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await loadGalleryFromGitHub();
  });

  $('#sg_matchGalleryImage').on('click', async () => {
    pullUiToSettings(); saveSettings();
    await matchGalleryImage();
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

  // 蹇嵎閫夐」
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
    $('#sg_worldbookInfo').text(count ? `宸插鍏ヤ笘鐣屼功锛?{count} 鏉 : '锛堟湭瀵煎叆涓栫晫涔︼級');
  } catch {
    $('#sg_worldbookInfo').text('锛堟湭瀵煎叆涓栫晫涔︼級');
  }

  $('#sg_custom_block').toggle(s.provider === 'custom');

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
  $('#sg_structuredEntriesEnabled').prop('checked', !!s.structuredEntriesEnabled);
  $('#sg_characterEntriesEnabled').prop('checked', !!s.characterEntriesEnabled);
  $('#sg_equipmentEntriesEnabled').prop('checked', !!s.equipmentEntriesEnabled);
  $('#sg_abilityEntriesEnabled').prop('checked', !!s.abilityEntriesEnabled);
  $('#sg_characterEntryPrefix').val(String(s.characterEntryPrefix || '浜虹墿'));
  $('#sg_equipmentEntryPrefix').val(String(s.equipmentEntryPrefix || '瑁呭'));
  $('#sg_abilityEntryPrefix').val(String(s.abilityEntryPrefix || '鑳藉姏'));
  $('#sg_structuredEntriesSystemPrompt').val(String(s.structuredEntriesSystemPrompt || DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT));
  $('#sg_structuredEntriesUserTemplate').val(String(s.structuredEntriesUserTemplate || DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE));
  $('#sg_structuredCharacterPrompt').val(String(s.structuredCharacterPrompt || DEFAULT_STRUCTURED_CHARACTER_PROMPT));
  $('#sg_structuredEquipmentPrompt').val(String(s.structuredEquipmentPrompt || DEFAULT_STRUCTURED_EQUIPMENT_PROMPT));
  $('#sg_structuredAbilityPrompt').val(String(s.structuredAbilityPrompt || DEFAULT_STRUCTURED_ABILITY_PROMPT));
  $('#sg_summaryCustomEndpoint').val(String(s.summaryCustomEndpoint || ''));
  $('#sg_summaryCustomApiKey').val(String(s.summaryCustomApiKey || ''));
  $('#sg_summaryCustomModel').val(String(s.summaryCustomModel || ''));
  fillSummaryModelSelect(Array.isArray(s.summaryCustomModelsCache) ? s.summaryCustomModelsCache : [], String(s.summaryCustomModel || ''));
  $('#sg_summaryCustomMaxTokens').val(s.summaryCustomMaxTokens || 2048);
  $('#sg_summaryCustomStream').prop('checked', !!s.summaryCustomStream);
  $('#sg_summaryToWorldInfo').prop('checked', !!s.summaryToWorldInfo);
  $('#sg_summaryWorldInfoTarget').val(String(s.summaryWorldInfoTarget || 'chatbook'));
  $('#sg_summaryWorldInfoFile').val(String(s.summaryWorldInfoFile || ''));
  $('#sg_summaryWorldInfoCommentPrefix').val(String(s.summaryWorldInfoCommentPrefix || '鍓ф儏鎬荤粨'));
  $('#sg_summaryWorldInfoKeyMode').val(String(s.summaryWorldInfoKeyMode || 'keywords'));
  $('#sg_summaryIndexPrefix').val(String(s.summaryIndexPrefix || 'A-'));
  $('#sg_summaryIndexPad').val(s.summaryIndexPad ?? 3);
  $('#sg_summaryIndexStart').val(s.summaryIndexStart ?? 1);
  $('#sg_summaryIndexInComment').prop('checked', !!s.summaryIndexInComment);
  $('#sg_summaryToBlueWorldInfo').prop('checked', !!s.summaryToBlueWorldInfo);
  $('#sg_summaryBlueWorldInfoFile').val(String(s.summaryBlueWorldInfoFile || ''));

  // 鑷姩缁戝畾涓栫晫涔?
  $('#sg_autoBindWorldInfo').prop('checked', !!s.autoBindWorldInfo);
  $('#sg_autoBindWorldInfoPrefix').val(String(s.autoBindWorldInfoPrefix || 'SG'));
  updateAutoBindUI();

  // 鍦板浘鍔熻兘
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

  // 鍥惧儚鐢熸垚璁剧疆
  $('#sg_imageGenEnabled').prop('checked', !!s.imageGenEnabled);
  $('#sg_novelaiApiKey').val(String(s.novelaiApiKey || ''));
  $('#sg_novelaiModel').val(String(s.novelaiModel || 'nai-diffusion-3'));
  $('#sg_novelaiResolution').val(String(s.novelaiResolution || '832x1216'));
  $('#sg_novelaiSteps').val(s.novelaiSteps || 28);
  $('#sg_novelaiScale').val(s.novelaiScale || 5);
  $('#sg_novelaiNegativePrompt').val(String(s.novelaiNegativePrompt || ''));
  $('#sg_imageGenAutoSave').prop('checked', !!s.imageGenAutoSave);
  $('#sg_imageGenSavePath').val(String(s.imageGenSavePath || ''));
  $('#sg_imageGenLookbackMessages').val(s.imageGenLookbackMessages || 5);
  $('#sg_imageGenReadStatData').prop('checked', !!s.imageGenReadStatData);
  $('#sg_imageGenStatVarName').val(String(s.imageGenStatVarName || 'stat_data'));
  $('#sg_imageGenCustomEndpoint').val(String(s.imageGenCustomEndpoint || ''));
  $('#sg_imageGenCustomApiKey').val(String(s.imageGenCustomApiKey || ''));
  $('#sg_imageGenCustomModel').val(String(s.imageGenCustomModel || 'gpt-4o-mini'));
  $('#sg_imageGenSystemPrompt').val(String(s.imageGenSystemPrompt || DEFAULT_SETTINGS.imageGenSystemPrompt));

  // 鍦ㄧ嚎鍥惧簱璁剧疆
  $('#sg_imageGalleryEnabled').prop('checked', !!s.imageGalleryEnabled);
  $('#sg_imageGalleryUrl').val(String(s.imageGalleryUrl || ''));
  if (s.imageGalleryCache && s.imageGalleryCache.length > 0) {
    $('#sg_galleryInfo').text(`(宸茬紦瀛?${s.imageGalleryCache.length} 寮?`);
  }

  // 瑙掕壊鏍囩涓栫晫涔﹁缃?
  $('#sg_imageGenWorldBookEnabled').prop('checked', !!s.imageGenWorldBookEnabled);
  $('#sg_imageGenWorldBookFile').val(String(s.imageGenWorldBookFile || ''));
  if (s.imageGenWorldBookCache && s.imageGenWorldBookCache.length > 0) {
    $('#sg_imageGenWorldBookInfo').text(`(宸茬紦瀛?${s.imageGenWorldBookCache.length} 涓潯鐩?`);
  }

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

  updateSummaryInfoLabel();
  renderSummaryPaneFromMeta();
  renderWiTriggerLogs();
  renderRollLogs();

  updateButtonsEnabled();
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
    const errShort = err ? err.replace(/\s+/g, ' ').slice(0, 60) + (err.length > 60 ? '鈥? : '') : '';
    $info.text(`锛堣摑鐏储寮曪細${count} 鏉★綔瀹炴椂锛?{file || '鏈缃?}${ts ? `锝滄洿鏂帮細${ts}` : ''}${errShort ? `锝滆鍙栧け璐ワ細${errShort}` : ''}锛塦);
  } else {
    $info.text(`锛堣摑鐏储寮曪細${count} 鏉★綔缂撳瓨锛塦);
  }
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
    $box.html('<div class="sg-hint">(鏆傛棤)</div>');
    return;
  }

  const shown = logs.slice(0, 30);
  const html = shown.map((l) => {
    const ts = formatTimeShort(l.ts);
    const skipped = l.skipped === true;
    const picked = Array.isArray(l.picked) ? l.picked : [];
    const titles = picked.map(x => String(x?.title || '').trim()).filter(Boolean);
    const titleShort = titles.length
      ? (titles.slice(0, 4).join('锛?) + (titles.length > 4 ? '鈥? : ''))
      : '锛堟棤鍛戒腑鏉＄洰锛?;
    const user = String(l.userText || '').replace(/\s+/g, ' ').trim();
    const userShort = user ? (user.slice(0, 120) + (user.length > 120 ? '鈥? : '')) : '';
    const kws = Array.isArray(l.injectedKeywords) ? l.injectedKeywords : [];
    const kwsShort = kws.length ? (kws.slice(0, 20).join('銆?) + (kws.length > 20 ? '鈥? : '')) : '';

    if (skipped) {
      const assistantFloors = Number(l.assistantFloors || 0);
      const startAfter = Number(l.startAfter || 0);
      const reasonKey = String(l.skippedReason || '').trim();
      const reasonText = reasonKey === 'minAssistantFloors'
        ? `AI 鍥炲妤煎眰涓嶈冻锛?{assistantFloors}/${startAfter}锛塦
        : (reasonKey || '璺宠繃');
      const detailsLines = [];
      if (userShort) detailsLines.push(`<div><b>鐢ㄦ埛杈撳叆</b>锛?{escapeHtml(userShort)}</div>`);
      detailsLines.push(`<div><b>鏈Е鍙?/b>锛?{escapeHtml(reasonText)}</div>`);
      return `
      <details>
        <summary>${escapeHtml(`${ts}锝滄湭瑙﹀彂锛?{reasonText}`)}</summary>
        <div class="sg-log-body">${detailsLines.join('')}</div>
      </details>
    `;
    }

    const detailsLines = [];
    if (userShort) detailsLines.push(`<div><b>鐢ㄦ埛杈撳叆</b>锛?{escapeHtml(userShort)}</div>`);
    detailsLines.push(`<div><b>灏嗚Е鍙戠豢鐏潯鐩?/b>锛?{escapeHtml(titles.join('锛?) || '锛堟棤锛?)}</div>`);
    detailsLines.push(`<div><b>娉ㄥ叆瑙﹀彂璇?/b>锛?{escapeHtml(kwsShort || '锛堟棤锛?)}</div>`);
    if (picked.length) {
      const scored = picked.map(x => `${String(x.title || '').trim()}锛?{Number(x.score || 0).toFixed(2)}锛塦).join('锛?);
      detailsLines.push(`<div class="sg-hint">鐩镐技搴︼細${escapeHtml(scored)}</div>`);
    }
    return `
      <details>
        <summary>${escapeHtml(`${ts}锝滃懡涓?{titles.length}鏉★細${titleShort}`)}</summary>
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
    // 涓?await锛氶伩鍏嶉樆濉?MESSAGE_SENT
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
    $box.html('(鏆傛棤)');
    return;
  }
  const shown = logs.slice(0, 30);
  const html = shown.map((l) => {
    const ts = l?.ts ? new Date(l.ts).toLocaleString() : '';
    const action = String(l?.action || '').trim();
    const outcome = String(l?.outcomeTier || '').trim()
      || (l?.success == null ? 'N/A' : (l.success ? '鎴愬姛' : '澶辫触'));
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
    if (userShort) detailsLines.push(`<div><b>鐢ㄦ埛杈撳叆</b>锛?{escapeHtml(userShort)}</div>`);
    if (summary) detailsLines.push(`<div><b>鎽樿</b>锛?{escapeHtml(summary)}</div>`);
    return `
      <details>
        <summary>${escapeHtml(`${ts}锝?{action || 'ROLL'}锝?{outcome}${finalVal ? `锝滄渶缁?${finalVal}` : ''}`)}</summary>
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
      $info.text('锛堟湭瀵煎叆涓栫晫涔︼級');
      return;
    }
    const stats = computeWorldbookInjection();
    const base = `宸插鍏ヤ笘鐣屼功锛?{stats.importedEntries} 鏉;
    if (!s.worldbookEnabled) {
      $info.text(`${base}锛堟湭鍚敤娉ㄥ叆锛塦);
      return;
    }
    if (stats.mode === 'active' && stats.selectedEntries === 0) {
      $info.text(`${base}锝滄ā寮忥細active锝滄湰娆℃棤鏉＄洰鍛戒腑锛? 鏉★級`);
      return;
    }
    $info.text(`${base}锝滄ā寮忥細${stats.mode}锝滄湰娆℃敞鍏ワ細${stats.injectedEntries} 鏉★綔瀛楃锛?{stats.injectedChars}锝滅害 tokens锛?{stats.injectedTokens}`);
  } catch {
    $info.text('锛堜笘鐣屼功淇℃伅瑙ｆ瀽澶辫触锛?);
  }
}

function formatSummaryMetaHint(meta) {
  const last = Number(meta?.lastFloor || 0);
  const count = Array.isArray(meta?.history) ? meta.history.length : 0;
  if (!last && !count) return '锛堟湭鐢熸垚锛?;
  return `宸茬敓鎴?${count} 娆★綔涓婃瑙﹀彂灞傦細${last}`;
}

function updateSummaryInfoLabel() {
  const $info = $('#sg_summaryInfo');
  if (!$info.length) return;
  try {
    const meta = getSummaryMeta();
    $info.text(formatSummaryMetaHint(meta));
  } catch {
    $info.text('锛堟€荤粨鐘舵€佽В鏋愬け璐ワ級');
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
    const floorNow = computeFloorCount(chat, mode);
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
        extra = `锝滃垎娈碉細${pieces} 鏉★紙姣?{every}灞傦級`;
      } else {
        extra = `锝滃垎娈碉細姣?{every}灞備竴鏉;
      }
    }

    $hint.text(`锛堝彲閫夎寖鍥达細1-${floorNow || 0}${extra}锛塦);
    if (!$from.length || !$to.length) return;

    const fromVal = String($from.val() ?? '').trim();
    const toVal = String($to.val() ?? '').trim();

    if (setDefaults && floorNow > 0 && (!fromVal || !toVal)) {
      const a = Math.max(1, floorNow - every + 1);
      $from.val(a);
      $to.val(floorNow);
    }
  } catch {
    $hint.text('锛堝彲閫夎寖鍥达細?锛?);
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
    $el.html('(灏氭湭鐢熸垚)');
    updateButtonsEnabled();
    return;
  }

  const last = hist[hist.length - 1];
  lastSummary = last;
  lastSummaryText = String(last?.summary || '');

  const md = hist.slice(-12).reverse().map((h, idx) => {
    const title = String(h.title || `${ensureSettings().summaryWorldInfoCommentPrefix || '鍓ф儏鎬荤粨'} #${hist.length - idx}`);
    const kws = Array.isArray(h.keywords) ? h.keywords : [];
    const when = h.createdAt ? new Date(h.createdAt).toLocaleString() : '';
    const range = h?.range ? `锛?{h.range.fromFloor}-${h.range.toFloor}锛塦 : '';
    return `### ${title} ${range}\n\n- 鏃堕棿锛?{when}\n- 鍏抽敭璇嶏細${kws.join('銆?) || '锛堟棤锛?}\n\n${h.summary || ''}`;
  }).join('\n\n---\n\n');

  renderMarkdownInto($el, md);
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

  // modulesJson锛氬厛涓嶅己琛屾牎楠岋紙鐢ㄦ埛鍙厛淇濆瓨鍐嶆牎楠岋級锛屼絾浼氬湪鍒嗘瀽鍓嶇敤榛樿鍏滃簳
  s.modulesJson = String($('#sg_modulesJson').val() || '').trim() || JSON.stringify(DEFAULT_MODULES, null, 2);

  s.customSystemPreamble = String($('#sg_customSystemPreamble').val() || '');
  s.customConstraints = String($('#sg_customConstraints').val() || '');

  // 蹇嵎閫夐」鍐欏叆
  s.quickOptionsEnabled = $('#sg_quickOptionsEnabled').is(':checked');
  s.quickOptionsShowIn = String($('#sg_quickOptionsShowIn').val() || 'inline');
  s.quickOptionsJson = String($('#sg_quickOptionsJson').val() || '[]');

  s.presetIncludeApiKey = $('#sg_presetIncludeApiKey').is(':checked');

  s.worldbookEnabled = $('#sg_worldbookEnabled').is(':checked');
  s.worldbookMode = String($('#sg_worldbookMode').val() || 'active');
  s.worldbookMaxChars = clampInt($('#sg_worldbookMaxChars').val(), 500, 50000, s.worldbookMaxChars || 6000);
  s.worldbookWindowMessages = clampInt($('#sg_worldbookWindowMessages').val(), 5, 80, s.worldbookWindowMessages || 18);

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
  s.structuredEntriesEnabled = $('#sg_structuredEntriesEnabled').is(':checked');
  s.characterEntriesEnabled = $('#sg_characterEntriesEnabled').is(':checked');
  s.equipmentEntriesEnabled = $('#sg_equipmentEntriesEnabled').is(':checked');
  s.abilityEntriesEnabled = $('#sg_abilityEntriesEnabled').is(':checked');
  s.characterEntryPrefix = String($('#sg_characterEntryPrefix').val() || '浜虹墿').trim() || '浜虹墿';
  s.equipmentEntryPrefix = String($('#sg_equipmentEntryPrefix').val() || '瑁呭').trim() || '瑁呭';
  s.abilityEntryPrefix = String($('#sg_abilityEntryPrefix').val() || '鑳藉姏').trim() || '鑳藉姏';
  s.structuredEntriesSystemPrompt = String($('#sg_structuredEntriesSystemPrompt').val() || '').trim() || DEFAULT_STRUCTURED_ENTRIES_SYSTEM_PROMPT;
  s.structuredEntriesUserTemplate = String($('#sg_structuredEntriesUserTemplate').val() || '').trim() || DEFAULT_STRUCTURED_ENTRIES_USER_TEMPLATE;
  s.structuredCharacterPrompt = String($('#sg_structuredCharacterPrompt').val() || '').trim() || DEFAULT_STRUCTURED_CHARACTER_PROMPT;
  s.structuredEquipmentPrompt = String($('#sg_structuredEquipmentPrompt').val() || '').trim() || DEFAULT_STRUCTURED_EQUIPMENT_PROMPT;
  s.structuredAbilityPrompt = String($('#sg_structuredAbilityPrompt').val() || '').trim() || DEFAULT_STRUCTURED_ABILITY_PROMPT;
  s.summaryCustomEndpoint = String($('#sg_summaryCustomEndpoint').val() || '').trim();
  s.summaryCustomApiKey = String($('#sg_summaryCustomApiKey').val() || '');
  s.summaryCustomModel = String($('#sg_summaryCustomModel').val() || '').trim() || 'gpt-4o-mini';
  s.summaryCustomMaxTokens = clampInt($('#sg_summaryCustomMaxTokens').val(), 128, 200000, s.summaryCustomMaxTokens || 2048);
  s.summaryCustomStream = $('#sg_summaryCustomStream').is(':checked');
  s.summaryToWorldInfo = $('#sg_summaryToWorldInfo').is(':checked');
  s.summaryWorldInfoTarget = String($('#sg_summaryWorldInfoTarget').val() || 'chatbook');
  s.summaryWorldInfoFile = String($('#sg_summaryWorldInfoFile').val() || '').trim();
  s.summaryWorldInfoCommentPrefix = String($('#sg_summaryWorldInfoCommentPrefix').val() || '鍓ф儏鎬荤粨').trim() || '鍓ф儏鎬荤粨';
  s.summaryWorldInfoKeyMode = String($('#sg_summaryWorldInfoKeyMode').val() || 'keywords');
  s.summaryIndexPrefix = String($('#sg_summaryIndexPrefix').val() || 'A-').trim() || 'A-';
  s.summaryIndexPad = clampInt($('#sg_summaryIndexPad').val(), 1, 12, s.summaryIndexPad ?? 3);
  s.summaryIndexStart = clampInt($('#sg_summaryIndexStart').val(), 1, 1000000, s.summaryIndexStart ?? 1);
  s.summaryIndexInComment = $('#sg_summaryIndexInComment').is(':checked');
  s.summaryToBlueWorldInfo = $('#sg_summaryToBlueWorldInfo').is(':checked');
  s.summaryBlueWorldInfoFile = String($('#sg_summaryBlueWorldInfoFile').val() || '').trim();

  // 鑷姩缁戝畾涓栫晫涔?
  s.autoBindWorldInfo = $('#sg_autoBindWorldInfo').is(':checked');
  s.autoBindWorldInfoPrefix = String($('#sg_autoBindWorldInfoPrefix').val() || 'SG').trim() || 'SG';

  // 鍦板浘鍔熻兘
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

  // 鍥惧儚鐢熸垚璁剧疆
  s.imageGenEnabled = $('#sg_imageGenEnabled').is(':checked');
  s.novelaiApiKey = String($('#sg_novelaiApiKey').val() || '').trim();
  s.novelaiModel = String($('#sg_novelaiModel').val() || 'nai-diffusion-3');
  s.novelaiResolution = String($('#sg_novelaiResolution').val() || '832x1216');
  s.novelaiSteps = clampInt($('#sg_novelaiSteps').val(), 1, 50, s.novelaiSteps || 28);
  s.novelaiScale = clampFloat($('#sg_novelaiScale').val(), 1, 10, s.novelaiScale || 5);
  s.novelaiNegativePrompt = String($('#sg_novelaiNegativePrompt').val() || '').trim();
  s.imageGenAutoSave = $('#sg_imageGenAutoSave').is(':checked');
  s.imageGenSavePath = String($('#sg_imageGenSavePath').val() || '').trim();
  s.imageGenLookbackMessages = clampInt($('#sg_imageGenLookbackMessages').val(), 1, 30, s.imageGenLookbackMessages || 5);
  s.imageGenReadStatData = $('#sg_imageGenReadStatData').is(':checked');
  s.imageGenStatVarName = String($('#sg_imageGenStatVarName').val() || 'stat_data').trim() || 'stat_data';
  s.imageGenCustomEndpoint = String($('#sg_imageGenCustomEndpoint').val() || '').trim();
  s.imageGenCustomApiKey = String($('#sg_imageGenCustomApiKey').val() || '').trim();
  s.imageGenCustomModel = String($('#sg_imageGenCustomModel').val() || 'gpt-4o-mini');
  s.imageGenSystemPrompt = String($('#sg_imageGenSystemPrompt').val() || '').trim() || DEFAULT_SETTINGS.imageGenSystemPrompt;

  // 鍦ㄧ嚎鍥惧簱璁剧疆
  s.imageGalleryEnabled = $('#sg_imageGalleryEnabled').is(':checked');
  s.imageGalleryUrl = String($('#sg_imageGalleryUrl').val() || '').trim();

  // 瑙掕壊鏍囩涓栫晫涔﹁缃?
  s.imageGenWorldBookEnabled = $('#sg_imageGenWorldBookEnabled').is(':checked');
  s.imageGenWorldBookFile = String($('#sg_imageGenWorldBookFile').val() || '').trim();

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
}

function openModal() {
  ensureModal();
  pullSettingsToUi();
  updateWorldbookInfoLabel();
  updateSummaryManualRangeHint(true);
  // 鎵撳紑闈㈡澘鏃跺皾璇曞埛鏂颁竴娆¤摑鐏储寮曪紙涓嶉樆濉?UI锛?
  ensureBlueIndexLive(false).catch(() => void 0);
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
        <div class="sg-min-title">鍓ф儏鎸囧 StoryGuide <span class="sg-sub">v${SG_VERSION}</span></div>
        <button class="menu_button sg-btn" id="sg_open_from_settings">鎵撳紑闈㈡澘</button>
      </div>
      <div class="sg-min-hint">鏀寔鑷畾涔夎緭鍑烘ā鍧楋紙JSON锛夛紝骞朵笖鑷姩杩藉姞妗嗕細缂撳瓨+鐩戝惉閲嶆覆鏌擄紝灏介噺涓嶈鍙橀噺鏇存柊瑕嗙洊銆?/div>
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

    // 棰勭儹钃濈伅绱㈠紩锛堝疄鏃惰鍙栨ā寮忎笅锛夛紝灏介噺閬垮厤绗竴娆″彂閫佹秷鎭椂杩樻病绱㈠紩
    ensureBlueIndexLive(true).catch(() => void 0);

    eventSource.on(event_types.CHAT_CHANGED, () => {
      inlineCache.clear();
      scheduleReapplyAll('chat_changed');
      ensureChatActionButtons();
      ensureBlueIndexLive(true).catch(() => void 0);
      if (document.getElementById('sg_modal_backdrop') && $('#sg_modal_backdrop').is(':visible')) {
        pullSettingsToUi();
        setStatus('宸插垏鎹㈣亰澶╋細宸插悓姝ユ湰鑱婂ぉ瀛楁', 'ok');
      }
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
      // 绂佹鑷姩鐢熸垚锛氫笉鍦ㄦ敹鍒版秷鎭椂鑷姩鍒嗘瀽/杩藉姞
      scheduleReapplyAll('msg_received');
      // 鑷姩鎬荤粨锛堢嫭绔嬪姛鑳斤級
      scheduleAutoSummary('msg_received');
    });

    eventSource.on(event_types.MESSAGE_SENT, () => {
      // 绂佹鑷姩鐢熸垚锛氫笉鍦ㄥ彂閫佹秷鎭椂鑷姩鍒锋柊闈㈡澘
      // ROLL 鍒ゅ畾锛堝敖閲忓湪鐢熸垚鍓嶅畬鎴愶級
      maybeInjectRollResult('msg_sent').catch(() => void 0);
      // 钃濈伅绱㈠紩 鈫?缁跨伅瑙﹀彂锛堝敖閲忓湪鐢熸垚鍓嶅畬鎴愶級
      maybeInjectWorldInfoTriggers('msg_sent').catch(() => void 0);
      scheduleAutoSummary('msg_sent');
    });
  });
}

// -------------------- 鎮诞鎸夐挳鍜岄潰鏉?--------------------

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

// 妫€娴嬬Щ鍔ㄧ/骞虫澘绔栧睆妯″紡锛堢鐢ㄨ嚜瀹氫箟瀹氫綅锛屼娇鐢?CSS 搴曢儴寮瑰嚭鏍峰紡锛?
// 鍖归厤 CSS 濯掍綋鏌ヨ: (max-width: 768px), (max-aspect-ratio: 1/1)
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
  btn.innerHTML = '馃摌';
  btn.title = '鍓ф儏鎸囧';
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
      <span class="sg-floating-title">馃摌 鍓ф儏鎸囧</span>
        <div class="sg-floating-actions">
          <button class="sg-floating-action-btn" id="sg_floating_show_report" title="鏌ョ湅鍒嗘瀽">馃摉</button>
          <button class="sg-floating-action-btn" id="sg_floating_show_map" title="鏌ョ湅鍦板浘">馃椇锔?/button>
          <button class="sg-floating-action-btn" id="sg_floating_roll_logs" title="ROLL鏃ュ織">馃幉</button>
          <button class="sg-floating-action-btn" id="sg_floating_settings" title="鎵撳紑璁剧疆">鈿欙笍</button>
          <button class="sg-floating-action-btn" id="sg_floating_close" title="鍏抽棴">鉁?/button>
        </div>
    </div>
    <div class="sg-floating-body" id="sg_floating_body">
      <div style="padding:20px; text-align:center; color:#aaa;">
        鐐瑰嚮 <button class="sg-inner-refresh-btn" style="background:none; border:none; cursor:pointer; font-size:1.2em;">馃攧</button> 鐢熸垚
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

  // 浜嬩欢缁戝畾
  $('#sg_floating_close').on('click', () => {
    hideFloatingPanel();
  });

  $('#sg_floating_show_report').on('click', () => {
    showFloatingReport();
  });

  $('#sg_floating_show_map').on('click', () => {
    showFloatingMap();
  });

  // Delegate inner refresh click
  $(document).on('click', '.sg-inner-refresh-btn', async (e) => {
    // Only handle if inside our panel
    if (!$(e.target).closest('#sg_floating_panel').length) return;
    await refreshFloatingPanelContent();
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

  $('#sg_floating_roll_logs').on('click', () => {
    showFloatingRollLogs();
  });

  $('#sg_floating_settings').on('click', () => {
    openModal();
    hideFloatingPanel();
  });

  // Drag logic
  const header = panel.querySelector('.sg-floating-header');
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let moved = false;

  const onDown = (ev) => {
    if (ev.target.closest('button')) return; // ignore buttons
    if (isMobilePortrait()) return; // 绉诲姩绔珫灞忕鐢ㄦ嫋鎷斤紝浣跨敤 CSS 搴曢儴寮瑰嚭

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

    // 绉诲姩绔珫灞忎娇鐢?CSS 搴曢儴寮瑰嚭锛屼笉闇€瑕?JS 瀹氫綅
    if (isMobilePortrait()) return;

    // Remove viewport size guard to ensure panel is always kept reachable
    // if (!shouldGuardFloatingPanelViewport()) return;

    // 涓?clampToViewport 淇濇寔涓€鑷寸殑杈圭晫閫昏緫锛堝厑璁?50% 瓒婄晫锛?
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

    // 妫€鏌ユ槸鍚﹂渶瑕佽皟鏁翠綅缃紙浣跨敤鏀惧鐨勮竟鐣岄€昏緫锛?
    // 濡傛灉鍙閮ㄥ垎灏戜簬 minVisible锛屽垯闇€瑕佽皟鏁?
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
    requestAnimationFrame(() => ensureFloatingPanelInViewport(panel));
  });
}

function showFloatingPanel() {
  createFloatingPanel();
  const panel = document.getElementById('sg_floating_panel');
  if (panel) {
    // 绉诲姩绔?骞虫澘锛氬己鍒朵娇鐢ㄥ簳閮ㄥ脊鍑烘牱寮?
    if (isMobilePortrait()) {
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
    } else if (window.innerWidth < 1200) {
      // 妗岄潰绔皬绐楀彛锛氭竻闄ゅ彲鑳界殑鍐呰仈鏍峰紡锛屼娇鐢?CSS
      panel.style.left = '';
      panel.style.top = '';
      panel.style.bottom = '';
      panel.style.right = '';
      panel.style.transform = '';
      panel.style.maxWidth = '';
      panel.style.maxHeight = '';
      panel.style.display = '';
      panel.style.height = '';
      panel.style.opacity = '';
      panel.style.visibility = '';
      panel.style.transition = '';
      panel.style.borderRadius = '';
    } else {
      panel.style.display = '';
    }

    panel.classList.add('visible');
    floatingPanelVisible = true;
    // 濡傛灉鏈夌紦瀛樺唴瀹瑰垯鏄剧ず
    if (lastFloatingContent) {
      updateFloatingPanelBody(lastFloatingContent);
    }

    // 闈炵Щ鍔ㄧ鎵嶈繍琛岃鍙ｆ娴?
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
    if (isMobilePortrait()) {
      panel.style.display = 'none';
    }
  }
}

async function refreshFloatingPanelContent() {
  const $body = $('#sg_floating_body');
  if (!$body.length) return;

  $body.html('<div class="sg-floating-loading">姝ｅ湪鍒嗘瀽鍓ф儏...</div>');

  try {
    const s = ensureSettings();
    const { snapshotText } = buildSnapshot();
    const modules = getModules('panel');

    if (!modules.length) {
      $body.html('<div class="sg-floating-loading">娌℃湁閰嶇疆妯″潡</div>');
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
      $body.html('<div class="sg-floating-loading">瑙ｆ瀽澶辫触</div>');
      return;
    }

    // 鍚堝苟闈欐€佹ā鍧?
    const mergedParsed = mergeStaticModulesIntoResult(parsed, modules);
    updateStaticModulesCache(mergedParsed, modules).catch(() => void 0);

    // 娓叉煋鍐呭
    // Filter out quick_actions from main Markdown body to avoid duplication
    const bodyModules = modules.filter(m => m.key !== 'quick_actions');
    const md = renderReportMarkdownFromModules(mergedParsed, bodyModules);
    const html = renderMarkdownToHtml(md);

    await updateMapFromSnapshot(snapshotText);

    // 娣诲姞蹇嵎閫夐」
    const quickActions = Array.isArray(mergedParsed.quick_actions) ? mergedParsed.quick_actions : [];
    const optionsHtml = renderDynamicQuickActionsHtml(quickActions, 'panel');

    const refreshBtnHtml = `
      <div style="padding:2px 8px; border-bottom:1px solid rgba(128,128,128,0.2); margin-bottom:4px; text-align:right;">
        <button class="sg-inner-refresh-btn" title="閲嶆柊鐢熸垚鍒嗘瀽" style="background:none; border:none; cursor:pointer; font-size:1.1em; opacity:0.8;">馃攧</button>
      </div>
    `;

    const fullHtml = refreshBtnHtml + html + optionsHtml;
    lastFloatingContent = fullHtml;
    updateFloatingPanelBody(fullHtml);

  } catch (e) {
    console.warn('[StoryGuide] floating panel refresh failed:', e);
    $body.html(`<div class="sg-floating-loading">鍒嗘瀽澶辫触: ${e?.message ?? e}</div>`);
  }
}

function updateFloatingPanelBody(html) {
  const $body = $('#sg_floating_body');
  if ($body.length) {
    $body.html(html);
  }
}

function showFloatingRollLogs() {
  const $body = $('#sg_floating_body');
  if (!$body.length) return;

  const meta = getSummaryMeta();
  const logs = Array.isArray(meta?.rollLogs) ? meta.rollLogs : [];

  if (!logs.length) {
    $body.html('<div class="sg-floating-loading">鏆傛棤 ROLL 鏃ュ織</div>');
    return;
  }

  const html = logs.slice(0, 50).map((l) => {
    const ts = l?.ts ? new Date(l.ts).toLocaleString() : '';
    const action = String(l?.action || '').trim();
    const outcome = String(l?.outcomeTier || '').trim()
      || (l?.success == null ? 'N/A' : (l.success ? '鎴愬姛' : '澶辫触'));
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
    if (userShort) detailsLines.push(`<div><b>鐢ㄦ埛杈撳叆</b>锛?{escapeHtml(userShort)}</div>`);
    if (summary) detailsLines.push(`<div><b>鎽樿</b>锛?{escapeHtml(summary)}</div>`);
    return `
      <details style="margin-bottom:4px; padding:4px; border-bottom:1px solid rgba(128,128,128,0.3);">
        <summary style="font-size:0.9em; cursor:pointer; outline:none;">${escapeHtml(`${ts}锝?{action || 'ROLL'}锝?{outcome}${finalVal ? `锝滄渶缁?${finalVal}` : ''}`)}</summary>
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
    $body.html('<div class="sg-floating-loading">鍦板浘鍔熻兘鏈惎鐢?/div>');
    return;
  }
  const mapData = getMapData();
  const html = renderGridMap(mapData);
  const autoLabel = isMapAutoUpdateEnabled(s) ? '鑷姩鏇存柊锛氬紑' : '鑷姩鏇存柊锛氬叧';
  const tools = `
      <div style="padding:2px 8px; border-bottom:1px solid rgba(128,128,128,0.2); margin-bottom:4px; text-align:right;">
        <button class="sg-inner-map-toggle-btn" title="鍒囨崲鑷姩鏇存柊" style="background:none; border:none; cursor:pointer; font-size:0.95em; opacity:0.85; margin-right:6px;">${autoLabel}</button>
        <button class="sg-inner-map-reset-btn" title="閲嶇疆鍦板浘" style="background:none; border:none; cursor:pointer; font-size:1.1em; opacity:0.8;">馃棏</button>
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
        鐐瑰嚮 <button class="sg-inner-refresh-btn" style="background:none; border:none; cursor:pointer; font-size:1.2em;">馃攧</button> 鐢熸垚
      </div>
    `);
  }
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
    btn.innerHTML = '馃摌 鍓ф儏';
    btn.title = '鎵撳紑鍓ф儏鎸囧鎮诞绐?;
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
    // 涓嶅啀鍦ㄩ《鏍忔樉绀吼煋樻寜閽紙閬垮厤鍗犱綅/閲嶅鍏ュ彛锛?
    const oldBtn = document.getElementById('sg_topbar_btn');
    if (oldBtn) oldBtn.remove();

    injectMinimalSettingsPanel();
    ensureChatActionButtons();
    installCardZoomDelegation();
    installQuickOptionsClickHandler();
    createFloatingButton();
    injectFixedInputButton();
    installRollPreSendHook();
  });

  // 鑱婂ぉ鍒囨崲鏃惰嚜鍔ㄧ粦瀹氫笘鐣屼功
  eventSource.on(event_types.CHAT_CHANGED, async () => {
    console.log('[StoryGuide] CHAT_CHANGED 浜嬩欢瑙﹀彂');

    const ctx = SillyTavern.getContext();
    const hasChat = ctx.chat && Array.isArray(ctx.chat);
    const chatLength = hasChat ? ctx.chat.length : 0;

    console.log('[StoryGuide] 鑱婂ぉ鐘舵€?', { hasChat, chatLength, chatMetadata: !!ctx.chatMetadata });

    // 鏀惧妫€鏌ワ細鍙鏈?chatMetadata 灏卞皾璇曡繍琛?
    if (!ctx.chatMetadata) {
      console.log('[StoryGuide] 娌℃湁 chatMetadata锛岃烦杩囪嚜鍔ㄧ粦瀹?);
      return;
    }

    try {
      await onChatSwitched();
    } catch (e) {
      console.warn('[StoryGuide] 鑷姩缁戝畾涓栫晫涔﹀け璐?', e);
    }
  });

  globalThis.StoryGuide = {
    open: openModal,
    close: closeModal,
    runAnalysis,
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



