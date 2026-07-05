import { useEffect, useState } from 'react'
import Plan from './modules/Plan'
import Concepts from './modules/Concepts'
import Quiz from './modules/Quiz'
import Cards from './modules/Cards'
import Procedures from './modules/Procedures'
import { firebaseEnabled, watchAuth, signIn, signOutUser } from './firebase'
import { syncOnLogin, clearUid } from './store'

const TABS = [
  ['plan', '4주 플랜'],
  ['concepts', '개념'],
  ['quiz', '필기 CBT'],
  ['cards', '암기카드'],
  ['proc', '손순서'],
]

function initTheme() {
  const saved = localStorage.getItem('cssd-theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function App() {
  const [tab, setTab] = useState('plan')
  const [conceptSubject, setConceptSubject] = useState('컴퓨터 일반')
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState(initTheme)
  const [quizNav, setQuizNav] = useState({ view: 'setup', key: 0 })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('cssd-theme', theme)
  }, [theme])

  function openConcepts(subject) {
    setConceptSubject(subject)
    setTab('concepts')
  }

  function openQuiz(view) {
    setQuizNav((q) => ({ view, key: q.key + 1 })) // key 변경으로 Quiz 재마운트
    setTab('quiz')
  }

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u)
      if (u) syncOnLogin(u.uid).catch(console.error)
      else clearUid()
    })
    return unsub
  }, [])

  return (
    <div className="app">
      <header>
        <h1>CSSD <span>Level-Ⅰ</span></h1>
        <div className="auth">
          <button
            className="ghost icon"
            title={theme === 'dark' ? '라이트 테마로' : '다크 테마로'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {firebaseEnabled ? (
            user ? (
              <>
                <span className="user">{user.displayName}</span>
                <button className="ghost" onClick={signOutUser}>로그아웃</button>
              </>
            ) : (
              <button onClick={() => signIn().catch(console.error)}>Google 로그인</button>
            )
          ) : (
            <span className="badge">로컬 모드</span>
          )}
        </div>
      </header>
      <nav>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => (key === 'quiz' ? openQuiz('setup') : setTab(key))}
          >
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'plan' && <Plan onOpenConcepts={openConcepts} onOpenQuiz={openQuiz} onOpenTab={setTab} />}
        {tab === 'concepts' && <Concepts subject={conceptSubject} onSubjectChange={setConceptSubject} />}
        {tab === 'quiz' && <Quiz key={quizNav.key} initialMode={quizNav.view} />}
        {tab === 'cards' && <Cards />}
        {tab === 'proc' && <Procedures />}
      </main>
    </div>
  )
}
