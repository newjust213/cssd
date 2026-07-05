import { useEffect, useRef, useState } from 'react'
import { useProgress } from '../useProgress'
import { update } from '../store'

const PARTS = [
  { name: '엑셀', secs: 45 * 60 },
  { name: 'Access', secs: 45 * 60 },
]

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)
  } catch {
    /* 소리 실패는 무시 */
  }
}

function fmt(s) {
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function Exam() {
  const progress = useProgress()
  const [phase, setPhase] = useState('setup') // setup | run | between | record
  const [part, setPart] = useState(0)
  const [remaining, setRemaining] = useState(PARTS[0].secs)
  const [paused, setPaused] = useState(false)
  const endAtRef = useRef(0)
  const [excel, setExcel] = useState('')
  const [access, setAccess] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (phase !== 'run' || paused) return
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        beep()
        finishPart()
      }
    }, 500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, part])

  function startPart(idx) {
    setPart(idx)
    endAtRef.current = Date.now() + PARTS[idx].secs * 1000
    setRemaining(PARTS[idx].secs)
    setPaused(false)
    setPhase('run')
  }

  function togglePause() {
    if (paused) {
      endAtRef.current = Date.now() + remaining * 1000
      setPaused(false)
    } else {
      setRemaining(Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000)))
      setPaused(true)
    }
  }

  function finishPart() {
    if (part === 0) setPhase('between')
    else setPhase('record')
  }

  function saveRecord() {
    const e = Number(excel)
    const a = Number(access)
    update((p) => {
      if (!p.exams) p.exams = []
      p.exams.push({
        ts: Date.now(),
        excel: Number.isFinite(e) ? e : null,
        access: Number.isFinite(a) ? a : null,
        note: note.trim(),
      })
    })
    setExcel('')
    setAccess('')
    setNote('')
    setPhase('setup')
  }

  if (phase === 'run') {
    const warn = remaining <= 300
    return (
      <div className="card center">
        <p className="subject">{part + 1}교시 · {PARTS[part].name} 실기</p>
        <p className={warn ? 'clock warn' : 'clock'}>{fmt(remaining)}</p>
        {paused && <p className="note">일시 정지됨</p>}
        {warn && !paused && <p className="fail">5분 이내 — 저장(Ctrl+S) 확인!</p>}
        <div className="row">
          <button className="ghost" onClick={togglePause}>{paused ? '재개' : '일시정지'}</button>
          <button className="danger" onClick={finishPart}>
            {part === 0 ? '엑셀 종료' : '시험 종료'}
          </button>
        </div>
        <p className="note" style={{ marginTop: 16 }}>
          실전처럼: 문제 순서대로 풀지 말고 확실한 것부터. 막히면 3분 룰로 넘어가기.
        </p>
      </div>
    )
  }

  if (phase === 'between') {
    return (
      <div className="card center">
        <h2>1교시(엑셀) 종료</h2>
        <p className="note">실제 시험은 과목 전환 시 감독관 확인 시간이 있습니다. 잠시 호흡 고르고 시작하세요.</p>
        <div className="row">
          <button className="primary" onClick={() => startPart(1)}>2교시 Access 시작 (45:00)</button>
          <button className="ghost" onClick={() => setPhase('record')}>Access 생략</button>
        </div>
      </div>
    )
  }

  if (phase === 'record') {
    return (
      <div className="card">
        <h2>자가 채점 기록</h2>
        <div className="field">
          <label>엑셀 점수 (0~100)</label>
          <input type="number" min="0" max="100" value={excel} onChange={(e) => setExcel(e.target.value)} />
        </div>
        <div className="field">
          <label>Access 점수 (0~100)</label>
          <input type="number" min="0" max="100" value={access} onChange={(e) => setAccess(e.target.value)} />
        </div>
        <div className="field">
          <label>오답 손순서 메모 — "왜 틀렸나"가 아니라 "다음엔 어떤 순서로 조작할지"</label>
          <textarea
            rows="5"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예) 피벗: 외부데이터 가져오기 → 필드 배치 → 날짜 그룹(월) → 값 표시형식 → 스타일"
          />
        </div>
        <div className="row">
          <button className="primary" onClick={saveRecord}>저장</button>
          <button className="ghost" onClick={() => setPhase('setup')}>기록 없이 종료</button>
        </div>
      </div>
    )
  }

  // setup + 히스토리
  const exams = [...(progress.exams || [])].sort((a, b) => b.ts - a.ts)
  return (
    <div>
      <div className="card center">
        <h2>실전 모의고사</h2>
        <p className="note">엑셀 45분 + Access 45분. 합격 기준: 두 프로그램 각각 70점 이상.</p>
        <div className="row">
          <button className="primary" onClick={() => startPart(0)}>1교시 엑셀 시작 (45:00)</button>
          <button className="ghost" onClick={() => startPart(1)}>Access만 (45:00)</button>
        </div>
      </div>
      <div className="card">
        <h2>회차 기록 ({exams.length})</h2>
        {exams.length === 0 && <p className="note">아직 기록이 없습니다. 4주차에 최소 4회를 목표로.</p>}
        {exams.map((x) => {
          const pass = x.excel >= 70 && x.access >= 70
          return (
            <div className="exam-row" key={x.ts}>
              <div className="exam-head">
                <span>{new Date(x.ts).toLocaleDateString('ko-KR')}</span>
                <span>엑셀 <b className={x.excel >= 70 ? 'pass' : 'fail'}>{x.excel ?? '-'}</b></span>
                <span>Access <b className={x.access >= 70 ? 'pass' : 'fail'}>{x.access ?? '-'}</b></span>
                <span className={pass ? 'badge-pass' : 'badge-fail'}>{pass ? '합격' : '불합격'}</span>
              </div>
              {x.note && <p className="note">{x.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
