import {defineConfig,loadEnv} from 'vite'
import tailwind from '@tailwindcss/vite'
import {scriptProxy} from './server/script-proxy.mjs'

export default defineConfig(({mode})=>({
  plugins:[tailwind(),scriptProxy(loadEnv(mode,process.cwd(),'S8MINI_LLM_'))],
  esbuild:{jsx:'automatic'}
}))
