import {audit,scriptAngle,scriptEvidence, type DB,type Insight,type ScriptBrief} from './domain.ts'
import {type StudioShot} from './studio-engine.ts'
import {deliveryFindings} from './shooting-script.ts'

export const taskSkills={
  quiet:'门外收音',
  pack:'装箱收纳',
  weight:'实物称重',
  roots:'发根整理',
  dry:'湿发计时',
  general:'日常实操'
} as const
export type TaskFocus=keyof typeof taskSkills

const cues: [Exclude<TaskFocus,'general'>,RegExp][]=[
  ['quiet',/室友|家人.*睡|吵|噪|静音|门外|隔门|原声/],
  ['weight',/称重|重量|多重|净重|拿着.*重|机身.*轻|轻便/],
  ['pack',/夹层|装箱|行李|收纳|打包|旅行|出差|登机箱/],
  ['roots',/发根|造型|蓬松|塌发|定型/],
  ['dry',/湿发|湿刘海|吹干|速干|时间|赶地铁|通勤|赶着|出门|吹多久/]
]
export function planScriptTask(insight:Insight|undefined,brief:ScriptBrief,override?:TaskFocus){
  const task=brief.problem.trim()
  const inferred=cues.find(([,pattern])=>pattern.test(task))?.[0]||'general'
  const focus=override||brief.focus||inferred
  const angle=insight?scriptAngle(insight):'general'
  const contextConflict=Boolean(angle==='family'&&['roots','dry','quiet'].includes(focus)||angle==='commute'&&['pack','weight'].includes(focus))
  return {task,focus,contextConflict}
}

