import type {Material} from './video-analysis'
type StoredMaterial={report:Material;file?:File}
function openStore(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('s8mini-video-materials',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('materials')
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  })
}
async function transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>){
  const db=await openStore()
  try{return await new Promise<T>((resolve,reject)=>{
    const tx=db.transaction('materials',mode)
    const request=run(tx.objectStore('materials'))
    tx.oncomplete=()=>resolve(request.result)
    tx.onabort=()=>reject(tx.error)
    tx.onerror=()=>reject(tx.error)
  })}finally{db.close()}
}
export const listMaterials=()=>transaction<StoredMaterial[]>('readonly',s=>s.getAll())
export const saveMaterial=(report:Material,file?:File)=>transaction('readwrite',s=>s.put({report,file},report.id))
export const removeMaterial=(id:string)=>transaction('readwrite',s=>s.delete(id))
