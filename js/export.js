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

// canvas 렌더러는 일부 브라우저에서 input의 세로 글리프를 잘라낸다.
// 복제 카드에서만 정적 텍스트로 바꿔 편집 화면은 유지하면서 PNG를 안정화한다.
function replaceTextInputsForCapture(cardEl) {
  cardEl.querySelectorAll('input[type="text"]').forEach((input) => {
    const text = input.ownerDocument.createElement('span');
    text.className = `${input.className} capture-text`;
    text.textContent = input.value;
    text.setAttribute('aria-label', input.getAttribute('aria-label') || '');
    input.replaceWith(text);
  });
}

// B 타입 중앙선은 편집 화면의 실제 픽셀 좌표를 저장하지 않는다. 캡처용 복제 DOM에서
// 편집 도구를 숨긴 뒤 카드 위치를 다시 읽어야 미리보기·PNG에서도 선이 정확히 맞는다.
function rebuildBCenterDividersForCapture(cardEl) {
  const container = cardEl.querySelector('#qa-container.has-center-lines');
  if (!container) return;
  container.querySelector('.b-center-divider-layer')?.remove();

  const containerRect = container.getBoundingClientRect();
  const cards = [...container.querySelectorAll('.qa-card-item')]
    .map((card) => ({ rect: card.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);
  if (cards.length < 2) return;

  const rows = [];
  cards.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left).forEach((entry) => {
    const row = rows.find((candidate) => Math.abs(candidate.top - entry.rect.top) < 4);
    if (row) row.cards.push(entry);
    else rows.push({ top: entry.rect.top, cards: [entry] });
  });
  rows.forEach((row) => row.cards.sort((a, b) => a.rect.left - b.rect.left));

  const layer = cardEl.ownerDocument.createElement('div');
  layer.className = 'b-center-divider-layer';
  const addLine = (direction, style) => {
    const line = cardEl.ownerDocument.createElement('i');
    line.className = `b-center-divider is-${direction}`;
    Object.assign(line.style, style);
    layer.appendChild(line);
  };

  rows.forEach((row) => {
    for (let index = 0; index < row.cards.length - 1; index += 1) {
      const left = row.cards[index].rect;
      const right = row.cards[index + 1].rect;
      const x = ((left.right + right.left) / 2) - containerRect.left;
      const top = Math.min(left.top, right.top) - containerRect.top;
      const bottom = Math.max(left.bottom, right.bottom) - containerRect.top;
      addLine('vertical', { left: `${x - 1}px`, top: `${top}px`, height: `${Math.max(0, bottom - top)}px` });
    }
  });

  for (let index = 0; index < rows.length - 1; index += 1) {
    const upper = rows[index].cards.map(({ rect }) => rect);
    const lower = rows[index + 1].cards.map(({ rect }) => rect);
    const y = ((Math.max(...upper.map((rect) => rect.bottom)) + Math.min(...lower.map((rect) => rect.top))) / 2) - containerRect.top;
    const all = [...upper, ...lower];
    const left = Math.min(...all.map((rect) => rect.left)) - containerRect.left;
    const right = Math.max(...all.map((rect) => rect.right)) - containerRect.left;
    addLine('horizontal', { left: `${left}px`, top: `${y - 1}px`, width: `${Math.max(0, right - left)}px` });
  }
  container.appendChild(layer);
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
      if (clonedCard) {
        expandTextareasForCapture(clonedCard);
        replaceTextInputsForCapture(clonedCard);
        rebuildBCenterDividersForCapture(clonedCard);
      }
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
        if (clonedCard) {
          expandTextareasForCapture(clonedCard);
          replaceTextInputsForCapture(clonedCard);
          rebuildBCenterDividersForCapture(clonedCard);
        }
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
