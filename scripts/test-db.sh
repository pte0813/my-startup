#!/usr/bin/env bash
# 임시 Postgres 를 띄워 마이그레이션·시드·접근 규칙(RLS)을 검증한다. (Postgres 설치 필요)
set -euo pipefail
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR=$(mktemp -d)
PORT=54329
cleanup() { "$PGBIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  # Postgres 는 root 로 실행할 수 없어서 임시 계정으로 실행한다.
  id mmtest >/dev/null 2>&1 || useradd -m mmtest
  chown mmtest "$DIR"
  RUN() { su mmtest -c "$*"; }
else
  RUN() { bash -c "$*"; }
fi
chmod -R a+rX "$ROOT/supabase"

RUN "$PGBIN/initdb -D $DIR/data -U postgres --auth=trust >/dev/null"
RUN "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
PSQL="psql -h $DIR -p $PORT -U postgres -d postgres -q -v ON_ERROR_STOP=1"

RUN "$PSQL -f $ROOT/supabase/tests/stub.sql"
RUN "$PSQL -f $ROOT/supabase/migrations/20261020000000_init.sql"
RUN "$PSQL -f $ROOT/supabase/seed.sql"
# 이미 시드를 올린 DB에 다시 실행해도 안전해야 한다(가게 수가 늘지 않고 오류도 없다)
BEFORE=$($PSQL -t -A -c "select count(*) from public.places")
RUN "$PSQL -f $ROOT/supabase/seed.sql"
AFTER=$($PSQL -t -A -c "select count(*) from public.places")
[ "$BEFORE" = "$AFTER" ] || { echo "시드를 두 번 실행하자 가게 수가 달라졌습니다: $BEFORE -> $AFTER"; exit 1; }
echo "시드 재실행 확인: 가게 $AFTER곳, 동네 $($PSQL -t -A -c 'select count(*) from public.areas')개"
RUN "$PSQL -f $ROOT/supabase/tests/rls.sql"
