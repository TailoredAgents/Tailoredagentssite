export function safeReturnTo(value:unknown){
 // eslint-disable-next-line no-control-regex -- Reject control characters in redirect input.
 if(typeof value!=='string'||value.length>5000||/[\u0000-\u0020\u007f\\]/.test(value))return undefined;
 if(!value.startsWith('/')||value.startsWith('//'))return undefined;
 const url=new URL(value,'https://local.invalid');
 if(url.origin==='https://local.invalid'&&(url.pathname.startsWith('/dashboard/')||url.pathname==='/dashboard'||url.pathname==='/oauth/operations/authorize'))return url.pathname+url.search;
 return undefined;
}
