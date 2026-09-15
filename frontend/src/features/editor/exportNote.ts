import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

async function captureElement(element: HTMLElement, format: 'png' | 'jpeg'): Promise<string> {
  const options = { backgroundColor: '#0b0f19', pixelRatio: 2 };
  return format === 'png' ? toPng(element, options) : toJpeg(element, { ...options, quality: 0.95 });
}

export async function exportNoteAsImage(element: HTMLElement, fileName: string, format: 'png' | 'jpeg'): Promise<void> {
  const dataUrl = await captureElement(element, format);
  const link = document.createElement('a');
  link.download = `${fileName}.${format === 'jpeg' ? 'jpg' : 'png'}`;
  link.href = dataUrl;
  link.click();
}

export async function exportNoteAsPdf(element: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await captureElement(element, 'png');
  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const pdf = new jsPDF({
    orientation: img.width > img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width, img.height],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
  pdf.save(`${fileName}.pdf`);
}
