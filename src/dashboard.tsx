import {ArrowRight, ArrowUpRight, BookOpen, Clapperboard, FlaskConical, FolderOpen, Lightbulb, ShieldCheck, Sparkles, UsersRound} from 'lucide-react'
import {verified,type DB} from './domain'
import {Badge,Panel} from './ui'

export type Page = 'creative'|'overview'|'insights'|'facts'|'matrix'|'scripts'|'audit'|'experiments'|'data'
export default function Dashboard({db,go,add,openVideo,openSaved,openAgent}:{db:DB;go:(p:Page)=>void;add:()=>void;openVideo:()=>void;openSaved:(id:string)=>void;openAgent:()=>void}){
  const verifiedCount=db.facts.filter(verified).length
  const versionCount=db.scripts.reduce((sum,script)=>sum+script.versions.filter(v=>v.date).length,0)
  const latestScripts=db.scripts.filter(s=>s.versions.some(v=>v.date)).flatMap(script=>script.versions.slice(0,1).map(version=>({script,version})))
    .sort((a,b)=>b.version.date.localeCompare(a.version.date)).slice(0,4)
  const quick=[
    {title:'素材拆解',description:'导入视频，识别口播与字幕',icon:FolderOpen,action:openVideo},
    {title:'脚本智能体',description:'选人群、核对投放结构、策划与写稿',icon:Sparkles,action:openAgent},
    {title:'合规审核',description:'核对产品表述和证据',icon:ShieldCheck,action:()=>go('audit')},
    {title:'投放复盘',description:'关联报表，比较素材 A/B',icon:FlaskConical,action:()=>go('experiments')}
  ]
  return <>
    <section className="team-hero">
      <div className="team-hero-copy">
        <h1>吹风机内容组工作台</h1>
        <p>拆解带货素材，产出可拍摄的脚本，用投放数据复盘创意。</p>
        <div className="overview-actions"><button className="button primary" onClick={openAgent}><Sparkles size={17}/> 启动脚本智能体</button><button className="button" onClick={openVideo}>打开素材拆解</button></div>
        <button className="overview-evidence" onClick={()=>go('facts')}>{verifiedCount} 项产品事实已核验{verifiedCount?' · 查看证据':' · 可先生成实拍草稿'} <ArrowRight size={14}/></button>
      </div>
      <div className="team-hero-counts">
        <button onClick={()=>go('scripts')}><strong>{versionCount}</strong><span>脚本版本</span></button>
        <button onClick={()=>go('insights')}><strong>{db.insights.length}</strong><span>人群洞察</span></button>
        <button onClick={()=>go('experiments')}><strong>{db.experiments.length}</strong><span>投放记录</span></button>
      </div>
    </section>
    <section aria-label="内容生产入口" className="team-quick">{quick.map(({title,description,icon:Icon,action})=><button key={title} className="team-task" onClick={action}><div className="team-task-top"><span><Icon size={21}/></span><ArrowUpRight size={17}/></div><b>{title}</b><small>{description}</small></button>)}</section>
    <div className="team-overview-grid">
      <Panel title="最近保存的脚本" action="查看脚本工作台" onAction={()=>go('scripts')}>
        <div className="dashboard-list">{latestScripts.map(({script,version})=><button key={script.id} onClick={()=>openSaved(script.id)}><span className="icon-tile violet"><Clapperboard size={16}/></span><span><b>{version.title||script.title}</b><small>{version.variant} · {script.versions.length} 个版本</small></span><ArrowRight size={15}/></button>)}{!latestScripts.length&&<p className="muted">暂无已保存脚本。</p>}</div>
      </Panel>
      <div className="stack">
        <Panel title="近期人群洞察" action="新建洞察" onAction={add}>
          <div className="dashboard-list">{db.insights.slice(0,3).map(i=><button key={i.id} onClick={()=>go('insights')}><span className="icon-tile green"><Lightbulb size={16}/></span><span><b>{i.title}</b><small>{i.scene||i.id}</small></span><Badge tone={i.status==='假设 / 待验证'?'orange':'green'}>{i.status}</Badge></button>)}{!db.insights.length&&<p className="muted">暂无洞察。</p>}</div>
        </Panel>
        <button className="team-facts" onClick={()=>go('facts')}><span className="icon-tile blue"><BookOpen size={18}/></span><span><b>产品库</b><small>{db.facts.filter(verified).length} / {db.facts.length} 项已核验</small></span><ArrowRight size={16}/></button>
      </div>
    </div>
  </>
}
