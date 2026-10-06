window.AURA_SUPABASE = {
  url: 'https://zukwzcavvgjiajyhkkys.supabase.co',
  anonKey: 'sb_publishable_8M1lC_xpnOzZyJ2qMWIwag_cA-aQAoT',
  pushPublicKey: 'BIlbp9rpPJ-00hkKpmteuCZ3NBJI1qRScsnqiVxYHG99YeMHysuM2-OpgQE-y4kqJ507SJlW5R0W3F0mA3nlICQ',
  requiredRole: 'admin'
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

window.AURA_SUPABASE.isAdminUser = function (user) {
  if (!user) return false;

  const role = String(user.app_metadata?.role || '').toLowerCase();

  return role === String(window.AURA_SUPABASE.requiredRole || 'admin').toLowerCase();
};

window.AURA_SUPABASE.ensureAdminAccess = async function () {
  const client = window.auraSupabase;
  if (!client) return false;

  const { data, error } = await client.auth.getSession();
  const user = data?.session?.user || null;

  if (error || !user || !window.AURA_SUPABASE.isAdminUser(user)) {
    localStorage.removeItem('adminSession');
    window.location.href = 'login.html';
    return false;
  }

  localStorage.setItem('adminSession', 'true');
  return true;
};
