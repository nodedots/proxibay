import { useRef, useState } from 'react'

/**
 * Service-account JSON file picker. Reads the file as text, validates JSON,
 * and hands it to the parent (which fills the paste textarea — still editable).
 */
export default function SaJsonUpload(props: {
  onLoaded: (text: string) => void
  onInvalid: (message: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  function resetInput() {
    if (inputRef.current) inputRef.current.value = ''
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024) {
      props.onInvalid('That file is too large for a service-account key (max 100 KB).')
      setFileName(null)
      resetInput()
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      try {
        JSON.parse(text)
      } catch {
        props.onInvalid('That file isn’t valid JSON — check you uploaded the right file.')
        setFileName(null)
        resetInput()
        return
      }
      setFileName(file.name)
      props.onLoaded(text)
    }
    reader.onerror = () => {
      props.onInvalid('Couldn’t read that file. Try again.')
      setFileName(null)
      resetInput()
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
        disabled={props.disabled}
        aria-label="Upload service-account JSON file"
      />
      <button
        type="button"
        className="btn-ghost"
        disabled={props.disabled}
        onClick={() => inputRef.current?.click()}
      >
        Upload JSON file
      </button>
      {fileName ? (
        <span className="font-inter text-sm text-ink-muted">
          {fileName} · loaded below
          <button
            type="button"
            className="text-link ml-2 text-sm"
            onClick={() => {
              setFileName(null)
              resetInput()
              props.onLoaded('')
            }}
          >
            Clear
          </button>
        </span>
      ) : (
        <span className="font-inter text-sm text-ink-muted">or paste the contents below</span>
      )}
    </div>
  )
}
