'use client'

import * as React from 'react'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = '', size = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`flex h-full w-full items-center justify-center rounded-full font-medium ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarFallback }
