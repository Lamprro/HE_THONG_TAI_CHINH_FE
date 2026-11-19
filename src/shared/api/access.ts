export type AdminAction = 'create-job' | 'edit-job' | 'run-job' | 'activation' | 'manual-ingestion' | 'upsert-source' | 'validate-raw' | 'validate-pending' | 'create-company' | 'update-company' | 'add-alias' | 'create-security' | 'update-security' | 'security-activation';
export interface AuthIntegration {
  authorize: (action: AdminAction) => boolean;
  headers: () => Record<string, string>;
  onUnauthorized: () => void;
  inactiveJobsAccessible: () => boolean;
}
// Dedicated bearer credential is kept in memory. No credential enters the bundle or browser storage.
let integration: AuthIntegration | undefined;
export function installAuthIntegration(adapter?: AuthIntegration) { integration = adapter; }
export const authHeaders = () => integration?.headers() ?? {};
export const authCredentials = (): RequestCredentials => 'omit';
export const sessionExpired = () => {
  const previous = integration;
  if (previous) integration = { ...previous, authorize: () => false, headers: () => ({}) };
  previous?.onUnauthorized();
};
export function mutationBlock(action: AdminAction, deactivating = false): string | null {
  if (integration && !integration.authorize(action)) return 'Phiên quản trị (session) hiện không cho phép thao tác này.';
  if (integration && action === 'activation' && deactivating && !integration.inactiveJobsAccessible()) return 'Cần quyền xem job đang tắt (inactive) thì mới được tắt job, để có thể bật lại.';
  return null;
}
