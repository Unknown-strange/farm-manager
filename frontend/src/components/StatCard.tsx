import React from 'react'
import { UnifiedCard, type CardVariant } from './UnifiedCard'

export interface StatCardProps {
  label: string
  value: React.ReactNode
  helper?: React.ReactNode
  icon?: React.ReactNode
  variant?: CardVariant
  className?: string
  children?: React.ReactNode
}

export function StatCard(props: StatCardProps) {
  return <UnifiedCard {...props} />
}
