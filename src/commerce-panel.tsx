import {useEffect,useRef,useState} from 'react'
import {Sparkles} from 'lucide-react'
import {budgets,commerceRisks,commerceShots,copyDiagnostics,draftFrom,dimensions,genericOpening,motiveFrom,narratives,reviewFrom,rewritePositions,salesCopyIssues,spokenLength,total,singleDraftFrom,withBottomLeftCta,type Draft,type Duration,type Edition,type Motive,type Review} from './commerce-engine'
import type {GenerationSource} from './creative-memory'
import type {Fact} from './domain'
import {Field} from './ui'

export type SaveCommerce = (editions:Edition[],generation:GenerationSource,scriptId?:string)=>string|undefined
type Candidate = {id?:string; editions:Edition[]; issue?:string}
const focuses=['只优化前三秒','强化痛点','强化购买理由','增加有证据的卖点','调整口语','优化成交引导','完整重写']

export function CommercePanel({ready,context,facts,save,open,restored}:{ready:boolean;context:Record<string,unknown>;facts:Fact[];save:SaveCommerce;open:(id:string)=>void;restored?:Candidate}){
  const [duration,setDuration]=useState<Duration>(restored?.editions.at(-1)?.meta.duration||30)
  const [narrative,setNarrative]=useState('scene')
  const [videoType,setVideoType]=useState('实物演示')
  const [originalScript,setOriginalScript]=useState('')
  const [candidate,setCandidate]=useState<Candidate|undefined>(restored)
  const [focus,setFocus]=useState(focuses[0])
  const [progress,setProgress]=useState('')
  const [error,setError]=useState('')
  const active=useRef<AbortController|undefined>(undefined)
  useEffect(()=>()=>active.current?.abort(),[])
  const base={...context,...(originalScript.trim()?{originalScript:originalScript.trim()}:{}),duration,videoType,narrative:narratives.find(n=>n.id===narrative),budgets:budgets(duration,6)}
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
    return {next:positions.includes(draft.shots.length-1)?withBottomLeftCta(next):next,changes:typeof result?.changes==='string'?result.changes.slice(0,600):target,generation:response.generation}
  }
  function salesIssues(draft:Draft){
    const issues=salesCopyIssues(draft,String(context.product||''),String(context.productCategory||''))
    const ion=facts.find(f=>f.claim==='10亿负离子'&&f.status==='已核验'&&f.wording&&f.source&&f.date)
    if(context.productId==='dr-flash-s8mini'&&ion&&(!draft.factIds.includes(ion.id)||!draft.shots.slice(1,-1).some(s=>/10\s*亿负离子/.test(s.copy)))){
      issues.push('在中段口播直接介绍已核验的 10 亿负离子，并引用事实条目')
    }
    return issues
  }
  async function generate(signal:AbortSignal){
    let analysis=motiveFrom((await request('motive',{},signal)).result,1)
    if(genericOpening(analysis.hooks[0].copy)){
      analysis=motiveFrom((await request('motive',{feedback:'开头需点出具体场景物件、需求或冲突。'},signal)).result,1)
    }
    setProgress('正在写脚本…')
    const input={motive:analysis,hooks:analysis.hooks}
    let response=await request('commerce',input,signal)
    let draft=singleDraftFrom(response.result,facts,analysis)
    const issues=salesIssues(draft)
    if(issues.length){
      response=await request('commerce',{...input,feedback:issues},signal)
      draft=singleDraftFrom(response.result,facts,analysis)
    }
    const {generation}=response
    const first=edition(draft,analysis,0)
    const id=save([first],generation)
    setCandidate({editions:[first],id})
    setProgress('正在评审脚本…')
    try{
      const review=await assess(draft,analysis,signal)
      const reviewed=edition(draft,analysis,0,review,'初稿评审')
      const savedId=save([reviewed],generation,id)||id
      setCandidate({editions:[first,reviewed],id:savedId})
    }catch(e){
      if(!signal.aborted)setCandidate({editions:[first],id,issue:e instanceof Error?e.message:'评分未完成。'})
    }
  }
  function improve(){
    if(!candidate)return
    const current=candidate.editions.at(-1)!
    void task('按所选目标改写…',async signal=>{
      const {next,changes,generation}=await rewrite(current,focus,signal)
      const hookIndex=current.meta.motive.hooks.findIndex(h=>h.strategy===current.meta.hook.strategy)
      const carried=current.meta.risks.filter(r=>!r.includes('口播超时'))
      let review:Review|undefined,issue:string|undefined
      try{review=await assess(next,current.meta.motive,signal)}catch(e){issue=e instanceof Error?e.message:'评分未完成。'}
      const revised=edition(next,current.meta.motive,Math.max(0,hookIndex),review,changes,carried)
      const id=save([revised],generation,candidate.id)||candidate.id
      setCandidate({id,issue,editions:[...candidate.editions,revised]})
    })
  }
  const result=candidate?.editions.at(-1)
  const draft=result?.draft,meta=result?.meta
  const diagnostics=draft?[...copyDiagnostics(draft),...salesIssues(draft)]:[]
  return <section className="commerce-panel" aria-label="带货文案引擎">
    <fieldset className="commerce-settings" disabled={!!progress}>
      <Field label="目标时长" value={String(duration)} options={[15,30,45].map(d=>({value:String(d),label:d+' 秒'}))} change={v=>setDuration(Number(v) as Duration)}/>
      <details className="source-note commerce-config">
        <summary>创作设置与原稿</summary>
        <Field label="视频类型" value={videoType} options={['实物演示','场景口播','选购测评'].map(v=>({value:v,label:v}))} change={setVideoType}/>
        <Field label="叙事结构" value={narrative} options={narratives.map(n=>({value:n.id,label:n.label}))} change={setNarrative}/>
        <label className="field"><span>原始带货口播（选填）</span>
          <textarea rows={4} maxLength={4000} value={originalScript} onChange={event=>setOriginalScript(event.target.value)}/>
        </label>
      </details>
    </fieldset>
    <div className="inline-buttons">
      <button className="button primary" disabled={!ready||!!progress} onClick={()=>void task('正在分析购买动机…',generate)}><Sparkles size={16}/> {candidate?'重新生成脚本':'生成脚本'}</button>
      {progress&&<button className="text-button" onClick={()=>active.current?.abort()}>停止</button>}
    </div>
    {progress&&<p role="status" className="muted">{progress}</p>}
    {error&&<p className="notice" role="alert">{error}</p>}
    {draft&&meta&&candidate&&<div className="commerce-document">
      <article>
        <h4>{draft.title}</h4>
          <div className="commerce-readout">
            <strong>完整带货口播</strong>
            <p>{draft.shots.map(shot=>shot.copy.trim()).join('\n')}</p>
          </div>
          <details><summary>创作依据</summary><p>{meta.motive.reason}</p>
          {draft.pitch&&<details><summary>购买利益与举证</summary>
            <p>产品事实 · {facts.find(f=>f.id===draft.pitch?.factId)?.wording||'使用实拍观察'}</p>
            <p>用户利益 · {draft.pitch.benefit}</p><p>场景证明 · {draft.pitch.proof}</p><p>点击理由 · {draft.pitch.clickReason}</p>
          </details>}

          {draft.pitch?.editorialReason&&<details><summary>为什么这样写</summary>
            {draft.pitch.originalIdea&&<p>创意 · {draft.pitch.originalIdea}</p>}
            <p>{draft.pitch.editorialReason}</p>
          </details>}
          {draft.pitch?.testPlan&&<details><summary>测试与复盘</summary><p>{draft.pitch.testPlan}</p></details>}
          </details>
          <details><summary>查看完整分镜</summary><div className="table-wrap"><table><thead><tr>{['时间段','结构任务','拍摄参考','视频文案'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{commerceShots(draft,meta.duration).map((s,i)=><tr key={i}><td>{s.time}</td><td>{s.part}</td><td>{s.content}</td><td>{s.subtitle}</td></tr>)}</tbody></table></div></details>
          <p>{meta.review?total(meta.review)+' / 100 · 创作诊断':'待评审'}{meta.risks.length?' · 需人工复核':!draft.factIds.length?' · 内部试拍稿':' · 发布前请复核'}</p>
          {candidate.issue&&<p role="status">{candidate.issue}</p>}
          {meta.review&&<details><summary>评分与修改原因</summary><ul>{meta.review.scores.map((s,j)=><li key={j}>{dimensions[j][0]} {s.score}/{dimensions[j][1]} · {s.reason}</li>)}</ul><p>{meta.review.changes}</p></details>}
          {diagnostics.length>0&&<details><summary>文案优化建议</summary>{diagnostics.map(issue=><p key={issue}>{issue}</p>)}</details>}
          {!!meta.risks.length&&<details><summary>宣传合规与时长提示</summary><ul>{meta.risks.map(r=><li key={r}>{r}</li>)}</ul></details>}
          {candidate.editions.length>1&&<details><summary>比较版本</summary>{candidate.editions.map(({draft,meta},j)=><div key={j}><p><strong>第 {j+1} 版 · {meta.changes}</strong></p><p>{draft.shots.map(s=>s.copy).join(' ')}</p></div>)}</details>}
          <div className="commerce-edit"><Field label="局部重写方向" value={focus} options={focuses.map(v=>({value:v,label:v}))} change={setFocus}/><div className="inline-buttons"><button className="button" disabled={!!progress||!candidate.id} onClick={()=>open(candidate.id!)}>编辑与版本</button><button className="button" disabled={!!progress||!ready} onClick={improve}>局部重写</button></div></div>
      </article>
    </div>}
  </section>
}
