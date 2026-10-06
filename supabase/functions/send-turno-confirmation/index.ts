import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return respond({ error: "Se requiere una sesión de administrador." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Falta la configuración de Supabase en la Edge Function.");
    return respond({ error: "La función no está configurada correctamente." }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData.user;
  const isAdmin = user && String(user.app_metadata?.role || "").toLowerCase() === "admin";
  if (authError || !isAdmin) return respond({ error: "Acceso no autorizado." }, 403);

  const body = await request.json().catch(() => null);
  const turnoId = body?.turnoId;
  if (!Number.isSafeInteger(turnoId) || turnoId <= 0) {
    return respond({ error: "El identificador del turno no es válido." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: turno, error: turnoError } = await adminClient
    .from("turnos")
    .select("id, fecha, hora, estado, push_subscription, tipos(nombre)")
    .eq("id", turnoId)
    .maybeSingle();

  if (turnoError) {
    console.error("No se pudo consultar el turno para su notificación:", turnoError.message);
    return respond({ error: "No se pudo consultar el turno." }, 500);
  }
  if (!turno || turno.estado !== "confirmado") {
    return respond({ error: "El turno no existe o todavía no está confirmado." }, 404);
  }
  if (!turno.push_subscription) {
    return respond({ sent: false, reason: "no_subscription" });
  }

  const vapidPublicKey = Deno.env.get("AURA_VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("AURA_VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("AURA_VAPID_SUBJECT");
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error("Faltan las claves VAPID para enviar notificaciones.");
    return respond({ error: "Las notificaciones web no están configuradas." }, 500);
  }

  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${turno.fecha}T12:00:00Z`));
  const servicio = turno.tipos?.nombre || "servicio";
  const payload = JSON.stringify({
    title: "¡Tu turno fue confirmado!",
    body: `Tu turno de ${servicio} fue confirmado el día ${fecha} a la hora ${turno.hora} hs.`,
    url: "/public/reservar.html",
  });

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    await webpush.sendNotification(turno.push_subscription, payload);
    return respond({ sent: true });
  } catch (error: unknown) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      ? Number(error.statusCode)
      : 0;
    if (statusCode === 404 || statusCode === 410) {
      const { error: cleanupError } = await adminClient
        .from("turnos")
        .update({ push_subscription: null })
        .eq("id", turno.id);
      if (cleanupError) {
        console.error("No se pudo quitar una suscripción push vencida:", cleanupError.message);
      }
      return respond({ sent: false, reason: "subscription_expired" });
    }

    console.error("No se pudo entregar la notificación push:", error instanceof Error ? error.message : error);
    return respond({ error: "No se pudo entregar la notificación." }, 502);
  }
});
