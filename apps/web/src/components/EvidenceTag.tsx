import type { EvidenceTag } from '@/features/leases/types';

const LABELS: Record<EvidenceTag, string> = {
  'saved-unrecorded': '已保存，待提交记录',
  submitted: '已提交（链上承诺待确认）',
  acknowledged: '双方已回应 / 认可标记',
  objected: '对方有异议',
  unilateral: '单方上传',
};

export function EvidenceTagChip({ tag }: { tag: EvidenceTag }) {
  return <span className="tag">{LABELS[tag]}</span>;
}
