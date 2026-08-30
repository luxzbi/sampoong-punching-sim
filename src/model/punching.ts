/**
 * 플랫슬래브 슬래브-기둥 접합부 펀칭전단 - 교육용 demand/capacity 모형
 *
 * 사용한 식은 모두 source-notes.md 에 출처(설계기준 조항)와 함께 기록되어 있습니다.
 * 공식을 임의로 만들지 않았으며, 코드 기준식을 단순화한 부분은 각 함수 주석과
 * source-notes.md 에 TODO / 한계로 명시했습니다.
 *
 * 단위 규약
 *   길이 mm,  면적(부담면적) m2,  응력 MPa(=N/mm2),  하중 kPa(=kN/m2),  힘 kN
 *
 * !! 교육용 비교 모형이며 실제 구조 안전진단이나 설계에 사용할 수 없습니다. !!
 */

import {
  CONCRETE_UNIT_WEIGHT,
  COVER_MM,
  HD22_AREA,
  Params,
  UsageKey,
  USAGES
} from './types';

export interface SectionCheck {
  /** 검토 단면 이름 */
  name: string;
  /** 위험단면 둘레 b0 또는 u1 (mm) */
  perimeter: number;
  /** 위험단면 둘레 산정식 (표시용) */
  perimeterExpr: string;
  /** 해당 단면의 유효깊이 (mm) */
  d: number;
  /** 위험단면 내부 면적 (m2) - 이 부분 하중은 기둥이 직접 받으므로 제외 */
  innerArea: number;
  /** 위험단면 바깥에서 전달되는 전단력 V (kN) */
  shearForce: number;
  /** 소요 전단력 Vu = V x 불균형모멘트 할증 (kN) */
  demandForce: number;
  /** 설계 전단내력 phi*Vc 또는 phi*Vn (kN) */
  capacityForce: number;
  /** 소요 전단응력 vu (MPa) */
  demand: number;
  /** 설계 전단강도 phi*vn (MPa) */
  capacity: number;
  /** 전단강도 산정식 (표시용) */
  capacityExpr: string;
  /** Vu / phiVn (= vu / phi*vn 과 동일) */
  dcr: number;
  /** 근거 조항 */
  note: string;
}

export interface LoadBreakdown {
  slabSelfWeight: number;
  dropPanelSelfWeight: number;
  superDead: number;
  totalDead: number;
  live: number;
  localExtra: number;
  /** 해석에 쓰인 등분포하중 (kPa) */
  w: number;
  comboLabel: string;
}

export interface ColumnAxialCheck {
  ag: number;
  ast: number;
  rho: number;
  capacity: number;
  demand: number;
  ratio: number;
}

export type RiskLevel = 'low' | 'caution' | 'risk';

/** 화면에 그대로 보여 주는 계산 과정 한 줄 */
export interface TraceLine {
  label: string;
  expr: string;
  value: string;
}

export interface AnalysisResult {
  d1: number;
  d2: number;
  slabThickness: number;
  tributaryArea: number;
  load: LoadBreakdown;
  checks: SectionCheck[];
  governing: SectionCheck;
  /** 지배 단면의 Vu (kN) */
  vu: number;
  /** 지배 단면의 phiVn (kN) */
  vc: number;
  dcr: number;
  dcrDesign: number;
  dcrService: number;
  vuDesign: number;
  vcDesign: number;
  vuService: number;
  vcService: number;
  columnAxial: ColumnAxialCheck;
  riskLevel: RiskLevel;
  trace: TraceLine[];
}

