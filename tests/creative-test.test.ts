import test from 'node:test'
import assert from 'node:assert/strict'
import {initial,blankExperiment,type Version} from '../src/domain.ts'
import {compareCreativeTest,reportsFor,sameCreativeBody,type CreativeTest} from '../src/creative-test.ts'
import {studioDrafts} from '../src/studio-engine.ts'
import {decode,encode} from '../src/storage.ts'

test('single-variable check and A/B comparisons retain metric provenance and sample limits',()=>{
  const db=initial(),script=db.scripts[0],insight=db.insights[0]
  const draft=studioDrafts(insight,{problem:insight.pain,proof:insight.decision},[],0)
  const control:Version={...script.versions[0],shots:draft[0].shots}
  const treatment:Version={...control,id:'b',shots:[draft[1].shots[0],...draft[0].shots.slice(1)]}
  assert.ok(sameCreativeBody(control,treatment))
  assert.ok(!sameCreativeBody(control,control))
  assert.ok(!sameCreativeBody(control,{...treatment,shots:draft[1].shots}))
  script.versions=[control,treatment]
  const plan:CreativeTest={id:'test',title:'test',script:script.id,control:control.id,treatment:treatment.id,conditions:'固定 SKU 和受众',hypothesis:'开场变化',
    primary:'hold',guardrail:'roi',guardrailMin:2,sample:1000,controlReport:'a',treatmentReport:'b',aligned:true}
  const a={...blankExperiment(),id:'a',title:'A',source:'A 组报表',script:script.id,version:control.id,insight:script.insight,impressions:1200,views:240,reported:{roi:2.3}}
  const b={...a,id:'b',title:'B',version:treatment.id,impressions:900,views:0,reported:{hold:30,roi:1.5}}
  const comparison=compareCreativeTest(plan,a,b)
  assert.deepEqual(reportsFor(plan,[a,b],'treatment'),[b])
  assert.equal(comparison.rows[0].delta,10)
  assert.equal(comparison.rows[0].treatmentSource,'报表录入')
  assert.equal(comparison.rows[0].controlSource,'按明细计算')
  assert.equal(comparison.issues.length,2)
  assert.equal(compareCreativeTest(plan,a).rows[0].delta,null)
  assert.equal(compareCreativeTest(plan,a,{...b,reportOnly:true}).rows[1].treatment,null)
  const state={...db,creativeTests:[plan],experiments:[a,b]}
  for(const csv of [true,false])assert.deepEqual(decode(encode(state,csv),csv),state)
})
