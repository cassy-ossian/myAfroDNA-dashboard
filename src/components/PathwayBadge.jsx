import { Phone, Building2, GitMerge, AlertCircle } from 'lucide-react';
import { PATHWAY, PATHWAY_LABELS } from '../data/contactPathway';

const CONFIG = {
  [PATHWAY.DIRECT]:   { Icon: Phone,       color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  [PATHWAY.PROVIDER]: { Icon: Building2,   color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200'   },
  [PATHWAY.BOTH]:     { Icon: GitMerge,    color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  [PATHWAY.NONE]:     { Icon: AlertCircle, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200'  },
};

// size: 'xs' | 'sm' | 'md'
// showLabel: shows the text label alongside the icon
export default function PathwayBadge({ pathway, size = 'sm', showLabel = false }) {
  if (!pathway) return null;
  const cfg = CONFIG[pathway] || CONFIG[PATHWAY.NONE];
  const { Icon, color, bg, border } = cfg;
  const iconSize = size === 'xs' ? 11 : size === 'sm' ? 13 : 15;

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${bg} ${border} ${color}`}
        title={PATHWAY_LABELS[pathway]}
      >
        <Icon size={iconSize} />
        {PATHWAY_LABELS[pathway]}
      </span>
    );
  }

  return (
    <span title={PATHWAY_LABELS[pathway]} className="inline-flex items-center">
      <Icon size={iconSize} className={color} />
    </span>
  );
}
