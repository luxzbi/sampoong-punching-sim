/**
 * Sanity check / 손계산 검증 스크립트
 *
 *   npm run sanity
 *
 * 브라우저 화면과 같은 계산 코드를 그대로 불러와서
 *  (1) 세 프리셋의 D/C 값
 *  (2) OVAT 실험 결과
 *  (3) 코드 기준식이 손계산과 맞는지 (ACI vc, 기하량)
 * 를 콘솔에 출력합니다.
 *
 * 이 출력은 문헌값과 비교(validation)할 때 근거로 쓰기 위한 것입니다.
 * source-notes.md 의 검증 표에 결과를 옮겨 적어 사용하세요.
 */

import { PRESETS, PRESET_ORDER } from '../src/model/presets';
import {
  aciVc,
  analyze,
  computeLoads,
  sizeEffectFactor,
  slabEffectiveDepth,
  slabThicknessOf,
  tributaryAreaOf
} from '../src/model/punching';
import { runOvat } from '../src/model/ovat';

const f = (n: number, d = 3) => n.toFixed(d);
const line = (s = '') => console.log(s);

line('='.repeat(74));
line(' 교육용 펀칭전단 모형 - Sanity Check');
line(' (실제 구조 안전진단이 아니며, 모형 내부 계산의 일관성을 확인하는 용도)');
line('='.repeat(74));

for (const key of PRESET_ORDER) {
  const preset = PRESETS[key];
  const p = preset.params;
  const r = analyze(p);

  line();
  line(`[${key}] ${preset.label}`);
  line('-'.repeat(74));
  line(
    `  입력   D=${p.columnDiameter}mm  d1=${p.effectiveDepth}mm  f'c=${p.fck}MPa  ` +
      `경간=${p.spanX}x${p.spanY}mm`
  );
  line(
    `         드롭패널=${p.dropPanel ? `${p.dropPanelSize}x${p.dropPanelThickness}mm` : '없음'}  ` +
      `전단보강=${p.shearReinf ? p.shearReinfRatio.toFixed(2) : '없음'}  용도=${p.usage}`
  );
  line(
    `  기하   슬래브두께=${f(slabThicknessOf(p), 0)}mm  d2=${f(slabEffectiveDepth(p), 0)}mm  ` +
      `부담면적=${f(tributaryAreaOf(p), 2)}m2`
  );

  const wd = computeLoads(p, 'design').w;
  const ws = computeLoads(p, 'service').w;
  line(`  하중   계수하중 w=${f(wd, 2)}kPa   사용하중 w=${f(ws, 2)}kPa`);

  for (const c of r.checks) {
    line(
      `  단면   ${c.name.padEnd(26)} b0=${f(c.perimeter, 0).padStart(6)}mm ` +
        `d=${f(c.d, 0).padStart(4)}mm  vu=${f(c.demand)}MPa  cap=${f(c.capacity)}MPa  ` +
        `D/C=${f(c.dcr, 2)}`
    );
  }
  line(
    `  결과   지배단면="${r.governing.name}"  D/C(설계)=${f(r.dcrDesign, 2)}  ` +
      `D/C(사용)=${f(r.dcrService, 2)}  위험도=${r.riskLevel}`
  );
  line(
    `  기둥   Ag=${f(r.columnAxial.ag / 1000, 0)}x10^3mm2  Ast=${f(r.columnAxial.ast, 0)}mm2  ` +
      `요구=${f(r.columnAxial.demand, 0)}kN  저항=${f(r.columnAxial.capacity, 0)}kN  ` +
      `비=${f(r.columnAxial.ratio, 2)}`
  );
}

/* ---------------- 손계산 대조 ---------------- */

line();
line('='.repeat(74));
line(' 손계산 대조 (Scenario A, ACI 318-19)');
line('='.repeat(74));

