/** Keep keyboard focus inside the composer and restore it when the dialog closes. */
export function focusTrap(node:HTMLElement){
 const previous=document.activeElement as HTMLElement|null;
 const targets=()=>[...node.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[contenteditable="true"],[tabindex]')].filter(e=>e.tabIndex>=0&&!e.hasAttribute('disabled')&&e.getClientRects().length>0);
 let active=true;
 queueMicrotask(()=>{if(!active||node.contains(document.activeElement))return;(node.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([type="file"])')??targets()[0])?.focus();});
 const key=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const all=targets(),index=all.indexOf(document.activeElement as HTMLElement);if(!all.length){event.preventDefault();node.focus();return;}if(event.shiftKey&&index<=0){event.preventDefault();all.at(-1)!.focus();}else if(!event.shiftKey&&index===all.length-1){event.preventDefault();all[0].focus();}};
 node.addEventListener('keydown',key);
 return {destroy(){active=false;node.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();}};
}
