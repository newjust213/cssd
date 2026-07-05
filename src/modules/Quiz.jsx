import { useEffect, useMemo, useState } from 'react'
import sampleQuestions from '../data/quiz.json'
import { useProgress } from '../useProgress'
import { update } from '../store'

// quiz-bank.json은 시나공 PDF 파싱 산출물(개인 학습용, git 미포함).
// 파일이 없으면 샘플 문제만으로 동작한다.
const bankModules = import.meta.glob('../data/quiz-bank.json', { eager: true })
const bank = Object.values(bankModules).flatMap((m) => m.default ?? [])
const allQuestions = [...sampleQuestions, ...bank]

const SUBJECTS = ['전체', '컴퓨터 일반', '스프레드시트 일반', '데이터베이스 일반']
const COUNTS = [10, 20, 60, 0] // 0 = 전체

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
  const [source, setSource] = useState('전체')
  const [count, setCount] = useState(20)
  const [wrongOnly, setWrongOnly] = useState(false)
  const [skipImage, setSkipImage] = useState(false)
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

  const sources = useMemo(() => {
    const s = [...new Set(allQuestions.map((q) => q.source || '샘플'))]
    return ['전체', ...s.sort()]
  }, [])

  const wrongList = useMemo(
    () => allQuestions.filter((q) => progress.wrong[q.id]),
    [progress.wrong],
  )

  function start() {
    let pool = allQuestions
    if (subject !== '전체') pool = pool.filter((q) => q.subject === subject)
    if (source !== '전체') pool = pool.filter((q) => (q.source || '샘플') === source)
    if (wrongOnly) pool = pool.filter((q) => progress.wrong[q.id])
    if (skipImage) pool = pool.filter((q) => !q.hasImage)
    if (pool.length === 0) return alert('해당 조건의 문제가 없습니다.')
    // 특정 회차 선택 시 실전 순서 유지, 그 외 랜덤
    let picked = source !== '전체' ? [...pool].sort((a, b) => a.id.localeCompare(b.id)) : shuffle(pool)
    if (count > 0) picked = picked.slice(0, count)
    setQueue(picked)
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
        <div className="field">
          <label>회차</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>문항 수</label>
          <div className="chips">
            {COUNTS.map((c) => (
              <button key={c} className={count === c ? 'chip active' : 'chip'} onClick={() => setCount(c)}>
                {c === 0 ? '전체' : `${c}문제`}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={skipImage} onChange={(e) => setSkipImage(e.target.checked)} />
          그림/표 지문 문항 제외
        </label>
        <label className="check">
          <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} />
          오답노트 문제만 ({wrongList.length}문제)
        </label>
        <div className="row">
          <button className="primary" onClick={start}>시작</button>
          <button className="ghost" onClick={() => setMode('wrong')}>오답노트 보기</button>
        </div>
        <p className="note">문제은행 {allQuestions.length}문항 (기출 {bank.length} + 샘플 {sampleQuestions.length})</p>
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
            <p className="subject">{q.subject} · {q.source || '샘플'}</p>
            <p><strong>{q.question}</strong></p>
            {(q.images || []).map((f) => (
              <img key={f} className="qfig" src={`${import.meta.env.BASE_URL}figures/${f}`} alt="문항 그림" />
            ))}
            <ol className="choices-static">
              {q.choices.map((c, i) => (
                <li key={i} className={i === q.answer ? 'answer' : ''}>{c}</li>
              ))}
            </ol>
            {q.explain && <p className="explain">{q.explain}</p>}
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
        <span className="subject">{q.subject} · {q.source || '샘플'}</span>
        <span className="timer">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
      </div>
      <p className="question">{q.question}</p>
      {(q.images || []).map((f) => (
        <img key={f} className="qfig" src={`${import.meta.env.BASE_URL}figures/${f}`} alt="문항 그림" />
      ))}
      {q.hasImage && !(q.images || []).length && (
        <p className="note">⚠ 그림/표 지문 문항 — 원본 PDF 참조 필요</p>
      )}
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
          {q.explain && <p className="explain">{q.explain}</p>}
          <button className="primary" onClick={next}>
            {idx + 1 >= queue.length ? '결과 보기' : '다음 문제'}
          </button>
        </>
      )}
    </div>
  )
}
