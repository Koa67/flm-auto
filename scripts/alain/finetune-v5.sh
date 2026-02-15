#!/bin/bash
# Fine-tune Qwen2.5-3B-Instruct for ALAIN v5
# Pre-requisites: pip install mlx-lm
#
# Usage: bash scripts/alain/finetune-v5.sh

set -e

MODEL="Qwen/Qwen2.5-3B-Instruct"
ADAPTER="scripts/alain/adapters-v5"
DATA="scripts/alain/training-data-v5.jsonl"
EPOCHS=3
BATCH=4
LR=1e-4
LORA_RANK=16

echo "=== ALAIN v5 Fine-tune ==="
echo "Model: $MODEL"
echo "Data: $DATA"
echo "Epochs: $EPOCHS"
echo ""

# Check data file exists
if [ ! -f "$DATA" ]; then
  echo "ERROR: Training data not found at $DATA"
  exit 1
fi

LINES=$(wc -l < "$DATA" | tr -d ' ')
ITERS=$(python3 -c "print($LINES * $EPOCHS // $BATCH)")
echo "Training entries: $LINES"
echo "Total iterations: $ITERS"
echo ""

# Step 1: Fine-tune with QLoRA
echo "=== Step 1: QLoRA Fine-tune ==="
python -m mlx_lm.lora \
  --model "$MODEL" \
  --train \
  --data "$DATA" \
  --adapter-path "$ADAPTER" \
  --num-layers 8 \
  --lora-rank $LORA_RANK \
  --batch-size $BATCH \
  --iters $ITERS \
  --learning-rate $LR \
  --seed 42

echo ""
echo "=== Step 2: Fuse adapters ==="
python -m mlx_lm.fuse \
  --model "$MODEL" \
  --adapter-path "$ADAPTER" \
  --save-path "scripts/alain/alain-v5-fused"

echo ""
echo "=== Step 3: Convert to GGUF for Ollama ==="
python -m mlx_lm.convert \
  --model "scripts/alain/alain-v5-fused" \
  --quantize Q4_K_M \
  --outdir "scripts/alain/alain-v5-gguf"

echo ""
echo "=== Step 4: Create Ollama model ==="
ollama create alain-auto-v5 -f scripts/alain/Modelfile-v5

echo ""
echo "=== ALAIN v5 ready! ==="
echo "Test: ollama run alain-auto-v5 'Parle-moi de la Golf GTI'"
