-- 3단계 게이미피케이션 ⑤ 초기 데이터 (이미 적용됨): XP 규칙, 쿠폰 3종, 레벨 보상, 도장판 2개, 질문 은행 8개, 시즌 1과 미션 3개
insert into public.xp_rules (kind, xp, label) values
  ('attend', 50, '모임 참여(출석)'), ('review', 20, '후기 작성'), ('host', 80, '모임 호스팅'), ('checkin', 5, '데일리 체크인'), ('streak7', 30, '7일 연속 체크인 보너스');

insert into public.coupon_templates (code, name, type, value, valid_days) values
  ('PCT10', '{"ko":"10% 할인 쿠폰","en":"10% off coupon","zh":"9折优惠券","ja":"10%割引クーポン","es":"Cupón del 10 %"}', 'percent', 10, 90),
  ('AMT10000', '{"ko":"1만원 할인 쿠폰","en":"10,000 KRW off coupon","zh":"1万韩元优惠券","ja":"1万ウォン割引クーポン","es":"Cupón de 10.000 KRW"}', 'amount', 10000, 90),
  ('PRIORITY', '{"ko":"우선 참여권","en":"Priority pass","zh":"优先参加券","ja":"優先参加権","es":"Pase prioritario"}', 'priority', 0, 60);

insert into public.level_rewards (level, coupon_template_id) values
  (3, (select id from public.coupon_templates where code = 'PRIORITY')),
  (5, (select id from public.coupon_templates where code = 'AMT10000'));

insert into public.stamp_boards (code, title, kind, goal, coupon_template_id) values
  ('continents', '{"ko":"대륙 도장판 (3개 지역 모으기)","en":"Region stamps (collect 3 regions)","zh":"地区印章（集齐3个地区）","ja":"地域スタンプ（3地域）","es":"Sellos de regiones (3 regiones)"}', 'region', 3, (select id from public.coupon_templates where code = 'PCT10')),
  ('hobbies', '{"ko":"취향 도장판 (5가지 관심사 모으기)","en":"Interest stamps (collect 5 interests)","zh":"兴趣印章（集齐5种兴趣）","ja":"趣味スタンプ（5種類）","es":"Sellos de intereses (5 intereses)"}', 'tag', 5, (select id from public.coupon_templates where code = 'AMT10000'));

