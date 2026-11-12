import {videoCopy} from './studio-engine'
import {useEffect,useRef,useState} from 'react'
import {ImagePlus,ChevronLeft,ChevronRight} from 'lucide-react'
import type {StudioShot} from './studio-engine'
import {listMaterials} from './video-storage'
import type {Scene} from './video-analysis'
import {stages} from './material-structure'

export const structureSource='https://icn140f9sykv.feishu.cn/wiki/BFupwmVWqiOqUAkohmoclJ4xnoe'
export function salesAnalysis(shot:StudioShot,index:number){
  const part=shot.part
  if(index===0||/钩子/.test(part))return {task:'注意 · 前三秒留人',question:'为什么我要停下来？',why:'用一个具体场景、反差或利益缺口点名需求；第一句只承担一个留人任务。',proof:'画面第一眼应能看懂问题；价格与福利钩子需要真实活动依据。',next:'下一段接具体顾虑，让观众知道这与自己有什么关系。'}
  if(/冲突|需求/.test(part))return {task:'兴趣 · 放大购买顾虑',question:'这是不是我遇到的问题？',why:'把人群标签转成实际任务与取舍，例如箱内空间和回家共用，让犹豫具体可见。',proof:'用真实场景支撑痛点，不编造用户经历或夸大焦虑。',next:'用产品的一项能力回应刚才的冲突。'}
  if(/成交|行动/.test(part))return {task:'行动 · 承接商品卡',question:'我下一步该看什么？',why:'回扣本片需求，给出一个明确动作；让商品卡型号、利益点与视频保持一致。',proof:'价格、赠品、退换和质保按当前真实条款表述。',next:'承接到对应 SKU，避免转向无关卖点。'}
  if(/举证|证据|信任/.test(part))return {task:'信任 · 消除疑虑',question:'凭什么相信这个利益？',why:'让连续演示、同条件对照或真实售后依据支撑前段主张；口播承诺本身不等于证据。',proof:'保留原片、档位、距离、发量等条件；图片仅作为拍摄参考。',next:'总结适用场景，再给出自然的购买动作。'}
  const stage=stages.find(s=>s.name===part)||stages.find(s=>s.test.test(shot.subtitle))
  return {task:'欲望 · 卖点转为利益',question:'这台产品能为我解决什么？',why:stage?.why||'把一项产品能力与具体任务连接，用操作及结果呈现利益，避免堆叠参数。',proof:stage?.proof||'使用当前型号实拍与已核验产品事实，参数不能直接证明效果。',next:'紧接能证明本段利益的画面，再推进到信任和行动。'}
}
async function imageData(file:File){
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>15*1024*1024)throw Error('请选择 15 MB 以内的 JPG、PNG 或 WebP 图片。')
  const bitmap=await createImageBitmap(file)
  try{
    const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height))
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
    canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height)
    return canvas.toDataURL('image/jpeg',.75)
  }finally{bitmap.close()}
}
export function StoryboardEditor({shots,onChange,material,audience,problem,disabled,notify}:{shots:StudioShot[];onChange:(s:StudioShot[])=>void;material:string;audience:string;problem:string;disabled:boolean;notify:(s:string)=>void}){
 const [active,setActive]=useState(0),[frames,setFrames]=useState<Scene[]>([]),[picker,setPicker]=useState(false),[loading,setLoading]=useState(false)
 const upload=useRef<HTMLInputElement>(null)
 const latest=useRef(shots);latest.current=shots
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 useEffect(()=>{let cancelled=false;setFrames([]);setPicker(false);if(material)listMaterials().then(items=>{if(!cancelled)setFrames(items.find(m=>m.report.id===material)?.report.scenes||[])}).catch(()=>{if(!cancelled)notify('关联素材读取失败，请重新选择或上传图片。')});return()=>{cancelled=true}},[material])
 const index=Math.min(active,shots.length-1),shot=shots[index]
 if(!shot)return null
 const analysis=salesAnalysis(shot,index)
 function patch(value:Partial<StudioShot>,at=index){onChange(latest.current.map((s,i)=>{if(i!==at)return s;const content=s.narration===undefined&&value.subtitle!==undefined&&s.content.endsWith('\n'+s.subtitle)?s.content.slice(0,-s.subtitle.length)+value.subtitle:s.content;return {...s,content,...value}}))}
 async function choose(file:File){const at=index;setLoading(true);try{const image=await imageData(file);if(alive.current)patch({image,imageSource:'上传图片 · '+file.name},at)}catch(e){if(alive.current)notify(e instanceof Error?e.message:'图片读取失败。')}finally{if(alive.current)setLoading(false)}}
 return <div className="storyboard-shell">
  <div className="storyboard-top"><div><b>逐段编排 · {shots.length} 个结构</b></div><a href={structureSource} target="_blank" rel="noreferrer">素材结构依据 ↗</a></div>
  <div className="storyboard-layout">
   <nav className="storyboard-nav" aria-label="分镜结构导航">{shots.map((s,i)=><button type="button" key={i} aria-pressed={index===i} className={index===i?'selected':''} onClick={()=>{setActive(i);setPicker(false)}}><span className="shot-number">{String(i+1).padStart(2,'0')}</span><span><b>{s.part}</b><small>{s.time}</small></span><span aria-label={s.image?'已有图片':'待配图'} className={s.image?'image-dot ready':'image-dot'}/></button>)}</nav>
   <fieldset className="storyboard-detail" disabled={disabled||loading}>
    <div className="storyboard-heading"><b>{String(index+1).padStart(2,'0')} / {shots.length} · {analysis.task}</b><div><button type="button" aria-label="上一镜" disabled={index===0} onClick={()=>setActive(index-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="下一镜" disabled={index===shots.length-1} onClick={()=>setActive(index+1)}><ChevronRight size={18}/></button></div></div>
    <div className="storyboard-columns">
     <div className="storyboard-visual"><div className="storyboard-frame">{shot.image?<img src={shot.image} alt={`第 ${index+1} 镜参考图片`}/>:<div className="storyboard-empty"><ImagePlus size={30}/><b>为这一镜添加画面</b><span>上传参考图，或选择关联视频截帧</span></div>}</div><small>{shot.imageSource||'尚未配图 · 不使用虚构的原片截图'}</small><div className="inline-buttons"><button type="button" className="button" onClick={()=>upload.current?.click()}>{loading?'处理图片…':shot.image?'替换图片':'上传图片'}</button><button type="button" className="button" disabled={!frames.length} onClick={()=>setPicker(!picker)}>选择视频截帧</button>{shot.image&&<button type="button" className="text-button" onClick={()=>patch({image:undefined,imageSource:undefined})}>移除</button>}</div><input ref={upload} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传分镜图片" onChange={e=>{const f=e.target.files?.[0];if(f)void choose(f);e.target.value=''}}/>{!frames.length&&<small>关联已拆解视频后可选择真实截帧。</small>}
      {picker&&<div className="storyboard-frames" aria-label="视频截帧选择">{frames.filter(f=>f.frame).map((f,i)=><button type="button" key={i} onClick={()=>{patch({image:f.frame,imageSource:`参考素材 ${material} · ${f.start.toFixed(1)} 秒`});setPicker(false)}}><img src={f.frame} alt={`${f.start.toFixed(1)} 秒截帧`}/><span>{f.start.toFixed(1)} 秒</span></button>)}</div>}
     </div>
     <div className="storyboard-copy"><div className="storyboard-meta"><label>时间<input aria-label="当前分镜时间" value={shot.time} onChange={e=>patch({time:e.target.value})}/></label><label>结构作用<input aria-label="当前分镜结构" value={shot.part} onChange={e=>patch({part:e.target.value})}/></label></div><label className="storyboard-script">视频文案<textarea aria-label={`第 ${index+1} 镜 视频文案`} value={videoCopy(shot)} onChange={e=>patch({subtitle:e.target.value,narration:undefined})}/></label>
      <details className="storyboard-analysis"><summary>这段如何推动购买</summary><p><strong>人群切口</strong>{audience} · {problem}</p><p><strong>用户心里的问题</strong>{analysis.question}</p><p><strong>说服任务</strong>{analysis.why}</p><p><strong>画面与信任依据</strong>{analysis.proof}</p><p><strong>下一段衔接</strong>{analysis.next}</p><small>规则辅助判断，需结合实际脚本与画面复核。</small></details>
      <details><summary>编辑分析与拍摄说明</summary><label>本段分析备注<textarea aria-label={`第 ${index+1} 镜 结构分析备注`} value={shot.analysis||''} onChange={e=>patch({analysis:e.target.value})}/></label><label>拍摄说明<textarea aria-label={`第 ${index+1} 镜 拍摄说明`} value={shot.content} onChange={e=>patch({content:e.target.value})}/></label></details>
     </div>
    </div>
   </fieldset>
  </div>
 </div>
}
