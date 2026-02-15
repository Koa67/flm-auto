import { createStaticClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { newsletterSchema, validateBody } from "@/lib/validators";
import { logError } from "@/lib/logger";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const result = await validateBody(request, newsletterSchema);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { email, source } = result.data;
    const db = createStaticClient();

    const { error } = await db
      .from("newsletter_subscribers")
      .upsert({ email, source }, { onConflict: "email" });

    if (error) {
      logError(error, { endpoint: "/api/newsletter/subscribe" });
      return NextResponse.json(
        { error: "Erreur lors de l'inscription" },
        { status: 500 }
      );
    }

    // Fire-and-forget welcome email — don't block the response
    sendWelcomeEmail(email).catch((err) =>
      logError(err, { endpoint: "/api/newsletter/subscribe", context: "welcome-email" })
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
