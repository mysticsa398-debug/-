import assert from 'node:assert/strict'
import test from 'node:test'
import {blankExperiment,initial,type Version} from '../src/domain.ts'
import {defaultProduct,productWorkspace} from '../src/products.ts'
import {planningFacts,restoreScriptPlan,scriptStructures,scriptFromModel,validScriptPlan} from '../src/script-planning.ts'
import {decode,encode} from '../src/storage.ts'
import {handleGPTScript} from '../server/gpt-script.mjs'

const staged=[
  {part:'痛点开场',visual:'浴室近景拍湿刘海',line:'刘海还湿？',caption:'出门前的刘海'},
  {part:'产品实操',visual:'S8mini 配合梳子抬发根',line:'用 S8mini 吹开这一束。',caption:'镜前吹发动作'},
  {part:'商品卡承接',visual:'保留本次吹发结果，切产品卡',line:'想看这台，点商品卡。',caption:'查看型号'}
]
function fixture(){
  const db=initial()
  const [family,commute]=db.insights
  const body=staged.map(({part,visual,line,caption},i)=>({time:['0–3 秒','3–10 秒','10–15 秒'][i],part,content:visual,narration:line,subtitle:caption}))
  const version:Version={id:'v-a',date:'2026-11-01',variant:'现场吹发',shots:body,evidence:[]}
  const treatment={...version,id:'v-b',shots:body.map((shot,i)=>i===0?{...shot,narration:'要出门，刘海还湿？'}:shot)}
  db.scripts.push({id:'same-audience',title:'通勤吹发',insight:commute.id,facts:[],versions:[treatment,version]})
  const report={...blankExperiment(),id:'report-a',title:'投放 A',source:'投放后台归档',date:'2026-11-01',insight:commute.id,script:'same-audience',version:version.id,impressions:2000,views:200,cost:100,revenue:200}
  const second={...report,id:'report-b',title:'投放 B',version:treatment.id,views:500,outcome:'已验证假设',notes:'同人群观察到 5 秒完播提升'}
  db.experiments=[report,second]
  db.creativeTests=[{id:'ab',title:'通勤湿发开场',script:'same-audience',control:version.id,treatment:treatment.id,
    hypothesis:'场景痛点提升停留',conditions:'同 SKU、价格和观察窗口',primary:'hold',guardrail:'roi',guardrailMin:1,
    sample:1000,controlReport:report.id,treatmentReport:second.id,aligned:true}]
  return {db,family,commute}
}
test('report shares are references, actual support is linked to the same audience and script',()=>{
  const {db,family,commute}=fixture()
  assert.ok(scriptStructures(initial(),commute.id).every(s=>s.status==='报告参考'))
  const sources=scriptStructures(db,commute.id)
  assert.deepEqual(sources.slice(0,2).map(s=>s.status),['开场对照支持','关联投放支持'])
  assert.match(sources[0].basis,/15.00 个百分点.*开场/)
  assert.deepEqual(sources[0].stages,staged.map(s=>s.part))
  assert.ok(scriptStructures(db,family.id).every(s=>s.status==='报告参考'))
  db.creativeTests![0].aligned=false
  assert.ok(!scriptStructures(db,commute.id).some(s=>s.status==='开场对照支持'))
  db.experiments[1].source=''
  assert.ok(scriptStructures(db,commute.id).every(s=>s.status==='报告参考'))
})
test('editable structure controls the number, names and order of the final shots',()=>{
  const {db,commute}=fixture()
  const structure=scriptStructures(db,commute.id)[0]
  const plan={title:'吹发',problem:'早起湿发',angle:'发根',demo:'吹刘海',segments:[
    {name:'开机前的湿刘海',purpose:'拍初始状态'},
    {name:'镜前吹发与梳理建议',purpose:'边吹边演示整理发根'}]}
  assert.ok(validScriptPlan(plan))
  const reordered={...plan,segments:[...plan.segments].reverse()}
  const data={title:'通勤时怎么吹发',shots:staged.slice(0,2)}
  const draft=scriptFromModel(data,reordered,db.facts)
  assert.deepEqual(draft.shots.map(s=>s.part),reordered.segments.map(s=>s.name))
  assert.equal(draft.shots[0].time,'0–3 秒')
  assert.throws(()=>scriptFromModel({...data,shots:staged},plan,db.facts),/不一致/)
  assert.equal(scriptFromModel({...data,title:'旅行装箱与家用'},plan,db.facts).title,'旅行装箱与家用')
  assert.throws(()=>scriptFromModel({...data,title:'到手99元'},plan,db.facts),/价格/)
  db.scripts[1].versions[0].planning={structure,plan:reordered}
  for(const csv of [true,false])assert.deepEqual(decode(encode(db,csv),csv),db)
})

