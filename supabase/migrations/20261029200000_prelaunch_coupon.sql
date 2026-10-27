-- 사전 신청(랜딩) 감사 쿠폰 템플릿. 같은 이메일로 가입하면 서버(api/gamify.js prelaunch.claim)가 한 번만 지급한다(출처 referral, 기준값 'prelaunch').
insert into public.coupon_templates (code, name, type, value, valid_days) values
  ('PRELAUNCH5000', '{"ko":"사전 신청 감사 5천원 쿠폰","en":"Pre-launch thank-you 5,000 KRW coupon","zh":"预约感谢5千韩元优惠券","ja":"事前申込 感謝5千ウォンクーポン","es":"Cupón de agradecimiento de 5.000 KRW"}', 'amount', 5000, 90)
on conflict (code) do nothing;
