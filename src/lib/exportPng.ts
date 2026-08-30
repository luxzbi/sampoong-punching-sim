import { toPng } from 'html-to-image';

/**
 * 화면의 특정 영역을 PNG 로 저장한다. (PPT 캡처용)
 * WebGL 캔버스를 포함하는 영역도 저장할 수 있도록 Canvas 는 preserveDrawingBuffer 로 생성한다.
 */
export async function exportNodeAsPng(node: HTMLElement | null, filename: string) {
  if (!node) return;
  try {
    const dataUrl = await toPng(node, {
      backgroundColor: '#0d1117',
      pixelRatio: 2,
      cacheBust: true,
      filter: (el) => !(el instanceof HTMLElement && el.dataset.noExport === 'true')
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    a.click();
  } catch (e) {
    console.error('PNG 저장 실패', e);
    alert('PNG 저장에 실패했습니다. 브라우저 콘솔을 확인해 주세요.');
  }
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}
