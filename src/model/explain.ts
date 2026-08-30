import { Params, USAGES } from './types';
import { AnalysisResult, analyze } from './punching';

export type Direction = 'better' | 'worse' | 'neutral';

/** 한 변수만 바꿨을 때 Demand / Capacity / D-C 가 각각 몇 % 변했는가 */
export interface IsolatedEffect {
  dcr: number;
  vu: number;
  vc: number;
}

export interface ExplanationCard {
  id: string;
  title: string;
  direction: Direction;
  effect?: IsolatedEffect;
  /** Demand 가 변한 것인지 Capacity 가 변한 것인지 자동 서술 */
  attribution?: string;
  text: string;
}

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const pct = (after: number, before: number) => ((after - before) / before) * 100;
const sign = (n: number) => (n >= 0 ? '+' : '');

/** 기준 상태에서 한 변수만 현재 값으로 바꿨을 때의 영향 */
function isolatedEffect(baseline: Params, key: keyof Params, current: Params): IsolatedEffect {
  const b = analyze(baseline);
  const a = analyze({ ...baseline, [key]: current[key] } as Params);
  return {
    dcr: pct(a.dcr, b.dcr),
    vu: pct(a.vu, b.vu),
    vc: pct(a.vc, b.vc)
  };
}

/** Vu / phiVn 중 무엇이 움직였는지 한국어로 서술 */
function attributionOf(e: IsolatedEffect): string {
  const near0 = (x: number) => Math.abs(x) < 0.5;
  const dPart = `소요 전단력 Vu ${sign(e.vu)}${e.vu.toFixed(1)}%`;
  const cPart = `설계 전단내력 φVn ${sign(e.vc)}${e.vc.toFixed(1)}%`;
  const rPart = `→ D/C ${sign(e.dcr)}${e.dcr.toFixed(1)}%`;

  if (near0(e.vu) && near0(e.vc)) return '이 변경만으로는 Vu 와 φVn 이 거의 변하지 않습니다.';
  if (near0(e.vu)) return `저항 쪽이 움직입니다 : ${cPart} (Vu 는 거의 그대로) ${rPart}`;
  if (near0(e.vc)) return `요구 쪽이 움직입니다 : ${dPart} (φVn 은 그대로) ${rPart}`;
  return `요구와 저항이 함께 움직입니다 : ${dPart}, ${cPart} ${rPart}`;
}

function dirOf(delta: number): Direction {
  if (delta < -0.5) return 'better';
  if (delta > 0.5) return 'worse';
  return 'neutral';
}

/**
 * 기준(baseline) 대비 현재 설정에서 바뀐 변수들에 대해 한국어 설명 카드를 만든다.
 * 표현 원칙: 방향성과 계산상의 근거만 설명하고, 안전을 보장한다는 식의 표현은 쓰지 않는다.
 */
