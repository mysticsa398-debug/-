import {generate,scriptDecision,timeShots,type Insight,type Match,type Fact,type Shot} from './domain.ts'
export const reportUrl='https://my.feishu.cn/docx/Bg5hdaXGwoS493xwMOzcuxdHnmb'
export const hooks=[
 {id:'A',name:'价格数字',share:30,lever:'降低价格顾虑',fit:'需有当前活动证据',line:'挑吹风机，除了到手价，还要看什么？',visual:'商品卡与产品同框；仅展示已核验的当前价格。',risk:'不要借用竞品价格、赠品、试用政策或虚构原价。'},
 {id:'B',name:'实测实验',share:9,lever:'让结果可观察',fit:'优先测试',line:'这台放进旅行箱，再拿回家用，是什么体验？',visual:'固定机位拍装箱与合箱，再切居家吹发原片。',risk:'保留完整原片、测试条件；不预填秒数或效果。'},
 {id:'C',name:'痛点共鸣',share:14,lever:'让用户认出自己',fit:'优先测试',line:'家里有吹风机，出门却还在纠结带不带？',visual:'打开的行李箱与现有吹风机同框，字幕点出两难。',risk:'场景是假设，避免把所有用户描写成同一种人。'},
 {id:'D',name:'礼盒开箱',share:8,lever:'仪式感与送礼信心',fit:'有礼赠场景时',line:'送吹风机，先看收到后能不能用得上。',visual:'俯拍实际销售包装、机身与清单，再展示使用场景。',risk:'只能展示当前 SKU 实际包装与配件。'},
 {id:'E',name:'外观特写',share:7,lever:'触感与审美吸引',fit:'适合外观偏好人群',line:'每天摆在洗手台上的吹风机，你会怎么挑？',visual:'自然光拍机身纹理、按键及实际收纳位置。',risk:'不以渲染图替代实物，不承诺色差为零。'},
 {id:'F',name:'剧情冲突',share:6,lever:'购买者与使用者的分歧',fit:'道具版 · 无需演员',line:'一个想少带行李，一个想用得顺手，怎么选？',visual:'两张需求卡「少占空间」「回家也用」，用产品实拍回应。',risk:'采用字幕与道具表达分歧，不编造用户见证。'},
 {id:'G',name:'反常识开场',share:8,lever:'打断惯性判断',fit:'需要实拍接住观点',line:'小吹风机，不能只看它装不装得下。',visual:'先给收纳特写，再拉到居家使用场景。',risk:'不要把反常识写成无法证明的绝对断言。'},
 {id:'H',name:'圈层喊话',share:7,lever:'身份与任务认同',fit:'明确需求后再点名',line:'经常短途出门的人，吹风机是怎么装箱的？',visual:'旅行包、换洗衣物与产品俯拍，字幕点名具体任务。',risk:'圈层标签只用于假设，不推断真实年龄、收入。'},
 {id:'I',name:'技术参数',share:6,lever:'回应性能顾虑',fit:'需已核验产品事实',line:'选吹风机，参数之外也看看实际怎么用。',visual:'产品细节与可追溯参数卡同框，再接实操。',risk:'徕芬参数不是 S8mini 参数；只引用事实库已核验措辞。'},
 {id:'J',name:'测评信任',share:4,lever:'降低选择成本',fit:'有同条件对照时',line:'换吹风机之前，我会先看这几段实拍。',visual:'同条件记录收纳与使用过程，注明型号及测试口径。',risk:'不虚构达人背书、测评结论或未经授权的品牌比较。'}
] as const
export type HookId=typeof hooks[number]['id']
export function creativeDraft(insight:Insight,matches:Match[],facts:Fact[],hookId:HookId):Shot[]{
 const hook=hooks.find(h=>h.id===hookId)!
 const shots=generate(insight,matches,facts,'场景提问')
 const decision=scriptDecision(insight)
 const family=/旅行|出游|出行|行李/.test(insight.scene)
 const specific:Partial<Record<HookId,string>>={
  B:`把${insight.scene||'日常吹发'}的过程拍下来，看看实际怎么用。`,
  C:family?hook.line:`${insight.scene||'准备出门'}时，你也在意${insight.pain||'吹发体验'}吗？`,
  F:`挑的人在意什么，用的人在意什么？先看${insight.scene||'日常使用'}。`,
  G:family?hook.line:'选吹风机，不能只看参数表。',
  H:`在意${insight.pain||'吹发体验'}的人，选吹风机时会看什么？`
 }
 shots[0]={time:'0–5 秒',part:'停留 · '+hook.name,line:specific[hookId]||hook.line,visual:family?hook.visual:`围绕「${insight.scene||'日常吹发'}」拍产品与道具特写；首屏字幕对应口播。${hookId==='I'?'仅展示已核验参数卡。':''}`}
 shots[1]={...shots[1],part:'共鸣 · 购买心结'}
 shots[2]={...shots[2],part:'证明 · 产品实操'}
 shots[3]={...shots[3],visual:`${shots[3].visual} 重点回应：${decision.objection}`}
 shots[shots.length-1]={...shots.at(-1)!,part:'行动 · 商品卡承接'}
 return timeShots(shots,5)
}
export function titleFor(insight:Insight){return `${insight.scene||'日常吹发'}，S8mini 的实际使用记录`}
export function testPlan(insight:Insight,a:HookId,b:HookId){
 return `测试假设：对「${insight.title}」，${hooks.find(h=>h.id===b)!.name}开场是否比${hooks.find(h=>h.id===a)!.name}更能留住目标用户？\n唯一变量：前 5 秒画面与口播（作为一个开场组合测试，不单独归因画面或文案）。\n保持一致：5 秒后的主体、标题、商品卡、SKU、价格权益、受众、预算与投放时段；有变化须记录。\n主指标：5 秒完播率；同时观察点击率、点击成交率与净 ROI。\n样本与周期：按实验设置预先约定；达到样本门槛不等于统计显著。\n决策：先核对同口径与样本，再比较；留存提升但成交下降时，排查开场与产品承诺是否错配。\n复盘时关联两个脚本版本并记录支持证据与反证。`
}
