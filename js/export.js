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

// html2canvas가 복제한 문서에서만 textarea를 내용 높이만큼 펼친다.
// 편집 중인 원본의 크기나 스크롤 상태는 바꾸지 않으면서 긴 내용의 하단 잘림을 막는다.
function expandTextareasForCapture(cardEl) {
  cardEl.querySelectorAll('textarea').forEach((textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.style.overflow = 'hidden';
  });
}

/** 편집 UI를 제거한 카드 이미지를 Data URL로 렌더링한다. */
export async function createCardPreview(cardElementId) {
  const cardEl = document.getElementById(cardElementId);
  if (!cardEl) return null;

  await waitForCardImages(cardEl);
  const canvas = await html2canvas(cardEl, {
    // 화면에서는 축소해 보여도 원본 픽셀을 충분히 확보해 글자와 선을 선명하게 유지한다.
    scale: Math.max(2, window.devicePixelRatio || 1),
    useCORS: true,
    backgroundColor: null,
    logging: false,
    onclone: (clonedDocument) => {
      const clonedCard = clonedDocument.getElementById(cardElementId);
      clonedCard?.classList.add('exporting');
      if (clonedCard) expandTextareasForCapture(clonedCard);
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
  try {
    await waitForCardImages(cardEl);
    const canvas = await html2canvas(cardEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      onclone: (clonedDocument) => {
        const clonedCard = clonedDocument.getElementById(cardElementId);
        clonedCard?.classList.add('exporting');
        if (clonedCard) expandTextareasForCapture(clonedCard);
      }
    });

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error("Export PNG Failed:", err);
    alert("이미지 저장 중 오류가 발생했습니다.");
  }
}
