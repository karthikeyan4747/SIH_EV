import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  loadingLabel?: string
}

export function Button({
  variant = 'secondary',
  className = '',
  loading = false,
  loadingLabel,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ui-button-${variant} ${loading ? 'is-loading' : ''} ${className}`}
      data-loading={loading ? 'true' : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="button-loader" aria-hidden="true" />}
      <span className="button-content">{loadingLabel && loading ? loadingLabel : children}</span>
    </button>
  )
}