type Take=[picture:string,narration:string,caption:string]
type Setup={hooks:[Take,Take,Take]; conflict:Take; demos:[Take,Take,Take]; evidence:Take; cta:Take}
function setup(focus:TaskFocus,task:string):Setup{
  if(focus==='quiet'){
    const fringe=/刘海/.test(task)
    const hair=fringe?'刘海':'湿发束'
    const scene=/赶地铁|地铁/.test(task)?`地铁快到了，${hair}还湿。`:/室友/.test(task)?`${hair}还湿，室友在隔壁。`:`${hair}还湿，门外听着呢？`
    return {
      hooks:[
        [`近拍${hair}，切到门外收音位置。`,scene,'湿发待整理 · 门外收音'],
        ['把录音设备摆到门外，画面带到吹风机。','门外能听见什么？','来听门外原声'],
        [`同屏拍${hair}和门把手。`,'吹之前，先听门外。','门内操作 · 门外收音']
      ],
      conflict:[`在镜前展示${hair}状态，保留门的位置。`,'我先把这一小束整理好，再听门外的声音。',`本次只整理${hair}`],
      demos:[
        [`拿 S8mini 对准${hair}，固定机位拍开始整理的动作。`,`我用 S8mini 先把${hair}吹开。`,'镜前近景 · 连续实拍'],
        ['一台设备拍 S8mini 操作，另一台固定在门外同步收音。','我在里面吹，录音设备就放在门外。','固定门外收音位置'],
        ['在同一门外机位先录环境音，再录 S8mini 运行声。','先听没开的时候，再听打开之后。','开机前后 · 同位置收音']
      ],
      evidence:['保留门外原声，字幕填写门状态、收音位置和实际使用档位。','这是门外同一个位置录下来的声音。','门外原声 · 本次记录'],
      cta:['S8mini 实物与对应商品卡同屏。','想看刚才用的这台，点商品卡找 S8mini。','商品卡查看对应型号']
    }
  }
  if(focus==='pack'){
    const space=/夹层/.test(task)?'行李箱夹层':/背包|通勤包/.test(task)?'背包':'行李箱'
    return {
      hooks:[
        [`俯拍已经装好衣物的${space}，手指点出剩余位置。`,'这点空位，还能放吗？',`实拍${space}余量`],
        [`近拍${space}开口和拉链，S8mini 放在旁边。`,'这个拉链能拉上吗？','放进去，再试合箱'],
        [`同框展示${space}和主收纳区的剩余位置。`,'吹风机放哪一格？','两个位置怎么选']
      ],
      conflict:[`保留${space}里原有物件，拍实际开口与深度。`,`东西都装好了，就试这只${space}。`,'保留原有物件'],
      demos:[
        [`俯拍把 S8mini 放进${space}，记录是否需要挪动原有物件。`,'先试一下，原来的东西要不要挪。','观察是否需要挪东西'],
        [`固定侧面机位，连续拍 S8mini 放入${space}、理线、尝试合上。`,'从放进去到拉拉链，一镜拍完。','放入 → 理线 → 合箱'],
        [`在${space}的目标位置和另一个可用区域分别试放 S8mini，保留相同物件。`,'同一台试两个位置，看哪个更好拿。','同样物件 · 比较两个位置']
      ],
      evidence:['保留拉链的实际结果和拿取过程，记录本次箱型与装载条件。','看这里，最后能不能合上，以这个镜头为准。','本次箱型与装载条件'],
      cta:['S8mini 实物和挂载商品卡同框，核对型号。','想照自己的箱子比一下，点商品卡看对应型号。','按自己的箱子核对']
    }
  }
  if(focus==='weight')return {
    hooks:[['手拿 S8mini 与秤同框。','出门带它，秤上多少？','实物上秤'],['近拍空秤读数。','先归零，再上秤。','从归零开始拍'],['机身、线材和配件铺开。','带不带线，差多少？','先确认称重口径']],
    conflict:['摊开本次需要携带的物件，镜头标明哪些入秤。','看清这次哪些东西放上秤。','同一台 S8mini'],
    demos:[
      ['镜头跟随 S8mini 从旅行包取出并放上秤。','我把实际装进包里的东西称一次。','按携带组合称重'],
      ['锁定电子秤机位，连续拍归零、放入 S8mini 和等待读数稳定。','归零、放上去，读数稳了再看。','一镜保留完整操作'],
      ['分两次拍 S8mini 实物称重，只有可分离配件才作为第二次的变量。','先称机身这组，再称带配件的一组。','配件变化单独记录']
    ],
    evidence:['保留真实秤面读数，字幕记录是否包含线材与配件。','数字以秤上这次的读数为准。','本次读数 · 标明称重口径'],
    cta:['拍实物和实际挂载的 S8mini 商品卡。','准备带出门的话，点商品卡核对你要带的配置。','核对型号和配置']
  }
  if(focus==='roots')return {
    hooks:[['近拍镜前发根状态。','头发吹完，发根还塌？','先看发根状态'],['固定机位对准发根和梳子。','发根怎么吹？','拍清梳子和风嘴位置'],['两侧发根同框。','两边怎么对比？','同机位对照']],
    conflict:['同角度拍发根与梳子，保留初始状态。','我就整理这一侧，另一侧留作对照。','只演示同一小块区域'],
    demos:[
      ['用 S8mini 边吹边用梳子抬起发根，近拍梳子走向。','我先用 S8mini 吹这一小块，再把发根抬起来。','梳子从发根抬起'],
      ['S8mini、梳子和发根近景同框，连续拍分区和操作。','镜头放近一点，看梳子从哪里进去。','分区 → 抬根 → 吹发'],
      ['同角度记录 S8mini 配合梳子前后的发根，保持同一光线。','机位不动，直接看前后这一小块。','同光线 · 同角度']
    ],
    evidence:['同机位展示本次发根前后状态，注明本次演示对象与工具。','这就是刚刚那一块，放在一起看。','仅展示本次画面'],
    cta:['拍 S8mini 和实际挂载的商品卡，核对配件。','如果你也想试这个动作，点商品卡看型号和配件。','查看对应型号']
  }
  if(focus==='dry'){
    const hair=/刘海/.test(task)?'刘海':'湿发束'
    return {
      hooks:[[`近拍${hair}和准备出门的随身物品。`,`要出门了，${hair}还湿？`,'出门前的湿发'],[`让计时器归零，与${hair}同框。`,'从现在开始计时。','记录本次用时'],[`并列呈现${hair}与干燥目标。`,'吹到哪一步算好？','先看初始状态']],
      conflict:[`近拍${hair}起始状态，说明试验对象。`,'这次就吹镜头里这一束。','本次对象 · 起始状态'],
      demos:[
        [`用 S8mini 连续处理${hair}，保留开始和结束的动作。`,'我用 S8mini 把这一束整理到能出门的状态。','连续拍本次操作'],
        [`S8mini 开机和计时器同步，保留处理${hair}的全段。`,'计时从开机开始，结束的时候再停。','开机起计'],
        [`拍 S8mini 处理前后的${hair}，镜头角度保持一致。`,'前后都从这个角度看，方便对上。','同一束 · 同角度']
      ],
      evidence:['留下计时器、起始湿度、档位和本次结束标准，实拍后填入结果。','画面里的时间，只对应这一次演示。','本次条件与用时'],
      cta:['产品和 S8mini 对应的商品卡同框。','想用同样的方法试试，点商品卡看这台的配置。','查看 S8mini 配置']
    }
  }
  return {
    hooks:[['近拍吹发前的发束和台面。','平时怎么吹？','从发束准备开始'],['S8mini、发束和梳子同框。','这台怎么拿、怎么吹？','拍清实物操作'],['吹风机按键与发束同框。','换位置，要怎么拿？','看看手部动作']],
    conflict:['保持台面布局与发束状态，明确本次演示对象。','我先拿这一小束做个演示。','单束演示'],
    demos:[['手部近拍用 S8mini 整理湿发束。','我用 S8mini 从这一小束开始。','手部操作近景'],['同一机位连续拍 S8mini 拿起、开机、操作。','从拿起到实际吹发，连着看一遍。','拿起 → 开机 → 使用'],['侧面拍 S8mini 在发束不同位置的操作动作。','再从侧面看一下拿的位置。','侧面看实际操作']],
    evidence:['保留操作过程及发束的实际状态。','这就是刚才镜头里的实际状态。','本次发束演示'],
    cta:['拍实物及 S8mini 实际挂载的商品卡。','想看这一台，点商品卡对一下型号。','核对对应型号']
  }
}

