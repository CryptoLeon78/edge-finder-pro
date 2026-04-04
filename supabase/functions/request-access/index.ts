import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "@supabase/supabase-js/cors";

const ADMIN_EMAIL = "ivanaza8@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, renew } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // If renewing, update expired/rejected record back to pending
    if (renew) {
      const { error } = await supabase
        .from("access_requests")
        .update({
          status: "pending",
          approval_token: crypto.randomUUID(),
          approved_at: null,
          expires_at: null,
        })
        .eq("email", email.toLowerCase())
        .in("status", ["expired", "rejected"]);

      if (error) {
        console.error("Renewal update error:", error);
      }
    }

    // Get the request with its approval token
    const { data: request, error: fetchError } = await supabase
      .from("access_requests")
      .select("id, approval_token, email")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !request) {
      return new Response(
        JSON.stringify({ error: "No se encontró solicitud pendiente" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build approval URL
    const projectUrl = Deno.env.get("SITE_URL") || `${supabaseUrl.replace('.supabase.co', '')}/functions/v1`;
    const approveUrl = `${supabaseUrl}/functions/v1/approve-access?token=${request.approval_token}&action=approve`;
    const rejectUrl = `${supabaseUrl}/functions/v1/approve-access?token=${request.approval_token}&action=reject`;

    // Send notification email to admin using Resend or log for now
    const resendKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendKey) {
      const emailHtml = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(16,185,129,0.2); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              <span style="font-size: 24px;">🛡️</span>
            </div>
            <h1 style="font-size: 18px; margin: 0; color: #10b981;">EdgeValidator — Solicitud de Acceso</h1>
          </div>
          <div style="background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #94a3b8;">Un usuario ha solicitado acceso:</p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #f1f5f9;">${request.email}</p>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <a href="${approveUrl}" style="display: inline-block; padding: 12px 32px; background: #10b981; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">✓ Aprobar (30 días)</a>
            <a href="${rejectUrl}" style="display: inline-block; padding: 12px 32px; background: #ef4444; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">✗ Rechazar</a>
          </div>
          <p style="text-align: center; margin-top: 20px; font-size: 11px; color: #64748b;">EdgeValidator • Sistema de Control de Acceso</p>
        </div>
      `;

      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      const gatewayUrl = "https://connector-gateway.lovable.dev/resend";

      await fetch(`${gatewayUrl}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: "EdgeValidator <onboarding@resend.dev>",
          to: [ADMIN_EMAIL],
          subject: `🛡️ Solicitud de acceso: ${request.email}`,
          html: emailHtml,
        }),
      });
    } else {
      // Log approval links for manual use
      console.log(`=== ACCESS REQUEST ===`);
      console.log(`Email: ${request.email}`);
      console.log(`Approve: ${approveUrl}`);
      console.log(`Reject: ${rejectUrl}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Solicitud enviada al administrador" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
