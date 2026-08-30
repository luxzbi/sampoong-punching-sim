import React, { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Params } from '../model/types';
import { PRESETS } from '../model/presets';
import { runOvat } from '../model/ovat';
import { RISK_INFO, riskOf } from '../model/punching';
import { Segmented } from './ui';
import { exportNodeAsPng, stamp } from '../lib/exportPng';

interface Props {
  current: Params;
}

export default function OvatTab({ current }: Props) {
  const [baseKey, setBaseKey] = useState<'A' | 'now'>('A');
  const boxRef = useRef<HTMLDivElement>(null);

  const baseParams = baseKey === 'A' ? PRESETS.A.params : current;
  const rows = useMemo(() => runOvat(baseParams), [baseParams]);

  const data = rows.map((r) => ({
    name: r.label,
    dcr: Number(r.dcr.toFixed(3)),
    color: RISK_INFO[riskOf(r.dcr)].color
  }));

  return (
    <div className="page">
      <div className="page-inner" ref={boxRef}>
        <h2>탐구 모드 — One Variable at a Time</h2>
        <p>
          기준 모델을 고정해 두고 변수를 <b>한 번에 하나씩만</b> 바꾸어, 각 변수가 펀칭전단 D/C 에
          얼마나 영향을 주는지 비교합니다. 마지막 항목은 모든 개선안을 동시에 적용한 경우입니다.
          이 값들은 교육용 단순화 모델의 결과이며 실제 구조 안전진단을 대체하지 않습니다.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '14px 0 8px' }}>
          <div style={{ width: 320 }}>
            <Segmented
              label="기준 모델"
              value={baseKey}
              onChange={(v) => setBaseKey(v)}
              options={[
                { value: 'A', label: 'Scenario A (삼풍 단순화)' },
                { value: 'now', label: '현재 설정' }
              ]}
            />
          </div>
          <button
            className="btn primary"
            data-no-export="true"
            onClick={() => exportNodeAsPng(boxRef.current, `탐구모드_OVAT_${stamp()}`)}
          >
            Export Result as PNG
          </button>
        </div>

        <div style={{ height: 320, marginTop: 6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 20, left: 4, bottom: 62 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b38" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9aa7b6', fontSize: 10.5 }}
                stroke="#333c4d"
                interval={0}
                angle={-22}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tick={{ fill: '#9aa7b6', fontSize: 11 }}
                stroke="#333c4d"
                label={{ value: 'D/C', angle: -90, position: 'insideLeft', fill: '#6e7d8f', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#161b22',
                  border: '1px solid #333c4d',
                  borderRadius: 8,
                  fontSize: 12
                }}
                formatter={(v: any) => [`${v}`, 'D/C']}
              />
              <ReferenceLine y={1} stroke="#f85149" strokeDasharray="4 3" />
              <ReferenceLine y={0.7} stroke="#d29922" strokeDasharray="4 3" />
              <Bar dataKey="dcr" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={58}>
                <LabelList dataKey="dcr" position="top" fill="#e6edf3" fontSize={10.5} />
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <h3>실험 결과표</h3>
        <table className="data">
          <thead>
            <tr>
              <th>실험</th>
              <th style={{ textAlign: 'left' }}>바꾼 값</th>
              <th>D/C</th>
              <th>기준 대비</th>
              <th>D/C 설계</th>
              <th>D/C 사용</th>
              <th style={{ textAlign: 'left' }}>지배 단면</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === 'all' ? 'hl' : ''}>
                <td>{r.label}</td>
                <td style={{ textAlign: 'left', color: 'var(--text-faint)', fontFamily: 'var(--sans)' }}>
                  {r.change}
                </td>
                <td style={{ color: RISK_INFO[riskOf(r.dcr)].color, fontWeight: 700 }}>
                  {r.dcr.toFixed(2)}
                </td>
                <td
                  style={{
                    color:
                      r.deltaPercent < -0.5
                        ? 'var(--good)'
                        : r.deltaPercent > 0.5
                        ? 'var(--bad)'
                        : 'var(--text-faint)'
                  }}
                >
                  {r.id === 'base'
                    ? '—'
                    : `${r.deltaPercent >= 0 ? '+' : ''}${r.deltaPercent.toFixed(1)}%`}
                </td>
                <td style={{ color: 'var(--text-dim)' }}>{r.dcrDesign.toFixed(2)}</td>
                <td style={{ color: RISK_INFO[riskOf(r.dcrService)].color }}>
                  {r.dcrService.toFixed(2)}
                </td>
                <td style={{ textAlign: 'left', color: 'var(--text-faint)', fontFamily: 'var(--sans)' }}>
                  {r.governing}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="hint" style={{ marginTop: 6 }}>
          <b>D/C 설계</b>는 안전율이 포함된 계수하중(1.2D+1.6L, φ=0.75) 기준, <b>D/C 사용</b>은 사용하중
          (1.0D+1.0L, φ=1.0) 기준입니다. 그래프와 “기준 대비” 열은 현재 선택된 하중 조합을 따릅니다.
          특히 “하중만 원설계 수준으로” 행의 사용하중 값과 기준 행의 사용하중 값을 비교해 보면, 같은
          구조라도 용도 변경과 추가 하중이 어떤 차이를 만드는지 볼 수 있습니다.
        </div>

        <h3>각 변화가 왜 영향을 주는가</h3>
        <div className="grid2">
          {rows
            .filter((r) => r.id !== 'base')
            .map((r) => (
              <div key={r.id} className="explain-card" style={{ borderLeftColor: RISK_INFO[riskOf(r.dcr)].color }}>
                <div className="t">
                  <span>{r.label}</span>
                  <span className="d" style={{ color: RISK_INFO[riskOf(r.dcr)].color }}>
                    D/C {r.dcr.toFixed(2)}
                  </span>
                </div>
                <div className="b">{r.reason}</div>
              </div>
            ))}
        </div>

        <div className="footnote">
          같은 크기의 변화라도 D/C 에 미치는 영향은 변수마다 다릅니다. 특히 <b>저항을 키우는 변화</b>(기둥
          직경, 유효깊이, 콘크리트 강도, 전단보강)와 <b>요구를 줄이는 변화</b>(고정하중, 국부 추가하중,
          용도 복원)를 구분해서 읽어 보세요. 개별 변수 하나만으로 위험도가 충분히 내려가지 않는 경우가
          많다는 점도 이 실험에서 확인할 수 있습니다. 다시 강조하면, 이 결과는 교육용 비교값이며 특정
          설계안의 안전을 보장하지 않습니다.
        </div>
      </div>
    </div>
  );
}
