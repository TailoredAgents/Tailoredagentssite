import {describe,it,expect} from 'vitest';
import {dictationWav,dictationDuration,DICTATION_MAX_BYTES} from './dictation-contract';
describe('Bounded voice-note audio',()=>{
 it('computes duration from fixed PCM bytes and rejects a forged duration header',()=>{const wav=dictationWav(new Float32Array(32000));expect(dictationDuration(wav)).toBe(2);new DataView(wav.buffer).setUint32(24,8000,true);expect(()=>dictationDuration(wav)).toThrow();});
 it('rejects oversized, truncated, arbitrary and too-short input before any paid work',()=>{for(const bytes of [new Uint8Array(DICTATION_MAX_BYTES+2),new Uint8Array(44),new TextEncoder().encode('not audio'),dictationWav(new Float32Array(16000)).slice(0,-2)])expect(()=>dictationDuration(bytes)).toThrow();expect(()=>dictationWav(new Float32Array(1920001))).toThrow();});
});
