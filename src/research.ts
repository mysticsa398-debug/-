import {now, uid, verified, type Fact, type Insight, type Shot} from './domain.ts'

export const categories=['前三秒吸引','用户痛点与情绪','卖点表达','信任建立','转化路径','视觉与节奏'] as const
export const confidenceLevels=['待验证','初步支持','交叉支持','实测验证'] as const
export const stages=['注意','兴趣','信任','转化'] as const
export const reviewFields={
  visual:'画面主体 / 动作 / 首个焦点', camera:'景别 / 运镜', speech:'校对口播', subtitle:'画面字幕',
  emotion:'情绪 / 冲突 / 痛点 / 悬念 / 反差', mechanism:'用户心理 / 为什么可能有效', selling:'卖点与信任表达',
  evidence:'可回看的观察证据', limits:'局限 / 替代解释', bridge:'承接下一段的动作或信息'
}
export type Segment=Record<keyof typeof reviewFields,string>&{id:string;start:number;end:number;stage:string}
export type SourceEvidence={material:string;name:string;source:string;brand:string;segment:Segment}
export type Rule={id:string;title:string;category:string;mechanism:string;audience:string;scene:string;conditions:string;limits:string;transfer:string;hypothesis:string;confidence:string;basis:string;status:string;evidence:SourceEvidence[];date:string;history:string[]; revisions?:Omit<Rule,'revisions'>[]; experiment?:string}
export type Design={id:string;rule:string;title:string;insight:string;audience:string;scene:string;fact:string;duration:number;direction:string;hypothesis:string;variable:string;metric:string;conditions:string;prompt:string;shots:Shot[];date:string;history:string[]}
export const segment=(start:number,end:number,stage:string):Segment=>({
  id:uid(),start,end,stage,visual:'',camera:'',speech:'',subtitle:'',emotion:'',mechanism:'',selling:'',evidence:'',limits:'',bridge:''
})
export const ruleDraft=(evidence:SourceEvidence):Rule=>({
  id:uid(),title:'',category:categories[0],mechanism:evidence.segment.mechanism,audience:'',scene:'',conditions:'',limits:evidence.segment.limits,
  transfer:'',hypothesis:'',confidence:confidenceLevels[0],basis:'',status:'待审核',evidence:[evidence],date:now(),history:[]
})
export function generateDesigns(rule:Rule, insight:Insight, audience:string, scene:string, duration:number, fact?:Fact):Design[]{
  if(rule.status!=='已审核'||![15,30,45].includes(duration))return []
  const evidence=fact&&verified(fact)&&fact.wording.trim()?fact:undefined
  const problem=insight.pain||rule.conditions||'整理吹发用品'
  const travel=/旅行|出差|差旅|行李|酒店|随行/.test(audience+scene)
  const place=travel?'行李箱':'使用位置'
  const contrast=travel?'在家和出门呢？':'用前和用后呢？'
  const openings=[
    ['痛点直击', '吹头发前卡在哪？', `近景，${scene}中的道具同框。动作停在「${problem}」最容易被看见的一刻。`],
    ['体验前置', '先看怎么用。', `俯拍，S8mini 从${place}进入画面，保留取用动作。`],
    ['场景反差', contrast, travel?'固定机位匹配剪辑：家中台面切到行李箱。':'固定机位拍摄准备与实际使用两个动作，保留同一参照物。']
  ]
  const proof=evidence?.wording||'看实物和使用过程。'
  return openings.map(([direction,line,visual])=>{
    const timed=(start:number,end:number,part:string,visual:string,line:string):Shot=>({
      time:`${String(start).padStart(2,'0')}–${String(end).padStart(2,'0')} 秒`,part,visual,line,subtitle:line
    })
    const shots=[
      timed(0,3,'前三秒',visual,line),
      timed(3,5,'承接','切至实际使用地点，保留吹发用品和产品的位置关系。',travel?'装得下吗？':'用着顺手吗？'),
      timed(5,10,'兴趣',`中景展示「${scene}」，用真实动作呈现待解决问题：${problem}。按审核建议安排：${rule.transfer}。`,
        travel?'这台是 S8mini，放进平时带的包试试。':'这台是 S8mini，来看看平时怎么用。')
    ]
    const proofTime=duration===15?duration-3:17
    shots.push(timed(10,proofTime,'信任',`近景连续记录实物、操作与适用条件。实拍计划：${insight.decision||'保留完整动作'}。`,proof))
    if(duration>15){
      shots.push(timed(17,24,'实操细节',travel?'固定机位记录装包、合包和取出。保留包内实际配置。':'切侧面中景，拍完整的取用、操作和归位过程。',
        travel?'放进去以后，拉链能不能顺手合上？':'用完放回原位，看手要经过哪几步。'))
    }
    if(duration===45){
      shots.push(timed(24,32,'场景承接',travel?'匹配剪辑到家中台面，拍取出产品与家中收纳。':'切换到同一任务的另一种实际布置，保留道具位置作为参照。',
        travel?'回家以后，再看它放在浴室哪里。':'换一个摆放位置，再试一次取用。'))
      shots.push(timed(32,42,'复核条件','同镜展示实际道具尺寸和使用条件，在后期标注本次拍摄条件。',
        '按你的使用位置和收纳空间，比一比实物尺寸。'))
    }else if(duration===30){
      shots.push(timed(24,27,'复核条件','固定画面留出标注空间，标明本次道具和拍摄条件。','记下本次条件。'))
    }
    shots.push(timed(duration-3,duration,'转化','商品实物定帧，型号以商品页为准。','商品页看详情。'))
    const prompt=['LibTV / Seedance · 9:16',`场景：${scene}。用真实产品参考图锁定外形、颜色、按键与标识。保留现场声，字幕后期添加。`,
      ...shots.map(s=>`${s.time} ${s.visual} 字幕：${s.subtitle}`)].join('\n')
    return {id:uid(),rule:rule.id,title:`${audience} · ${direction} · ${duration}秒`,insight:insight.id,audience,scene,
      fact:evidence?.id||'',duration,direction,hypothesis:rule.hypothesis||rule.mechanism,variable:'0–3 秒开场方案',
      metric:'3 秒留存（如有）、5 秒完播率',conditions:'固定 3 秒后脚本、商品、价格、投放人群和时段。记录统计口径、样本及异常。',prompt,shots,date:now(),history:[]}
  })
}
