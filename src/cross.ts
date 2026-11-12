import {audiences, blankInsight, type Insight} from './domain.ts'

const needs = {
  旅行便携:{strategy:'便携增长',scene:'短途旅行整理行李',pain:'行李空间有限，携带吹风机与日常使用之间需要取舍',proof:'用相同的箱子和衣物，记录装入、合箱和取出的过程。'},
  日常家用:{strategy:'家庭共用',scene:'在家日常吹发与收纳',pain:'需要判断现有吹风机是否够用，以及更换后是否适合日常共用',proof:'分别记录使用、换手和收纳的过程，核对实际使用者的顾虑。'},
  通勤效率:{strategy:'日常效率',scene:'工作日早起洗发后出门',pain:'出门时间紧，吹发和整理发型争夺同一段准备时间',proof:'在相同起始湿度和档位下，记录吹发用时和整理发根的过程。'},
  发型打理:{strategy:'体验升级',scene:'出门前整理发根或发尾',pain:'担心吹完头发仍需反复整理发型',proof:'同角度、同光线记录造型前后，注明使用方法和配件。'},
  长发吹干:{strategy:'日常效率',scene:'洗发后处理长发或高发量',pain:'担心内层头发没吹透，或吹发耗时超过预期',proof:'记录发长、发量、起始湿度、档位和吹干判定标准。'},
  宿舍使用:{strategy:'日常效率',scene:'宿舍共用空间内吹发与收纳',pain:'需要兼顾插座、摆放位置和同住者的使用安排',proof:'核对实际宿舍使用规则，记录插座位置和收纳过程。'},
  运动后吹发:{strategy:'便携增长',scene:'运动后在更衣室洗发并整理',pain:'运动包空间有限，也担心洗后整理耽误下一项安排',proof:'实拍装入运动包、取用和整理的过程。'},
  家庭照护:{strategy:'家庭共用',scene:'帮家人吹发并整理用具',pain:'购买者、实际操作的人和接受照护的人可能有不同顾虑',proof:'分别记录操作需求和家人的反馈，确认使用条件。'},
  送礼选购:{strategy:'礼赠增长',scene:'为他人挑选实用礼物',pain:'送礼者需要判断收礼者用不用得上，以及具体包装和权益是否合适',proof:'确认收礼者的使用场景，核对该型号实际包装、配件及权益。'},
}

export const businessNeeds=Object.keys(needs) as (keyof typeof needs)[]
type BusinessNeed=keyof typeof needs

export function crossPairs(people:string[], chosenNeeds:string[], existing:Insight[]){
  const knownNeeds=businessNeeds.filter(need=>chosenNeeds.includes(need))
  return audiences.filter(person=>people.includes(person)).flatMap(person=>
    knownNeeds.filter(need=>!existing.some(card=>card.audiences.length===1 && card.audiences[0]===person && card.needs?.length===1 && card.needs[0]===need))
      .map(need=>({person,need,title:`${person} × ${need}`,scene:needs[need].scene,pain:needs[need].pain}))
  )
}

export function crossInsight(person:string,need:BusinessNeed):Insight {
  const detail=needs[need]
  return {
    ...blankInsight(),title:`${person} × ${need}`,scene:detail.scene,pain:detail.pain,
    audiences:[person],needs:[need],strategies:[detail.strategy],decision:detail.proof,
    source:'人群 × 业务需求交叉生成；待用访谈、评论或实拍记录验证。'
  }
}
