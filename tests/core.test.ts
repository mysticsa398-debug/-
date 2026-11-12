import {studioShot} from '../src/studio-engine.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {audit,blankExperiment,deleteScript,experimentError,feedbackFor,generate,initial,metrics,scriptDecision,variants} from '../src/domain.ts'
import {decode,encode} from '../src/storage.ts'

test('only verified matched facts enter generated scripts, with three distinct variants',()=>{
  const db=initial()
  const generateFor=(variant:string)=>generate(db.insights[0],db.matches,db.facts,variant)
  assert.equal(new Set(variants.map(v=>generateFor(v)[0].line)).size,3)
  assert.equal(generateFor(variants[0]).length,6)
  assert.doesNotMatch(JSON.stringify(generateFor(variants[0])),/295g/)
  db.facts[0]={...db.facts[0],status:'已核验',source:'原始记录 F-01',date:'2026-11-11'}
  assert.match(JSON.stringify(generateFor(variants[0])),/295g/)
})

test('audit flags absolute wording, unverified figures and parameter rewrites',()=>{
  const db=initial()
  assert.ok(audit('静音，不伤发，重量 ２９５ ｇ，11 万转，恒温 57 度',db.facts).length>=5)
  db.facts[0]={...db.facts[0],status:'已核验',source:'原始记录 F-01',date:'2026-11-11'}
  assert.equal(audit('295g',db.facts).length,0)
})

test('zero denominators, refund adjustment and feedback are explicit',()=>{
  const draft=blankExperiment()
  assert.equal(metrics(draft).roi,null)
  const db=initial()
  const e={...draft,title:'本地计算测试',source:'合成单元测试',insight:db.insights[0].id,outcome:'已验证假设',notes:'用于测试状态',impressions:1000,views:150,clicks:50,orders:5,cost:100,revenue:370,gross:180,refund:20}
  assert.equal(experimentError(e),'')
  assert.deepEqual(metrics(e),{hold:15,ctr:5,cvr:10,roi:3.5,net:350,gross:160,contribution:60})
  db.experiments=[e]
  assert.equal(feedbackFor(db,e.insight),'已验证假设')
  assert.ok(experimentError({...e,orders:51}))
})

test('JSON and CSV backups preserve relationships and reject corrupted links',()=>{
  const db=initial()
  db.insights[0].source='原始链接, "附注"\n新行'
  for(const csv of [false,true]){
    assert.deepEqual(decode(encode(db,csv),csv),db)
    const bad={...db,matches:[{...db.matches[0],fact:'missing'}]}
    assert.throws(()=>decode(encode(bad,csv),csv))
  }
})

test('reference-based scripts turn audience conflicts into spoken lines and separate filming notes',()=>{
  const db=initial()
  const family=generate(db.insights[0],db.matches,db.facts,variants[0])
  const commute=generate(db.insights[1],[],db.facts,variants[0])
  assert.match(family[1].line,/一个怕占箱子，一个怕回家用不惯/)
  assert.match(scriptDecision(db.insights[0]).roles,/一起选、一起用/)
  assert.match(family[4].visual,/起始湿度/)
  assert.match(commute[0].line,/发根/)
  assert.match(commute[4].line,/出差/)
  assert.match(commute[3].visual,/练习头或发束/)
  assert.match(scriptDecision(db.insights[1]).roles,/自己选、自己用/)
  for (const script of [family,commute]) {
    assert.match(script.at(-1)?.line||'',/商品卡/)
    assert.doesNotMatch(script.map(shot=>shot.visual).join(''),/演员|模特|真人|演绎|对白/)
    assert.doesNotMatch(script.map(shot=>shot.line).join(''),/补录|280g|285g|295g|10亿|立减/)
  }
  for (const claim of ['30秒吹干','比普通吹风机快一倍','到手99元，今天送收纳袋']) {
    assert.ok(audit(claim,db.facts).length)
  }
})

test('question and evidence plan drive shot count and timing across backup formats',()=>{
  const db=initial()
  const insight=db.insights[0]
  const brief={problem:'小号登机箱还能放下吹风机吗？',proof:'拍量尺和箱子内部尺寸'}
  const one=generate(insight,[],db.facts,variants[0],brief)
  const two=generate(insight,[],db.facts,variants[0],{...brief,proof:brief.proof+'\n实拍合箱并记录结果'})
  assert.equal(one[0].line,brief.problem)
  assert.match(one[3].visual,/量尺/)
  assert.equal(two.length,one.length+1)
  assert.notEqual(two.at(-1)?.time,one.at(-1)?.time)
  db.scripts[0].versions[0]={...db.scripts[0].versions[0],brief,shots:one.map(studioShot)}
  for(const csv of [false,true])assert.deepEqual(decode(encode(db,csv),csv),db)
})

test('deleting a script keeps experiment results, source insight and audit text',()=>{
  const db=initial()
  const script=db.scripts[0]
  const linked={script:script.id,version:script.versions[0].id}
  db.experiments=[{...blankExperiment(),...linked,title:'本地测试',source:'合成测试',insight:script.insight,impressions:100}]
  db.audits=[{...linked,id:'A',date:'2026-11-11',input:'审核文本'}]
  const next=deleteScript(db,script.id)
  assert.equal(next.scripts.length,0)
  assert.equal(next.experiments[0].impressions,100)
  assert.equal(next.experiments[0].insight,script.insight)
  assert.match(next.experiments[0].notes,/脚本已删除/)
  assert.equal(next.audits[0].input,'审核文本')
  assert.equal(next.audits[0].script,'')
  assert.deepEqual(decode(encode(next,false),false),next)
})
