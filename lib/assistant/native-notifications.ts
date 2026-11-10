'use client';
/** Native accepts only these actions from the first-party top frame; no tokens enter JS. */
export function nativeNotificationAction(action:'sync'|'signOut'){
 const bridge=(window as Window & {webkit?:{messageHandlers?:{taAssistantPush?:{postMessage:(value:{action:string})=>void}}}}).webkit?.messageHandlers?.taAssistantPush;
 bridge?.postMessage({action});
}