export function explainChanges(baseline: Params, current: Params): ExplanationCard[] {
  const cards: ExplanationCard[] = [];

  const add = (id: string, key: keyof Params | null, title: string, text: string) => {
    if (!key) {
      cards.push({ id, title, direction: 'neutral', text });
      return;
    }
    const effect = isolatedEffect(baseline, key, current);
    cards.push({
      id,
      title,
      direction: dirOf(effect.dcr),
      effect,
      attribution: attributionOf(effect),
      text
    });
  };

  if (current.columnDiameter !== baseline.columnDiameter) {
    const up = current.columnDiameter > baseline.columnDiameter;
    add(
      'columnDiameter',
      'columnDiameter',
      `기둥 직경 ${fmt(baseline.columnDiameter)} → ${fmt(current.columnDiameter)} mm`,
      up
        ? '기둥 직경이 증가하여 슬래브-기둥 접합부의 임계둘레 b₀ = π(D + d) 가 길어졌고, 전단이 전달되는 위험단면 면적(b₀·d)이 커져 펀칭전단 저항능력 φVn 이 증가했습니다. 기둥 압축 단면적이 아니라 임계둘레가 커지는 것이 펀칭전단에서 핵심입니다.'
        : '기둥 직경이 줄어들어 임계둘레 b₀ = π(D + d) 가 짧아졌고, 같은 전단력이 더 좁은 위험단면에 집중되어 펀칭전단 저항능력 φVn 이 감소했습니다.'
    );
  }

  if (current.effectiveDepth !== baseline.effectiveDepth) {
    const up = current.effectiveDepth > baseline.effectiveDepth;
    add(
      'effectiveDepth',
      'effectiveDepth',
      `기둥부 유효깊이 ${fmt(baseline.effectiveDepth)} → ${fmt(current.effectiveDepth)} mm`,
      up
        ? '유효깊이 d 가 커지면 위험단면 면적(b₀·d)과 임계둘레 b₀ = π(D + d) 가 함께 커져 φVn 이 증가합니다. 다만 이 모형에서는 슬래브가 두꺼워지면서 자중이 늘어 Vu 도 함께 증가하고, ACI 318-19 의 크기효과계수 λs 가 두꺼운 부재의 단위강도를 낮추기 때문에 순수 이득이 예상보다 작게 계산됩니다.'
        : '유효깊이가 줄면 위험단면 면적(b₀·d)이 작아져 φVn 이 감소합니다.'
    );
  }

  if (Math.abs(current.fck - baseline.fck) > 0.01) {
    const up = current.fck > baseline.fck;
    add(
      'fck',
      'fck',
      `콘크리트 압축강도 ${baseline.fck} → ${current.fck} MPa`,
      up
        ? `펀칭전단 강도식 vc = 0.33·λs·√f'c 에서 저항은 압축강도의 제곱근에 비례합니다. f'c 를 ${(
            ((current.fck - baseline.fck) / baseline.fck) *
            100
          ).toFixed(0)}% 올리면 φVn 은 약 ${(
            (Math.sqrt(current.fck / baseline.fck) - 1) *
            100
          ).toFixed(0)}% 증가합니다. 요구 Vu 는 변하지 않습니다.`
        : "설계강도보다 낮은 콘크리트가 사용되면 √f'c 에 비례해 φVn 이 줄어듭니다. 시공 품질 관리가 저항에 직접 반영되는 변수입니다."
    );
  }

  if (current.dropPanel !== baseline.dropPanel) {
    add(
      'dropPanelOn',
      'dropPanel',
      `드롭패널 ${current.dropPanel ? '없음 → 있음' : '있음 → 없음'}`,
      current.dropPanel
        ? '드롭패널은 기둥 주변을 국부적으로 두껍게 만들어 그 위치의 유효깊이 d₁ 을 키우고, 임계단면을 기둥에서 더 먼 곳으로 밀어냅니다. 대신 드롭패널이 끝나 슬래브가 다시 얇아지는 위치에 두 번째 임계단면 b₀ = 4(L_drop + d₂) 가 새로 생기므로, 이 모형은 두 단면을 모두 검토해 더 불리한 쪽을 지배 단면으로 표시합니다.'
        : '드롭패널을 없애면 기둥부 국부 두께가 사라져 위험단면 면적이 줄고 접합부에 전단이 더 집중됩니다.'
    );
  }

  if (current.dropPanelSize !== baseline.dropPanelSize) {
    add(
      'dropPanelSize',
      'dropPanelSize',
      `드롭패널 크기 ${fmt(baseline.dropPanelSize)} → ${fmt(current.dropPanelSize)} mm`,
      current.dropPanelSize > baseline.dropPanelSize
        ? '드롭패널을 넓히면 두 번째 임계단면 b₀ = 4(L_drop + d₂) 의 둘레가 길어지고, 그 단면이 부담하는 면적은 줄어듭니다. 두 임계단면 중 어느 쪽이 지배하는지가 바뀔 수 있습니다.'
        : '드롭패널이 좁아지면 두 번째 임계단면이 기둥 쪽으로 가까워져 그 단면의 부담이 커집니다.'
    );
  }

  if (current.dropPanelThickness !== baseline.dropPanelThickness) {
    add(
      'dropPanelThickness',
      'dropPanelThickness',
      `드롭패널 두께 ${fmt(baseline.dropPanelThickness)} → ${fmt(current.dropPanelThickness)} mm`,
      '이 모형은 기둥부 유효깊이 d₁ 을 입력값으로 두고 d₂ = d₁ − 드롭패널 두께 로 정의합니다. 따라서 드롭패널만 두껍게 하면 바깥 슬래브가 얇아져 두 번째 임계단면이 불리해집니다. 실제 보강 효과를 보려면 d₁ 도 함께 키워야 합니다.'
    );
  }

  if (
    current.shearReinf !== baseline.shearReinf ||
    current.shearReinfRatio !== baseline.shearReinfRatio
  ) {
    add(
      'shearReinf',
      'shearReinf',
      `펀칭전단 보강 ${
        current.shearReinf ? `있음 (보강량 비율 ${current.shearReinfRatio.toFixed(2)})` : '없음'
      }`,
      current.shearReinf
        ? '전단보강근을 배치하면 저항이 콘크리트 분담 vc 와 보강근 분담 vs 의 합으로 계산됩니다. ACI 318-19 에서는 보강이 있을 때 콘크리트 분담을 0.17λs√f\'c 로 낮추는 대신 vs 를 더하고, 전체를 0.5√f\'c 로 제한합니다. 균열이 생긴 뒤에도 하중을 전달할 수 있어 파괴가 덜 급격해집니다. 다만 이 모형의 보강량은 실제 배근(Av·fyt/b₀·s)이 아니라 0~1 비율로 단순화한 값입니다.'
        : '전단보강이 없으면 콘크리트의 인장저항만으로 버티게 되어, 균열이 진전되면 저항이 급격히 사라지는 취성적 파괴가 일어나기 쉽습니다.'
    );
  }

  if (Math.abs(current.superDead - baseline.superDead) > 0.01) {
    add(
      'superDead',
      'superDead',
      `추가 고정하중 ${baseline.superDead.toFixed(1)} → ${current.superDead.toFixed(1)} kPa`,
      current.superDead > baseline.superDead
        ? '마감·설비·조적 칸막이 같은 고정하중이 늘면 등분포하중 w 가 커지고, Vu = w × 부담면적 이 그대로 증가합니다. 계수하중에서는 고정하중에 1.2 가 곱해집니다. 저항 φVn 은 전혀 변하지 않습니다.'
        : '고정하중을 줄이면 저항을 키우지 않고도 요구 Vu 자체가 줄어듭니다. 구조 단면을 바꾸기 어려울 때 먼저 검토하는 방향입니다.'
    );
  }

  if (Math.abs(current.liveLoad - baseline.liveLoad) > 0.01) {
    add(
      'liveLoad',
      'liveLoad',
      `활하중 ${baseline.liveLoad.toFixed(1)} → ${current.liveLoad.toFixed(1)} kPa`,
      '활하중은 용도에 따라 기준값이 정해집니다. 계수하중에서 1.6 이 곱해지므로 같은 크기의 고정하중보다 Vu 에 더 크게 반영됩니다. 저항 φVn 은 변하지 않습니다.'
    );
  }

  if (Math.abs(current.localExtraLoad - baseline.localExtraLoad) > 0.01) {
    add(
      'localExtraLoad',
      'localExtraLoad',
      `국부 추가하중 ${baseline.localExtraLoad.toFixed(1)} → ${current.localExtraLoad.toFixed(
        1
      )} kPa`,
      current.localExtraLoad > baseline.localExtraLoad
        ? '설비·냉각탑·적치물처럼 원설계에 없던 하중이 얹히면 그 접합부의 Vu 가 직접 커집니다. 저항은 그대로이므로 D/C 는 하중 증가율만큼 올라갑니다.'
        : '중량 설비를 옮기거나 덜어내면 해당 접합부의 Vu 가 직접 줄어듭니다. 다만 옮겨간 위치의 접합부가 대신 부담하므로 그쪽도 검토해야 합니다.'
    );
  }

  if (current.usage !== baseline.usage) {
    const from = USAGES[baseline.usage];
    const to = USAGES[current.usage];
    add(
      'usage',
      'usage',
      `용도 변경 ${from.label} → ${to.label}`,
      `용도가 바뀌면 마감과 설비가 달라져 고정하중이 ${from.superDead.toFixed(
        1
      )} → ${to.superDead.toFixed(1)} kPa, 설계 활하중이 ${from.live.toFixed(
        1
      )} → ${to.live.toFixed(
        1
      )} kPa 로 달라집니다. ${to.note} 구조 단면은 그대로이므로 φVn 은 변하지 않고 Vu 만 변합니다.`
    );
  }

  if (current.topRebarRatio !== baseline.topRebarRatio) {
    add(
      'topRebarRatio',
      'topRebarRatio',
      `상부 인장철근비 ${baseline.topRebarRatio.toFixed(2)} → ${current.topRebarRatio.toFixed(2)} %`,
      'ACI 식에는 상부철근비가 펀칭전단 강도식에 직접 들어가지 않습니다. 반면 Eurocode 2 의 v_Rd,c 는 (100ρl·fck)^⅓ 형태라 철근비의 세제곱근에 비례해 저항이 커집니다. 오른쪽 해석 옵션에서 기준식을 EC2 로 바꾸면 이 변수의 영향을 볼 수 있습니다.'
    );
  }

  if (current.columnBars !== baseline.columnBars) {
    add(
      'columnBars',
      'columnBars',
      `기둥 주철근 ${baseline.columnBars} → ${current.columnBars} - HD22`,
      '기둥 주철근은 펀칭전단 강도식에 들어가지 않지만 기둥 자체의 축력 저항 Pn 에 직접 영향을 줍니다. 아래 기둥 축력 검토 값이 함께 바뀌는 것을 확인해 보세요.'
    );
  }

  if (current.spanX !== baseline.spanX || current.spanY !== baseline.spanY) {
    add(
      'span',
      'spanX',
      `경간 ${fmt(baseline.spanX)} × ${fmt(baseline.spanY)} → ${fmt(current.spanX)} × ${fmt(
        current.spanY
      )} mm`,
      '경간이 커지면 기둥 하나가 부담하는 면적이 거의 제곱으로 늘어 Vu = w × 부담면적 이 빠르게 증가합니다. 저항은 그대로입니다. 플랫슬래브에서 큰 경간이 특히 불리한 이유입니다.'
    );
  }

  if (current.momentFactor !== baseline.momentFactor) {
    add(
      'momentFactor',
      'momentFactor',
      `불균형 모멘트 할증 ${baseline.momentFactor.toFixed(2)} → ${current.momentFactor.toFixed(2)}`,
      '실제 접합부에는 전단력뿐 아니라 슬래브에서 기둥으로 전달되는 불균형 모멘트가 함께 작용해 한쪽 면의 전단응력이 더 커집니다. 이 모형은 그 효과를 정밀 계산하지 않고 Vu 에 곱하는 할증 계수로만 거칠게 반영합니다. (source-notes.md 의 TODO 참조)'
    );
  }

  return cards;
}

/** 현재 결과에서 어떤 단면이 지배하는지에 대한 설명 */
export function explainGoverning(r: AnalysisResult): string {
  const g = r.governing;
  if (g.name.startsWith('드롭패널')) {
    return `현재 조건에서는 "${g.name}"이 지배합니다. 기둥 바로 옆이 아니라 드롭패널이 끝나고 슬래브가 다시 얇아지는 위치가 더 불리하다는 뜻입니다. 드롭패널을 더 넓히거나 슬래브 두께 자체를 늘리는 방향이 이 단면에 영향을 줍니다.`;
  }
  return `현재 조건에서는 "${g.name}"이 지배합니다. 기둥 바로 주변에서 슬래브가 뚫리는 형태의 파괴가 먼저 문제가 되는 상태입니다. 기둥 직경(→ b₀), 기둥부 유효깊이(→ b₀·d), 전단보강이 이 단면의 φVn 에 직접 영향을 줍니다.`;
}
