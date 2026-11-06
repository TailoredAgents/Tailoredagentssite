import {describe,it,expect} from 'vitest';
import {campaignDetails,campaigns} from './catalog';
import {capacityEstimate} from './insurance';
import {freightExample} from './freight';
describe('Freight campaign calculations and routing',()=>{
 it('measures shipment capacity without implying all paperwork disappears',()=>{
  expect(capacityEstimate(1000,12,4,30)?.hours).toBeCloseTo(8000/60);
  expect(capacityEstimate(1000,12,4,30)?.capacityValue).toBeCloseTo(4000);
  expect(capacityEstimate(0,12,4,30)?.hours).toBe(0);
  expect(capacityEstimate(1000,4,12,30)?.capacityValue).toBeCloseTo(-4000);
  expect(capacityEstimate(Number.NaN,12,4,30)).toBeNull();
 });
 it('has a $160 sample exception and separate links for the three sellers',()=>{
  expect(freightExample.invoiceCents-freightExample.rateCents).toBe(freightExample.receiptCents);
  expect(campaigns['freight-automation'].people).toEqual(['austin','jeffrey','devon']);
  expect(campaignDetails('commercial-insurance')?.prefix).toBe('insurance');
  expect(campaignDetails('freight-automation')?.prefix).toBe('freight');
  expect(campaignDetails('__proto__')).toBeNull();expect(campaignDetails('invalid')).toBeNull();
 });
});
