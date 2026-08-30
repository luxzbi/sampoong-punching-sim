/**
 * "어떻게 하면 붕괴하지 않을 수 있었는가" 를 직접 실험하기 위한 탐색 모듈.
 *
 * 세 가지 실험을 제공한다.
 *   1) 2x2 요인 실험 : 시공 조건(실제 / 구조계산서) x 하중 조건(실제 / 원설계)
 *   2) 임계값 탐색   : 변수 하나만으로 D/C 를 목표치까지 낮추려면 얼마가 필요한가
 *   3) 누적 개선 경로 : 개선을 하나씩 더해 갈 때 D/C 가 언제 1.0 아래로 내려가는가
 *
 * 모든 계산은 punching.ts 의 같은 식을 사용한다. 여기에는 새로운 공식이 없다.
 * 결과는 교육용 비교값이며 실제 건물의 안전을 판정하지 않는다.
 */

import { LIMITS, Params } from './types';
import { PRESETS } from './presets';
import { analyze } from './punching';

export type Mode = 'design' | 'service';

const withMode = (p: Params, mode: Mode): Params => ({ ...p, loadMode: mode });

export const dcrOf = (p: Params, mode: Mode) => analyze(withMode(p, mode)).dcr;

/* ------------------------------------------------------------------ */
/* 1) 2x2 요인 실험 : 시공 조건 x 하중 조건                              */
/* ------------------------------------------------------------------ */

/** 구조 단면·재료에 해당하는 변수 (= 어떻게 지었는가) */
const STRUCTURE_KEYS = [
  'columnDiameter',
  'effectiveDepth',
  'fck',
  'columnBars',
  'topRebarRatio',
  'dropPanel',
  'dropPanelSize',
  'dropPanelThickness',
  'shearReinf',
  'shearReinfRatio'
] as const;

/** 하중에 해당하는 변수 (= 어떻게 썼는가) */
const LOAD_KEYS = ['usage', 'superDead', 'liveLoad', 'localExtraLoad'] as const;

function pick<K extends readonly (keyof Params)[]>(p: Params, keys: K): Partial<Params> {
  const out: Partial<Params> = {};
  for (const k of keys) (out as any)[k] = p[k];
  return out;
}

export interface FactorialCell {
  id: string;
  structure: '실제 시공' | '구조계산서';
  load: '실제 사용' | '원설계';
  label: string;
  dcrDesign: number;
  dcrService: number;
  vuService: number;
  vcService: number;
  params: Params;
}

/**
 * 시공 조건과 하중 조건을 각각 실제/원설계로 조합한 네 가지 경우.
 * "구조 때문인가, 사용 때문인가" 를 분리해서 보기 위한 실험이다.
 */
export function factorial(base?: Params): FactorialCell[] {
  const A = base ?? PRESETS.A.params; // 실제 시공 + 실제 사용
  const B = PRESETS.B.params; // 구조계산서 + 원설계

  const combos: {
    id: string;
    structure: FactorialCell['structure'];
    load: FactorialCell['load'];
    label: string;
    src: { s: Params; l: Params };
  }[] = [
    {
      id: 'aa',
      structure: '실제 시공',
      load: '실제 사용',
      label: '실제로 있었던 조건',
      src: { s: A, l: A }
    },
    {
      id: 'ab',
      structure: '실제 시공',
      load: '원설계',
      label: '지은 대로 두고, 하중만 원설계대로',
      src: { s: A, l: B }
    },
    {
      id: 'ba',
      structure: '구조계산서',
      load: '실제 사용',
      label: '구조계산서대로 짓고, 하중은 실제대로',
      src: { s: B, l: A }
    },
    {
      id: 'bb',
      structure: '구조계산서',
      load: '원설계',
      label: '둘 다 원래 계획대로',
      src: { s: B, l: B }
    }
  ];

  return combos.map((c) => {
    const p: Params = {
      ...A,
      ...pick(c.src.s, STRUCTURE_KEYS),
      ...pick(c.src.l, LOAD_KEYS)
    };
    const design = analyze(withMode(p, 'design'));
    const service = analyze(withMode(p, 'service'));
    return {
      id: c.id,
      structure: c.structure,
      load: c.load,
      label: c.label,
      dcrDesign: design.dcr,
      dcrService: service.dcr,
      vuService: service.vu,
      vcService: service.vc,
      params: p
    };
  });
}

/* ------------------------------------------------------------------ */
/* 2) 임계값 탐색                                                        */
/* ------------------------------------------------------------------ */