test('historical plans preserve all prior stage tasks and the old closing note',()=>{
  const {db,commute}=fixture()
  const structure=scriptStructures(db,commute.id)[0]
  const legacy={structure,plan:{title:'吹发',problem:'早起湿发',angle:'发根',demo:'吹刘海',cta:'商品卡看型号',beats:['展示湿发','操作演示','结尾']}}
  db.scripts[1].versions[0].planning=legacy
  const restored=decode(encode(db,false),false).scripts[1].versions[0].planning!
  assert.deepEqual(restoreScriptPlan(restored).segments.map(s=>s.name),structure.stages)
  assert.equal(restoreScriptPlan(restored).segments.at(-1)?.purpose,'结尾\n商品卡看型号')
})
test('GPT route authorizes the user and sends the edited plan to Responses without storing it',async()=>{
  const env={OPENAI_API_KEY:'test-key',S8MINI_GPT_ALLOWED_EMAILS:'owner@example.test'}
  const url='https://studio.example.test/api/gpt-script'
  const identity={'oai-authenticated-user-id':'site-owner','oai-authenticated-user-email':'owner@example.test'}
  assert.deepEqual(await (await handleGPTScript(new Request(url),{})).json(),{status:'setup',provider:'OpenAI'})
  const request=(context:object,headers:Record<string,string>)=>new Request(url,{method:'POST',
    headers:{'content-type':'application/json',...headers},body:JSON.stringify({step:'script',context})})
  const context={structure:{status:'开场对照支持',stages:staged.map(s=>s.part)},plan:{demo:'修改后的发根演示',segments:[{name:'先展示湿发',purpose:'拍刘海'},{name:'吹发动作',purpose:'拍发根'}]}}
  assert.equal((await handleGPTScript(request(context,{}),env)).status,401)
  assert.equal((await handleGPTScript(request(context,{...identity,origin:'https://other.test'}),env)).status,403)
  assert.equal((await handleGPTScript(request({...context,structure:{...context.structure,status:'未知来源'}},identity),env)).status,400)
  const result=await handleGPTScript(request(context,identity),env,async(endpoint:string,init:RequestInit)=>{
    assert.equal(endpoint,'https://api.openai.com/v1/responses')
    assert.equal(init.redirect,'manual')
    const input=JSON.parse(init.body as string)
    assert.equal(input.store,false)
    assert.deepEqual(JSON.parse(input.input).plan,context.plan)
    assert.match(input.instructions,/plan\.segments/)
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'吹发',shots:staged.slice(0,2)})}]}]})
  })
  assert.equal(result.status,200)
  assert.equal((await result.json()).result.shots.length,2)
})

test('signed-in visitor access accepts a second account and requires authentication',async()=>{
  const url='https://studio.example.test/api/gpt-script'
  const headers={'oai-authenticated-user-id':'site-visitor','oai-authenticated-user-email':'visitor@example.test','content-type':'application/json'}
  const restricted={OPENAI_API_KEY:'test-key',S8MINI_GPT_ALLOWED_EMAILS:'owner@example.test'}
  const opened={...restricted,S8MINI_GPT_ACCESS_MODE:'authenticated'}
  const guest=await handleGPTScript(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),opened)
  assert.equal(guest.status,401)
  const plan=()=>new Request(url,{method:'POST',headers,body:JSON.stringify({step:'plan',context:{structure:{stages:[]}}})})
  assert.equal((await handleGPTScript(plan(),restricted)).status,403)
  const result=await handleGPTScript(plan(),opened,async()=>Response.json({
    status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'访客策划'})}]}]
  }))
  assert.equal(result.status,200)
  assert.deepEqual(await result.json(),{result:{title:'访客策划'}})
})

