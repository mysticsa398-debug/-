import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeMaterial,compareMaterials,parseCues,type Material} from '../src/video-analysis.ts'

const input='WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n出差怕占行李箱。\n\n00:07.000 --> 00:09.300\n点击商品卡。'
const material:Material={id:'fixture',kind:'reference',name:'test.mp4',source:'',creator:'',notes:'',date:'',duration:8.2,width:720,height:1280,transcriptNote:'',
  scenes:[{start:0,end:4.3,frame:'',observations:'首帧'},{start:4.3,end:8.2,frame:'',observations:'变化'}],cues:parseCues(input,8.2)}

test('timed captions are clipped to actual duration and attached to observed shots',()=>{
  assert.equal(material.cues.length,2)
  assert.equal(material.cues[1].end,8.2)
  const report=analyzeMaterial(material)
  assert.deepEqual(report.rows.map(r=>r.end),[4.3,8.2])
  assert.match(report.rows[0].evidence,/00:01.0–00:02.5/)
  assert.match(report.rows[1].mechanism,/行动/)
  assert.equal(report.layers.length,6)
})

test('eight-dimension comparison separates detected evidence and missing cues',()=>{
  const creator={...material,kind:'creator' as const,cues:[]}
  const result=compareMaterials(material,creator)
  assert.equal(result.length,8)
  assert.match(result[4].reference,/商品卡/)
  assert.match(result[4].difference,/仅参考素材/)
  assert.doesNotMatch(result[4].creator,/点击商品卡/)
  assert.equal(parseCues('没时间码的普通文本',8.2).length,0)
})
