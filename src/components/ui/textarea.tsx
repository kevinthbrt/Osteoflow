import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    const resize = (el: HTMLTextAreaElement) => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }

    const setRef = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
        if (el) resize(el)
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [ref]
    )

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      resize(e.target)
      onChange?.(e)
    }

    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden resize-none',
          className
        )}
        ref={setRef}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
