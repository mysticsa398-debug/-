import test from 'node:test'
import assert from 'node:assert/strict'
import {crossInsight,crossPairs} from '../src/cross.ts'
import {initial} from '../src/domain.ts'
import {decode,encode} from '../src/storage.ts'

test('crossing two audiences and two needs creates four editable hypotheses and skips existing pairs',()=>{
  const db=initial()
  const people=['家庭青年','都市白领女性']
  const needs=['旅行便携','通勤效率']
  const pairs=crossPairs(people,needs,db.insights)
  assert.equal(pairs.length,4)
  const drafts=pairs.map(({person,need})=>crossInsight(person,need))
  assert.equal(new Set(drafts.map(d=>d.id)).size,4)
  assert.ok(drafts.every(d=>d.confidence==='D'&&d.status==='假设 / 待验证'&&d.decision&&d.strategies.length===1))
  assert.equal(crossPairs(people,needs,[drafts[0],...db.insights]).length,3)
  db.insights.unshift(...drafts)
  for(const csv of [true,false])assert.deepEqual(decode(encode(db,csv),csv),db)
})