{
  const p = PRESETS.A.params;
  const D = p.columnDiameter;
  const d = p.effectiveDepth;
  const b0 = Math.PI * (D + d);
  const ls = sizeEffectFactor(d, p.sizeEffect);
  const vc = aciVc(p.fck, d, b0, p.sizeEffect);
  const byHand = ls * 0.33 * Math.sqrt(p.fck);

  line(`  b0 = pi(D + d) = pi(${D} + ${d}) = ${f(b0, 1)} mm`);
  line(`  lambda_s = sqrt(2/(1+0.004*${d})) = ${f(ls, 4)}`);
  line(`  vc(코드계산) = ${f(vc, 4)} MPa`);
  line(`  vc(손계산 0.33*ls*sqrt(f'c)) = ${f(byHand, 4)} MPa`);
  line(`  일치 여부 : ${Math.abs(vc - byHand) < 1e-9 ? 'OK (동일)' : '불일치 - 확인 필요'}`);

  const load = computeLoads(p, 'design');
  const trib = tributaryAreaOf(p);
  const innerA = (Math.PI / 4) * Math.pow((D + d) / 1000, 2);
  const V = load.w * (trib - innerA);
  const vu = (V * 1000) / (b0 * d);
  line(`  V = w(${f(load.w, 2)}) x (A(${f(trib, 2)}) - A_in(${f(innerA, 3)})) = ${f(V, 1)} kN`);
  line(`  vu = V/(b0*d) = ${f(vu, 4)} MPa`);
  line(`  D/C = vu / (0.75*vc) = ${f(vu / (0.75 * vc), 3)}`);
}

/* ---------------- OVAT ---------------- */

line();
line('='.repeat(74));
line(' OVAT 실험 (기준: Scenario A)');
line('='.repeat(74));
for (const row of runOvat()) {
  line(
    `  ${row.label.padEnd(30)} D/C=${f(row.dcr, 3).padStart(7)}  ` +
      `${row.id === 'base' ? '   기준' : `${row.deltaPercent >= 0 ? '+' : ''}${f(row.deltaPercent, 1)}%`}`
  );
}

line();
line('※ 위 값은 교육용 단순화 모델의 출력이며 실제 건물의 안전을 판정하지 않습니다.');
line();

/* ---------------- 붕괴 회피 실험 ---------------- */

import { factorial, improvementPath, thresholdTable } from '../src/model/solver';

line();
line('='.repeat(74));
line(' 2x2 요인 실험 : 시공 조건 x 하중 조건');
line('='.repeat(74));
for (const c of factorial()) {
  line(
    `  [시공 ${c.structure.padEnd(6)} | 하중 ${c.load.padEnd(5)}] ` +
      `D/C(설계)=${f(c.dcrDesign, 2)}  D/C(사용)=${f(c.dcrService, 2)}  ` +
      `Vu=${f(c.vuService, 0)}kN  phiVn=${f(c.vcService, 0)}kN   ${c.label}`
  );
}

line();
line('='.repeat(74));
line(' 누적 개선 경로 (Scenario A 에서 하나씩 되돌리기)');
line('='.repeat(74));
for (const r of improvementPath()) {
  line(
    `  ${r.label.padEnd(26)} [${r.kind}] D/C(설계)=${f(r.dcrDesign, 2).padStart(5)}  ` +
      `D/C(사용)=${f(r.dcrService, 2).padStart(5)}`
  );
}

line();
line('='.repeat(74));
line(' 임계값 탐색 : 변수 하나만으로 사용하중 D/C <= 1.0 이 되려면');
line('='.repeat(74));
for (const t of thresholdTable(PRESETS.A.params, 1.0, 'service')) {
  if (t.achievable) {
    line(
      `  ${t.knob.label.padEnd(24)} ${f(t.current, 1).padStart(8)} -> ` +
        `${f(t.required!, 1).padStart(8)} ${t.knob.unit}`
    );
  } else {
    line(
      `  ${t.knob.label.padEnd(24)} 범위 한계(${f(t.knob.bound, 1)})까지 가도 D/C=${f(
        t.dcrAtBound,
        2
      )} : 이 변수 하나로는 불가능`
    );
  }
}
line();
