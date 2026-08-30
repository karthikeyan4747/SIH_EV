import {
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type DragEvent as ReactDragEvent,
  type ChangeEvent as ReactChangeEvent,
} from 'react'

interface DragInputBase {
  onDropFiles?: (files: File[]) => void
  rawFiles?: boolean
}

export interface DragInputProps extends DragInputBase {
  as?: 'input' | 'textarea'
  input?: ComponentPropsWithoutRef<'input'>
  textarea?: ComponentPropsWithoutRef<'textarea'>
  children?: ReactNode
}

export function DragInput(props: DragInputProps) {
  const {
    as = 'input',
    onDropFiles,
    rawFiles = false,
    input,
    textarea,
    children,
  } = props

  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  const handleDragOver = useCallback(
    (e: ReactDragEvent) => {
      if (onDropFiles || rawFiles) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        return
      }

      const hasText = Array.from(e.dataTransfer.items).some(
        (item) =>
          item.kind === 'string' ||
          (item.kind === 'file' &&
            item.type.startsWith('text/')),
      )
      if (hasText) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    },
    [onDropFiles, rawFiles],
  )

  const handleDragEnter = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault()
      if (onDropFiles || rawFiles) {
        setIsDragging(true)
        setDragCounter((c) => c + 1)
        return
      }
      const hasText = Array.from(e.dataTransfer.items).some(
        (item) =>
          item.kind === 'string' ||
          (item.kind === 'file' &&
            item.type.startsWith('text/')),
      )
      if (hasText) {
        setIsDragging(true)
        setDragCounter((c) => c + 1)
      }
    },
    [onDropFiles, rawFiles],
  )

  const handleDragLeave = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault()
      if (dragCounter > 1) {
        setDragCounter((c) => c - 1)
        return
      }
      setIsDragging(false)
      setDragCounter(0)
    },
    [dragCounter],
  )

  const handleDrop = useCallback(
    async (e: ReactDragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      setDragCounter(0)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) {
        return
      }

      if (onDropFiles || rawFiles) {
        onDropFiles?.(files)
        return
      }

      const file = files[0]
      try {
        const text = await file.text()
        if (as === 'textarea') {
          const event = {
            target: { value: text },
          } as unknown as ReactChangeEvent<HTMLTextAreaElement>
          textarea?.onChange?.(event)
        } else {
          const event = {
            target: { value: text },
          } as unknown as ReactChangeEvent<HTMLInputElement>
          input?.onChange?.(event)
        }
      } catch {
        // Not a text file — nothing to populate
      }
    },
    [onDropFiles, rawFiles, as, textarea, input],
  )

  const dragProps = {
    onDragOver: handleDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  }

  const dragClass = isDragging
    ? 'drag-input-drop'
    : 'drag-input'

  if (as === 'textarea') {
    return (
      <textarea
        {...textarea}
        className={`${dragClass} ${textarea?.className ?? ''}`}
        {...dragProps}
      >
        {children}
      </textarea>
    )
  }

  return (
    <input
      {...input}
      className={`${dragClass} ${input?.className ?? ''}`}
      {...dragProps}
    />
  )
}
