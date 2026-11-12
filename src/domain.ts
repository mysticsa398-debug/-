import {defaultProduct,type Product} from './products.ts'
import type {ScriptPlanning} from './script-planning.ts'
import type {TaskFocus} from './script-agent.ts'
import type {CreativeTest} from './creative-test.ts'
import {studioShot} from './studio-engine.ts'
import type {StudioShot, ReviewRound} from './studio-engine.ts'
import type {Design, Rule} from './research.ts'
export const audiences = ['家庭青年','都市白领女性','高频差旅','学生宿舍','长发浓密','运动健身','家庭照顾者','礼赠决策']
export const strategies = ['便携增长','日常效率','体验升级','家庭共用','礼赠增长']
export const insightFields = {
  title:'洞察名称', scene:'使用场景', sex:'性别', age:'年龄', job:'职业', region:'地域', interests:'兴趣', lifestyle:'生活方式',
  relations:'家庭 / 社交关系', buyer:'购买者', user:'使用者', influencer:'影响者', trigger:'触发事件', pain:'显性痛点',
  motive:'深层动机', emotion:'情绪价值', barrier:'购买阻力', alternatives:'替代方案', decision:'决策证据',
  source:'证据来源', confidence:'置信度', date:'记录时间', status:'状态', counter:'反证'
}
export type Insight = Record<keyof typeof insightFields,string> & {id:string; strategies:string[]; audiences:string[]; needs?:string[]}
export type Fact = {id:string; productId?:string; claim:string; category:string; status:string; source:string; date:string; wording:string}
export type Match = {id:string; insight:string; fact:string; scene:string; pain:string; angle:string; evidence:string}
export type Shot = {time:string; part:string; visual:string; line:string; subtitle?:string}
export type ScriptBrief = {problem:string; proof:string; focus?:TaskFocus}
export type Version = {id:string; productId?:string; title?:string; date:string; variant:string; shots:(Shot|StudioShot)[]; evidence:Fact[]; review?:ReviewRound[]; batch?:string; material?:string; brief?:ScriptBrief; planning?:ScriptPlanning; design?:string; fixedTiming?:boolean}
export type Script = {id:string; title:string; insight:string; facts:string[]; versions:Version[]}
export const metricFields = {impressions:'展现',views:'5 秒完播',clicks:'点击',orders:'成交',cost:'花费（元）',revenue:'成交金额（元）',gross:'退款调整前毛利（元）',refund:'退款金额（元）'}
export type Experiment = Record<keyof typeof metricFields,number> & {id:string; title:string; insight:string; script:string; version:string; source:string; date:string; outcome:string; notes:string; reportOnly?:boolean; published?:string; conditions?:string; period?:string; reported?:Partial<Record<'hold'|'hold3'|'videoCtr'|'ctr'|'cvr'|'roi',number>>}
export type Audit = {id:string; productId?:string; date:string; script:string; version:string; input:string}
export const defaults = {hold:15,ctr:5,cvr:10,roi:3.5,sample:1000}
export type DB = {products?:Product[]; insights:Insight[]; facts:Fact[]; matches:Match[]; scripts:Script[]; experiments:Experiment[]; audits:Audit[]; thresholds:typeof defaults; endpoint:string; rules?:Rule[]; designs?:Design[]; creativeTests?:CreativeTest[]}
export function deleteScript(db:DB,id:string):DB {
  const script=db.scripts.find(item=>item.id===id)
  if(!script)return db
  return {
    ...db,
    scripts:db.scripts.filter(item=>item.id!==id),
    experiments:db.experiments.map(e=>e.script!==id?e:{
      ...e,script:'',version:'',
      notes:[e.notes,`原关联脚本：${script.title}（${id}），版本 ${e.version}，脚本已删除。`].filter(Boolean).join('\n')
    }),
    audits:db.audits.map(a=>a.script!==id?a:{...a,script:'',version:''})
  }
}
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
export const day = () => new Date().toLocaleDateString('sv-SE')
export const blankInsight = ():Insight => ({...Object.fromEntries(Object.keys(insightFields).map(k=>[k,''])) as Record<keyof typeof insightFields,string>,id:uid(), strategies:[],audiences:[],confidence:'D',date:day(),status:'假设 / 待验证'})
export const blankExperiment = ():Experiment => ({...Object.fromEntries(Object.keys(metricFields).map(k=>[k,0])) as Record<keyof typeof metricFields,number>,id:uid(),title:'',insight:'',script:'',version:'',source:'',date:day(),outcome:'待判断',notes:''})
export const variants = ['场景提问','对比体验','任务挑战']
const parts = ['钩子 · 点名需求','冲突 · 谁在犹豫','解决 · 产品实操','举证 · 回应顾虑','成交 · 商品卡']
export function timeShots(shots:Shot[], firstSeconds?:number):Shot[]{
  let elapsed=0
  return shots.map((shot,index)=>{
    const spokenLength=Array.from(shot.line.replace(/[\s\p{P}]+/gu,'')).length
    const seconds=index===0 && firstSeconds!==undefined ? firstSeconds : Math.max(shot.part.startsWith('举证')?5:2,Math.ceil(spokenLength/4))
    const start=elapsed
    elapsed+=seconds
    return {...shot,time:`${start}–${elapsed} 秒`}
  })
}
export function scriptAngle(insight:Insight){
  if(insight.audiences.includes('家庭青年') && /旅行|出游|出行|行李/.test(insight.scene))return 'family'
  if(insight.audiences.includes('都市白领女性') && /早|通勤|上班|出门/.test(insight.scene))return 'commute'
  return 'general'
}

