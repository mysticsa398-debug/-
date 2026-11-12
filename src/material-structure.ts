import {timeShots,type Shot} from './domain.ts'
import type {Material} from './video-analysis.ts'
export const mideaSource='https://icn140f9sykv.feishu.cn/wiki/AURHw9LimirDy0k9DK9cAtX9nDh'
export const mideaText=`0–3.3秒｜美的这款等离子吹风机，以前价格让我不舍得买，你看现在才啥价
3.3–5.5秒｜它主打大风速干
5.5–8.1秒｜以前要吹十几分钟的头发，现在几分钟就能搞定
8.1–12秒｜而且这个价位，用起来却有千元配置的质感，性价比直接拉满
12–14.1秒｜外观是简约大气的马卡龙配色
14.1–16.2秒｜高速无刷电机，搭配39亿等离子
16.2–19.3秒｜吹完的头发又顺又亮，再也不会毛躁炸毛
19.3–23.7秒｜三档风速，四档风温，可以随便调节，还有环灯模式，温度一目了然
23.7–26.5秒｜关键美的是大品牌，用起来特别放心
26.5–28.25秒｜想要告别吹发烦恼的姐妹，赶紧入手吧！`
export const stages=[
 {name:'价格悬念',test:/价格|啥价|到手|优惠|不舍得买/,why:'留下价格信息缺口，让关注预算的人继续看。',proof:'核对当前商品卡价格、活动期限与历史价格依据。',move:'保留价值疑问；没有价格证据时改成场景两难，不能编造降价。'},
 {name:'行动引导',test:/入手|下单|商品卡|链接|购物车|点击/,why:'把前文需求接到一个明确的购买动作。',proof:'商品卡 SKU、卖点与权益须承接前文。',move:'引导查看 S8mini 的实际规格与当前权益。'},
 {name:'品牌背书',test:/大品牌|美的.*放心|品牌|质保|售后/,why:'尝试降低购买者对品质和售后的顾虑。',proof:'区分品牌熟悉度与实际售后条款，不能视为效果证明。',move:'用实物、连续演示和已核验售后替代美的品牌认知。'},
 {name:'功能展示',test:/档|调节|环灯|温度一目/,why:'让用户判断能否按自身习惯操作。',proof:'实拍按键、实际档位及说明书；展示操作结果。',move:'只拍 S8mini 实际按键和模式，不继承竞品档位或环灯。'},
 {name:'外观展示',test:/配色|外观|颜色|质感/,why:'把抽象价值变成可见的外观和触感线索。',proof:'自然光实拍，区分审美偏好与性能结论。',move:'拍 S8mini 真实机身、按键与收纳位置。'},
 {name:'价值锚定',test:/性价比|千元|价位|配置/,why:'引入参照物，影响用户对值不值得买的判断。',proof:'千元对比需要可核验对象与同条件证据。',move:'改为旅行和家用两场景价值，不搬用千元配置结论。'},
 {name:'效果诉求 / 待验证',test:/分钟|顺|亮|毛躁|搞定|实测|计时/,why:'从参数转向结果，回应吹发时间或毛躁顾虑。',proof:'口播并不等于验证；需完整原片、发量、档位、距离与测试条件。',move:'展示真实吹发过程；柔顺、时间结果只按实测表达。'},
 {name:'产品与核心卖点',test:/风速|速干|电机|离子|吹风机|恒温|小巧|重量/,why:'交代产品如何回应前文需求。',proof:'核对型号、参数及适用条件，参数不能直接证明效果。',move:'只引用 S8mini 已核验措辞，再接对应实拍。'},
 {name:'场景与需求',test:/旅行|出差|早班|家里|出门|担心|怕|烦恼/,why:'用具体使用任务帮助观众辨认自己。',proof:'确认口播是否真的出现该场景，不能仅凭标签推断。',move:'分别聚焦旅行加家用、赶早加出差或小机身性能顾虑。'}
]
export type Segment={time:string;line:string;stage:string;why:string;proof:string;move:string;visual:string}
export function splitMaterial(text:string):Segment[]{
 const lines=text.includes('\n')?text.split('\n'):text.split(/[。！？!?]/)
 return lines.map(x=>x.trim()).filter(Boolean).map(line=>{
 const timed=line.match(/^(\d+(?:\.\d+)?\s*[–—→~-]\s*\d+(?:\.\d+)?\s*秒?)\s*[｜|:：]?\s*/)
 const copy=timed?line.slice(timed[0].length):line
 // Value anchors take precedence over generic price/appearance mentions.
 const stage=(/千元|性价比/.test(copy)?stages.find(s=>s.name==='价值锚定'):stages.find(s=>s.test.test(copy)))
 return {time:timed?timed[1]:'时间待核对',line:copy,stage:stage?.name||'结构待判断',why:stage?.why||'信息不足，请人工填写此段承担的任务。',proof:stage?.proof||'补充口播上下文和画面。',move:stage?.move||'先确认结构，再匹配 S8mini 场景。',visual:'未读取原片画面，请对照视频补充。'}
 })
}
export const routeNames=['旅行 + 家用的家庭青年','早起 + 出差的白领女性','小巧机身 + 日常性能顾虑']
export function migrateRows(rows:Segment[],route:number):Shot[]{
 const openings=['出门带，回家也要用。','赶早班，还要吹头发？','小，就只能旅行用？']
 const scenes=['行李箱与洗手台','闹钟、发束与出差包','旅行包与居家吹发位置']
 const value=['一台怎么选，先看装箱和日常吹发这两件事。','早上吹发、出差收纳，把这两个场景一起看。','选小机身，也要看看日常吹发怎么用。']
 const mapped:Record<string,[string,string]>={
 '价格悬念':[openings[route],`首秒拍${scenes[route]}，紧接 S8mini 实物；首屏只呈现这一个问题。`],
 '场景与需求':[value[route],`用${scenes[route]}交代使用任务；不编造用户见证。`],
 '产品与核心卖点':['这是光速博士 S8mini，先看它实际怎么用。','产品标识特写，启动后接实际吹发过程。参数由事实库核验后另行添加。'],
 '效果诉求 / 待验证':['吹发的表现，看真实过程更直观。','固定发束、距离和档位保留连续原片；未实测不填分钟数，不制作虚假的前后对比。'],
 '价值锚定':[value[route],`同一台 S8mini 在${scenes[route]}间转场，实际装入、取出、操作。`],
 '外观展示':['机身、按键，近距离给你看。','自然光实拍当前 SKU 颜色、表面与按键。'],
 '功能展示':['日常怎么操作，这里给你演示。','按实际说明书展示按键操作，不展示竞品的环灯、三档风速或四档风温。'],
 '品牌背书':['选之前，把产品细节和售后说明看清楚。','实物与当前商品卡售后条款同框；不虚构品牌排名和承诺。'],
 '行动引导':['有同样需求，点开商品卡看看 S8mini。','商品卡对应本片 SKU；展示真实规格与当前权益。'],
 '结构待判断':['这款 S8mini，先看实际使用。','根据已确认的本段任务补拍，发布前复核。']
 }
 return timeShots(rows.map((r,i)=>{let [line,visual]=i===0?[openings[route],`0–1 秒展示${scenes[route]}；1–3 秒接 S8mini 实物动作，字幕同步。`]:mapped[r.stage]||mapped['结构待判断'];if(i>0&&r.stage==='产品与核心卖点'){line=/离子/.test(r.line)?'吹完之后，发尾的状态也给你近距离看。':['这台 S8mini，出门装箱和回家吹发都拍给你看。','早上的吹发流程，从这台 S8mini 开始。','S8mini 这台小机身，日常吹发也给你实际演示。'][route]} if(i>0&&r.stage==='效果诉求 / 待验证'){line=/毛躁|顺/.test(r.line)?'同样的光线，看看吹前和吹后的发丝。':['从湿发到吹干，把过程拍下来给你看。','赶时间也别只看参数，直接看吹发过程。','小不小看机身，好不好用看吹发过程。'][route]} return {time:'',part:i===0?'前三秒 · 场景钩子':r.stage,line,visual,subtitle:line}}),3)
}
export function migrationPreview(rows:Segment[],route:number){
 return migrateRows(rows,route).map((shot,index)=>({segment:rows[index],shot}))
}

