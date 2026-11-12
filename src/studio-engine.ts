import {audit,scriptAngle,verified,type DB,type Fact,type Insight,type ScriptBrief,type Shot,type Version} from './domain.ts'

export type StudioShot={time:string;part:string;content:string;subtitle:string;narration?:string;image?:string;imageSource?:string;analysis?:string}
export function studioShot(shot:Shot|StudioShot):StudioShot{
  if('content' in shot)return {...shot}
  return {time:shot.time,part:shot.part,content:[shot.visual,shot.line].filter(Boolean).join('\n'),subtitle:shot.subtitle??shot.line}
}
export const videoCopy=(shot:StudioShot)=>shot.narration?.trim()?shot.narration:shot.subtitle
export const directions=['场景冲突','实拍任务','购买两难']
const parts=['前三秒钩子','具体冲突','真实场景','核心利益','可信证据','成交引导']
const times=['0–3 秒','3–7 秒','7–12 秒','12–17 秒','17–24 秒','24–28 秒']
export function studioDrafts(insight:Insight,brief:ScriptBrief,facts:Fact[],round:number){
  const angle=scriptAngle(insight)
  const scene=insight.scene.trim()||'日常吹发'
  const need=insight.needs?.filter(Boolean).join('、')||insight.motive||insight.pain||brief.problem
  const conflict=angle==='family'?'行李箱只剩一个角，回家两个人还要共用。':angle==='commute'?'离出门只剩一点时间，湿发没处理，出差包还没装。':`在${scene}，要处理「${brief.problem}」。`
  const props=angle==='family'?'行李箱、衣物、浴室台面':angle==='commute'?'闹钟、湿发束、通勤包与登机箱':`${scene}的实际用品`
  const hooks=angle==='family'?[['箱子还剩这点？','家里有了，还带吗？'],['拉链能合上吗？','用同一只箱试试。'],['在家也能用吗？','带出门，回家呢？']]:
    angle==='commute'?[['要出门，头发还湿？','闹钟响了，先做哪步？'],['吹发要留多久？','从湿发开始计时。'],['早起用，出差带？','通勤包和登机箱怎么放？']]:
    [['这一步最卡吗？','吹头发卡在哪？'],['直接试一次。','看实际怎么用。'],['值不值得换？','先看这一步。']]
  const fact=facts.find(f=>verified(f)&&f.wording.trim())
  return directions.map((direction,i)=>{
    const line=hooks[i][round%2]
    const reviewFocus=['道具在空间里的摆放','使用前的准备动作','取出后的下一步','结束后的归位动作','两种场景的转换'][round%5]
    const evidence=[
      `保留完整操作及条件。记录计划：${brief.proof}`,
      `同一机位连续记录任务、操作条件与现场结果。记录计划：${brief.proof}`,
      `按相同任务和条件复核两种选择；只呈现拍到的结果。记录计划：${brief.proof}`
    ][i]
    const rows=[
      [`近景聚焦${props}中最能说明${['冲突','任务','取舍'][i]}的一件道具。`,line],
      [`${conflict} 本镜聚焦${['动作受阻','任务约束','购买与使用的取舍'][i]}。`,['出门前，哪一步最麻烦？','这次就做同一个任务。','带得走，还要用得顺手。'][i]],
      [`用实物还原${scene}，拍${['受阻后的下一步','从准备到使用的完整动作','两个实际使用位置'][i]}。本轮重点：${reviewFocus}。`,'看看实际怎么用。'],
      [`围绕「${need}」演示一个利益点。${fact?`核验资料 ${fact.id}。`:''}`,fact?.wording||['先看操作是否顺手。','看它在任务里怎么用。','出门和回家，各试一次。'][i]],
      [evidence,'条件和过程都留在画面里。'],
      ['用对应 SKU 商品卡承接刚才展示的任务。',['也在挑这类吹风机？看看这款规格。','适合你的使用方式，再看商品详情。','两种场景都用得上，可以看看配置。'][i]]
    ]
    return {direction,shots:rows.map(([action,line],n):StudioShot=>({time:times[n],part:parts[n],content:action+'\n'+line,subtitle:line}))}
  })
}

