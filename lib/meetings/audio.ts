import {parseBuffer} from 'music-metadata';
import {MAX_AUDIO_BYTES} from './contract';
export function pcmWav(bytes:Uint8Array,rate:number){
 if(![8000,16000].includes(rate)||bytes.length%2||bytes.length>MAX_AUDIO_BYTES-44)throw new Error('Invalid PCM audio.');
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+bytes.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(bytes.length,40);return Buffer.concat([h,bytes]);
}
export async function inspectAudio(bytes:Uint8Array){
 if(bytes.length<44||bytes.length>MAX_AUDIO_BYTES)throw new Error('Invalid audio size.');
 const b=Buffer.from(bytes);let mime:string,extension:string;
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE'){mime='audio/wav';extension='wav';}
 else if(b.toString('ascii',0,3)==='ID3'||(b[0]===255&&(b[1]&224)===224)){mime='audio/mpeg';extension='mp3';}
 else if(b.toString('ascii',4,8)==='ftyp'){mime='audio/mp4';extension='m4a';}
 else if(b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))){mime='audio/webm';extension='webm';}
 else throw new Error('Unsupported audio format.');
 const info=await parseBuffer(b,{mimeType:mime,size:b.length},{duration:true,skipCovers:true});
 const seconds=info.format.duration;
 if(!seconds||!Number.isFinite(seconds)||seconds<0.1||seconds>3600||!info.format.numberOfChannels||info.format.numberOfChannels>2)throw new Error('Use mono or stereo audio up to 60 minutes.');
 return {mime,extension,seconds};
}
