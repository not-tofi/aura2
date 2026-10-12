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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "La solicitud no contiene JSON válido." }, 400);
  }

  const token = typeof body === "object" && body !== null && "token" in body &&
    typeof body.token === "string"
    ? body.token
    : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return respond({ error: "El identificador de la reserva no es válido." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Falta la configuración de acceso de la función de avisos.");
    return respond({ error: "No se pudieron enviar los avisos." }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const createdAfter = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: reservation, error: reservationError } = await adminClient
    .from("turnos")
    .update({ admin_notification_sent: true })
    .eq("admin_notification_token", token)
    .eq("estado", "pendiente")
    .eq("admin_notification_sent", false)
    .gte("created_at", createdAfter)
    .select("id")
    .maybeSingle();

  if (reservationError) {
    console.error("No se pudo validar la reserva para el aviso:", reservationError.message);
    return respond({ error: "No se pudo validar la reserva." }, 500);
  }
  if (!reservation) {
    const { data: existingReservation, error: existingError } = await adminClient
      .from("turnos")
      .select("id, admin_notification_sent")
      .eq("admin_notification_token", token)
      .maybeSingle();

    if (existingError) {
      console.error("No se pudo verificar el estado del aviso:", existingError.message);
      return respond({ error: "No se pudo verificar el estado del aviso." }, 500);
    }
    if (existingReservation?.admin_notification_sent) {
      return respond({ sent: true, duplicate: true });
    }
    return respond({ sent: false, reason: "reservation_not_found_or_expired" }, 404);
  }

  const resetClaim = async () => {
    const { error } = await adminClient
      .from("turnos")
      .update({ admin_notification_sent: false })
      .eq("id", reservation.id);
    if (error) console.error("No se pudo liberar el aviso pendiente:", error.message);
  };

  const { data: subscriptions, error: subscriptionsError } = await adminClient
    .from("admin_push_subscriptions")
    .select("endpoint, subscription");

  if (subscriptionsError) {
    console.error("No se pudieron consultar los dispositivos administradores:", subscriptionsError.message);
    await resetClaim();
    return respond({ error: "No se pudieron consultar los dispositivos administradores." }, 500);
  }
  if (!subscriptions?.length) {
    return respond({ sent: false, reason: "no_admin_subscriptions" });
  }

  const vapidPublicKey = Deno.env.get("AURA_VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("AURA_VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("AURA_VAPID_SUBJECT");
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error("Faltan las claves VAPID para enviar avisos al equipo.");
    await resetClaim();
    return respond({ error: "Los avisos web no están configurados." }, 500);
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (error: unknown) {
    console.error("Las claves VAPID no son válidas:", error instanceof Error ? error.message : error);
    await resetClaim();
    return respond({ error: "Los avisos web no están configurados correctamente." }, 500);
  }
  const payload = JSON.stringify({
    title: "Nueva solicitud de turno",
    body: "Llegó una nueva solicitud de reserva. Abrí el panel para ver los detalles.",
    url: "/admin/turnos.html",
  });

  const results = await Promise.all(subscriptions.map(async ({ endpoint, subscription }) => {
    try {
      await webpush.sendNotification(subscription, payload);
      return "sent";
    } catch (error: unknown) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        const { error: cleanupError } = await adminClient
          .from("admin_push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);
        if (cleanupError) {
          console.error("No se pudo quitar un dispositivo administrador vencido:", cleanupError.message);
        }
        return "expired";
      }

      console.error("No se pudo entregar un aviso de nueva reserva:", error instanceof Error ? error.message : error);
      return "failed";
    }
  }));

  const sentCount = results.filter((result) => result === "sent").length;
  const failedCount = results.filter((result) => result === "failed").length;
  if (sentCount === 0 && failedCount > 0) {
    await resetClaim();
    return respond({ error: "No se pudo entregar ningún aviso." }, 502);
  }

  return respond({ sent: sentCount > 0, sentCount });
});
