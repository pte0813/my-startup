#!/usr/bin/env python3
"""Threads 게시글 예약 발행 + 댓글 자동 응답 봇 (표준 라이브러리만 사용).

사용법:
  python bot.py post          # 예약 시각이 지난 게시글 발행
  python bot.py reply         # 내 게시글의 새 댓글에 규칙대로 응답
  python bot.py insights      # 내 게시글의 좋아요/댓글/리포스트/인용 수 출력
  python bot.py run           # post + reply 를 주기적으로 반복

기본은 모의 실행(dry-run)이며, 실제로 보내려면 --live 를 붙인다.
액세스 토큰은 환경변수 THREADS_ACCESS_TOKEN 으로 전달한다.
"""
import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://graph.threads.net/v1.0"
MAX_TEXT = 500
HERE = Path(__file__).parent


class ThreadsError(Exception):
    pass


class ThreadsClient:
    def __init__(self, token, live=False):
        self.token = token
        self.live = live

    def _request(self, method, path, params=None):
        params = dict(params or {})
        params["access_token"] = self.token
        data = urllib.parse.urlencode(params)
        url = f"{API}/{path.lstrip('/')}"
        req = (urllib.request.Request(url + "?" + data) if method == "GET"
               else urllib.request.Request(url, data=data.encode(), method="POST"))
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            raise ThreadsError(f"{e.code} {e.read().decode(errors='replace')}") from e
        except urllib.error.URLError as e:
            raise ThreadsError(str(e.reason)) from e

    def get(self, path, **params):
        return self._request("GET", path, params)

    def me(self):
        return self.get("me", fields="id,username")

    def my_threads(self, limit=10):
        return self.get("me/threads", fields="id,text,timestamp,permalink", limit=limit).get("data", [])

    def conversation(self, media_id):
        return self.get(f"{media_id}/conversation",
                        fields="id,text,username,timestamp,reply_to_id", reverse="true").get("data", [])

    def insights(self, media_id):
        res = self.get(f"{media_id}/insights", metric="views,likes,replies,reposts,quotes")
        return {m["name"]: m["values"][0]["value"] for m in res.get("data", [])}

    def publish(self, text, reply_to_id=None, image_url=None):
        """텍스트(또는 이미지) 게시글/댓글을 만든다. live 가 아니면 보내지 않는다."""
        if len(text) > MAX_TEXT:
            raise ThreadsError(f"글자 수 초과({len(text)}/{MAX_TEXT})")
        if not self.live:
            return "dry-run"
        params = {"media_type": "IMAGE" if image_url else "TEXT", "text": text}
        if image_url:
            params["image_url"] = image_url
        if reply_to_id:
            params["reply_to_id"] = reply_to_id
        container = self._request("POST", "me/threads", params)["id"]
        time.sleep(5)  # 컨테이너 처리 대기 (Meta 권장: 약 30초, 텍스트는 짧아도 됨)
        return self._request("POST", "me/threads_publish", {"creation_id": container})["id"]


# ---------- 상태 ----------

def load_json(path, default):
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def save_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def new_state():
    return {"published": [], "seen_replies": [], "last_reply_by_user": {}, "initialized": False}


# ---------- 예약 게시 ----------

def run_posts(client, posts, state, now=None):
    now = now or datetime.now(timezone.utc)
    done = 0
    for post in posts:
        if post["id"] in state["published"]:
            continue
        at = datetime.fromisoformat(post["at"])
        if at.tzinfo is None:
            raise ThreadsError(f"{post['id']}: 'at' 에 시간대가 필요합니다 (예: 2026-10-21T09:00:00+09:00)")
        if at > now:
            continue
        try:
            media_id = client.publish(post["text"], image_url=post.get("image_url"))
        except ThreadsError as e:
            print(f"[post] {post['id']} 실패: {e}", file=sys.stderr)
            continue
        print(f"[post] {post['id']} 발행 -> {media_id}")
        if client.live:
            state["published"].append(post["id"])
        done += 1
    return done


# ---------- 댓글 자동 응답 ----------

