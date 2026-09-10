#!/usr/bin/env bash
# Launch Prime Agent on Skibidi Orders via llama.cpp (not Ollama).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

LLAMA_BIN="${LLAMA_BIN:-/home/cr1m3/localai/llama.cpp/build-strix-halo/bin/llama-server}"
LLAMA_PORT="${LLAMA_PORT:-8090}"
LLAMA_URL="http://127.0.0.1:${LLAMA_PORT}"
MODEL_ALIAS="qwen3-coder-30b"
LOG_DIR="/home/cr1m3/localai/logs"
HF_REPO="unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF"
HF_FILE="Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf"

mkdir -p "$LOG_DIR"

if ! curl -sf "${LLAMA_URL}/v1/models" >/dev/null 2>&1; then
  echo "Starting llama-server on :${LLAMA_PORT} (may download ~18GB on first run)..."
  nohup "$LLAMA_BIN" \
    --host 127.0.0.1 \
    --port "$LLAMA_PORT" \
    --hf-repo "$HF_REPO" \
    --hf-file "$HF_FILE" \
    --alias "$MODEL_ALIAS" \
    --ctx-size 65536 \
    --parallel 1 \
    --batch-size 512 \
    --ubatch-size 256 \
    --flash-attn on \
    --n-gpu-layers 999 \
    --threads 32 \
    --threads-batch 32 \
    --jinja \
    --metrics \
    --log-file "$LOG_DIR/llama-server-qwen3-coder-30b.log" \
    > "$LOG_DIR/llama-server-qwen3-coder-30b.stdout" 2>&1 &
  echo "llama-server pid $!"

  echo "Waiting for model to load..."
  for i in $(seq 1 600); do
    if curl -sf "${LLAMA_URL}/v1/models" >/dev/null 2>&1; then
      echo "llama-server is ready."
      break
    fi
    sleep 2
    if [ "$i" -eq 600 ]; then
      echo "Timed out waiting for llama-server. Check:"
      echo "  tail -f $LOG_DIR/llama-server-qwen3-coder-30b.stdout"
      exit 1
    fi
  done
fi

if ! command -v prime-agent >/dev/null 2>&1; then
  echo "prime-agent not found in PATH"
  exit 1
fi

echo "Starting Prime Agent in: $ROOT"
echo "Backend: llama.cpp @ ${LLAMA_URL}"
echo "Model: ${MODEL_ALIAS}"
echo "Goal: AGENT-PRODUCTION-GOAL.md"
echo ""

exec prime-agent --model "llamacpp/${MODEL_ALIAS}" \
  "Read AGENT-PRODUCTION-GOAL.md carefully. Then execute the mission in priority order (P0 → P1 → P2 → P3). Keep the restaurant app fluid with minimal clicks, fix bugs on the real order/kitchen/admin paths, and prepare Stripe payments for production (test mode first). When done or blocked, write STATUS.md."
