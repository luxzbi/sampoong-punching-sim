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
import { RISK_INFO, riskOf } from '../model/punching';
import { factorial, improvementPath, Mode, thresholdTable } from '../model/solver';
import { Segmented, num } from './ui';
import { exportNodeAsPng, stamp } from '../lib/exportPng';

interface Props {
  current: Params;
}

const modeLabel: Record<Mode, string> = {
  service: '사용하중 (1.0D + 1.0L, φ=1.0)',
  design: '설계 검토 (1.2D + 1.6L, φ=0.75)'
};

export default function SolverTab({ current }: Props) {
  const [baseKey, setBaseKey] = useState<'A' | 'now'>('A');
  const [mode, setMode] = useState<Mode>('service');
  const [target, setTarget] = useState<'1.0' | '0.7'>('1.0');
  const boxRef = useRef<HTMLDivElement>(null);

  const base = baseKey === 'A' ? PRESETS.A.params : current;
  const cells = useMemo(() => factorial(base), [base]);
  const path = useMemo(() => improvementPath(base), [base]);
  const thresholds = useMemo(
    () => thresholdTable(base, parseFloat(target), mode),
    [base, target, mode]
  );

  const pick = (id: string) => cells.find((c) => c.id === id)!;
  const dcrOfCell = (id: string) => (mode === 'service' ? pick(id).dcrService : pick(id).dcrDesign);

  const chartData = path.map((r) => ({
    name: r.label,
    dcr: Number((mode === 'service' ? r.dcrService : r.dcrDesign).toFixed(3)),
    color: RISK_INFO[riskOf(mode === 'service' ? r.dcrService : r.dcrDesign)].color
  }));

  const crossing = path.findIndex(
    (r) => (mode === 'service' ? r.dcrService : r.dcrDesign) < 1.0
  );

  // ---- 결론 정리에 쓰는 파생값 (모두 위 실험 결과에서 계산) ----
  const over1 = cells.filter((c) => (mode === 'service' ? c.dcrService : c.dcrDesign) >= 1.0).length;
  const best = Math.min(...cells.map((c) => (mode === 'service' ? c.dcrService : c.dcrDesign)));
  const bestDesign = Math.min(...cells.map((c) => c.dcrDesign));
  const achievable = thresholds.filter((t) => t.achievable);
  const unachievable = thresholds.filter((t) => !t.achievable);

  return (
    <div className="page">
      <div className="page-inner wide" ref={boxRef}>
        <h2>붕괴 회피 실험 — 무엇이 달랐다면 D/C 가 1.0 아래였을까</h2>
        <p>
          이 탭은 계산만 다룹니다. 3D 탭의 붕괴 애니메이션은 개념 시각화이고, 여기 숫자는 모두
          시뮬레이션 탭과 <b>같은 펀칭전단 식</b>(ACI 318-19 22.6)으로 계산한 값입니다. 두 가지를
          섞어서 읽지 마세요. 그리고 이 값들은 <b>교육용 단순화 모델</b>의 출력이며, 실제 삼풍백화점의
          붕괴 여부를 판정하거나 재현한 것이 아닙니다.
        </p>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', margin: '16px 0 6px' }}>
          <div style={{ width: 300 }}>
            <Segmented
              label="기준 모델"
              value={baseKey}
              onChange={(v) => setBaseKey(v)}
              options={[
                { value: 'A', label: 'Scenario A' },
                { value: 'now', label: '현재 설정' }
              ]}
            />
          </div>
          <div style={{ width: 330 }}>
            <Segmented
              label="하중 조합"
              value={mode}
              onChange={(v) => setMode(v)}
              options={[
                { value: 'service', label: '사용하중 φ=1.0' },
                { value: 'design', label: '설계 φ=0.75' }
              ]}
            />
          </div>
          <div style={{ width: 210 }}>
            <Segmented
              label="목표 D/C"
              value={target}
              onChange={(v) => setTarget(v)}
              options={[
                { value: '1.0', label: '≤ 1.00' },
                { value: '0.7', label: '≤ 0.70' }
              ]}
            />
          </div>
          <button
            className="btn primary"
            data-no-export="true"
            style={{ marginBottom: 11 }}
            onClick={() => exportNodeAsPng(boxRef.current, `붕괴회피실험_${stamp()}`)}
          >
            Export Result as PNG
          </button>
        </div>
        <div className="hint" style={{ marginTop: -2 }}>
          현재 표시 기준 : <b>{modeLabel[mode]}</b> — 건물이 실제로 서 있었는지를 따질 때는 사용하중,
          설계가 기준을 만족했는지를 볼 때는 설계 검토 값을 봅니다.
        </div>

        {/* ---------------- 1) 2x2 요인 실험 ---------------- */}

        <h3>실험 1 — 구조 때문인가, 사용 때문인가 (2×2 요인 실험)</h3>
        <p style={{ marginTop: 0 }}>
          시공 조건(어떻게 지었는가)과 하중 조건(어떻게 썼는가)을 각각 <b>실제 / 원래 계획</b> 두 가지로
          두고 네 가지 조합을 계산합니다. 두 원인을 분리해서 볼 수 있습니다.
        </p>

        <div className="matrix">
          <div className="mx-cell mx-corner">
            <span className="c1">하중 조건 →</span>
            <span className="c2">↓ 시공 조건</span>
          </div>
          <div className="mx-cell mx-head">
            <b>하중 : 실제 사용</b>
            <span>식당가 용도 (고정하중 4.5 kPa) + 국부 추가하중 3.0 kPa</span>
          </div>
          <div className="mx-cell mx-head">
            <b>하중 : 원설계</b>
            <span>판매장 용도 (고정하중 1.5 kPa), 추가하중 없음</span>
          </div>

          <div className="mx-cell mx-head side">
            <b>시공 : 실제</b>
            <span>무량판 · D 600 mm · f′c 18.4 MPa · d 360 mm · 8-HD22</span>
          </div>
          {['aa', 'ab'].map((id) => (
            <MatrixCell key={id} dcr={dcrOfCell(id)} cell={pick(id)} mode={mode} highlight={id === 'aa'} />
          ))}

          <div className="mx-cell mx-head side">
            <b>시공 : 구조계산서</b>
            <span>무량판 · D 800 mm · f′c 21 MPa · d 410 mm · 16-HD22</span>
          </div>
          {['ba', 'bb'].map((id) => (
            <MatrixCell key={id} dcr={dcrOfCell(id)} cell={pick(id)} mode={mode} />
          ))}
        </div>

        <div className="finding">
          <b>이 모형에서 읽히는 것</b>
          <div>
            {mode === 'service' ? (
              <>
                네 칸 중 D/C 가 1.0 을 넘는 것은 <b>실제 시공 × 실제 사용</b> 조합
                ({dcrOfCell('aa').toFixed(2)}) 하나뿐입니다. 시공을 구조계산서대로 했거나
                ({dcrOfCell('ba').toFixed(2)}), 하중을 원설계대로 유지했더라면
                ({dcrOfCell('ab').toFixed(2)}) 이 모형 안에서는 1.0 아래였습니다. 즉 이 단순화 모형은
                <b> 어느 한쪽만의 문제가 아니라 두 가지가 겹쳤을 때 한계를 넘는 구조</b>였다고 말합니다.
              </>
            ) : (
              <>
                계수하중 기준에서는 네 칸 중 D/C 가 1.0 아래인 것이 없습니다
                (가장 낮은 값 {Math.min(...cells.map((c) => c.dcrDesign)).toFixed(2)}). 즉 이 경간·하중
                가정에서는 <b>구조계산서 조건조차 현행 ACI 기준의 펀칭전단 검토를 만족하지 못합니다.</b>
                전단보강 없이 큰 경간의 플랫슬래브를 쓰는 것 자체가 불리하다는 뜻입니다.
              </>
            )}
          </div>
          <div style={{ marginTop: 6, color: 'var(--text-faint)' }}>
            주의 : 이것은 접합부 하나에 대한 계산입니다. 실제 붕괴는 여러 부재의 상호작용과 점검·대피
            판단 같은 관리의 문제가 함께 얽힌 사건이며, 이 표로 원인을 확정할 수 없습니다.
          </div>
        </div>

        {/* ---------------- 2) 누적 개선 경로 ---------------- */}

        <h3>실험 2 — 하나씩 되돌리면 언제 1.0 아래로 내려가는가</h3>
        <p style={{ marginTop: 0 }}>
          실제 조건에서 출발해 조사에서 지적된 항목을 순서대로 되돌립니다. 하중 쪽을 먼저 되돌려,
          구조를 전혀 바꾸지 않아도 어디까지 내려가는지 확인합니다.
        </p>

        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 22, right: 20, left: 4, bottom: 66 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b38" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9aa7b6', fontSize: 10.5 }}
                stroke="#333c4d"
                interval={0}
                angle={-20}
                textAnchor="end"
                height={74}
              />
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
              <Bar dataKey="dcr" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={60}>
                <LabelList dataKey="dcr" position="top" fill="#e6edf3" fontSize={10.5} />
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <table className="data">
          <thead>
            <tr>
              <th>단계</th>
              <th style={{ textAlign: 'left' }}>종류</th>
              <th style={{ textAlign: 'left' }}>내용</th>
              <th>Vu (kN)</th>
              <th>φVn (kN)</th>
              <th>D/C 사용</th>
              <th>D/C 설계</th>
            </tr>
          </thead>
          <tbody>
            {path.map((r, i) => {
              const d = mode === 'service' ? r.dcrService : r.dcrDesign;
              return (
                <tr key={r.id} className={i === crossing ? 'hl' : ''}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: 'left', fontFamily: 'var(--sans)' }}>
                    <span className="badge">{r.kind}</span>
                  </td>
                  <td
                    style={{ textAlign: 'left', color: 'var(--text-faint)', fontFamily: 'var(--sans)' }}
                  >
                    {r.detail}
                  </td>
                  <td>{num(r.vuService, 0)}</td>
                  <td>{num(r.vcService, 0)}</td>
                  <td style={{ color: RISK_INFO[riskOf(r.dcrService)].color, fontWeight: 700 }}>
                    {r.dcrService.toFixed(2)}
                  </td>
                  <td style={{ color: 'var(--text-dim)' }}>{r.dcrDesign.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="hint">
          Vu, φVn 은 <b>사용하중 기준</b>으로 표시했습니다.
          {crossing > 0 && (
            <>
              {' '}
              현재 기준({mode === 'service' ? '사용하중' : '계수하중'})에서는{' '}
              <b>{path[crossing].label}</b> 단계에서 처음으로 D/C 가 1.0 아래로 내려갑니다.
            </>
          )}
        </div>

        {/* ---------------- 3) 임계값 탐색 ---------------- */}

        <h3>실험 3 — 변수 하나만으로 목표 D/C ≤ {target} 를 만들려면</h3>
        <p style={{ marginTop: 0 }}>
          다른 조건은 실제 조건 그대로 두고 변수 하나만 움직여, 목표 D/C 에 도달하는 최소 값을
          이분법으로 찾습니다. 슬라이더 범위 안에서 도달할 수 없으면 그렇게 표시합니다.
        </p>

        <table className="data">
          <thead>
            <tr>
              <th>변수</th>
              <th style={{ textAlign: 'left' }}>작용</th>
              <th>현재</th>
              <th>필요한 값</th>
              <th>변화</th>
              <th style={{ textAlign: 'left' }}>구조적 이유</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => (
              <tr key={t.knob.id}>
                <td>{t.knob.label}</td>
                <td style={{ textAlign: 'left', fontFamily: 'var(--sans)' }}>
                  <span
                    className="badge"
                    style={{
                      color:
                        t.knob.side === 'capacity'
                          ? 'var(--good)'
                          : t.knob.side === 'demand'
                          ? 'var(--accent)'
                          : 'var(--text-dim)'
                    }}
                  >
                    {t.knob.side === 'capacity'
                      ? 'φVn ↑'
                      : t.knob.side === 'demand'
                      ? 'Vu ↓'
                      : 'Vu·φVn 동시'}
                  </span>
                </td>
                <td>{num(t.current, t.knob.unit === '(0~1)' ? 2 : 1)}</td>
                <td style={{ color: t.achievable ? 'var(--text)' : 'var(--bad)' }}>
                  {t.achievable
                    ? `${num(t.required!, t.knob.unit === '(0~1)' ? 2 : 1)} ${t.knob.unit}`
                    : '범위 내 불가능'}
                </td>
                <td style={{ color: 'var(--text-dim)' }}>
                  {t.achievable
                    ? `${t.required! > t.current ? '+' : ''}${num(
                        t.required! - t.current,
                        t.knob.unit === '(0~1)' ? 2 : 1
                      )}`
                    : `한계값에서 D/C ${t.dcrAtBound.toFixed(2)}`}
                </td>
                <td
                  style={{ textAlign: 'left', color: 'var(--text-faint)', fontFamily: 'var(--sans)' }}
                >
                  {t.knob.why}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hint">
          <b>φVn ↑</b> 는 저항을 키우는 변수, <b>Vu ↓</b> 는 요구를 줄이는 변수입니다. 같은 목표에
          도달하는 방법이 여러 가지이고, 각 방법이 요구하는 변화량이 크게 다르다는 점을 비교해 보세요.
          드롭패널 확대처럼 <b>지배 단면을 바꾸지 못하는 변수</b>는 아무리 키워도 목표에 도달하지 못할 수
          있습니다 (기둥 주변 단면이 계속 지배하기 때문).
        </div>

        {/* ---------------- 4) 사건과의 대조 ---------------- */}

        {/* ---------------- 4) 실험 결론 ---------------- */}

        <h3>실험 결론</h3>
        <p style={{ marginTop: 0 }}>
          위 세 실험에서 계산된 값만으로 정리한 것입니다. 모든 수치는 현재 선택한 기준
          <b> ({mode === 'service' ? '사용하중' : '계수하중'})</b> 에서 다시 계산되며, 값을 바꾸면 결론
          문장의 숫자도 함께 바뀝니다.
        </p>

        <div className="concl">
          <Conclusion
            n={1}
            title="두 원인이 겹쳤을 때만 한계를 넘었다"
            tone={over1 === 1 ? 'key' : 'plain'}
          >
            2×2 네 칸 중 D/C 가 1.0 을 넘는 칸은 <b>{over1}개</b>입니다
            {over1 === 1 && (
              <>
                {' '}
                — <b>실제 시공 × 실제 사용</b> 조합({dcrOfCell('aa').toFixed(2)}) 하나뿐입니다. 시공만
                구조계산서대로였다면 {dcrOfCell('ba').toFixed(2)}, 하중만 원설계대로였다면{' '}
                {dcrOfCell('ab').toFixed(2)} 로 모두 1.0 아래입니다.
              </>
            )}
            . 이 모형 안에서 읽으면, 설계 변경(구조 축소)과 용도 변경(하중 증가) 중{' '}
            <b>어느 한쪽만으로는 이 접합부가 한계를 넘지 않았고, 두 가지가 겹쳤을 때 넘었습니다.</b>
          </Conclusion>

          <Conclusion n={2} title="요구를 줄이는 것이 저항을 키우는 것만큼 효과적이었다">
            구조를 전혀 바꾸지 않고 <b>하중만</b> 원설계 수준으로 되돌리면{' '}
            {dcrOfCell('aa').toFixed(2)} → {dcrOfCell('ab').toFixed(2)} 로 내려갑니다. 반대로 하중은
            그대로 두고 <b>구조만</b> 구조계산서대로 되돌리면 {dcrOfCell('ba').toFixed(2)} 입니다. 두
            방향의 효과가 거의 같습니다. 펀칭전단에서 D/C = Vu / φVn 이므로,{' '}
            <b>분자(Vu)를 줄이는 것과 분모(φVn)를 키우는 것은 대등한 수단</b>입니다.
          </Conclusion>

          <Conclusion n={3} title="애초에 여유가 거의 없는 조건이었다">
            네 칸 중 가장 좋은 조건(둘 다 원래 계획대로)도 {mode === 'service' ? '사용하중' : '계수하중'}{' '}
            기준 <b>{best.toFixed(2)}</b> 입니다. 계수하중(1.2D+1.6L, φ=0.75) 기준으로 보면 네 칸 모두{' '}
            <b>1.0 을 넘습니다</b> (가장 낮은 값 {bestDesign.toFixed(2)}). 전단보강 없이 경간{' '}
            {(base.spanX / 1000).toFixed(1)} m 의 무량판을 쓰는 것 자체가 펀칭전단에 불리하다는 뜻입니다.
          </Conclusion>

          <Conclusion n={4} title="같은 목표에 도달하는 데 필요한 변화량은 변수마다 크게 다르다">
            변수 하나만 움직여 D/C ≤ {target} 를 만들 수 있는 것은{' '}
            <b>{achievable.length}개</b>, 슬라이더 범위 안에서는 불가능한 것이{' '}
            <b>{unachievable.length}개</b>입니다.
            {achievable.length > 0 && (
              <ul>
                {achievable.map((t) => (
                  <li key={t.knob.id}>
                    {t.knob.label} : {num(t.current, t.knob.unit === '(0~1)' ? 2 : 1)} →{' '}
                    <b>{num(t.required!, t.knob.unit === '(0~1)' ? 2 : 1)}</b> {t.knob.unit}
                  </li>
                ))}
              </ul>
            )}
            {unachievable.length > 0 && (
              <>
                반면 <b>{unachievable.map((t) => t.knob.label).join(', ')}</b> 는 한계값까지 가도 목표에
                닿지 못합니다. 특히 콘크리트 강도는 vc ∝ √f′c 라서 강도를 크게 올려도 저항 증가폭이
                완만하고, 유효깊이는 늘리면 슬래브 자중(=Vu)도 함께 늘기 때문에 순수 이득이 깎입니다.
              </>
            )}
          </Conclusion>

          <Conclusion n={5} title="펀칭전단은 예고 없이 진행되는 취성 파괴다">
            전단보강이 없으면 저항이 콘크리트의 인장강도에만 의존해, 균열이 생긴 뒤 버텨 주는 여력이
            거의 없습니다. 이 실험에서 전단보강 추가 한 가지만으로 D/C 가{' '}
            {path[0] && path[path.length - 1] ? (
              <b>
                {(mode === 'service'
                  ? path[path.length - 2].dcrService - path[path.length - 1].dcrService
                  : path[path.length - 2].dcrDesign - path[path.length - 1].dcrDesign
                ).toFixed(2)}
              </b>
            ) : (
              '—'
            )}{' '}
            만큼 더 내려간 것도 그 때문입니다. 이것은 <b>숫자로 표현되지 않는 위험</b>이기도 합니다.
            같은 D/C 라도, 파괴가 서서히 오는 구조와 갑자기 오는 구조는 대피할 시간이 다릅니다.
          </Conclusion>

          <Conclusion n={6} title="이 결론이 말할 수 없는 것" tone="warn">
            위 다섯 가지는 모두 <b>접합부 하나</b>에 대한, <b>경간·하중이 가정값</b>인 단순화 모형의
            결과입니다. 실제 삼풍백화점이 그 조건에서 무너지지 않았을 것이라고 말할 수 없습니다.
            연쇄붕괴는 계산하지 않았고, 기둥 제거·균열 징후 확인 후의 판단 같은 관리·제도의 문제는
            애초에 구조 계산으로 표현되지 않습니다. 이 실험의 쓸모는 <b>절대값이 아니라 방향과 크기의
            비교</b>에 있습니다.
          </Conclusion>
        </div>

        <h3>실제 사건과 대조해 읽기</h3>
        <div className="grid2">
          <div className="doc">
            <h4>이 모형의 계산이 말하는 것</h4>
            <ul>
              <li>
                이 접합부에서 D/C 가 1.0 을 넘는 것은 <b>구조 축소와 하중 증가가 겹쳤을 때</b>뿐입니다.
              </li>
              <li>
                하중 쪽만 원설계대로였어도 D/C 는 {pick('ab').dcrService.toFixed(2)} 로, 구조를 전혀
                건드리지 않고도 1.0 아래가 됩니다. <b>요구를 줄이는 것</b>이 저항을 키우는 것만큼,
                때로는 더 효과적입니다.
              </li>
              <li>
                기둥 직경을 키우는 것이 효과가 큰 이유는 압축 단면적이 아니라{' '}
                <b>임계둘레 b₀ = π(D + d) 가 길어지기 때문</b>입니다.
              </li>
              <li>
                콘크리트 강도는 √f′c 로만 반영되어, 강도를 크게 올려도 저항 증가폭은 완만합니다.
              </li>
              <li>
                펀칭전단은 <b>예고 없이 급격히 진행되는 취성 파괴</b>라서, 전단보강이 없으면 균열이
                생긴 뒤 버텨 주는 여력이 거의 없습니다.
              </li>
            </ul>
          </div>
          <div className="doc">
            <h4>이 모형이 말할 수 없는 것</h4>
            <ul>
              <li>
                실제 삼풍백화점의 붕괴 원인을 이 계산으로 <b>확정할 수 없습니다.</b> 경간과 하중 값이
                가정값이고, 접합부 하나만 보기 때문입니다.
              </li>
              <li>
                널리 알려진 서술로는 5층 용도 변경, 옥상 냉각탑의 이동, 기둥 단면·철근 축소, 에스컬레이터
                설치를 위한 기둥 제거, 붕괴 당일 나타난 균열 등이 함께 지적됩니다. 이 모형은 그중{' '}
                <b>단면·재료·하중 세 가지만</b> 다룹니다.
              </li>
              <li>
                <b>기둥 제거</b>로 경간이 늘어나는 상황은 이 모형에서 경간 슬라이더로만 거칠게 흉내 낼 수
                있습니다. 실제 재분배는 계산하지 않습니다.
              </li>
              <li>
                균열을 확인하고도 영업을 계속한 <b>관리·제도의 문제</b>는 구조 계산으로 표현되지 않습니다.
                탐구 보고서에는 이 부분을 반드시 함께 서술하는 것이 좋습니다.
              </li>
              <li>
                연쇄붕괴(progressive collapse)는 <b>동적 해석을 하지 않았습니다.</b> 3D 탭의 애니메이션은
                하중 재분배 개념을 보여 주는 시각화이며, 이 탭의 숫자와는 별개입니다.
              </li>
            </ul>
          </div>
        </div>

        <div className="footnote">
          모든 식과 계수의 출처, 단위, 가정, 확신할 수 없어 TODO 로 남긴 항목은{' '}
          <code>source-notes.md</code> 와 <code>methodology.md</code> 에 기록되어 있습니다. 이 탭의
          결과는 교육용 단순화 모델의 비교값이며, 어떤 설계안의 안전도 보장하지 않습니다.
        </div>
      </div>
    </div>
  );
}

function Conclusion({
  n,
  title,
  tone = 'plain',
  children
}: {
  n: number;
  title: string;
  tone?: 'plain' | 'key' | 'warn';
  children: React.ReactNode;
}) {
  return (
    <div className={`concl-item ${tone}`}>
      <div className="concl-head">
        <span className="concl-n">{n}</span>
        <span className="concl-t">{title}</span>
      </div>
      <div className="concl-b">{children}</div>
    </div>
  );
}

/** D/C 를 0 ~ 1.6 눈금 위에 표시하고 1.0 위치에 기준선을 둔다 */
function MatrixCell({
  dcr,
  cell,
  mode,
  highlight
}: {
  dcr: number;
  cell: {
    label: string;
    vuService: number;
    vcService: number;
    vuDesign: number;
    vcDesign: number;
  };
  mode: Mode;
  highlight?: boolean;
}) {
  const info = RISK_INFO[riskOf(dcr)];
  const vu = mode === 'service' ? cell.vuService : cell.vuDesign;
  const vc = mode === 'service' ? cell.vcService : cell.vcDesign;
  const pct = Math.min(100, (dcr / 1.6) * 100);

  return (
    <div
      className={`mx-cell mx-val${highlight ? ' hl' : ''}`}
      style={{ borderColor: info.color, background: `${info.color}10` }}
    >
      <div className="mx-top">
        <span className="mx-dcr" style={{ color: info.color }}>
          {dcr.toFixed(2)}
        </span>
        <span className="mx-risk" style={{ color: info.color }}>
          {info.label}
        </span>
      </div>

      <div className="mx-gauge" title="눈금 0 ~ 1.6, 흰 선이 D/C = 1.0">
        <i style={{ width: `${pct}%`, background: info.color }} />
        <b style={{ left: '62.5%' }} />
      </div>

      <div className="mx-sub">
        Vu <em>{num(vu, 0)}</em> kN &nbsp;/&nbsp; φVn <em>{num(vc, 0)}</em> kN
      </div>
      <div className="mx-label">{cell.label}</div>
    </div>
  );
}
