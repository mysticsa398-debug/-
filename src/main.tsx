import {defaultProduct} from './products'
import {useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {BookOpen, ChevronRight, Clapperboard, Database, FlaskConical, GitMerge, LayoutDashboard, Menu, ShieldCheck, UsersRound, Sparkles, Wind, X} from 'lucide-react'
import CreativeLab from './creative'
import Dashboard,{type Page} from './dashboard'
import {FactLibrary,InsightLibrary,Matrix,type Update} from './library'
import {Compliance,ScriptStudio} from './scripts'
import {DataSettings,Experiments} from './operations'
import {initial,type DB} from './domain'
import {load,save} from './storage'
import {NoticeContext} from './ui'
import './style.css'
import './workspace-design.css'
const navigationGroups=[
  {label:'工作台',items:[{page:'overview',label:'工作概览',icon:LayoutDashboard}]},
  {label:'内容制作',items:[
    {page:'scripts',label:'脚本工作台',icon:Clapperboard},
    {page:'creative',label:'爆款策略实验室',icon:Sparkles},
    {page:'audit',label:'合规审核',icon:ShieldCheck},
    {page:'experiments',label:'实验复盘',icon:FlaskConical}
  ]},
  {label:'研究资料',items:[
    {page:'insights',label:'人群洞察库',icon:UsersRound},
    {page:'facts',label:'产品库',icon:BookOpen},
    {page:'matrix',label:'洞察匹配矩阵',icon:GitMerge}
  ]}
] as const
const navigation=[...navigationGroups.flatMap(g=>[...g.items]),{page:'data',label:'数据与设置',icon:Database}] as const
function hashTab(){return location.hash==='#scripts/video'?'video' as const:location.hash==='#scripts/agent'?'agent' as const:'script' as const}
function hashPage():Page{
  const hash=location.hash.slice(1).split('/')[0]
  return navigation.find(n=>n.page===hash)?.page||'overview'
}
const blankReview={script:'',version:'',input:'',productId:defaultProduct.id}
function App(){
  const [starting]=useState(()=>{try{return {db:load(),error:''}}catch{return {db:initial(),error:'浏览器数据无法读取。可在数据与设置中恢复备份。'}}})
  const [db,setDb]=useState(starting.db)
  const current=useRef(db)
  const [page,setPage]=useState<Page>(hashPage)
  const [scriptTab,setScriptTab]=useState(()=>({view:hashTab()}))
  const [menu,setMenu]=useState(false)
  const [add,setAdd]=useState(false)
  const [insight,setInsight]=useState('')
  const [script,setScript]=useState('')
  const [product,setProduct]=useState('')
  const [source,setSource]=useState('')
  const [review,setReview]=useState(blankReview)
  const [toast,setToast]=useState(starting.error)
  const timer=useRef<number|undefined>(undefined)
  const notify=(msg:string)=>{setToast(msg);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setToast(''),6500)}
  const update:Update=recipe=>{
    const next=recipe(current.current)
    try{save(next)}catch{notify('浏览器无法保存数据，请检查存储空间或站点设置。');return false}
    current.current=next;setDb(next);return true
  }
  useEffect(()=>{
    const change=()=>{setPage(hashPage());setScriptTab({view:hashTab()});setMenu(false);window.scrollTo(0,0)}
    addEventListener('hashchange',change)
    return ()=>{removeEventListener('hashchange',change);window.clearTimeout(timer.current)}
  },[])
  function go(p:Page,tab:'script'|'video'|'agent'='script'){
    setAdd(false);setInsight('');setScript('');setReview(blankReview);setSource('');setProduct('');setMenu(false);setPage(p);setScriptTab({view:tab})
    const target=p==='scripts'&&tab!=='script'?'scripts/'+tab:p
    if(location.hash!=='#'+target)location.hash=target
    window.scrollTo(0,0)
  }
  const addInsight=()=>{go('insights');setAdd(true)}
  const openScript=(id:string)=>{go('scripts');setInsight(id)}
  const openAudit=(script:string,version:string,input:string,productId:string)=>{go('audit');setReview({script,version,input,productId})}
  const views={
    overview:<Dashboard db={db} go={go} openSaved={id=>{go('scripts');setScript(id)}} openVideo={()=>go('scripts','video')} openAgent={()=>go('scripts','agent')} add={addInsight}/>,
    insights:<InsightLibrary db={db} update={update} adding={add} stopAdd={()=>setAdd(false)} openScript={openScript} notify={notify}/>,
    facts:<FactLibrary db={db} update={update} notify={notify} openScript={id=>{go('scripts');setProduct(id)}}/>,
    matrix:<Matrix db={db} update={update} notify={notify}/>,
    creative:<CreativeLab db={db} openPlanning={(id,structure)=>{go('scripts','agent');setInsight(id);setSource(structure)}}/>,
    scripts:<ScriptStudio requestedTab={scriptTab} initialScript={script} initialProduct={product} initialSource={source} db={db} update={update} initialInsight={insight} goAudit={openAudit} notify={notify}/>,
    audit:<Compliance db={db} update={update} prefill={review} notify={notify}/>,
    experiments:<Experiments db={db} update={update} notify={notify}/>,
    data:<DataSettings db={db} update={update} notify={notify}/>
  }
  return <div className="app">
    {menu&&<button className="overlay" onClick={()=>setMenu(false)} aria-label="关闭导航"/>}
    <aside className={'sidebar '+(menu?'show':'')}>
      <button className="brand" onClick={()=>go('overview')}><span className="brand-icon"><Wind size={23}/></span><b>吹风机内容组<br/>工作台</b></button>
      <nav aria-label="工作区导航">
        {navigationGroups.map(group=><div className="nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map(({page:p,label,icon:Icon})=><a key={p} href={'#'+p} onClick={e=>{e.preventDefault();go(p)}} className={page===p?'active':''} aria-current={page===p?'page':undefined}><Icon size={17}/><span>{label}</span></a>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom"><a className="workspace-settings" href="#data" aria-current={page==='data'?'page':undefined} onClick={e=>{e.preventDefault();go('data')}}><Database size={16}/><span>数据与设置</span></a></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="打开导航" onClick={()=>setMenu(true)}><Menu size={22}/></button><span>吹风机内容组工作台</span><ChevronRight size={14}/><b>{navigation.find(n=>n.page===page)?.label}</b></div><span className="workspace-local">本地工作区</span></header>
      <main className="content" key={page}><NoticeContext.Provider value={toast}>{views[page]}</NoticeContext.Provider></main>
    </div>
    {toast&&<div className="toast" role="status">{toast}<button className="icon-button" aria-label="关闭提示" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </div>
}
createRoot(document.getElementById('root')!).render(<App/>)
