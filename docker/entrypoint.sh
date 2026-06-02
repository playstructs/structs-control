#!/usr/bin/env bash
set -euo pipefail

mode="${STRUCTS_CONTROL_MODE:-prod}"

case "${mode}" in
  dev)
    echo "structs-control: dev mode (webpack-dev-server on :8081)"
    exec npm run dev -- --host 0.0.0.0
    ;;
  prod)
    if [[ ! -f /app/dist/index.html ]]; then
      echo "structs-control: prod mode requires /app/dist — run npm run build or use dev mode" >&2
      exit 1
    fi
    echo "structs-control: prod mode (nginx on :80)"
    exec nginx -g 'daemon off;'
    ;;
  *)
    echo "structs-control: unknown STRUCTS_CONTROL_MODE=${mode} (use dev or prod)" >&2
    exit 1
    ;;
esac