export function scriptEvidence(matches:Match[],facts:Fact[]){
  const fact=matches.filter(m=>m.evidence.trim())
    .map(m=>facts.find(f=>f.id===m.fact && f.category!=='权益' && verified(f)))
    .find((f):f is Fact=>Boolean(f))
  return fact?[fact]:[]
}

export function scriptDecision(insight:Insight){
  const angle=scriptAngle(insight)
  if(angle==='family')return {
    roles:'两个人一起选、一起用；一方在意装箱，另一方在意回家用起来顺不顺手。',
    objection:'家里已有吹风机，旅行还值不值得单独准备一台？',
    proof:'同一行李箱合箱实拍＋居家吹发过程。'
  }
  if(angle==='commute')return {
    roles:'自己选、自己用；出门前的时间和造型需求影响购买。',
    objection:'赶着上班，吹完湿发还有没有余裕整理发根？',
    proof:'湿发计时＋同角度发根前后画面；装箱作为补充。'
  }
  return {
    roles:[insight.buyer&&`购买：${insight.buyer}`,insight.user&&`使用：${insight.user}`,insight.influencer&&`影响：${insight.influencer}`].filter(Boolean).join(' · ')||insight.relations||'在洞察卡补充购买、使用和影响决策的人。',
    objection:insight.barrier||insight.pain||'待补充购买顾虑',
    proof:insight.decision||'用实际使用过程回应购买顾虑。'
  }
}