export const RISK_INFO: Record<RiskLevel, { label: string; color: string; desc: string }> = {
  low: {
    label: '상대적으로 낮음',
    color: '#3fb950',
    desc: 'D/C 0.0 ~ 0.7 : 이 단순화 모형 안에서는 여유가 있는 편으로 계산됩니다.'
  },
  caution: {
    label: '주의',
    color: '#d29922',
    desc: 'D/C 0.7 ~ 1.0 : 여유가 크지 않아 조건이 조금만 나빠져도 1.0을 넘어섭니다.'
  },
  risk: {
    label: '파괴 위험',
    color: '#f85149',
    desc: 'D/C 1.0 이상 : 이 모형의 가정 안에서는 저항보다 요구가 큰 상태입니다.'
  }
};

export function riskOf(dcr: number): RiskLevel {
  if (dcr < 0.7) return 'low';
  if (dcr < 1.0) return 'caution';
  return 'risk';
}

const f = (n: number, d = 2) =>
  n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ------------------------------------------------------------------ */
/* 기하 / 하중                                                          */
/* ------------------------------------------------------------------ */

/** 드롭패널 바깥 슬래브의 유효깊이 d2 (mm) */
export function slabEffectiveDepth(p: Params): number {
  const drop = p.dropPanel ? p.dropPanelThickness : 0;
  return Math.max(120, p.effectiveDepth - drop);
}

/** 3D 표현과 자중 계산에 쓰는 슬래브 전체 두께 (mm) */
export function slabThicknessOf(p: Params): number {
  return slabEffectiveDepth(p) + COVER_MM;
}

/** 내부기둥 1개가 부담하는 면적 (m2) */
export function tributaryAreaOf(p: Params): number {
  return (p.spanX / 1000) * (p.spanY / 1000);
}

/**
 * 하중 산정
 * - 슬래브 자중은 두께로부터 자동 계산 (24 kN/m3)
 * - 드롭패널 자중은 부담면적 전체로 평균화하여 등분포로 환산
 * - design  : 1.2D + 1.6L (강도설계법 계수하중)
 * - service : 1.0D + 1.0L (사용하중, 붕괴 당시 상태를 거칠게 추정)
 */
export function computeLoads(p: Params, mode: 'design' | 'service'): LoadBreakdown {
  const h = slabThicknessOf(p) / 1000;
  const slabSelf = h * CONCRETE_UNIT_WEIGHT;

  let dropSelf = 0;
  if (p.dropPanel && p.dropPanelThickness > 0) {
    const dropArea = Math.pow(p.dropPanelSize / 1000, 2);
    const trib = tributaryAreaOf(p);
    dropSelf = ((p.dropPanelThickness / 1000) * CONCRETE_UNIT_WEIGHT * dropArea) / trib;
  }

  const totalDead = slabSelf + dropSelf + p.superDead;
  // 국부 추가하중(설비, 적치물 등)은 고정하중으로 취급한다.
  const deadWithExtra = totalDead + p.localExtraLoad;

  const w =
    mode === 'design'
      ? 1.2 * deadWithExtra + 1.6 * p.liveLoad
      : 1.0 * deadWithExtra + 1.0 * p.liveLoad;

  return {
    slabSelfWeight: slabSelf,
    dropPanelSelfWeight: dropSelf,
    superDead: p.superDead,
    totalDead,
    live: p.liveLoad,
    localExtra: p.localExtraLoad,
    w,
    comboLabel: mode === 'design' ? '1.2D + 1.6L (계수하중)' : '1.0D + 1.0L (사용하중)'
  };
}

/* ------------------------------------------------------------------ */
/* ACI 318-19 방식                                                      */
/* ------------------------------------------------------------------ */

/** ACI 318-19 (22.5.5.1.3) 크기효과계수 lambda_s */
export function sizeEffectFactor(d: number, enabled: boolean): number {
  if (!enabled) return 1.0;
  return Math.min(1.0, Math.sqrt(2 / (1 + 0.004 * d)));
}

/**
 * ACI 318-19 (22.6.5.2) 2방향(펀칭) 전단강도 vc - 전단보강 없음, 보통중량 콘크리트
 * 원형 기둥이므로 beta = 1, 내부기둥이므로 alpha_s = 40.
 * 세 식 중 최솟값을 취한다.
 */
