import {cp,mkdir,rm,writeFile} from 'node:fs/promises'

await rm('dist/assets',{recursive:true,force:true})
await rm('dist/index.html',{force:true})
await mkdir('dist/server',{recursive:true})
await cp('server/gpt-script.mjs','dist/server/index.js')
await cp('server/commerce-prompts.mjs','dist/server/commerce-prompts.mjs')
await writeFile('dist/server/wrangler.json',JSON.stringify({
  main:'index.js',compatibility_date:'2026-05-15',
  assets:{directory:'../client',binding:'ASSETS'}
},null,2)+'\n')
