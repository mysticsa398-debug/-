import {defaultProduct,productsFor} from './products.ts'
import {validPlanning} from './script-planning.ts'
import {testMetrics} from './creative-test.ts'
import {taskSkills} from './script-agent.ts'
import {studioShot} from './studio-engine.ts'
import {categories, confidenceLevels, reviewFields, stages} from './research.ts'
import {initial, blankExperiment, defaults, experimentError, verified, blankInsight, type DB} from './domain.ts'
const key = 's8mini-studio-v1'
const collections = ['insights','facts','matches','scripts','experiments','audits','rules','designs','creativeTests','products'] as const
export function save(db:DB) { localStorage.setItem(key,JSON.stringify(db)) }
export function load():DB {
  const value = localStorage.getItem(key)
  return value ? validate(JSON.parse(value)) : initial()
}
function validate(value:unknown):DB {
  const seed = initial()
  const examples = {
    products:defaultProduct, insights:{...blankInsight(), strategies:[''],audiences:['']}, facts:seed.facts[0], matches:seed.matches[0],
    scripts:{...seed.scripts[0],facts:[''],versions:[{...seed.scripts[0].versions[0],evidence:[seed.facts[0]]}]}, experiments:blankExperiment(), audits:{id:'',date:'',script:'',version:'',input:''},
    rules:{id:'',title:'',category:'',mechanism:'',audience:'',scene:'',conditions:'',limits:'',transfer:'',hypothesis:'',confidence:'',basis:'',status:'',date:'',history:[''],
      evidence:[{material:'',name:'',source:'',brand:'',segment:{id:'',start:0,end:0,stage:'',...Object.fromEntries(Object.keys(reviewFields).map(key=>[key,'']))}}]},
    creativeTests:{id:'',title:'',script:'',control:'',treatment:'',hypothesis:'',conditions:'',primary:'',guardrail:'',guardrailMin:0,sample:0,controlReport:'',treatmentReport:'',aligned:false},
    designs:{id:'',rule:'',title:'',insight:'',audience:'',scene:'',fact:'',duration:0,direction:'',hypothesis:'',variable:'',metric:'',conditions:'',prompt:'',date:'',history:[''],shots:[{time:'',part:'',line:'',visual:'',subtitle:''}]}
  }
  function shape(value:unknown, sample:unknown):boolean {
    if(sample===examples.scripts.versions[0].shots){
      return Array.isArray(value)&&value.every(s=>s&&typeof s.time==='string'&&typeof s.part==='string'&&
        (s.narration===undefined||typeof s.narration==='string')&&
        (typeof s.content==='string'&&typeof s.subtitle==='string'||typeof s.visual==='string'&&typeof s.line==='string'))
    }
    if (Array.isArray(sample)) return Array.isArray(value) && value.every(item=>shape(item,sample[0]))
    if (sample && typeof sample==='object') return Boolean(value && typeof value==='object' && Object.entries(sample).every(([k,v])=>shape((value as Record<string,unknown>)[k],v)))
    return typeof value===typeof sample && (typeof value!=='number' || Number.isFinite(value))
  }
  if (!value || typeof value!=='object') throw Error('备份格式无效。')
  const raw = value as DB
  const db = {...raw,products:productsFor(raw),creativeTests:raw.creativeTests===undefined?[]:raw.creativeTests,rules:raw.rules===undefined?[]:raw.rules,designs:raw.designs===undefined?[]:raw.designs,scripts:Array.isArray(raw.scripts)?raw.scripts.map(s=>s && Array.isArray(s.versions)?{...s,versions:s.versions.map(v=>v && typeof v==='object' && !Object.hasOwn(v,'evidence')?{...v,evidence:[]}:v)}:s):raw.scripts}
  if (!shape(db.thresholds,defaults) || typeof db.endpoint!=='string') throw Error('备份缺少设置或设置无效。')
  for (const k of collections) {
    const list=db[k]!
    if (!shape(list,[examples[k]]) || list.some(item=>!item.id.trim()) || new Set(list.map(item=>item.id)).size!==list.length) throw Error(`检查 ${k} 的字段、类型与 ID。`)
  }
  const productIdValid = (id:unknown) => id === undefined || db.products.some(product=>product.id===id)
  if (!db.products.some(product=>product.id===defaultProduct.id) || db.products.some(product=>!product.name.trim()||!product.category.trim()||product.url&&!/^https?:\/\/[^\s]+$/i.test(product.url)) || db.audits.some(a=>!productIdValid(a.productId)) || db.facts.some(f=>!productIdValid(f.productId)) || db.scripts.some(s=>s.versions.some(v=>!productIdValid(v.productId)))) throw Error('备份中的产品或产品关联无效。')
  if(db.insights.some(i=>i.needs!==undefined&&!shape(i.needs,['']))) throw Error('业务需求标签格式无效。')
  const insight = (id:string) => db.insights.some(i=>i.id===id)
  const fact = (id:string) => db.facts.some(f=>f.id===id)
  const version = (script:string,id:string) => db.scripts.some(s=>s.id===script && s.versions.some(v=>v.id===id))
  if (db.facts.some(f=>f.status==='已核验' && !verified(f))) throw Error('已核验事实缺少来源或日期。')
  if (db.matches.some(m=>!insight(m.insight)||!fact(m.fact)) ||
      db.scripts.some(s=>!insight(s.insight)||s.facts.some(id=>!fact(id))||!s.versions.length || new Set(s.versions.map(v=>v.id)).size!==s.versions.length || s.versions.some(v=>!v.id || !v.shots.length || v.shots.some(s=>s.subtitle!==undefined&&typeof s.subtitle!=='string') || (v.brief!==undefined && (!shape(v.brief,{problem:'',proof:''})||v.brief.focus!==undefined&&!Object.hasOwn(taskSkills,v.brief.focus))))) ||
      db.experiments.some(e=>experimentError(e)||(e.insight&&!insight(e.insight))||(e.script&&!db.scripts.some(s=>s.id===e.script&&s.insight===e.insight))||(e.script&&!version(e.script,e.version))) ||
      db.audits.some(a=>a.script&&!version(a.script,a.version))) throw Error('备份包含无效关联、分镜或实验数据。')
  if(db.rules.some(r=>!categories.some(c=>c===r.category)||!confidenceLevels.some(c=>c===r.confidence)||!['待审核','已审核'].includes(r.status)||
    !r.evidence.length||r.evidence.some(({material,segment:s})=>!material||!s.id||s.start<0||s.end<=s.start||!stages.some(stage=>stage===s.stage)))||
    db.designs.some(d=>!db.rules.some(r=>r.id===d.rule)||![15,30,45].includes(d.duration)||!d.shots.length)||
    db.scripts.some(s=>s.versions.some(v=>v.design!==undefined&&(typeof v.design!=='string'||!db.designs.some(d=>d.id===v.design))||
      v.fixedTiming!==undefined&&typeof v.fixedTiming!=='boolean'||v.planning!==undefined&&!validPlanning(v.planning))))throw Error('备份包含无效规律、时间段、设计或脚本来源。')
  const shot={time:'',part:'',content:'',subtitle:''}
  const rating={name:'',score:0}
  const review={before:[shot],after:[shot],prior:[rating],next:[rating],reason:'',accepted:false,mode:''}
  if(db.scripts.some(s=>s.versions.some(v=>
    [v.batch,v.material,v.title].some(value=>value!==undefined&&typeof value!=='string')||
    v.review!==undefined&&(!shape(v.review,[review])||v.review.length>3||v.review.some(r=>r.prior.length!==6||r.next.length!==6))))||
    db.rules.some(r=>r.experiment!==undefined&&typeof r.experiment!=='string'||
      r.revisions!==undefined&&(!shape(r.revisions,[examples.rules])||r.revisions.some(v=>v.id!==r.id)))){
    throw Error('备份中的评估记录或规律历史无效。')
  }
  if(db.creativeTests.some(p=>!Object.hasOwn(testMetrics,p.primary)||!Object.hasOwn(testMetrics,p.guardrail)||p.primary===p.guardrail||
    !p.script||!p.control||!p.treatment||p.control===p.treatment||!Number.isSafeInteger(p.sample)||p.sample<1||
    p.guardrail!=='roi'&&(p.guardrailMin<0||p.guardrailMin>100)))throw Error('素材 A/B 计划格式无效。')
  const {hold,ctr,cvr,roi,sample}=db.thresholds
  if ([hold,ctr,cvr].some(v=>v<0||v>100) || roi<0 || sample<1 || !Number.isSafeInteger(sample)) throw Error('阈值超出允许范围。')
  return db
}
function parseCSV(input:string) {
  const rows:string[][]=[]
  let row:string[]=[],field='',quoted=false,closed=false
  for(let i=0;i<input.length;i++){
    const char=input[i]
    if(quoted){
      if(char==='"' && input[i+1]==='"'){field+='"';i++}
      else if(char==='"'){quoted=false;closed=true}
      else field+=char
    } else if(char===',' || char==='\n' || char==='\r'){
      row.push(field);field='';closed=false
      if(char!==','){rows.push(row);row=[];if(char==='\r'&&input[i+1]==='\n')i++}
    } else if(char==='"' && !field && !closed){quoted=true}
    else if(closed || char==='"'){throw Error('CSV 引号格式有误。')}
    else field+=char
  }
  if(quoted)throw Error('CSV 引号未闭合。')
  if(field || row.length || closed){row.push(field);rows.push(row)}
  return rows
}
export function decode(input:string,csv:boolean):DB {
  const raw=input.replace(/^\uFEFF/,'')
  if(!csv)return validate(JSON.parse(raw))
  const [header,...rows]=parseCSV(raw)
  if(header?.join(',')!=='collection,id,data') throw Error('CSV 需要 collection、id、data 三列。')
  const db=Object.fromEntries(collections.map(k=>[k,[]])) as unknown as DB
  let settings=false
  for(const [kind,id,data,...extra] of rows){
    if(!data||extra.length) throw Error('CSV 行字段数量有误。')
    const record=JSON.parse(data)
    if(kind==='settings' && id==='settings' && !settings){settings=true;db.thresholds=record.thresholds;db.endpoint=record.endpoint}
    else if(collections.some(k=>k===kind) && record?.id===id) (db[kind as typeof collections[number]] as unknown[]).push(record)
    else throw Error('CSV 包含未知集合或 ID 不一致。')
  }
  if (!db.products?.length) db.products = [defaultProduct]
  return validate(db)
}
export function encode(db:DB,csv:boolean) {
  db={...db,products:productsFor(db),scripts:db.scripts.map(s=>({...s,versions:s.versions.map(v=>({...v,shots:v.shots.map(studioShot)}))}))}
  if(!csv)return JSON.stringify(db,null,2)
  const wrap=(value:string)=>'"'+value.replaceAll('"','""')+'"'
  const rows=collections.flatMap(k=>(db[k]||[]).map(item=>[k,item.id,JSON.stringify(item)]))
  rows.push(['settings','settings',JSON.stringify({thresholds:db.thresholds,endpoint:db.endpoint})])
  return '\uFEFFcollection,id,data\r\n'+rows.map(row=>row.map(wrap).join(',')).join('\r\n')
}
export function download(db:DB,csv:boolean){
  const href=URL.createObjectURL(new Blob([encode(db,csv)],{type:csv?'text/csv;charset=utf-8':'application/json'}))
  const link=document.createElement('a')
  link.href=href;link.download=csv?'s8mini-backup.csv':'s8mini-backup.json';link.click()
  setTimeout(()=>URL.revokeObjectURL(href),1000)
}
