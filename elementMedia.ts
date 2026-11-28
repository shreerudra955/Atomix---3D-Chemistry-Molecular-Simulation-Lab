import { ElementData } from '../types/chemistry';

export interface ElementPhoto {
  id: string;
  title: string;
  caption: string;
  kind: 'sample' | 'mineral' | 'application' | 'laboratory';
  thumbUrl: string;
  fullUrl: string;
  sourceLabel: string;
}

export interface ElementMediaResult {
  photos: ElementPhoto[];
  wikiPageTitle: string;
  isSyntheticNoBulkSample: boolean;
  error?: string;
}

interface WikiSrcSetEntry {
  src: string;
  scale?: string;
}

interface WikiMediaItem {
  title?: string;
  leadImage?: boolean;
  type?: string;
  showInGallery?: boolean;
  srcset?: WikiSrcSetEntry[];
  caption?: {
    text?: string;
    html?: string;
  };
}

interface WikiMediaListResponse {
  items?: WikiMediaItem[];
}

interface WikiSummaryResponse {
  type?: string;
  title?: string;
  description?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

const WIKIPEDIA_TITLE_OVERRIDES: Record<number, string> = {
  80: 'Mercury_(element)',
};

const EXCLUDED_FILENAME_PATTERN =
  /(\.svg$|\.ogv$|\.webm$|diagram|phase_diagram|crystal_structure|lattice|closest_packing|3d-balls|balls\.png|isotopes\.png|_acid\.png|blausen|clathrate|cross_section|schematic|chart|graph|map|flag|logo|icon|seal|coat_of_arms|signature|stamp|portrait|portret|painting|engraving|bust|monument|statue|gravestone|periodic_table|periodensystem|periodisches_system|electron_shell|orbital|decay_chain|abundance|world_production|pie_chart|spectrum|spectra|emission_lines|absorption|kopernikus|lavoisier|priestley|seaborg|ghiorso|einstein1921|segre|curie_and_radium|rutherford|mendeleev)/i;

const EXCLUDED_CAPTION_PATTERN =
  /(portrait of|painted by|engraving of|statue of|memorial|stamp|postage|coat of arms|3d balls|ball-and-stick|phase diagram|crystal structure|crystal lattice|closest packing|isotopes of|chemical structure|skeletal formula|periodic system|schematic|emission spectrum|electron configuration|world production|abundance of)/i;

const MINERAL_OR_COMPOUND_PATTERN =
  /(ore|mineral|crystal|quartz|cinnabar|galena|bauxite|pyrite|hematite|malachite|fluorite|halite|chloride|oxide|sulfide|hydride|nitrate|salt|solution|flame)/i;

const APPLICATION_PATTERN =
  /(sign|lamp|bulb|laser|battery|reactor|alloy|wire|foil|coins|bullion|ingot|bar|mirror|telescope|aircraft|engine|medical|smoke detector|fertilizer|glass|steel|bridge|jewelry|ring|catalyst|rocket|welding|magnet)/i;

const LAB_PATTERN =
  /(accelerator|cyclotron|collider|laboratory|cern|dubna|gsi|riken|detector|target|experiment)/i;

const mediaCache = new Map<number, ElementMediaResult>();
const inFlightRequests = new Map<number, Promise<ElementMediaResult>>();

function normalizeWikiUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function cleanTitleToCaption(rawTitle: string, element: ElementData, isLead: boolean): string {
  const withoutPrefix = rawTitle.replace(/^File:/i, '');
  const withoutExt = withoutPrefix.replace(/\.[a-z0-9]+$/i, '');
  const readable = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (isLead) {
    if (readable.length > 3 && readable.length < 70) {
      return `${element.name} (${element.symbol}) — ${readable}`;
    }
    return `Pure ${element.name} (${element.symbol}) real-life sample`;
  }
  return readable || `${element.name} real-life photograph`;
}

function classifyPhotoKind(title: string, caption: string, isLead: boolean): ElementPhoto['kind'] {
  if (isLead) return 'sample';
  const combined = `${title} ${caption}`;
  if (LAB_PATTERN.test(combined)) return 'laboratory';
  if (APPLICATION_PATTERN.test(combined)) return 'application';
  if (MINERAL_OR_COMPOUND_PATTERN.test(combined)) return 'mineral';
  return 'application';
}

function scoreMediaItem(item: WikiMediaItem): number {
  const title = item.title || '';
  const caption = item.caption?.text || '';
  let score = 0;

  if (item.leadImage) score += 100;
  if (/\.(jpe?g|webp)$/i.test(title)) score += 30;
  if (/(sample|crystal|nugget|ingot|discharge|tube|metal|liquid|flame|ore|mineral|pure)/i.test(`${title} ${caption}`)) {
    score += 20;
  }
  if (APPLICATION_PATTERN.test(`${title} ${caption}`)) score += 12;
  if (/\.png$/i.test(title)) score -= 15;
  if (caption.trim().length > 10) score += 5;

  return score;
}

function extractUrls(item: WikiMediaItem): { thumbUrl: string; fullUrl: string } | null {
  const srcset = item.srcset?.filter((s) => Boolean(s?.src)) || [];
  if (srcset.length === 0) return null;

  const first = normalizeWikiUrl(srcset[0].src);
  const largest = normalizeWikiUrl(srcset[srcset.length - 1].src);
  return {
    thumbUrl: first,
    fullUrl: largest || first,
  };
}

async function fetchJsonSafe<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    return null;
  }
  return (await res.json()) as T;
}