const directions=['场景冲突','实拍任务','购买两难']
const parts=['前三秒钩子','具体冲突','产品实操','实拍证据','商品卡引导']
export function runScriptAgent(db:DB,insight:Insight|undefined,brief:ScriptBrief,override?:TaskFocus,tone:'自然口播'|'实测讲解'='自然口播'){
  const plan=planScriptTask(insight,brief,override)
  const inputs=[brief.problem,brief.proof].join('\n')
  const inputRisks=audit(inputs,db.facts)
  const evidence=plan.focus==='weight'&&!plan.contextConflict?scriptEvidence(db.matches.filter(m=>m.insight===insight?.id),db.facts.filter(f=>f.category==='参数'&&/(?:\d+(?:\.\d+)?\s*(?:克|g)|称重|净重)/i.test(f.wording)))
    .filter(f=>audit(f.wording,db.facts).length===0):[]
  const [fact]=evidence
  const scene=setup(plan.focus,plan.task)
  const proofDirectives=[
    [/同一机位|固定机位/, '拍摄中保持同一机位。'],
    [/连续拍摄|一镜到底|连续实拍/, '保留未经拼接的原片。'],
    [/同一.*发束|同一束|同一角度/, ['dry','roots','quiet'].includes(plan.focus)?'保持演示对象和观察角度一致。':''],
    [/同一行李箱|同一只箱|同一套衣物/, plan.focus==='pack'?'使用同一只箱子和同一组衣物。':'']
  ] as const
  const proofNotes=proofDirectives.filter(([pattern,note])=>note&&pattern.test(brief.proof)).map(([,note])=>note).join('')
  const drafts=directions.map((direction,i)=>{
    const proof:Take=[scene.evidence[0]+proofNotes+(fact?' 核验依据 '+fact.id+'。':''),fact?fact.wording:scene.evidence[1],scene.evidence[2]]
    const rows=[scene.hooks[i],scene.conflict,scene.demos[i],proof,scene.cta]
    let elapsed=0
    const shots=rows.map(([content,line,subtitle],index):StudioShot=>{
      const narration=tone==='实测讲解'&&index>0&&index<4&&!(index===3&&fact)?subtitle+'。':line
      const seconds=index===0?3:Math.max(index===2||index===3?6:4,Math.ceil(narration.replace(/[\p{P}\s]/gu,'').length/4))
      const time=elapsed+'–'+(elapsed+=seconds)+' 秒'
      return {time,part:parts[index],content,subtitle,narration}
    })
    const findings=deliveryFindings('S8mini · '+taskSkills[plan.focus]+' · '+direction,shots,db.facts)
    return {direction,shots,findings}
  })
  return {plan,evidence,inputRisks,drafts,proofNotes}
}
