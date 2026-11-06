// Public campaign routing and labels. Authority always comes from the saved link.
export const campaigns={
 'commercial-insurance':{
  path:'/solutions/commercial-insurance',prefix:'insurance',label:'Commercial insurance',
  people:['austin','jeffrey'],
  greeting:'Where does paperwork slow your agency down? Ask about document intake, approved updates to your systems, or follow-up workflows for submissions and renewals. Please use examples without real client information.',
  starters:['What could you automate for our agency?','Can this work with our current software?','What happens in the workflow review?'],
  messagePlaceholder:'Which part of submission prep takes the most time? Please leave out private client or policy information.',
 },
 'freight-automation':{
  path:'/solutions/freight-automation',prefix:'freight',label:'Freight & 3PL',
  people:['austin','jeffrey','devon'],
  greeting:'Where does paperwork slow your freight operation down? Ask about POD collection, invoice checks, billing readiness or carrier packets. Use examples without private shipment or customer information.',
  starters:['How could you automate our freight paperwork?','Can this work alongside our TMS?','What happens in the workflow review?'],
  messagePlaceholder:'What slows down your document or billing workflow? Mention your systems and approximate volume if useful. Leave out confidential shipment, customer or carrier details.',
 },
} as const;
export type CampaignId=keyof typeof campaigns;
export function campaignDetails(value:string|null|undefined){
 return value&&Object.hasOwn(campaigns,value)?campaigns[value as CampaignId]:null;
}
