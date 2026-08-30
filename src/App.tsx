import React, { useEffect, useMemo, useRef, useState } from 'react';
import Scene3D, { CollapseState, VIEW_LABELS, ViewMode } from './components/Scene3D';
import ControlPanel from './components/ControlPanel';
import ResultPanel from './components/ResultPanel';
import CompareSection from './components/CompareSection';
import OvatTab from './components/OvatTab';
import HistoryTab from './components/HistoryTab';
import DocsTab from './components/DocsTab';
import SolverTab from './components/SolverTab';
import { Params } from './model/types';
import { defaultParams, PRESETS, PRESET_ORDER, PresetKey } from './model/presets';
import { analyze, RISK_INFO } from './model/punching';
import { exportNodeAsPng, stamp } from './lib/exportPng';

type Tab = 'sim' | 'solve' | 'ovat' | 'history' | 'docs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sim', label: '구조 시뮬레이션' },
  { key: 'solve', label: '붕괴 회피 실험' },
  { key: 'ovat', label: '탐구 모드' },
  { key: 'history', label: '역사적 배경' },
  { key: 'docs', label: '방법 · 한계' }
];

export default function App() {
  const [tab, setTab] = useState<Tab>('sim');
  const [presetKey, setPresetKey] = useState<PresetKey>('A');
  const [params, setParams] = useState<Params>(defaultParams);
  const [collapse, setCollapse] = useState<CollapseState>('idle');
  const [showRebar, setShowRebar] = useState(true);
  const [showLoads, setShowLoads] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [view, setView] = useState<ViewMode>('overview');
  const [compareOpen, setCompareOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => analyze(params), [params]);
  const preset = PRESETS[presetKey];

  // 화면 녹화나 발표 자료 제작을 위해 URL 로 초기 상태를 지정할 수 있게 한다.
  //   ?tab=sim  ?preset=B  ?view=joint  ?collapse=1  ?compare=1
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab');
    if (t === 'sim' || t === 'solve' || t === 'ovat' || t === 'history' || t === 'docs') setTab(t);
    const pk = q.get('preset');
    if (pk === 'A' || pk === 'B' || pk === 'C') {
      setPresetKey(pk);
      setParams({ ...PRESETS[pk].params });
    }
    const v = q.get('view');
    if (v === 'overview' || v === 'joint' || v === 'section') {
      setView(v);
      setShowLoads(v !== 'joint');
    }
    if (q.get('collapse') === '1') setCollapse('playing');
    if (q.get('compare') === '1') setCompareOpen(true);
  }, []);

  const applyPreset = (k: PresetKey) => {
    setPresetKey(k);
    setParams({ ...PRESETS[k].params });
    setCollapse('idle');
    // 카메라 각도는 그대로 두어 세 시나리오를 같은 시점에서 비교할 수 있게 한다.
  };

  const patch = (p: Partial<Params>) => {
    setParams((prev) => ({ ...prev, ...p }));
    if (collapse !== 'idle') setCollapse('idle');
  };

  const risk = RISK_INFO[result.riskLevel];

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <h1>플랫슬래브 펀칭전단 · 연쇄붕괴 구조 시뮬레이터</h1>
          <div className="sub">
            한국 현대건축의 발전과 안전의 그늘 — 일제강점기 근대 건축기술 도입에서 1995년 삼풍백화점
            붕괴까지 · 2차 탐구용
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="disclaimer">
        <b>교육용 단순화 모델</b>
        <span>
          이 프로그램은 구조 개념을 이해하기 위한 교육용 단순화 모델이며, 실제 구조 안전진단이나 설계를
          대체하지 않습니다. 삼풍백화점 전체 구조를 정밀 복원한 해석이 아닙니다.
        </span>
      </div>

      {tab === 'sim' && (
        <div className="workspace" ref={captureRef}>
          {/* ---------- 왼쪽 : 변수 조절 ---------- */}
          <aside className="side side-left">
            <div className="side-title">변수 조절</div>
            <ControlPanel
              params={params}
              onChange={patch}
              onReset={() => applyPreset(presetKey)}
            />
          </aside>

          {/* ---------- 가운데 : 3D 구조 ---------- */}
          <div className="center">
            <div className="preset-row">
              {PRESET_ORDER.map((k) => (
                <button
                  key={k}
                  className={`preset-btn${presetKey === k ? ' active' : ''}`}
                  style={
                    presetKey === k
                      ? { background: `${PRESETS[k].color}22`, borderColor: PRESETS[k].color }
                      : undefined
                  }
                  onClick={() => applyPreset(k)}
                  title={PRESETS[k].summary}
                >
                  <span className="dot" style={{ background: PRESETS[k].color }} />
                  {PRESETS[k].label}
                </button>
              ))}
              <span className="preset-spacer" />
              <button
                className="btn"
                data-no-export="true"
                onClick={() =>
                  exportNodeAsPng(captureRef.current, `시뮬레이션_${presetKey}_${stamp()}`)
                }
              >
                Export Result as PNG
              </button>
            </div>

            <div className="viewport">
              <Scene3D
                params={params}
                result={result}
                collapse={collapse}
                onCollapseDone={() => setCollapse('done')}
                showRebar={showRebar}
                showLoads={showLoads}
                showLabels={showLabels}
                resetToken={resetToken}
                view={view}
              />

              <div className="viewport-overlay">
                <div>
                  <span className="k">모델</span>{' '}
                  <span className="v">플랫슬래브 2×2 bay + 내부기둥</span>
                </div>
                <div>
                  <span className="k">시나리오</span> <span className="v">{preset.label}</span>
                </div>
                <div>
                  <span className="k">D/C</span>{' '}
                  <span className="v" style={{ color: risk.color }}>
                    {result.dcr.toFixed(2)} ({risk.label})
                  </span>
                </div>
                <div>
                  <span className="k">균열 표현</span>{' '}
                  <span className="v">
                    {result.dcr < 0.7
                      ? '미세'
                      : result.dcr < 1.0
                      ? '원형·방사형 균열 진전'
                      : '균열 집중 (펀칭 위험)'}
                  </span>
                </div>
              </div>

              {collapse !== 'idle' && (
                <div className="viewport-note">
                  <b>개념 애니메이션</b> — 기둥이 슬래브를 뚫고 올라오는 펀칭전단 파괴 이후, 그 기둥이
                  받던 하중이 인접 접합부로 재분배되면서 시간차를 두고 무너지는 <b>연쇄붕괴 개념</b>을
                  보여 줍니다. 동역학 해석이 아니며 실제 붕괴 순서·속도를 재현하지 않습니다.
                  {result.dcr < 1 && (
                    <>
                      {' '}
                      현재 D/C 는 {result.dcr.toFixed(2)} 로 1.0 미만이므로, 이 애니메이션은 가정에 따른
                      시연일 뿐 이 조건에서 붕괴가 일어난다는 뜻이 아닙니다.
                    </>
                  )}
                </div>
              )}

              <div className="viewport-toolbar" data-no-export="true">
                <button
                  className="btn danger sm"
                  onClick={() => setCollapse('playing')}
                  disabled={collapse === 'playing'}
                >
                  {collapse === 'playing' ? '붕괴 진행 중…' : '펀칭전단 붕괴 재생'}
                </button>
                <button className="btn sm" onClick={() => setCollapse('idle')}>
                  되돌리기
                </button>
                <span className="sep" />
                {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    className={`btn sm${view === v ? ' primary' : ''}`}
                    onClick={() => {
                      setView(v);
                      setResetToken((t) => t + 1);
                      setShowLoads(v !== 'joint');
                    }}
                  >
                    {VIEW_LABELS[v]}
                  </button>
                ))}
                <span className="sep" />
                <button
                  className={`btn sm${showLoads ? ' on' : ''}`}
                  onClick={() => setShowLoads((v) => !v)}
                >
                  하중
                </button>
                <button
                  className={`btn sm${showRebar ? ' on' : ''}`}
                  onClick={() => setShowRebar((v) => !v)}
                >
                  상부철근
                </button>
                <button
                  className={`btn sm${showLabels ? ' on' : ''}`}
                  onClick={() => setShowLabels((v) => !v)}
                >
                  라벨
                </button>
              </div>
            </div>

            <button
              className="drawer-bar"
              onClick={() => setCompareOpen((v) => !v)}
              data-no-export={compareOpen ? undefined : 'true'}
            >
              <b>시나리오 비교</b>
              <span className="pill">A · B · C · 현재 설정</span>
              <span>세 조건의 단면·하중·D/C 를 한 표에서 비교하고 막대그래프로 만듭니다</span>
              <span className="chev">{compareOpen ? '▼ 접기' : '▲ 펼치기'}</span>
            </button>

            {compareOpen && (
              <div className="bottom">
                <CompareSection params={params} syncOptions />
              </div>
            )}
          </div>

          {/* ---------- 오른쪽 : 결과 ---------- */}
          <aside className="side side-right">
            <div className="side-title">해석 결과</div>
            <div className="preset-note" style={{ borderLeftColor: preset.color }}>
              <b style={{ color: preset.color }}>{preset.label}</b>
              <div>{preset.summary}</div>
            </div>
            <ResultPanel
              params={params}
              baseline={preset.params}
              baselineLabel={preset.label}
              result={result}
            />
            <div className="footnote">출처 표시 : {preset.provenance}</div>
          </aside>
        </div>
      )}

      {tab === 'solve' && <SolverTab current={params} />}
      {tab === 'ovat' && <OvatTab current={params} />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'docs' && <DocsTab />}
    </div>
  );
}
