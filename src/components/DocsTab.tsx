import React from 'react';

export default function DocsTab() {
  return (
    <div className="page">
      <div className="page-inner">
        <h2>방법과 한계</h2>
        <p>
          자세한 내용은 프로젝트 폴더의 <code>source-notes.md</code>, <code>methodology.md</code>,{' '}
          <code>limitations.md</code> 에 정리되어 있습니다. 아래는 화면에서 바로 확인할 수 있는 요약본입니다.
        </p>

        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="doc">
            <h4>무엇을 계산하는가</h4>
            <p>
              내부기둥 하나가 부담하는 등분포 하중으로부터 슬래브-기둥 접합부의 전단력을 구하고, 이를
              위험단면의 면적으로 나눈 <b>소요 전단응력</b>을 코드 기준의 <b>펀칭전단 강도</b>와 비교합니다.
            </p>
            <ul>
              <li>
                전단력 <code>V = w × (부담면적 − 위험단면 내부면적)</code>
              </li>
              <li>
                소요 응력 <code>vu = V / (b₀ · d)</code>
              </li>
              <li>
                판정 <code>D/C = vu / (φ·vn)</code>
              </li>
            </ul>

            <h4>사용한 강도식</h4>
            <ul>
              <li>
                <b>ACI 318-19 (22.6.5.2)</b> : 위험단면은 기둥면에서 <code>d/2</code>, 원형 기둥이므로{' '}
                <code>b₀ = π(D + d)</code>. 강도는 <code>0.33·λs·√f'c</code> 등 세 식 중 최솟값.
              </li>
              <li>
                <b>크기효과계수</b> <code>λs = √(2 / (1 + 0.004d)) ≤ 1</code> — 두꺼운 부재의 강도를 낮춥니다.
                1995년 당시 기준에는 없던 조항이라 화면에서 끌 수 있게 했습니다.
              </li>
              <li>
                <b>Eurocode 2 (6.4.4)</b> : 기본둘레는 기둥면에서 <code>2d</code>,{' '}
                <code>v_Rd,c = (0.18/γc)·k·(100ρl·fck)^(1/3)</code>. 상부철근비가 강도에 반영되는 것이 ACI 와
                다른 점입니다.
              </li>
              <li>
                <b>기둥 축력(보조 지표)</b> :{' '}
                <code>Pn,max = 0.80[0.85 f'c (Ag − Ast) + fy·Ast]</code>
              </li>
            </ul>

            <h4>하중 조합</h4>
            <ul>
              <li>설계 검토 : <code>1.2D + 1.6L</code>, 전단 강도감소계수 <code>φ = 0.75</code></li>
              <li>사용하중 추정 : <code>1.0D + 1.0L</code>, <code>φ = 1.0</code></li>
              <li>슬래브 자중은 두께로부터 <code>24 kN/m³</code> 로 자동 계산합니다.</li>
              <li>국부 추가하중(설비·적치물)은 고정하중으로 취급합니다.</li>
            </ul>
          </div>

          <div className="doc">
            <h4>단순화한 부분 (반드시 알아야 할 점)</h4>
            <ul>
              <li>
                삼풍백화점 전체를 재현한 <b>유한요소해석이 아닙니다</b>. 2×2 bay 일부와 내부기둥 하나만
                다루는 개념 모형입니다.
              </li>
              <li>
                슬래브에서 기둥으로 전달되는 <b>불균형 모멘트</b>를 정밀하게 계산하지 않고, 사용자가 정하는
                할증 계수로 거칠게 반영합니다.
              </li>
              <li>
                <b>전단보강량</b>을 실제 배근(Av·fyt/b₀·s)이 아니라 0~1 의 상대 비율로 단순화했습니다.
              </li>
              <li>
                연쇄붕괴 애니메이션은 <b>동역학 해석이 아니라 개념 애니메이션</b>입니다. 실제 붕괴 순서나
                속도를 재현하지 않습니다.
              </li>
              <li>
                크리프, 시공 순서, 균열 이력, 철근 정착, 온도·건조수축, 기둥 세장비 등은 고려하지 않습니다.
              </li>
            </ul>

            <h4>수치의 출처</h4>
            <ul>
              <li>
                <b>기둥 직경, 콘크리트 압축강도, 유효깊이, 기둥 주철근 개수</b>는 과제에서 제시된 조사자료
                값을 그대로 사용했습니다.
              </li>
              <li>
                <b>경간, 마감 고정하중, 활하중, 국부 추가하중, 드롭패널 치수</b>는 공개 자료로 확정하지
                못했기 때문에 <b>교육용 가정값</b>입니다. 화면에서 직접 바꿔 가며 영향을 확인하도록
                슬라이더로 만들어 두었습니다.
              </li>
              <li>
                검증 참고 문헌 : N.J. Gardner, Jungsuck Huh, Lan Chung, “Lessons from the Sampoong department
                store collapse”, <i>Cement and Concrete Composites</i> 24 (2002) 523–529.
              </li>
              <li>
                이 프로그램은 원문 PDF 를 직접 대조하지 않았습니다. 제출 전에 문헌의 조건·결과와 이 모형의
                출력을 직접 비교해 보는 것이 <b>탐구 과정의 일부</b>가 됩니다.{' '}
                <code>source-notes.md</code> 에 비교 기록용 표를 만들어 두었습니다.
              </li>
            </ul>

            <h4>이 프로그램의 성격</h4>
            <p style={{ marginBottom: 0 }}>
              이 프로그램은 <b>교육용 단순화 모델</b>이며, 실제 구조 안전진단이나 설계에 사용할 수 없습니다.
              절대값보다 조건을 바꿨을 때 위험도가 <b>어느 방향으로, 대략 어느 정도</b> 움직이는지를 읽는
              도구로 사용하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
