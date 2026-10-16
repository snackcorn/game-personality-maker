/**
 * html2canvas 캡처 시 편집 도구를 가리고 고해상도 PNG를 내보내는 모듈
 */
export async function exportCardAsPNG(cardElementId, fileName = 'gaming_personality.png') {
  const cardEl = document.getElementById(cardElementId);
  if (!cardEl) return;

  if (document.activeElement) document.activeElement.blur();
  cardEl.classList.add('exporting');

  try {
    const canvas = await html2canvas(cardEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error("Export PNG Failed:", err);
    alert("이미지 저장 중 오류가 발생했습니다.");
  } finally {
    cardEl.classList.remove('exporting');
  }
}