import 'server-only';
import {createHash} from 'node:crypto';
import type {Metadata} from 'next';
import {cardPortraits} from './portraits';
import {CARD_ORIGIN, type CardProfile} from './types';

export function cardShareMetadata(profile: CardProfile): Metadata {
  const firstName = profile.display_name.split(' ')[0];
  const title = `Connect with ${profile.display_name} | Tailored Agents`;
  const description = `Meet ${firstName}, ${profile.title} at Tailored Agents. Save their contact, explore our work, and talk to our AI assistant.`;
  // New public details or an updated photo get a fresh image URL for preview caches.
  const version = createHash('sha256').update(JSON.stringify([
    'smart-card-share-v1', profile.display_name, profile.title,
    cardPortraits[profile.slug]?.image.src ?? 'initials',
  ])).digest('hex').slice(0, 12);
  const image = {
    url: `${CARD_ORIGIN}/c/${profile.slug}/share-image?v=${version}`,
    width: 1200, height: 630, type: 'image/png',
    alt: `${profile.display_name} — ${profile.title} at Tailored Agents`,
  };
  return {
    title: {absolute: title}, description,
    alternates: {canonical: `/c/${profile.slug}`},
    openGraph: {
      type: 'website', siteName: 'Tailored Agents', title, description,
      url: `${CARD_ORIGIN}/c/${profile.slug}`, images: [image],
    },
    twitter: {card: 'summary_large_image', title, description, images: [image]},
  };
}
