import { useState } from 'react'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <button
      className={`btn ghost ${copied ? 'copied' : ''}`}
      onClick={async () => {
        setFailed(false)
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        } catch {
          // Some browsers (or non-secure contexts) block clipboard access.
          // Fall back to a prompt so the user can manually copy.
          setFailed(true)
          window.prompt('Copy to clipboard:', text)
        }
      }}
      type="button"
      title={failed ? 'Clipboard unavailable — using manual copy prompt.' : undefined}
    >
      {copied ? 'Copied' : failed ? 'Copy (manual)' : label}
    </button>
  )
}
