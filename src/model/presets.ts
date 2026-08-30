import { Params } from './types';

export type PresetKey = 'A' | 'B' | 'C';

export interface Preset {
  key: PresetKey;
  label: string;
  short: string;
  color: string;
  summary: string;
  /** 이 프리셋 값이 어디서 왔는지에 대한 솔직한 출처 표시 */
  provenance: string;
  params: Params;
}

/**
 * 공통 기본값.
 * 경간(spanX, spanY)과 하중 값은 공개된 조사자료에서 확정적으로 확인하지 못했기 때문에
 * 교육용 기본 가정값으로 두었습니다. (source-notes.md, limitations.md 참조)
 */
const base: Params = {
  spanX: 9000,
  spanY: 9000,
  columnDiameter: 600,
  effectiveDepth: 360,
  dropPanel: false,          // 무량판(플랫플레이트) : 기둥머리 드롭패널 없음
  dropPanelSize: 3000,       // 드롭패널을 켰을 때 쓰는 기본 치수
  dropPanelThickness: 100,
  fck: 18.4,
  fy: 400,
  topRebarRatio: 0.6,
  columnBars: 8,
  superDead: 4.5,
  liveLoad: 5.0,
  localExtraLoad: 3.0,
  usage: 'restaurant',
  shearReinf: false,
  shearReinfRatio: 0,
  code: 'ACI',
  loadMode: 'design',
  sizeEffect: true,
  momentFactor: 1.0,
  floorsAbove: 1
};

export const PRESETS: Record<PresetKey, Preset> = {
  A: {
    key: 'A',
    label: '삼풍 단순화 조건',
    short: 'A. 삼풍 단순화',
    color: '#f85149',
    summary:
      '조사자료에서 언급된 시공 단계의 조건을 단순화한 모델입니다. 기둥머리 드롭패널이 없는 무량판(플랫플레이트)으로 보고, 기둥 직경 600 mm, 콘크리트 압축강도 18.4 MPa, 유효깊이 약 360 mm, 용도 변경으로 늘어난 고정하중과 국부 추가하중을 함께 반영했습니다.',
    provenance:
      '기둥 직경 / 콘크리트 강도 / 유효깊이 / 기둥 주철근 개수는 과제에서 제시된 조사자료 값입니다. 구조형식은 드롭패널이 없는 무량판으로 두었습니다(사용자 확인 사항, source-notes.md 2.3 참조). 경간·하중 값은 확인하지 못해 교육용 가정값입니다.',
    params: { ...base }
  },
  B: {
    key: 'B',
    label: '구조계산 조건',
    short: 'B. 구조계산',
    color: '#d29922',
    summary:
      '구조계산서 단계의 조건입니다. 같은 무량판 형식에서 기둥 직경 800 mm, 콘크리트 압축강도 21 MPa, 유효깊이 약 410 mm, 기둥 주철근 16-HD22, 원설계 하중(일반 판매장)을 사용합니다.',
    provenance:
      '기둥 직경 / 콘크리트 강도 / 유효깊이 / 주철근 개수는 과제에서 제시된 조사자료 값입니다. 경간·하중 값은 A와 동일한 교육용 가정값 위에서 용도만 판매장으로 되돌린 것입니다.',
    params: {
      ...base,
      columnDiameter: 800,
      effectiveDepth: 410,
      fck: 21,
      columnBars: 16,
      topRebarRatio: 0.9,
      usage: 'retail',
      superDead: 1.5,
      liveLoad: 5.0,
      localExtraLoad: 0
    }
  },
  C: {
    key: 'C',
    label: '안전 개선 설계',
    short: 'C. 안전 개선',
    color: '#3fb950',
    summary:
      '같은 경간에서 펀칭전단 위험을 낮추는 방향으로 변수를 바꾼 가상의 개선안입니다. 없던 드롭패널을 새로 두어 기둥부 유효깊이를 키우고, 기둥 직경과 콘크리트 강도를 높이고, 펀칭전단 보강을 추가하고, 용도·국부 추가하중을 원설계 수준으로 되돌렸습니다.',
    provenance:
      '실제 어떤 설계안도 아니며, 변수 변화가 D/C에 주는 영향을 보여주기 위해 임의로 구성한 교육용 조합입니다.',
    params: {
      ...base,
      columnDiameter: 900,
      effectiveDepth: 500,
      dropPanel: true,
      dropPanelSize: 3600,
      dropPanelThickness: 150,
      fck: 30,
      columnBars: 20,
      topRebarRatio: 1.2,
      usage: 'retail',
      superDead: 1.5,
      liveLoad: 5.0,
      localExtraLoad: 0,
      shearReinf: true,
      shearReinfRatio: 0.8
    }
  }
};

export const PRESET_ORDER: PresetKey[] = ['A', 'B', 'C'];

export const defaultParams = (): Params => ({ ...PRESETS.A.params });
