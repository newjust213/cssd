import { useMemo, useState } from 'react'
import allCards from '../data/cards.json'
import { useProgress } from '../useProgress'
import { update } from '../store'

// Leitner 간격 (일)
const INTERVALS = [0, 1, 2, 4, 7, 15]
const DAY = 24 * 60 * 60 * 1000

const DECKS = ['전체', '엑셀 함수', 'Access 쿼리']

export default function Cards() {
  const progress = useProgress()
  const [deck, setDeck] = useState('전체')
  const [session, setSession] = useState(null) // null | { queue, i, flipped, done }

  const pool = useMemo(
    () => (deck === '전체' ? allCards : allCards.filter((c) => c.deck === deck)),
    [deck],
  )
  const due = pool.filter((c) => {
    const s = progress.cards[c.id]
    return !s || s.due <= Date.now()
  })

  function start(cards) {
    if (cards.length === 0) return
    setSession({ queue: cards, i: 0, flipped: false, done: 0 })
  }

  function grade(ok) {
    const card = session.queue[session.i]
    update((p) => {
      const s = p.cards[card.id] || { level: 0, due: 0, last: 0 }
      s.level = ok ? Math.min(s.level + 1, INTERVALS.length - 1) : 0
      s.due = Date.now() + INTERVALS[s.level] * DAY
      s.last = Date.now()
      p.cards[card.id] = s
    })
    if (session.i + 1 >= session.queue.length) setSession(null)
    else setSession({ ...session, i: session.i + 1, flipped: false, done: session.done + 1 })
  }

  if (session) {
    const card = session.queue[session.i]
    return (
      <div className="card center">
        <div className="quiz-head">
          <span>{session.i + 1} / {session.queue.length}</span>
          <span className="subject">{card.deck}</span>
          <button className="ghost" onClick={() => setSession(null)}>종료</button>
        </div>
        <div className={session.flipped ? 'flash back' : 'flash'} onClick={() => setSession({ ...session, flipped: !session.flipped })}>
          <pre>{session.flipped ? card.back : card.front}</pre>
          <span className="hint">{session.flipped ? '' : '탭하여 정답 보기'}</span>
        </div>
        {session.flipped && (
          <div className="row">
            <button className="danger" onClick={() => grade(false)}>몰랐다</button>
            <button className="primary" onClick={() => grade(true)}>알았다</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <h2>암기카드 (SRS)</h2>
      <div className="chips">
        {DECKS.map((d) => (
          <button key={d} className={deck === d ? 'chip active' : 'chip'} onClick={() => setDeck(d)}>
            {d}
          </button>
        ))}
      </div>
      <p className="note">
        오늘 복습할 카드 <strong>{due.length}</strong> / 전체 {pool.length}장.
        맞히면 복습 간격이 1→2→4→7→15일로 늘어나고, 틀리면 처음으로 돌아갑니다.
      </p>
      <div className="row">
        <button className="primary" onClick={() => start(due)} disabled={due.length === 0}>
          오늘 복습 시작
        </button>
        <button className="ghost" onClick={() => start(pool)}>전체 훑기</button>
      </div>
    </div>
  )
}
