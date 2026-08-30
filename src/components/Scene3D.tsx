import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Params } from '../model/types';
import { AnalysisResult, RISK_INFO } from '../model/punching';

/**
 * 교육용 3D 시각화.
 * 삼풍백화점 전체 건물이 아니라, 플랫슬래브의 2x2 bay 일부와 그 중앙 기둥만을
 * 단순화하여 보여줍니다. 형상은 개념 이해를 위한 모식도이며 실제 도면이 아닙니다.
 */

export type CollapseState = 'idle' | 'playing' | 'done';
export type ViewMode = 'overview' | 'joint' | 'section';

export const VIEW_LABELS: Record<ViewMode, string> = {
  overview: '전체 보기',
  joint: '접합부 확대',
  section: '측면(단면) 보기'
};

interface SceneProps {
  params: Params;
  result: AnalysisResult;
  collapse: CollapseState;
  onCollapseDone: () => void;
  showRebar: boolean;
  showLoads: boolean;
  showLabels: boolean;
  resetToken: number;
  view: ViewMode;
}

const M = 1 / 1000; // mm -> m

/* ------------------------------------------------------------------ */
/* 재료                                                                 */
/* ------------------------------------------------------------------ */

const concreteMat = new THREE.MeshStandardMaterial({
  color: '#b6bec9',
  roughness: 0.85,
  metalness: 0.02
});
const dropMat = new THREE.MeshStandardMaterial({
  color: '#98a2ae',
  roughness: 0.85,
  metalness: 0.02
});
const columnMat = new THREE.MeshStandardMaterial({
  color: '#8d97a4',
  roughness: 0.8,
  metalness: 0.03
});
const coneMat = new THREE.MeshStandardMaterial({
  color: '#d0705f',
  roughness: 0.9,
  metalness: 0.0
});
const rebarMat = new THREE.MeshStandardMaterial({
  color: '#ff9f43',
  roughness: 0.4,
  metalness: 0.5
});
const arrowMat = new THREE.MeshStandardMaterial({
  color: '#58a6ff',
  roughness: 0.4,
  metalness: 0.1,
  transparent: true,
  opacity: 0.9
});

/* ------------------------------------------------------------------ */
/* 균열 (원형 + 방사형)                                                  */
/* ------------------------------------------------------------------ */

