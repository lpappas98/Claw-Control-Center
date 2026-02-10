import { useState } from 'react'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      className={`btn ghost ${copied ? 'copied' : ''}`}
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
      type="button"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