export interface Knob {
  id: string;
  label: string;
  unit: string;
  side: 'capacity' | 'demand' | 'both';
  /** 개선 방향으로 갈 때의 한계값 (UI 슬라이더 범위 안) */
  bound: number;
  read: (p: Params) => number;
  apply: (p: Params, v: number) => Params;
  why: string;
}

export const KNOBS: Knob[] = [
  {
    id: 'columnDiameter',
    label: '기둥 직경',
    unit: 'mm',
    side: 'capacity',
    bound: LIMITS.columnDiameter.max,
    read: (p) => p.columnDiameter,
    apply: (p, v) => ({ ...p, columnDiameter: v }),
    why: '임계둘레 b₀ = π(D + d) 를 늘려 φVn 을 키웁니다.'
  },
  {
    id: 'effectiveDepth',
    label: '기둥부 유효깊이 d₁',
    unit: 'mm',
    side: 'both',
    bound: LIMITS.effectiveDepth.max,
    read: (p) => p.effectiveDepth,
    apply: (p, v) => ({ ...p, effectiveDepth: v }),
    why: '위험단면 면적 b₀·d 를 늘리지만 슬래브 자중도 함께 늘어납니다.'
  },
  {
    id: 'fck',
    label: "콘크리트 압축강도 f'c",
    unit: 'MPa',
    side: 'capacity',
    bound: LIMITS.fck.max,
    read: (p) => p.fck,
    apply: (p, v) => ({ ...p, fck: v }),
    why: "vc ∝ √f'c 이므로 저항이 제곱근으로만 늘어납니다."
  },
  {
    id: 'shearReinfRatio',
    label: '펀칭전단 보강량',
    unit: '(0~1)',
    side: 'capacity',
    bound: LIMITS.shearReinfRatio.max,
    read: (p) => (p.shearReinf ? p.shearReinfRatio : 0),
    apply: (p, v) => ({ ...p, shearReinf: v > 0.001, shearReinfRatio: v }),
    why: '콘크리트 분담에 보강근 분담 vs 를 더합니다 (상한 0.5√f′c).'
  },
  {
    id: 'dropPanel',
    label: '드롭패널 신설 (추가 두께)',
    unit: 'mm',
    side: 'capacity',
    bound: LIMITS.dropPanelThickness.max,
    read: (p) => (p.dropPanel ? p.dropPanelThickness : 0),
    // 기둥머리를 v mm 두껍게 만드는 것이므로 d1 도 같이 커진다 (바깥 슬래브 d2 는 그대로)
    apply: (p, v) => ({
      ...p,
      dropPanel: v > 0.5,
      dropPanelThickness: v,
      dropPanelSize: 3000,
      effectiveDepth: p.effectiveDepth + v
    }),
    why: '기둥머리 두께를 키워 b₀ = π(D + d₁) 과 위험단면 면적 b₀·d₁ 을 동시에 늘립니다.'
  },
  {
    id: 'localExtraLoad',
    label: '국부 추가하중 (감소)',
    unit: 'kPa',
    side: 'demand',
    bound: 0,
    read: (p) => p.localExtraLoad,
    apply: (p, v) => ({ ...p, localExtraLoad: v }),
    why: 'Vu = w × 부담면적 의 w 를 직접 줄입니다.'
  },
  {
    id: 'superDead',
    label: '마감·설비 고정하중 (감소)',
    unit: 'kPa',
    side: 'demand',
    bound: LIMITS.superDead.min,
    read: (p) => p.superDead,
    apply: (p, v) => ({ ...p, superDead: v }),
    why: '용도 변경으로 늘어난 고정하중을 되돌리는 방향입니다.'
  },
  {
    id: 'span',
    label: '경간 (기둥 추가로 축소)',
    unit: 'mm',
    side: 'demand',
    bound: LIMITS.spanX.min,
    read: (p) => p.spanX,
    apply: (p, v) => ({ ...p, spanX: v, spanY: v }),
    why: '부담면적이 경간의 제곱으로 줄어 Vu 가 크게 감소합니다.'
  }
];

export interface ThresholdResult {
  knob: Knob;
  current: number;
  /** 목표를 만족시키는 값 (없으면 null) */
  required: number | null;
  /** 한계값까지 갔을 때의 D/C */
  dcrAtBound: number;
  achievable: boolean;
}

/**
 * 변수 하나만 움직여 목표 D/C 를 만족시키는 최소 변화량을 찾는다.
 * 단조성을 가정하지 않고 구간을 촘촘히 훑은 뒤 이분법으로 다듬는다.
 */
