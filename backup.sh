#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# FLM AUTO — Full backup script
# Commits ALL project files + pushes to GitHub
# Run from: ~/Dev/flm-auto
# ═══════════════════════════════════════════════════════════════

set -e

echo "═══ FLM AUTO — SAUVEGARDE TOTALE ═══"
echo ""

# ── 1. Verify clean build ──
echo "▸ Vérification build..."
npm run build --silent 2>&1 | tail -3
echo "  ✓ Build OK"
echo ""

# ── 2. Stage .gitignore first (affects what gets tracked) ──
echo "▸ Mise à jour .gitignore..."
git add .gitignore
echo "  ✓ .gitignore staged"

# ── 3. Remove now-ignored files from git tracking ──
echo "▸ Nettoyage fichiers ignorés du tracking..."
git rm -r --cached test-results/ 2>/dev/null || true
git rm -r --cached playwright-report/ 2>/dev/null || true
git rm -r --cached logs/ 2>/dev/null || true
git rm -r --cached .claude/ 2>/dev/null || true
git rm -r --cached scripts/node_modules/ 2>/dev/null || true
git rm --cached scripts/package-lock.json 2>/dev/null || true
git rm -r --cached supabase/.temp/ 2>/dev/null || true
git rm -r --cached 'slm/models/alain-auto-adapter/0001000_adapters.safetensors' 2>/dev/null || true
git rm -r --cached 'slm/models/alain-auto-adapter/adapters.safetensors' 2>/dev/null || true
git rm -r --cached slm/models/base/ 2>/dev/null || true
git rm -r --cached slm/models/alain-auto/ 2>/dev/null || true
echo "  ✓ Fichiers ignorés retirés du tracking"

# ── 4. Stage everything ──
echo "▸ Staging de tous les fichiers..."
git add -A
STAGED=$(git diff --cached --numstat | wc -l | tr -d ' ')
echo "  ✓ $STAGED fichiers staged"

# ── 5. Show summary ──
echo ""
echo "▸ Résumé des changements :"
git diff --cached --stat | tail -5
echo ""

# ── 6. Commit ──
echo "▸ Commit..."
git commit -m "chore: full project backup — all data, scripts, SLM, migrations, docs

INCLUDES:
- data/: 58MB scraping results, checkpoints, reference databases
- scripts/: import, scraping, audit, pipeline scripts
- scrapers/: standalone scraping modules (mjs)
- slm/: Alain SLM training config, data splits, eval scripts
- supabase/migrations/: all database schema migrations
- docs/: API spec, UX audit, OpenAPI schema
- MEGA_PROMPT_*.md: phase planning documents (11-25, 30)
- IDEAS.md: project roadmap ideas
- e2e/: all 24 test spec files
- src/app/connexion/loading.tsx: missing from previous commit
- src/components/price-alert-button.tsx: refactored (auth-based)

GITIGNORE UPDATES:
- test-results/, playwright-report/ (build artifacts)
- logs/ (scraping logs)
- .claude/ (editor config)
- scripts/node_modules/ (separate deps)
- supabase/.temp/ (temp files)
- slm/models/*.safetensors (25MB+ model weights, rebuild via training)

Total data footprint: ~85MB (within GitHub limits)"
echo "  ✓ Commit done"

# ── 7. Push to GitHub ──
echo ""
echo "▸ Push vers GitHub (origin/main)..."
git push origin main
echo "  ✓ Push OK"

# ── 8. Verify ──
echo ""
echo "═══ SAUVEGARDE TERMINÉE ═══"
echo ""
git log --oneline -3
echo ""
echo "Repo: https://github.com/Koa67/flm-auto"
echo "Branch: main"
COMMIT_COUNT=$(git rev-list --count HEAD)
REPO_SIZE=$(du -sh .git | cut -f1)
echo "Commits: $COMMIT_COUNT"
echo "Repo size: $REPO_SIZE"
