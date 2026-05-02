import prisma from '../../lib/prisma';
import { Category, GeoNode } from '@prisma/client';
import { NlpResult } from './flows/types';

const MAX_LEVENSHTEIN_DISTANCE = 3;

function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  let prevRow = Array.from({ length: bLen + 1 }, (_, i) => i);
  let currRow = new Array<number>(bLen + 1);

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;

    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      );
    }

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[bLen];
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text);

  const tokens = normalized
    .split(/[\s,;.]+/)
    .filter((t) => t.length > 0);

  const ngrams: string[] = [...tokens];

  for (let n = 2; n <= Math.min(3, tokens.length); n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
  }

  return ngrams;
}

function tryMatch<T>(
  tokens: string[],
  candidates: T[],
  getNames: (candidate: T) => string[],
): NlpResult<T> {
  let bestMatch: T | null = null;
  let bestConfidence: 'exact' | 'fuzzy' | 'none' = 'none';
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const candidateNames = getNames(candidate).map(normalizeText);

    for (const token of tokens) {
      for (const candidateName of candidateNames) {
        if (token === candidateName) {
          return { match: candidate, confidence: 'exact' };
        }

        const dist = levenshteinDistance(token, candidateName);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestMatch = candidate;
          bestConfidence = 'fuzzy';
        }
      }
    }
  }

  if (bestMatch && bestDistance <= MAX_LEVENSHTEIN_DISTANCE) {
    return { match: bestMatch, confidence: bestConfidence };
  }

  return { match: null, confidence: 'none' };
}

export class NlpService {
  private categoryCache: Category[] | null = null;
  private zoneCache: GeoNode[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL_MS = 60_000;

  private async getCategories(): Promise<Category[]> {
    const now = Date.now();
    if (this.categoryCache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.categoryCache;
    }
    this.categoryCache = await prisma.category.findMany({
      where: { isActive: true },
    });
    this.cacheTimestamp = now;
    return this.categoryCache;
  }

  private async getZones(): Promise<GeoNode[]> {
    const now = Date.now();
    if (this.zoneCache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.zoneCache;
    }
    this.zoneCache = await prisma.geoNode.findMany({
      where: { isActive: true },
    });
    this.cacheTimestamp = now;
    return this.zoneCache;
  }

  async resolveCategory(text: string): Promise<NlpResult<Category>> {
    const tokens = tokenize(text);
    const categories = await this.getCategories();

    if (categories.length === 0) {
      return { match: null, confidence: 'none' };
    }

    return tryMatch(tokens, categories, (cat) => [cat.name, cat.slug]);
  }

  async resolveZone(text: string): Promise<NlpResult<GeoNode>> {
    const tokens = tokenize(text);
    const nodes = await this.getZones();

    if (nodes.length === 0) {
      return { match: null, confidence: 'none' };
    }

    return tryMatch(tokens, nodes, (node) => [node.name]);
  }
}
