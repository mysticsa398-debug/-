/// <reference types="vite/client" />
import ocrWorkerUrl from 'tesseract.js/dist/worker.min.js?url'
import type {Scene,TranscriptCue} from './video-analysis.ts'
function waitEvent(element:HTMLVideoElement,name:string,start:()=>void){
  return new Promise<void>((resolve,reject)=>{
    const end=(error?:Error)=>{
      clearTimeout(timer)
      element.removeEventListener(name,success)
      element.removeEventListener('error',failure)
      if(error)reject(error);else resolve()
    }
    const success=()=>end()
    const failure=()=>end(Error('浏览器无法读取该视频，请尝试 H.264 编码的 MP4。'))
    const timer=window.setTimeout(()=>end(Error('视频解码超时。')),12000)
    element.addEventListener(name,success)
    element.addEventListener('error',failure)
    start()
  })
}
export async function scanVideo(file:File,progress:(p:string)=>void){
  const video=document.createElement('video')
  const url=URL.createObjectURL(file)
  video.muted=true;video.playsInline=true;video.preload='auto'
  try{
    await waitEvent(video,'loadeddata',()=>{video.src=url})
    const {duration,videoWidth:width,videoHeight:height}=video
    if(!Number.isFinite(duration)||duration<=0||!width||!height)throw Error('视频缺少可读取的时长或尺寸。')
    const tiny=document.createElement('canvas')
    tiny.width=24;tiny.height=16
    const small=tiny.getContext('2d',{willReadFrequently:true})!
    const thumbnail=document.createElement('canvas')
    thumbnail.width=200;thumbnail.height=Math.max(1,Math.min(360,Math.round(height*200/width)))
    const preview=thumbnail.getContext('2d')!
    const scenes:Scene[]=[]
    const step=Math.max(.5,duration/480)
    let previous:Uint8ClampedArray|undefined, priorLuma=0, maxMotion=0
    for(let sample=0;sample<Math.ceil(duration/step);sample++){
      const time=sample*step
      if(sample>0)await waitEvent(video,'seeked',()=>{video.currentTime=time})
      small.drawImage(video,0,0,tiny.width,tiny.height)
      const data=small.getImageData(0,0,tiny.width,tiny.height).data
      let diff=0,luma=0
      for(let i=0;i<data.length;i+=4){
        luma+=(data[i]+data[i+1]+data[i+2])/3
        if(previous)diff+=(Math.abs(data[i]-previous[i])+Math.abs(data[i+1]-previous[i+1])+Math.abs(data[i+2]-previous[i+2]))/3
      }
      luma/=data.length/4
      diff/=data.length/4
      maxMotion=Math.max(maxMotion,diff)
      const last=scenes.at(-1)
      if(!last||((diff>34||Math.abs(luma-priorLuma)>45)&&time-last.start>=Math.min(1,step*2)&&scenes.length<75)){
        if(last){last.end=time;last.observations+=`；段内采样帧最大像素差 ${Math.round(maxMotion)} / 255`}
        preview.drawImage(video,0,0,thumbnail.width,thumbnail.height)
        scenes.push({start:time,end:duration,frame:thumbnail.toDataURL('image/jpeg',.65),observations:`取帧 ${time.toFixed(1)} 秒，画面平均亮度 ${Math.round(luma)} / 255${last?`；检测到帧变化 ${Math.round(diff)} / 255`:''}`})
        maxMotion=0
      }
      previous=data;priorLuma=luma
      if(sample%8===0)progress(`正在采样镜头 ${Math.round(time/duration*100)}%`)
    }
    return {duration,width,height,scenes}
  }finally{
    video.removeAttribute('src');video.load();URL.revokeObjectURL(url)
  }
}

async function readPlayingAudio(file:File,duration:number,context:AudioContext,progress:(p:string)=>void){
  const video=document.createElement('video')
  video.playsInline=true
  const url=URL.createObjectURL(file)
  const source=context.createMediaElementSource(video)
  const processor=context.createScriptProcessor(4096,1,1)
  const silent=context.createGain()
  silent.gain.value=0
  const pcm=new Float32Array(Math.ceil(duration*context.sampleRate))
  let offset=0
  try{
    source.connect(processor).connect(silent).connect(context.destination)
    await waitEvent(video,'loadeddata',()=>{video.src=url})
    if(context.state!=='running'){
      let timer:number|undefined
      try{await Promise.race([context.resume(),new Promise<never>((_,reject)=>{
        timer=window.setTimeout(()=>reject(Error('浏览器阻止了音轨读取，请重试或导入字幕。')),5000)
      })])}finally{clearTimeout(timer)}
    }
    await new Promise<void>((resolve,reject)=>{
      const finish=(error?:Error)=>{
        clearTimeout(timer)
        video.onended=null
        video.onerror=null
        processor.onaudioprocess=null
        if(error)reject(error);else resolve()
      }
      const timer=window.setTimeout(()=>finish(Error('读取视频音轨超时。')),duration*1000+15000)
      processor.onaudioprocess=e=>{
        if(video.paused||video.ended)return
        const samples=e.inputBuffer.getChannelData(0).subarray(0,pcm.length-offset)
        pcm.set(samples,offset)
        offset+=samples.length
        progress(`正在读取视频音轨 ${Math.min(100,Math.round(video.currentTime/duration*100))}%`)
      }
      video.onended=()=>finish()
      video.onerror=()=>finish(Error('视频音轨读取失败。'))
      video.play().catch(()=>finish(Error('浏览器无法播放音轨，请重试或导入字幕。')))
    })
    return pcm.subarray(0,offset)
  }finally{
    video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url)
    source.disconnect();processor.disconnect();silent.disconnect()
  }
}