export function generate(insight:Insight, matches:Match[], facts:Fact[], variant:string, brief?:ScriptBrief):Shot[] {
  const [fact]=scriptEvidence(matches,facts)
  const factLine=fact?(fact.wording||fact.claim).trim().replace(/[。！!？?]+$/,''):''
  const angle=scriptAngle(insight)
  const hookIndex=Math.max(0,variants.indexOf(variant))
  const decision=scriptDecision(insight)
  const problem=brief?.problem.trim() || decision.objection
  const proof=brief?.proof.trim() || decision.proof
  const customProblem=problem!==decision.objection
  const customProof=proof!==decision.proof
  let lines:string[]
  let visuals:string[]
  if(angle==='family'){
    lines=[
      ['家里有吹风机了，旅行还要带一台？','两个人共用一台，装得下只是第一关。','买台旅行吹风机，回家也能接着用吗？'][hookIndex],
      '一个怕占箱子，一个怕回家用不惯。',
      factLine?`这台是 Dr.flash S8mini，${factLine}。先试装箱。`:'看这台 Dr.flash S8mini，先放进装好衣服的箱子。',
      '看合箱实拍，再看家里吹发的过程。两个人都要用，这两关都值得看。',
      '想一台兼顾出门和家用？点商品卡看型号。'
    ]
    visuals=[
      '桌面俯拍：装好衣物的旅行箱、家中旧机与 S8mini。首屏字幕「家里有了，还要带吗？」',
      '箱内余量和家中吹风机交叉切换。双条字幕「怕占空间」「担心回家用不惯」。',
      '同一箱、同一套衣物，拍 S8mini 放入与合箱全过程。'+(fact?' 核验资料 '+fact.id+'。':''),
      '连续展示合箱实拍，保留同一行李箱与原有衣物，字幕注明本次箱内配置。',
      '产品定帧与实际挂载的商品卡同屏，核对型号和配置。'
    ]
  }else if(angle==='commute'){
    lines=[
      ['早八要出门了，头发湿、发根还塌？','自己挑吹风机，先看它能不能跟上你的早班。','先吹干，还是先救发根？赶早班的人都懂。'][hookIndex],
      '自己买、天天用，最怕吹完还得重做发根。',
      factLine?`试一下 Dr.flash S8mini，${factLine}。先吹，再抬发根。`:'拿 Dr.flash S8mini 试一下：先吹湿发，再用梳子抬发根。',
      '看同角度的前后画面。常出差的话，再看它怎么装箱。',
      '也想出门前顺手做造型？点商品卡看配置。'
    ]
    visuals=[
      '俯拍闹钟、通勤包和产品，叠加字幕「赶早班｜湿发、塌发根」。',
      '拍镜前的产品、梳子和发束，字幕「吹干之后，还要不要重做发根？」',
      '近拍湿发束和计时器，记录起始湿度、档位；发束演示在字幕注明。'+(fact?' 核验资料 '+fact.id+'。':''),
      '用练习头或发束拍同角度同光线的造型前后，字幕注明演示条件。配件以该 SKU 为准。',
      '产品与实际挂载的商品卡同屏；权益补证后再加入字幕。'
    ]
  }else{
    const scene=insight.scene.trim()||'日常吹发'
    const pain=insight.pain.trim()||'吹发体验'
    const split=Boolean(insight.buyer.trim()&&insight.user.trim()&&insight.buyer.trim()!==insight.user.trim())
    lines=[
      [`聊到${scene}，你是不是也在意${pain}？`,`换吹风机前，先看它怎么应对${pain}。`,`就拍一次${scene}，看看这台用起来怎么样。`][hookIndex],
      split?'挑的人要买得放心，用的人得用得顺手。先看实际怎么用。':`买之前先看一件事：${decision.objection.replace(/[。？?！!]+$/,'')}。`,
      factLine?`这是 Dr.flash S8mini，${factLine}。现在来试一遍。`:'这台是 Dr.flash S8mini，放到平时吹发的场景里试一遍。',
      '从开始到结束都拍下来，最后给你看实际状态。',
      '如果这正是你在挑的，点商品卡看配置。'
    ]
    visuals=[
      `产品和道具俯拍，还原${insight.trigger||scene}；首镜字幕点明需求。`,
      `字幕点出购买顾虑：${decision.objection}。以现有方案道具带出对照。`,
      '产品入镜并实操，按该 SKU 实际配置使用。'+(fact?' 核验资料 '+fact.id+'。':''),
      '产品与道具特写，记录实测条件。证据目标：'+decision.proof,
      '产品定帧与实际挂载的商品卡同屏。'
    ]
  }
  if(customProblem){
    lines[0]=problem
    lines[1]=angle==='general'?'买之前，先看实际使用能不能解决这个问题。':'按这个需求来选，先看它在对应场景里怎么用。'
    lines[2]=factLine?`这是 Dr.flash S8mini，${factLine}。先试给你看。`:'拿 Dr.flash S8mini，按这个使用场景实际试一遍。'
    lines[4]='如果这个演示正好回答了你的问题，点商品卡看对应配置。'
    visuals[0]='产品与相关道具入镜，首屏字幕：'+problem
    visuals[1]='用道具和字幕说明顾虑及使用关系：'+decision.roles
    visuals[2]='用该 SKU 实物操作，准备证据计划中需要的道具。'
  }
  const shots=parts.map((part,i)=>({time:'',part,visual:visuals[i],line:lines[i]}))
  const evidenceSteps=proof.split(/\n|[＋+；;]/).map(step=>step.trim()).filter(Boolean)
  if(customProblem||customProof){
    shots.splice(3,1,...(evidenceSteps.length?evidenceSteps:[decision.proof]).map((step,index)=>({
      time:'',part:`举证 · 回应顾虑 ${index+1}`,
      visual:'产品与道具实拍，记录条件和结果：'+step,
      line:evidenceSteps.length>1?`第 ${index+1} 项，看看这一步的实拍结果。`:'直接看实拍，这次的条件和结果都放在画面里。'
    })))
  }else if(angle!=='general'){
    const evidence=shots[3]
    const extra=angle==='family'
      ? {line:'装得下之后，再看放回浴室怎么用。',visual:'拍产品放回家中收纳位置及发束演示，注明起始湿度、档位及实际结果。'}
      : {line:'如果你也常出差，再看它怎么放进行李箱。',visual:'切到登机箱，连续拍放入与合箱。'}
    if(angle==='family')evidence.line='先看衣物和吹风机一起放进去，箱子怎么合。'
    else evidence.line='看同角度的前后画面，发根的实际状态就在这里。'
    shots.splice(4,0,{time:'',part:'举证 · 补充场景',...extra})
  }
  return timeShots(shots)
}
export const verified = (f:Fact) => f.status==='已核验' && Boolean(f.source.trim() && f.date)
export const s8miniIonFact:Fact={id:'F-003',claim:'10亿负离子',category:'参数',status:'已核验',
  source:'工作台用户确认的 Dr.flash S8mini 参数，2026-11-12',date:'2026-11-12',wording:'10亿负离子'}