insert into public.question_bank (question, a, b) values
  ('{"ko":"여행지에서 하루를 시작한다면?","en":"How would you start a day on a trip?","zh":"旅行中的一天，你会怎么开始？","ja":"旅先の朝、どう始める？","es":"¿Cómo empezarías un día de viaje?"}', '{"ko":"새벽 일출 보러 출발","en":"Leave at dawn for the sunrise","zh":"清晨出发看日出","ja":"夜明け前に日の出を見に出発","es":"Salir al amanecer a ver el sol"}', '{"ko":"느긋하게 늦잠 후 브런치","en":"Sleep in, then brunch","zh":"睡个懒觉再吃早午餐","ja":"ゆっくり寝てブランチ","es":"Dormir hasta tarde y brunch"}'),
  ('{"ko":"여행 짐은?","en":"Your packing style?","zh":"你的行李风格？","ja":"荷物のスタイルは？","es":"¿Tu estilo de equipaje?"}', '{"ko":"미니멀, 가방 하나로","en":"Minimal, one bag","zh":"极简，一个包","ja":"ミニマル、バッグ1つ","es":"Minimalista, una maleta"}', '{"ko":"만약을 대비해 가득","en":"Packed for every case","zh":"以防万一，装满","ja":"万が一に備えてたっぷり","es":"Por si acaso, lleno"}'),
  ('{"ko":"일정을 짠다면?","en":"How do you plan?","zh":"你怎么安排行程？","ja":"日程はどう組む？","es":"¿Cómo planificas?"}', '{"ko":"분 단위 계획표","en":"A minute-by-minute plan","zh":"精确到分钟的计划","ja":"分刻みの計画表","es":"Plan minuto a minuto"}', '{"ko":"발길 닿는 대로","en":"Wherever my feet take me","zh":"走到哪算哪","ja":"足の向くまま","es":"Donde me lleven los pies"}'),
  ('{"ko":"새로운 사람을 만나면?","en":"Meeting someone new?","zh":"遇到新朋友时？","ja":"初対面の人には？","es":"¿Al conocer a alguien?"}', '{"ko":"내가 먼저 말을 건다","en":"I say hi first","zh":"我先开口","ja":"自分から話しかける","es":"Yo saludo primero"}', '{"ko":"말 걸어 주길 기다린다","en":"I wait to be approached","zh":"等对方先开口","ja":"話しかけられるのを待つ","es":"Espero a que me hablen"}'),
  ('{"ko":"쉬는 시간엔?","en":"Downtime on a trip?","zh":"休息时间做什么？","ja":"休憩時間は？","es":"¿En tu tiempo libre?"}', '{"ko":"바다 앞에서 멍때리기","en":"Zone out by the sea","zh":"在海边发呆","ja":"海辺でぼんやり","es":"Mirar el mar sin pensar"}', '{"ko":"산 정상에서 경치 보기","en":"Enjoy a mountain-top view","zh":"在山顶看风景","ja":"山頂で景色を眺める","es":"Admirar la vista desde la cima"}'),
  ('{"ko":"여행 사진은?","en":"Travel photos?","zh":"旅行照片？","ja":"旅行の写真は？","es":"¿Fotos de viaje?"}', '{"ko":"인생샷 한 장을 오래","en":"One perfect shot, patiently","zh":"耐心拍一张完美照","ja":"一枚をじっくり","es":"Una foto perfecta con calma"}', '{"ko":"순간을 많이 찍기","en":"Lots of quick snaps","zh":"多拍瞬间","ja":"瞬間をたくさん","es":"Muchas fotos rápidas"}'),
  ('{"ko":"맛집 앞에 줄이 길다면?","en":"A long line at a famous restaurant?","zh":"名店门口排长队？","ja":"人気店に行列が…","es":"¿Cola larga en un restaurante famoso?"}', '{"ko":"기다려서라도 먹는다","en":"Worth the wait","zh":"排队也要吃","ja":"待ってでも食べる","es":"Merece la espera"}', '{"ko":"바로 들어갈 수 있는 곳으로","en":"Find a place with no wait","zh":"去不用排队的店","ja":"すぐ入れる店へ","es":"Busco un sitio sin cola"}'),
  ('{"ko":"여행이 끝난 뒤엔?","en":"After the trip?","zh":"旅行结束后？","ja":"旅の後は？","es":"¿Después del viaje?"}', '{"ko":"단톡방에 후기를 바로 공유","en":"Share memories in the group chat right away","zh":"马上在群里分享","ja":"すぐグループチャットで共有","es":"Comparto recuerdos en el chat enseguida"}', '{"ko":"조용히 앨범 정리","en":"Quietly sort my album","zh":"安静地整理相册","ja":"静かにアルバム整理","es":"Ordeno mi álbum en silencio"}');

insert into public.seasons (name, starts_on, ends_on, active) values ('가을·겨울 시즌 1', '2026-10-27', '2026-12-31', true);
insert into public.season_missions (season_id, kind, goal, title, coupon_template_id)
select s.id, m.kind, m.goal, m.title::jsonb, (select id from public.coupon_templates where code = m.code)
from public.seasons s, (values
  ('attend', 5, 'AMT10000', '{"ko":"우리 크루 모임 출석 5회","en":"Crew attends 5 trips","zh":"团队累计出席5次","ja":"クルーで5回出席","es":"El equipo asiste a 5 viajes"}'),
  ('review', 3, 'PCT10', '{"ko":"우리 크루 후기 3개 작성","en":"Crew writes 3 reviews","zh":"团队累计写3篇评价","ja":"クルーで3件のレビュー","es":"El equipo escribe 3 reseñas"}'),
  ('checkin', 30, 'PRIORITY', '{"ko":"우리 크루 데일리 체크인 30회","en":"Crew does 30 daily check-ins","zh":"团队累计打卡30次","ja":"クルーでデイリー30回","es":"El equipo hace 30 check-ins"}')
) as m(kind, goal, code, title) where s.active;

-- 가상 모임에 지역·태그 입력(도장판·칭호 시험용)
update public.trips set region = 'asia', tags = '{cafe,photo}' where title like '%도쿄%';
update public.trips set region = 'asia', tags = '{sea,food}' where title like '%다낭%';
update public.trips set region = 'asia', tags = '{hiking,cafe}' where title like '%치앙마이%';
update public.trips set region = 'europe', tags = '{exhibition,cafe}' where title like '%파리%';
update public.trips set region = 'europe', tags = '{hiking,photo}' where title like '%알프스%';
update public.trips set region = 'europe', tags = '{sea,photo}' where title like '%산토리니%';
update public.trips set region = 'americas', tags = '{exhibition,music,food}' where title like '%뉴욕%';
update public.trips set region = 'americas', tags = '{sea,workout}' where title like '%하와이%';
update public.trips set region = 'americas', tags = '{camping,hiking}' where title like '%로키%';

select public.rotate_daily_question();
