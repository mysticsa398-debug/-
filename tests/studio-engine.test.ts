import test from 'node:test'
import assert from 'node:assert/strict'
import {initial,uid,type Version} from '../src/domain.ts'
import {appendStudioVersions,editStudioShot,rewriteRound,studioDrafts,studioShot} from '../src/studio-engine.ts'
import {formatShootingScript} from '../src/shooting-script.ts'
import {decode,encode} from '../src/storage.ts'

test('five rounds append fifteen distinct versions, preserve previous work and export unified shots',()=>{
  let db=initial()
  const script=db.scripts[0], insight=db.insights[0]
  const brief={problem:insight.pain,proof:insight.decision}
  const original=structuredClone(script.versions[0])
  for(let round=0;round<5;round++){
    const batch=uid()
    const drafts=studioDrafts(insight,brief,db.facts,round)
    assert.equal(drafts.length,3)
    assert.equal(new Set(drafts.map(d=>JSON.stringify(d.shots.slice(1)))).size,3)
    const versions:Version[]=drafts.map(d=>({id:uid(),date:'2026-11-11',variant:d.direction,shots:d.shots,evidence:[],brief,batch}))
    db=appendStudioVersions(db,script.id,script.title,insight.id,versions)
  }
  assert.equal(db.scripts[0].versions.length,16)
  assert.equal(new Set(db.scripts[0].versions.map(v=>v.id)).size,16)
  assert.deepEqual(db.scripts[0].versions.at(-1),original)
  const shots=db.scripts[0].versions[0].shots.map(studioShot)
  const edited=editStudioShot(shots,0,'content','第一个镜头的新内容')
  assert.deepEqual(edited.slice(1),shots.slice(1))
  assert.equal(edited[0].time,shots[0].time)
  assert.doesNotMatch(formatShootingScript(script.title,edited),/产品\/道具画面|画外音：/)
  for(const csv of [false,true])assert.deepEqual(decode(encode(db,csv),csv),db)
})

test('three evaluated rewrite attempts retain the initial evidence and per-round differences',()=>{
  const db=initial(), insight=db.insights[1]
  const brief={problem:insight.pain,proof:insight.decision}
  const initialShots=studioDrafts(insight,brief,[],0)[0].shots.map(s=>({...s,content:'原稿',subtitle:'原稿'}))
  let best=initialShots
  const history=Array.from({length:3},(_,i)=>{
    const round=rewriteRound(best,insight,brief,[],i)
    assert.equal(round.prior.length,6)
    assert.equal(round.next.length,6)
    assert.ok(round.reason)
    assert.notDeepEqual(round.before,round.after)
    if(round.accepted)best=round.after
    return round
  })
  assert.deepEqual(history[0].before,initialShots)
  assert.ok(history.some(r=>r.accepted))
  assert.match(best.map(s=>s.content).join(' '),/闹钟|通勤包|出差/)
})

test('storyboard images and notes survive version conversion, editing, upgrade and both backup formats',()=>{
 const db=initial(), insight=db.insights[0], brief={problem:insight.pain,proof:insight.decision}
 const shots=studioDrafts(insight,brief,[],0)[0].shots.map((s,i)=>({...s,image:'data:image/jpeg;base64,/9j/AA==',imageSource:'上传图片 '+i,analysis:'本段测试备注'}))
 db.scripts[0].versions[0].shots=shots
 assert.deepEqual(shots.map(studioShot),shots)
 assert.equal(editStudioShot(shots,0,'subtitle','新的带货脚本')[0].image,shots[0].image)
 const rewritten=rewriteRound(shots,insight,brief,[],0)
 assert.equal(rewritten.after[0].imageSource,shots[0].imageSource)
 for(const csv of [false,true])assert.deepEqual(decode(encode(db,csv),csv),db)
 const exported=formatShootingScript('测试',shots)
 assert.ok(exported.includes('视频文案：'))
 assert.ok(exported.includes('结构分析：本段测试备注'))
 assert.ok(exported.includes('分镜图片：上传图片 0'))
})
