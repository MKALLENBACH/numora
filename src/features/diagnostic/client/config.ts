export const diagnosticPublicConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  privacyPolicyUrl: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim() ?? "",
} as const;

export function isDiagnosticConfigured() {
  return Boolean(
    diagnosticPublicConfig.supabaseUrl &&
      diagnosticPublicConfig.supabaseKey &&
      diagnosticPublicConfig.privacyPolicyUrl,
  );
}

export function hasDiagnosticBackendConfiguration() {
  return Boolean(diagnosticPublicConfig.supabaseUrl && diagnosticPublicConfig.supabaseKey);
}
