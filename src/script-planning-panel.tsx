import {CommercePanel,type SaveCommerce} from './commerce-panel'
import {commerceFacts,type Edition} from './commerce-engine'
import {productsFor,productWorkspace,type Product} from './products'
import {studioShot,videoCopy} from './studio-engine'
import {creativeMemory,type GenerationSource} from './creative-memory'
import {useEffect,useRef,useState} from 'react'
import {Plus, Sparkles} from 'lucide-react'
import {type DB,type Fact,type Insight} from './domain'
import {insightContext,maxScriptSegments,plannedTiming,planningFacts,restoreScriptPlan,scriptFromModel,scriptStructures,strategyContext,validScriptPlan,type ScriptPlan,type ScriptPlanning,type ScriptSegment} from './script-planning'
import {Badge,Field,Panel} from './ui'

const api='/api/gpt-script'
type ModelStatus='loading'|'ready'|'setup'|'sign-in'|'forbidden'|'offline'
const labels={title:'策划标题',problem:'购买顾虑',angle:'脚本切口',demo:'实拍演示与观察点'} as const

export function ScriptPlanningPanel({db,product,selectProduct,insight,selectInsight,initialSource,savedPlanning,savedShots,commerceScript,materialReference,accept,saveCommerce,openCommerce}:{db:DB;product:Product;selectProduct:(id:string)=>void;insight?:Insight;selectInsight:(id:string)=>void;initialSource?:string;savedPlanning?:ScriptPlanning;savedShots?:ReturnType<typeof scriptFromModel>['shots'];commerceScript?:DB['scripts'][number];materialReference?:{id:string;stages:string[]};saveCommerce:SaveCommerce;openCommerce:(id:string)=>void;accept:(draft:ReturnType<typeof scriptFromModel>,planning:ScriptPlanning,facts:Fact[])=>void}){
  const workspace=productWorkspace(db,product.id)
  const structures=insight?scriptStructures(workspace,insight.id):[]
  const [source,setSource]=useState(initialSource||'')
  const structure=structures.find(s=>s.id===source)||structures.find(s=>s.status!=='报告参考')||structures.find(s=>s.hook==='C')
  const [status,setStatus]=useState<ModelStatus>('loading')
  const [useMemory,setUseMemory]=useState(true)
  const [provider,setProvider]=useState<string>()
  const [pending,setPending]=useState<'plan'|'script'>()
  const [error,setError]=useState('')
  const [result,setResult]=useState<{structure:string;plan:ScriptPlan}|undefined>(()=>{
    if(!savedPlanning)return
    const plan=restoreScriptPlan(savedPlanning)
    const segments=plan.segments.map((segment,i)=>({...segment,copy:segment.copy??(savedShots?.[i]?videoCopy(savedShots[i]):undefined)}))
    return {structure:savedPlanning.structure.id,plan:{...plan,segments}}
  })
  const active=useRef<AbortController|null>(null)
  const plan=result?.structure===structure?.id?result?.plan:undefined
  const timing=plan?plannedTiming(plan.segments):[]
  const memory=insight?creativeMemory(workspace,insight):[]
  const commercialFacts=insight?commerceFacts(workspace,insight):[]
  const evidence=insight?planningFacts(workspace,insight):[]
  useEffect(()=>{
    const controller=new AbortController()
    fetch(api,{signal:controller.signal,cache:'no-store'})
      .then(async r=>r.ok?await r.json():undefined)
      .then(data=>{
        if(controller.signal.aborted)return
        const s=data?.status
        setStatus(['ready','setup','sign-in','forbidden'].includes(s)?s:'offline')
        if(data?.provider==='DeepSeek'||data?.provider==='OpenAI')setProvider(data.provider)
      })
      .catch(()=>{if(!controller.signal.aborted)setStatus('offline')})
    return ()=>{controller.abort();active.current?.abort()}
  },[])
  const restored=commerceScript?.versions.slice().reverse().flatMap((version):Edition[]=>{
    const meta=version.planning?.commerce
    if(!meta||![5,6].includes(version.shots.length))return []
    const shots=version.shots.map(shot=>({task:shot.part,visual:'content' in shot?shot.content:shot.visual,copy:videoCopy(studioShot(shot))}))
    return [{meta,draft:{title:version.title||commerceScript.title,reason:meta.motive.reason,shots,pitch:meta.pitch,
      factIds:version.evidence.filter(f=>commercialFacts.some(approved=>approved.id===f.id)).map(f=>f.id)}}]
  })
  const locked=Boolean(pending)
  const referenceOnly=structure?.status==='报告参考'
  const scriptBlocker=!plan||!validScriptPlan(plan)?'请补齐策划字段以及每一段的名称和任务。'
    :(status!=='ready'?'生成服务就绪后即可写稿。':'')
  async function run(step:'plan'|'script'){
    if(active.current||!insight||!structure||status!=='ready'
      ||step==='script'&&scriptBlocker)return
    const references=useMemory?memory:[]
    const controller=new AbortController()
    active.current=controller;setPending(step);setError('')
    try{
      const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(48000)]),
        body:JSON.stringify({step,context:{product:product.name.slice(0,200),productCategory:product.category.slice(0,120),productDemo:product.demo.slice(0,1200),insight:insightContext(insight),
          structure:strategyContext(structure),memory:references,facts:evidence.map(({id,wording,source,date})=>({id,wording,source,date})),
          ...(step==='script'?{plan}:plan?{previousStructure:plan.segments}:{})}})})
      const data=await response.json().catch(()=>null)
      if(!response.ok){if(['setup','sign-in','forbidden'].includes(data?.status))setStatus(data.status);throw Error(data?.error||'暂时无法调用站点 AI。')}
      if(step==='plan'){
        if(!validScriptPlan(data?.result))throw Error('AI 返回的策划缺少完整的段落结构，请重试。')
        setResult({structure:structure.id,plan:data.result})
      }else if(plan){
        const generation:GenerationSource={provider:data?.generation?.provider||provider||'模型',model:data?.generation?.model||'',memory:references}
        const draft=scriptFromModel(data?.result,plan,[...workspace.facts.filter(f=>!evidence.some(approved=>approved.id===f.id)).map(f=>({...f,status:'待核验'})),...evidence])
        const written={...plan,segments:plan.segments.map((segment,i)=>({...segment,purpose:draft.shots[i].content,copy:videoCopy(draft.shots[i])}))}
        setResult({structure:structure.id,plan:written})
        accept(draft,{structure,plan:written,generation},evidence)
      }
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'本次生成失败，请重试。')}
    finally{if(active.current===controller){active.current=null;if(!controller.signal.aborted)setPending(undefined)}}
  }
  function changeSource(next:string){setSource(next);setResult(undefined);setError('')}
  function manualPlan(){
    if(!insight||!structure)return
    setError('')
    setResult({structure:structure.id,plan:{title:insight.title+' · '+product.name+' 脚本策划',problem:insight.pain||insight.barrier,angle:'',demo:product.demo.slice(0,1200),segments:[{name:'',purpose:''}]}})
  }
  function updateSegments(segments:ScriptSegment[]){
    if(plan&&structure)setResult({structure:structure.id,plan:{...plan,segments}})
  }
  function editSegment(index:number,patch:Partial<ScriptSegment>){
    if(plan)updateSegments(plan.segments.map((segment,i)=>i===index?{...segment,...patch}:segment))
  }
  function moveSegment(index:number,offset:number){
    if(!plan)return
    const target=index+offset
    if(target<0||target>=plan.segments.length)return
    const segments=[...plan.segments]
    const [segment]=segments.splice(index,1)
    segments.splice(target,0,segment)
    updateSegments(segments)
  }
  return <Panel title="脚本策划" className="studio-planning">
    <fieldset className="agent-task-fields" disabled={locked}>
      <div className="planning-input-grid">
        <Field label="产品" value={product.id} options={productsFor(db).map(item=>({value:item.id,label:item.name}))} change={selectProduct}/>
        <Field label="人群洞察" value={insight?.id||''} options={[{value:'',label:'选择一个人群'},...db.insights.map(i=>({value:i.id,label:i.title}))]} change={selectInsight}/>
        {structure&&<Field label="结构来源" value={structure.id} options={structures.map(s=>({value:s.id,label:s.status+' · '+s.title}))} change={changeSource}/>}
      </div>
      {insight&&<p className="planning-scene"><strong>{insight.scene||insight.title}</strong> · {insight.pain||insight.barrier||insight.status}</p>}
      <details className="source-note planning-reference"><summary>策划资料</summary>
      {structure&&<div>
        <p>{structure.basis}</p>
        {!!structure.stages.length&&<ol>{structure.stages.map((stage,i)=><li key={i}>{stage}</li>)}</ol>}
        <ul>{structure.sources.map((item,i)=><li key={i}>{/^https:\/\/[^\s]+$/.test(item)?<a href={item} target="_blank" rel="noreferrer">打开参考报告 ↗</a>:item}</li>)}</ul>
      </div>}
      <div className="planning-reference-grid">
      <details className="source-note planning-memory"><summary>创作记忆 · {memory.length} 条匹配记录</summary>
        <label className="row"><input type="checkbox" checked={useMemory} onChange={e=>setUseMemory(e.target.checked)}/> 将这些摘要用于 AI 策划和写稿</label>
        {memory.length?memory.map(m=><p key={m.kind+m.id}><b>{m.kind} · {m.title}</b><br/>{m.summary}</p>):<p className="muted">审核相关规律、保存脚本或录入关联报表后，下次创作会更新这里的参考。</p>}
      </details>
        {structure&&<details className="source-note"><summary>已核验产品事实 · {commercialFacts.length} 项</summary>
          <p className="muted">{commercialFacts.length?commercialFacts.map(f=>f.id+' '+f.wording).join('、'):'暂无匹配的已核验产品事实。仅生成内部试拍稿。请到产品库核对在售 SKU、原始来源、核验日期与合规措辞。'}</p>
        </details>}
      </div>
      </details>
      {insight&&structure&&<CommercePanel key={structure.id} ready={status==='ready'}
        context={{product:product.name,productId:product.id,productCategory:product.category,
          insight:insightContext(insight),structure:strategyContext(structure),memory:useMemory?memory:[],facts:commercialFacts,materialReference}}
        restored={commerceScript&&restored?.length?{id:commerceScript.id,editions:restored}:undefined} facts={workspace.facts} save={saveCommerce} open={openCommerce}/>}
      {status!=='ready'&&<p className="muted" role="status">{{loading:'正在检查模型连接。',setup:'站点 AI 等待管理员配置。','sign-in':'登录后即可生成。',forbidden:'此账号尚未开通生成权限。',offline:'暂未连到站点 AI 服务。'}[status]} {status==='sign-in'&&<a href={'/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname+location.hash)}>使用 ChatGPT 登录</a>}</p>}
      <details className="source-note"><summary>单稿策划与手动编辑</summary>
      <div className="inline-buttons planning-actions">
        <button className="button primary" disabled={!insight||!structure||status!=='ready'} onClick={()=>void run('plan')}>
          <Sparkles size={16}/> {pending==='plan'?'AI 正在策划…':plan?`用 ${provider||'AI'} 重做策划`:`用 ${provider||'AI'} 生成策划`}
        </button>
        <button className="button" disabled={!insight||!structure||!!plan} onClick={manualPlan}>手动建立策划</button>
        {status==='sign-in'&&<a className="button" href={'/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname+location.hash)} target="_top">使用 ChatGPT 登录</a>}
      </div>
      {status==='ready'&&provider&&<p className="muted">当前生成服务 · {provider}</p>}
      {status!=='ready'&&<p className="muted">{{
        loading:'正在检查 GPT 连接。',setup:'站点 AI 等待管理员配置模型 API 密钥。',
        'sign-in':'使用 ChatGPT 账号登录后即可生成。',forbidden:'此账号尚未开通本站 AI 生成功能。',offline:'暂未连到站点 AI 服务。'
      }[status]}</p>}
      {referenceOnly&&<p className="planning-note">竞品结构参考 · 生成待验证试拍稿，拍摄后可在<a href="#experiments">实验复盘</a>记录结果。</p>}
      {plan&&<>
        <details className="source-note planning-brief"><summary>策划摘要 · {plan.title}</summary>
        <div className="form-grid">{Object.entries(labels).map(([key,label])=>{
          const k=key as keyof typeof labels
          return <Field key={k} label={label} value={plan[k]} long={k!=='title'} change={v=>setResult({structure:structure!.id,plan:{...plan,[k]:v}})}/>
        })}</div></details>
        <section className="planning-segments" aria-labelledby="planning-segments-title">
          <h3 id="planning-segments-title">完整脚本结构</h3>
          <p className="muted">时间按口播长度估算，可直接编辑拍摄参考和文案。</p>
          <div className="planning-shot-head" aria-hidden="true"><span>时间</span><span>结构</span><span>拍摄参考</span><span>视频文案</span></div>
          {plan.segments.map((segment,i)=><div className="planning-segment" key={i}>
            <div className="planning-segment-head">
              <strong>第 {i+1} 段</strong>
              <div className="inline-buttons">
                <button type="button" className="text-button" aria-label={`上移第 ${i+1} 段`} disabled={i===0} onClick={()=>moveSegment(i,-1)}>上移</button>
                <button type="button" className="text-button" aria-label={`下移第 ${i+1} 段`} disabled={i===plan.segments.length-1} onClick={()=>moveSegment(i,1)}>下移</button>
                <button type="button" className="text-button" aria-label={`删除第 ${i+1} 段`} disabled={plan.segments.length===1} onClick={()=>updateSegments(plan.segments.filter((_,index)=>index!==i))}>删除</button>
              </div>
            </div>
            <div className="planning-shot-row">
              <div className="planning-shot-time"><span>预计时间</span><strong>{timing[i]}</strong></div>
              <Field label="结构" value={segment.name} change={name=>editSegment(i,{name})}/>
              <Field label="拍摄参考" value={segment.purpose} long change={purpose=>editSegment(i,{purpose})}/>
              <Field label="视频文案" value={segment.copy||''} long change={copy=>editSegment(i,{copy})}/>
            </div>
          </div>)}
          <button type="button" className="button" disabled={plan.segments.length>=maxScriptSegments} onClick={()=>updateSegments([...plan.segments,{name:'',purpose:''}])}><Plus size={15}/> 添加段落</button>
        </section>
        {scriptBlocker&&<p className="notice">{scriptBlocker}</p>}
        <button className="button primary" disabled={!!scriptBlocker} onClick={()=>void run('script')}>
          <Sparkles size={16}/> {pending==='script'?'AI 正在写稿…':referenceOnly?`用 ${provider||'AI'} 生成试拍稿`:`用 ${provider||'AI'} 生成脚本`}
        </button>
      </>}
      {pending&&<p role="status">正在请求模型，完成后结果会出现在工作台。</p>}
      {error&&<p className="notice" role="alert">{error}</p>}
      </details>
    </fieldset>
  </Panel>
}