export function aciVc(fck: number, d: number, b0: number, sizeEffect: boolean): number {
  const lam = 1.0;
  const ls = sizeEffectFactor(d, sizeEffect);
  const beta = 1.0;
  const alphaS = 40;
  const rootF = Math.sqrt(fck);
  const a = 0.33;
  const b = 0.17 * (1 + 2 / beta);
  const c = 0.083 * (2 + (alphaS * d) / b0);
  return ls * lam * Math.min(a, b, c) * rootF;
}

/** 위 세 식 중 어느 것이 지배했는지 (표시용) */
export function aciVcGoverningTerm(fck: number, d: number, b0: number): string {
  const beta = 1.0;
  const a = 0.33;
  const b = 0.17 * (1 + 2 / beta);
  const c = 0.083 * (2 + (40 * d) / b0);
  const min = Math.min(a, b, c);
  if (min === a) return '0.33';
  if (min === b) return '0.17(1+2/β)';
  return '0.083(2+αs·d/b₀)';
}

/**
 * 전단보강이 있을 때의 공칭강도 (ACI 318-19 22.6.6 을 단순화)
 *  - 보강이 있으면 콘크리트 분담을 0.17*lambda_s*sqrt(fck) 로 낮추고 (22.6.6.1)
 *  - vs 를 보강량 비율(0~1) x 0.33*sqrt(fck) 로 표현하며
 *  - 전체를 0.5*sqrt(fck) (스터럽 상한, 22.6.6.3) 으로 제한한다.
 *
 * TODO(한계) : 실제로는 vs = Av*fyt/(b0*s) 로 배근량·간격에서 계산해야 한다.
 *              여기서는 배근 입력을 받지 않고 0~1 비율로 단순화했다.
 */
export function aciVnWithShearReinf(
  fck: number,
  d: number,
  ratio: number,
  sizeEffect: boolean
): number {
  const ls = sizeEffectFactor(d, sizeEffect);
  const rootF = Math.sqrt(fck);
  const vc = 0.17 * ls * rootF;
  const vs = Math.max(0, Math.min(1, ratio)) * 0.33 * rootF;
  return Math.min(vc + vs, 0.5 * rootF);
}

/* ------------------------------------------------------------------ */
/* Eurocode 2 방식 (상부철근비의 영향을 보기 위한 보조 옵션)              */
/* ------------------------------------------------------------------ */

/** EC2 6.4.4 (1) v_Rd,c */
export function ec2VRdc(fck: number, d: number, rhoPercent: number): number {
  const gammaC = 1.5;
  const cRdc = 0.18 / gammaC;
  const k = Math.min(2.0, 1 + Math.sqrt(200 / d));
  const rho = Math.min(0.02, Math.max(0.0001, rhoPercent / 100));
  const main = cRdc * k * Math.cbrt(100 * rho * fck);
  const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
  return Math.max(main, vmin);
}

/**
 * EC2 6.4.5 (1) 전단보강 반영 - 크게 단순화함
 * TODO(한계) : 정식은 0.75 v_Rd,c + 1.5(d/sr)Asw*fywd,ef/(u1*d) 이며 배근량이 필요하다.
 */
export function ec2VRdcs(vRdc: number, ratio: number): number {
  const r = Math.max(0, Math.min(1, ratio));
  return 0.75 * vRdc + r * 1.0 * vRdc;
}

/** EC2 6.4.5 (3) 기둥면 최대 전단응력 상한 v_Rd,max */
export function ec2VRdMax(fck: number): number {
  const nu = 0.6 * (1 - fck / 250);
  const fcd = fck / 1.5;
  return 0.5 * nu * fcd;
}

/* ------------------------------------------------------------------ */
/* 위험단면 검토                                                         */
/* ------------------------------------------------------------------ */