export const initial = ():DB => {
  const first = {...blankInsight(),id:'IN-001',title:'家庭青年 × 旅行家用',scene:'周末旅行与日常家用',sex:'不限，待验证',age:'待验证',job:'待验证',region:'待验证',interests:'周末旅行、家庭收纳（待验证）',lifestyle:'短途出行与日常共用（待验证）',relations:'夫妻共同决策（待验证）',buyer:'夫妻共同决策',user:'同行家人',influencer:'伴侣',trigger:'整理出游行李',pain:'旅行收纳与家用兼顾',motive:'减少重复购买与出门整理负担',emotion:'出门更从容',barrier:'担心便携与使用体验难以兼顾',alternatives:'酒店吹风机、现有家用吹风机',decision:'同一镜头记录实物尺寸和旅行包收纳过程',source:'内置场景假设；待访谈及实测',counter:'有些旅行者接受酒店吹风机，可能没有携带需求。',audiences:['家庭青年','高频差旅'],strategies:['便携增长','家庭共用'],date:''}
  const second = {...blankInsight(),id:'IN-002',title:'都市白领女性 × 早起通勤',scene:'工作日早起洗发后出门',sex:'女性（场景假设）',age:'待验证',job:'办公室工作（待验证）',trigger:'洗发后离出门时间很近',pain:'早晨吹发时间紧',motive:'用可预期的时间完成出门准备',emotion:'从容进入工作状态',alternatives:'提前洗头、现有吹风机',source:'内置场景假设；待访谈及计时实测',decision:'记录相同测试条件下的实际用时',counter:'晚间洗发人群可能没有早晨吹发需求。',audiences:['都市白领女性'],strategies:['日常效率'],date:''}
  const facts:Fact[] = ['295g','11万转马达','10亿负离子','57℃智能恒温','售后、赠品及促销权益'].map((claim,i)=>({id:`F-00${i+1}`,claim,category:i===4?'权益':'参数',status:'待核验',source:'用户提供的待核验参数清单',date:'',wording:''}))
  facts[2]=s8miniIonFact
  const matches:Match[] = [{id:'M-001',insight:first.id,fact:facts[0].id,scene:first.scene,pain:first.pain,angle:'实物称重与旅行包收纳演示',evidence:'待获取：注明称重口径的连续实拍'}]
  return {products:[defaultProduct],insights:[first,second],facts,matches,scripts:[{id:'SC-001',title:'家庭青年 × 旅行家用',insight:first.id,facts:[],versions:[{id:'V-001',date:'',variant:variants[0],evidence:[],shots:generate(first,matches,facts,variants[0]).map(studioShot)}]}],experiments:[],audits:[],rules:[],designs:[],creativeTests:[],thresholds:{...defaults},endpoint:''}
}
const terms = [
  {pattern:/(?:\d+|[一二三四五六七八九十半]+)\s*(?:秒|分钟)(?:就能|就|内)?(?:吹干|干透)|(?:比[^，。！\n]{1,20})快(?:[一二三四五六七八九十]+|\d+(?:\.\d+)?)倍/g, fix:'补充该 SKU 的发长、湿度、档位、计时口径与实测记录。'},
  {pattern:/(?:到手|立减|券后)\s*\d+(?:\.\d+)?\s*元|(?:今天|下单|现在)\s*送[^，。！？\n]{1,12}/g, fix:'核对 SKU、活动有效期、适用人群与当前商品页的权益。'},
  {pattern:/静音|零噪音|无声/g, fix:'记录测试距离、环境底噪与实测声压级'},
  {pattern:/不伤发|零损伤|绝不伤发|修复受损/g, fix:'说明实际使用条件和可复核的测试结果'},
  {pattern:/全网第一|第一名|最佳|顶级|绝对|永久|百分之百|100%|最[好强轻快低高安全便]|保证|零风险/g, fix:'说明可观察的功能或有来源的测试数据'}
]
function normalize(value:string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g,'')
}
export function audit(input:string, facts:Fact[]) {
  const findings = terms.flatMap(({pattern,fix})=>Array.from(new Set(input.match(pattern) || [])).map(term=>({term,reason:'绝对化或缺少适用条件',fix})))
  const normalized = normalize(input)
  const claims = facts.filter(f=>[f.claim,f.wording].some(t=>t.trim() && normalized.includes(normalize(t))))
  claims.filter(f=>!verified(f)).forEach(f=>findings.push({term:f.claim,reason:'事实未核验或缺少来源与核验日期',fix:'暂用实物操作演示，补齐原始证据后再引用。'}))
  const alternateClaims = [
    {pattern:/295(?:克|公克|g)/, seed:'295g'},
    {pattern:/(?:110000|11万)转/, seed:'11万转马达'},
    {pattern:/(?:200000000|2亿)(?:个|级)?(?:负离子)?/, seed:'2亿级负离子'},
    {pattern:/57(?:℃|°c|度)/, seed:'57℃智能恒温'},
  ]
  for(const {pattern,seed} of alternateClaims){
    const match=normalized.match(pattern)
    if(match && !claims.some(f=>f.claim===seed) && !claims.some(f=>verified(f)&&normalize(f.claim).includes(match[0]))){
      findings.push({term:match[0],reason:'改写或换算后的参数仍需核对证据与使用条件',fix:'按事实库中经核验的完整措辞填写。'})
    }
  }
  const numbers = normalized.match(/\d+(?:\.\d+)?(?:万转(?:\/分钟)?|亿(?:级)?(?:高浓度)?负离子|℃|°c|克|g|m\/s|米\/秒|db|分贝|瓦|w|天无理由|年质保)(?![a-z])/g) || []
  for(const term of new Set(numbers)){
    if (!claims.some(f=>verified(f) && [f.claim,f.wording].some(t=>normalize(t).includes(term))) && !findings.some(f=>normalize(f.term).includes(term))){
      findings.push({term,reason:'量化表述需要核验语境、口径与证据',fix:'删除未经确认的指标，或补入带来源和条件的事实条目。'})
    }
  }
  return findings
}
export function metrics(e:Experiment) {
  const divide = (a:number,b:number) => b > 0 ? a/b : null
  const net = e.revenue-e.refund
  return {hold:e.reported?.hold??(e.reportOnly?null:divide(e.views*100,e.impressions)),ctr:e.reported?.ctr??(e.reportOnly?null:divide(e.clicks*100,e.impressions)),cvr:e.reported?.cvr??(e.reportOnly?null:divide(e.orders*100,e.clicks)),roi:e.reported?.roi??(e.reportOnly?null:divide(net,e.cost)),net,gross:e.gross-e.refund,contribution:e.gross-e.refund-e.cost}
}
export function experimentError(e:Experiment) {
  if([e.published,e.period,e.conditions].some(v=>v!==undefined&&(typeof v!=='string'||v.length>1200)))return '请检查发布时间、统计周期和投放条件。'
  if(e.reportOnly!==undefined&&typeof e.reportOnly!=='boolean')return '报表口径无效。'
  if(e.reported!==undefined&&(!e.reported||typeof e.reported!=='object'||Array.isArray(e.reported)||Object.entries(e.reported).some(([k,v])=>!['hold','hold3','videoCtr','ctr','cvr','roi'].includes(k)||typeof v!=='number'||!Number.isFinite(v)||k!=='roi'&&(v<0||v>100))))return '请检查报表录入的比率。'
  if (!e.title.trim() || !e.source.trim()) return '请填写实验名称和可追溯的数据来源。'
  if (Object.keys(metricFields).some(k=>!Number.isFinite(e[k as keyof typeof metricFields]) || (k!=='gross' && e[k as keyof typeof metricFields]<0))) return '请检查指标数值。除毛利外，各项不能为负。'
  if (![e.impressions,e.views,e.clicks,e.orders].every(Number.isSafeInteger)) return '展现、完播、点击和成交应为整数。'
  if (e.views>e.impressions || e.clicks>e.impressions || e.orders>e.clicks || e.refund>e.revenue) return '请核对漏斗与退款口径。完播、点击不能超过展现，成交不能超过点击，退款不能超过成交金额。'
  if (e.outcome!=='待判断' && (!e.insight || !e.notes.trim())) return '反馈假设结论时，请关联洞察并填写判断依据。'
  if (e.script && !e.version) return '请选择实验使用的脚本版本。'
  return ''
}
export function feedbackFor(db:DB,id:string){
  const results=new Set(db.experiments.filter(e=>e.insight===id&&e.outcome!=='待判断').map(e=>e.outcome))
  return results.size>1?'实验结论有分歧':Array.from(results)[0]||''
}
