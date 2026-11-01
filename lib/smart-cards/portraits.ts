import type {StaticImageData} from 'next/image';
import devonHeadshot from '@/public/team/devon-martin.png';
import austinHeadshot from '@/public/team/austin-dugger.png';
import jeffreyHeadshot from '@/public/team/jeffrey-hacker.jpeg';

// Keep the profile and shared-link artwork on the same approved portrait.
export const cardPortraits: Partial<Record<string, {image: StaticImageData; publicPath: string; mimeType: 'image/png' | 'image/jpeg'}>> = {
  devon: {image: devonHeadshot, publicPath: 'team/devon-martin.png', mimeType: 'image/png'},
  austin: {image: austinHeadshot, publicPath: 'team/austin-dugger.png', mimeType: 'image/png'},
  jeffrey: {image: jeffreyHeadshot, publicPath: 'team/jeffrey-hacker.jpeg', mimeType: 'image/jpeg'},
};