export function findThreshold(
  base: Params,
  knob: Knob,
  target: number,
  mode: Mode
): ThresholdResult {
  const cur = knob.read(base);
  const bound = knob.bound;
  const N = 120;

  const at = (v: number) => dcrOf(knob.apply(base, v), mode);
  const dcrAtBound = at(bound);

  let lo: number | null = null;
  let prev = cur;
  for (let i = 1; i <= N; i++) {
    const v = cur + ((bound - cur) * i) / N;
    if (at(v) <= target) {
      lo = prev;
      prev = v;
      break;
    }
    prev = v;
  }

  if (lo === null) {
    return { knob, current: cur, required: null, dcrAtBound, achievable: false };
  }

  // 이분법으로 임계값을 좁힌다
  let a = lo;
  let b = prev;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (at(m) <= target) b = m;
    else a = m;
  }

  return { knob, current: cur, required: b, dcrAtBound, achievable: true };
}

export function thresholdTable(base: Params, target: number, mode: Mode): ThresholdResult[] {
  return KNOBS.map((k) => findThreshold(base, k, target, mode));
}

/* ------------------------------------------------------------------ */
/* 3) 누적 개선 경로                                                     */
/* ------------------------------------------------------------------ */

export interface ImprovementStep {
  id: string;
  label: string;
  kind: '하중' | '구조';
  detail: string;
  patch: Partial<Params>;
}

/**
 * 실제 조건(Scenario A)에서 출발해 조사자료에서 지적된 항목을 하나씩 되돌리거나
 * 보강해 나가는 순서. 하중 쪽 되돌림을 먼저 두어, 구조를 전혀 바꾸지 않아도
 * D/C 가 어디까지 내려가는지 볼 수 있게 했다.
 */
export const IMPROVEMENT_STEPS: ImprovementStep[] = [
  {
    id: 'extra',
    label: '① 국부 추가하중 제거',
    kind: '하중',
    detail: '옥상·설비 등 원설계에 없던 하중을 이 접합부에서 덜어냄 (3.0 → 0 kPa)',
    patch: { localExtraLoad: 0 }
  },
  {
    id: 'usage',
    label: '② 5층 용도 원상복구',
    kind: '하중',
    detail: '식당가 → 판매장, 마감·설비 고정하중 4.5 → 1.5 kPa',
    patch: { usage: 'retail', superDead: 1.5 }
  },
  {
    id: 'column',
    label: '③ 기둥을 구조계산서대로',
    kind: '구조',
    detail: '직경 600 → 800 mm, 주철근 8 → 16-HD22',
    patch: { columnDiameter: 800, columnBars: 16 }
  },
  {
    id: 'depth',
    label: '④ 유효깊이를 구조계산서대로',
    kind: '구조',
    detail: 'd₁ 360 → 410 mm',
    patch: { effectiveDepth: 410 }
  },
  {
    id: 'fck',
    label: '⑤ 설계 콘크리트 강도 확보',
    kind: '구조',
    detail: "f'c 18.4 → 21 MPa",
    patch: { fck: 21 }
  },
  {
    id: 'drop',
    label: '⑥ 드롭패널 신설',
    kind: '구조',
    detail: '없음 → 3000×100 mm, 기둥부 유효깊이 410 → 510 mm',
    patch: { dropPanel: true, dropPanelSize: 3000, dropPanelThickness: 100, effectiveDepth: 510 }
  },
  {
    id: 'shear',
    label: '⑦ 펀칭전단 보강 추가',
    kind: '구조',
    detail: '스터드/스터럽 보강량 비율 0.8',
    patch: { shearReinf: true, shearReinfRatio: 0.8 }
  }
];

export interface PathRow {
  id: string;
  label: string;
  kind: '하중' | '구조' | '기준';
  detail: string;
  dcrDesign: number;
  dcrService: number;
  vuService: number;
  vcService: number;
}

export function improvementPath(base?: Params): PathRow[] {
  let p = { ...(base ?? PRESETS.A.params) };
  const rows: PathRow[] = [];

  const push = (id: string, label: string, kind: PathRow['kind'], detail: string) => {
    const design = analyze(withMode(p, 'design'));
    const service = analyze(withMode(p, 'service'));
    rows.push({
      id,
      label,
      kind,
      detail,
      dcrDesign: design.dcr,
      dcrService: service.dcr,
      vuService: service.vu,
      vcService: service.vc
    });
  };

  push('base', '기준 : 실제로 있었던 조건', '기준', '조사자료에서 언급된 시공 조건 + 용도 변경 + 국부 추가하중');
  for (const s of IMPROVEMENT_STEPS) {
    p = { ...p, ...s.patch };
    push(s.id, s.label, s.kind, s.detail);
  }
  return rows;
}