export function deepAnalysis(rows:Segment[],isMidea:boolean){
 const all=rows.map(r=>r.line).join(' '),first=rows[0]
 const evidence=(pattern:RegExp)=>rows.filter(r=>pattern.test(r.line)).map(r=>`${r.time}「${r.line}」`).join('；')||'原文未明确，待补充。'
 return [
 ['01 素材结构公式',rows.map(r=>`${r.time} ${r.stage}`).join(' → ')],
 ['02 素材拆解',rows.map(r=>r.stage).filter((s,i,a)=>s!==a[i-1]).join(' → ')],
 ['03 目标人群',isMidea?'文档判断：主人群关注吹发效率、品牌与价格；次人群关注毛躁、外观及调节功能。':'分析假设：根据下列需求和价格线索确认主人群，原文不能证明年龄、收入或身份。'],
 ['04 人群核心痛点',evidence(/分钟|毛躁|烦恼|担心|怕|赶|费时/)],
 ['05 痛点类型',[/分钟|赶|费时/.test(all)?'效率成本':'',/毛躁|顺/.test(all)?'吹后体验':'',/品牌|放心/.test(all)?'品质信任':'',/价格|啥价|价位/.test(all)?'购买预算':''].filter(Boolean).join(' / ')||'缺少明确痛点，需结合原片确认。'],
 ['06 卖点拆解',`核心与辅助卖点线索：${evidence(/风速|速干|电机|离子|档|温/)}；逐条区分产品事实与效果承诺。`],
 ['07 开头钩子画面',isMidea?'文档描述：0–3.3 秒展示粉色吹风机，通过品牌与价格悬念吸引关注。此处未重新观看原片。':first?.visual||'尚无原文。'],
 ['08 钩子类型',`${first?.stage||'待判断'}；依据：${first?.line||'待填写'}。首句不一定等于前三秒。`],
 ['09 为什么能停人',`${first?.why||'待判断'} 这是机制假设；没有留存、投放与成交数据，不能据此确认有效或归因。`],
 ['10 可复用点',`复用顺序、产品介绍与演示的交替；逐段迁移见下表。${isMidea?'美的品牌背书、39亿等离子、档位、价格和效果结论不能搬到 S8mini。':'重新核对品牌、数字、功能、权益与实测条件。'}`]
 ]
}

