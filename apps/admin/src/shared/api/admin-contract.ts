export type AdminLogin = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
};

export type AdminSession = {
  authenticated: boolean;
  principal: string;
  email: string | null;
  authorities: string[];
};

export type AdminRuntime = {
  database: 'UP' | 'DOWN';
  timezone: string;
  schedulers: Record<string, { enabled: boolean }>;
  adminWorkers: { commandsEnabled: boolean };
};
