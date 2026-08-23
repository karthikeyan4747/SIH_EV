import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ${className}`} {...props} />
}
