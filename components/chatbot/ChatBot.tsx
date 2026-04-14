'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, X, Send, Bot, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Faq {
  id: string
  question: string
  answer: string
  keywords: string[]
}

interface Message {
  role: 'user' | 'bot'
  text: string
}

interface Props {
  cohortId: string
}

// ── 플랫폼 기본 내장 FAQ ─────────────────────────────────────────────────────
const BUILT_IN_FAQS: Faq[] = [
  {
    id: '__bi_1',
    question: '글쓰기 과제를 제출하려면 어떻게 하나요?',
    answer: '📝 **글쓰기 과제 제출 방법**\n\n1. 왼쪽 사이드바에서 **"과제 제출"** 메뉴를 클릭하세요.\n2. **"글쓰기 과제"** 탭에서 해당 과제 카드를 찾으세요.\n3. 카드 하단의 **"작성하고 제출하기"** 버튼을 클릭하면 작성 창이 열립니다.\n4. 내용을 작성하거나 파일을 첨부한 뒤 **"제출하기"** 버튼을 누르세요.',
    keywords: ['과제', '글쓰기', '제출', '작성', '제출하기', '과제제출'],
  },
  {
    id: '__bi_2',
    question: '설문 응답은 어떻게 하나요?',
    answer: '📋 **설문 응답 방법**\n\n1. 왼쪽 사이드바에서 **"과제 제출"** 메뉴를 클릭하세요.\n2. **"설문"** 탭으로 전환하세요.\n3. 응답할 설문 카드에서 **"응답하기"** 버튼을 클릭하세요.\n4. 모든 질문에 답한 뒤 **"제출"** 버튼을 누르면 완료됩니다.\n\n💡 이미 응답한 설문은 "응답 완료" 표시가 됩니다.',
    keywords: ['설문', '응답', '설문응답', '설문제출', '응답하기'],
  },
  {
    id: '__bi_3',
    question: '프로필 사진이나 닉네임을 바꾸고 싶어요.',
    answer: '👤 **프로필 수정 방법**\n\n1. 사이드바 하단의 **내 프로필 영역**을 클릭하거나, 주소창에서 프로필 페이지로 이동하세요.\n2. 프로필 페이지에서:\n   - **사진**: 프로필 이미지의 카메라 아이콘(📷)을 클릭하세요.\n   - **닉네임**: 아래 "정보 수정" 폼에서 닉네임을 수정하세요.\n   - **소개글**: 간단한 자기소개를 입력할 수 있어요.\n3. 수정 후 **"저장하기"** 버튼을 클릭하세요.',
    keywords: ['프로필', '사진', '닉네임', '이름', '변경', '수정', '아바타', '소개글'],
  },
  {
    id: '__bi_4',
    question: '강의 영상은 어디서 보나요?',
    answer: '🎬 **강의 영상 보기**\n\n1. 왼쪽 사이드바에서 **"콘텐츠"** 메뉴를 클릭하세요.\n2. Zoom 녹화 영상 목록이 표시됩니다.\n3. 원하는 강의 카드의 **"영상 보기"** 버튼을 클릭하면 새 탭에서 영상이 열립니다.\n\n💡 강의 영상은 관리자가 Zoom과 연동하여 업로드합니다.',
    keywords: ['강의', '영상', '녹화', 'zoom', '줌', '콘텐츠', '동영상', '비디오'],
  },
  {
    id: '__bi_5',
    question: '사진을 업로드하거나 다운로드하려면?',
    answer: '📸 **사진 업로드 방법**\n\n1. 사이드바에서 **"사진 게시판"** 을 클릭하세요.\n2. 앨범을 선택하고 **"사진 추가"** 버튼을 클릭하세요.\n3. 파일을 선택하거나 드래그앤드롭하면 업로드됩니다.\n\n**다운로드 방법**\n- 개별 다운로드: 사진 위에 마우스를 올리면 나타나는 다운로드 아이콘을 클릭하세요.\n- 전체 다운로드: 앨범 화면에서 **"전체 다운로드"** 버튼을 클릭하면 ZIP 파일로 받을 수 있어요.',
    keywords: ['사진', '업로드', '다운로드', '앨범', '사진게시판', '이미지', '저장'],
  },
  {
    id: '__bi_6',
    question: '커뮤니티에 글을 작성하고 싶어요.',
    answer: '💬 **커뮤니티 글쓰기**\n\n1. 사이드바에서 **"커뮤니티"** 메뉴를 클릭하세요.\n2. 오른쪽 상단의 **"글쓰기"** 버튼을 클릭하세요.\n3. 제목, 내용을 작성하고 파일도 첨부할 수 있어요.\n4. **"게시하기"** 버튼을 클릭하면 게시됩니다.\n\n💡 게시글에 좋아요(👏), 별(⭐), 댓글을 남길 수 있어요.',
    keywords: ['커뮤니티', '글', '글쓰기', '게시글', '게시', '포스트', '작성'],
  },
  {
    id: '__bi_7',
    question: '과제 완료율은 어떻게 계산되나요?',
    answer: '📊 **과제 완료율 계산 방식**\n\n완료율 = (제출한 글쓰기 과제 수 + 응답한 설문 수) ÷ (전체 글쓰기 과제 수 + 전체 설문 수) × 100\n\n예) 글쓰기 과제 3개 중 2개 제출, 설문 2개 중 2개 응답 → 완료율 = 4/5 = 80%\n\n💡 과제 페이지 상단에서 내 완료율을 확인할 수 있어요.',
    keywords: ['완료율', '과제율', '달성률', '통계', '완료', '비율', '퍼센트'],
  },
  {
    id: '__bi_9',
    question: '휴대폰 번호는 누가 볼 수 있나요?',
    answer: '🔒 **개인정보 보호**\n\n등록된 휴대폰 번호는 **관리자만** 확인할 수 있습니다.\n\n- 다른 수강생은 볼 수 없어요.\n- 프로필 페이지에서 언제든 번호를 수정할 수 있어요.\n- 번호 입력은 선택 사항입니다.',
    keywords: ['휴대폰', '전화번호', '개인정보', '번호', '공개', '비공개', '프라이버시'],
  },
  {
    id: '__bi_10',
    question: '로그인이 안 되거나 비밀번호를 잊었어요.',
    answer: '🔑 **로그인 문제 해결**\n\n비밀번호를 잊은 경우:\n1. 로그인 페이지에서 **"비밀번호 찾기"** 링크를 클릭하세요.\n2. 가입한 이메일을 입력하면 재설정 링크가 발송됩니다.\n3. 이메일함(스팸 폴더 포함)을 확인해 주세요.\n\n문제가 계속된다면 운영진에게 문의해 주세요.',
    keywords: ['로그인', '비밀번호', '로그인안됨', '비번', '찾기', '재설정', '이메일'],
  },
]

