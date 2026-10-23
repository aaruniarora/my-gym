import { useState } from 'react'

export default function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="info" aria-label="More info" aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}>i</button>
      {open && <span className="info-note">{text}</span>}
    </>
  )
}
