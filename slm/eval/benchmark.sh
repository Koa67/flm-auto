#!/bin/bash
# Benchmark latence du SLM ALAIN
#
# Usage: ./slm/eval/benchmark.sh
# Prérequis: ollama serve &

set -e

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
MODEL="${ALAIN_MODEL:-alain-auto}"
RUNS=10

echo "⏱️  ALAIN SLM Latency Benchmark"
echo "   Model: ${MODEL}"
echo "   Runs:  ${RUNS}"
echo ""

# Check Ollama
if ! curl -sf "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
  echo "❌ Ollama not running. Start with: ollama serve"
  exit 1
fi

TOTAL=0
MIN=999999
MAX=0

for i in $(seq 1 $RUNS); do
  START=$(python3 -c "import time; print(int(time.time() * 1000))")

  curl -sf "${OLLAMA_URL}/api/chat" \
    -d "{
      \"model\": \"${MODEL}\",
      \"messages\": [{\"role\": \"user\", \"content\": \"Puissance BMW M3 G80 ?\"}],
      \"stream\": false
    }" > /dev/null

  END=$(python3 -c "import time; print(int(time.time() * 1000))")
  LATENCY=$((END - START))
  TOTAL=$((TOTAL + LATENCY))

  if [ $LATENCY -lt $MIN ]; then MIN=$LATENCY; fi
  if [ $LATENCY -gt $MAX ]; then MAX=$LATENCY; fi

  printf "   Run %2d: %dms\n" "$i" "$LATENCY"
done

AVG=$((TOTAL / RUNS))

echo ""
echo "📊 Results:"
echo "   Min:  ${MIN}ms"
echo "   Max:  ${MAX}ms"
echo "   Avg:  ${AVG}ms"
echo ""

if [ $AVG -le 2000 ]; then
  echo "✅ Latency target met (≤2000ms avg)"
else
  echo "❌ Latency target missed (>2000ms avg)"
fi