export const reportSections=[
 '01 · 原始素材与结构公式',
 '02 · 逐步拆解',
 '03 · 素材深度分析',
 '04 · 移植到 S8mini，可生成什么文案'
] as const

export function structureFormula(rows:Segment[]){
 return rows.map(r=>r.stage).filter((stage,i,stages)=>stage!==stages[i-1]).join(' → ')
}

function speechRanges(cue:Material['cues'][number]){
 const clauses=cue.text.match(/[^，,。！？!?；;]+[，,。！？!?；;]*/g)?.map(text=>text.trim()).filter(Boolean)||[]
 if(clauses.length<2)return [cue]
 const length=clauses.reduce((sum,text)=>sum+text.length,0)
 let offset=0
 return clauses.map(text=>{
   const start=cue.start+(cue.end-cue.start)*offset/length
   offset+=text.length
   const end=cue.start+(cue.end-cue.start)*offset/length
   return {start,end,text,estimated:true}
 })
}

export function structureVideo(material:Material){
 const checked=material.segments||[]
 const textCues=material.cues.length?material.cues:material.screenCues||[]
 function uncovered<T extends {start:number;end:number}>(range:T,covered:{start:number;end:number}[]):T[]{
   let pieces=[range]
   for(const cut of covered){
     pieces=pieces.flatMap(piece=>{
       if(cut.end<=piece.start||cut.start>=piece.end)return [piece]
       const remaining:T[]=[]
       if(piece.start<cut.start)remaining.push({...piece,end:cut.start})
       if(cut.end<piece.end)remaining.push({...piece,start:cut.end})
       return remaining
     })
   }
   return pieces
 }
 const transcript=(material.cues.length?textCues.flatMap(speechRanges):textCues).flatMap(cue=>uncovered(cue,checked))
 const ranges=[...checked,...transcript,...material.scenes.flatMap(scene=>uncovered(scene,[...checked,...transcript]))]
   .sort((a,b)=>a.start-b.start||a.end-b.end)
 return ranges.map(range=>{
   const cues=textCues.filter(c=>c.start<range.end&&c.end>range.start)
   const speech=('speech' in range&&range.speech)||('text' in range?range.text:cues.map(c=>c.text).join(' '))
   const inferred=splitMaterial(speech.replace(/\s+/g,' '))[0]
   const evidence=cues.map(c=>`${material.cues.length?'口播/导入字幕':'画面字幕候选'} ${c.start}–${c.end} 秒「${c.text}」`)
   const screenText=(material.screenCues||[]).filter(c=>c.start<range.end&&c.end>range.start).map(c=>c.text)
   const visual=['visual' in range?range.visual:'','camera' in range?range.camera:'',
     'subtitle' in range&&range.subtitle?'画面字幕：'+range.subtitle:screenText.length?'画面字幕候选：'+screenText.join(' / '):''].filter(Boolean).join('；')
   if('estimated' in range)evidence.unshift('本段时间按原口播时间块内的分句长度估算，请回看校对。')
   if('speech' in range&&range.speech)evidence.unshift('人工校对口播：'+range.speech)
   if('evidence' in range&&range.evidence)evidence.unshift(range.evidence)
   if('observations' in range&&range.observations)evidence.push('帧差采样：'+range.observations)
   if('limits' in range&&range.limits)evidence.push('局限：'+range.limits)
   const proof=evidence.join('；')||'缺少可回看的观察证据。'
   return {start:range.start,end:range.end,time:'estimated' in range?`约 ${range.start.toFixed(2)}–${range.end.toFixed(2)} 秒`:`${range.start}–${range.end} 秒`,line:speech,
     stage:inferred?.stage&&inferred.stage!=='结构待判断'?inferred.stage:'stage' in range?range.stage:'结构待判断',
     why:('mechanism' in range&&range.mechanism)||(inferred?(material.cues.length||'speech' in range&&range.speech?'口播线索 · ':'画面字幕线索 · ')+inferred.why:'信息不足，待人工判断。'),
     path:'stage' in range?range.stage:undefined,
     proof,move:inferred?.move||'核对实际结构与画面后，再选择 S8mini 拍摄任务。',
     visual:visual||'画面语义待回看原片确认。'}
 })
}

export function videoScriptReport(material:Material){
 const rows=structureVideo(material)
 return [
   {title:reportSections[0],source:material.source||material.name,formula:structureFormula(rows),transcriptNote:material.transcriptNote,cues:material.cues,screenCues:material.screenCues,screenNote:material.screenNote},
   {title:reportSections[1],rows},
   {title:reportSections[2],items:deepAnalysis(rows,false)},
   {title:reportSections[3],routes:rows.length?routeNames.map((name,i)=>({name,shots:migrateRows(rows,i)})):[]}
 ]
}
