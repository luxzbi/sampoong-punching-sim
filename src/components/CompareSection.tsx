import React, { useMemo, useState } from 'react';
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
import { PRESETS, PRESET_ORDER } from '../model/presets';
import { analyze, RISK_INFO, riskOf } from '../model/punching';
import { num } from './ui';

interface Props {
  params: Params;
  /** 현재 화면에서 선택한 해석 옵션을 프리셋에도 동일하게 적용할지 */
  syncOptions: boolean;
}

export default function CompareSection({ params, syncOptions }: Props) {
  const [shown, setShown] = useState(false);

  const rows = useMemo(() => {
    const opt = syncOptions
      ? {
          code: params.code,
          loadMode: params.loadMode,
          sizeEffect: params.sizeEffect,
          momentFactor: params.momentFactor,
          spanX: params.spanX,
          spanY: params.spanY,
          floorsAbove: params.floorsAbove
        }
      : {};

    const list = PRESET_ORDER.map((k) => {
      const p = { ...PRESETS[k].params, ...opt } as Params;
      const r = analyze(p);
      return { key: k, name: PRESETS[k].short, color: PRESETS[k].color, p, r };
    });
    const cur = analyze(params);
    list.push({ key: 'now' as any, name: '현재 설정', color: '#58a6ff', p: params, r: cur });
    return list;
  }, [params, syncOptions]);

  const ref = rows.find((r) => r.key === 'B')!.r.dcr;

  const chartData = rows.map((r) => ({
    name: r.name,
    dcr: Number(r.r.dcr.toFixed(3)),
    color: RISK_INFO[riskOf(r.r.dcr)].color
  }));

  return (
    <div>
      <div className="section-title">
        <h3>시나리오 비교</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="legend-row">
            <span>
              <i style={{ background: 'var(--good)' }} />
              0.0–0.7 상대적으로 낮음
            </span>
            <span>
              <i style={{ background: 'var(--warn)' }} />
              0.7–1.0 주의
            </span>
            <span>
              <i style={{ background: 'var(--bad)' }} />
              1.0 이상 파괴 위험
            </span>
          </div>
          <button className="btn primary sm" onClick={() => setShown((s) => !s)}>
            {shown ? '그래프 접기' : 'Compare — 막대그래프 생성'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 460px', minWidth: 380 }}>
          <table className="data">
            <thead>
              <tr>
                <th>항목</th>
                {rows.map((r) => (
                  <th key={r.key} style={{ color: r.color }}>
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>기둥 직경 (mm)</td>
                {rows.map((r) => (
                  <td key={r.key}>{r.p.columnDiameter}</td>
                ))}
              </tr>
              <tr>
                <td>기둥부 유효깊이 d₁ (mm)</td>
                {rows.map((r) => (
                  <td key={r.key}>{r.p.effectiveDepth}</td>
                ))}
              </tr>
              <tr>
                <td>콘크리트 강도 (MPa)</td>
                {rows.map((r) => (
                  <td key={r.key}>{r.p.fck}</td>
                ))}
              </tr>
              <tr>
                <td>드롭패널 (mm)</td>
                {rows.map((r) => (
                  <td key={r.key}>
                    {r.p.dropPanel ? `${r.p.dropPanelSize}×${r.p.dropPanelThickness}` : '없음'}
                  </td>
                ))}
              </tr>
              <tr>
                <td>전단보강</td>
                {rows.map((r) => (
                  <td key={r.key}>{r.p.shearReinf ? `있음 (${r.p.shearReinfRatio.toFixed(2)})` : '없음'}</td>
                ))}
              </tr>
              <tr>
                <td>적용 하중 w (kPa)</td>
                {rows.map((r) => (
                  <td key={r.key}>{num(r.r.load.w, 2)}</td>
                ))}
              </tr>
              <tr>
                <td>전단력 V (kN)</td>
                {rows.map((r) => (
                  <td key={r.key}>{num(r.r.governing.shearForce, 0)}</td>
                ))}
              </tr>
              <tr className="hl">
                <td>펀칭전단 D/C</td>
                {rows.map((r) => (
                  <td key={r.key} style={{ color: RISK_INFO[riskOf(r.r.dcr)].color, fontWeight: 700 }}>
                    {r.r.dcr.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>상대 위험도 (구조계산 조건 = 1.00)</td>
                {rows.map((r) => (
                  <td key={r.key}>{(r.r.dcr / ref).toFixed(2)}</td>
                ))}
              </tr>
              <tr>
                <td>기둥 축력 요구/저항</td>
                {rows.map((r) => (
                  <td key={r.key}>{r.r.columnAxial.ratio.toFixed(2)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {shown && (
          <div style={{ flex: '1 1 420px', minWidth: 340, height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 18, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232b38" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#9aa7b6', fontSize: 11 }} stroke="#333c4d" />
                <YAxis
                  tick={{ fill: '#9aa7b6', fontSize: 11 }}
                  stroke="#333c4d"
                  label={{
                    value: 'D/C',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#6e7d8f',
                    fontSize: 11
                  }}
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
                <Bar dataKey="dcr" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={64}>
                  <LabelList dataKey="dcr" position="top" fill="#e6edf3" fontSize={11} />
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="footnote">
        세 프리셋의 경간·하중 가정은 동일하게 두고, 조사자료에서 확인된 단면·재료 조건과 용도에 따른
        하중만 다르게 적용했습니다. 값 자체보다 <b>상대적인 차이</b>를 읽는 것이 이 모형의 목적입니다.
        이 결과는 교육용 단순화 모델이며 실제 구조 안전진단을 대체하지 않습니다.
      </div>
    </div>
  );
}
