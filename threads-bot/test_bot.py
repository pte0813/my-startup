import unittest
from datetime import datetime, timezone

import bot


class FakeClient:
    live = True

    def __init__(self, convo):
        self.convo, self.sent = convo, []

    def my_threads(self, limit=10):
        return [{"id": "T1"}]

    def conversation(self, media_id):
        return self.convo

    def publish(self, text, reply_to_id=None, image_url=None):
        self.sent.append((text, reply_to_id))
        return "new"


RULES = {"rules": [{"keywords": ["가격"], "replies": ["{username} 가격안내"]},
                   {"default": True, "replies": ["{username} 감사"]}],
         "delay_between_replies_seconds": 0}


class Tests(unittest.TestCase):
    def test_pick_reply(self):
        self.assertEqual(bot.pick_reply("가격 알려주세요", RULES["rules"]), "{username} 가격안내")
        self.assertEqual(bot.pick_reply("안녕", RULES["rules"]), "{username} 감사")
        self.assertIsNone(bot.pick_reply("안녕", RULES["rules"][:1]))

    def test_first_run_seeds_only(self):
        c = FakeClient([{"id": "1", "text": "가격?", "username": "a"}])
        st = bot.new_state()
        self.assertEqual(bot.run_replies(c, RULES, st, "me", "me"), 0)
        self.assertIn("1", st["seen_replies"])

    def test_reply_dedupe_cooldown_and_self(self):
        c = FakeClient([{"id": "2", "text": "가격?", "username": "a"},
                        {"id": "3", "text": "또", "username": "a"},
                        {"id": "4", "text": "내글", "username": "me"}])
        st = bot.new_state()
        st["initialized"] = True
        self.assertEqual(bot.run_replies(c, RULES, st, "me", "me", now=10000), 1)
        self.assertEqual(c.sent, [("a 가격안내", "2")])  # 3은 쿨다운, 4는 본인
        self.assertEqual(bot.run_replies(c, RULES, st, "me", "me", now=10001), 0)

    def test_posts_due_only_once(self):
        c = FakeClient([])
        posts = [{"id": "p1", "at": "2026-01-01T00:00:00+09:00", "text": "hi"},
                 {"id": "p2", "at": "2999-01-01T00:00:00+09:00", "text": "later"}]
        st = bot.new_state()
        now = datetime(2026, 6, 1, tzinfo=timezone.utc)
        self.assertEqual(bot.run_posts(c, posts, st, now), 1)
        self.assertEqual(bot.run_posts(c, posts, st, now), 0)

    def test_too_long(self):
        with self.assertRaises(bot.ThreadsError):
            bot.ThreadsClient("t", live=True).publish("가" * 501)


if __name__ == "__main__":
    unittest.main()
