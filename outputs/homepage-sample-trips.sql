-- 화면 확인용 예시 여행 3개 (실제 여행이 아니므로 확인 후 Table Editor에서 지우거나 수정하세요)
insert into public.trips (title, summary, location, start_date, end_date, price, capacity, status, sort_order) values
  ('[예시] 제주 1박 2일 소셜링', '성향이 맞는 6명이 함께 떠나는 가벼운 제주 여행', '제주', current_date + 30, current_date + 31, 189000, 8, 'open', 1),
  ('[예시] 강릉 당일 바다 산책', '아침 기차로 만나 저녁에 헤어지는 당일 여행', '강릉', current_date + 60, current_date + 60, 79000, 10, 'upcoming', 2),
  ('[예시] 여수 밤바다 1박 2일', '지난 여행입니다', '여수', current_date - 40, current_date - 39, 159000, 8, 'past', 3);