function mkCheck(args: {
  name: string;
  perimeter: number;
  perimeterExpr: string;
  d: number;
  innerArea: number;
  w: number;
  trib: number;
  momentFactor: number;
  capMPa: number;
  capacityExpr: string;
  note: string;
}): SectionCheck {
  const V = Math.max(0, args.w * (args.trib - args.innerArea)); // kN
  const Vu = V * args.momentFactor; // kN
  const vu = (Vu * 1000) / (args.perimeter * args.d); // MPa
  const Vcap = (args.capMPa * args.perimeter * args.d) / 1000; // kN
  return {
    name: args.name,
    perimeter: args.perimeter,
    perimeterExpr: args.perimeterExpr,
    d: args.d,
    innerArea: args.innerArea,
    shearForce: V,
    demandForce: Vu,
    capacityForce: Vcap,
    demand: vu,
    capacity: args.capMPa,
    capacityExpr: args.capacityExpr,
    dcr: Vcap > 0 ? Vu / Vcap : Infinity,
    note: args.note
  };
}

function makeChecks(p: Params, w: number, phi: number): SectionCheck[] {
  const d1 = p.effectiveDepth;
  const d2 = slabEffectiveDepth(p);
  const trib = tributaryAreaOf(p);
  const D = p.columnDiameter;
  const checks: SectionCheck[] = [];
  const mf = p.momentFactor;

  if (p.code === 'ACI') {
    /* (1) 기둥 주변 위험단면 : 기둥면에서 d/2 떨어진 원형 둘레 */
    const b0 = Math.PI * (D + d1);
    const innerA = (Math.PI / 4) * Math.pow((D + d1) / 1000, 2);
    const ls = sizeEffectFactor(d1, p.sizeEffect);
    const vn = p.shearReinf
      ? aciVnWithShearReinf(p.fck, d1, p.shearReinfRatio, p.sizeEffect)
      : aciVc(p.fck, d1, b0, p.sizeEffect);
    checks.push(
      mkCheck({
        name: '기둥 주변 위험단면 (d/2)',
        perimeter: b0,
        perimeterExpr: `b₀ = π(D + d₁) = π(${f(D, 0)} + ${f(d1, 0)})`,
        d: d1,
        innerArea: innerA,
        w,
        trib,
        momentFactor: mf,
        capMPa: phi * vn,
        capacityExpr: p.shearReinf
          ? `φvₙ = ${f(phi, 2)} × [0.17·λs·√f'c + ${f(p.shearReinfRatio, 2)}×0.33·√f'c] (≤ 0.5√f'c)`
          : `φvc = ${f(phi, 2)} × ${aciVcGoverningTerm(p.fck, d1, b0)}·λs·√f'c,  λs = ${f(ls, 3)}`,
        note: p.shearReinf
          ? 'ACI 318-19 22.6.6 (전단보강, 단순화)'
          : 'ACI 318-19 22.6.5.2'
      })
    );

    /* (2) 드롭패널 외곽 위험단면 : 슬래브가 다시 얇아지는 위치 */
    if (p.dropPanel && p.dropPanelThickness > 0) {
      const side = p.dropPanelSize + d2;
      const b0d = 4 * side;
      const lsd = sizeEffectFactor(d2, p.sizeEffect);
      checks.push(
        mkCheck({
          name: '드롭패널 외곽 위험단면 (d/2)',
          perimeter: b0d,
          perimeterExpr: `b₀ = 4(L_drop + d₂) = 4(${f(p.dropPanelSize, 0)} + ${f(d2, 0)})`,
          d: d2,
          innerArea: Math.pow(side / 1000, 2),
          w,
          trib,
          momentFactor: mf,
          capMPa: phi * aciVc(p.fck, d2, b0d, p.sizeEffect),
          capacityExpr: `φvc = ${f(phi, 2)} × ${aciVcGoverningTerm(
            p.fck,
            d2,
            b0d
          )}·λs·√f'c,  λs = ${f(lsd, 3)}`,
          note: 'ACI 318-19 22.6.5.2 (슬래브 두께 기준)'
        })
      );
    }
  } else {
    /* EC2 : 기둥면에서 2d 떨어진 기본둘레 u1 */
    const u1 = Math.PI * (D + 4 * d1);
    const base = ec2VRdc(p.fck, d1, p.topRebarRatio);
    const vRd = p.shearReinf ? ec2VRdcs(base, p.shearReinfRatio) : base;
    checks.push(
      mkCheck({
        name: '기본둘레 u₁ (2d)',
        perimeter: u1,
        perimeterExpr: `u₁ = π(D + 4d₁) = π(${f(D, 0)} + 4×${f(d1, 0)})`,
        d: d1,
        innerArea: (Math.PI / 4) * Math.pow((D + 4 * d1) / 1000, 2),
        w,
        trib,
        momentFactor: mf,
        capMPa: vRd,
        capacityExpr: p.shearReinf
          ? `v_Rd,cs = 0.75·v_Rd,c + ${f(p.shearReinfRatio, 2)}·v_Rd,c (단순화)`
          : `v_Rd,c = (0.18/1.5)·k·(100ρl·fck)^⅓,  ρl = ${f(p.topRebarRatio, 2)}%`,
        note: 'EN 1992-1-1 6.4.4'
      })
    );

    /* 기둥면 u0 최대 전단응력 상한 */
    const u0 = Math.PI * D;
    checks.push(
      mkCheck({
        name: '기둥면 둘레 u₀ (최대전단)',
        perimeter: u0,
        perimeterExpr: `u₀ = πD = π×${f(D, 0)}`,
        d: d1,
        innerArea: (Math.PI / 4) * Math.pow(D / 1000, 2),
        w,
        trib,
        momentFactor: mf,
        capMPa: ec2VRdMax(p.fck),
        capacityExpr: `v_Rd,max = 0.5·ν·fcd,  ν = 0.6(1 − fck/250)`,
        note: 'EN 1992-1-1 6.4.5(3)'
      })
    );

    if (p.dropPanel && p.dropPanelThickness > 0) {
      const side = p.dropPanelSize + 4 * d2;
      checks.push(
        mkCheck({
          name: '드롭패널 외곽 둘레 (2d)',
          perimeter: 4 * side,
          perimeterExpr: `u = 4(L_drop + 4d₂) = 4(${f(p.dropPanelSize, 0)} + 4×${f(d2, 0)})`,
          d: d2,
          innerArea: Math.pow(side / 1000, 2),
          w,
          trib,
          momentFactor: mf,
          capMPa: ec2VRdc(p.fck, d2, p.topRebarRatio),
          capacityExpr: `v_Rd,c = (0.18/1.5)·k·(100ρl·fck)^⅓ (슬래브 두께 기준)`,
          note: 'EN 1992-1-1 6.4.4'
        })
      );
    }
  }

  return checks;
}

