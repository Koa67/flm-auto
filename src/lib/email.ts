import { logError } from "@/lib/logger";

/**
 * Fire-and-forget welcome email via Resend.
 * Does nothing if RESEND_API_KEY is not set.
 */
export async function sendWelcomeEmail(email: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: "FLM Auto <noreply@flm-auto.fr>",
      to: email,
      subject: "Bienvenue sur FLM Auto !",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h1 style="font-size:22px;color:#fff;background:#09090b;padding:16px 24px;border-radius:8px;text-align:center">
            Bienvenue sur FLM Auto
          </h1>
          <p style="margin-top:16px;font-size:15px;color:#333;line-height:1.6">
            Merci de vous être inscrit à notre newsletter !
            Vous recevrez nos classements, comparatifs et nouveautés automobiles.
          </p>
          <p style="margin-top:12px;font-size:13px;color:#888">
            Pour vous désabonner, répondez simplement à cet email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    logError(err, { endpoint: "sendWelcomeEmail" });
  }
}