async function fetchFromWikipediaTitle(
  element: ElementData,
  wikiTitle: string,
  signal?: AbortSignal
): Promise<ElementPhoto[]> {
  const mediaUrl = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(wikiTitle)}`;
  const mediaData = await fetchJsonSafe<WikiMediaListResponse>(mediaUrl, signal);

  const items = mediaData?.items || [];
  const filtered = items
    .filter((item) => {
      if (item.type !== 'image' || !item.showInGallery) return false;
      const title = item.title || '';
      const caption = item.caption?.text || '';
      if (!/\.(jpe?g|webp|png)$/i.test(title)) return false;
      if (EXCLUDED_FILENAME_PATTERN.test(title)) return false;
      if (caption && EXCLUDED_CAPTION_PATTERN.test(caption)) return false;
      return Boolean(extractUrls(item));
    })
    .sort((a, b) => scoreMediaItem(b) - scoreMediaItem(a));

  const seenUrls = new Set<string>();
  const photos: ElementPhoto[] = [];

  for (const item of filtered) {
    const urls = extractUrls(item);
    if (!urls || seenUrls.has(urls.thumbUrl)) continue;
    seenUrls.add(urls.thumbUrl);

    const rawTitle = item.title || '';
    const isLead = Boolean(item.leadImage);
    const captionText = item.caption?.text?.trim();
    const caption = captionText || cleanTitleToCaption(rawTitle, element, isLead);

    photos.push({
      id: `${element.atomicNumber}-${photos.length}-${rawTitle}`,
      title: rawTitle.replace(/^File:/i, '').replace(/[_-]+/g, ' ').replace(/\.[a-z0-9]+$/i, ''),
      caption,
      kind: classifyPhotoKind(rawTitle, caption, isLead),
      thumbUrl: urls.thumbUrl,
      fullUrl: urls.fullUrl,
      sourceLabel: 'Wikimedia Commons',
    });

    if (photos.length >= 6) break;
  }

  // Fallback to page summary lead thumbnail if media-list yielded zero usable photos
  if (photos.length === 0) {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
    const summary = await fetchJsonSafe<WikiSummaryResponse>(summaryUrl, signal);
    const thumb = summary?.thumbnail?.source ? normalizeWikiUrl(summary.thumbnail.source) : '';
    const orig = summary?.originalimage?.source ? normalizeWikiUrl(summary.originalimage.source) : thumb;
    if (thumb && !EXCLUDED_FILENAME_PATTERN.test(thumb) && summary?.type !== 'disambiguation') {
      photos.push({
        id: `${element.atomicNumber}-summary-lead`,
        title: `${element.name} (${element.symbol})`,
        caption: `Real-life sample of ${element.name} (${element.symbol})`,
        kind: 'sample',
        thumbUrl: thumb,
        fullUrl: orig || thumb,
        sourceLabel: 'Wikimedia Commons',
      });
    }
  }

  return photos;
}

export async function fetchElementRealLifePhotos(
  element: ElementData
): Promise<ElementMediaResult> {
  const cached = mediaCache.get(element.atomicNumber);
  if (cached && !cached.error) {
    return cached;
  }

  const existingPromise = inFlightRequests.get(element.atomicNumber);
  if (existingPromise) {
    return existingPromise;
  }

  const isSyntheticNoBulkSample = element.atomicNumber >= 100;
  const primaryTitle = WIKIPEDIA_TITLE_OVERRIDES[element.atomicNumber] || element.name;

  const task = (async (): Promise<ElementMediaResult> => {
    try {
      let wikiPageTitle = primaryTitle;
      let photos = await fetchFromWikipediaTitle(element, primaryTitle);

      if (photos.length === 0 && !WIKIPEDIA_TITLE_OVERRIDES[element.atomicNumber]) {
        const disambiguatedTitle = `${element.name}_(element)`;
        const fallbackPhotos = await fetchFromWikipediaTitle(element, disambiguatedTitle);
        if (fallbackPhotos.length > 0) {
          photos = fallbackPhotos;
          wikiPageTitle = disambiguatedTitle;
        }
      }

      const result: ElementMediaResult = {
        photos,
        wikiPageTitle,
        isSyntheticNoBulkSample,
      };
      mediaCache.set(element.atomicNumber, result);
      return result;
    } catch {
      return {
        photos: [],
        wikiPageTitle: primaryTitle,
        isSyntheticNoBulkSample,
        error: 'Unable to load element photos right now.',
      };
    } finally {
      inFlightRequests.delete(element.atomicNumber);
    }
  })();

  inFlightRequests.set(element.atomicNumber, task);
  return task;
}

export function clearElementMediaCache(atomicNumber: number): void {
  mediaCache.delete(atomicNumber);
}
