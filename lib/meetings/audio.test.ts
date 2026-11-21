import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {pcmWav,inspectAudio,splitOmiWav} from './audio';
import {validateMeetingAnalysis} from './provider';
import {validFactoryObjectKey} from '@/lib/factory/storage';
describe('Meeting audio and evidence boundaries',()=>{
 it.each([8000,16000])('splits canonical PCM at %i Hz without changing audio or billed minutes',rate=>{
  const samples=Buffer.alloc(rate*2*481,2),parts=splitOmiWav(pcmWav(samples,rate));expect(parts).toHaveLength(3);expect(Buffer.concat(parts.map(p=>p.subarray(44))).equals(samples)).toBe(true);expect(parts.reduce((s,p)=>s+Math.ceil((p.length-44)/(rate*2*60)),0)).toBe(Math.ceil(481/60));
 });
 it('rejects invalid Omi WAV headers rather than slicing arbitrary media',()=>{
  for(const offset of [4,16,20,22,24,28,32,34,36,40]){const wav=pcmWav(Buffer.alloc(32000),16000);wav[offset]^=128;expect(()=>splitOmiWav(wav)).toThrow('invalid_audio');}
 });
 it('wraps documented Omi PCM16 in a playable WAV and computes duration',async()=>{const wav=pcmWav(Buffer.alloc(32000),16000);expect(wav.toString('ascii',0,4)).toBe('RIFF');expect(await inspectAudio(wav)).toMatchObject({seconds:1,mime:'audio/wav'});});
 it.each([0,44100,48000])('rejects undocumented Omi sample rate %s',rate=>expect(()=>pcmWav(Buffer.alloc(20),rate)).toThrow());
 it('rejects odd PCM frames and empty/truncated media',async()=>{expect(()=>pcmWav(Buffer.alloc(3),16000)).toThrow();await expect(inspectAudio(Buffer.from('fake audio.wav'))).rejects.toThrow();});
 it('does not accept arbitrary file types or oversized bodies',async()=>{await expect(inspectAudio(Buffer.alloc(300))).rejects.toThrow();await expect(inspectAudio(Buffer.alloc(24_000_001))).rejects.toThrow();});
 it('requires exact evidence for stated facts',()=>{expect(()=>validateMeetingAnalysis({summary:'Business discussion',findings:[{category:'tool',detail:'Uses Excel',evidence:'We use Excel.',basis:'stated'}]},'We use Outlook.')).toThrow();});
 it('keeps suggestions separate and preserves evidence',()=>{const x=validateMeetingAnalysis({summary:'Review',findings:[{category:'tool',detail:'Excel',evidence:'We use Excel.',basis:'stated'},{category:'opportunity',detail:'Explore an import workflow.',evidence:'',basis:'suggestion'}]},'We use Excel.');expect(x.findings[1].basis).toBe('suggestion');});
 it('accepts only private meeting audio keys, never arbitrary namespace files',()=>{const root='meetings/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/audio/';expect(validFactoryObjectKey(root+'recording.wav')).toBe(root+'recording.wav');for(const suffix of ['../outside','index.html','recording.exe','recording.wav/extra'])expect(()=>validFactoryObjectKey(root+suffix)).toThrow();});
});
