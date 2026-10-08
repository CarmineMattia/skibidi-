#!/usr/bin/env bash
# Uses a disposable local container only; no hosted database credentials.
set -euo pipefail
cd "$(dirname "$0")/../.."
validation_container="ambrosia-order-validation-$$"
podman run --rm -d --name "$validation_container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust docker.io/library/postgres:17-alpine >/dev/null
trap 'podman stop -t 1 "$validation_container" >/dev/null' EXIT
for validation_attempt in {1..30}; do
  if podman exec "$validation_container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
apply_sql() { podman exec -i "$validation_container" psql -U postgres -v ON_ERROR_STOP=1; }
apply_sql < tests/sql/atomic-order-schema.sql
# The real tracking and tenant read policies use the fixture's minimal schema.
apply_sql < supabase/migrations/20260610_tighten_orders_rls_tracking_rpc.sql
apply_sql < supabase/migrations/20260901_fix_guest_order_items_rls.sql
apply_sql < supabase/migrations/20261008_atomic_order_submission.sql
apply_sql < tests/sql/atomic-order-submission.sql
