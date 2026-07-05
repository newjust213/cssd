import { useState } from 'react'
import concepts from '../data/concepts.json'
import Diagram from './Diagram'
import { useProgress } from '../useProgress'
import { update } from '../store'

const SUBJECTS = Object.keys(concepts)

export default function Concepts({ subject, onSubjectChange }) {
  const progress = useProgress()
  const [openAll, setOpenAll] = useState(false)
  const sections = concepts[subject] || []
  const readKey = (i) => `concept:${subject}:${i}`
  const readCount = sections.filter((_, i) => progress.plan[readKey(i)]).length

  return (
    <div>
      <div className="card">
        <h2>핵심 개념</h2>
        <div className="chips">
          {SUBJECTS.map((s) => (
            <button key={s} className={subject === s ? 'chip active' : 'chip'} onClick={() => onSubjectChange(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="progress-head" style={{ marginTop: 12 }}>
          <span className="note">읽음 표시 {readCount} / {sections.length}</span>
          <button className="ghost" onClick={() => setOpenAll(!openAll)}>
            {openAll ? '모두 접기' : '모두 펼치기'}
          </button>
        </div>
      </div>
      {sections.map((sec, i) => (
        <details className="card concept" key={`${subject}-${i}`} open={openAll || undefined}>
          <summary>
            <span className={progress.plan[readKey(i)] ? 'read' : ''}>{i + 1}. {sec.title}</span>
            <label className="check-inline" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={!!progress.plan[readKey(i)]}
                onChange={(e) =>
                  update((p) => {
                    if (e.target.checked) p.plan[readKey(i)] = true
                    else delete p.plan[readKey(i)]
                  })
                }
              />
              읽음
            </label>
          </summary>
          {(sec.images || []).map((im) => (
            <Diagram key={im.file} file={im.file} caption={im.caption} />
          ))}
          <ul className="points">
            {sec.points.map((pt, j) => (
              <li key={j}>{pt}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
