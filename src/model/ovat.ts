import { Params } from './types';
import { PRESETS } from './presets';
import { analyze } from './punching';

export interface OvatCase {
  id: string;
  label: string;
  /** 무엇을 바꿨는지 한 줄 설명 */
  change: string;
  /** 기준 모델에 덮어쓸 값 */
  override: Partial<Params>;
  /** 이 변화가 왜 D/C에 영향을 주는지 (교육용 설명) */
  reason: string;
}

/**
 * One Variable at a Time 실험 정의.
 * 기준 모델은 Scenario A(삼풍 단순화 조건)이며, 한 번에 하나씩만 바꾼다.
 * 마지막 case 는 모든 변화를 동시에 적용한 경우이다.
 */
export const OVAT_CASES: OvatCase[] = [
  {
    id: 'base',
    label: '기준 (Scenario A)',
    change: '변경 없음',
    override: {},
    reason: '비교의 출발점이 되는 상태입니다.'
  },
  {
    id: 'column',
    label: '기둥 600 → 800 mm',
    change: 'columnDiameter: 600 → 800 mm',
    override: { columnDiameter: 800 },
    reason:
      '기둥이 굵어지면 기둥면에서 d/2 떨어진 위험단면의 둘레 b0 가 길어져, 같은 전단력이 더 넓은 면적으로 분산됩니다.'
  },
  {
    id: 'depth',
    label: '유효깊이 360 → 410 mm',
    change: 'effectiveDepth: 360 → 410 mm',
    override: { effectiveDepth: 410 },
    reason:
      '유효깊이 d 가 커지면 위험단면 면적(b0 x d)이 커집니다. 다만 슬래브가 두꺼워져 자중도 함께 늘고, ACI 318-19 의 크기효과계수 때문에 강도 증가폭이 깎이므로 효과가 생각보다 작게 나옵니다.'
  },
  {
    id: 'fck',
    label: '콘크리트 18.4 → 21 MPa',
    change: "fck: 18.4 → 21 MPa",
    override: { fck: 21 },
    reason:
      '펀칭전단 강도는 압축강도의 제곱근에 비례합니다. 강도를 14% 올려도 저항은 약 7%만 늘어납니다.'
  },
  {
    id: 'noextra',
    label: '국부 추가하중 제거',
    change: 'localExtraLoad: 3.0 → 0 kPa',
    override: { localExtraLoad: 0 },
    reason:
      '접합부가 부담하는 전단력 자체를 줄이는 변화입니다. 저항을 키우는 것이 아니라 요구를 줄이는 방향입니다.'
  },
  {
    id: 'usage',
    label: '용도 되돌리기 (식당가 → 판매장)',
    change: 'usage: 식당가 → 판매장, superDead 4.5 → 1.5 kPa',
    override: { usage: 'retail', superDead: 1.5 },
    reason:
      '용도 변경으로 늘어난 마감·설비 고정하중을 원래대로 되돌리는 경우입니다. 고정하중은 계수하중에서 1.2배로 곱해지기 때문에 영향이 큽니다.'
  },
  {
    id: 'loadsOnly',
    label: '하중만 원설계 수준으로',
    change: '용도 복원 + 국부 추가하중 제거 (구조 단면은 그대로)',
    override: { usage: 'retail', superDead: 1.5, localExtraLoad: 0 },
    reason:
      '기둥과 슬래브는 시공된 그대로 두고, 하중만 원래 설계가 가정한 수준으로 되돌린 경우입니다. 엄밀히는 변수 두 개를 함께 바꾼 것이지만, 건물이 한동안 서 있다가 무너진 과정을 이해하는 데 핵심이 되는 조합이라 따로 두었습니다.'
  },
  {
    id: 'drop',
    label: '드롭패널 신설',
    change: '없음 → 3000×100 mm (기둥부 유효깊이 360 → 460 mm)',
    override: { dropPanel: true, dropPanelSize: 3000, dropPanelThickness: 100, effectiveDepth: 460 },
    reason:
      '삼풍 조건은 기둥머리에 드롭패널이 없는 무량판입니다. 드롭패널을 새로 두면 기둥부 두께가 100 mm 늘어 b₀ = π(D + d) 와 위험단면 면적 b₀·d 가 함께 커집니다. 대신 드롭패널이 끝나는 위치에 두 번째 위험단면이 새로 생기므로 그쪽도 함께 검토합니다.'
  },
  {
    id: 'shear',
    label: '펀칭전단 보강 추가',
    change: 'shearReinf: 없음 → 있음 (보강량 비율 0.8)',
    override: { shearReinf: true, shearReinfRatio: 0.8 },
    reason:
      '전단보강근이 있으면 콘크리트만으로 저항할 때보다 높은 전단응력까지 견딜 수 있고, 파괴가 갑작스럽게 일어나는 성질도 완화됩니다.'
  },
  {
    id: 'all',
    label: '모든 개선안 동시 적용',
    change: '위 변화를 모두 함께 적용',
    override: {
      columnDiameter: 800,
      effectiveDepth: 510,
      fck: 21,
      localExtraLoad: 0,
      usage: 'retail',
      superDead: 1.5,
      dropPanel: true,
      dropPanelSize: 3000,
      dropPanelThickness: 100,
      shearReinf: true,
      shearReinfRatio: 0.8
    },
    reason:
      '개별 변수 하나를 바꾸는 것보다, 요구를 줄이는 변화와 저항을 키우는 변화를 함께 적용했을 때 효과가 큽니다.'
  }
];

export interface OvatRow {
  id: string;
  label: string;
  change: string;
  reason: string;
  dcr: number;
  dcrDesign: number;
  dcrService: number;
  delta: number;
  deltaPercent: number;
  governing: string;
}

export function runOvat(baseParams?: Params): OvatRow[] {
  const root = baseParams ?? PRESETS.A.params;
  const baseDcr = analyze(root).dcr;

  return OVAT_CASES.map((c) => {
    const r = analyze({ ...root, ...c.override });
    return {
      id: c.id,
      label: c.label,
      change: c.change,
      reason: c.reason,
      dcr: r.dcr,
      dcrDesign: r.dcrDesign,
      dcrService: r.dcrService,
      delta: r.dcr - baseDcr,
      deltaPercent: ((r.dcr - baseDcr) / baseDcr) * 100,
      governing: r.governing.name
    };
  });
}
