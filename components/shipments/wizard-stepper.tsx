'use client'

import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WizardStepperProps {
  currentStep: number
  maxStepAllowed: number
  onStepClick: (step: number) => void
}

const STEPS = [
  { step: 1, title: 'Bước 1', description: 'Khởi tạo lô hàng' },
  { step: 2, title: 'Bước 2', description: 'Thông tin & Hàng hóa' },
  { step: 3, title: 'Bước 3', description: 'Đính kèm chứng từ' },
]

export function WizardStepper({ currentStep, maxStepAllowed, onStepClick }: WizardStepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {STEPS.map((s, idx) => {
          const isCurrent = s.step === currentStep
          const isCompleted = s.step < currentStep || (s.step < maxStepAllowed && s.step !== currentStep)
          const isClickable = s.step <= maxStepAllowed && s.step !== currentStep

          return (
            <div key={s.step} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(s.step)}
                disabled={!isClickable}
                className={cn(
                  'group flex items-center gap-3 text-left transition-all',
                  isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                )}
              >
                <div
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isCurrent && 'border-primary bg-primary text-primary-foreground shadow-sm',
                    isCompleted && !isCurrent && 'border-primary bg-primary/10 text-primary',
                    !isCurrent && !isCompleted && 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
                  )}
                >
                  {isCompleted && !isCurrent ? <CheckIcon className="size-4 stroke-[2.5]" /> : s.step}
                </div>
                <div className="hidden sm:block">
                  <div
                    className={cn(
                      'text-xs font-medium uppercase tracking-wider',
                      isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {s.title}
                  </div>
                  <div
                    className={cn(
                      'text-sm font-medium',
                      isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {s.description}
                  </div>
                </div>
              </button>

              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-3 sm:mx-6 h-0.5 flex-1 transition-colors',
                    s.step < currentStep ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

