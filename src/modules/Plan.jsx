import plan from '../data/plan.json'
import { useProgress } from '../useProgress'
import { update } from '../store'

const GOTO_LABEL = {
  quiz: 'CBT 풀이 →',
  'quiz-wrong': '오답노트 →',
  cards: '암기카드 →',
  proc: '손순서 →',
  exam: '모의고사 →',
}

export default function Plan({ onOpenConcepts, onOpenQuiz, onOpenTab }) {
  const progress = useProgress()
  const total = plan.reduce((n, w) => n + w.tasks.length, 0)
  const done = plan.reduce((n, w) => n + w.tasks.filter((t) => progress.plan[t.id]).length, 0)

  return (
    <div>
      <div className="card">
        <div className="progress-head">
          <strong>전체 진도</strong>
          <span>{done} / {total} ({Math.round((done / total) * 100)}%)</span>
        </div>
        <div className="bar"><div style={{ width: `${(done / total) * 100}%` }} /></div>
      </div>
      {plan.map((w) => {
        const wDone = w.tasks.filter((t) => progress.plan[t.id]).length
        return (
          <div className="card" key={w.week}>
            <div className="progress-head">
              <strong>{w.week}주차 · {w.title}</strong>
              <span>{wDone}/{w.tasks.length}</span>
            </div>
            <p className="note">{w.note}</p>
            <ul className="tasks">
              {w.tasks.map((t) => (
                <li key={t.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!progress.plan[t.id]}
                      onChange={(e) =>
                        update((p) => {
                          if (e.target.checked) p.plan[t.id] = true
                          else delete p.plan[t.id]
                        })
                      }
                    />
                    <span>{t.label}</span>
                  </label>
                  {t.concept && (
                    <button className="link" onClick={() => onOpenConcepts(t.concept)}>
                      개념 보기 →
                    </button>
                  )}
                  {t.goto && (
                    <button
                      className="link"
                      onClick={() =>
                        t.goto.startsWith('quiz')
                          ? onOpenQuiz(t.goto === 'quiz-wrong' ? 'wrong' : 'setup')
                          : onOpenTab(t.goto)
                      }
                    >
                      {GOTO_LABEL[t.goto]}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
