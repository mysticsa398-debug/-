import test from 'node:test'
import assert from 'node:assert/strict'
import {studioShot} from '../src/studio-engine.ts'
import {audit,initial} from '../src/domain.ts'
import {formatShootingScript,scriptAuditText,subtitleFor} from '../src/shooting-script.ts'
import {decode,encode} from '../src/storage.ts'

test('full shooting script aligns visuals, narration and subtitles and reviews custom captions',()=>{
  const db=initial()
  const version=db.scripts[0].versions[0]
  const script=formatShootingScript(db.scripts[0].title,version.shots)
  for(const shot of version.shots.map(studioShot)){
    assert.ok(script.includes(shot.time))
    assert.ok(script.includes('拍摄说明：\n'+shot.content))
    assert.ok(script.includes('视频文案：\n'+subtitleFor(shot)))
    assert.doesNotMatch(script,/画外音：|产品\/道具画面/)
  }
  version.shots[0]={...version.shots[0],subtitle:'30秒吹干'}
  assert.ok(audit(scriptAuditText(version.shots),db.facts).some(f=>f.term==='30秒吹干'))
  assert.deepEqual(decode(encode(db,true),true),db)
})

test('legacy voice and screen text render as a single video copy field',()=>{
 const output=formatShootingScript('旧稿',[{time:'0–3 秒',part:'开场',content:'镜前近景',narration:'早起吹发，时间紧。',subtitle:'旧屏幕摘要'}])
 assert.match(output,/视频文案：\n早起吹发，时间紧。/)
 assert.doesNotMatch(output,/旧屏幕摘要|口播：|屏幕字幕：/)
})
