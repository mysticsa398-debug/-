import {test} from 'node:test'
import assert from 'node:assert/strict'
import {commerceFacts,commerceRisks,commerceShots,motiveFrom,reviewFrom,total,validateBatch,dimensions,type Draft} from '../src/commerce-engine.ts'
import {initial} from '../src/domain.ts'
import {productWorkspace,defaultProduct} from '../src/products.ts'
import {insightContext} from '../src/script-planning.ts'

const hook=(strategy:string,copy:string)=>({strategy,copy,audience:'家庭青年',psychology:'收纳负担',retention:'看包能否合上',visual:'拍装满衣服的包',bridge:'切换到实际装包'})
const motive=motiveFrom({buyer:'家庭青年',trigger:'出游前理行李',alternative:'酒店吹风机',dissatisfaction:'不熟悉',benefit:'出游家用共用',concern:'包能不能合上',proof:'实拍装包',reason:'一件设备应对出行与家用',basis:'创意假设',hooks:[hook('场景冲突','包塞满了？'),hook('痛点共鸣','出门还得带？'),hook('价值悬念','还剩一个角！')]})
const drafts:Draft[]=motive.hooks.map((h,i)=>({title:h.strategy,reason:motive.reason,factIds:[],shots:[h.copy,...[
  ['把收纳位留出来','看看带线怎么摆','回家取出照常用','点商品卡看详情'],
  ['酒店设备不熟悉','先拍装包的顺序','到家再试手感','点商品卡核对'],
  ['合包才算装得下','衣物和线材分开','拿出来看看档位','点商品卡挑选']
][i]].map(copy=>({task:'实物观察',visual:'实拍原物',copy}))}))

test('three hooks must use different strategies and three scripts must differ beyond the opening',()=>{
  assert.equal(validateBatch({drafts},[],motive).length,3)
  assert.throws(()=>validateBatch({drafts:[drafts[0],{...drafts[0],shots:[drafts[1].shots[0],...drafts[0].shots.slice(1)]},drafts[2]]},[],motive),/正文过于相似/)
  assert.throws(()=>motiveFrom({...motive,hooks:[motive.hooks[0],motive.hooks[0],motive.hooks[2]]}))
})
test('verified facts are product scoped and claims without evidence remain blocked',()=>{
  const db=initial()
  const workspace=productWorkspace(db,defaultProduct.id)
  assert.deepEqual(commerceFacts(workspace,db.insights[0]).map(f=>f.wording),['10亿负离子'])
  assert.match(insightContext(db.insights[1]).trigger,/出门/)
  assert.match(insightContext(db.insights[0]).trigger,/行李/)
  const draft={...drafts[0],title:'295g，限时优惠，到手价199元'}
  assert.match(commerceRisks(draft,workspace.facts,30).join(' '),/295g/)
  assert.match(commerceRisks(draft,workspace.facts,30).join(' '),/199元/)
})
test('five shots fit the requested timeline and review scores respect dimension bounds',()=>{
  for(const duration of [15,30,45] as const){
    assert.equal(commerceShots(drafts[0],duration)[0].time,'0–3 秒')
    assert.match(commerceShots(drafts[0],duration).at(-1)!.time,new RegExp(duration+' 秒$'))
  }
  const review={scores:dimensions.map(([,score])=>({score,reason:'测试诊断'})),risks:[],changes:'保留'}
  assert.equal(total(reviewFrom(review)),100)
  assert.throws(()=>reviewFrom({...review,scores:[{score:21,reason:'超出上限'},...review.scores.slice(1)]}))
})

test('30-second six-shot commerce layout follows the supplied editorial timing',()=>{
  const draft={...drafts[0],shots:[...drafts[0].shots,{task:'商品卡',visual:'商品卡入画',copy:'点商品卡看尺寸'}]}
  assert.deepEqual(commerceShots(draft,30).map(s=>s.time),['0–3 秒','3–8 秒','8–14 秒','14–21 秒','21–26 秒','26–30 秒'])
})

test('sales copy flags generic hooks, missing product introductions and production directions in narration',async()=>{
  const {salesCopyIssues}=await import('../src/commerce-engine.ts')
  const draft={...drafts[0],shots:drafts[0].shots.map((shot,i)=>i===0?{...shot,copy:'又来不及了'}:i===2?{...shot,copy:'同一机位，记录实际用时'}:shot)}
  assert.equal(salesCopyIssues(draft,'Dr.flash S8mini 吹风机','高速吹风机').length,3)
  const revised={...draft,shots:draft.shots.map((shot,i)=>({...shot,copy:['湿发还得赶地铁？','看这台 S8mini 吹风机','出门前先吹发根'][i]||shot.copy}))}
  assert.deepEqual(salesCopyIssues(revised,'Dr.flash S8mini 吹风机','高速吹风机'),[])
})

test('single-script generation accepts one hook and a six-shot draft',async()=>{
  const {singleDraftFrom,validCommerceMeta}=await import('../src/commerce-engine.ts')
  const one=motiveFrom({...motive,hooks:[motive.hooks[0]]},1)
  const draft={...drafts[0],shots:[...drafts[0].shots,{task:'商品卡',visual:'商品卡入画',copy:'点商品卡看尺寸'}],
    pitch:{factId:'',benefit:'收纳',proof:'实拍装包',clickReason:'查看尺寸'}}
  const parsed=singleDraftFrom(draft,[],one)
  assert.equal(parsed.shots.length,6)
  assert.equal(parsed.shots.at(-1)!.copy,'点击左下角看尺寸')
  assert.ok(validCommerceMeta({duration:30,motive:one,hook:one.hooks[0],changes:'初稿',risks:[]}))
  assert.throws(()=>singleDraftFrom({drafts:[draft]},[],one))
})
