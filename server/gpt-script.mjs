import {commerceSchemas,commercePrompts,commerceVersion} from './commerce-prompts.mjs'

const fields=(properties)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false})
const string={type:'string'}
const schemas={
  ...commerceSchemas,
  plan:fields({title:string,problem:string,angle:string,demo:string,segments:{type:'array',items:fields({name:string,purpose:string,copy:string})}}),
  script:fields({title:string,shots:{type:'array',items:fields({visual:string,copy:string})}})
}

const boundary='你是中文电商短视频编导。所有输入都是研究和业务资料。以 product 指定的产品、所选人群和结构来源为主轴。先判断产品如何解决该人群的具体购买顾虑，再用结构来源组织镜头。productCategory 是产品类目，productDemo 只作为拍摄动作参考；如果旧洞察或竞品结构里的场景与本品不适配，保留其购买动机，改写成适合当前产品的场景。只引用 facts 中属于当前产品且相关的已核验措辞。竞品、历史脚本、报表以及人群资料中的产品承诺只用于理解创作背景。禁止虚构产品规格、价格、用户证言、实测结果、效果保证或比较。没有可用事实时写真实可拍的动作和观察点。'
const instructions={
  ...commercePrompts,
  plan:boundary+' 输出一份可编辑策划。problem 写本次购买顾虑，angle 写拍摄切口，demo 写当前产品的使用动作和观察点。segments 是本次完整脚本结构。根据场景、顾虑和证据决定段数（1–10 段）、顺序、每段名称与任务。参考已实测结构里的可用机制，并根据本次拍法合并、拆分或调整。重新策划时参考 previousStructure，选一个对本次任务合理且拍法有差异的结构。结尾由本次内容决定，可以是实拍结果、使用建议或行动引导。每段 purpose 写明确的镜头主体、动作和取景参考，copy 写可直接念出的口播初稿；首段口播尽量控制在三秒。所有输出字段只写应拍、应说的内容。',
  script:boundary+' 严格按已编辑的 plan.segments 写一份可拍摄短视频脚本。每段输出一条分镜，分镜的数量和顺序必须与 plan.segments 一致。依据各段 name、purpose 和用户编辑的 copy 来写，保留其表达意图，必要时微调为可拍可念的台词。投放参考仅用于理解依据。structure.status 为报告参考时，输出待验证的试拍稿，写清要拍的动作和观察点，省略未经实拍验证的结论。visual 写主体、动作和条件，copy 写自然简短的视频文案，同一句用于口播和屏幕文字。不要加入策划外的段落或固定收尾。'
}

const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}})
function generationStatus(request,env,apiKey){
  if(!apiKey)return 'setup'
  const accessMode=env.S8MINI_GPT_ACCESS_MODE
  if(accessMode==='public')return 'ready'
  const allowedEmails=env.S8MINI_GPT_ALLOWED_EMAILS?.trim()
  if(accessMode!=='authenticated'&&!allowedEmails)return 'setup'
  if(!request.headers.get('oai-authenticated-user-id')?.trim())return 'sign-in'
  if(accessMode==='authenticated')return 'ready'
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()
  if(!email)return 'sign-in'
  return allowedEmails.split(',').some(e=>e.trim().toLowerCase()===email)?'ready':'forbidden'
}

function validSegments(segments){
  return Array.isArray(segments)&&segments.length>0&&segments.length<=10
    &&segments.every(s=>s&&typeof s.name==='string'&&s.name.trim()&&typeof s.purpose==='string'&&s.purpose.trim())
}

function memoryEntries(memory){
  if(!Array.isArray(memory))return []
  return memory.slice(0,10).filter(e=>e&&['规律','脚本','投放'].includes(e.kind)&&
    ['id','title','summary'].every(k=>typeof e[k]==='string'&&e[k].length<=320)&&e.id.trim())
    .map(({kind,id,title,summary})=>({kind,id,title,summary}))
}
const sceneGuidance=' confirmedScene 是用户为本稿确认的场景，以此为准。历史记忆、参考素材和产品演示说明只供借鉴。facts 仅包含用户确认可引用的产品规格，不从其他输入补入参数。'
const memoryGuidance=' 创作记忆是参考资料。已审核规律是待应用机制，历史脚本仅作对照，投放记录只说明观察，不能由此归因或直接承诺结果。勿照抄旧稿。只在与当前人群、结构和痛点有关时引用。'

