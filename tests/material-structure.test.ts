import {reportSections,videoScriptReport} from "../src/material-structure.ts"
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {splitMaterial,mideaText,migrateRows,migrationPreview,structureVideo,deepAnalysis} from '../src/material-structure.ts'
test('Midea reference keeps ten timed stages and all deep analysis dimensions',()=>{
 const rows=splitMaterial(mideaText)
 assert.equal(rows.length,10)
 assert.equal(rows[0].stage,'价格悬念')
 assert.equal(rows[3].stage,'价值锚定')
 assert.equal(rows[9].stage,'行动引导')
 assert.equal(deepAnalysis(rows,true).length,10)
})
test('migration retains segment count but removes unsupported competitor claims for every route',()=>{
 const rows=splitMaterial(mideaText)
 for(let route=0;route<3;route++){
  const shots=migrateRows(rows,route)
  assert.equal(shots.length,rows.length)
  assert.ok(shots.every(s=>s.line&&s.visual&&s.subtitle&&s.time))
  assert.doesNotMatch(shots.map(s=>s.line).join(' '),/美的|39亿|千元|再也不会|三档|四档|几分钟|不伤发/)
 }
 assert.notEqual(migrateRows(rows,0)[0].line,migrateRows(rows,1)[0].line)
})
test('untimed and unknown input never invents a time or mechanism',()=>{
 const rows=splitMaterial('第一句话\n第二句话')
 assert.equal(rows[0].time,'时间待核对')
 assert.equal(rows[0].stage,'结构待判断')
 assert.deepEqual(splitMaterial(''),[])
})

test('video reports use the reference report order and retain uncovered time ranges',()=>{
 const material={
   id:'test',kind:'reference' as const,name:'样本',source:'',creator:'',notes:'',date:'',duration:10,width:10,height:10,
   transcriptNote:'校对字幕',scenes:[{start:0,end:10,frame:'',observations:'采样记录'}],
   cues:[{start:0,end:3,text:'旅行出门时怎么带？'},{start:3,end:5,text:'看看吹风机。'}],
   segments:[{id:'seg',start:0,end:2,stage:'注意',speech:'旅行时怎么带？',visual:'行李箱',camera:'俯拍',subtitle:'',emotion:'',mechanism:'场景代入',selling:'',evidence:'行李箱出现在首帧',limits:'留存未知',bridge:''}]
 }
 const report=videoScriptReport(material)
 assert.deepEqual(report.map(s=>s.title),[...reportSections])
 assert.equal(report[2].items?.length,10)
 assert.deepEqual(report[1].rows?.map(r=>[r.start,r.end]),[[0,2],[2,3],[3,5],[5,10]])
 assert.match(report[1].rows![0].proof,/留存未知/)
 assert.equal(report[3].routes?.length,3)
})

test('migration preview uses the video segments for reports longer than the Midea example',()=>{
 const rows=structureVideo({
   id:'long',kind:'reference',name:'长视频',source:'',creator:'',notes:'',date:'',duration:12,width:100,height:100,
   transcriptNote:'',scenes:[],cues:Array.from({length:12},(_,i)=>({start:i,end:i+1,text:i===11?'点击商品卡':'看看这个吹风机'}))
 })
 assert.ok(rows.length>splitMaterial(mideaText).length)
 for(let route=0;route<3;route++){
   const preview=migrationPreview(rows,route)
   assert.deepEqual(preview.map(r=>r.segment),rows)
   assert.match(preview.at(-1)!.segment.move,/实际规格/)
 }
})

test('recognized speech takes priority over screen OCR for structure and both remain available',()=>{
 const material={
   id:'speech',kind:'reference' as const,name:'识别素材',source:'',creator:'',notes:'',date:'',duration:3,width:720,height:480,
   transcriptNote:'自动转写',scenes:[],cues:[{start:0,end:3,text:'以前价格让我不舍得买'}],
   screenCues:[{start:0,end:3,text:'点击商品卡看详情'}]
 }
 const spoken=structureVideo(material)
 assert.equal(spoken[0].stage,'价格悬念')
 assert.match(spoken[0].visual,/画面字幕候选.*商品卡/)
 const fallback=structureVideo({...material,cues:[]})
 assert.equal(fallback[0].stage,'行动引导')
 assert.match(fallback[0].proof,/画面字幕候选/)
})

test('a long spoken cue can produce different creative stages without pretending to know exact clause times',()=>{
 const rows=structureVideo({
   id:'long-speech',kind:'reference',name:'口播',source:'',creator:'',notes:'',date:'',duration:7,width:720,height:480,
   transcriptNote:'',scenes:[],cues:[{start:0,end:7,text:'旅行出门，看看这台吹风机，点击商品卡看详情。'}]
 })
 assert.deepEqual(rows.map(row=>row.stage),['场景与需求','产品与核心卖点','行动引导'])
 assert.equal(rows[0].start,0)
 assert.equal(rows.at(-1)?.end,7)
 assert.ok(rows.every(row=>row.time.startsWith('约')&&row.proof.includes('估算')))
})