export const dimensions=['前三秒吸引力','人群深层需求','生活冲突','参数节制','证据可靠性','成交自然度']
export function evaluate(shots:StudioShot[],insight:Insight,facts:Fact[]){
  const first=shots[0], all=shots.map(s=>s.content+' '+s.subtitle).join('\n')
  const risks=audit(all,facts)
  const checks=[
    [Boolean(first&&/^0+\s*[–-]\s*0?3\b/.test(first.time)),Boolean(first?.subtitle&&Array.from(first.subtitle).length<=14),/近景|特写|俯拍|首屏/.test(first?.content||'')],
    [Boolean(insight.scene&&all.includes(insight.scene)),Boolean(insight.pain&&all.includes(insight.pain)||insight.motive&&all.includes(insight.motive)||insight.needs?.some(n=>n&&all.includes(n))),/使用|共用|出门|吹发/.test(all)],
    [/冲突|取舍|顾虑|受阻/.test(all),/行李箱|闹钟|道具|湿发|使用位置/.test(all),/下一步|任务|约束/.test(all)],
    [(all.match(/\d+\s*(?:g|万转|亿|℃)/g)||[]).length<=2,risks.length===0,/利益点|顺手|收纳|吹发/.test(all)],
    [/实拍|连续记录|连续展示/.test(all),/条件|同一机位/.test(all),risks.length===0],
    [/商品|规格|配置/.test(shots.at(-1)?.content||''),/适合|也在|可以|再看/.test(shots.at(-1)?.content||''),!/赶紧下单|马上抢|必须买/.test(shots.at(-1)?.content||'')]
  ]
  return checks.map((values,i)=>({name:dimensions[i],score:1+3*values.filter(Boolean).length}))
}
export type ReviewRound={before:StudioShot[];after:StudioShot[];prior:ReturnType<typeof evaluate>;next:ReturnType<typeof evaluate>;reason:string;accepted:boolean;mode:'规则'|'模型'}
export function compareRound(before:StudioShot[],after:StudioShot[],insight:Insight,facts:Fact[],reason:string,mode:ReviewRound['mode']):ReviewRound{
  const prior=evaluate(before,insight,facts),next=evaluate(after,insight,facts)
  const sum=(values:typeof prior)=>values.reduce((n,v)=>n+v.score,0)
  return {before,after,prior,next,reason,mode,accepted:sum(next)>sum(prior)&&next[4].score>=prior[4].score&&audit(after.flatMap(s=>[s.content,s.subtitle]).join('\n'),facts).length===0}
}
export function rewriteRound(before:StudioShot[],insight:Insight,brief:ScriptBrief,facts:Fact[],round:number){
  const reasons=['把道具冲突前置，前三秒只留一个具体问题。','让中段围绕该人群的实际任务和购买取舍，集中展示一个利益。','补齐实拍条件和商品卡承接，移除未经核验的参数与效果表达。']
  const fresh=studioDrafts(insight,brief,facts,round)[round%3].shots
  const after=before.length===6?before.map((s,i)=>Math.floor(i/2)===round?{...s,...fresh[i],time:s.time}:s):fresh
  return compareRound(before,after,insight,facts,reasons[round],'规则')
}
export function editStudioShot(shots:StudioShot[],index:number,key:'content'|'subtitle',value:string){
  return shots.map((s,i)=>i===index?{...s,[key]:value}:s)
}
export function appendStudioVersions(db:DB,id:string,title:string,insight:string,versions:Version[]){
  const prior=db.scripts.find(s=>s.id===id)
  const script={id,title,insight,facts:[...new Set([...(prior?.facts||[]),...versions.flatMap(v=>v.evidence.map(f=>f.id))])],versions:[...versions,...(prior?.versions.map(v=>prior.title!==title&&!v.title?{...v,title:prior.title}:v)||[])]}
  return {...db,scripts:prior?db.scripts.map(s=>s.id===id?script:s):[script,...db.scripts]}
}
