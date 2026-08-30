import React from 'react';
import { Card, Segmented, Select, Slider, Toggle } from './ui';
import { LIMITS, Params, UsageKey, USAGES } from '../model/types';
import { usageDelta } from '../model/punching';

interface Props {
  params: Params;
  onChange: (patch: Partial<Params>) => void;
  onReset: () => void;
}

export default function ControlPanel({ params, onChange, onReset }: Props) {
  const set = <K extends keyof Params>(key: K) => (v: Params[K]) => onChange({ [key]: v } as Partial<Params>);

  /** 용도를 바꾸면 그 용도의 대표 하중을 자동으로 적용한다. */
  const changeUsage = (u: UsageKey) => {
    const info = USAGES[u];
    onChange({ usage: u, superDead: info.superDead, liveLoad: info.live });
  };

  const usageInfo = USAGES[params.usage];
  const vsRetail = usageDelta('retail', params.usage);

  return (
    <div>
      <Card title="1. 기하 조건">
        <Slider
          label="기둥 직경 (원형)"
          unit="mm"
          value={params.columnDiameter}
          {...LIMITS.columnDiameter}
          onChange={set('columnDiameter')}
          hint="위험단면 둘레 b0 = π(D + d) 에 직접 들어가는 값입니다."
        />
        <Slider
          label="기둥부 유효깊이 d₁ (드롭패널 포함)"
          unit="mm"
          value={params.effectiveDepth}
          {...LIMITS.effectiveDepth}
          onChange={set('effectiveDepth')}
          hint="드롭패널이 있으면 바깥 슬래브 유효깊이 d₂ = d₁ − 드롭패널 두께 로 계산됩니다."
        />
        <Slider
          label="경간 X (기둥 중심 간격)"
          unit="mm"
          value={params.spanX}
          {...LIMITS.spanX}
          onChange={set('spanX')}
        />
        <Slider
          label="경간 Y (기둥 중심 간격)"
          unit="mm"
          value={params.spanY}
          {...LIMITS.spanY}
          onChange={set('spanY')}
          hint="경간은 공개 자료에서 확정하지 못해 교육용 가정값입니다. 값을 바꿔가며 영향을 확인해 보세요."
        />
      </Card>

      <Card title="2. 재료 · 철근">
        <Slider
          label="콘크리트 압축강도 f'c"
          unit="MPa"
          value={params.fck}
          {...LIMITS.fck}
          digits={1}
          onChange={set('fck')}
          hint="전단강도는 √f'c 에 비례하므로 강도를 올려도 저항 증가폭은 그 제곱근만큼입니다."
        />
        <Slider
          label="상부 인장철근비 ρ"
          unit="%"
          value={params.topRebarRatio}
          {...LIMITS.topRebarRatio}
          digits={2}
          onChange={set('topRebarRatio')}
          hint="ACI 식에는 들어가지 않고, EC2 식에서만 저항에 반영됩니다."
        />
        <Slider
          label="기둥 주철근 개수 (HD22)"
          unit="개"
          value={params.columnBars}
          {...LIMITS.columnBars}
          onChange={set('columnBars')}
          hint="펀칭전단이 아니라 기둥 자체의 축력 저항에 영향을 줍니다. (구조계산서 16-HD22 → 도면 8-HD22)"
        />
      </Card>

      <Card title="3. 드롭패널 · 전단보강">
        <Toggle
          label="드롭패널 (기둥머리 확대)"
          value={params.dropPanel}
          onChange={set('dropPanel')}
          hint="삼풍 조건은 드롭패널이 없는 무량판입니다. 드롭패널을 새로 두는 상황을 보려면 두께만큼 위의 기둥부 유효깊이 d₁ 도 함께 키워야 합니다 (그래야 기둥머리가 두꺼워진 것이 됩니다)."
        />
        <Slider
          label="드롭패널 한 변"
          unit="mm"
          value={params.dropPanelSize}
          {...LIMITS.dropPanelSize}
          onChange={set('dropPanelSize')}
          disabled={!params.dropPanel}
        />
        <Slider
          label="드롭패널 추가 두께"
          unit="mm"
          value={params.dropPanelThickness}
          {...LIMITS.dropPanelThickness}
          onChange={set('dropPanelThickness')}
          disabled={!params.dropPanel}
          hint="드롭패널이 있으면 기둥 주변과 드롭패널 외곽, 두 곳의 위험단면을 함께 검토합니다."
        />
        <Toggle
          label="펀칭전단 보강 (스터드/스터럽)"
          value={params.shearReinf}
          onChange={set('shearReinf')}
        />
        <Slider
          label="전단보강량 비율"
          unit=""
          value={params.shearReinfRatio}
          {...LIMITS.shearReinfRatio}
          digits={2}
          onChange={set('shearReinfRatio')}
          disabled={!params.shearReinf}
          hint="실제 배근량(Av·fyt/b0·s)이 아니라 0~1 로 단순화한 상대 비율입니다."
        />
      </Card>

      <Card title="4. 용도 · 하중">
        <Select
          label="용도"
          value={params.usage}
          onChange={(v) => changeUsage(v as UsageKey)}
          options={Object.values(USAGES).map((u) => ({ value: u.key, label: u.label }))}
          hint={usageInfo.note}
        />
        <div className="hint" style={{ marginTop: -4, marginBottom: 10 }}>
          판매장 기준 대비 고정하중 {vsRetail.deadDelta >= 0 ? '+' : ''}
          {vsRetail.deadDelta.toFixed(1)} kPa, 활하중 {vsRetail.liveDelta >= 0 ? '+' : ''}
          {vsRetail.liveDelta.toFixed(1)} kPa
        </div>
        <Slider
          label="추가 고정하중 (마감·설비)"
          unit="kPa"
          value={params.superDead}
          {...LIMITS.superDead}
          digits={1}
          onChange={set('superDead')}
          hint="슬래브 자중은 두께로부터 자동 계산되어 여기에 더해집니다."
        />
        <Slider
          label="활하중"
          unit="kPa"
          value={params.liveLoad}
          {...LIMITS.liveLoad}
          digits={1}
          onChange={set('liveLoad')}
        />
        <Slider
          label="국부 추가하중 (설비·적치물)"
          unit="kPa"
          value={params.localExtraLoad}
          {...LIMITS.localExtraLoad}
          digits={1}
          onChange={set('localExtraLoad')}
          hint="원설계에 없던 하중이 이 접합부 위에 얹힌 상황을 나타냅니다."
        />
        <Slider
          label="이 기둥이 지지하는 층 수 (축력 검토용)"
          unit="개 층"
          value={params.floorsAbove}
          {...LIMITS.floorsAbove}
          onChange={set('floorsAbove')}
        />
      </Card>

      <Card title="5. 해석 옵션">
        <Segmented
          label="적용 기준식"
          value={params.code}
          onChange={(v) => onChange({ code: v })}
          options={[
            { value: 'ACI', label: 'ACI 318-19' },
            { value: 'EC2', label: 'Eurocode 2' }
          ]}
          hint="두 기준은 위험단면 위치와 강도식이 다릅니다. 값이 달라지는 것 자체가 모형의 불확실성을 보여줍니다."
        />
        <Segmented
          label="하중 조합"
          value={params.loadMode}
          onChange={(v) => onChange({ loadMode: v })}
          options={[
            { value: 'design', label: '설계 (1.2D+1.6L, φ=0.75)' },
            { value: 'service', label: '사용 (1.0D+1.0L, φ=1.0)' }
          ]}
          hint="설계 검토는 안전율이 포함된 값이고, 사용하중 검토는 실제 상태를 거칠게 추정한 값입니다."
        />
        <Toggle
          label="크기효과계수 λs 적용 (ACI 318-19)"
          value={params.sizeEffect}
          onChange={set('sizeEffect')}
          hint="두꺼운 부재일수록 단위면적당 전단강도가 낮아진다는 최신 기준의 보정입니다. 1995년 당시 기준에는 없었습니다."
        />
        <Slider
          label="불균형 모멘트 할증 계수"
          unit="배"
          value={params.momentFactor}
          {...LIMITS.momentFactor}
          digits={2}
          onChange={set('momentFactor')}
          hint="1.00 이면 모멘트 전달 효과를 무시합니다. 정밀 계산이 아니라 거친 할증입니다."
        />
        <button className="btn" style={{ width: '100%' }} onClick={onReset}>
          현재 프리셋 값으로 되돌리기
        </button>
      </Card>
    </div>
  );
}
