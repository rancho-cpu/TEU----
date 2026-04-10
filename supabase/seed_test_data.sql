-- ============================================================
-- TEU 교육 플랫폼 테스트 시드 데이터
-- Supabase SQL 에디터에서 실행하세요.
-- ============================================================

DO $$
DECLARE
  v_cohort_id   uuid;
  v_admin_id    uuid;
  v_post1_id    uuid;
  v_post2_id    uuid;
  v_post3_id    uuid;
  v_post4_id    uuid;
  v_post5_id    uuid;
  v_post6_id    uuid;
  v_survey1_id  uuid;
  v_survey2_id  uuid;
BEGIN

  -- ── 1. 첫 번째 코호트 & 관리자 가져오기 ──────────────────────
  SELECT id INTO v_cohort_id FROM public.cohorts ORDER BY created_at LIMIT 1;
  SELECT id INTO v_admin_id  FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  IF v_cohort_id IS NULL THEN
    RAISE EXCEPTION '코호트가 없습니다. 먼저 코호트를 생성하세요.';
  END IF;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '관리자 계정이 없습니다. 먼저 관리자로 가입하세요.';
  END IF;

  -- ── 2. 공지 게시글 (고정) ────────────────────────────────────
  INSERT INTO public.posts (cohort_id, user_id, title, content, category, is_pinned)
  VALUES (
    v_cohort_id, v_admin_id,
    '✅ TEU MED 5기 OT 안내 및 일정 공지',
    E'안녕하세요, TEU MED 5기 여러분!\n\n이번 기수 오리엔테이션 일정을 안내드립니다.\n\n📅 일시: 2026년 4월 15일(화) 오후 7시\n📍 장소: Zoom 온라인 (링크는 콘텐츠 탭에서 확인)\n\n참석이 어려운 분들은 미리 말씀해주시면 녹화본을 공유해드리겠습니다.\n궁금한 점은 댓글로 남겨주세요 😊',
    '공지',
    true
  )
  RETURNING id INTO v_post1_id;

  -- ── 3. 일반 게시글들 ──────────────────────────────────────────
  INSERT INTO public.posts (cohort_id, user_id, title, content, category)
  VALUES (
    v_cohort_id, v_admin_id,
    '1주차 강의 후기 & 느낀 점 공유해요!',
    E'안녕하세요! 오늘 첫 강의를 듣고 왔는데 정말 유익했습니다 😊\n\n특히 콘텐츠 기획 파트에서 "왜 만드는가"를 먼저 정의해야 한다는 부분이 많이 와닿았어요.\n\n여러분들은 어떤 부분이 가장 인상 깊었나요? 댓글로 공유해요!',
    '일반'
  )
  RETURNING id INTO v_post2_id;

  INSERT INTO public.posts (cohort_id, user_id, title, content, category)
  VALUES (
    v_cohort_id, v_admin_id,
    '유튜브 채널 개설 시 썸네일 크기 질문이요',
    E'안녕하세요! 유튜브 채널 막 개설했는데요,\n\n썸네일 권장 사이즈가 1280x720이라고 들었는데 실제로 다들 어떻게 제작하시나요?\nCanva 쓰시는 분들 계신가요? 추천 템플릿 있으면 알려주세요 🙏',
    '질문'
  )
  RETURNING id INTO v_post3_id;

  INSERT INTO public.posts (cohort_id, user_id, title, content, category)
  VALUES (
    v_cohort_id, v_admin_id,
    '[자료] 콘텐츠 기획서 템플릿 공유드려요',
    E'안녕하세요! 강의에서 배운 내용을 바탕으로 콘텐츠 기획서 템플릿을 만들어봤어요.\n\n구글 문서로 공유드립니다 👇\nhttps://docs.google.com/...\n\n포함 항목:\n- 타겟 페르소나 정의\n- 콘텐츠 목표 설정\n- 채널 톤앤매너\n- 월별 콘텐츠 캘린더\n\n자유롭게 복사해서 사용하세요!',
    '자료'
  )
  RETURNING id INTO v_post4_id;

  INSERT INTO public.posts (cohort_id, user_id, title, content, category)
  VALUES (
    v_cohort_id, v_admin_id,
    '인스타그램 릴스 vs 유튜브 쇼츠, 어디에 집중하셨나요?',
    E'저는 지금 두 채널을 동시에 운영하려고 하는데, 초반에 에너지를 분산시키는 게 맞는 전략인지 고민이 돼서요.\n\n여러분은 처음에 어느 채널에 먼저 집중하셨나요?\n성과가 나기까지 얼마나 걸렸는지도 궁금해요 😅',
    '질문'
  )
  RETURNING id INTO v_post5_id;

  INSERT INTO public.posts (cohort_id, user_id, title, content, category)
  VALUES (
    v_cohort_id, v_admin_id,
    '2주차 과제 제출했습니다 - 채널 컨셉 기획',
    E'안녕하세요! 2주차 과제로 제 채널 컨셉을 정리해봤어요.\n\n채널명: "30대의 첫 투자"\n타겟: 투자를 시작하고 싶지만 어디서부터 시작해야 할지 모르는 30대\n콘텐츠 방향: 주 1회 10분 이내의 입문 영상\n\n피드백 부탁드려요 🙏',
    '일반'
  )
  RETURNING id INTO v_post6_id;

  -- ── 4. 댓글 추가 ─────────────────────────────────────────────
  INSERT INTO public.comments (post_id, user_id, content) VALUES
    (v_post2_id, v_admin_id, '저도 기획 파트 너무 좋았어요! 다음 주가 기대됩니다 😊'),
    (v_post3_id, v_admin_id, 'Canva 강력 추천드려요! 무료 플랜으로도 충분히 예쁜 썸네일 만들 수 있어요. YouTube 썸네일 템플릿 검색하시면 바로 나옵니다!'),
    (v_post4_id, v_admin_id, '너무 감사합니다! 바로 복사해서 써볼게요 🙌'),
    (v_post5_id, v_admin_id, '저는 유튜브 쇼츠에 먼저 집중했어요. 알고리즘 타기가 릴스보다 쉬운 편인 것 같더라고요. 3개월 정도 꾸준히 올렸더니 서서히 반응이 오기 시작했어요!'),
    (v_post6_id, v_admin_id, '채널 컨셉 너무 명확하네요! 30대 직장인들이 공감할 수 있는 콘텐츠가 나올 것 같아요. 첫 영상이 기대됩니다 👍');

  -- ── 5. 좋아요 추가 ───────────────────────────────────────────
  INSERT INTO public.post_likes (post_id, user_id) VALUES
    (v_post2_id, v_admin_id),
    (v_post4_id, v_admin_id),
    (v_post6_id, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── 6. 설문 추가 ─────────────────────────────────────────────
  INSERT INTO public.surveys (cohort_id, title, description, questions, deadline)
  VALUES (
    v_cohort_id,
    '1주차 강의 만족도 조사',
    E'지난주 강의는 어떠셨나요?\n솔직한 피드백이 더 좋은 교육을 만드는 데 큰 도움이 됩니다 🙏',
    '[
      {
        "id": "q1",
        "type": "scale",
        "label": "전반적인 강의 만족도를 평가해주세요.",
        "min": 1,
        "max": 5,
        "required": true
      },
      {
        "id": "q2",
        "type": "multiple_choice",
        "label": "가장 유익했던 파트는 무엇인가요?",
        "options": ["콘텐츠 기획론", "채널 전략", "알고리즘 이해", "실습 세션"],
        "required": true
      },
      {
        "id": "q3",
        "type": "text",
        "label": "강의에서 아쉬웠던 점이나 개선 사항이 있다면 알려주세요.",
        "required": false
      }
    ]'::jsonb,
    now() + interval '7 days'
  )
  RETURNING id INTO v_survey1_id;

  INSERT INTO public.surveys (cohort_id, title, description, questions, deadline)
  VALUES (
    v_cohort_id,
    '2주차 과제 제출 확인',
    E'2주차 과제인 "채널 컨셉 기획서"를 제출해주세요.\n기획서는 자유 양식으로 작성하시고, 링크 또는 내용을 아래에 입력해주세요.',
    '[
      {
        "id": "q1",
        "type": "text",
        "label": "채널명과 채널 컨셉을 간단히 소개해주세요.",
        "required": true
      },
      {
        "id": "q2",
        "type": "text",
        "label": "타겟 시청자는 누구인가요? (연령대, 관심사 등)",
        "required": true
      },
      {
        "id": "q3",
        "type": "multiple_choice",
        "label": "주로 어떤 플랫폼에서 운영할 예정인가요?",
        "options": ["유튜브", "인스타그램", "틱톡", "복수 운영"],
        "required": true
      },
      {
        "id": "q4",
        "type": "text",
        "label": "기획서 링크 (구글 문서, 노션 등) 또는 내용을 붙여넣어 주세요.",
        "required": true
      }
    ]'::jsonb,
    now() + interval '5 days'
  )
  RETURNING id INTO v_survey2_id;

  RAISE NOTICE '✅ 시드 데이터 삽입 완료!';
  RAISE NOTICE '   코호트 ID: %', v_cohort_id;
  RAISE NOTICE '   게시글 6개, 댓글 5개, 설문 2개 추가됨';

END $$;
