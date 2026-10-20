import { useEffect, useState } from 'react'
import type { Exercise } from '../../content/schema'
import { exdbImages, exerciseById } from '../content'
import type { Settings } from '../lib/types'

type Props = { exercise: Exercise; settings?: Settings; onSettings?: (s: Settings) => void }

// exdb photos alternate every second; youtube loops muted
export function Demo({ exercise }: { exercise: Exercise }) {
  const images = exdbImages(exercise)
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => f + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    addEventListener('online', update)
    addEventListener('offline', update)
    return () => { removeEventListener('online', update); removeEventListener('offline', update) }
  }, [])
  const { media } = exercise
  if (images.length > 0) return <img className="demo" src={images[frame % images.length]} alt={exercise.name} />
  if (media.kind !== 'youtube') return null
  const id = media.videoId
  if (id && !online) return (
    <>
      <img className="demo" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={exercise.name} />
      <p className="muted">Video needs internet - follow the cues</p>
    </>
  )
  return id
    ? <iframe className="demo video" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1`}
        title={exercise.name} allow="autoplay; encrypted-media; picture-in-picture" />
    : <p className="muted">Video: search "{media.searchHint}"</p>
}

export default function TechniqueCard({ exercise, settings, onSettings }: Props) {
  const { technique } = exercise

  return (
    <div className="technique">
      <h2>{exercise.name}</h2>
      <Demo exercise={exercise} />
      <h3>Setup</h3>
      <p>{technique.setup}</p>
      <h3>Cues</h3>
      <ol>{technique.cues.map((c) => <li key={c}>{c}</li>)}</ol>
      <h3>Common mistakes</h3>
      <ul>{technique.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
      <div className="stop-if">
        <h3>Stop if</h3>
        <ul>{technique.stopIf.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
      {exercise.regression && <p>Easier: {exerciseById[exercise.regression]?.name ?? exercise.regression}</p>}
      {exercise.progression && <p>Harder: {exerciseById[exercise.progression]?.name ?? exercise.progression}</p>}
      {settings && onSettings && (
        <div className="row">
          {(['neverShow', 'favourites'] as const).map((k) => {
            const on = settings[k].includes(exercise.id)
            return (
              <button key={k} className={on ? 'primary' : ''}
                onClick={() => onSettings({ ...settings, [k]: on ? settings[k].filter((id) => id !== exercise.id) : [...settings[k], exercise.id] })}>
                {k === 'neverShow' ? 'Never show' : 'Favourite'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
