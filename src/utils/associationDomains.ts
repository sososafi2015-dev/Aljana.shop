export const ALL_ASSOCIATION_DOMAINS = 'جميع المجالات' as const;

export const ASSOCIATION_SPECIFIC_DOMAINS = [
  'المجالات الاجتماعية والإنسانية',
  'التعليم والتربية والتكوين',
  'الصحة والتوعية الصحية',
  'التنمية المحلية والمجالية',
  'البيئة وحماية الطبيعة',
  'الشباب والطفولة',
  'الأسرة وقضايا الرجل والمرأة والأطفال',
  'الرياضة',
  'الثقافة والفنون',
  'الاقتصاد والتشغيل',
  'حقوق الإنسان والمواطنة وحماية المستهلك',
  'التكنولوجيا والإبتكار والدكاء الإصطناعي',
  'السياحة والتراث',
  'الفلاحة والمجالات القروية',
  'الأشخاص ذوو الإعاقة والإدماج',
  'السلامة والوقاية والإغاثة',
  'الدين والقيم والأعمال الخيرية',
  'البحث والدراسات والتطوير',
  'الصناعة والتجارة والخدمات',
  'الملاحة والصيد البحري',
  'الصناعة التقليدية',
  'مجالات أخرى متخصصة',
] as const;

export const ASSOCIATION_DOMAIN_OPTIONS: readonly string[] = [
  ALL_ASSOCIATION_DOMAINS,
  ...ASSOCIATION_SPECIFIC_DOMAINS,
];

export const DEFAULT_ASSOCIATION_DOMAINS: string[] = [ALL_ASSOCIATION_DOMAINS];

const VALID_DOMAINS_SET = new Set<string>(ASSOCIATION_DOMAIN_OPTIONS);

const LEGACY_ASSOCIATION_DOMAIN_ALIASES: Record<string, string> = {
  'المرأة والأسرة': 'الأسرة وقضايا الرجل والمرأة والأطفال',
  'حقوق الإنسان والمواطنة': 'حقوق الإنسان والمواطنة وحماية المستهلك',
  'الصيد البحري': 'الملاحة والصيد البحري',
  'التكنولوجيا والابتكار الرقمي': 'التكنولوجيا والإبتكار والدكاء الإصطناعي',
};

/**
 * Normalizes association domain selections:
 * - Defaults to ['جميع المجالات'] when empty/missing.
 * - Maps previous domain names seamlessly to updated names without data loss.
 * - Ensures 'جميع المجالات' is never combined with specific domains (zero conflict).
 * - Deduplicates and preserves canonical list ordering.
 */
export function normalizeAssociationDomains(value?: string[] | null): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [ALL_ASSOCIATION_DOMAINS];
  }

  const uniqueSpecific = new Set<string>();
  let hasAll = false;

  for (const rawItem of value) {
    if (typeof rawItem !== 'string') continue;
    const trimmed = rawItem.trim();
    if (!trimmed) continue;
    const item = LEGACY_ASSOCIATION_DOMAIN_ALIASES[trimmed] || trimmed;
    if (!VALID_DOMAINS_SET.has(item)) continue;
    if (item === ALL_ASSOCIATION_DOMAINS) {
      hasAll = true;
    } else {
      uniqueSpecific.add(item);
    }
  }

  if (uniqueSpecific.size > 0) {
    return ASSOCIATION_SPECIFIC_DOMAINS.filter((d) => uniqueSpecific.has(d));
  }

  if (hasAll) {
    return [ALL_ASSOCIATION_DOMAINS];
  }

  return [ALL_ASSOCIATION_DOMAINS];
}

/**
 * Toggles a domain inside the current selection:
 * - Selecting 'جميع المجالات' switches exclusively to ['جميع المجالات'].
 * - Selecting any specific domain removes 'جميع المجالات' and toggles that domain.
 * - Deselecting the last specific domain automatically falls back to ['جميع المجالات'].
 */
export function toggleAssociationDomain(current: string[] | undefined | null, domain: string): string[] {
  const cleanDomain = String(domain || '').trim();
  if (!VALID_DOMAINS_SET.has(cleanDomain)) {
    return normalizeAssociationDomains(current);
  }

  if (cleanDomain === ALL_ASSOCIATION_DOMAINS) {
    return [ALL_ASSOCIATION_DOMAINS];
  }

  const normalized = normalizeAssociationDomains(current);
  const specificSet = new Set(normalized.filter((d) => d !== ALL_ASSOCIATION_DOMAINS));

  if (specificSet.has(cleanDomain)) {
    specificSet.delete(cleanDomain);
  } else {
    specificSet.add(cleanDomain);
  }

  if (specificSet.size === 0) {
    return [ALL_ASSOCIATION_DOMAINS];
  }

  return ASSOCIATION_SPECIFIC_DOMAINS.filter((d) => specificSet.has(d));
}
