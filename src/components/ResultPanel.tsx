import React from 'react';
import { Card, KV, num } from './ui';
import { Params } from '../model/types';
import { AnalysisResult, RISK_INFO, riskOf } from '../model/punching';
import { explainChanges, explainGoverning } from '../model/explain';

interface Props {
  params: Params;
  baseline: Params;
  baselineLabel: string;
  result: AnalysisResult;
}

function Gauge({ dcr }: { dcr: number }) {
  const pct = Math.min(100, (dcr / 2) * 100);
  const info = RISK_INFO[riskOf(dcr)];
  return (
    <div className="gauge">
      <i style={{ width: `${pct}%`, background: info.color }} />
      <div className="mark" style={{ left: '35%' }} title="D/C = 0.7" />
      <div className="mark" style={{ left: '50%' }} title="D/C = 1.0" />
    </div>
  );
}

export default function ResultPanel({ params, baseline, baselineLabel, result }: Props) {
  const info = RISK_INFO[result.riskLevel];
  const cards = explainChanges(baseline, params);
  const g = result.governing;
  const axial = result.columnAxial;

  return (
    <div>
      <div
        className="dcr-box"
        style={{ borderColor: info.color, background: `${info.color}12` }}
      >
        <div className="dcr-top">
          <span className="dcr-num" style={{ color: info.color }}>
            {result.dcr.toFixed(2)}
          </span>
          <span>
            <span className="dcr-label" style={{ color: info.color }}>
              {info.label}
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              Demand / Capacity Ratio · {result.load.comboLabel}
            </div>
          </span>
        </div>
        <Gauge dcr={result.dcr} />
        <div className="dcr-desc">{info.desc}</div>
        <div className="dcr-desc" style={{ color: 'var(--text-faint)' }}>
          0.7 / 1.0 이라는 구분선도 교육용으로 정한 것이며, 실제 안전 판정 기준이 아닙니다.
        </div>
      </div>

      <div className="vv-row">
        <div className="vv-box" style={{ borderColor: '#3d5a8a' }}>
          <div className="k">Punching Shear Demand</div>
          <div className="v" style={{ color: '#79b8ff' }}>
            Vu = {num(result.vu, 0)} <span className="u">kN</span>
          </div>
        </div>
        <div className="vv-box" style={{ borderColor: '#2f6b3a' }}>
          <div className="k">Punching Shear Capacity</div>
          <div className="v" style={{ color: '#68d391' }}>
            φVn = {num(result.vc, 0)} <span className="u">kN</span>
          </div>
        </div>
      </div>
      <div
        className="vv-box wide"
        style={{ marginBottom: 12, borderColor: info.color, background: `${info.color}0f` }}
      >
        <div className="k">Demand / Capacity Ratio</div>
        <div className="v" style={{ color: info.color }}>
          D/C = Vu / φVn = {num(result.vu, 0)} / {num(result.vc, 0)} = {result.dcr.toFixed(2)}
        </div>
      </div>

      <Card title="계산 과정 (지배 단면)">
        <div className="trace">
          {result.trace.map((t, i) => (
            <div key={i} className={`trace-line${i === result.trace.length - 1 ? ' final' : ''}`}>
              <span className="l">{t.label}</span>
              <span className="e">{t.expr}</span>
              <span className="v">{t.value}</span>
            </div>
          ))}
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          단위 : 길이 mm, 하중 kPa(=kN/m²), 응력 MPa(=N/mm²), 힘 kN. 응력비 vu/φvn 과 힘의 비 Vu/φVn 은
          같은 b₀·d 로 나누고 곱한 값이라 항상 동일합니다.
        </div>
      </Card>

      <Card title="검토 결과 요약">
        <KV k="지배 단면" v={g.name} />
        <KV k="소요 전단응력 vu" v={`${num(g.demand, 3)} MPa`} />
        <KV k="설계 전단강도" v={`${num(g.capacity, 3)} MPa`} />
        <KV k="위험단면 둘레" v={`${num(g.perimeter, 0)} mm`} />
        <KV k="유효깊이" v={`${num(g.d, 0)} mm`} />
        <KV k="전단력 V" v={`${num(g.shearForce, 0)} kN`} />
        <KV k="부담면적" v={`${num(result.tributaryArea, 1)} m²`} />
        <KV k="슬래브 두께 (자동)" v={`${num(result.slabThickness, 0)} mm`} />
        <KV k="바깥 슬래브 유효깊이 d₂" v={`${num(result.d2, 0)} mm`} />
        <div className="hint" style={{ marginTop: 8 }}>{explainGoverning(result)}</div>
      </Card>

      <Card title="두 하중 조합 비교">
        <KV
          k="설계 검토 (1.2D+1.6L, φ=0.75)"
          v={`${num(result.vuDesign, 0)} / ${num(result.vcDesign, 0)} kN → ${result.dcrDesign.toFixed(
            2
          )}`}
        />
        <KV
          k="사용하중 추정 (1.0D+1.0L, φ=1.0)"
          v={`${num(result.vuService, 0)} / ${num(
            result.vcService,
            0
          )} kN → ${result.dcrService.toFixed(2)}`}
        />
        <div className="hint">
          설계 검토는 안전율을 포함한 값이라 항상 더 큽니다. 건물이 실제로 서 있었는지를 생각할 때는
          사용하중 값이, 설계가 기준을 만족했는지를 볼 때는 설계 검토 값이 참고가 됩니다.
        </div>
      </Card>

      <Card title="하중 구성">
        <KV k="슬래브 자중" v={`${num(result.load.slabSelfWeight, 2)} kPa`} />
        <KV k="드롭패널 자중 (평균 환산)" v={`${num(result.load.dropPanelSelfWeight, 2)} kPa`} />
        <KV k="마감·설비 고정하중" v={`${num(result.load.superDead, 2)} kPa`} />
        <KV k="고정하중 합계 D" v={`${num(result.load.totalDead, 2)} kPa`} />
        <KV k="활하중 L" v={`${num(result.load.live, 2)} kPa`} />
        <KV k="국부 추가하중" v={`${num(result.load.localExtra, 2)} kPa`} />
        <KV k="적용 등분포하중 w" v={`${num(result.load.w, 2)} kPa`} />
      </Card>

      <Card title="모든 검토 단면">
        <table className="data">
          <thead>
            <tr>
              <th>단면</th>
              <th>vu</th>
              <th>강도</th>
              <th>D/C</th>
            </tr>
          </thead>
          <tbody>
            {result.checks.map((c) => (
              <tr key={c.name} className={c.name === g.name ? 'hl' : ''}>
                <td>{c.name}</td>
                <td>{num(c.demand, 3)}</td>
                <td>{num(c.capacity, 3)}</td>
                <td style={{ color: RISK_INFO[riskOf(c.dcr)].color }}>{c.dcr.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hint">단위: MPa. 여러 단면 중 D/C 가 가장 큰 단면이 지배합니다.</div>
      </Card>

      <Card title="참고 : 기둥 축력 검토">
        <KV k="기둥 단면적 Ag" v={`${num(axial.ag / 1000, 0)} ×10³ mm²`} />
        <KV k="주철근량 Ast" v={`${num(axial.ast, 0)} mm² (ρ ${num(axial.rho, 2)}%)`} />
        <KV k="축력 저항" v={`${num(axial.capacity, 0)} kN`} />
        <KV k="축력 요구 (지지 층수 반영)" v={`${num(axial.demand, 0)} kN`} />
        <KV
          k="요구 / 저항"
          v={
            <span style={{ color: RISK_INFO[riskOf(axial.ratio)].color }}>
              {axial.ratio.toFixed(2)}
            </span>
          }
        />
        <div className="hint">
          펀칭전단과 별개의 보조 지표입니다. 구조계산서의 16-HD22 를 도면에서 8-HD22 로 줄인 변경이
          기둥 축력 저항에 어떤 영향을 주는지 확인하는 용도입니다.
        </div>
      </Card>

      <Card title={`변수 변경에 따른 설명 (기준: ${baselineLabel})`}>
        {cards.length === 0 && (
          <div className="hint">
            현재 값이 기준 프리셋과 같습니다. 왼쪽 변수를 조절하면 어떤 변화가 왜 위험도에 영향을
            주는지 여기에 설명이 나타납니다.
          </div>
        )}
        {cards.map((c) => (
          <div key={c.id} className={`explain-card ${c.direction}`}>
            <div className="t">
              <span>{c.title}</span>
              {c.effect && (
                <span
                  className="d"
                  style={{
                    color:
                      c.direction === 'better'
                        ? 'var(--good)'
                        : c.direction === 'worse'
                        ? 'var(--bad)'
                        : 'var(--text-faint)'
                  }}
                >
                  D/C {c.effect.dcr >= 0 ? '+' : ''}
                  {c.effect.dcr.toFixed(1)}%
                </span>
              )}
            </div>
            {c.attribution && (
              <div
                className="b"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10.5,
                  color: 'var(--text-faint)',
                  marginBottom: 4
                }}
              >
                {c.attribution}
              </div>
            )}
            <div className="b">{c.text}</div>
          </div>
        ))}
        {cards.length > 0 && (
          <div className="footnote">
            표시된 % 는 기준 프리셋에서 그 변수 <b>하나만</b> 현재 값으로 바꿨을 때의 D/C 변화입니다.
            여러 변수를 함께 바꾸면 합계와 정확히 일치하지 않습니다. 이 수치는 이 단순화 모형 안에서의
            비교값이며, 실제 건물의 안전을 보장하거나 판정하지 않습니다.
          </div>
        )}
      </Card>
    </div>
  );
}
