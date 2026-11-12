import {useEffect,useRef,useState} from 'react'
import {Sparkles} from 'lucide-react'
import {budgets,commerceRisks,commerceShots,copyDiagnostics,draftFrom,dimensions,genericOpening,motiveFrom,narratives,reviewFrom,rewritePositions,salesCopyIssues,spokenLength,total,validateBatch,type Draft,type Duration,type Edition,type Motive,type Review} from './commerce-engine'
import type {GenerationSource} from './creative-memory'
import type {Fact} from './domain'
import {Field} from './ui'

export type SaveCommerce = (editions:Edition[],generation:GenerationSource,scriptId?:string)=>string|undefined
type Candidate = {id?:string; editions:Edition[]; issue?:string}
const focuses=['只优化前三秒','强化痛点','强化购买理由','增加有证据的卖点','调整口语','优化成交引导','完整重写']

export function CommercePanel({ready,provider,context,facts,save,open,restored}:{ready:boolean;provider?:string;context:Record<string,unknown>;facts:Fact[];save:SaveCommerce;open:(id:string)=>void;restored?:Candidate}){
  const [duration,setDuration]=useState<Duration>(restored?.editions.at(-1)?.meta.duration||30)
  const [narrative,setNarrative]=useState('scene')
  const [videoType,setVideoType]=useState('实物演示')
  const [motive,setMotive]=useState<Motive>()
  const [reason,setReason]=useState('')
  const [candidates,setCandidates]=useState<Candidate[]>(restored?[restored]:[])
  const [focus,setFocus]=useState(focuses[0])
  const [progress,setProgress]=useState('')
  const [error,setError]=useState('')
  const active=useRef<AbortController|undefined>(undefined)
  useEffect(()=>()=>active.current?.abort(),[])
  const base={...context,duration,videoType,narrative:narratives.find(n=>n.id===narrative),budgets:budgets(duration,6)}
  async function request(step:string,input:object,signal:AbortSignal){
    const response=await fetch('/api/gpt-script',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({step,context:{...base,...input}}),signal:AbortSignal.any([signal,AbortSignal.timeout(48000)])})
    const data=await response.json().catch(()=>null)
    if(!response.ok)throw Error(data?.error||'生成服务暂不可用。')
    return data as {result:unknown;generation:GenerationSource}
  }
  async function task(label:string,run:(signal:AbortSignal)=>Promise<void>){
    if(active.current)return
    const controller=new AbortController()
    active.current=controller;setProgress(label);setError('')
    try{await run(controller.signal)}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'请求失败，请重试。')}
    finally{active.current=undefined;setProgress('')}
  }
  function reset(){
    setMotive(undefined);setCandidates([]);setReason('')
  }
  function edition(draft:Draft,analysis:Motive,index:number,review?:Review,changes='初稿',previousRisks:string[]=[]):Edition{
    return {draft,meta:{duration,motive:analysis,hook:{...analysis.hooks[index],copy:draft.shots[0].copy},review,changes,pitch:draft.pitch,risks:[...new Set([...previousRisks,...commerceRisks(draft,facts,duration),...(review?.risks||[])])]}}
  }
  async function assess(draft:Draft,analysis:Motive,signal:AbortSignal){
    return reviewFrom((await request('review',{draft,motive:analysis},signal)).result)
  }
  async function rewrite(current:Edition,target:string,signal:AbortSignal){
    const {draft,meta}=current
    const positions=rewritePositions(target,draft.shots.length)
    const response=await request('rewrite',{draft,motive:meta.motive,review:meta.review,risks:meta.risks,copyIssues:salesIssues(draft),focus:target,
      budgets:budgets(meta.duration,draft.shots.length),editableShots:positions.map(i=>i+1)},signal)
    const result=response.result as {draft:unknown;changes?:string}|null
    const next=draftFrom(result?.draft,facts)
    if(next.shots.length!==draft.shots.length)throw Error('改写后的镜头数量不一致，请重试。')
    if(positions.length<draft.shots.length){
      next.title=draft.title;next.reason=draft.reason
      next.shots=draft.shots.map((shot,i)=>positions.includes(i)?{...shot,copy:next.shots[i].copy,visual:next.shots[i].visual}:shot)
      next.factIds=[...new Set([...draft.factIds,...next.factIds])]
      if(target===focuses[0]||target==='强化痛点')next.pitch=draft.pitch
      if(target==='优化成交引导'&&draft.pitch)next.pitch={...draft.pitch,clickReason:next.pitch?.clickReason||draft.pitch.clickReason}
    }
    if(positions.includes(0)&&spokenLength(next.shots[0].copy)>10)throw Error('改写开头超过前三秒预算，已保留原版本，请重试。')
    return {next,changes:typeof result?.changes==='string'?result.changes.slice(0,600):target,generation:response.generation}
  }
  function salesIssues(draft:Draft){
    return salesCopyIssues(draft,String(context.product||''),String(context.productCategory||''))
  }
  async function generate(signal:AbortSignal){
    if(!motive||!reason.trim())return
    const analysis={...motive,reason:reason.trim()}
    const input={motive:analysis,hooks:analysis.hooks}
    let response=await request('commerce',input,signal)
    let drafts=validateBatch(response.result,facts,analysis)
    const feedback=drafts.map((draft,index)=>({candidate:index+1,issues:salesIssues(draft)}))
    if(feedback.some(item=>item.issues.length)){
      setProgress('补写人群痛点和产品介绍…')
      response=await request('commerce',{...input,feedback},signal)
      drafts=validateBatch(response.result,facts,analysis)
    }
    const {generation}=response
    if(drafts.some(d=>d.shots.length!==6||!d.pitch))throw Error('模型未返回六镜及卖点举证信息，请重试。')
    setProgress('评审三条稿件，按需修订…')
    const initial=drafts.map((draft,i)=>{
      const first=edition(draft,analysis,i)
      return {editions:[first],id:save([first],generation)}
    })
    setCandidates(initial)
    const completed=await Promise.all(initial.map(async (candidate,i):Promise<Candidate>=>{
      const editions=[...candidate.editions]
      let savedFrom=0
      try{
        const draft=drafts[i]
        let review=await assess(draft,analysis,signal)
        editions.push(edition(draft,analysis,i,review,'初稿评审'))
        savedFrom=1
        for(let round=0;round<2&&(total(review)<80||salesIssues(editions.at(-1)!.draft).length>0||editions.at(-1)!.meta.risks.some(r=>r.includes('口播超时')));round++){
          const {next,changes}=await rewrite(editions.at(-1)!,'优先修正评分弱项和超时文案',signal)
          const carried=editions.at(-1)!.meta.risks.filter(r=>!r.includes('口播超时'))
          editions.push(edition(next,analysis,i,undefined,changes,carried))
          review=await assess(next,analysis,signal)
          editions[editions.length-1]=edition(next,analysis,i,review,changes,carried)
        }
        return {editions,id:save(editions.slice(savedFrom),generation,candidate.id)||candidate.id}
      }catch(e){
        return {editions,id:editions.length>1?(save(editions.slice(1),generation,candidate.id)||candidate.id):candidate.id,issue:signal.aborted?'已停止后续评审。':e instanceof Error?e.message:'评审失败。'}
      }
    }))
    setCandidates(completed)
  }
  function improve(index:number){
    const candidate=candidates[index],current=candidate.editions.at(-1)!
    void task('按所选目标改写…',async signal=>{
      const {next,changes,generation}=await rewrite(current,focus,signal)
      const hookIndex=current.meta.motive.hooks.findIndex(h=>h.strategy===current.meta.hook.strategy)
      const carried=current.meta.risks.filter(r=>!r.includes('口播超时'))
      let review:Review|undefined,issue:string|undefined
      try{review=await assess(next,current.meta.motive,signal)}catch(e){issue=e instanceof Error?e.message:'评分未完成。'}
      const revised=edition(next,current.meta.motive,Math.max(0,hookIndex),review,changes,carried)
      const id=save([revised],generation,candidate.id)||candidate.id
      setCandidates(old=>old.map((item,i)=>i===index?{id,issue,editions:[...item.editions,revised]}:item))
    })
  }
  return <section className="commerce-panel" aria-label="带货文案引擎">
    <fieldset className="commerce-settings" disabled={!!progress}>
      <Field label="目标时长" value={String(duration)} options={[15,30,45].map(d=>({value:String(d),label:d+' 秒'}))} change={v=>{setDuration(Number(v) as Duration);reset()}}/>
      <Field label="视频类型" value={videoType} options={['实物演示','场景口播','选购测评'].map(v=>({value:v,label:v}))} change={v=>{setVideoType(v);reset()}}/>
      <Field label="叙事结构" value={narrative} options={narratives.map(n=>({value:n.id,label:n.label}))} change={v=>{setNarrative(v);reset()}}/>
    </fieldset>
    <div className="inline-buttons">
      <button className="button primary" disabled={!ready||!!progress} onClick={()=>void task('分析购买动机并生成钩子…',async signal=>{
        let analysis=motiveFrom((await request('motive',{},signal)).result)
        if(analysis.hooks.some(h=>genericOpening(h.copy))){
          analysis=motiveFrom((await request('motive',{feedback:'上次开头太空泛。每条开头点出具体场景物件、需求或冲突。'},signal)).result)
        }
        setMotive(analysis);setReason(analysis.reason);setCandidates([])
      })}><Sparkles size={16}/> {provider||'AI'} 分析动机与钩子</button>
      <button className="button primary" disabled={!ready||!motive||!reason.trim()||!!progress} onClick={()=>void task('生成三条完整带货稿…',generate)}>生成 3 条完整脚本</button>
    </div>
    {progress&&<button className="text-button" onClick={()=>active.current?.abort()}>停止后续生成</button>}
    <p role="status" className="muted">{progress||'生成方案和改写轮次会保存到脚本库。'}</p>
    {error&&<p className="notice" role="alert">{error}</p>}
    {motive&&<>
      <Field label="核心购买理由" value={reason} change={setReason}/>
      <details className="source-note"><summary>购买动机与证据依据</summary>
        <dl>{([['buyer','购买者'],['trigger','需求触发'],['alternative','现有方式'],['dissatisfaction','不满意的原因'],['benefit','期待利益'],['concern','购买顾虑'],['proof','可拍证据'],['basis','事实与假设']] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{motive[key]}</dd></div>)}</dl>
      </details>
      <div className="commerce-options">{motive.hooks.map(h=><article key={h.strategy}>
        <h4>{h.strategy} · 0–3 秒</h4><strong>{h.copy}</strong>
        <p>{h.audience} · {h.psychology}</p><p>{h.retention}</p><p>拍摄 · {h.visual}</p><p>承接 · {h.bridge}</p>
      </article>)}</div>
    </>}
    {!!candidates.length&&<>
      <Field label="局部重写方向" value={focus} options={focuses.map(v=>({value:v,label:v}))} change={setFocus}/>
      <div className="commerce-options">{candidates.map((candidate,i)=>{
        const {draft,meta}=candidate.editions.at(-1)!
        return <article key={i}><h4>{meta.hook.strategy} · {draft.title}</h4>
          <p>{meta.motive.reason}</p>
          {draft.pitch&&<details><summary>购买利益与举证</summary>
            <p>产品事实 · {facts.find(f=>f.id===draft.pitch?.factId)?.wording||'使用实拍观察'}</p>
            <p>用户利益 · {draft.pitch.benefit}</p><p>场景证明 · {draft.pitch.proof}</p><p>点击理由 · {draft.pitch.clickReason}</p>
          </details>}
          <ol>{draft.shots.map((shot,j)=><li key={j}>{shot.copy}</li>)}</ol>
          <details><summary>查看完整分镜</summary><div className="table-wrap"><table><thead><tr>{['时间段','结构任务','拍摄参考','视频文案'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{commerceShots(draft,meta.duration).map((s,i)=><tr key={i}><td>{s.time}</td><td>{s.part}</td><td>{s.content}</td><td>{s.subtitle}</td></tr>)}</tbody></table></div></details>
          <p>{meta.review?total(meta.review)+' / 100 · 创作诊断':'待评审'}{meta.risks.length?' · 需人工复核':!draft.factIds.length?' · 内部试拍稿':' · 发布前请复核'}</p>
          {candidate.issue&&<p role="status">{candidate.issue}</p>}
          {meta.review&&<details><summary>评分与修改原因</summary><ul>{meta.review.scores.map((s,j)=><li key={j}>{dimensions[j][0]} {s.score}/{dimensions[j][1]} · {s.reason}</li>)}</ul><p>{meta.review.changes}</p></details>}
          {[...copyDiagnostics(draft),...salesIssues(draft)].map(issue=><p className="muted" key={issue}>{issue}</p>)}
          {!!meta.risks.length&&<details><summary>宣传合规与时长提示</summary><ul>{meta.risks.map(r=><li key={r}>{r}</li>)}</ul></details>}
          {candidate.editions.length>1&&<details><summary>比较版本</summary>{candidate.editions.map(({draft,meta},j)=><div key={j}><p><strong>第 {j+1} 版 · {meta.changes}</strong></p><p>{draft.shots.map(s=>s.copy).join(' ')}</p></div>)}</details>}
          <div className="inline-buttons"><button className="button" disabled={!!progress||!candidate.id} onClick={()=>open(candidate.id!)}>编辑与版本</button><button className="button" disabled={!!progress||!ready} onClick={()=>improve(i)}>局部重写</button></div>
        </article>
      })}</div>
    </>}
  </section>
}
