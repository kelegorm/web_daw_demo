import React, { useRef, useEffect, useState } from 'react'
import { getPixelsPerSecond, barDurationSeconds, beatDurationSeconds } from '../utils/timelineScale'

interface Props {
  bpm: number
}

const RULER_HEIGHT = 24

export default function TimelineRuler({ bpm }: Props) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [timelineWidth, setTimelineWidth] = useState(600)

  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setTimelineWidth(entry.contentRect.width)
    })
    observer.observe(el)
    setTimelineWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const pps = getPixelsPerSecond(bpm)
  const barWidth = barDurationSeconds(bpm) * pps
  const beatWidth = beatDurationSeconds(bpm) * pps

  const numBars = Math.ceil(timelineWidth / barWidth) + 1

  const bars: React.ReactElement[] = []
  for (let b = 0; b < numBars; b++) {
    const barX = b * barWidth
    if (barX > timelineWidth + barWidth) break

    bars.push(
      <div
        key={`bar-${b}`}
        className="timeline-ruler-bar"
        data-bar={b + 1}
        style={{
          position: 'absolute',
          left: barX,
          top: 0,
          bottom: 0,
          width: barWidth,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1,
            height: '100%',
            background: 'var(--color-border, #444)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 3,
            fontSize: 10,
            color: 'var(--color-text-muted, #aaa)',
            userSelect: 'none',
            lineHeight: 1,
          }}
        >
          {b + 1}
        </span>

        {b < numBars - 1 && [1, 2, 3].map((beat) => {
          const beatX = beat * beatWidth
          if (beatX >= barWidth) return null
          return (
            <div
              key={`beat-${beat}`}
              className="timeline-ruler-beat"
              style={{
                position: 'absolute',
                left: beatX,
                top: '40%',
                width: 1,
                bottom: 0,
                background: 'var(--color-border, #444)',
                opacity: 0.6,
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="timeline-ruler"
      style={{
        display: 'flex',
        flexShrink: 0,
        height: RULER_HEIGHT,
        borderBottom: '1px solid var(--color-border, #444)',
        background: 'var(--color-track-content-bg, var(--color-bg))',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="timeline-ruler-header-placeholder"
        style={{
          width: 'var(--track-header-width)',
          flexShrink: 0,
          background: 'var(--color-track-header-bg, var(--color-surface))',
          borderRight: '1px solid var(--color-track-divider, var(--color-border, #444))',
          boxSizing: 'border-box',
        }}
      />
      <div
        ref={timelineRef}
        className="timeline-ruler-area"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--color-track-content-bg, var(--color-bg))',
          boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.03)',
        }}
      >
        {bars}
      </div>
    </div>
  )
}