function columnAxial(p: Params, w: number, phi: number): ColumnAxialCheck {
  const ag = (Math.PI / 4) * Math.pow(p.columnDiameter, 2);
  const ast = p.columnBars * HD22_AREA;
  // ACI 318 22.4.2.1 : Pn,max = 0.80 [ 0.85 f'c (Ag - Ast) + fy Ast ]  (띠철근 기둥)
  const pnMax = 0.8 * (0.85 * p.fck * (ag - ast) + p.fy * ast);
  const cap = ((phi === 1 ? 1 : 0.65) * pnMax) / 1000;
  const demand = w * tributaryAreaOf(p) * p.floorsAbove;
  return { ag, ast, rho: (ast / ag) * 100, capacity: cap, demand, ratio: demand / cap };
}

function analyzeWithMode(p: Params, mode: 'design' | 'service') {
  const load = computeLoads(p, mode);
  const phi = mode === 'design' ? 0.75 : 1.0;
  const checks = makeChecks(p, load.w, phi);
  const governing = checks.reduce((a, b) => (b.dcr > a.dcr ? b : a), checks[0]);
  return { load, checks, governing, phi };
}

/** 화면에 그대로 보여 줄 계산 과정 (지배 단면 기준) */
function buildTrace(p: Params, load: LoadBreakdown, g: SectionCheck, phi: number): TraceLine[] {
  const trib = tributaryAreaOf(p);
  return [
    {
      label: '① 위험단면 둘레',
      expr: g.perimeterExpr,
      value: `${f(g.perimeter, 0)} mm`
    },
    {
      label: '② 유효깊이',
      expr: g.d === p.effectiveDepth ? 'd₁ (드롭패널 포함)' : 'd₂ = d₁ − 드롭패널 두께',
      value: `${f(g.d, 0)} mm`
    },
    {
      label: '③ 단위 전단강도',
      expr: g.capacityExpr,
      value: `${f(g.capacity, 3)} MPa`
    },
    {
      label: '④ 설계 전단내력',
      expr: `φVn = φvn × b₀ × d = ${f(g.capacity, 3)} × ${f(g.perimeter, 0)} × ${f(g.d, 0)}`,
      value: `${f(g.capacityForce, 0)} kN`
    },
    {
      label: '⑤ 등분포하중',
      expr: `w = ${load.comboLabel}`,
      value: `${f(load.w, 2)} kPa`
    },
    {
      label: '⑥ 부담면적',
      expr: `A = ${f(p.spanX / 1000, 1)} × ${f(p.spanY / 1000, 1)} − A(위험단면 내부) = ${f(
        trib,
        2
      )} − ${f(g.innerArea, 2)}`,
      value: `${f(trib - g.innerArea, 2)} m²`
    },
    {
      label: '⑦ 소요 전단력',
      expr:
        p.momentFactor === 1
          ? `Vu = w × A = ${f(load.w, 2)} × ${f(trib - g.innerArea, 2)}`
          : `Vu = w × A × ${f(p.momentFactor, 2)}(모멘트 할증)`,
      value: `${f(g.demandForce, 0)} kN`
    },
    {
      label: '⑧ 판정',
      expr: `D/C = Vu / φVn = ${f(g.demandForce, 0)} / ${f(g.capacityForce, 0)}`,
      value: g.dcr.toFixed(2)
    }
  ];
}

