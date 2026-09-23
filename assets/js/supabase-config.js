window.AURA_SUPABASE = {
  url: 'https://zukwzcavvgjiajyhkkys.supabase.co',
  anonKey: 'sb_publishable_8M1lC_xpnOzZyJ2qMWIwag_cA-aQAoT',
  adminEmail: 'admin@aura-nails.local',
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

  const role = String(user.app_metadata?.role || user.role || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  const adminEmail = String(window.AURA_SUPABASE.adminEmail || '').toLowerCase();

  return role === String(window.AURA_SUPABASE.requiredRole || 'admin').toLowerCase() ||
    email === adminEmail ||
    email.endsWith('@aura-nails.local');
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
