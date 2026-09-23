window.AURA_SUPABASE = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};

if (!window.AURA_SUPABASE.url || !window.AURA_SUPABASE.anonKey || window.AURA_SUPABASE.url.includes('YOUR_') || window.AURA_SUPABASE.anonKey.includes('YOUR_')) {
  window.AURA_SUPABASE = {
    ...window.AURA_SUPABASE,
    missingConfig: true
  };
}

window.supabase = window.supabase || {};
window.supabase.client = window.supabase.client || (() => {
  if (!window.supabase || !window.supabase.createClient) {
    return null;
  }

  return window.supabase.createClient(
    window.AURA_SUPABASE.url,
    window.AURA_SUPABASE.anonKey
  );
})();

window.auraSupabase = window.supabase.client;
