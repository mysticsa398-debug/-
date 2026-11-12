import {HookWorkbench,type ApplyMaterialDraft} from './hook-workbench'
import {videoScriptReport} from './material-structure'
import {mediaLink,VideoReview} from './video-review'
import {reviewFields,segment,stages,type SourceEvidence} from './research'
import {useEffect,useRef,useState,type RefObject} from 'react'
import {Captions, FileVideo, FolderOpen, Upload} from 'lucide-react'
import {analyzeMaterial,compareMaterials,creatorChecks,parseCues,span,timestamp,type Material,type MaterialKind} from './video-analysis'
import {scanVideo,transcribeVideo,recognizeVideoCaptions} from './video-media'
import {listMaterials,removeMaterial,saveMaterial} from './video-storage'
import {Badge,Empty,Field,Panel} from './ui'
const kinds={reference:'参考素材',creator:'达人素材'}
const directory='https://zcnkai478rp3.feishu.cn/docx/Wc8PdZKXroh7Eex0rgzcQBRFnDg'

export default function VideoWorkbench({notify,pickerRef,extract,focus,onApplyDraft}:{notify:(s:string)=>void;pickerRef:RefObject<HTMLInputElement|null>;extract:(source:SourceEvidence)=>void;focus?:SourceEvidence;onApplyDraft:ApplyMaterialDraft}){
  const [mode,setMode]=useState<'video'|'text'>('video')
  const [kind,setKind]=useState<MaterialKind>('reference')
  const [source,setSource]=useState('')
  const [linkTitle,setLinkTitle]=useState('')
  const [linkDuration,setLinkDuration]=useState('')
  const [direct,setDirect]=useState('')
  const [revision,setRevision]=useState(0)
  const [creator,setCreator]=useState('')
  const [notes,setNotes]=useState('')
  const [file,setFile]=useState<File>()
  const [captions,setCaptions]=useState<File>()
  const [recognize,setRecognize]=useState(true)
  const [readScreen,setReadScreen]=useState(true)
  const [previewUrl,setPreviewUrl]=useState('')
  const [previewStatus,setPreviewStatus]=useState<'loading'|'ready'|'error'>('loading')
  const [progress,setProgress]=useState('')
  const [materials,setMaterials]=useState<Awaited<ReturnType<typeof listMaterials>>>([])
  const [selected,setSelected]=useState('')
  const [reference,setReference]=useState('')
  const [creatorVideo,setCreatorVideo]=useState('')
  const [videoUrl,setVideoUrl]=useState('')
  const [error,setError]=useState('')
  const player=useRef<HTMLVideoElement>(null)
  const entry=materials.find(m=>m.report.id===selected)
  const report=entry?.report
  const analysis=report?analyzeMaterial(report):null
  const referenceReport=materials.find(m=>m.report.id===reference)?.report
  const creatorReport=materials.find(m=>m.report.id===creatorVideo)?.report
  const comparison=referenceReport&&creatorReport?compareMaterials(referenceReport,creatorReport):null

  useEffect(()=>{
    let active=true
    listMaterials().then(rows=>{if(active)setMaterials(rows.sort((a,b)=>b.report.date.localeCompare(a.report.date)))})
      .catch(()=>{if(active)setError('本地素材库无法读取，请检查浏览器存储设置。')})
    return ()=>{active=false}
  },[])
  useEffect(()=>{
    if(!file){setPreviewUrl('');return}
    const url=URL.createObjectURL(file)
    setPreviewUrl(url)
    return ()=>URL.revokeObjectURL(url)
  },[file])
  useEffect(()=>{
    if(!entry){setVideoUrl('');return}
    const url=entry.file?URL.createObjectURL(entry.file):mediaLink(entry.report.mediaUrl||'')
    setVideoUrl(url)
    return ()=>{if(entry.file)URL.revokeObjectURL(url)}
  },[entry?.file,entry?.report.id,entry?.report.mediaUrl])
  useEffect(()=>{if(focus){setMode('video');setSelected(focus.material);if(focus.material===selected)seek(focus.segment.start)}},[focus])
  function seek(time:number){
    const video=player.current
    if(video&&video.readyState>0&&Number.isFinite(time)&&time>=0)video.currentTime=time
  }
  async function persist(next:Material,original?:File){
    try{
      await saveMaterial(next,original)
      setMaterials(list=>[{report:next,file:original},...list.filter(m=>m.report.id!==next.id)])
      setSelected(next.id);notify('素材已保存。');return true
    }catch{setError('素材保存失败，请检查浏览器存储空间。');return false}
  }
  async function addLink(){
    setError('')
    const duration=Number(linkDuration)
    if(!linkTitle.trim()||!mediaLink(source.trim())||!Number.isFinite(duration)||duration<=0||(direct.trim()&&!mediaLink(direct.trim()))){
      setError('请填写标题、HTTPS 来源和有效时长。预览直链须为 HTTPS。');return
    }
    await persist({id:crypto.randomUUID(),kind,name:linkTitle.trim(),source:source.trim(),mediaUrl:direct.trim(),creator,notes,
      date:new Date().toISOString(),duration,width:0,height:0,cues:[],scenes:[],transcriptNote:'链接素材：请回看原片后人工录入口播，或导入带时间码的字幕。'})
  }

  async function analyze(){
    if(!file||progress)return
    setError('')
    setProgress('正在读取本地视频')
    try{
      const media=await scanVideo(file,setProgress)
      let cues:Material['cues']=[]
      let transcriptNote='未开启口播识别。'
      if(captions){
        cues=parseCues(await captions.text(),media.duration)
        transcriptNote=cues.length?`口播依据：导入的 ${captions.name}，请对照原片。`:'字幕没有可用时间码，请核对 SRT / VTT 内容。'
      }
      const transcribing=!cues.length&&recognize
      const report:Material={
        ...media,id:crypto.randomUUID(),kind,name:file.name,source:source.trim(),creator:creator.trim(),notes:notes.trim(),
        date:new Date().toISOString(),cues,transcriptNote:transcribing?'原片已保存。可在口播转写完成后查看，或补充带时间码的字幕。':transcriptNote
      }
      await saveMaterial(report,file)
      setMaterials(list=>[{report,file},...list])
      setSelected(report.id)
      setFile(undefined);setCaptions(undefined)
      if(kind==='reference')setReference(report.id);else setCreatorVideo(report.id)
      await recognizeSaved(report,file,transcribing,readScreen)
      notify('视频拆解已完成，原视频与报告已存入素材管理。')
    }catch(e){setError(e instanceof Error?e.message:'分析或保存失败。请检查文件和浏览器空间。')}
    finally{setProgress('')}
  }

  async function recognizeSaved(report:Material,original:File,speech:boolean,screen:boolean){
    async function update(next:Material){
      await saveMaterial(next,original)
      setMaterials(list=>list.map(item=>item.report.id===next.id?{report:next,file:original}:item))
      setRevision(n=>n+1)
    }
    if(speech){
      setProgress('正在准备读取音轨')
      try{
        const cues=await transcribeVideo(original,report.duration,setProgress)
        report={...report,cues:cues.length?cues:report.cues,transcriptNote:cues.length?
          '浏览器自动转写，时间码与文字请对照原片。':
          report.cues.length?report.transcriptNote:'未识别到口播，可补充带时间码的字幕。'}
      }catch(error){
        if(!report.cues.length)report={...report,transcriptNote:error instanceof Error?error.message:'本地口播识别失败。'}
        else setError('本次口播识别失败，已有字幕仍可用于拆解。')
      }
      await update(report)
    }
    if(screen){
      try{
        const screenCues=await recognizeVideoCaptions(original,report.duration,setProgress)
        report={...report,screenCues:screenCues.length?screenCues:report.screenCues,screenNote:screenCues.length?
          '按画面下部采样识别，时间为估算，可能包含画面上的其他文字。':
          report.screenCues?.length?report.screenNote:'未识别到可用的画面字幕。'}
      }catch(error){
        console.warn('Video subtitle recognition failed',error)
        if(!report.screenCues?.length)report={...report,screenNote:'画面字幕识别失败。请检查模型下载或导入 SRT / VTT 字幕。'}
      }
      await update(report)
    }
  }

  async function recognizeCurrent(speech:boolean,screen:boolean){
    if(progress||!entry?.file)return
    setError('')
    setProgress('正在准备识别')
    try{await recognizeSaved(entry.report,entry.file,speech,screen)}
    catch{setError('识别结果保存失败，请检查浏览器存储空间。')}
    finally{setProgress('')}
  }

  async function drop(){
    if(!report||!window.confirm(`从本机素材管理删除「${report.name}」及其分析记录？`))return
    try{
      await removeMaterial(report.id)
      setMaterials(rows=>rows.filter(row=>row.report.id!==report.id));setSelected('')
      if(reference===report.id)setReference('')
      if(creatorVideo===report.id)setCreatorVideo('')
      notify('已删除本机素材。')
    }catch{setError('删除失败，请稍后重试。')}
  }

  async function updateCaptions(subtitle:File){
    if(!entry)return
    try{
      const cues=parseCues(await subtitle.text(),entry.report.duration)
      if(!cues.length)throw Error('字幕没有与视频时长匹配的 SRT / VTT 时间码。')
      const report={...entry.report,cues,transcriptNote:`口播依据：导入的 ${subtitle.name}，请对照原片。`}
      await saveMaterial(report,entry.file)
      setMaterials(list=>list.map(item=>item.report.id===report.id?{report,file:entry.file}:item));setRevision(n=>n+1)
      notify('已更新口播证据和拆解报告。')
    }catch(e){setError(e instanceof Error?e.message:'更新字幕失败。')}
  }

  async function importReport(input:File){
    setError('')
    try{
      const {analysis:discarded,reportSections:discardedSections,...raw}=JSON.parse(await input.text())
      const validTime=(r:{start:number;end:number})=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.start>=0&&r.end>r.start&&r.end<=raw.duration
      if(!['reference','creator'].includes(raw.kind)||!['name','source','creator','notes','date','transcriptNote'].every(k=>typeof raw[k]==='string')||
        !raw.name.trim()||!Number.isFinite(raw.duration)||raw.duration<=0||!Number.isFinite(raw.width)||!Number.isFinite(raw.height)||
        !Array.isArray(raw.cues)||!raw.cues.every((c:Material['cues'][number])=>validTime(c)&&typeof c.text==='string')||
        raw.screenCues!==undefined&&(!Array.isArray(raw.screenCues)||!raw.screenCues.every((c:Material['cues'][number])=>validTime(c)&&typeof c.text==='string'))||
        !Array.isArray(raw.scenes)||!raw.scenes.every((r:Material['scenes'][number])=>validTime(r)&&typeof r.observations==='string')||
        raw.segments!==undefined&&(!Array.isArray(raw.segments)||!raw.segments.every((r:ReturnType<typeof segment>)=>validTime(r)&&stages.some(s=>s===r.stage)&&typeof r.id==='string'&&Object.keys(reviewFields).every(k=>typeof r[k as keyof typeof reviewFields]==='string')))||
        ['brand','context','selling','mediaUrl','screenNote'].some(k=>raw[k]!==undefined&&typeof raw[k]!=='string')||
        raw.audiences!==undefined&&(!Array.isArray(raw.audiences)||raw.audiences.some((a:unknown)=>typeof a!=='string'))){
        throw Error('报告缺少有效素材字段或包含无效时间码。')
      }
      const existing=materials.find(m=>m.report.id===raw.id)
      const id=typeof raw.id==='string'&&raw.id.trim()?raw.id:crypto.randomUUID()
      if(existing&&!window.confirm('用此报告更新同一素材的拆解记录？'))return
      const scenes=raw.scenes.map((r:Material['scenes'][number])=>({...r,frame:existing?.report.scenes.find(s=>s.start===r.start&&s.end===r.end)?.frame||''}))
      if(await persist({...raw,id,scenes},existing?.file))setRevision(n=>n+1)
    }catch(e){setError(e instanceof SyntaxError?'报告不是有效的 JSON。':e instanceof Error?e.message:'报告导入失败。')}
  }

  function exportReport(){
    if(!report)return
    const {scenes,...metadata}=report
    const payload={...metadata,scenes:scenes.map(({frame,...scene})=>scene),reportSections:videoScriptReport(report)}
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}))
    const link=document.createElement('a')
    link.href=url;link.download=report.name+'-拆解.json';link.click()
    window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

  return <section className="video-workbench" aria-label="视频素材与拆解">
    <div className="inline-buttons" aria-label="素材来源">
      <button className={'button '+(mode==='video'?'primary':'')} aria-pressed={mode==='video'} onClick={()=>setMode('video')}>视频与素材管理</button>
      <button className={'button '+(mode==='text'?'primary':'')} aria-pressed={mode==='text'} onClick={()=>setMode('text')}>粘贴参考脚本 / 美的案例</button>
    </div>
    <div hidden={mode!=='text'}><HookWorkbench notify={notify} onApplyDraft={onApplyDraft}/></div>
    <div className={mode==='video'?'stack':undefined} hidden={mode!=='video'}>
    <Panel title="本地视频自动拆解">
      <p className="muted">阶段 1 拆解参考素材，阶段 2 拆解达人现有素材。按实际时长、采样帧变化和可用口播分析。视频保存在当前浏览器。</p>
      <div className="media-upload">
        <div className="media-upload-item">
          <label className="button primary upload">
            <Upload size={16}/> {file?'更换视频':'上传本地视频'}
            <input ref={pickerRef} type="file" aria-label="上传本地视频" accept="video/*,.mp4,.mov,.webm" disabled={!!progress} onChange={e=>{
              const picked=e.target.files?.[0]
              e.target.value=''
              if(!picked)return
              if(file)setCaptions(undefined)
              setMode('video');setPreviewStatus('loading');setFile(picked);setError('')
            }}/>
          </label>
          <span className="media-filename" title={file?.name}>{file?.name||'选择 MP4、MOV 或 WebM'}</span>
        </div>
        <div className="media-upload-item">
          <label className="button upload">
            <Captions size={16}/> {captions?'更换字幕':'添加字幕（选填）'}
            <input type="file" aria-label="添加带时间码字幕" accept=".srt,.vtt" disabled={!!progress} onChange={e=>{
              const picked=e.target.files?.[0]
              e.target.value=''
              if(picked)setCaptions(picked)
            }}/>
          </label>
          <span className="media-filename" title={captions?.name}>{captions?.name||'SRT / VTT，优先用于口播拆解'}</span>
          {captions&&<button className="text-button" disabled={!!progress} onClick={()=>setCaptions(undefined)}>移除字幕</button>}
        </div>
      </div>
      {file&&previewUrl&&<div className="video-report">
        {previewStatus!=='error'&&<video key={previewUrl} controls playsInline preload="metadata" src={previewUrl} aria-label="待拆解视频预览"
          onLoadedMetadata={()=>setPreviewStatus('ready')} onError={()=>setPreviewStatus('error')}/>}
        <p className={previewStatus==='error'?'video-error':'muted'} role={previewStatus==='error'?'alert':'status'}>
          {previewStatus==='loading'?'正在读取视频预览…':previewStatus==='error'?'浏览器无法预览此文件。请换用 H.264 编码的 MP4。':'视频已选中，可以先预览，再点击「自动拆解并存入管理」。'}
        </p>
      </div>}
      <div className="video-form">
        <Field label="素材类型" value={kind} options={[{value:'reference',label:'阶段 1 · 参考爆款素材'},{value:'creator',label:'阶段 2 · 达人现有素材'}]} change={v=>setKind(v as MaterialKind)}/>
        <Field label="参考来源 / 标题 / 链接（选填）" value={source} change={setSource}/>
        <Field label="合作达人及账号风格（选填）" value={creator} change={setCreator}/>
        <Field label="产品、价格带或已知投放背景（选填）" value={notes} change={setNotes}/>
      </div>
      <label className="row muted"><input type="checkbox" checked={recognize} disabled={!!progress} onChange={e=>setRecognize(e.target.checked)}/> 自动识别中文口播（首次需下载模型，音轨在本机处理）</label>
      <label className="row muted"><input type="checkbox" checked={readScreen} disabled={!!progress} onChange={e=>setReadScreen(e.target.checked)}/> 自动识别画面字幕（采样画面下部，支持中文和英文）</label>
      <div className="inline-buttons"><button className="button primary" disabled={!file||previewStatus==='error'||!!progress} onClick={()=>void analyze()}><FileVideo size={17}/> 自动拆解并存入管理</button><span role="status">{progress}</span></div>
      {error&&<p className="video-error" role="alert">{error}</p>}
      <a className="text-button" href={directory} target="_blank" rel="noreferrer">查看抖音大盘分析文档目录</a>
    </Panel>

    <Panel title="通过链接添加素材">
      <p className="muted">来源链接沿用上方填写内容。抖音等平台分享页仅作来源保存，需登录或有播放限制时请在原平台回看。站内预览需要浏览器可播放的 HTTPS 视频文件直链，或本地视频文件。</p>
      <div className="video-form"><Field label="链接素材标题" value={linkTitle} change={setLinkTitle}/><Field label="原片时长（秒）" value={linkDuration} change={setLinkDuration}/><Field label="可播放的 HTTPS 直链（选填）" value={direct} change={setDirect}/></div>
      <button className="button" disabled={!!progress} onClick={()=>void addLink()}>保存链接素材</button>
    </Panel>
    <Panel title="素材管理">
      <label className="button upload">导入拆解报告 JSON<input aria-label="导入拆解报告 JSON" type="file" accept=".json" onChange={e=>{const picked=e.target.files?.[0];e.target.value='';if(picked)void importReport(picked)}}/></label>
      {!materials.length?<Empty>拆解完成后，原视频和报告会出现在这里。</Empty>:<div className="video-manager">
        <div>{materials.map(({report:r})=><button className={'list-button '+(selected===r.id?'active':'')} key={r.id} onClick={()=>setSelected(r.id)}><FolderOpen size={16}/><span>{r.name}<small>{kinds[r.kind]} · {timestamp(r.duration)}</small></span></button>)}</div>
        {focus?.material===selected&&!report&&<p className="muted">本浏览器没有对应原片。可导入同一素材报告，或从规律卡查看证据快照。</p>}
        {report&&<div className="video-report">
          <div className="row between"><h3>{report.name}</h3><div className="row"><button className="button" onClick={exportReport}>导出拆解报告</button><button className="button" disabled={!!progress} onClick={()=>void drop()}>删除素材</button></div></div>
          {videoUrl&&<video ref={player} key={videoUrl} controls preload="metadata" src={videoUrl} onLoadedMetadata={()=>{if(focus?.material===report.id)seek(focus.segment.start)}} onError={()=>setError('该视频无法预览。请核对直链访问权限或使用本地 H.264 MP4。')}/>}
          {mediaLink(report.source)&&<a href={mediaLink(report.source)} target="_blank" rel="noreferrer">打开原始来源</a>}
          <div className="tags"><Badge tone="blue">{kinds[report.kind]}</Badge><Badge>{timestamp(report.duration)} · {report.width} × {report.height}</Badge></div>
          {report.source&&<p className="muted">来源 · {report.source}</p>}
          {report.notes&&<p className="muted">背景 · {report.notes}</p>}
          <p className="muted">{report.transcriptNote}</p>
          <label className="field"><span>补充或替换校对后的字幕</span><input type="file" accept=".srt,.vtt" disabled={!!progress} onChange={e=>{const subtitle=e.target.files?.[0];e.target.value='';if(subtitle)void updateCaptions(subtitle)}}/></label>
          {entry?.file&&<div className="inline-buttons">
            <button className="button" disabled={!!progress} onClick={()=>void recognizeCurrent(true,false)}>识别口播并更新结构</button>
            <button className="button" disabled={!!progress} onClick={()=>void recognizeCurrent(false,true)}>识别画面字幕</button>
          </div>}
          <HookWorkbench key={'report-'+report.id+revision} notify={notify} onApplyDraft={onApplyDraft} material={report} seek={seek}/>
          <VideoReview key={'review-'+report.id+revision} report={report} save={next=>progress?Promise.resolve(false):persist(next,entry?.file)} seek={seek} extract={extract}/>
          {analysis&&analysis.rows.length>0&&<details className="review-panel"><summary>采样关键帧与诊断依据</summary>
            <h3>采样候选镜头</h3><p className="muted">帧差与口播关键词线索，需人工复核画面含义。</p>
            <div className="table-wrap"><table className="video-shots"><thead><tr>{['时间点','画面与口播','目标人群 / 需求','内容作用','观察证据','可借鉴机制'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{analysis.rows.map(r=><tr key={r.start}><td><button className="text-button" title="跳到原视频时间点" onClick={()=>{seek(r.start)}}>{span(r.start,r.end)}</button></td><td>{r.frame&&<img src={r.frame} alt={`${timestamp(r.start)} 采样关键帧`}/>}<p>{r.text||'该段暂无可用口播'}</p></td><td>{r.audience}</td><td>{r.position}{r.found.length?' · '+r.found.join('、'):' · 待复核'}</td><td>{r.observations}{r.evidence?'；'+r.evidence:''}</td><td>{r.mechanism} <button className="text-button" disabled={!!progress} onClick={()=>{const row={...segment(r.start,r.end,r.start<3?'注意':'兴趣'),speech:r.text};void persist({...report,segments:[...(report.segments||[]),row]},entry?.file).then(ok=>{if(ok)setRevision(n=>n+1)})}}>添加为待复核段</button></td></tr>)}</tbody></table></div>
            {report.kind==='creator'&&<><h3>达人素材检查</h3><dl className="decision-grid">{creatorChecks.map((name,i)=><div className="video-dl-row" key={name}><dt>{name}</dt><dd>{analysis.checks[i]}</dd></div>)}</dl></>}
          </details>}
        </div>}
      </div>}
    </Panel>

    <Panel title="阶段 3 · 带货 8 维对标诊断">
      <div className="video-form">{([['reference',reference,setReference],['creator',creatorVideo,setCreatorVideo]] as const).map(([type,id,choose])=><Field key={type} label={kinds[type]} value={id} change={choose} options={[{value:'',label:`选择${kinds[type]}`},...materials.filter(m=>m.report.kind===type).map(m=>({value:m.report.id,label:m.report.name}))]}/>)}</div>
      {comparison?<div className="table-wrap"><table className="video-shots"><thead><tr>{['对标维度','参考素材证据','达人素材证据','差异检查与下一步'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{comparison.map(row=><tr key={row.dimension}><td><b>{row.dimension}</b></td><td>{row.reference}</td><td>{row.creator}</td><td><b>{row.difference}</b><p>{row.action}</p></td></tr>)}</tbody></table></div>:<p className="muted">各选择一条已保存素材，生成证据对照与核对建议。</p>}
    </Panel>
    </div>
  </section>
}
