import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ACCESS_DURATION_DAYS = 30;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action") || "approve";

  if (!token) {
    return htmlResponse("Error", "Token no proporcionado.", "error");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the request by token
    const { data: request, error: fetchError } = await supabase
      .from("access_requests")
      .select("id, email, status")
      .eq("approval_token", token)
      .single();

    if (fetchError || !request) {
      return htmlResponse("Token Inválido", "Este enlace no es válido o ya fue utilizado.", "error");
    }

    if (request.status === "approved") {
      return htmlResponse("Ya Aprobado", `El acceso para ${request.email} ya fue aprobado anteriormente.`, "info");
    }

    if (request.status === "rejected") {
      return htmlResponse("Ya Rechazado", `El acceso para ${request.email} ya fue rechazado.`, "info");
    }

    if (action === "approve") {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ACCESS_DURATION_DAYS);

      const { error: updateError } = await supabase
        .from("access_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", request.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return htmlResponse("Error", "No se pudo actualizar el acceso.", "error");
      }

      return htmlResponse(
        "✓ Acceso Aprobado",
        `Acceso concedido a <strong>${request.email}</strong> por ${ACCESS_DURATION_DAYS} días.<br>Válido hasta: ${expiresAt.toLocaleDateString('es-ES')}.`,
        "success"
      );
    } else {
      const { error: updateError } = await supabase
        .from("access_requests")
        .update({ status: "rejected" })
        .eq("id", request.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return htmlResponse("Error", "No se pudo actualizar.", "error");
      }

      return htmlResponse(
        "✗ Acceso Rechazado",
        `Se ha denegado el acceso a <strong>${request.email}</strong>.`,
        "rejected"
      );
    }
  } catch (err) {
    console.error("Error:", err);
    return htmlResponse("Error", "Error interno del servidor.", "error");
  }
});

function htmlResponse(title: string, message: string, type: string): Response {
  const colors = {
    success: { bg: "#10b981", text: "#0f172a" },
    error: { bg: "#ef4444", text: "#ffffff" },
    rejected: { bg: "#ef4444", text: "#ffffff" },
    info: { bg: "#3b82f6", text: "#ffffff" },
  };
  const c = colors[type as keyof typeof colors] || colors.info;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EdgeValidator — ${title}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; font-family: 'Inter', Arial, sans-serif; color: #e2e8f0; }
    .card { background: #1e293b; padding: 48px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
    .badge { display: inline-block; padding: 8px 20px; border-radius: 8px; font-weight: 700; font-size: 18px; margin-bottom: 16px; background: ${c.bg}; color: ${c.text}; }
    .message { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .message strong { color: #f1f5f9; }
    .footer { margin-top: 24px; font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${title}</div>
    <p class="message">${message}</p>
    <p class="footer">EdgeValidator • Sistema de Control de Acceso</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
