import { useEffect, useMemo, useState } from 'react'
import allQuestions from '../data/quiz.json'
import { useProgress } from '../useProgress'
import { update } from '../store'

const SUBJECTS = ['전체', '컴퓨터 일반', '스프레드시트 일반', '데이터베이스 일반']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Quiz() {
  const progress = useProgress()
  const [mode, setMode] = useState('setup') // setup | run | result | wrong
  const [subject, setSubject] = useState('전체')
  const [wrongOnly, setWrongOnly] = useState(false)
  const [queue, setQueue] = useState([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState(null)
  const [results, setResults] = useState([])
  const [startAt, setStartAt] = useState(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (mode !== 'run') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [mode])

  const wrongList = useMemo(
    () => allQuestions.filter((q) => progress.wrong[q.id]),
    [progress.wrong],
  )

  function start() {
    let pool = allQuestions
    if (subject !== '전체') pool = pool.filter((q) => q.subject === subject)
    if (wrongOnly) pool = pool.filter((q) => progress.wrong[q.id])
    if (pool.length === 0) return alert('해당 조건의 문제가 없습니다.')
    setQueue(shuffle(pool))
    setIdx(0)
    setPicked(null)
    setResults([])
    setStartAt(Date.now())
    setNow(Date.now())
    setMode('run')
  }

  function pick(i) {
    if (picked !== null) return
    setPicked(i)
    const q = queue[idx]
    const correct = i === q.answer
    setResults((r) => [...r, { id: q.id, correct }])
    update((p) => {
      const s = p.quiz[q.id] || { correct: 0, wrong: 0, last: 0 }
      if (correct) {
        s.correct += 1
        delete p.wrong[q.id]
      } else {
        s.wrong += 1
        p.wrong[q.id] = true
      }
      s.last = Date.now()
      p.quiz[q.id] = s
    })
  }

  function next() {
    if (idx + 1 >= queue.length) setMode('result')
    else {
      setIdx(idx + 1)
      setPicked(null)
    }
  }

  if (mode === 'setup') {
    return (
      <div className="card">
        <h2>필기 CBT</h2>
        <div className="field">
          <label>과목</label>
          <div className="chips">
            {SUBJECTS.map((s) => (
              <button key={s} className={subject === s ? 'chip active' : 'chip'} onClick={() => setSubject(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} />
          오답노트 문제만 ({wrongList.length}문제)
        </label>
        <div className="row">
          <button className="primary" onClick={start}>시작</button>
          <button className="ghost" onClick={() => setMode('wrong')}>오답노트 보기</button>
        </div>
        <p className="note">현재 문제은행: {allQuestions.length}문제 (샘플). 시나공 PDF 파싱 파이프라인으로 확장 예정.</p>
      </div>
    )
  }

  if (mode === 'wrong') {
    return (
      <div>
        <div className="card row">
          <h2>오답노트 ({wrongList.length})</h2>
          <button className="ghost" onClick={() => setMode('setup')}>돌아가기</button>
        </div>
        {wrongList.length === 0 && <div className="card note">오답이 없습니다.</div>}
        {wrongList.map((q) => (
          <div className="card" key={q.id}>
            <p className="subject">{q.subject}</p>
            <p><strong>{q.question}</strong></p>
            <ol className="choices-static">
              {q.choices.map((c, i) => (
                <li key={i} className={i === q.answer ? 'answer' : ''}>{c}</li>
              ))}
            </ol>
            <p className="explain">{q.explain}</p>
          </div>
        ))}
      </div>
    )
  }

  if (mode === 'result') {
    const correct = results.filter((r) => r.correct).length
    const score = Math.round((correct / results.length) * 100)
    return (
      <div className="card center">
        <h2>결과</h2>
        <p className="score">{score}점</p>
        <p>{results.length}문제 중 {correct}문제 정답 · 소요 {Math.round((now - startAt) / 1000 / 60)}분</p>
        <p className={score >= 60 ? 'pass' : 'fail'}>{score >= 60 ? '합격권 (과목당 40점 이상 조건 별도)' : '60점 미만 — 오답 복습 필요'}</p>
        <div className="row">
          <button className="primary" onClick={() => setMode('setup')}>다시</button>
        </div>
      </div>
    )
  }

  const q = queue[idx]
  const elapsed = Math.floor((now - startAt) / 1000)
  return (
    <div className="card">
      <div className="quiz-head">
        <span>{idx + 1} / {queue.length}</span>
        <span className="subject">{q.subject}</span>
        <span className="timer">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
      </div>
      <p className="question">{q.question}</p>
      <div className="choices">
        {q.choices.map((c, i) => {
          let cls = 'choice'
          if (picked !== null) {
            if (i === q.answer) cls += ' correct'
            else if (i === picked) cls += ' incorrect'
          }
          return (
            <button key={i} className={cls} onClick={() => pick(i)}>
              <b>{'①②③④'[i]}</b> {c}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <>
          <p className="explain">{q.explain}</p>
          <button className="primary" onClick={next}>
            {idx + 1 >= queue.length ? '결과 보기' : '다음 문제'}
          </button>
        </>
      )}
    </div>
  )
}