test('GPT route rejects redirects without sending the key to the redirect destination',async()=>{
  const env={OPENAI_API_KEY:'test-key',S8MINI_GPT_ACCESS_MODE:'authenticated'}
  const request=new Request('https://studio.example.test/api/gpt-script',{
    method:'POST',headers:{'oai-authenticated-user-id':'visitor','content-type':'application/json'},
    body:JSON.stringify({step:'plan',context:{structure:{stages:[]}}})
  })
  const destinations:string[]=[]
  const response=await handleGPTScript(request,env,async(url:string,init:RequestInit)=>{
    destinations.push(url)
    assert.equal(init.redirect,'manual')
    return Response.redirect('https://redirect.example.test/',307)
  })
  assert.equal(response.status,502)
  assert.match((await response.json()).error,/重定向/)
  assert.deepEqual(destinations,['https://api.openai.com/v1/responses'])
})

test('a DeepSeek secret selects DeepSeek for both requests and handles an exhausted balance without a fallback',async()=>{
  const url='https://studio.example.test/api/gpt-script'
  const env={OPENAI_API_KEY:'openai-test-key',DEEPSEEK_API_KEY:'deepseek-test-key',S8MINI_GPT_ACCESS_MODE:'authenticated'}
  const headers={'oai-authenticated-user-id':'site-visitor','content-type':'application/json'}
  assert.deepEqual(await (await handleGPTScript(new Request(url,{headers}),env)).json(),{status:'ready',provider:'DeepSeek'})
  const generate=(step:string)=>new Request(url,{method:'POST',headers,body:JSON.stringify({
    step,context:{structure:{stages:[],status:'关联投放支持'},plan:{segments:[{name:'产品演示',purpose:'拍吹发动作'}]}}
  })})
  const destinations:string[]=[]
  const upstream=async(endpoint:string,init:RequestInit)=>{
    destinations.push(endpoint)
    const request=new Request(endpoint,init)
    assert.equal(request.headers.get('authorization'),'Bearer deepseek-test-key')
    assert.equal(request.redirect,'manual')
    const input=await request.json()
    assert.equal(input.model,'deepseek-flash')
    assert.equal(input.store,false)
    assert.deepEqual(input.reasoning,{effort:'none'})
    assert.equal(input.text.format.type,'json_schema')
    const step=destinations.length===1?'plan':'script'
    assert.equal(input.text.format.name,'s8mini_'+step)
    if(destinations.length===3)return new Response(null,{status:402})
    const output=step==='plan'?{title:'吹发策划'}:{title:'吹发正文',shots:[staged[1]]}
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]})
  }
  assert.deepEqual(await (await handleGPTScript(generate('plan'),env,upstream)).json(),{result:{title:'吹发策划'}})
  assert.deepEqual(await (await handleGPTScript(generate('script'),env,upstream)).json(),{result:{title:'吹发正文',shots:[staged[1]]}})
  const rejected=await handleGPTScript(generate('script'),env,upstream)
  assert.equal(rejected.status,502)
  assert.match((await rejected.json()).error,/DeepSeek API 账户余额不足/)
  assert.deepEqual(destinations,Array(3).fill('https://api.deepseek.com/responses'))
})

test('public generation allows a visitor without a ChatGPT session to use the site DeepSeek key',async()=>{
  const env={DEEPSEEK_API_KEY:'test-secret',S8MINI_GPT_ACCESS_MODE:'public'}
  const url='https://studio.example.test/api/gpt-script'
  assert.deepEqual(await (await handleGPTScript(new Request(url),env)).json(),{status:'ready',provider:'DeepSeek'})
  assert.equal((await (await handleGPTScript(new Request(url),{S8MINI_GPT_ACCESS_MODE:'public'})).json()).status,'setup')
  const request=new Request(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://studio.example.test'},
    body:JSON.stringify({step:'plan',context:{structure:{stages:[]}}})})
  const response=await handleGPTScript(request,env,async(endpoint:string,init:RequestInit)=>{
    assert.equal(endpoint,'https://api.deepseek.com/responses')
    assert.equal(new Headers(init.headers).get('authorization'),'Bearer test-secret')
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"title":"访客吹发策划"}'}]}]})
  })
  assert.equal(response.status,200)
  assert.deepEqual(await response.json(),{result:{title:'访客吹发策划'}})
})

