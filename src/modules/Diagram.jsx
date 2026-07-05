import { useEffect, useState } from 'react'

// SVG를 <img>가 아닌 인라인으로 주입해 페이지의 CSS 변수(테마)가
// SVG 내부 var(--dg-*) 색상까지 전파되도록 한다.
const cache = {}

export default function Diagram({ file, caption }) {
  const [svg, setSvg] = useState(cache[file] || '')

  useEffect(() => {
    let alive = true
    if (cache[file]) {
      setSvg(cache[file])
      return
    }
    fetch(`${import.meta.env.BASE_URL}diagrams/${file}`)
      .then((r) => r.text())
      .then((text) => {
        cache[file] = text
        if (alive) setSvg(text)
      })
      .catch(console.error)
    return () => {
      alive = false
    }
  }, [file])

  return (
    <figure className="diagram">
      <div className="diagram-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}
