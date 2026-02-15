# Deploy Checklist — FLM Auto

## Vercel Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Production URL (e.g. `https://flm-auto.fr`) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for ALAIN cloud fallback |
| `RESEND_API_KEY` | No | Resend API key for welcome emails |
| `NEXT_PUBLIC_GSC_VERIFICATION` | No | Google Search Console verification code |
| `NEXT_PUBLIC_BUILD_ID` | No | Build ID for SW cache-busting (auto-set by Vercel) |

## Domain Setup

1. Add custom domain `flm-auto.fr` in Vercel project settings
2. Add DNS records at registrar:
   - `CNAME` — `www` → `cname.vercel-dns.com`
   - `A` — `@` → `76.76.21.21`
3. Enable HTTPS (automatic via Vercel)
4. Verify domain in Google Search Console

## Post-Deploy Verification

- [ ] Homepage loads with ISR data
- [ ] `/api/brands` returns 200
- [ ] ALAIN chat works (Anthropic streaming fallback)
- [ ] PWA installable (manifest + icons)
- [ ] OG images render (`/api/og?title=test`)
- [ ] Newsletter subscribe works
- [ ] Google Search Console verified
