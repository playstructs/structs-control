#!/usr/bin/env bash
set -euo pipefail

mode="${STRUCTS_CONTROL_MODE:-prod}"
dev_port="${STRUCTS_DEV_PORT:-8092}"

case "${mode}" in
  dev)
    echo "structs-control: dev mode (webpack-dev-server on :${dev_port})"
    export STRUCTS_DEV_PORT="${dev_port}"
    exec npm run dev -- --host 0.0.0.0 --port "${dev_port}"
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
