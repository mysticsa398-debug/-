import {studioShot} from '../src/studio-engine.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import {initial, type Fact} from '../src/domain.ts'
import {generateDesigns, ruleDraft, segment} from '../src/research.ts'
import {decode, encode} from '../src/storage.ts'

test('review gate, distinct openings, fixed continuations and traceable backup round trip',()=>{
  const db=initial()
  const insight=db.insights[0]
  const candidate=ruleDraft({material:'media-1',name:'Fixture',brand:'Fixture',source:'https://example.com/video',
    segment:{...segment(0,3,'注意'),evidence:'Fixture observation',mechanism:'Fixture hypothesis'}})
  const fact:Fact={...db.facts[0],wording:'295g'}
  assert.deepEqual(generateDesigns(candidate,insight,'家庭青年',insight.scene,15,fact),[])
  const rule={...candidate,title:'Fixture rule',status:'已审核',transfer:'保留合箱实拍'}
  for(const duration of [15,30,45]){
    const designs=generateDesigns(rule,insight,'家庭青年',insight.scene,duration,fact)
    assert.equal(new Set(designs.map(d=>d.shots[0].line)).size,3)
    for(const d of designs){
      assert.equal(d.fact,'')
      assert.equal(d.rule,rule.id)
      assert.deepEqual(d.shots.slice(1),designs[0].shots.slice(1))
      const edges=d.shots.map(s=>s.time.match(/\d+/g)!.map(Number))
      assert.equal(edges[0][0],0)
      assert.equal(edges[0][1],3)
      assert.equal(edges.at(-1)![1],duration)
      edges.slice(1).forEach(([start],i)=>assert.equal(start,edges[i][1]))
    }
    const base=db.scripts[0]
    const v={...base.versions[0],shots:designs[0].shots.map(studioShot),design:designs[0].id,fixedTiming:true}
    const state={...db,rules:[rule],designs,scripts:[{...base,versions:[v]}]}
    for(const csv of [false,true])assert.deepEqual(decode(encode(state,csv),csv),state)
  }
})
