#!/usr/bin/env bash
# Hilfen für das eigene Mythos-Supabase-Projekt. Braucht nur SUPABASE_ACCESS_TOKEN.
#   mythos-server.sh ref        -> gibt die Projekt-Ref aus (Projekt mit "mythos" im Namen, sonst das einzige Projekt)
#   mythos-server.sh migrate    -> führt neue Dateien aus supabase/migrations aus (über die Management API)
set -euo pipefail
API="https://api.supabase.com/v1"
auth=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN fehlt}")

ref() {
  local projects
  projects=$(curl -fsS "${auth[@]}" "$API/projects")
  local r
  r=$(jq -r '[.[] | select(.name | ascii_downcase | contains("mythos"))][0].id // empty' <<<"$projects")
  if [ -z "$r" ] && [ "$(jq length <<<"$projects")" = "1" ]; then r=$(jq -r '.[0].id' <<<"$projects"); fi
  if [ -z "$r" ]; then
    echo "Kein Supabase-Projekt gefunden. Lege eins mit \"mythos\" im Namen an." >&2
    exit 1
  fi
  echo "$r"
}

query() { # $1 = ref, $2 = SQL
  curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
    -X POST "$API/projects/$1/database/query" \
    -d "$(jq -n --arg q "$2" '{query: $q}')"
}

migrate() {
  local r; r=$(ref)
  query "$r" "CREATE TABLE IF NOT EXISTS public._mythos_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE public._mythos_migrations ENABLE ROW LEVEL SECURITY;" >/dev/null
  local done; done=$(query "$r" "SELECT name FROM public._mythos_migrations" | jq -r '.[].name')
  for f in supabase/migrations/*.sql; do
    local n; n=$(basename "$f")
    if grep -qxF "$n" <<<"$done"; then echo "schon da: $n"; continue; fi
    echo "führe aus: $n"
    query "$r" "$(cat "$f")
INSERT INTO public._mythos_migrations (name) VALUES ('$n');" >/dev/null
  done
}

"$@"
