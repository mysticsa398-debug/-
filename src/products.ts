import type {DB, Fact, Version} from './domain.ts'

export type Product = {
  id: string
  name: string
  category: string
  url: string
  notes: string
  demo: string
}

export const defaultProduct: Product = {
  id: 'dr-flash-s8mini',
  name: 'Dr.flash S8mini 吹风机',
  category: '高速吹风机',
  url: 'https://s8mini-insight-studio.mystic-mr.chatgpt.site/',
  notes: '资料待核对：脚本优化报告记录 295g、2 亿级负离子；产品亮点图记录 280g（不含线）和 10 亿级负离子。请按在售 SKU 核对称重口径和检测报告。11 万转、温控、风速与售后权益也须核对对应证据。',
  demo: '旅行与家用：用装好衣物的旅行包拍放入、理线和合包，回家拍取出使用。早起通勤：拍出门前的湿发与时间压力，从发根到发尾实拍吹发过程。比较前后状态时用同一发束、同一光线与同一机位，保留真实结果。'
}

export const productsFor = (db: DB) => db.products ?? [defaultProduct]
export const productOf = (record: Fact | Version | undefined) => record?.productId ?? defaultProduct.id
export const productFacts = (db: DB, id: string) => db.facts.filter(f => productOf(f) === id)

export function productWorkspace(db: DB, id: string): DB {
  const facts = productFacts(db, id)
  const scripts = db.scripts.flatMap(script => {
    const versions = script.versions.filter(version => productOf(version) === id)
    return versions.length ? [{...script, versions}] : []
  })
  return {
    ...db, facts, scripts,
    matches: db.matches.filter(match => facts.some(fact => fact.id === match.fact)),
    rules: id === defaultProduct.id ? db.rules : [],
    designs: id === defaultProduct.id ? db.designs : []
  }
}
