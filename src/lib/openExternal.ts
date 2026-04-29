export async function openExternal(url: string): Promise<void> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    try {
      await openUrl(url);
    } catch (err) {
      console.error('[openExternal] openUrl failed:', err);
    }
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
