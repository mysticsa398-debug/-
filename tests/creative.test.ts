import {studioShot} from '../src/studio-engine.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {initial} from '../src/domain.ts'
import {hooks,creativeDraft,testPlan} from '../src/creative-engine.ts'
import {decode,encode} from '../src/storage.ts'
test('all ten hooks preserve controlled body and exclude unverified claims',()=>{
 const db=initial()
 for(const insight of db.insights){
  const drafts=hooks.map(h=>creativeDraft(insight,db.matches,db.facts,h.id))
  for(const draft of drafts){
   assert.equal(draft.length,drafts[0].length)
   assert.equal(draft[0].time,'0–5 秒')
   assert.match(draft.at(-1)?.part||'',/商品卡/)
   assert.deepEqual(draft.slice(1),drafts[0].slice(1))
   assert.doesNotMatch(draft.map(s=>s.line).join(''),/295|11万|2亿|57|静音|儿童模式|299元/)
   assert.ok(draft.every(s=>s.visual&&s.line))
  }
  assert.equal(new Set(drafts.map(s=>s[0].line)).size,10)
 }
})
test('report variants survive existing backups and keep verified evidence',()=>{
 const db=initial();db.facts[0]={...db.facts[0],status:'已核验',source:'实物称重原片',date:'2026-11-11'}
 const draft=creativeDraft(db.insights[0],db.matches,db.facts,'B')
 assert.match(JSON.stringify(draft),/295g/)
 db.scripts[0].versions[0]={...db.scripts[0].versions[0],variant:'报告迁移 · 实测实验',shots:draft.map(studioShot)}
 assert.deepEqual(decode(encode(db,false),false),db)
 assert.match(testPlan(db.insights[0],'C','B'),/不等于统计显著/)
})