export async function transcribeVideo(file:File,duration:number,progress:(p:string)=>void):Promise<TranscriptCue[]>{
  if(duration>600)throw Error('超过 10 分钟，请导入带时间码的字幕。')
  const context=new AudioContext({sampleRate:16000})
  let mono:Float32Array
  try{
    let audio:AudioBuffer|undefined
    if(file.size<=64*1024*1024){
      try{audio=await context.decodeAudioData(await file.arrayBuffer())}catch{/* 容器可播放但无法直接解码时读取播放音轨。 */}
    }
    if(audio){
      mono=new Float32Array(audio.length)
      for(let channel=0;channel<audio.numberOfChannels;channel++){
        const data=audio.getChannelData(channel)
        for(let i=0;i<data.length;i++)mono[i]+=data[i]/audio.numberOfChannels
      }
    }else mono=await readPlayingAudio(file,duration,context,progress)
  }finally{await context.close()}
  if(!mono.some(sample=>Math.abs(sample)>.001))return []
  progress('正在准备本地识别模型，首次使用需下载。')
  const {pipeline,env}=await import('@huggingface/transformers')
  const model='onnx-community/whisper-tiny'
  const originalHost=env.remoteHost,originalPath=env.remotePathTemplate
  async function loadModel(){
    try{
      env.remoteHost='https://www.modelscope.cn/models/'
      env.remotePathTemplate='{model}/resolve/master/'
      return await pipeline('automatic-speech-recognition',model,{device:'wasm',dtype:'q8'})
    }catch{
      env.remoteHost=originalHost;env.remotePathTemplate=originalPath
      try{return await pipeline('automatic-speech-recognition',model,{device:'wasm',dtype:'q8'})}
      catch{throw Error('口播模型下载失败。请检查网络后重试，或导入 SRT / VTT 字幕。')}
    }finally{env.remoteHost=originalHost;env.remotePathTemplate=originalPath}
  }
  const recognizer=await loadModel()
  try{
    progress('正在本地识别音轨')
    const response=await recognizer(mono,{language:'chinese',task:'transcribe',return_timestamps:true,chunk_length_s:25,stride_length_s:4})
    const result=Array.isArray(response)?response[0]:response
    return (result.chunks||[]).map(c=>({start:c.timestamp[0],end:Math.min(duration,c.timestamp[1]??duration),text:c.text.trim()}))
      .filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start&&c.text)
  }finally{await recognizer.dispose()}
}

export async function recognizeVideoCaptions(file:File,duration:number,progress:(p:string)=>void):Promise<TranscriptCue[]>{
  const {createWorker,PSM}=await import('tesseract.js')
  const video=document.createElement('video')
  const url=URL.createObjectURL(file)
  video.muted=true
  video.preload='auto'
  let worker:Awaited<ReturnType<typeof createWorker>>|undefined
  try{
    await waitEvent(video,'loadeddata',()=>{video.src=url})
    progress('正在准备中文字幕识别模型，首次需下载。')
    worker=await createWorker(['chi_sim','eng'],1,{workerPath:ocrWorkerUrl})
    await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT})
    const canvas=document.createElement('canvas')
    const crop=Math.floor(video.videoHeight*.45)
    canvas.width=Math.min(video.videoWidth,1280)
    canvas.height=Math.max(1,Math.round((video.videoHeight-crop)*canvas.width/video.videoWidth))
    const context=canvas.getContext('2d')
    if(!context)throw Error('浏览器无法读取画面字幕。')
    const interval=Math.max(1,duration/60)
    const cues:TranscriptCue[]=[]
    for(let index=0;index<Math.ceil(duration/interval);index++){
      const start=index*interval
      const end=Math.min(duration,start+interval)
      const sample=(start+end)/2
      await waitEvent(video,'seeked',()=>{video.currentTime=sample})
      context.drawImage(video,0,crop,video.videoWidth,video.videoHeight-crop,0,0,canvas.width,canvas.height)
      const {data}=await worker.recognize(canvas)
      const content=data.text.replace(/(?<=[\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu,'').trim()
      if(data.confidence>=55&&content.length>=2&&/[\p{L}\p{N}]/u.test(content)){
        const previous=cues.at(-1)
        if(previous&&previous.text===content&&Math.abs(previous.end-start)<.001)previous.end=end
        else cues.push({start,end,text:content})
      }
      progress(`正在采样识别画面字幕 ${Math.round(end/duration*100)}%`)
    }
    return cues
  }finally{
    video.removeAttribute('src');video.load();URL.revokeObjectURL(url)
    await worker?.terminate()
  }
}
