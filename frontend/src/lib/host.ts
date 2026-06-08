export type HostContext = 'all' | 'landing' | 'admin' | 'app';

export function resolveHostContext(): HostContext {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'all';
  }

  if (hostname.startsWith('admin.')) return 'admin';
  if (hostname.startsWith('app.')) return 'app';
  if (hostname === 'noraconecta.local' || hostname === 'www.noraconecta.local') {
    return 'landing';
  }

  return 'all';
}

export function getAdminDashboardPath(): string {
  return '/admin';
}
