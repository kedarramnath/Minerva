// src/components/charts/BurnRateChart.jsx
// Ledger + Deterministic Projection + Waterline Chart
//
// SOLID GREEN LINE    — Historical running balance
// DOTTED BLUE LINE    — 30-day deterministic projection (below waterline)
// DOTTED TEAL LINE    — 30-day projection (above waterline)
// DASHED RED LINE     — Waterline (baselineLiquidity threshold)
// ◆ marker at today   — bridge between actual and projected

import { useMemo }         from 'react'
import { useMinervaStore } from '../../state/store.js'
import { fmt }             from '../../utils/currency.js'
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid, Area
} from 'recharts'

const SAGE  = '#4A8C6F'
const TEAL  = '#2A7D8C'
const BLUE  = '#4A7FA5'
const ROSE  = '#A05252'
const NAVY  = '#0A2342'

function CustomTooltip({ active, payload, label, activeCurrency, selectInDisplay, baselineLiquidity }) {
  if (!active || !payload?.length) return null
  const relevant = payload.filter(p => p.value != null && p.dataKey !== 'waterline')
  if (!relevant.length) return null

  const val = relevant[0]?.value
  const isAbove = baselineLiquidity > 0 && val >= baselineLiquidity

  return (
    <div style={{
      background: NAVY, border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10, padding: '8px 12px', minWidth: 140,
    }}>
      <p style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
        {label}
      </p>
      {relevant.map((p, i) => (
        <p key={i} style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: p.color, margin: 0 }}>
          {p.name}: {fmt(selectInDisplay(p.value), activeCurrency, { compact: true })}
        </p>
      ))}
      {baselineLiquidity > 0 && val != null && (
        <p style={{ fontFamily: 'monospace', fontSize: 9, color: isAbove ? '#4A8C6F' : '#A05252', marginTop: 4 }}>
          {isAbove ? '▲ above waterline' : '▼ below waterline'}
        </p>
      )}
    </div>
  )
}

