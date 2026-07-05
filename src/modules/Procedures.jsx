import { useState } from 'react'
import procedures from '../data/procedures.json'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Procedures() {
  const [current, setCurrent] = useState(null) // { proc, shuffled, placed, misses }

  function start(proc) {
    setCurrent({
      proc,
      shuffled: shuffle(proc.steps.map((s, i) => ({ text: s, order: i }))),
      placed: [],
      misses: 0,
    })
  }

  function tap(step) {
    if (step.order === current.placed.length) {
      setCurrent({ ...current, placed: [...current.placed, step] })
    } else {
      setCurrent({ ...current, misses: current.misses + 1 })
    }
  }

  if (current) {
    const { proc, shuffled, placed, misses } = current
    const remaining = shuffled.filter((s) => !placed.includes(s))
    const complete = placed.length === proc.steps.length
    return (
      <div className="card">
        <div className="quiz-head">
          <strong>{proc.title}</strong>
          <button className="ghost" onClick={() => setCurrent(null)}>목록</button>
        </div>
        <p className="note">조작 순서대로 단계를 탭하세요. 실수 {misses}회</p>
        <ol className="placed">
          {placed.map((s, i) => (
            <li key={i}>{s.text}</li>
          ))}
        </ol>
        {!complete ? (
          <div className="steps">
            {remaining.map((s, i) => (
              <button key={i} className="step" onClick={() => tap(s)}>
                {s.text}
              </button>
            ))}
          </div>
        ) : (
          <div className="center">
            <p className={misses === 0 ? 'pass' : 'note'}>
              {misses === 0 ? '완벽! 손이 순서를 기억합니다.' : `완료. 실수 ${misses}회 — 다시 한 번.`}
            </p>
            <div className="row">
              <button className="primary" onClick={() => start(proc)}>다시</button>
              <button className="ghost" onClick={() => setCurrent(null)}>목록</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {['엑셀', 'Access'].map((area) => (
        <div className="card" key={area}>
          <h2>{area} 손순서</h2>
          <div className="proc-list">
            {procedures
              .filter((p) => p.area === area)
              .map((p) => (
                <button key={p.id} className="proc" onClick={() => start(p)}>
                  {p.title} <span className="note">{p.steps.length}단계</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
