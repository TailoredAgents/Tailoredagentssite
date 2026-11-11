export const DICTATION_SECONDS=120;
export const DICTATION_RATE=16000;
export const DICTATION_MAX_BYTES=44+DICTATION_SECONDS*DICTATION_RATE*2;
/** A fixed PCM WAV makes duration enforceable from bytes, not untrusted container metadata. */
export function dictationWav(samples:Float32Array):Uint8Array{
 if(samples.length<1600||samples.length>DICTATION_SECONDS*DICTATION_RATE)throw Error('Record between a tenth of a second and two minutes.');
 const result=new Uint8Array(44+samples.length*2),v=new DataView(result.buffer),text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)v.setUint8(offset+i,value.charCodeAt(i));};
 text(0,'RIFF');v.setUint32(4,result.length-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,DICTATION_RATE,true);v.setUint32(28,DICTATION_RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
 for(let n=0;n<samples.length;n++){const sample=Math.max(-1,Math.min(1,samples[n]));v.setInt16(44+n*2,sample<0?sample*32768:sample*32767,true);}return result;
}
export function dictationDuration(bytes:Uint8Array){
 if(bytes.length<44+3200||bytes.length>DICTATION_MAX_BYTES||(bytes.length-44)%2)throw Error('Record a short voice note up to two minutes.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(offset:number,length:number)=>String.fromCharCode(...bytes.slice(offset,offset+length));
 if(text(0,4)!=='RIFF'||text(8,8)!=='WAVEfmt '||text(36,4)!=='data'||v.getUint32(4,true)!==bytes.length-8||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(22,true)!==1||v.getUint32(24,true)!==DICTATION_RATE||v.getUint32(28,true)!==DICTATION_RATE*2||v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||v.getUint32(40,true)!==bytes.length-44)throw Error('Use the assistant’s voice-note recorder.');
 return (bytes.length-44)/(DICTATION_RATE*2);
}
export type DictationResult={id:string;status:string;transcript:string|null;cost:number;expiresAt:string;note:string};
