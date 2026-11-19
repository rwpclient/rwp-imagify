import { RwpAdminPageProps } from '../../../src/lib/plugin-api';
import { getSettings, saveSettings, DEFAULT_SETTINGS, enqueueAllMedia, clearQueue, getQuotaUsedMb, setQuotaUsedMb } from '../lib/imagify';
import { tryGetClient } from '../../../src/lib/db';
import { useEffect, useState } from 'react';
import styles from './Admin.module.css';

export default function Admin(_props: RwpAdminPageProps) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [queue, setQueue] = useState<string[]>([]);
  const [quota, setQuota] = useState(20);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [clientAvailable, setClientAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const dbOk = tryGetClient() !== null;
      if (mounted) setClientAvailable(dbOk);
      const s = await getSettings();
      const q = await import('../../../src/lib/db').then((m) => m.getOption('rwp_imagify_queue', '[]'));
      const qq = await getQuotaUsedMb();
      if (mounted) {
        setSettings(s);
        try {
          setQueue(JSON.parse(q));
        } catch {
          setQueue([]);
        }
        setQuota(qq);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function updateField<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
  }

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    try {
      await saveSettings(settings);
      await setQuotaUsedMb(quota);
      setMessage({ type: 'success', text: 'Settings saved.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Could not save settings.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleBulk() {
    setBusy(true);
    setMessage(null);
    try {
      const count = await enqueueAllMedia();
      const db = await import('../../../src/lib/db');
      const q = await db.getOption('rwp_imagify_queue', '[]');
      try {
        setQueue(JSON.parse(q));
      } catch {
        setQueue([]);
      }
      setMessage({ type: 'success', text: `${count} media item(s) queued for optimization.` });
    } catch {
      setMessage({ type: 'error', text: 'Could not queue media.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleClearQueue() {
    setBusy(true);
    setMessage(null);
    try {
      await clearQueue();
      setQueue([]);
      setMessage({ type: 'success', text: 'Queue cleared.' });
    } catch {
      setMessage({ type: 'error', text: 'Could not clear queue.' });
    } finally {
      setBusy(false);
    }
  }

  if (clientAvailable === false) {
    return <div className={styles.card}>The database is not available. Imagify settings cannot be loaded.</div>;
  }
  if (clientAvailable === null) {
    return <div className={styles.card}>Loading…</div>;
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Imagify Image Optimization</h1>
      <p className={styles.intro}>
        Configure compression, next-gen conversion, and background optimization for your media library.
      </p>
      {message && (
        <div className={message.type === 'success' ? styles.success : styles.error} role="status">
          {message.text}
        </div>
      )}
      <div className={styles.card}>
        <h2>Compression</h2>
        <label className={styles.field}>
          <span className={styles.label}>Mode</span>
          <select
            value={settings.compression}
            onChange={(e) => updateField('compression', e.target.value as 'smart' | 'lossless')}
            className={styles.select}
          >
            <option value="smart">Smart Compression (recommended)</option>
            <option value="lossless">Lossless Compression</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Maximum width (pixels)</span>
          <input
            type="number"
            min={1}
            max={2560}
            value={settings.maxWidth}
            onChange={(e) => updateField('maxWidth', Number(e.target.value) || 1)}
            className={styles.input}
          />
        </label>
      </div>
      <div className={styles.card}>
        <h2>Next-Gen Formats</h2>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={settings.convertWebp}
            onChange={(e) => updateField('convertWebp', e.target.checked)}
          />
          <span>Convert to WebP</span>
        </label>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={settings.convertAvif}
            onChange={(e) => updateField('convertAvif', e.target.checked)}
          />
          <span>Convert to AVIF</span>
        </label>
      </div>
      <div className={styles.card}>
        <h2>Automation</h2>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={settings.autoOptimize}
            onChange={(e) => updateField('autoOptimize', e.target.checked)}
          />
          <span>Auto-optimize on upload</span>
        </label>
      </div>
      <div className={styles.card}>
        <h2>Background Bulk Optimization</h2>
        <p className={styles.hint}>Queue the entire media library. Processing runs asynchronously.</p>
        <div className={styles.bulkActions}>
          <button type="button" onClick={handleBulk} disabled={busy} className={styles.primary}>
            {busy ? 'Queuing…' : 'Queue All Media'}
          </button>
          <button type="button" onClick={handleClearQueue} disabled={busy} className={styles.secondary}>
            Clear Queue
          </button>
        </div>
        <p aria-live="polite" className={styles.queueStatus}>
          {queue.length} item(s) in queue
        </p>
      </div>
      <div className={styles.card}>
        <h2>Monthly Quota</h2>
        <label className={styles.field}>
          <span className={styles.label}>Used this month (MB)</span>
          <input
            type="number"
            min={0}
            value={quota}
            onChange={(e) => setQuota(Number(e.target.value) || 0)}
            className={styles.input}
          />
        </label>
        <p className={styles.hint}>Free plan includes up to 20 MB per month.</p>
      </div>
      <div className={styles.saveBar}>
        <button type="button" onClick={handleSave} disabled={busy} className={styles.primary}>
          {busy ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}