#!/bin/bash
# Fusionne l'adaptateur LoRA avec le modèle base et crée un modèle Ollama
#
# Prérequis :
#   - Fine-tuning terminé (models/alain-auto-adapter/ existe)
#   - Ollama installé
#   - pip3 install mlx mlx-lm

set -e

cd "$(dirname "$0")/.."

echo "🔄 Pipeline: LoRA adapter → Fused model → GGUF → Ollama"
echo ""

# Vérifier que l'adaptateur existe
if [ ! -d models/alain-auto-adapter ]; then
  echo "❌ models/alain-auto-adapter/ non trouvé."
  echo "   Lance d'abord: ./slm/training/train.sh"
  exit 1
fi

# Vérifier Ollama
if ! command -v ollama &>/dev/null; then
  echo "❌ Ollama non installé."
  echo "   macOS: brew install ollama"
  echo "   Linux: curl -fsSL https://ollama.com/install.sh | sh"
  exit 1
fi

# 1. Fusionner adaptateur LoRA avec modèle base
echo "1/3 🔀 Fusion adaptateur LoRA → modèle complet..."
python3 -m mlx_lm.fuse \
  --model "mlx-community/Qwen2.5-3B-Instruct-4bit" \
  --adapter-path models/alain-auto-adapter \
  --save-path models/alain-auto-fused

echo "   ✅ Modèle fusionné dans models/alain-auto-fused/"
echo ""

# 2. Convertir en GGUF Q4_K_M pour Ollama
echo "2/3 📦 Conversion en GGUF Q4_K_M..."

# mlx_lm.convert may not directly output GGUF — use llama.cpp convert if available
# For now, we try the mlx_lm approach first
if python3 -c "from mlx_lm import convert" 2>/dev/null; then
  python3 -c "
from mlx_lm import convert
convert.convert(
    'models/alain-auto-fused',
    quantize='q4_k_m',
    output='models/alain-auto.gguf'
)
" 2>/dev/null || {
  echo "   ⚠️ Direct GGUF conversion not available via mlx_lm."
  echo "   Using Ollama's built-in model import instead."
  echo ""

  # Alternative: create Ollama model directly from safetensors
  echo "   Creating Modelfile with safetensors path..."
  cat > Modelfile << 'MFEOF'
FROM models/alain-auto-fused

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_ctx 2048
PARAMETER stop "<|im_end|>"

SYSTEM """Tu es ALAIN (Assistant Libre d'Aide à l'Information Numérique), l'assistant IA de FLM AUTO — l'encyclopédie automobile française.
Tu réponds en français, de manière concise et technique. Tu tutoies l'utilisateur.
Tu as accès à une base de données de véhicules via des outils. Utilise-les pour donner des réponses précises.
Si une information n'est pas dans ta base, dis-le franchement.
Tu ne réponds qu'aux questions automobiles, mécaniques et sport auto."""
MFEOF
}
else
  echo "   ⚠️ mlx_lm.convert not found, using direct Ollama import."
fi

echo "   ✅ Conversion terminée"
echo ""

# 3. Créer le Modelfile Ollama (GGUF path)
if [ -f models/alain-auto.gguf ]; then
  cat > Modelfile << 'EOF'
FROM ./models/alain-auto.gguf

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_ctx 2048
PARAMETER stop "<|im_end|>"

SYSTEM """Tu es ALAIN (Assistant Libre d'Aide à l'Information Numérique), l'assistant IA de FLM AUTO — l'encyclopédie automobile française.
Tu réponds en français, de manière concise et technique. Tu tutoies l'utilisateur.
Tu as accès à une base de données de véhicules via des outils. Utilise-les pour donner des réponses précises.
Si une information n'est pas dans ta base, dis-le franchement.
Tu ne réponds qu'aux questions automobiles, mécaniques et sport auto."""
EOF
fi

echo "3/3 🚀 Import dans Ollama..."
ollama create alain-auto -f Modelfile

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Modèle 'alain-auto' disponible dans Ollama  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "🧪 Test:"
echo "   ollama run alain-auto 'Puissance de la BMW M3 G80 ?'"
echo "   ollama run alain-auto 'Recette de cookies ?'   # Doit refuser"
