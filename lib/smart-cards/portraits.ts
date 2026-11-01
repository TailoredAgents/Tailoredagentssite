import type {StaticImageData} from 'next/image';
import austinHeadshot from '@/public/team/austin-dugger.png';

// Keep the profile and shared-link artwork on the same approved portrait.
export const cardPortraits: Partial<Record<string, {image: StaticImageData; publicPath: string}>> = {
  austin: {image: austinHeadshot, publicPath: 'team/austin-dugger.png'},
};
