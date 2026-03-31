import { getCategoryStyle } from '../data/studyCategories';

/**
 * Compact colored badge showing a study ID (or short name) with category color.
 *
 * Props:
 *   study   — study object { id, shortName?, category }  OR  just a studyId string
 *   studies — map of all studies (used when `study` is a string ID)
 *   size    — 'xs' | 'sm' (default 'sm')
 *   showCategory — show category name after the ID
 */
export default function StudyBadge({ study, studies, size = 'sm', showCategory = false }) {
  // Resolve study object if a string ID was passed
  const studyObj = typeof study === 'string'
    ? (studies?.[study] ?? { id: study, shortName: study, category: 'Other' })
    : (study ?? { id: '?', shortName: '?', category: 'Other' });

  const label    = studyObj.shortName || studyObj.id;
  const category = studyObj.category ?? 'Other';
  const style    = getCategoryStyle(category);

  const sizeClass = size === 'xs'
    ? 'text-[10px] px-1.5 py-0 leading-5'
    : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded font-semibold font-mono ${sizeClass} ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      {label}
      {showCategory && <span className="font-normal ml-0.5 font-sans opacity-75">{category}</span>}
    </span>
  );
}