export function analyze(p: Params): AnalysisResult {
  const main = analyzeWithMode(p, p.loadMode);
  const design = analyzeWithMode(p, 'design');
  const service = analyzeWithMode(p, 'service');

  return {
    d1: p.effectiveDepth,
    d2: slabEffectiveDepth(p),
    slabThickness: slabThicknessOf(p),
    tributaryArea: tributaryAreaOf(p),
    load: main.load,
    checks: main.checks,
    governing: main.governing,
    vu: main.governing.demandForce,
    vc: main.governing.capacityForce,
    dcr: main.governing.dcr,
    dcrDesign: design.governing.dcr,
    dcrService: service.governing.dcr,
    vuDesign: design.governing.demandForce,
    vcDesign: design.governing.capacityForce,
    vuService: service.governing.demandForce,
    vcService: service.governing.capacityForce,
    columnAxial: columnAxial(p, main.load.w, main.phi),
    riskLevel: riskOf(main.governing.dcr),
    trace: buildTrace(p, main.load, main.governing, main.phi)
  };
}

/** 용도를 바꿨을 때 하중이 어떻게 변하는지 비교 */
export function usageDelta(from: UsageKey, to: UsageKey) {
  const a = USAGES[from];
  const b = USAGES[to];
  return {
    deadDelta: b.superDead - a.superDead,
    liveDelta: b.live - a.live,
    from: a,
    to: b
  };
}
