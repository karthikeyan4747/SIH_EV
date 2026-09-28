import React from 'react'
import '../../skeleton.css'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  variant?: 'text' | 'rectangular' | 'circular' | 'card'
  lines?: number
  style?: React.CSSProperties
}

export function Skeleton({
  className = '',
  width,
  height,
  borderRadius,
  variant = 'rectangular',
  lines = 1,
  style = {},
}: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className={`skeleton-group ${className}`} style={style}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skeleton skeleton-text ${i === lines - 1 ? 'last-line' : ''}`}
            style={{
              width: i === lines - 1 ? '70%' : width || '100%',
              height: height || '13px',
              borderRadius: borderRadius || '4px',
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`skeleton skeleton-${variant} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        ...style,
      }}
    />
  )
}

export function IntegritySkeleton() {
  return (
    <div className="skeleton-integrity-container">
      <div className="skeleton-status-banner">
        <Skeleton variant="circular" width={24} height={24} />
        <div style={{ flex: 1 }}>
          <Skeleton width="45%" height={16} style={{ marginBottom: '6px' }} />
          <Skeleton width="75%" height={12} />
        </div>
      </div>
      <div className="skeleton-metrics-grid">
        <div className="skeleton-metric-card">
          <Skeleton width="50%" height={12} style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height={24} style={{ marginBottom: '6px' }} />
          <Skeleton width="70%" height={10} />
        </div>
        <div className="skeleton-metric-card">
          <Skeleton width="50%" height={12} style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height={24} style={{ marginBottom: '6px' }} />
          <Skeleton width="70%" height={10} />
        </div>
        <div className="skeleton-metric-card">
          <Skeleton width="50%" height={12} style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height={24} style={{ marginBottom: '6px' }} />
          <Skeleton width="70%" height={10} />
        </div>
        <div className="skeleton-metric-card">
          <Skeleton width="50%" height={12} style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height={24} style={{ marginBottom: '6px' }} />
          <Skeleton width="70%" height={10} />
        </div>
      </div>
      <div className="skeleton-conflict-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <Skeleton width="30%" height={16} />
          <Skeleton width="15%" height={16} borderRadius={8} />
        </div>
        <Skeleton lines={2} style={{ marginBottom: '16px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Skeleton height={60} borderRadius={6} />
          <Skeleton height={60} borderRadius={6} />
        </div>
      </div>
    </div>
  )
}

export function DNASkeleton() {
  return (
    <div className="skeleton-dna-container">
      <div className="skeleton-dna-map">
        <div className="skeleton-helix-mock">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-dna-row">
              <Skeleton width={130} height={44} borderRadius={8} />
              <div className="skeleton-helix-line" />
              <Skeleton width={130} height={44} borderRadius={8} />
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton-dna-inspector">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <Skeleton width={100} height={12} style={{ marginBottom: '6px' }} />
            <Skeleton width={180} height={20} />
          </div>
          <Skeleton width={80} height={22} borderRadius={12} />
        </div>
        <Skeleton lines={3} style={{ marginBottom: '20px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Skeleton height={42} borderRadius={6} />
          <Skeleton height={42} borderRadius={6} />
          <Skeleton height={60} borderRadius={6} />
        </div>
      </div>
    </div>
  )
}

export function OutputsSkeleton() {
  return (
    <div className="skeleton-outputs-grid">
      <div className="skeleton-output-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <Skeleton width="40%" height={18} />
          <Skeleton width={70} height={22} borderRadius={12} />
        </div>
        <Skeleton lines={5} style={{ marginBottom: '14px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={90} height={30} borderRadius={6} />
          <Skeleton width={70} height={30} borderRadius={6} />
        </div>
      </div>
      <div className="skeleton-output-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <Skeleton width="45%" height={18} />
          <Skeleton width={70} height={22} borderRadius={12} />
        </div>
        <Skeleton lines={4} style={{ marginBottom: '14px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={90} height={30} borderRadius={6} />
          <Skeleton width={70} height={30} borderRadius={6} />
        </div>
      </div>
    </div>
  )
}