function CrackPattern({
  dcr,
  columnR,
  d,
  collapse
}: {
  dcr: number;
  columnR: number;
  d: number;
  collapse: CollapseState;
}) {
  const matRef = useRef<THREE.LineBasicMaterial>(null!);

  const { object, material } = useMemo(() => {
    const level = Math.min(1.6, dcr);
    const radials = Math.round(6 + level * 14);
    const rings = Math.max(1, Math.round(1 + level * 4));
    const rMin = columnR * 1.05;
    const rMax = columnR + d * (0.55 + level * 0.75);

    const pts: number[] = [];

    // 방사형 균열
    for (let i = 0; i < radials; i++) {
      const a = (i / radials) * Math.PI * 2 + (i % 2 ? 0.06 : 0);
      const seg = 7;
      const jag = 0.035 * rMax;
      for (let s = 0; s < seg; s++) {
        const r0 = rMin + ((rMax - rMin) * s) / seg;
        const r1 = rMin + ((rMax - rMin) * (s + 1)) / seg;
        const a0 = a + Math.sin(s * 2.3 + i) * 0.03;
        const a1 = a + Math.sin((s + 1) * 2.3 + i) * 0.03;
        pts.push(
          Math.cos(a0) * r0 + Math.sin(s) * jag * 0.05,
          0,
          Math.sin(a0) * r0,
          Math.cos(a1) * r1,
          0,
          Math.sin(a1) * r1
        );
      }
    }

    // 원형(전단) 균열
    for (let k = 0; k < rings; k++) {
      const r = rMin + ((rMax - rMin) * (k + 1)) / (rings + 0.4);
      const seg = 72;
      for (let s = 0; s < seg; s++) {
        const a0 = (s / seg) * Math.PI * 2;
        const a1 = ((s + 1) / seg) * Math.PI * 2;
        const w0 = 1 + Math.sin(a0 * 5 + k) * 0.02;
        const w1 = 1 + Math.sin(a1 * 5 + k) * 0.02;
        pts.push(
          Math.cos(a0) * r * w0,
          0,
          Math.sin(a0) * r * w0,
          Math.cos(a1) * r * w1,
          0,
          Math.sin(a1) * r * w1
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const color = new THREE.Color(
      dcr >= 1 ? '#ff4d4d' : dcr >= 0.7 ? '#e3a72f' : '#6fd08c'
    );
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(0.95, 0.12 + Math.min(dcr, 1.6) * 0.55)
    });
    return { object: new THREE.LineSegments(geo, mat), material: mat };
  }, [dcr, columnR, d]);

  useEffect(() => {
    matRef.current = material;
    return () => {
      object.geometry.dispose();
      material.dispose();
    };
  }, [object, material]);

  useFrame(({ clock }) => {
    const base = Math.min(0.95, 0.12 + Math.min(dcr, 1.6) * 0.55);
    const pulse = dcr >= 0.7 ? 0.12 * Math.sin(clock.elapsedTime * 3.2) : 0;
    material.opacity = collapse === 'idle' ? base + pulse : 0.95;
  });

  return <primitive object={object} position={[0, 0.06, 0]} />;
}

/* ------------------------------------------------------------------ */
/* 하중 화살표                                                           */
/* ------------------------------------------------------------------ */

function LoadArrows({
  span,
  spanZ,
  w,
  localExtra,
  top
}: {
  span: number;
  spanZ: number;
  w: number;
  localExtra: number;
  top: number;
}) {
  const arrows = useMemo(() => {
    const list: { x: number; z: number; len: number; heavy: boolean }[] = [];
    const n = 4;
    const baseLen = 0.6 + Math.min(1.5, w / 22);
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = -span + (2 * span * i) / n;
        const z = -spanZ + (2 * spanZ * j) / n;
        const nearCenter = Math.abs(x) < span * 0.55 && Math.abs(z) < spanZ * 0.55;
        const heavy = localExtra > 0.05 && nearCenter;
        list.push({ x, z, len: heavy ? baseLen * 1.45 : baseLen, heavy });
      }
    }
    return list;
  }, [span, spanZ, w, localExtra]);

  return (
    <group>
      {arrows.map((a, i) => (
        <group key={i} position={[a.x, top + a.len / 2 + 0.35, a.z]}>
          <mesh>
            <cylinderGeometry args={[0.045, 0.045, a.len, 8]} />
            <meshStandardMaterial
              color={a.heavy ? '#ff7b72' : '#58a6ff'}
              roughness={0.4}
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh position={[0, -a.len / 2 - 0.14, 0]}>
            <coneGeometry args={[0.13, 0.3, 10]} />
            <meshStandardMaterial
              color={a.heavy ? '#ff7b72' : '#58a6ff'}
              roughness={0.4}
              transparent
              opacity={0.92}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 상부 철근                                                             */
/* ------------------------------------------------------------------ */

function TopRebar({
  span,
  spanZ,
  ratio,
  y,
  extent
}: {
  span: number;
  spanZ: number;
  ratio: number;
  y: number;
  extent: number;
}) {
  const bars = useMemo(() => {
    const count = Math.max(4, Math.round(4 + ratio * 8));
    const out: { pos: [number, number, number]; rot: [number, number, number]; len: number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const off = (t - 0.5) * 2 * extent;
      out.push({ pos: [0, y, off], rot: [0, 0, Math.PI / 2], len: extent * 2.2 });
      out.push({ pos: [off, y + 0.03, 0], rot: [Math.PI / 2, 0, 0], len: extent * 2.2 });
    }
    return out;
  }, [ratio, y, extent, span, spanZ]);

  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={b.rot} material={rebarMat}>
          <cylinderGeometry args={[0.014, 0.014, b.len, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 구조 본체                                                             */
/* ------------------------------------------------------------------ */

function Structure({
  params,
  result,
  collapse,
  onCollapseDone,
  showRebar,
  showLoads,
  showLabels
}: Omit<SceneProps, 'resetToken'>) {
  const span = params.spanX * M;
  const spanZ = params.spanY * M;
  const h = result.slabThickness * M;
  const td = params.dropPanel ? params.dropPanelThickness * M : 0;
  const dropSize = params.dropPanelSize * M;
  const colR = (params.columnDiameter * M) / 2;
  const colH = 4.2;
  const d1 = params.effectiveDepth * M;

  const panelRefs = useRef<(THREE.Group | null)[]>([]);
  const coneRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const doneFired = useRef(false);

  useEffect(() => {
    if (collapse === 'idle') {
      t.current = 0;
      doneFired.current = false;
      panelRefs.current.forEach((g) => {
        if (!g) return;
        g.position.y = -h / 2;
        g.rotation.set(0, 0, 0);
      });
      if (coneRef.current) coneRef.current.visible = false;
    }
  }, [collapse, h]);

  useFrame((_, delta) => {
    if (collapse !== 'playing') return;
    t.current += delta;
    const tt = t.current;

    if (coneRef.current) coneRef.current.visible = tt > 1.0;

    const quads: [number, number][] = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1]
    ];

    panelRefs.current.forEach((g, i) => {
      if (!g) return;
      const [sx, sz] = quads[i];
      const delay = 1.0 + i * 0.28; // 하중 재분배에 따른 시간차 (연쇄붕괴 개념)
      const local = Math.max(0, tt - delay);
      // 1단계: 펀칭 직후 접합부 처짐, 2단계: 자유낙하에 가까운 붕락
      const tilt = Math.min(0.22, local * 0.30);
      const fall = local < 0.55 ? local * 0.5 : 0.275 + Math.pow(local - 0.55, 2) * 5.0;
      g.rotation.z = sx * tilt;
      g.rotation.x = -sz * tilt * 0.55;
      g.position.y = -h / 2 - Math.min(fall, 9);
    });

    if (tt > 4.2 && !doneFired.current) {
      doneFired.current = true;
      onCollapseDone();
    }
  });

  const quads: [number, number][] = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1]
  ];

  const cols: [number, number][] = [];
  for (const cx of [-1, 0, 1]) for (const cz of [-1, 0, 1]) cols.push([cx, cz]);

  const risk = RISK_INFO[result.riskLevel];

  return (
    <group>
      {/* 슬래브 : 2x2 bay 를 4개의 패널로 나누어 붕괴 애니메이션에 사용 */}
      {quads.map(([sx, sz], i) => (
        <group
          key={i}
          ref={(el) => (panelRefs.current[i] = el)}
          position={[sx * span, -h / 2, (sz * spanZ) / 2]}
        >
          <mesh position={[(-sx * span) / 2, 0, 0]} material={concreteMat} castShadow receiveShadow>
            <boxGeometry args={[span, h, spanZ]} />
          </mesh>
        </group>
      ))}

      {/* 기둥 + 드롭패널 */}
      {cols.map(([cx, cz], i) => {
        const x = cx * span;
        const z = cz * spanZ;
        return (
          <group key={i} position={[x, 0, z]}>
            {td > 0 && (
              <mesh position={[0, -h - td / 2, 0]} material={dropMat}>
                <boxGeometry args={[dropSize, td, dropSize]} />
              </mesh>
            )}
            <mesh position={[0, -h - td - colH / 2, 0]} material={columnMat}>
              <cylinderGeometry args={[colR, colR, colH, 28]} />
            </mesh>
          </group>
        );
      })}

      {/* 펀칭전단으로 기둥에 남는 원뿔대 (붕괴 시 표시) */}
      <mesh ref={coneRef} position={[0, -h / 2 - td / 2, 0]} visible={false} material={coneMat}>
        <cylinderGeometry args={[colR + d1 * 0.9, colR * 1.02, h + td, 28]} />
      </mesh>

      {/* 상부 철근 (중앙 접합부 주변만 개념적으로 표현) */}
      {showRebar && collapse === 'idle' && (
        <TopRebar
          span={span}
          spanZ={spanZ}
          ratio={params.topRebarRatio}
          y={0.03}
          extent={colR + d1 * 2.2}
        />
      )}

      {/* 균열 */}
      {collapse !== 'done' && (
        <CrackPattern dcr={result.dcr} columnR={colR} d={d1} collapse={collapse} />
      )}

      {/* 하중 화살표 */}
      {showLoads && collapse === 'idle' && (
        <LoadArrows
          span={span * 0.92}
          spanZ={spanZ * 0.92}
          w={result.load.w}
          localExtra={params.localExtraLoad}
          top={0}
        />
      )}

      {/* 라벨 */}
      {showLabels && (
        <>
          <Html position={[0, 1.1, spanZ * 0.14]} center style={{ pointerEvents: 'none' }}>
            <div className="scene-label" style={{ borderColor: risk.color, color: risk.color }}>
              슬래브-기둥 접합부 · D/C {result.dcr.toFixed(2)}
            </div>
          </Html>
          <Html position={[span * 0.62, -h - 1.4, spanZ * 0.62]} center style={{ pointerEvents: 'none' }}>
            <div className="scene-label dim">원형 기둥 D={params.columnDiameter} mm</div>
          </Html>
          {td > 0 && (
            <Html position={[0, -h - td - 0.55, dropSize * 0.75]} center style={{ pointerEvents: 'none' }}>
              <div className="scene-label dim">드롭패널 {params.dropPanelSize}×{params.dropPanelThickness} mm</div>
            </Html>
          )}
          <Html position={[-span * 0.55, 0.35, -spanZ * 0.9]} center style={{ pointerEvents: 'none' }}>
            <div className="scene-label dim">RC 플랫슬래브 t={result.slabThickness.toFixed(0)} mm</div>
          </Html>
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 카메라                                                                */
/* ------------------------------------------------------------------ */

function CameraRig({
  span,
  resetToken,
  view
}: {
  span: number;
  resetToken: number;
  view: ViewMode;
}) {
  const { camera } = useThree();
  const controls = useRef<any>(null);

  useEffect(() => {
    const k = span / 10.8;
    let pos: [number, number, number] = [18.5 * k, 13.5 * k, 24 * k];
    let target: [number, number, number] = [0, -2.6, 0];

    if (view === 'joint') {
      // 위험단면 크기는 기둥 직경과 유효깊이로 정해지므로 경간과 무관하게 가까이 본다.
      pos = [2.6, 1.6, 3.4];
      target = [0, -0.6, 0];
    } else if (view === 'section') {
      pos = [1.5 * k, 1.2, 13 * k];
      target = [0, -2.2, 0];
    }

    camera.position.set(...pos);
    camera.lookAt(...target);
    if (controls.current) {
      controls.current.target.set(...target);
      controls.current.update();
    }
  }, [resetToken, span, camera, view]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={2.2}
      maxDistance={140}
      maxPolarAngle={Math.PI * 0.52}
    />
  );
}

/* ------------------------------------------------------------------ */

export default function Scene3D(props: SceneProps) {
  const span = props.params.spanX * M;
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ fov: 42, near: 0.1, far: 900, position: [19, 14, 25] }}
    >
      <color attach="background" args={['#0f141d']} />
      <fog attach="fog" args={['#0f141d', 60, 190]} />
      <hemisphereLight args={['#dfe9f5', '#20262f', 0.85]} />
      <directionalLight position={[18, 26, 14]} intensity={1.25} />
      <directionalLight position={[-16, 10, -12]} intensity={0.4} color="#88aaff" />

      <Structure {...props} />

      <Grid
        position={[0, -12, 0]}
        args={[120, 120]}
        cellSize={2}
        cellColor="#1d2531"
        sectionSize={10}
        sectionColor="#2a3444"
        fadeDistance={130}
        fadeStrength={1.5}
        infiniteGrid
      />

      <CameraRig span={span} resetToken={props.resetToken} view={props.view} />
    </Canvas>
  );
}
