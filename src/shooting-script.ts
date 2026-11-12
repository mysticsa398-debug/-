import {studioShot,videoCopy,type StudioShot} from './studio-engine.ts'
import {audit,type Fact,type ScriptBrief,type Shot} from './domain.ts'

export function subtitleFor(shot:Shot|StudioShot):string {
  return 'content' in shot?videoCopy(shot):shot.subtitle ?? shot.line.trim().split(/(?<=[，。！？；：、])\s*/u).join('\n')
}

export function scriptAuditText(shots:(Shot|StudioShot)[]):string {
  return shots.map(studioShot).map(s=>[...new Set([s.content,s.content.includes(videoCopy(s))?'':videoCopy(s)].filter(Boolean))].join('\n')).join('\n\n')
}

export function formatShootingScript(title:string, shots:(Shot|StudioShot)[], brief?:ScriptBrief):string {
  if(!shots.length)return ''
  const intro=[title.trim()||'S8mini 短视频脚本',`${shots.length} 镜 · 预计 ${shots.at(-1)?.time.split('–').at(-1)} · 无需演员`]
  if(brief&&!shots.some(s=>'narration' in s))intro.push(`用户问题：${brief.problem}`)
  const scenes=shots.map(studioShot).map((shot,index)=>[
    `第 ${index+1} 镜｜${shot.time}｜${shot.part}`,
    `拍摄说明：\n${shot.content}`,
    `分镜图片：${shot.imageSource||'未设置'}`,
    ...(shot.analysis?[`结构分析：${shot.analysis}`]:[]),
    `视频文案：\n${videoCopy(shot)}`
  ].join('\n'))
  return [...intro,scenes.join('\n\n')].join('\n')+'\n'
}

export function deliveryFindings(title:string,shots:(Shot|StudioShot)[],facts:Fact[],brief?:ScriptBrief){
  return audit(formatShootingScript(title,shots,brief),facts)
}
export function formatNarration(shots:(Shot|StudioShot)[]){
  return shots.map(studioShot).map(videoCopy).join('\n')
}