def pick_reply(text, rules):
    """첫 번째로 일치하는 규칙의 응답 문구를 반환. 없으면 default 규칙, 그것도 없으면 None."""
    default = None
    for rule in rules:
        if rule.get("default"):
            default = rule
            continue
        keywords = rule.get("keywords", [])
        pattern = rule.get("regex")
        if any(k.lower() in text.lower() for k in keywords) or (pattern and re.search(pattern, text, re.I)):
            return random.choice(rule["replies"])
    return random.choice(default["replies"]) if default else None


def run_replies(client, config, state, my_id, my_username, now=None):
    now = now or time.time()
    rules = config.get("rules", [])
    cooldown = config.get("user_cooldown_seconds", 3600)
    limit = config.get("max_replies_per_run", 10)
    sent = 0
    seen = set(state["seen_replies"])
    first_run = not state["initialized"] and not config.get("reply_to_existing", False)

    for thread in client.my_threads(config.get("recent_posts", 10)):
        for c in client.conversation(thread["id"]):
            if c["id"] in seen or c.get("username") == my_username:
                continue
            if first_run:  # 처음 실행 시 과거 댓글에 한꺼번에 답하지 않도록 기록만 한다
                seen.add(c["id"])
                continue
            text = c.get("text") or ""
            user = c.get("username", "")
            reply = pick_reply(text, rules)
            if reply is None or sent >= limit:
                if reply is None:
                    seen.add(c["id"])
                continue
            if now - state["last_reply_by_user"].get(user, 0) < cooldown:
                continue  # 같은 사람에게 너무 자주 답하지 않기 (스팸 방지)
            body = reply.replace("{username}", user)
            try:
                client.publish(body, reply_to_id=c["id"])
            except ThreadsError as e:
                print(f"[reply] @{user} 실패: {e}", file=sys.stderr)
                continue
            print(f"[reply] @{user}: {text[:30]!r} -> {body[:40]!r}")
            seen.add(c["id"])
            if client.live:
                state["last_reply_by_user"][user] = now
            sent += 1
            time.sleep(config.get("delay_between_replies_seconds", 3) if client.live else 0)

    if client.live or first_run:
        state["initialized"] = True
    state["seen_replies"] = sorted(seen) if (client.live or first_run) else state["seen_replies"]
    return sent


def run_insights(client, limit):
    for t in client.my_threads(limit):
        try:
            m = client.insights(t["id"])
        except ThreadsError as e:
            print(f"[insights] {t['id']} 실패: {e}", file=sys.stderr)
            continue
        print(f"{t.get('timestamp','')[:16]} {(t.get('text') or '')[:20]!r} "
              + " ".join(f"{k}={v}" for k, v in m.items()))


# ---------- CLI ----------

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["post", "reply", "insights", "run"])
    ap.add_argument("--live", action="store_true", help="실제로 발행/응답한다 (기본: 모의 실행)")
    ap.add_argument("--config", default=HERE / "config.json")
    ap.add_argument("--posts", default=HERE / "posts.json")
    ap.add_argument("--state", default=HERE / "state.json")
    args = ap.parse_args(argv)

    token = os.environ.get("THREADS_ACCESS_TOKEN")
    if not token:
        sys.exit("환경변수 THREADS_ACCESS_TOKEN 이 필요합니다.")
    config = load_json(args.config, {})
    client = ThreadsClient(token, live=args.live)
    me = client.me()
    print(f"계정 @{me['username']} ({'LIVE' if args.live else 'DRY-RUN'})")

    def once():
        state = load_json(args.state, new_state())
        if args.command in ("post", "run"):
            run_posts(client, load_json(args.posts, []), state)
        if args.command in ("reply", "run"):
            run_replies(client, config, state, me["id"], me["username"])
        if args.command == "insights":
            run_insights(client, config.get("recent_posts", 10))
        if args.live:
            save_json(args.state, state)

    if args.command == "run":
        interval = config.get("poll_interval_seconds", 120)
        while True:
            try:
                once()
            except ThreadsError as e:
                print(f"[run] 오류: {e}", file=sys.stderr)
            time.sleep(interval)
    else:
        once()


if __name__ == "__main__":
    main()
