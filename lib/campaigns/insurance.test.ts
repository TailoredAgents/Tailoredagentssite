import {describe,it,expect} from 'vitest';
import {capacityEstimate} from './insurance';
describe('Commercial insurance capacity estimate',()=>{
 it('subtracts staff review time and reproduces the flyer example',()=>{expect(capacityEstimate(60,30,10,40)).toEqual({hours:20,capacityValue:800});});
 it('shows zero and negative capacity without manufacturing savings',()=>{expect(capacityEstimate(0,30,10,40)?.hours).toBe(0);expect(capacityEstimate(60,10,30,40)).toEqual({hours:-20,capacityValue:-800});});
 it('rejects non-finite and negative inputs',()=>{expect(capacityEstimate(60,NaN,10,40)).toBeNull();expect(capacityEstimate(-1,30,10,40)).toBeNull();expect(capacityEstimate(60,30,10,Infinity)).toBeNull();});
});