export function BurnRateChart() {
  const selectLedgerSeries            = useMinervaStore(s => s.selectLedgerSeries)
  const selectDeterministicProjection = useMinervaStore(s => s.selectDeterministicProjection)
  const selectCapitalAllocation       = useMinervaStore(s => s.selectCapitalAllocation)
  const activeCurrency                = useMinervaStore(s => s.activeCurrency)
  const selectInDisplay               = useMinervaStore(s => s.selectInDisplayCurrency)
  // Subscribe for re-renders
  const transactions                  = useMinervaStore(s => s.transactions)
  const plannedSpends                 = useMinervaStore(s => s.plannedSpends)
  const surplusConfig                 = useMinervaStore(s => s.surplusConfig)

  const ledger      = selectLedgerSeries()
  const projection  = selectDeterministicProjection()
  const capital     = selectCapitalAllocation()

  const { baselineLiquidity, enrichedSeries } = capital
  const waterlineDisplay = selectInDisplay(baselineLiquidity)

  const chartData = useMemo(() => {
    const points = []
    const today  = new Date().toISOString().slice(0, 10)

    // Historical ledger
    ledger.forEach(({ date, balance }) => {
      const d = new Date(date)
      const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      const isAbove = baselineLiquidity > 0 && balance >= baselineLiquidity
      points.push({
        label,
        date,
        ledger:        Math.round(balance),
        aboveWaterline: null,
        belowWaterline: null,
        waterline:     baselineLiquidity > 0 ? Math.round(baselineLiquidity) : null,
        isToday:       false,
      })
    })

    // Bridge point at today
    const currentBal = Math.round(projection.currentBalance)
    const todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    const lastPoint  = points[points.length - 1]

    const todayPoint = {
      label:          todayLabel + ' ◆',
      date:           today,
      ledger:         currentBal,
      aboveWaterline: baselineLiquidity > 0 && currentBal >= baselineLiquidity ? currentBal : null,
      belowWaterline: baselineLiquidity > 0 && currentBal <  baselineLiquidity ? currentBal : null,
      waterline:      baselineLiquidity > 0 ? Math.round(baselineLiquidity) : null,
      isToday:        true,
    }

    if (!lastPoint || lastPoint.date !== today) {
      points.push(todayPoint)
    } else {
      Object.assign(lastPoint, todayPoint)
    }

    // Projection — use enrichedSeries from selectCapitalAllocation
    enrichedSeries.forEach(({ day, date, label, balance, aboveWaterline, belowWaterline }) => {
      if (date === today) return
      const d = new Date(date)
      const lbl = label || d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      points.push({
        label:          lbl,
        date,
        ledger:         null,
        aboveWaterline: aboveWaterline != null ? Math.round(aboveWaterline) : null,
        belowWaterline: belowWaterline != null ? Math.round(belowWaterline) : null,
        waterline:      baselineLiquidity > 0 ? Math.round(baselineLiquidity) : null,
        isToday:        false,
      })
    })

    return points
  }, [ledger, projection, enrichedSeries, baselineLiquidity])

  const hasData    = ledger.length > 0 || projection.dailySeries.length > 0
  const todayLabel = chartData.find(p => p.isToday)?.label ?? ''

  return (
    <div className="px-5 mt-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] font-mono text-muted uppercase tracking-widest">
          Running Balance · 30-Day View
        </p>
        {baselineLiquidity > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-px border-t border-dashed border-rose/60" />
            <span className="text-[9px] font-mono text-rose/70">
              Waterline {fmt(waterlineDisplay, activeCurrency, { compact: true })}
            </span>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-border px-1 pt-4 pb-2 overflow-hidden">
        {hasData ? (
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 0" stroke="#F0F2F5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#6B7A8D' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={['auto', 'auto']} />

              {/* Waterline — dashed rose reference */}
              {baselineLiquidity > 0 && (
                <ReferenceLine
                  y={Math.round(baselineLiquidity)}
                  stroke={ROSE}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.6}
                  label={{
                    value: 'Waterline',
                    position: 'insideTopRight',
                    fontSize: 8,
                    fill: ROSE,
                    fillOpacity: 0.7,
                    fontFamily: 'monospace',
                  }}
                />
              )}

              {/* Today marker */}
              {todayLabel && (
                <ReferenceLine
                  x={todayLabel}
                  stroke="#CBD5E1"
                  strokeWidth={1}
                  label={{
                    value: 'Today',
                    position: 'insideTopLeft',
                    fontSize: 8,
                    fill: '#6B7A8D',
                    fontFamily: 'monospace',
                  }}
                />
              )}

              <Tooltip
                content={
                  <CustomTooltip
                    activeCurrency={activeCurrency}
                    selectInDisplay={selectInDisplay}
                    baselineLiquidity={baselineLiquidity}
                  />
                }
                cursor={{ stroke: NAVY, strokeWidth: 1, strokeDasharray: '3 3' }}
              />

              {/* Historical ledger — solid sage */}
              <Line
                type="monotone"
                dataKey="ledger"
                name="Actual"
                stroke={SAGE}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: SAGE, stroke: '#fff', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Projection — below waterline (rose/blue) */}
              <Line
                type="monotone"
                dataKey="belowWaterline"
                name="Projected"
                stroke={BLUE}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3, fill: BLUE, stroke: '#fff', strokeWidth: 2 }}
                connectNulls={true}
              />

              {/* Projection — above waterline (teal) */}
              <Line
                type="monotone"
                dataKey="aboveWaterline"
                name="Projected ▲"
                stroke={TEAL}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3, fill: TEAL, stroke: '#fff', strokeWidth: 2 }}
                connectNulls={true}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[190px] flex flex-col items-center justify-center gap-1">
            <p className="text-xs text-muted font-mono">No data yet</p>
            <p className="text-[10px] font-mono text-muted/60">Set opening balance to begin</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-3 pb-1 pt-1.5 border-t border-border/50 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-[2.5px] rounded-full" style={{ background: SAGE }} />
            <span className="text-[9px] font-mono text-muted">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-[1.5px]" style={{ background: `repeating-linear-gradient(90deg,${BLUE} 0,${BLUE} 5px,transparent 5px,transparent 9px)` }} />
            <span className="text-[9px] font-mono text-muted">Below waterline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-[1.5px]" style={{ background: `repeating-linear-gradient(90deg,${TEAL} 0,${TEAL} 5px,transparent 5px,transparent 9px)` }} />
            <span className="text-[9px] font-mono text-muted">Above waterline</span>
          </div>
          {baselineLiquidity > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-[1px]" style={{ background: `repeating-linear-gradient(90deg,${ROSE} 0,${ROSE} 4px,transparent 4px,transparent 7px)` }} />
              <span className="text-[9px] font-mono text-muted">Waterline</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
