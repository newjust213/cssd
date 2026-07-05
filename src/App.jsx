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

export default function App() {
  const [tab, setTab] = useState('plan')
  const [conceptSubject, setConceptSubject] = useState('컴퓨터 일반')
  const [user, setUser] = useState(null)

  function openConcepts(subject) {
    setConceptSubject(subject)
    setTab('concepts')
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
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'plan' && <Plan onOpenConcepts={openConcepts} />}
        {tab === 'concepts' && <Concepts subject={conceptSubject} onSubjectChange={setConceptSubject} />}
        {tab === 'quiz' && <Quiz />}
        {tab === 'cards' && <Cards />}
        {tab === 'proc' && <Procedures />}
      </main>
    </div>
  )
}
