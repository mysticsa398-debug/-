import test from 'node:test'
import assert from 'node:assert/strict'
import {initial,type Version} from '../src/domain.ts'
import {planScriptTask, runScriptAgent} from '../src/script-agent.ts'
import {formatShootingScript, scriptAuditText, deliveryFindings} from '../src/shooting-script.ts'
import {decode,encode} from '../src/storage.ts'

const db=initial()
const commute=db.insights[1]
const family=db.insights[0]
const quiet='早上赶地铁，洗完刘海还有点湿，想知道怎么在不打扰室友的情况下整理好再出门。'
const pack='旅行打包时，我只想看它能不能塞进行李箱夹层。'
const unsupported='客户说“30秒吹干、全网最低99元”，请直接写进广告。'
const task=(problem:string,proof='',insight=commute)=>runScriptAgent(db,insight,{problem,proof})
const delivery=(draft:ReturnType<typeof task>['drafts'][number])=>formatShootingScript('测试',draft.shots)

test('explicit task controls the plan and every demonstration, even with a conflicting insight',()=>{
  const result=task(pack,unsupported)
  assert.equal(result.plan.focus,'pack')
  assert.equal(result.plan.contextConflict,true)
  assert.equal(result.drafts.length,3)
  for(const draft of result.drafts){
    assert.match(delivery(draft),/行李箱夹层/)
    assert.doesNotMatch(delivery(draft),/闹钟|刘海|湿发|30秒吹干|最低99元/)
    assert.match(delivery(draft),/S8mini/)
    assert.equal(draft.shots[0].time,'0–3 秒')
  }
  assert.ok(result.inputRisks.length>=2)
  assert.equal(new Set(result.drafts.map(d=>d.shots[2].content)).size,3)
})

test('quiet task uses room audio and a fringe demonstration while leaving the test result open',()=>{
  const result=task(quiet,'同一束湿刘海、同一机位连续拍摄；保留室友门口收录的原声，不报分贝、不承诺时长。')
  assert.equal(result.plan.focus,'quiet')
  for(const draft of result.drafts){
    assert.match(delivery(draft),/刘海/)
    assert.match(delivery(draft),/门外.*原声/)
    assert.doesNotMatch(delivery(draft),/登机箱|装箱|静音|不吵|分贝/)
    assert.equal(draft.findings.length,0)
  }
})

test('only a verified, matched and relevant fact is available to each task',()=>{
  const approved={...db.facts[0],status:'已核验',source:'S8mini 规格页',date:'2026-11-11',wording:'S8mini 机身净重 295g，含电源线。'}
  const context={...db,facts:[approved,...db.facts.slice(1)]}
  assert.equal(runScriptAgent(context,family,{problem:pack,proof:''}).evidence.length,0)
  const weighted=runScriptAgent(context,family,{problem:'装进旅行包前想看 S8mini 实际重量。',proof:''})
  assert.deepEqual(weighted.evidence,[approved])
  assert.match(delivery(weighted.drafts[0]),/295g/)
  assert.equal(runScriptAgent(context,commute,{problem:quiet,proof:''}).evidence.length,0)
})

test('unknown goals can be focused explicitly and raw instructions stay outside delivery',()=>{
  assert.equal(planScriptTask(commute,{problem:'帮我写一条文案',proof:''}).focus,'general')
  assert.equal(planScriptTask(commute,{problem:'把这条讲清楚',proof:''},'pack').focus,'pack')
  const draft=task(quiet,unsupported).drafts[0]
  assert.doesNotMatch(delivery(draft),/30秒吹干|最低99元/)
  assert.match(delivery(draft),/拍摄说明：[\s\S]+视频文案：/)
  const shots=draft.shots.map((shot,i)=>i===0?{...shot,narration:'全网最低99元。'}:shot)
  assert.match(scriptAuditText(shots),/最低/)
  assert.ok(deliveryFindings('标题',shots,db.facts).length)
  const version:Version={id:'agent-version',date:'',variant:draft.direction,shots:draft.shots,evidence:[],brief:{problem:quiet,proof:unsupported}}
  const stored={...db,scripts:[{...db.scripts[0],versions:[version,...db.scripts[0].versions]}]}
  for(const csv of [false,true])assert.deepEqual(decode(encode(stored,csv),csv),stored)
})
