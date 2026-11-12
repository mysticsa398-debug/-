import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer, type RequestListener} from 'node:http'
import {scriptProxy} from '../server/script-proxy.mjs'

const route='/api/script-generation'
const template=Array.from({length:5},()=>({visual:'拍摄过程',line:'记录观察'}))

async function serve(listener:RequestListener, run:(origin:string)=>Promise<void>) {
  const server=createServer(listener)
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{
    const address=server.address()
    if(!address||typeof address==='string')throw Error('Missing test address')
    await run(`http://127.0.0.1:${address.port}`)
  }finally{
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
  }
}
function middleware(env:Record<string,string>):RequestListener {
  let handler:(req:Parameters<RequestListener>[0],res:Parameters<RequestListener>[1],next:()=>void)=>void
  scriptProxy(env).configureServer({middlewares:{use(value:typeof handler){handler=value}}})
  return (req,res)=>handler(req,res,()=>{res.statusCode=404;res.end()})
}
const post=(url:string,data:object)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})

test('embedded proxy reports local mode, returns template and rejects invalid requests',async()=>{
  await serve(middleware({}),async(origin)=>{
    assert.deepEqual(await (await fetch(origin+route)).json(),{mode:'local'})
    assert.deepEqual(await (await post(origin+route,{template})).json(),{mode:'local',shots:template})
    assert.equal((await post(origin+route,{template:[]})).status,400)
  })
})

test('upstream mode sends server authentication and validates returned shots',async()=>{
  let authorization:string|undefined
  let invalid=false
  await serve((req,res)=>{
    authorization=req.headers.authorization
    req.resume()
    res.setHeader('Content-Type','application/json')
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({shots:invalid?[]:template})}}]}))
  },async(upstream)=>{
    await serve(middleware({S8MINI_LLM_URL:upstream,S8MINI_LLM_MODEL:'fixture',S8MINI_LLM_KEY:'test-only'}),async(origin)=>{
      assert.deepEqual(await (await fetch(origin+route)).json(),{mode:'llm'})
      assert.deepEqual(await (await post(origin+route,{template})).json(),{mode:'llm',shots:template})
      assert.equal(authorization,'Bearer test-only')
      invalid=true
      assert.equal((await post(origin+route,{template})).status,502)
    })
  })
})

test('task planning sends only the task and rejects an unsupported model focus',async()=>{
  let focus='quiet'
  let messages:{role:string;content:string}[]=[]
  await serve(async(req,res)=>{
    let text=''
    for await(const chunk of req)text+=chunk
    messages=JSON.parse(text).messages
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({focus})}}]}))
  },async(upstream)=>{
    await serve(middleware({S8MINI_LLM_URL:upstream,S8MINI_LLM_MODEL:'fixture'}),async(origin)=>{
      const payload={operation:'plan-task',task:'室友门外能听见什么？',proof:'内部备注'}
      assert.deepEqual(await (await post(origin+route,payload)).json(),{mode:'llm',focus:'quiet'})
      assert.equal(messages[1].content,payload.task)
      focus='invented'
      assert.equal((await post(origin+route,payload)).status,502)
      assert.equal((await post(origin+route,{...payload,task:' '})).status,400)
    })
  })
})
