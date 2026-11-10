import {AsyncLocalStorage} from 'node:async_hooks';
export const chatLease=new AsyncLocalStorage<{turnId:string;token:string}>();
