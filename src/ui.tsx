import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react'
import {Plus, X, ArrowUpRight, Inbox} from 'lucide-react'
export function PageHead({label,title,description,action,onAction,actionIcon:ActionIcon=Plus}:{label:string;title:string;description:string;action?:string;onAction?:()=>void;actionIcon?:typeof Plus}){
  return <header className="page-head"><div><div className="kicker">{label}</div><h1>{title}</h1><p>{description}</p></div>{action&&<button className="button primary" onClick={onAction}><ActionIcon size={17}/>{action}</button>}</header>
}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={'badge '+tone}>{children}</span>}
export function Empty({children}:{children:ReactNode}){return <div className="empty"><Inbox size={25}/><p>{children}</p></div>}
export function Panel({title,action,onAction,children,className=''}:{title:string;action?:string;onAction?:()=>void;children:ReactNode;className?:string}){
  return <section className={'panel '+className}><div className="panel-head"><h2>{title}</h2>{action&&<button className="text-button" onClick={onAction}>{action}<ArrowUpRight size={15}/></button>}</div>{children}</section>
}
export const NoticeContext=createContext('')
export function Modal({title,onClose,onSave,children,saveLabel='保存'}:{title:string;onClose:()=>void;onSave:()=>void;children:ReactNode;saveLabel?:string}){
  const notice=useContext(NoticeContext)
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{dialog.current?.showModal()},[])
  return <dialog ref={dialog} onCancel={e=>{e.preventDefault();onClose()}}><form onSubmit={e=>{e.preventDefault();onSave()}}><header className="modal-head"><h2>{title}</h2><button type="button" className="icon-button" aria-label="关闭" onClick={onClose}><X size={21}/></button></header><div className="modal-body">{children}</div><footer className="modal-foot">{notice&&<span className="modal-notice" role="status">{notice}</span>}<button type="button" className="button" onClick={onClose}>取消</button><button className="button primary">{saveLabel}</button></footer></form></dialog>
}
export function Field({label,value,change,options,type='text',long=false,required=false}:{label:string;value:string;change:(v:string)=>void;options?:{value:string;label:string}[];type?:string;long?:boolean;required?:boolean}){
  return <label className={long?'field wide':'field'}><span>{label}</span>{options?<select required={required} value={value} onChange={e=>change(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:long?<textarea required={required} value={value} onChange={e=>change(e.target.value)}/>:<input required={required} type={type} step={type==='number'?'any':undefined} value={value} onChange={e=>change(e.target.value)}/>}</label>
}
export const opts=(list:string[])=>list.map(value=>({value,label:value||'请选择'}))
export function Tags({label,options,value,change}:{label:string;options:string[];value:string[];change:(v:string[])=>void}){
  return <fieldset className="tag-field wide"><legend>{label}</legend><div className="tags">{options.map(o=><label key={o} className={value.includes(o)?'selected':''}><input type="checkbox" checked={value.includes(o)} onChange={()=>change(value.includes(o)?value.filter(t=>t!==o):[...value,o])}/>{o}</label>)}</div></fieldset>
}
