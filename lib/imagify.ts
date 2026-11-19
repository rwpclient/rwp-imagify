import { client } from '../../../src/lib/db';
import { getOption, updateOption } from '../../../src/lib/db';

export type ImagifySettings = {
  compression: 'smart' | 'lossless';
  convertWebp: boolean;
  convertAvif: boolean;
  maxWidth: number;
  autoOptimize: boolean;
};

export const DEFAULT_SETTINGS: ImagifySettings = {
  compression: 'smart',
  convertWebp: true,
  convertAvif: false,
  maxWidth: 2560,
  autoOptimize: false,
};

export type OptimizationRecord = {
  id: string;
  media_id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  webp_requested: boolean;
  avif_requested: boolean;
  created_at: string;
};

export async function getSettings(): Promise<ImagifySettings> {
  const stored = await getOption('rwp_imagify_settings', null);
  if (!stored) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(next: ImagifySettings): Promise<void> {
  await updateOption('rwp_imagify_settings', JSON.stringify(next));
  await updateOption('rwp_imagify_auto_optimize', next.autoOptimize);
}

export async function enqueueAllMedia(): Promise<number> {
  const existing = await client.from('media').select('id').order('created_at', { ascending: true });
  const ids = (existing.data ?? []).map((row: { id: string }) => row.id);
  if (ids.length === 0) return 0;
  const queueStr = await getOption('rwp_imagify_queue', '[]');
  let queue: string[] = [];
  try {
    queue = JSON.parse(queueStr);
  } catch {
    queue = [];
  }
  for (const id of ids) {
    if (!queue.includes(id)) queue.push(id);
  }
  await updateOption('rwp_imagify_queue', JSON.stringify(queue));
  return ids.length;
}

export async function clearQueue(): Promise<void> {
  await updateOption('rwp_imagify_queue', '[]');
}

export async function getQuotaUsedMb(): Promise<number> {
  const quotaStr = await getOption('rwp_imagify_quota_mb', '20');
  return Number(quotaStr) || 20;
}

export async function setQuotaUsedMb(mb: number): Promise<void> {
  await updateOption('rwp_imagify_quota_mb', String(mb));
}