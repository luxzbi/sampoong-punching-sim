import React, { useRef } from 'react';
import { HISTORY_NOTE, TAG_COLORS, TIMELINE } from '../data/history';
import { exportNodeAsPng, stamp } from '../lib/exportPng';

export default function HistoryTab() {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="page">
      <div className="page-inner" ref={ref}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h2>역사적 배경 — 한국 현대건축의 발전과 안전의 그늘</h2>
            <p>
              일제강점기에 이식된 근대 건축기술이 전후복구와 산업화를 거치며 대량 건설로 이어지고, 그
              과정에서 반복된 안전 문제가 어떻게 제도의 변화로 이어졌는지를 정리한 타임라인입니다.
            </p>
          </div>
          <button
            className="btn"
            data-no-export="true"
            onClick={() => exportNodeAsPng(ref.current, `역사적배경_${stamp()}`)}
          >
            Export as PNG
          </button>
        </div>

        <div className="timeline">
          {TIMELINE.map((t, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-year">{t.year}</div>
              <div className="tl-title">
                {t.title}
                <span
                  className="tl-tag"
                  style={{ background: `${TAG_COLORS[t.tag]}22`, color: TAG_COLORS[t.tag] }}
                >
                  {t.tag}
                </span>
              </div>
              <div className="tl-body">{t.body}</div>
            </div>
          ))}
        </div>

        <div className="doc" style={{ marginTop: 8 }}>
          <h4>이 타임라인을 시뮬레이터와 어떻게 연결해서 읽을까</h4>
          <ul>
            <li>
              기술은 빠르게 들어왔지만, 그 기술을 <b>검증하고 감독하는 제도</b>는 늦게 따라왔다는 점이
              여러 사건에서 반복됩니다.
            </li>
            <li>
              시뮬레이터에서 <b>용도 변경</b>으로 고정하중을 올려 보면, 설계 당시의 가정을 벗어난 사용이
              구조에 어떤 의미인지 수치로 확인할 수 있습니다.
            </li>
            <li>
              <b>기둥 직경</b>과 <b>콘크리트 강도</b>를 구조계산 조건에서 시공 조건으로 낮춰 보면, 설계와
              시공 사이의 변경이 어떤 방향으로 작용하는지 볼 수 있습니다.
            </li>
            <li>
              다만 실제 붕괴는 구조 변수 하나로 설명되지 않습니다. 점검·보고·대피 판단 같은{' '}
              <b>관리와 제도의 문제</b>가 함께 있었다는 점을 반드시 함께 서술하는 것이 좋습니다.
            </li>
          </ul>
          <h4>주의</h4>
          <p style={{ margin: 0 }}>{HISTORY_NOTE}</p>
        </div>
      </div>
    </div>
  );
}
