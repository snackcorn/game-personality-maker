/** html2canvas 실행 전 카드 안의 이미지를 모두 준비한다. */
async function waitForCardImages(cardEl) {
  await Promise.all(Array.from(cardEl.querySelectorAll('img')).map(async (img) => {
    if (!img.complete) {
      await new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }
    if (img.decode) {
      try { await img.decode(); } catch (_) { /* 이미 표시 가능한 이미지는 그대로 캡처 */ }
    }
  }));
}

/** 편집 UI를 제거한 카드 이미지를 Data URL로 렌더링한다. */
export async function createCardPreview(cardElementId) {
  const cardEl = document.getElementById(cardElementId);
  if (!cardEl) return null;

  await waitForCardImages(cardEl);
  const canvas = await html2canvas(cardEl, {
    scale: 1,
    useCORS: true,
    backgroundColor: null,
    logging: false,
    onclone: (clonedDocument) => {
      clonedDocument.getElementById(cardElementId)?.classList.add('exporting');
    }
  });
  return canvas.toDataURL('image/png');
}

/**
 * html2canvas 캡처 시 편집 도구를 가리고 고해상도 PNG를 내보내는 모듈
 */
export async function exportCardAsPNG(cardElementId, fileName = 'gaming_personality.png') {
  const cardEl = document.getElementById(cardElementId);
  if (!cardEl) return;

  if (document.activeElement) document.activeElement.blur();
  cardEl.classList.add('exporting');

  try {
    await waitForCardImages(cardEl);
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