test('a finished plan based on a reference report can generate a trial script',async()=>{
  const env={DEEPSEEK_API_KEY:'test-secret',S8MINI_GPT_ACCESS_MODE:'public'}
  const context={structure:{status:'报告参考',stages:[]},plan:{
    segments:[{name:'观察湿刘海',purpose:'拍摄吹发前的状态'},{name:'现场操作',purpose:'演示吹发过程'}]
  }}
  const request=new Request('https://studio.example.test/api/gpt-script',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({step:'script',context})
  })
  const response=await handleGPTScript(request,env,async(_url:string,init:RequestInit)=>{
    const input=JSON.parse(init.body as string)
    assert.match(input.instructions,/待验证的试拍稿/)
    assert.deepEqual(JSON.parse(input.input),context)
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'吹发试拍',shots:staged.slice(0,2)})}]}]})
  })
  assert.equal(response.status,200)
  assert.equal((await response.json()).result.shots.length,2)
})

test('DeepSeek writes scripts with approved memory summaries and returns the reference snapshot',async()=>{
 const memory=[{kind:'规律',id:'reviewed-1',title:'真实吹发动作',summary:'先拍湿发起始状态',internal:'discard'}]
 const context={memory,structure:{stages:['实拍'],status:'报告参考'},plan:{segments:[{name:'实拍',purpose:'观察吹发'}]}}
 const request=new Request('https://studio.example.test/api/gpt-script',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({step:'script',context})
 })
 const response=await handleGPTScript(request,{DEEPSEEK_API_KEY:'test',S8MINI_GPT_ACCESS_MODE:'public'},async(_url:string,init:RequestInit)=>{
   const payload=JSON.parse(String(init.body))
   assert.match(payload.instructions,/投放记录只说明观察/)
   const references=JSON.parse(payload.input).memory
   assert.equal(references[0].id,'reviewed-1')
   assert.equal(references[0].internal,undefined)
   return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"title":"试拍"}'}]}]})
 })
 assert.equal(response.status,200)
 const data=await response.json()
 assert.equal(data.generation.provider,'DeepSeek')
 assert.equal(data.generation.model,'deepseek-flash')
 assert.equal(data.generation.memory[0].id,'reviewed-1')
})

test('products isolate generation facts and history across backups, including legacy backups',()=>{
  const {db,commute}=fixture()
  const steamer={id:'steamer',name:'挂烫机',category:'衣物护理',url:'',notes:'',demo:'拍衬衫袖口实拍'}
  db.products!.push(steamer)
  const verified={status:'已核验',date:'2026-11-12',source:'适用型号检测资料'}
  Object.assign(db.facts[0],verified,{wording:'吹风机机身重 295g'})
  db.facts.push({...db.facts[0],id:'steamer-fact',productId:steamer.id,claim:'800W',wording:'挂烫机额定功率 800W'})
  db.scripts[1].versions[0].productId=steamer.id
  for(const csv of [false,true]){
    const restored=decode(encode(db,csv),csv)
    const scope=productWorkspace(restored,steamer.id)
    assert.deepEqual(planningFacts(scope,commute).map(f=>f.id),['steamer-fact'])
    assert.deepEqual(scope.scripts[0].versions.map(v=>v.id),['v-b'])
    assert.ok(scriptStructures(scope,commute.id).every(s=>s.status!=='开场对照支持'))
    assert.equal(productWorkspace(restored,defaultProduct.id).facts.some(f=>f.id==='steamer-fact'),false)
  }
  const legacy=initial()
  delete legacy.products
  assert.equal(decode(JSON.stringify(legacy),false).products![0].id,defaultProduct.id)
})
