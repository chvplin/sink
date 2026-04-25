// Fill these with values from Supabase Project Settings -> API.
// Safe for frontend: use only the anon public key.
window.SUPABASE_CONFIG = {
  url: "https://ocloysvdygpjnmsezxfe.supabase.co",
  anonKey: "sb_publishable_bs2utgL-v81uG2H5K8HGSQ_s8NFgHdo",
  // When true + migration deployed + Edge Function scheduled: rounds advance on server only; clients render from global_rounds + server_now_ms().
  useGlobalAuthoritativeRounds: true
};
