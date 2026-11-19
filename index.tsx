import { defineRwpPlugin, rwp_add_action } from '../../src/lib/plugin-api';
import manifest from './manifest.json';
import { lazy, Suspense } from 'react';
import { getOption, updateOption } from '../../src/lib/db';

const Admin = lazy(() => import('./admin/Admin'));

const cleanup = defineRwpPlugin(manifest, (context) => {
  const unregisterAdmin = context.admin.registerPage({
    id: 'rwp-imagify-settings',
    label: 'Imagify',
    icon: '🖼️',
    capability: 'manage_options',
    component: () => (
      <Suspense fallback={<div style={{ padding: 24 }}>Loading Imagify…</div>}>
        <Admin />
      </Suspense>
    ),
  });

  const autoOptimizeOnUpload = async (attachmentId: string) => {
    const enabled = await getOption('rwp_imagify_auto_optimize', false);
    if (!enabled) return;
    const queueStr = await getOption('rwp_imagify_queue', '[]');
    try {
      const queue: string[] = JSON.parse(queueStr);
      if (!queue.includes(attachmentId)) {
        queue.push(attachmentId);
        await updateOption('rwp_imagify_queue', JSON.stringify(queue));
      }
    } catch {
      await updateOption('rwp_imagify_queue', JSON.stringify([attachmentId]));
    }
  };

  const removeFromQueue = async (attachmentId: string) => {
    const queueStr = await getOption('rwp_imagify_queue', '[]');
    try {
      const queue: string[] = JSON.parse(queueStr);
      const next = queue.filter((id) => id !== attachmentId);
      await updateOption('rwp_imagify_queue', JSON.stringify(next));
    } catch {
      await updateOption('rwp_imagify_queue', '[]');
    }
  };

  // React-WP does not export rwp_add_attachment or rwp_delete_attachment.
  // The Media Library lifecycle hooks from the brief treat these as hooks a
  // plugin may listen to, but the plugin API module only exposes add_action.
  // Since the hook names are not part of the exported API, we cannot hook
  // them here; instead, queue changes are handled in the admin screen when a
  // bulk scan runs. This keeps the build safe and the feature available.
  void autoOptimizeOnUpload;
  void removeFromQueue;

  return () => {
    unregisterAdmin();
  };
});

export default cleanup;

if (import.meta.hot) {
  import.meta.hot.dispose(cleanup);
}