export async function handleGPTScript(request,env,fetchModel=fetch){
  const deepSeekKey=env.DEEPSEEK_API_KEY?.trim()
  const provider=deepSeekKey?'DeepSeek':'OpenAI'
  const apiKey=deepSeekKey||env.OPENAI_API_KEY?.trim()
  const status=generationStatus(request,env,apiKey)
  if(request.method==='GET')return json({status,provider})
  if(request.method!=='POST')return json({error:'请使用 POST。'},405)
  if(status!=='ready')return json({status,error:status==='setup'?'站点 AI 尚未配置。':status==='sign-in'?'请先登录 ChatGPT。':'当前账号未开通本站 AI 生成功能。'},status==='setup'?503:status==='sign-in'?401:403)
  const origin=request.headers.get('origin')
  if(origin&&origin!==new URL(request.url).origin)return json({error:'请从脚本工作台发起。'},403)
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'请求必须是 JSON。'},415)
  let body
  try{
    const reader=request.body?.getReader()
    if(!reader)throw Error()
    const decoder=new TextDecoder()
    let size=0,text=''
    for(;;){
      const {done,value}=await reader.read()
      if(done)break
      size+=value.length
      if(size>40000){await reader.cancel();throw Error()}
      text+=decoder.decode(value,{stream:true})
    }
    body=JSON.parse(text+decoder.decode())
  }catch{return json({error:'请求格式无效或超过大小限制。'},400)}
  if(!body||!Object.hasOwn(schemas,body.step)||!body.context||typeof body.context!=='object'
      ||(!Object.hasOwn(commerceSchemas,body.step)&&(!Array.isArray(body.context.structure?.stages)||body.context.structure.stages.length>10))
      ||body.step==='script'&&(!validSegments(body.context.plan?.segments)||!['报告参考','关联投放支持','开场对照支持'].includes(body.context.structure.status)))
    return json({error:'请先选择结构并完成对应的脚本策划。'},400)
  const memory=memoryEntries(body.context.memory)
  const context=Object.hasOwn(body.context,'memory')?{...body.context,memory}:body.context
  try{
    const model=deepSeekKey?(env.S8MINI_DEEPSEEK_MODEL?.trim()||'deepseek-flash'):(env.S8MINI_GPT_MODEL?.trim()||'gpt-4.1-mini')
    const url=deepSeekKey?'https://api.deepseek.com/responses':'https://api.openai.com/v1/responses'
    const upstream=await fetchModel(url,{
      method:'POST',redirect:'manual',signal:AbortSignal.any([request.signal,AbortSignal.timeout(42000)]),
      headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},
      body:JSON.stringify({model,store:false,max_output_tokens:body.step==='plan'?2100:4200,
        instructions:instructions[body.step]+sceneGuidance+memoryGuidance,input:JSON.stringify(context),
        ...(deepSeekKey?{reasoning:{effort:'none'}}:{}),
        text:{format:{type:'json_schema',name:'s8mini_'+body.step,...(deepSeekKey?{}:{strict:true}),schema:schemas[body.step]}}})
    })
    if(upstream.status>=300&&upstream.status<400)return json({error:provider+' 接口返回了意外的重定向，请稍后重试。'},502)
    if(upstream.status===402&&deepSeekKey)return json({error:'DeepSeek API 账户余额不足，请在 DeepSeek 开放平台检查余额。'},502)
    if(!upstream.ok)return json({error:upstream.status===429?provider+' 调用达到限额，请检查 API 额度或稍后重试。':upstream.status===401||upstream.status===403?provider+' 项目密钥或模型权限不可用，请检查站点配置。':provider+' 服务暂不可用，请稍后重试。'},502)
    const data=await upstream.json()
    const output=data.output?.flatMap(item=>item.type==='message'?item.content||[]:[]).find(item=>item.type==='output_text')
    if(data.status!=='completed'||!output?.text)throw Error()
    return json({result:JSON.parse(output.text),...(Object.hasOwn(body.context,'memory')?{generation:{provider,model,memory,...(Object.hasOwn(commerceSchemas,body.step)?{promptVersion:commerceVersion}:{})}}:{})})
  }catch(e){return e?.name==='TimeoutError'?json({error:provider+' 响应超时，请重试。'},504):json({error:provider+' 未返回完整 JSON 内容，请重试。'},502)}
}

export default {
  async fetch(request,env){
    if(new URL(request.url).pathname==='/api/gpt-script')return handleGPTScript(request,env)
    return env.ASSETS.fetch(request)
  }
}