// ── 키워드 매칭 알고리즘 ─────────────────────────────────────────────────────
function findBestMatch(input: string, faqs: Faq[]): Faq | null {
  if (!input.trim()) return null
  const lower = input.toLowerCase()
  const words = lower.split(/[\s,]+/).filter(Boolean)

  let best: { faq: Faq; score: number } | null = null

  for (const faq of faqs) {
    let score = 0
    for (const kw of faq.keywords) {
      const kwLower = kw.toLowerCase()
      if (lower.includes(kwLower)) score += 3       // 문장 내 포함
      for (const w of words) {
        if (kwLower.includes(w) && w.length >= 2) score += 1
        if (w.includes(kwLower) && kwLower.length >= 2) score += 1
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { faq, score }
    }
  }

  return best && best.score >= 2 ? best.faq : null
}

// ── 빠른 질문 버튼 목록 ─────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  '글쓰기 과제 제출 방법',
  '설문 응답 방법',
  '프로필 사진 변경',
  '강의 영상 보기',
  '사진 다운로드',
  '커뮤니티 글쓰기',
]

export function ChatBot({ cohortId }: Props) {
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text: '안녕하세요! 👋 TEU 플랫폼 도우미입니다.\n\n궁금한 내용을 아래 빠른 버튼에서 선택하거나, 직접 질문을 입력해 보세요.',
    },
  ])
  const [input, setInput] = useState('')
  const [customFaqs, setCustomFaqs] = useState<Faq[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── 뒤로가기 버튼으로 채팅창 닫기 ───────────────────────────
  // window.location.hash 직접 대입은 브라우저 레벨 동작 → Next.js 패치 우회
  // hashchange의 oldURL/newURL로 "chatbot → 없음" 방향만 정확히 감지
  useEffect(() => {
    const onHashChange = (e: HashChangeEvent) => {
      if (e.oldURL.includes('#chatbot') && !e.newURL.includes('#chatbot')) {
        setOpen(false)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const openChat = () => {
    // location.hash 직접 대입 → 브라우저가 히스토리 항목 추가 + hashchange 발생
    window.location.hash = 'chatbot'
    setOpen(true)
  }

  const closeChat = () => {
    // replaceState로 hash만 제거 → hashchange 발생 안 함 → 무한루프 없음
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setOpen(false)
  }

  // 커스텀 FAQ 불러오기
  useEffect(() => {
    if (!open) return
    supabase
      .from('chatbot_faqs')
      .select('id, question, answer, keywords')
      .eq('cohort_id', cohortId)
      .order('order_index', { ascending: true })
      .then(({ data }) => {
        if (data) setCustomFaqs(data as Faq[])
      })
  }, [open, cohortId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 새 메시지 시 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 창 열릴 때 입력 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const allFaqs = [...customFaqs, ...BUILT_IN_FAQS]

  const respond = (userText: string) => {
    const userMsg: Message = { role: 'user', text: userText }
    const match = findBestMatch(userText, allFaqs)
    const botMsg: Message = {
      role: 'bot',
      text: match
        ? match.answer
        : '😅 죄송해요, 해당 질문에 대한 답변을 찾지 못했어요.\n\n다른 키워드로 다시 질문해 주시거나, 운영진에게 직접 문의해 주세요!\n\n**자주 묻는 질문**을 아래 버튼에서 선택해 보세요.',
    }
    setMessages((prev) => [...prev, userMsg, botMsg])
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    respond(text)
  }

  const handleQuick = (q: string) => {
    respond(q)
  }

  // 줄바꿈과 **볼드** 렌더링
  const renderText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      )
    })
  }

  return (
    <>
      {/* ── 플로팅 버튼 ── */}
      <button
        onClick={() => open ? closeChat() : openChat()}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          open
            ? 'bg-gray-700 hover:bg-gray-800'
            : 'bg-indigo-600 hover:bg-indigo-700'
        )}
        aria-label="도움말 챗봇"
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <MessageCircle className="w-6 h-6 text-white" />
        }
      </button>

      {/* ── 채팅 창 ── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(560px, calc(100vh - 120px))' }}>

          {/* 헤더 */}
          <div className="bg-indigo-600 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">TEU 도우미</p>
              <p className="text-indigo-200 text-xs">플랫폼 사용 안내</p>
            </div>
            <button
              onClick={closeChat}
              className="text-indigo-200 hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <Bot className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm'
                  )}
                >
                  {renderText(msg.text)}
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {/* 빠른 질문 칩 — 입력창 위 항상 표시 */}
          <div className="px-3 pt-2.5 pb-1 border-t border-gray-100 bg-white">
            <p className="text-[10px] text-gray-400 font-medium mb-1.5 px-1">자주 묻는 질문</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuick(q)}
                  className="flex-shrink-0 text-xs bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* 입력 영역 */}
          <div className="px-3 pt-1.5 pb-3 bg-white">
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="직접 질문을 입력하세요..."
                className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                  input.trim()
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
