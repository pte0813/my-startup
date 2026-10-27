-- 시험용 가상 여행 9개에 일러스트 세트 연결(테스트 데이터)
update public.trips set art_key = case id
  when 'ff8f48ad-30f7-4185-8aa3-8c4f0b4ea61e' then 'tokyo'
  when '7edd9d6f-8589-42d5-866e-912caaaa6abf' then 'danang'
  when 'd7b9a750-5398-4860-8fc5-7e6f23eb2257' then 'chiangmai'
  when '65c25411-1d0e-4361-a902-a95877747e80' then 'paris'
  when 'a9d58c97-5477-4186-8210-49cd254453dc' then 'alps'
  when '820ade43-5eb8-4ca6-ad89-df67d7c6b869' then 'santorini'
  when 'f2b639a4-c82e-4c9a-9646-b82210a4bbca' then 'newyork'
  when '5cafc179-15c9-4ccd-8284-9b9ed70f440f' then 'hawaii'
  when '74d4d0d7-537d-46e4-ba05-74949c5ec550' then 'rockies' end
where id in ('ff8f48ad-30f7-4185-8aa3-8c4f0b4ea61e','7edd9d6f-8589-42d5-866e-912caaaa6abf','d7b9a750-5398-4860-8fc5-7e6f23eb2257','65c25411-1d0e-4361-a902-a95877747e80','a9d58c97-5477-4186-8210-49cd254453dc','820ade43-5eb8-4ca6-ad89-df67d7c6b869','f2b639a4-c82e-4c9a-9646-b82210a4bbca','5cafc179-15c9-4ccd-8284-9b9ed70f440f','74d4d0d7-537d-46e4-ba05-74949c5ec550');
