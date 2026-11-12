import {defaultProduct,productFacts,productsFor,type Product} from './products'
import {useState} from 'react'
import {ArrowUpRight, GitMerge, Pencil, Search, UsersRound} from 'lucide-react'
import {audiences, strategies, insightFields, blankInsight, feedbackFor, uid, verified, type DB, type Fact, type Insight, type Match} from './domain'
import {businessNeeds,crossInsight,crossPairs} from './cross'
import {Badge,Empty,Field,Modal,PageHead,Panel,Tags,opts} from './ui'
export type Update=(recipe:(db:DB)=>DB)=>boolean
export const replace=<T extends {id:string}>(list:T[],row:T)=>list.some(x=>x.id===row.id)?list.map(x=>x.id===row.id?row:x):[row,...list]
const statuses=['假设 / 待验证','已验证假设','已否定假设']
export function InsightLibrary({db,update,adding,stopAdd,openScript,notify}:{db:DB;update:Update;adding:boolean;stopAdd:()=>void;openScript:(id:string)=>void;notify:(m:string)=>void}){
  const [draft,setDraft]=useState<Insight|null>(()=>adding?blankInsight():null)
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('')
  const [strategy,setStrategy]=useState('')
  const [needFilter,setNeedFilter]=useState('')
  const [people,setPeople]=useState<string[]>([])
  const [chosenNeeds,setChosenNeeds]=useState<string[]>([])
  const pairs=crossPairs(people,chosenNeeds,db.insights)
  const duplicates=people.length*chosenNeeds.length-pairs.length
  const visible=db.insights.filter(i=>(!filter||i.audiences.includes(filter))&&(!strategy||i.strategies.includes(strategy))&&(!needFilter||i.needs?.includes(needFilter))&&[i.id,i.title,i.scene,i.pain,...i.audiences,...i.strategies,...(i.needs||[])].some(s=>s.toLowerCase().includes(search.trim().toLowerCase())))
  const close=()=>{setDraft(null);stopAdd()}
  function submit(){
    if(!draft)return
    if(!draft.title.trim()||!draft.scene.trim()||!draft.audiences.length||!draft.strategies.length){notify('请填写名称、场景，并选择两层人群标签。');return}
    if(draft.status!=='假设 / 待验证' && (!draft.source.trim()||!draft.date||draft.confidence==='D')){notify('更新验证状态前，请填写证据来源、时间，并重新评估置信度。');return}
    if(draft.status==='已否定假设'&&!draft.counter.trim()){notify('请记录用于否定假设的反证。');return}
    if(update(d=>({...d,insights:replace(d.insights,draft)}))){close();notify('洞察已保存。')}
  }
  function savePairs(){
    if(!pairs.length)return
    const cards=pairs.map(({person,need})=>crossInsight(person,need))
    if(update(d=>({...d,insights:[...cards,...d.insights]}))){
      setSearch('');setFilter('');setStrategy('');setNeedFilter('')
      setPeople([]);setChosenNeeds([])
      notify(`已保存 ${cards.length} 张交叉洞察，均为待验证假设。`)
    }
  }
  return <><PageHead label="受众研究"  title="人群洞察库" description="从人群和业务需求生成交叉洞察，再用场景、关系和证据验证。" action="新建洞察" onAction={()=>setDraft(blankInsight())}/>
  <Panel title="人群 × 业务需求">
    <div className="cross-select">
      <Tags label="洞察人群（可多选）" options={audiences} value={people} change={setPeople}/>
      <Tags label="业务需求（可多选）" options={businessNeeds} value={chosenNeeds} change={setChosenNeeds}/>
    </div>
    {people.length>0&&chosenNeeds.length>0?<div className="cross-results" aria-live="polite">
      <p className="muted">自动生成 {pairs.length} 个新组合{duplicates>0?`，跳过 ${duplicates} 个已有组合`:''}。保存后可编辑关系和证据。</p>
      {pairs.length>0&&<ul className="cross-list">{pairs.map(pair=><li key={pair.title}><b>{pair.title}</b><span>{pair.scene} · {pair.pain}</span></li>)}</ul>}
      {pairs.length>0&&<button className="button primary" onClick={savePairs}><GitMerge size={16}/> 保存 {pairs.length} 张交叉洞察</button>}
    </div>:<p className="muted">各选至少一项，交叉组合会自动出现在这里。</p>}
  </Panel>
  <div className="filters"><label className="search"><Search size={17}/><input aria-label="搜索洞察" placeholder="搜索洞察名称、场景或 ID" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="筛选洞察人群" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">全部洞察人群</option>{audiences.map(a=><option key={a}>{a}</option>)}</select><select aria-label="策略人群" value={strategy} onChange={e=>setStrategy(e.target.value)}><option value="">全部策略人群</option>{strategies.map(a=><option key={a}>{a}</option>)}</select><select aria-label="筛选业务需求" value={needFilter} onChange={e=>setNeedFilter(e.target.value)}><option value="">全部业务需求</option>{businessNeeds.map(n=><option key={n}>{n}</option>)}</select></div>
  <div className="library-grid">{visible.map(i=><article className="panel library-card" key={i.id}><div className="row between"><span className="icon-tile green"><UsersRound size={19}/></span><Badge tone={i.status===statuses[0]?'orange':i.status===statuses[1]?'green':'red'}>{i.status}</Badge></div><div className="record-id">{i.id}</div><h2>{i.title}</h2><p>{i.scene}</p><div className="tags">{i.audiences.map(a=><Badge key={a} tone="green">{a}</Badge>)}{i.strategies.map(a=><Badge key={a}>{a}</Badge>)}{i.needs?.map(n=><Badge key={n} tone="blue">{n}</Badge>)}</div><dl><dt>显性痛点</dt><dd>{i.pain||'待补充'}</dd><dt>深层动机</dt><dd>{i.motive||'待补充'}</dd><dt>家庭 / 社交关系</dt><dd>{i.relations||'待补充'}</dd></dl>{feedbackFor(db,i.id)&&<p><Badge tone="blue">实验反馈 · {feedbackFor(db,i.id)}</Badge></p>}<div className="record-meta">置信度 {i.confidence} · {i.source||'待补来源'}</div><div className="card-actions"><button className="button" onClick={()=>setDraft({...i})}><Pencil size={15}/> 查看 / 编辑</button><button className="text-button" onClick={()=>openScript(i.id)}>生成脚本 <ArrowUpRight size={15}/></button></div></article>)}</div>
  {!visible.length&&<Empty>没有符合条件的洞察。</Empty>}
  {draft&&<Modal title={db.insights.some(i=>i.id===draft.id)?'编辑洞察':'新建洞察'} onClose={close} onSave={submit}><p className="muted">洞察 ID · {draft.id}</p><div className="form-grid"><Tags label="策略人群（可多选）" options={strategies} value={draft.strategies} change={v=>setDraft({...draft,strategies:v})}/><Tags label="洞察人群（可多选）" options={audiences} value={draft.audiences} change={v=>setDraft({...draft,audiences:v})}/><Tags label="业务需求（可多选）" options={businessNeeds} value={draft.needs||[]} change={v=>setDraft({...draft,needs:v})}/>{(Object.keys(insightFields) as (keyof typeof insightFields)[]).map(k=><Field key={k} label={insightFields[k]} value={draft[k]} change={v=>setDraft({...draft,[k]:v})} required={k==='title'||k==='scene'} type={k==='date'?'date':'text'} long={['source','counter','decision','motive','barrier','alternatives'].includes(k)} options={k==='confidence'?opts(['A','B','C','D']):k==='status'?opts(statuses):undefined}/>)}</div><p className="muted">A 多来源直接证据 · B 单一直接证据 · C 间接线索 · D 待验证假设</p><h3>实验反馈</h3>{db.experiments.filter(e=>e.insight===draft.id).map(e=><p key={e.id}><Badge>{e.outcome}</Badge> {e.title} · {e.date || '日期未填'} · {e.source} · {e.notes||'暂无结论说明'}</p>)}{!db.experiments.some(e=>e.insight===draft.id)&&<p className="muted">暂无关联实验。</p>}</Modal>}</>
}
const newFact=(productId:string):Fact=>({id:uid(),productId,claim:'',category:'参数',status:'待核验',source:'',date:'',wording:''})
export function FactLibrary({db,update,notify,openScript}:{db:DB;update:Update;notify:(m:string)=>void;openScript:(id:string)=>void}){
  const [draft,setDraft]=useState<Fact|null>(null)
  const [status,setStatus]=useState('')
  const [productId,setProductId]=useState(defaultProduct.id)
  const [productDraft,setProductDraft]=useState<Product|null>(null)
  const products=productsFor(db)
  const product=products.find(item=>item.id===productId)??products[0]
  const facts=productFacts(db,product.id).filter(f=>!status||f.status===status)
  function saveProduct(){
    if(!productDraft)return
    const next={...productDraft,name:productDraft.name.trim(),category:productDraft.category.trim(),url:productDraft.url.trim()}
    if(!next.name||!next.category){notify('请填写产品名称和类目。');return}
    if(next.url&&!/^https?:\/\/[^\s]+$/i.test(next.url)){notify('请输入完整的 HTTP 或 HTTPS 链接。');return}
    if(update(d=>({...d,products:replace(productsFor(d),next)}))){
      setProductId(next.id);setProductDraft(null);notify('产品已保存。')
    }
  }
  function submit(){
    if(!draft)return
    if(!draft.claim.trim()){notify('请填写事实表述。');return}
    if(draft.status==='已核验'&&!verified(draft)){notify('请填写原始证据来源和核验日期。');return}
    if(update(d=>({...d,facts:replace(d.facts,draft)}))){setDraft(null);notify('事实条目已保存。')}
  }
  return <><PageHead label="产品资料" title="产品库" description="为每款产品维护独立的链接、拍摄参考与核验事实。" action="新增产品" onAction={()=>setProductDraft({id:uid(),name:'',category:'',url:'',notes:'',demo:''})}/>
  <Panel title={product.name} action="编辑产品" onAction={()=>setProductDraft({...product})}>
    <Field label="选择产品" value={product.id} options={products.map(item=>({value:item.id,label:item.name}))} change={id=>{setProductId(id);setStatus('')}}/>
    <p><Badge>{product.category}</Badge></p>
    {product.notes&&<p className="notice">{product.notes}</p>}
    {product.demo&&<p className="muted">{product.demo}</p>}
    <div className="inline-buttons">
      <button className="button primary" onClick={()=>openScript(product.id)}>用此产品写脚本</button>
      {product.url&&<a className="button" href={product.url} target="_blank" rel="noreferrer">打开关联链接 <ArrowUpRight size={15}/></a>}
      <button className="button" onClick={()=>setDraft(newFact(product.id))}>新增产品事实</button>
    </div>
  </Panel>
  {productDraft&&<Modal title="产品档案" onClose={()=>setProductDraft(null)} onSave={saveProduct}>
    <div className="form-grid">{(['name','category','url','notes','demo'] as const).map((key,i)=><Field key={key} label={['产品名称','类目','关联链接','资料与待核验备注','可拍摄的使用场景和演示动作'][i]} value={productDraft[key]} change={value=>setProductDraft({...productDraft,[key]:value})} required={i<2} long={i>=3}/>)}</div>
  </Modal>}
  <div className="filters"><select aria-label="核验状态" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option><option>待核验</option><option>已核验</option></select></div><div className="table-wrap"><table><thead><tr><th>产品事实</th><th>分类</th><th>核验状态</th><th>证据来源 / 日期</th><th>可用措辞</th><th>操作</th></tr></thead><tbody>{facts.map(f=><tr key={f.id}><td><b>{f.claim}</b><small>{f.id}</small></td><td>{f.category}</td><td><Badge tone={verified(f)?'green':'orange'}>{f.status}</Badge></td><td>{f.source||'待补充'}<small>{f.date}</small></td><td>{f.wording||'待补充'}</td><td><button className="text-button" onClick={()=>setDraft({...f})}>编辑</button></td></tr>)}</tbody></table>{!facts.length&&<Empty>没有符合条件的事实条目。</Empty>}</div>
  {draft&&<Modal title="产品事实条目" onClose={()=>setDraft(null)} onSave={submit}><div className="form-grid">{(['claim','category','status','source','date','wording'] as const).map((k,index)=><Field key={k} label={['事实表述','分类','核验状态','证据来源与适用条件','核验日期','可用措辞'][index]} value={draft[k]} change={v=>setDraft({...draft,[k]:v})} required={k==='claim'} options={k==='status'?opts(['待核验','已核验']):k==='category'?opts(['参数','权益','实测','其他']):undefined} type={k==='date'?'date':'text'} long={k==='wording'||k==='source'}/>)}</div></Modal>}</>
}
export function Matrix({db,update,notify}:{db:DB;update:Update;notify:(m:string)=>void}){
  const [draft,setDraft]=useState<Match|null>(null)
  const [filter,setFilter]=useState('')
  const rows=db.matches.filter(m=>!filter||m.insight===filter)
  function submit(){
    if(!draft)return
    if(!draft.insight||!draft.fact||!draft.scene.trim()||!draft.pain.trim()||!draft.angle.trim()||!draft.evidence.trim()){notify('请填齐匹配字段。待获取的证据可注明采集方式。');return}
    if(update(d=>({...d,matches:replace(d.matches,draft)}))){setDraft(null);notify('匹配已保存。')}
  }
  return <><PageHead label="场景与卖点" title="洞察匹配矩阵" description="将人群、场景、痛点、卖点与证据绑定到同一条记录。" action="新增匹配" onAction={()=>setDraft({id:uid(),insight:'',fact:'',scene:'',pain:'',angle:'',evidence:''})}/><div className="filters"><select aria-label="筛选洞察" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">全部洞察</option>{db.insights.map(i=><option value={i.id} key={i.id}>{i.title}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>人群 / 洞察</th><th>场景</th><th>痛点</th><th>卖点 / 产品事实</th><th>证据</th><th>操作</th></tr></thead><tbody>{rows.map(m=>{const i=db.insights.find(i=>i.id===m.insight);const f=db.facts.find(f=>f.id===m.fact);return <tr key={m.id}><td><b>{i?.title}</b><small>{i?.audiences.join(' · ')}</small></td><td>{m.scene}</td><td>{m.pain}</td><td>{m.angle}<small>{f?.claim} · {f?.status}</small></td><td>{m.evidence}<small>{f?.source}</small></td><td><button className="text-button" onClick={()=>setDraft({...m})}>编辑</button></td></tr>})}</tbody></table>{!rows.length&&<Empty>暂无匹配。</Empty>}</div>
  {draft&&<Modal title="编辑匹配" onClose={()=>setDraft(null)} onSave={submit}><div className="form-grid"><Field label="人群洞察" required value={draft.insight} change={v=>{const i=db.insights.find(i=>i.id===v);setDraft({...draft,insight:v,scene:i?.scene||'',pain:i?.pain||''})}} options={[...opts(['']),...db.insights.map(i=>({value:i.id,label:i.title}))]}/><Field label="产品事实" required value={draft.fact} change={v=>setDraft({...draft,fact:v})} options={[...opts(['']),...db.facts.map(f=>({value:f.id,label:`${productsFor(db).find(p=>p.id===(f.productId??defaultProduct.id))?.name} · ${f.claim} · ${f.status}`}))]}/>{(['scene','pain','angle','evidence'] as const).map((k,i)=><Field key={k} label={['场景','痛点','卖点表达','证据位置或采集计划'][i]} value={draft[k]} change={v=>setDraft({...draft,[k]:v})} required long={i>=2}/>)}</div></Modal>}</>
}
