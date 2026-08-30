/**
 * 교육용 단순화 모델 - 변수 정의
 * 실제 구조 안전진단을 대체하지 않습니다.
 */

export type CodeOption = 'ACI' | 'EC2';
export type LoadMode = 'design' | 'service';
export type UsageKey = 'retail' | 'restaurant' | 'office' | 'storage';

export interface UsageInfo {
  key: UsageKey;
  label: string;
  /** 마감·설비 등 추가 고정하중 (슬래브 자중 제외), kPa */
  superDead: number;
  /** 설계 활하중, kPa */
  live: number;
  note: string;
}

/** 용도별 하중은 국내 건축구조기준(KDS 41)의 일반적인 값을 참고한 '교육용 대표값'입니다. */
export const USAGES: Record<UsageKey, UsageInfo> = {
  retail: {
    key: 'retail',
    label: '일반 상업시설(판매장)',
    superDead: 1.5,
    live: 5.0,
    note: '바닥 마감과 천장·설비 정도의 추가 고정하중을 가정합니다.'
  },
  restaurant: {
    key: 'restaurant',
    label: '식당가(주방·온돌·조적 칸막이)',
    superDead: 4.5,
    live: 5.0,
    note: '주방 설비, 두꺼운 모르타르/온돌 마감, 조적 칸막이 때문에 고정하중이 크게 늘어납니다.'
  },
  office: {
    key: 'office',
    label: '사무실',
    superDead: 1.2,
    live: 2.5,
    note: '가벼운 마감과 상대적으로 작은 활하중을 가정합니다.'
  },
  storage: {
    key: 'storage',
    label: '창고·기계실',
    superDead: 2.0,
    live: 7.5,
    note: '적재물과 기계 설비 때문에 활하중이 큽니다.'
  }
};

export interface Params {
  /** 기둥 중심 간격 X (mm) */
  spanX: number;
  /** 기둥 중심 간격 Y (mm) */
  spanY: number;
  /** 원형 기둥 직경 (mm) */
  columnDiameter: number;
  /** 기둥부(드롭패널 포함) 유효깊이 d1 (mm) */
  effectiveDepth: number;
  /** 드롭패널 유무 */
  dropPanel: boolean;
  /** 드롭패널 한 변 길이 (mm, 정사각형 가정) */
  dropPanelSize: number;
  /** 드롭패널 추가 두께 (mm) */
  dropPanelThickness: number;
  /** 콘크리트 설계기준압축강도 f'c (MPa) */
  fck: number;
  /** 철근 항복강도 fy (MPa) */
  fy: number;
  /** 기둥 주변 상부 인장철근비 rho_l (%) */
  topRebarRatio: number;
  /** 기둥 주철근 개수 (HD22 기준) */
  columnBars: number;
  /** 마감·설비 등 추가 고정하중 (kPa, 슬래브 자중 제외) */
  superDead: number;
  /** 활하중 (kPa) */
  liveLoad: number;
  /** 국부 추가하중 (kPa) - 설비/냉각탑/적치물 등 */
  localExtraLoad: number;
  /** 용도 */
  usage: UsageKey;
  /** 펀칭전단 보강 유무 */
  shearReinf: boolean;
  /** 펀칭전단 보강량 (0~1, 상대적 비율) */
  shearReinfRatio: number;
  /** 적용 기준식 */
  code: CodeOption;
  /** 하중 모드 */
  loadMode: LoadMode;
  /** ACI 318-19 크기효과계수 적용 여부 */
  sizeEffect: boolean;
  /** 불균형 모멘트 전달에 의한 전단응력 할증 계수 (1.0 = 무시) */
  momentFactor: number;
  /** 기둥 축력 검토용, 이 기둥이 지지하는 층 수 */
  floorsAbove: number;
}

export const COVER_MM = 40;           // 유효깊이 -> 전체두께 환산용 피복+철근 반지름 가정
export const CONCRETE_UNIT_WEIGHT = 24; // kN/m3
export const HD22_AREA = 387;          // mm2 (D22 공칭단면적)

export const LIMITS = {
  spanX: { min: 6000, max: 12000, step: 100 },
  spanY: { min: 6000, max: 12000, step: 100 },
  columnDiameter: { min: 500, max: 1000, step: 10 },
  effectiveDepth: { min: 300, max: 500, step: 5 },
  dropPanelSize: { min: 1500, max: 5000, step: 100 },
  dropPanelThickness: { min: 0, max: 250, step: 10 },
  fck: { min: 15, max: 40, step: 0.1 },
  topRebarRatio: { min: 0.2, max: 2.0, step: 0.05 },
  columnBars: { min: 4, max: 32, step: 2 },
  superDead: { min: 0, max: 10, step: 0.1 },
  liveLoad: { min: 0, max: 12, step: 0.1 },
  localExtraLoad: { min: 0, max: 12, step: 0.1 },
  shearReinfRatio: { min: 0, max: 1, step: 0.05 },
  momentFactor: { min: 1.0, max: 1.5, step: 0.05 },
  floorsAbove: { min: 1, max: 6, step: 1 }
} as const;
