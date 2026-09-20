import type {
  CreateCampaignInput,
  CreateCreatorInput
} from './admin-contracts.js';

export interface MockAsset {
  code: string;
  decimalPlaces: number;
  minimumUnits: bigint;
  maximumUnits: bigint;
}

export interface MockCampaignInput extends CreateCampaignInput {
  assetDecimalPlaces: number;
}

export const mockGenres = ['electronic', 'fashion', 'travel', 'gaming', 'fitness', 'food', 'technology', 'beauty'] as const;

const firstNames = ['Ava', 'Liam', 'Mia', 'Noah', 'Sofia', 'Ethan', 'Lena', 'Leo', 'Nora', 'Milo', 'Emilia', 'Finn'];
const creatorWords = ['Pulse', 'Current', 'Mode', 'Loop', 'Trail', 'Frame', 'Spark', 'Atlas', 'Studio', 'Signal', 'Story', 'Orbit'];
const brandWords = ['Neon', 'Analog', 'Urban', 'Bright', 'Open', 'Future', 'Wild', 'True', 'Nova', 'Echo', 'Local', 'Parallel'];
const productWords = ['Sessions', 'Headphones', 'Collection', 'Weekend', 'Launch', 'Challenge', 'Drop', 'Stories', 'Lab', 'Journey', 'Series', 'Edit'];

const assets: MockAsset[] = [
  { code: 'EUR', decimalPlaces: 2, minimumUnits: 100_000n, maximumUnits: 2_000_000n },
  { code: 'BTC', decimalPlaces: 8, minimumUnits: 1_000_000n, maximumUnits: 50_000_000n },
  { code: 'ETH', decimalPlaces: 18, minimumUnits: 500_000_000_000_000_000n, maximumUnits: 20_000_000_000_000_000_000n },
  { code: 'ZEC', decimalPlaces: 8, minimumUnits: 1_000_000_000n, maximumUnits: 50_000_000_000n }
];

export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function integer(random: () => number, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

export function formatUnits(units: bigint, decimalPlaces: number): string {
  if (decimalPlaces === 0) return units.toString();
  const padded = units.toString().padStart(decimalPlaces + 1, '0');
  return `${padded.slice(0, -decimalPlaces)}.${padded.slice(-decimalPlaces)}`;
}

export function parseUnits(value: string, decimalPlaces: number): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(decimalPlaces, '0').slice(0, decimalPlaces)}`);
}

export function generateBidAmount(budget: string, decimalPlaces: number, random: () => number): string {
  const budgetUnits = parseUnits(budget, decimalPlaces);
  const basisPoints = BigInt(integer(random, 2_500, 9_000));
  const units = (budgetUnits * basisPoints) / 10_000n;
  return formatUnits(units > 0n ? units : 1n, decimalPlaces);
}

export function generateCreator(index: number, random: () => number): CreateCreatorInput {
  const genre = mockGenres[index % mockGenres.length] ?? 'electronic';
  return {
    displayName: `${firstNames[index % firstNames.length]} ${creatorWords[Math.floor(index / firstNames.length) % creatorWords.length]} ${String(index + 1).padStart(5, '0')}`,
    genre,
    followerCount: integer(random, 5_000, 2_000_000),
    engagementRate: (1 + random() * 14).toFixed(4)
  };
}

export function generateCampaign(index: number, random: () => number, createdAt = new Date()): MockCampaignInput {
  const genre = mockGenres[index % mockGenres.length] ?? 'electronic';
  const asset = assets[index % assets.length] ?? assets[0]!;
  const range = asset.maximumUnits - asset.minimumUnits;
  const budgetUnits = asset.minimumUnits + (range * BigInt(integer(random, 0, 10_000))) / 10_000n;
  const deadlineMinutes = integer(random, 2, 60);
  return {
    title: `${brandWords[index % brandWords.length]} ${productWords[Math.floor(index / brandWords.length) % productWords.length]} ${String(index + 1).padStart(4, '0')}`,
    description: `Live demo campaign ${index + 1} for ${genre} creators.`,
    targetGenre: genre,
    minimumFollowers: integer(random, 1_000, 500_000),
    targetEngagementRate: (1 + random() * 10).toFixed(4),
    asset: asset.code,
    budget: formatUnits(budgetUnits, asset.decimalPlaces),
    biddingDeadline: new Date(createdAt.getTime() + deadlineMinutes * 60_000).toISOString(),
    assetDecimalPlaces: asset.decimalPlaces
  };
}
