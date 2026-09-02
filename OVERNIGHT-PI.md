# Overnight Pi setup (skibidi-)

## Stack

- **Pi** + `pi-goal-list-loop-audit` (autonomous goal loop)
- **Local model**: llama.cpp `Qwen3.6-35B-A3B-UD-Q4_K_XL` (default in `~/.pi/agent/settings.json`)
- **tmux**: keeps Pi alive after you close the terminal
- **Playwright**: human-like browser checks via `playwright-cli`

## Start

```bash
pi-overnight-skibidi
# or:
tmux attach -t skibidi
```

Inside Pi:

```text
/goal start "Production path per AGENT-PRODUCTION-GOAL.md. Done when customer web order flow works and playwright-cli verifies http://localhost:8081."
```

## Browser commands Pi should use

```bash
npm run web
playwright-cli open http://localhost:8081
playwright-cli snapshot
playwright-cli find "Cart"
playwright-cli screenshot
playwright-cli close
```

## Detach / reattach

- Detach: `Ctrl-b` then `d`
- Reattach: `tmux attach -t skibidi`
- Kill session: `tmux kill-session -t skibidi`

## Notes

- Do not install other `pi-goal*` packages alongside `pi-goal-list-loop-audit`.
- If context overflows, start a fresh Pi session and `/goal resume` / restart goal.
- Free duplicate `llama-server` processes if RAM/swap is exhausted (`sudo pkill -f llama-server` then restart your router).
