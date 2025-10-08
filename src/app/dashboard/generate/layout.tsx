import { ReactNode } from 'react'
import { GeneratorProvider } from '@/contexts/GeneratorContext'

export default function GenerateLayout({ children }: { children: ReactNode }) {
  return (
    <GeneratorProvider>
      {children}
    </GeneratorProvider>
  )
}
