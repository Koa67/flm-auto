#!/bin/bash
# Fine-tuning Qwen2.5-3B-Instruct avec MLX LoRA
# Durée estimée : 2-6h sur M2 base (8GB), 1-3h sur M2 Pro (16GB)
#
# Prérequis :
#   pip3 install mlx mlx-lm
#   npx ts-node slm/scripts/export-db.ts   (ou python3 slm/scripts/prepare-training.py)

set -e

cd "$(dirname "$0")/.."

echo "🚀 Fine-tuning ALAIN-AUTO sur Qwen2.5-3B-Instruct"
echo "   Hardware: Apple Silicon"
echo "   Method: QLoRA via MLX"
echo ""

# Vérifier que les données existent
if [ ! -f data/splits/train.jsonl ]; then
  echo "❌ data/splits/train.jsonl non trouvé."
  echo "   Lance d'abord:"
  echo "     npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' slm/scripts/export-db.ts"
  echo "     python3 slm/scripts/prepare-training.py"
  exit 1
fi

TRAIN_SIZE=$(wc -l < data/splits/train.jsonl | tr -d ' ')
VAL_SIZE=$(wc -l < data/splits/val.jsonl | tr -d ' ')
echo "📊 Train: ${TRAIN_SIZE} exemples | Val: ${VAL_SIZE} exemples"
echo ""

# Vérifier mlx-lm
if ! python3 -c "import mlx_lm" 2>/dev/null; then
  echo "❌ mlx-lm non installé. Lance: pip3 install mlx mlx-lm"
  exit 1
fi

# Lancer le fine-tuning MLX
echo "🏋️ Lancement du fine-tuning..."
echo ""

# Use MLX-community pre-quantized 4-bit model for QLoRA (fits in 8GB RAM)
python3 -m mlx_lm.lora \
  --model "mlx-community/Qwen2.5-3B-Instruct-4bit" \
  --data data/splits/ \
  --train \
  --batch-size 1 \
  --num-layers 8 \
  --iters 27000 \
  --learning-rate 2e-4 \
  --save-every 1000 \
  --steps-per-report 100 \
  --steps-per-eval 500 \
  --grad-accumulation-steps 4 \
  --adapter-path models/alain-auto-adapter \
  --max-seq-length 512 \
  --grad-checkpoint

echo ""
echo "✅ Fine-tuning terminé !"
echo "   Adaptateur sauvé dans: models/alain-auto-adapter/"
echo ""
echo "🧪 Pour tester:"
echo "   python3 -m mlx_lm.generate \\"
echo "     --model Qwen/Qwen2.5-3B-Instruct \\"
echo "     --adapter-path models/alain-auto-adapter \\"
echo "     --prompt 'Quelle est la puissance de la BMW M3 G80 ?'"
