import { LayerManager } from './layerManager.js';
import { generateCode, parseCode } from './storage.js';
import { createCardPreview, exportCardAsPNG } from './export.js';

const A_MODULE_SIZE_LIMITS = {
  table: { minWidth: 320, minHeight: 180 },
  comment: { minWidth: 240, minHeight: 150 }
};

const state = {
  layout: 'A',
  orientation: 'V',
  showAComment: true,
  tableFitFill: false,
  tableWidthPercent: 55,
  aModuleSizes: {
    table: { width: null, height: null, scale: 1, baseWidth: null, baseHeight: null },
    comment: { width: null, height: null, scale: 1, baseWidth: null, baseHeight: null, fitContent: false }
  },
  tableBg: true,
  profileSize: 'normal',
  bInputScale: 'normal',
  theme: 'cyber',
  
  customColors: {
    bg: '#111827',
    inputBg: '#1e293b',
    border: '#334155',
    text: '#f8fafc',
    accent: '#38bdf8',
    profBg: '#1e293b'
  },

  profilePos: 'left',
  profileDivider: true,
  profileBg: false,
  metaFields: [
    { id: 'field_0', placeholder: '닉네임 / 트위터 아이디 (@)', value: '' },
    { id: 'field_1', placeholder: '주 플레이 시간대 (예: 평일 21시~ / 주말 상시)', value: '' }
  ],

  // A타입 자유 입력창 동적 카드 리스트
  aCommentList: [
    { title: "Q. 플레이 코멘트 / 남기는 말", type: "textarea", value: "" }
  ],

  avatarDataUrl: '',
  bgDataUrl: '',

  matrixRows: [
    { title: "🏆 도전과제 100%작", value: "2" },
    { title: "📖 스토리/세계관 정독", value: "1" },
    { title: "📸 스크린샷/룩덕", value: "2" },
    { title: "🎧 음성 채팅(디스코드)", value: "1" },
    { title: "⚔️ 고난도 엔드컨텐츠", value: "2" }
  ],
  qaList: [
    { title: "Q. 플레이 스타일", type: "textarea", value: "스토리 위주로 느긋하게 탐험합니다." },
    { title: "Q. 주 플레이 게임 TOP 3", type: "list", value: ["헬다이버즈2", "딥락갤", "몬헌"] },
    { 
      title: "Q. 선호 컨텐츠", 
      type: "checkbox", 
      items: ["스토리", "파밍/엔드컨텐츠", "스크린샷/룩덕", "OST/분위기"],
      checked: [0, 2] 
    },
    { 
      title: "Q. 접속 시간대", 
      type: "dropdown", 
      items: ["평일 저녁 위주", "주말 상시", "심야/새벽반"],
      value: "평일 저녁 위주"
    }
  ]
};

const layerMgr = new LayerManager('layer-back-images', 'layer-front-images');

document.addEventListener('DOMContentLoaded', () => {
  setupPrivacyNotice();
  setupLayoutSwitch();
  setupOrientationSwitch();
  setupProfileSizeButtons();
  setupBInputScaleButtons();
  setupProfileModuleControls();
  setupColorCustomModal();
  setupACommentToggle();
  setupACommentComponent();
  setupTableResizer();
  setupAModuleResizers();
  setupACommentFitControl();
  setupModuleSizeReset();
  setupTableFitToggle();
  setupTableBgControl();
  setupTheme();
  setupUploads();
  setupMatrixTable();
  setupQAComponent();
  setupModuleDragAndDrop();
  setupShareCode();
  setupLivePreview();
  
  // 초기 UI 동기화
  applyLayout('A');
  applyOrientation('V');
  renderMetaFields();
  applyProfileLayout();
});

// 내보내기와 같은 렌더링 결과를 이미지로 만들어 우측에 표시한다.
function setupLivePreview() {
  const source = document.getElementById('export-card');
  const stage = document.getElementById('preview-stage');
  if (!source || !stage) return;

  let timerId = null;
  let rendering = false;
  let rerenderNeeded = false;
  const renderPreview = async () => {
    if (rendering) {
      rerenderNeeded = true;
      return;
    }
    rendering = true;
    try {
      const imageUrl = await createCardPreview('export-card');
      if (!imageUrl) return;
      const image = new Image();
      image.className = 'preview-image';
      image.alt = '완성 이미지 미리보기';
      image.src = imageUrl;
      stage.replaceChildren(image);
    } catch (error) {
      console.error('Preview render failed:', error);
    } finally {
      rendering = false;
      if (rerenderNeeded) {
        rerenderNeeded = false;
        schedulePreview();
      }
    }
  };
  const schedulePreview = () => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(renderPreview, 120);
  };

  document.addEventListener('input', schedulePreview, true);
  document.addEventListener('change', schedulePreview, true);
  document.addEventListener('click', schedulePreview, true);
  new MutationObserver(schedulePreview).observe(source, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'src', 'checked', 'selected']
  });
  new ResizeObserver(schedulePreview).observe(source);
  schedulePreview();
}

// 1. 개인정보 보호 팝업
function setupPrivacyNotice() {
  const modal = document.getElementById('privacy-notice-modal');
  const btnConfirm = document.getElementById('btn-privacy-confirm');
  const chkHide = document.getElementById('chk-hide-privacy');
  if (!modal || !btnConfirm) return;

  const hideUntil = localStorage.getItem('hide_privacy_notice_until');
  if (!hideUntil || Date.now() > Number(hideUntil)) {
    modal.style.display = 'flex';
  }

  btnConfirm.addEventListener('click', () => {
    if (chkHide && chkHide.checked) {
      const oneDay = 24 * 60 * 60 * 1000;
      localStorage.setItem('hide_privacy_notice_until', Date.now() + oneDay);
    }
    modal.style.display = 'none';
  });
}

// 2. 레이아웃 탭 전환
function applyLayout(mode) {
  state.layout = mode;
  const tabA = document.getElementById('tab-a');
  const tabB = document.getElementById('tab-b');
  const viewA = document.getElementById('layout-a');
  const viewB = document.getElementById('layout-b');
  const toolAComment = document.getElementById('tool-a-comment-wrap');
  const toolAFit = document.getElementById('tool-a-fit-wrap');
  const toolBScale = document.getElementById('tool-b-scale-wrap');
  const btnResetModuleSizes = document.getElementById('btn-reset-module-sizes');

  const isA = (mode === 'A');

  if (tabA) tabA.classList.toggle('active', isA);
  if (tabB) tabB.classList.toggle('active', !isA);

  if (viewA) viewA.style.display = isA ? 'flex' : 'none';
  if (viewB) viewB.style.display = isA ? 'none' : 'block';
  
  if (toolAComment) toolAComment.style.display = isA ? 'inline-flex' : 'none';
  if (toolAFit) toolAFit.style.display = isA ? 'inline-flex' : 'none';
  if (toolBScale) toolBScale.style.display = isA ? 'none' : 'inline-flex';
  if (btnResetModuleSizes) btnResetModuleSizes.style.display = isA ? 'inline-flex' : 'none';

  const resizer = document.getElementById('a-resizer');
  if (resizer) {
    resizer.style.display = (isA && state.showAComment && state.orientation === 'H') ? 'flex' : 'none';
  }
  if (isA) window.requestAnimationFrame(applyACommentContentFit);
}

// 3. 가로/세로 방향 전환
function applyOrientation(orient) {
  state.orientation = orient;
  const isH = (orient === 'H');
  const btnV = document.getElementById('btn-orient-v');
  const btnH = document.getElementById('btn-orient-h');
  const card = document.getElementById('export-card');
  const resizer = document.getElementById('a-resizer');

  if (btnV) btnV.classList.toggle('active', !isH);
  if (btnH) btnH.classList.toggle('active', isH);
  if (card) card.classList.toggle('horizontal-mode', isH);
  if (document.body) document.body.classList.toggle('is-horizontal', isH);
  if (resizer) resizer.style.display = (state.layout === 'A' && state.showAComment && isH) ? 'flex' : 'none';

  // 표 너비 리사이즈 값은 가로 모드 전용이다. 세로 모드에서는 100% 폭을 사용한다.
  const tableWrap = document.getElementById('mod-table');
  if (tableWrap) tableWrap.style.width = isH ? `${state.tableWidthPercent}%` : '';
  applyAModuleSizes();
}

function setupLayoutSwitch() {
  const tabA = document.getElementById('tab-a');
  const tabB = document.getElementById('tab-b');
  if (tabA) tabA.addEventListener('click', () => applyLayout('A'));
  if (tabB) tabB.addEventListener('click', () => applyLayout('B'));
}

function setupOrientationSwitch() {
  const btnV = document.getElementById('btn-orient-v');
  const btnH = document.getElementById('btn-orient-h');
  if (btnV) btnV.addEventListener('click', () => applyOrientation('V'));
  if (btnH) btnH.addEventListener('click', () => applyOrientation('H'));
}

// 4. 프로필 영역 크기 보통/크게 버튼 전환
function setProfileSize(type) {
  state.profileSize = type;
  const root = document.documentElement;
  const isLarge = (type === 'large');
  
  const sizePx = isLarge ? 115 : 85;
  const fontRem = isLarge ? 0.98 : 0.88;
  root.style.setProperty('--avatar-size', `${sizePx}px`);
  root.style.setProperty('--meta-font-size', `${fontRem}rem`);

  const btnN = document.getElementById('btn-prof-size-normal');
  const btnL = document.getElementById('btn-prof-size-large');
  if (btnN && btnL) {
    btnN.classList.toggle('active', !isLarge);
    btnL.classList.toggle('active', isLarge);
  }
}

function setupProfileSizeButtons() {
  const btnN = document.getElementById('btn-prof-size-normal');
  const btnL = document.getElementById('btn-prof-size-large');
  if (btnN) btnN.addEventListener('click', () => setProfileSize('normal'));
  if (btnL) btnL.addEventListener('click', () => setProfileSize('large'));
}

// 5. B타입 입력창 크기 보통/크게 버튼 전환
function setBInputScale(type) {
  state.bInputScale = type;
  const isLarge = (type === 'large');
  const scaleVal = isLarge ? 1.25 : 1.0;
  document.documentElement.style.setProperty('--qa-scale', scaleVal);

  const btnN = document.getElementById('btn-input-scale-normal');
  const btnL = document.getElementById('btn-input-scale-large');
  if (btnN && btnL) {
    btnN.classList.toggle('active', !isLarge);
    btnL.classList.toggle('active', isLarge);
  }
}

function setupBInputScaleButtons() {
  const btnN = document.getElementById('btn-input-scale-normal');
  const btnL = document.getElementById('btn-input-scale-large');
  if (btnN) btnN.addEventListener('click', () => setBInputScale('normal'));
  if (btnL) btnL.addEventListener('click', () => setBInputScale('large'));
}

// 6. 프로필 블록 호버 에디터
function applyProfileLayout() {
  const wrap = document.getElementById('profile-header-wrap');
  if (!wrap) return;

  wrap.classList.toggle('has-divider', state.profileDivider);
  wrap.classList.toggle('has-bg', state.profileBg);
  wrap.classList.toggle('pos-right', state.profilePos === 'right');

  const btnPos = document.getElementById('btn-profile-toggle-pos');
  if (btnPos) btnPos.innerText = `↔ 인장 위치: ${state.profilePos === 'left' ? '좌' : '우'}`;

  const btnDiv = document.getElementById('btn-profile-toggle-divider');
  if (btnDiv) btnDiv.innerText = `구분선: ${state.profileDivider ? 'ON' : 'OFF'}`;

  const btnBg = document.getElementById('btn-profile-toggle-bg');
  if (btnBg) btnBg.innerText = `배경: ${state.profileBg ? 'ON' : 'OFF'}`;
}

function renderMetaFields() {
  const container = document.getElementById('meta-inputs-container');
  if (!container) return;
  container.innerHTML = '';

  state.metaFields.forEach((field, idx) => {
    const row = document.createElement('div');
    row.className = 'meta-field-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = field.placeholder || '정보를 입력하세요';
    input.value = field.value || '';
    input.addEventListener('input', (e) => {
      field.value = e.target.value;
    });

    row.appendChild(input);

    if (state.metaFields.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-del-meta';
      delBtn.innerText = '×';
      delBtn.title = '입력칸 삭제';
      delBtn.addEventListener('click', () => {
        state.metaFields.splice(idx, 1);
        renderMetaFields();
      });
      row.appendChild(delBtn);
    }

    container.appendChild(row);
  });
}

function setupProfileModuleControls() {
  const btnAddField = document.getElementById('btn-profile-add-field');
  const btnPos = document.getElementById('btn-profile-toggle-pos');
  const btnDiv = document.getElementById('btn-profile-toggle-divider');
  const btnBg = document.getElementById('btn-profile-toggle-bg');

  if (btnAddField) {
    btnAddField.addEventListener('click', () => {
      state.metaFields.push({
        id: 'field_' + Date.now(),
        placeholder: '새 입력 항목 (예: 디스코드, 선호 장르 등)',
        value: ''
      });
      renderMetaFields();
    });
  }

  if (btnPos) {
    btnPos.addEventListener('click', () => {
      state.profilePos = (state.profilePos === 'left' ? 'right' : 'left');
      applyProfileLayout();
    });
  }

  if (btnDiv) {
    btnDiv.addEventListener('click', () => {
      state.profileDivider = !state.profileDivider;
      applyProfileLayout();
    });
  }

  if (btnBg) {
    btnBg.addEventListener('click', () => {
      state.profileBg = !state.profileBg;
      applyProfileLayout();
    });
  }
}

// 7. 컬러 커스텀 모달 (테마 프리셋 + 배경이미지 + 색상 피커)
function applyCustomColors() {
  const root = document.documentElement;
  root.style.setProperty('--canvas-bg', state.customColors.bg);
  root.style.setProperty('--card-bg', state.customColors.bg);
  root.style.setProperty('--input-bg', state.customColors.inputBg);
  root.style.setProperty('--border', state.customColors.border);
  root.style.setProperty('--text', state.customColors.text);
  root.style.setProperty('--accent', state.customColors.accent);
  root.style.setProperty('--profile-custom-bg', state.customColors.profBg);
}

function setupColorCustomModal() {
  const modal = document.getElementById('custom-color-modal');
  const btnOpen = document.getElementById('btn-open-color-picker');
  const btnClose = document.getElementById('btn-close-color-modal');
  const btnApply = document.getElementById('btn-apply-color');
  const btnReset = document.getElementById('btn-reset-color');
  const btnRemoveBgImg = document.getElementById('btn-remove-bg-img');

  const cpBg = document.getElementById('cp-bg');
  const cpInputBg = document.getElementById('cp-input-bg');
  const cpBorder = document.getElementById('cp-border');
  const cpText = document.getElementById('cp-text');
  const cpAccent = document.getElementById('cp-accent');
  const cpProfBg = document.getElementById('cp-prof-bg');

  const syncPickers = () => {
    if (cpBg) cpBg.value = state.customColors.bg;
    if (cpInputBg) cpInputBg.value = state.customColors.inputBg;
    if (cpBorder) cpBorder.value = state.customColors.border;
    if (cpText) cpText.value = state.customColors.text;
    if (cpAccent) cpAccent.value = state.customColors.accent;
    if (cpProfBg) cpProfBg.value = state.customColors.profBg;
    if (btnRemoveBgImg) {
      btnRemoveBgImg.style.display = state.bgDataUrl ? 'inline-flex' : 'none';
    }
  };

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      syncPickers();
      modal.style.display = 'flex';
    });
  }

  const closeModal = () => { modal.style.display = 'none'; };
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnApply) btnApply.addEventListener('click', closeModal);

  if (btnRemoveBgImg) {
    btnRemoveBgImg.addEventListener('click', () => {
      state.bgDataUrl = '';
      const card = document.getElementById('export-card');
      if (card) {
        card.style.backgroundImage = 'none';
        card.classList.remove('has-bg-image');
      }
      btnRemoveBgImg.style.display = 'none';
    });
  }

  const bindColorInput = (el, key) => {
    if (!el) return;
    el.addEventListener('input', (e) => {
      state.customColors[key] = e.target.value;
      applyCustomColors();
    });
  };

  bindColorInput(cpBg, 'bg');
  bindColorInput(cpInputBg, 'inputBg');
  bindColorInput(cpBorder, 'border');
  bindColorInput(cpText, 'text');
  bindColorInput(cpAccent, 'accent');
  bindColorInput(cpProfBg, 'profBg');

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.customColors = {
        bg: '#111827',
        inputBg: '#1e293b',
        border: '#334155',
        text: '#f8fafc',
        accent: '#38bdf8',
        profBg: '#1e293b'
      };
      syncPickers();
      applyCustomColors();
    });
  }
}

// 8. A타입 표 리사이저 및 배경 ON/OFF
function setupTableResizer() {
  const resizer = document.getElementById('a-resizer');
  const tableWrap = document.getElementById('mod-table');
  const container = document.getElementById('a-container');
  if (!resizer || !tableWrap || !container) return;

  let isResizing = false;

  resizer.addEventListener('mousedown', () => {
    if (state.orientation !== 'H') return;
    isResizing = true;
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const containerRect = container.getBoundingClientRect();
    const isTableFirst = (container.firstElementChild === tableWrap);

    let percent;
    if (isTableFirst) {
      const newWidth = e.clientX - containerRect.left;
      percent = (newWidth / containerRect.width) * 100;
    } else {
      const newWidth = containerRect.right - e.clientX;
      percent = (newWidth / containerRect.width) * 100;
    }

    if (percent >= 30 && percent <= 75) {
      state.tableWidthPercent = percent;
      tableWrap.style.width = `${percent}%`;
    }
  });

  window.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
    }
  });
}

// A 타입 모듈은 버튼으로 크기 조절을 활성화한 뒤 모서리 핸들로 조절한다.
function setupAModuleResizers() {
  const container = document.getElementById('a-container');
  if (!container) return;

  container.querySelectorAll('.inner-module').forEach(module => {
    const key = module?.id === 'mod-table' ? 'table' : 'comment';
    if (!module || !key) return;
    const handle = module.querySelector('.a-module-resize-handle');
    const limits = A_MODULE_SIZE_LIMITS[key];
    if (!handle) return;

    const toggle = module.querySelector('.btn-module-resize');
    toggle?.addEventListener('mousedown', (e) => e.stopPropagation());
    toggle?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const enabled = !module.classList.contains('resize-enabled');
      container.querySelectorAll('.inner-module.resize-enabled').forEach(other => {
        other.classList.remove('resize-enabled');
        const otherToggle = other.querySelector('.btn-module-resize');
        if (otherToggle) {
          otherToggle.setAttribute('aria-pressed', 'false');
          otherToggle.textContent = '↘ 크기 조절';
        }
      });
      module.classList.toggle('resize-enabled', enabled);
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.textContent = enabled ? '✓ 조절 완료' : '↘ 크기 조절';
    });

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      module.classList.add('is-resizing');
      const startX = e.clientX;
      const startY = e.clientY;
      const startRect = module.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const moduleSize = state.aModuleSizes[key];
      // 최초 조절 시의 크기를 기준점으로 보관한다. 누적 비율 대신 기준점으로
      // 계산해야 축소 후 다시 확대했을 때 내용 크기도 원래대로 돌아온다.
      if (!Number.isFinite(moduleSize.baseWidth)) moduleSize.baseWidth = startRect.width;
      if (!Number.isFinite(moduleSize.baseHeight)) moduleSize.baseHeight = startRect.height;
      const isHorizontal = state.orientation === 'H';

      const onMouseMove = (moveEvt) => {
        const widthPx = isHorizontal
          ? startRect.width
          : Math.max(limits.minWidth, Math.min(containerRect.width, startRect.width + moveEvt.clientX - startX));
        const heightPx = Math.max(limits.minHeight, Math.min(1200, startRect.height + moveEvt.clientY - startY));
        const nextScale = Math.max(0.2, Math.min(
          1,
          widthPx / moduleSize.baseWidth,
          heightPx / moduleSize.baseHeight
        ));

        if (!isHorizontal) {
          state.aModuleSizes[key].width = Math.round((widthPx / containerRect.width) * 1000) / 10;
          module.style.width = `${state.aModuleSizes[key].width}%`;
        }
        state.aModuleSizes[key].height = Math.round(heightPx);
        state.aModuleSizes[key].scale = nextScale;
        module.style.height = `${state.aModuleSizes[key].height}px`;
        module.style.flex = 'none';
        module.style.alignSelf = 'flex-start';
        applyAModuleContentScale(module, nextScale);
        if (key === 'comment') applyACommentContentFit();
      };
      const onMouseUp = () => {
        module.classList.remove('is-resizing');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  });
}

function setupACommentFitControl() {
  const button = document.getElementById('btn-fit-a-comment');
  if (!button) return;

  button.addEventListener('mousedown', (e) => e.stopPropagation());
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const commentSize = state.aModuleSizes.comment;
    commentSize.fitContent = !commentSize.fitContent;
    applyACommentContentFit();
  });
  applyACommentContentFit();
}

// 자유 입력 카드의 입력 영역만 모듈 높이에 맞춘다. 카드 자체를 flex로 눌러
// 넣지 않아 제목/선택 버튼/체크박스가 찌그러지지 않는다.
function applyACommentContentFit() {
  const module = document.getElementById('mod-comment');
  const button = document.getElementById('btn-fit-a-comment');
  const content = module?.querySelector('.a-module-content-scale');
  if (!module || !content || !button) return;

  const enabled = Boolean(state.aModuleSizes.comment.fitContent);
  module.classList.toggle('is-content-fitted', enabled);
  button.setAttribute('aria-pressed', String(enabled));
  button.textContent = enabled ? '✓ 입력창 맞춤' : '↕ 입력창 맞춤';

  if (!enabled) {
    content.style.height = '';
    content.querySelectorAll('textarea').forEach(textarea => { textarea.style.height = ''; });
    return;
  }

  const scale = Number.isFinite(state.aModuleSizes.comment.scale)
    ? state.aModuleSizes.comment.scale
    : 1;
  const dragBarHeight = module.querySelector('.module-drag-bar')?.offsetHeight ?? 0;
  if (module.clientHeight === 0) return;
  const verticalPadding = 24;
  const availableHeight = Math.max(80, module.clientHeight - dragBarHeight - verticalPadding) / Math.max(scale, 0.1);
  const cards = content.querySelectorAll('.qa-card-item');
  const textareas = content.querySelectorAll('textarea');
  const headerAndGaps = cards.length * 56 + Math.max(0, cards.length - 1) * 12 + 42;
  const textareaHeight = Math.max(65, Math.min(420, Math.floor((availableHeight - headerAndGaps) / Math.max(textareas.length, 1))));
  content.style.height = '';
  textareas.forEach(textarea => { textarea.style.height = `${textareaHeight}px`; });
}

// 크기가 고정된 자유 입력창에 새 카드를 더할 때 기존 입력창을 압축하지 않고,
// 새 카드가 필요한 만큼 모듈 높이를 아래로 늘린다.
function growACommentModuleForNewCard(currentTextareaHeight = 65) {
  const module = document.getElementById('mod-comment');
  const size = state.aModuleSizes.comment;
  if (!module || !Number.isFinite(size.height)) return;

  const scale = Number.isFinite(size.scale) ? size.scale : 1;
  const newCardHeight = 56 + 12 + Math.max(65, currentTextareaHeight);
  const addedHeight = Math.ceil(newCardHeight * Math.max(scale, 0.2));
  size.height += addedHeight;
  module.style.height = `${size.height}px`;
}

function applyAModuleContentScale(module, scale = 1) {
  const content = module.querySelector('.a-module-content-scale');
  if (!content) return;
  content.style.transform = `scale(${scale})`;
  content.style.transformOrigin = 'top left';
  content.style.width = `${100 / scale}%`;
}

function setupModuleSizeReset() {
  const button = document.getElementById('btn-reset-module-sizes');
  if (!button) return;
  button.addEventListener('click', () => {
    state.aModuleSizes = {
      table: { width: null, height: null, scale: 1, baseWidth: null, baseHeight: null },
      comment: {
        width: null,
        height: null,
        scale: 1,
        baseWidth: null,
        baseHeight: null,
        fitContent: state.aModuleSizes.comment.fitContent
      }
    };
    ['mod-table', 'mod-comment'].forEach(id => {
      const module = document.getElementById(id);
      if (!module) return;
      module.style.width = '';
      module.style.height = '';
      module.style.flex = '';
      module.style.alignSelf = '';
      applyAModuleContentScale(module, 1);
    });
    applyOrientation(state.orientation);
    applyACommentContentFit();
  });
}

function applyAModuleSizes() {
  const sizes = state.aModuleSizes;
  [['table', 'mod-table'], ['comment', 'mod-comment']].forEach(([key, id]) => {
    const module = document.getElementById(id);
    const size = sizes[key];
    if (!module || !size) return;
    if (state.orientation !== 'H' && Number.isFinite(size.width)) {
      module.style.width = `${size.width}%`;
    } else if (state.orientation === 'H' && key === 'comment') {
      module.style.width = '';
    }
    if (Number.isFinite(size.height)) {
      module.style.height = `${size.height}px`;
      module.style.flex = 'none';
      module.style.alignSelf = 'flex-start';
    }
    applyAModuleContentScale(module, Number.isFinite(size.scale) ? size.scale : 1);
  });
  applyACommentContentFit();
}

function setupTableFitToggle() {
  const chk = document.getElementById('chk-a-fit');
  const tableWrap = document.getElementById('mod-table');
  if (!chk || !tableWrap) return;

  chk.addEventListener('change', (e) => {
    state.tableFitFill = e.target.checked;
    tableWrap.classList.toggle('fit-fill', state.tableFitFill);
  });
}

function setupTableBgControl() {
  const btnToggle = document.getElementById('btn-table-toggle-bg');
  const tableWrap = document.getElementById('mod-table');
  if (!btnToggle || !tableWrap) return;

  const updateTableBg = () => {
    tableWrap.classList.toggle('has-bg', state.tableBg);
    btnToggle.innerText = `배경: ${state.tableBg ? 'ON' : 'OFF'}`;
  };

  btnToggle.addEventListener('click', () => {
    state.tableBg = !state.tableBg;
    updateTableBg();
  });

  updateTableBg();
}

function setupACommentToggle() {
  const chk = document.getElementById('chk-a-comment');
  const box = document.getElementById('mod-comment');
  const resizer = document.getElementById('a-resizer');

  if (chk && box) {
    chk.addEventListener('change', (e) => {
      state.showAComment = e.target.checked;
      box.style.display = state.showAComment ? '' : 'none';
      if (resizer) resizer.style.display = (state.layout === 'A' && state.showAComment && state.orientation === 'H') ? 'flex' : 'none';
      if (state.showAComment) window.requestAnimationFrame(applyACommentContentFit);
    });
  }
}

// 9. 카드 공통 렌더링 및 개별 모듈화(드래그 앤 드롭)
function createMovableCard(itemData, idx, dataList, refreshCallback) {
  const card = document.createElement('div');
  card.className = 'qa-card-item';
  card.dataset.index = idx;

  card.innerHTML = `
    <div class="qa-top-row">
      <span class="card-item-drag-handle" title="잡고 드래그하여 순서 변경">⠿</span>
      <input type="text" class="oval-title-input" value="${itemData.title}" />
      <div class="qa-control-actions">
        <select class="type-selector">
          <option value="textarea" ${itemData.type === 'textarea' ? 'selected' : ''}>글자입력창</option>
          <option value="list" ${itemData.type === 'list' ? 'selected' : ''}>목록형 (1.2.3)</option>
          <option value="checkbox" ${itemData.type === 'checkbox' ? 'selected' : ''}>체크박스</option>
          <option value="dropdown" ${itemData.type === 'dropdown' ? 'selected' : ''}>드롭다운</option>
        </select>
        <button type="button" class="btn-del-qa" style="background:#ef4444; border:none; color:#fff; border-radius:4px; padding:2px 8px; cursor:pointer;">✕</button>
      </div>
    </div>
    <div class="qa-body"></div>
  `;

  card.querySelector('.oval-title-input').addEventListener('input', (e) => {
    itemData.title = e.target.value;
  });

  card.querySelector('.type-selector').addEventListener('change', (e) => {
    itemData.type = e.target.value;
    if (itemData.type === 'list' && !Array.isArray(itemData.value)) itemData.value = ['', '', ''];
    if (itemData.type === 'checkbox' && !itemData.items) {
      itemData.items = ['옵션 1', '옵션 2', '옵션 3'];
      itemData.checked = [0];
    }
    if (itemData.type === 'dropdown' && !itemData.items) {
      itemData.items = ['선택 항목 1', '선택 항목 2'];
      itemData.value = itemData.items[0];
    }
    renderCardContent(card.querySelector('.qa-body'), itemData);
  });

  card.querySelector('.btn-del-qa').onclick = () => {
    dataList.splice(idx, 1);
    refreshCallback();
  };

  renderCardContent(card.querySelector('.qa-body'), itemData);
  return card;
}

function renderCardContent(bodyEl, qa) {
  bodyEl.innerHTML = '';

  if (qa.type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.value = qa.value || '';
    ta.placeholder = '내용을 입력하세요.';
    ta.addEventListener('input', (e) => { qa.value = e.target.value; });
    bodyEl.appendChild(ta);
  } 
  else if (qa.type === 'list') {
    const listWrap = document.createElement('div');
    listWrap.className = 'list-inputs';
    const arr = Array.isArray(qa.value) ? qa.value : ['', '', ''];
    [0, 1, 2].forEach(i => {
      const inp = document.createElement('input');
      inp.placeholder = `${i + 1}. 항목 입력`;
      inp.value = arr[i] || '';
      inp.addEventListener('input', (e) => {
        arr[i] = e.target.value;
        qa.value = arr;
      });
      listWrap.appendChild(inp);
    });
    bodyEl.appendChild(listWrap);
  } 
  else if (qa.type === 'checkbox') {
    qa.items = qa.items || ['옵션 1', '옵션 2', '옵션 3'];
    qa.checked = qa.checked || [];

    const wrap = document.createElement('div');
    wrap.className = 'chip-options-editable';

    const renderChips = () => {
      wrap.innerHTML = '';
      qa.items.forEach((itemText, cIdx) => {
        const isChecked = qa.checked.includes(cIdx);
        const chipBox = document.createElement('div');
        chipBox.className = `custom-chip-edit ${isChecked ? 'checked' : ''}`;

        chipBox.innerHTML = `
          <span class="chip-text-btn">${itemText}</span>
          <span class="chip-del-btn" title="항목 삭제">×</span>
        `;

        chipBox.addEventListener('click', (e) => {
          if (e.target.classList.contains('chip-del-btn')) return;
          if (qa.checked.includes(cIdx)) {
            qa.checked = qa.checked.filter(i => i !== cIdx);
          } else {
            qa.checked.push(cIdx);
          }
          renderChips();
        });

        const textSpan = chipBox.querySelector('.chip-text-btn');
        textSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const newText = prompt("옵션 이름을 수정하세요:", itemText);
          if (newText && newText.trim()) {
            qa.items[cIdx] = newText.trim();
            renderChips();
          }
        });

        chipBox.querySelector('.chip-del-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          qa.items.splice(cIdx, 1);
          qa.checked = qa.checked.filter(i => i !== cIdx).map(i => (i > cIdx ? i - 1 : i));
          renderChips();
        });

        wrap.appendChild(chipBox);
      });

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'chip-add-btn';
      addBtn.innerText = '+ 옵션 추가';
      addBtn.addEventListener('click', () => {
        const newName = prompt("추가할 옵션 이름을 입력하세요:", `새 옵션 ${qa.items.length + 1}`);
        if (newName && newName.trim()) {
          qa.items.push(newName.trim());
          renderChips();
        }
      });
      wrap.appendChild(addBtn);
    };

    renderChips();
    bodyEl.appendChild(wrap);
  } 
  else if (qa.type === 'dropdown') {
    qa.items = qa.items || ['옵션 1', '옵션 2', '옵션 3'];
    qa.value = qa.value || qa.items[0];

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '6px';

    const sel = document.createElement('select');
    sel.className = 'type-selector qa-dropdown-select';
    sel.style.width = '100%';

    const badge = document.createElement('div');
    badge.className = 'dropdown-captured-badge';
    badge.innerText = qa.value;

    const refreshSelect = () => {
      sel.innerHTML = '';
      qa.items.forEach(opt => {
        const optEl = document.createElement('option');
        optEl.value = opt;
        optEl.innerText = opt;
        if (opt === qa.value) optEl.selected = true;
        sel.appendChild(optEl);
      });
      badge.innerText = qa.value;
    };
    refreshSelect();

    sel.addEventListener('change', (e) => {
      qa.value = e.target.value;
      badge.innerText = qa.value;
    });

    const editorWrap = document.createElement('div');
    editorWrap.className = 'dropdown-editor-wrap';
    editorWrap.style.display = 'flex';
    editorWrap.style.flexDirection = 'column';
    editorWrap.style.gap = '4px';

    const editLabel = document.createElement('div');
    editLabel.style.fontSize = '0.75rem';
    editLabel.style.color = 'var(--subtext)';
    editLabel.innerText = '선택지 목록 편집 (쉼표로 구분):';

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'editable-dropdown-items';
    editInput.value = qa.items.join(', ');

    editInput.addEventListener('input', (e) => {
      const newItems = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
      if (newItems.length > 0) {
        qa.items = newItems;
        if (!qa.items.includes(qa.value)) qa.value = qa.items[0];
        refreshSelect();
      }
    });

    editorWrap.appendChild(editLabel);
    editorWrap.appendChild(editInput);

    wrap.appendChild(sel);
    wrap.appendChild(badge);
    wrap.appendChild(editorWrap);
    bodyEl.appendChild(wrap);
  }
}

function bindItemDragEvents(container, dataList, refreshCallback) {
  let draggedCard = null;

  container.querySelectorAll('.qa-card-item').forEach(card => {
    const handle = card.querySelector('.card-item-drag-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      card.draggable = true;
    });

    card.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      draggedCard = card;
      card.classList.add('item-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.index);
    });

    card.addEventListener('dragend', (e) => {
      e.stopPropagation();
      card.draggable = false;
      card.classList.remove('item-dragging');
      draggedCard = null;

      const newIndices = Array.from(container.querySelectorAll('.qa-card-item'))
        .map(el => Number(el.dataset.index))
        .filter(n => !isNaN(n));
        
      if (newIndices.length === dataList.length) {
        const reordered = newIndices.map(i => dataList[i]);
        dataList.length = 0;
        dataList.push(...reordered);
        refreshCallback();
      }
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedCard || draggedCard === card) return;

      const rect = card.getBoundingClientRect();
      const isPastHalfY = (e.clientY - rect.top) > (rect.height / 2);
      const isPastHalfX = (e.clientX - rect.left) > (rect.width / 2);
      const insertAfter = isPastHalfY || isPastHalfX;

      if (insertAfter) {
        container.insertBefore(draggedCard, card.nextSibling);
      } else {
        container.insertBefore(draggedCard, card);
      }
    });
  });
}

// 10. A타입 자유 입력창 컴포넌트
function setupACommentComponent() {
  const container = document.getElementById('a-comment-container');
  const btnAdd = document.getElementById('btn-add-a-comment');
  if (!container || !btnAdd) return;

  function render() {
    container.innerHTML = '';
    state.aCommentList.forEach((item, idx) => {
      const card = createMovableCard(item, idx, state.aCommentList, render);
      container.appendChild(card);
    });
    bindItemDragEvents(container, state.aCommentList, render);
    window.requestAnimationFrame(applyACommentContentFit);
  }

  btnAdd.onclick = () => {
    const firstTextarea = container.querySelector('textarea');
    const scale = Number.isFinite(state.aModuleSizes.comment.scale)
      ? state.aModuleSizes.comment.scale
      : 1;
    const currentTextareaHeight = firstTextarea
      ? Math.max(65, firstTextarea.getBoundingClientRect().height / Math.max(scale, 0.1))
      : 65;
    state.aCommentList.push({ title: "Q. 새로운 질문", type: "textarea", value: "" });
    growACommentModuleForNewCard(currentTextareaHeight);
    render();
  };

  render();
}

// 11. B타입 Q&A 컴포넌트
function setupQAComponent() {
  const container = document.getElementById('qa-container');
  const btnAdd = document.getElementById('btn-add-qa');
  if (!container || !btnAdd) return;

  function render() {
    container.innerHTML = '';
    state.qaList.forEach((qa, idx) => {
      const card = createMovableCard(qa, idx, state.qaList, render);
      container.appendChild(card);
    });
    bindItemDragEvents(container, state.qaList, render);
  }

  btnAdd.onclick = () => {
    state.qaList.push({ title: "Q. 새로운 질문", type: "textarea", value: "" });
    render();
  };

  render();
}

// 12. 테마 프리셋 전환
function setupTheme() {
  const selector = document.getElementById('theme-selector');
  if (selector) {
    selector.addEventListener('change', (e) => {
      state.theme = e.target.value;
      document.documentElement.setAttribute('data-theme', state.theme);
      ['--canvas-bg', '--card-bg', '--input-bg', '--border', '--text', '--accent', '--profile-custom-bg'].forEach(prop => {
        document.documentElement.style.removeProperty(prop);
      });
    });
  }
}

function setupUploads() {
  const inputBg = document.getElementById('input-bg-file');
  if (inputBg) {
    inputBg.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        state.bgDataUrl = ev.target.result;
        const card = document.getElementById('export-card');
        if (card) {
          card.style.backgroundImage = `url(${state.bgDataUrl})`;
          card.classList.add('has-bg-image');
        }
        const btnRemove = document.getElementById('btn-remove-bg-img');
        if (btnRemove) btnRemove.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    });
  }

  const inputFree = document.getElementById('input-free-image');
  if (inputFree) {
    inputFree.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => layerMgr.addImage(ev.target.result, 'front');
      reader.readAsDataURL(file);
    });
  }

  const btnClear = document.getElementById('btn-clear-images');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (confirm("추가한 모든 자유 이미지를 삭제하시겠습니까?")) {
        layerMgr.clearAll();
      }
    });
  }

  // 아바타 크롭 모달
  const inputAvatar = document.getElementById('input-avatar-file');
  const cropModal = document.getElementById('avatar-crop-modal');
  const cropImg = document.getElementById('crop-target-img');
  const zoomRange = document.getElementById('crop-zoom-range');
  const viewport = document.getElementById('crop-viewport');
  const avatarPreview = document.getElementById('avatar-preview');
  const avatarLabel = document.getElementById('avatar-label');

  let cropState = { x: 0, y: 0, scale: 1, baseW: 0, baseH: 0, rawSrc: '' };

  const updateCropTransform = () => {
    if (cropImg) cropImg.style.transform = `translate(${cropState.x}px, ${cropState.y}px) scale(${cropState.scale})`;
  };

  if (inputAvatar) {
    inputAvatar.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = ev => {
        cropState.rawSrc = ev.target.result;
        if (cropImg) cropImg.src = cropState.rawSrc;

        if (cropImg) {
          cropImg.onload = () => {
            const aspect = cropImg.naturalWidth / cropImg.naturalHeight;
            if (aspect >= 1) {
              cropState.baseH = 200;
              cropState.baseW = 200 * aspect;
            } else {
              cropState.baseW = 200;
              cropState.baseH = 200 / aspect;
            }
            cropImg.style.width = `${cropState.baseW}px`;
            cropImg.style.height = `${cropState.baseH}px`;
            
            cropState.scale = 1;
            cropState.x = (200 - cropState.baseW) / 2;
            cropState.y = (200 - cropState.baseH) / 2;
            if (zoomRange) zoomRange.value = 1;
            updateCropTransform();

            if (cropModal) cropModal.style.display = 'flex';
          };
        }
      };
      reader.readAsDataURL(file);
    });
  }

  let isDraggingCrop = false;
  let startX = 0, startY = 0;

  if (viewport) {
    viewport.addEventListener('mousedown', (e) => {
      isDraggingCrop = true;
      startX = e.clientX - cropState.x;
      startY = e.clientY - cropState.y;
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingCrop) return;
    cropState.x = e.clientX - startX;
    cropState.y = e.clientY - startY;
    updateCropTransform();
  });

  window.addEventListener('mouseup', () => { isDraggingCrop = false; });

  if (zoomRange) {
    zoomRange.addEventListener('input', (e) => {
      cropState.scale = parseFloat(e.target.value);
      updateCropTransform();
    });
  }

  const closeModal = () => {
    if (cropModal) cropModal.style.display = 'none';
    if (inputAvatar) inputAvatar.value = '';
  };
  const btnClose = document.getElementById('btn-modal-close');
  const btnCancel = document.getElementById('btn-crop-cancel');
  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;

  const btnApply = document.getElementById('btn-crop-apply');
  if (btnApply) {
    btnApply.onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');

      const tempImg = new Image();
      tempImg.onload = () => {
        ctx.drawImage(
          tempImg,
          cropState.x,
          cropState.y,
          cropState.baseW * cropState.scale,
          cropState.baseH * cropState.scale
        );
        state.avatarDataUrl = canvas.toDataURL('image/png');
        if (avatarPreview) {
          avatarPreview.src = state.avatarDataUrl;
          avatarPreview.style.display = 'block';
          avatarPreview.style.transform = 'none';
        }
        if (avatarLabel) avatarLabel.style.display = 'none';
        closeModal();
      };
      tempImg.src = cropState.rawSrc;
    };
  }

  const btnExport = document.getElementById('btn-export-png');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportCardAsPNG('export-card', `게임성향표_${Date.now()}.png`);
    });
  }
}

// 13. A타입 표 컴포넌트
function setupMatrixTable() {
  const tbody = document.getElementById('matrix-table-body');
  const btnAdd = document.getElementById('btn-add-table-row');
  if (!tbody || !btnAdd) return;

  function renderRows() {
    tbody.innerHTML = '';
    state.matrixRows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-label">
          <input type="text" class="editable-cell-td" value="${row.title}" />
        </td>
        <td class="td-radio"><input type="radio" name="chk_${idx}" value="1" ${row.value === '1' ? 'checked' : ''} /></td>
        <td class="td-radio"><input type="radio" name="chk_${idx}" value="2" ${row.value === '2' ? 'checked' : ''} /></td>
        <td class="td-radio"><input type="radio" name="chk_${idx}" value="3" ${row.value === '3' ? 'checked' : ''} /></td>
        <td class="td-del-action">
          <button type="button" class="matrix-row-del-btn" title="항목 삭제">✕</button>
        </td>
      `;

      const textInput = tr.querySelector('.editable-cell-td');
      textInput.addEventListener('input', (e) => {
        row.title = e.target.value;
      });

      tr.querySelectorAll(`input[name="chk_${idx}"]`).forEach(radio => {
        radio.addEventListener('change', (e) => {
          row.value = e.target.value;
        });
      });

      tr.querySelector('.matrix-row-del-btn').addEventListener('click', () => {
        state.matrixRows.splice(idx, 1);
        renderRows();
      });

      tbody.appendChild(tr);
    });
  }

  btnAdd.addEventListener('click', () => {
    state.matrixRows.push({
      title: `✨ 새로운 체크 항목`,
      value: "2"
    });
    renderRows();
  });

  renderRows();
}

// 14. 모듈형 드래그 앤 드롭
function setupModuleDragAndDrop() {
  bindDragEvents(document.getElementById('module-container'), '.draggable-module', false);
  bindDragEvents(document.getElementById('a-container'), '.inner-module', true);
}

function bindDragEvents(container, itemSelector, checkHorizontal) {
  if (!container) return;

  let draggedItem = null;

  container.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.module-drag-bar');
    const targetItem = e.target.closest(itemSelector);
    if (targetItem && targetItem.parentNode === container) {
      targetItem.draggable = !!handle;
    }
  });

  container.addEventListener('dragstart', (e) => {
    const targetItem = e.target.closest(itemSelector);
    if (!targetItem || targetItem.parentNode !== container) {
      return;
    }
    if (!targetItem.draggable) {
      e.preventDefault();
      return;
    }
    draggedItem = targetItem;
    targetItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragend', (e) => {
    const targetItem = e.target.closest(itemSelector);
    if (targetItem) {
      targetItem.classList.remove('dragging');
      targetItem.draggable = false;
    }
    draggedItem = null;

    if (container.id === 'a-container') {
      const resizer = document.getElementById('a-resizer');
      const innerModules = container.querySelectorAll('.inner-module');
      if (resizer && innerModules.length === 2) {
        container.insertBefore(resizer, innerModules[1]);
      }
    }
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedItem) return;

    const targetItem = e.target.closest(itemSelector);
    if (!targetItem || targetItem === draggedItem || targetItem.parentNode !== container) return;

    const rect = targetItem.getBoundingClientRect();
    const isHorizontal = checkHorizontal && state.orientation === 'H';

    const shouldInsertAfter = isHorizontal
      ? (e.clientX - rect.left) / rect.width > 0.5
      : (e.clientY - rect.top) / rect.height > 0.5;

    if (shouldInsertAfter) {
      container.insertBefore(draggedItem, targetItem.nextElementSibling);
    } else {
      container.insertBefore(draggedItem, targetItem);
    }
  });
}

// 15. 식별코드 발급/복원
function setupShareCode() {
  const btnGen = document.getElementById('btn-gen-code');
  const btnLoad = document.getElementById('btn-load-code');
  if (!btnGen || !btnLoad) return;

  btnGen.addEventListener('click', () => {
    const tableLabels = Array.from(document.querySelectorAll('#layout-a input[type="text"]')).map(el => el.value);

    const exportData = {
      layout: state.layout,
      orientation: state.orientation,
      showAComment: state.showAComment,
      tableFitFill: state.tableFitFill,
      tableWidthPercent: state.tableWidthPercent,
      aModuleSizes: state.aModuleSizes,
      tableBg: state.tableBg,
      profileSize: state.profileSize,
      bInputScale: state.bInputScale,
      profilePos: state.profilePos,
      profileDivider: state.profileDivider,
      profileBg: state.profileBg,
      metaFields: state.metaFields,
      aCommentList: state.aCommentList,
      customColors: state.customColors,
      theme: state.theme,
      avatarDataUrl: state.avatarDataUrl,
      bgDataUrl: state.bgDataUrl,
      matrixRows: state.matrixRows,
      tableLabels,
      qaList: state.qaList,
      stickers: layerMgr.getSerialized()
    };

    const code = generateCode(exportData);
    if (!code) return;
    const shareInput = document.getElementById('share-code-input');
    if (shareInput) shareInput.value = code;
    navigator.clipboard.writeText(code).then(() => {
      alert("식별코드가 발급되어 복사되었습니다!\n(발급 시점으로부터 7일간 유효합니다)");
    });
  });

  btnLoad.addEventListener('click', () => {
    const inputEl = document.getElementById('share-code-input');
    const code = inputEl ? inputEl.value : '';
    if (!code.trim()) {
      alert("식별코드를 입력해 주세요.");
      return;
    }

    const res = parseCode(code);
    if (!res.success) {
      alert(res.message);
      return;
    }

    const data = res.data;

    try {
      if (data.theme) {
        state.theme = data.theme;
        document.documentElement.setAttribute('data-theme', data.theme);
        const sel = document.getElementById('theme-selector');
        if (sel) sel.value = data.theme;
      }

      if (data.orientation) {
        applyOrientation(data.orientation);
      }

      if (data.layout) {
        applyLayout(data.layout);
      }

      if (data.profileSize) {
        setProfileSize(data.profileSize);
      }

      if (data.bInputScale) {
        setBInputScale(data.bInputScale);
      }

      if (data.profilePos) state.profilePos = data.profilePos;
      if (data.profileDivider !== undefined) state.profileDivider = data.profileDivider;
      if (data.profileBg !== undefined) state.profileBg = data.profileBg;
      applyProfileLayout();

      if (data.tableBg !== undefined) {
        state.tableBg = data.tableBg;
        const tableWrap = document.getElementById('mod-table');
        const btnToggle = document.getElementById('btn-table-toggle-bg');
        if (tableWrap) tableWrap.classList.toggle('has-bg', state.tableBg);
        if (btnToggle) btnToggle.innerText = `배경: ${state.tableBg ? 'ON' : 'OFF'}`;
      }

      if (data.metaFields && Array.isArray(data.metaFields)) {
        state.metaFields = data.metaFields;
        renderMetaFields();
      }

      if (data.aCommentList && Array.isArray(data.aCommentList)) {
        state.aCommentList = data.aCommentList;
        setupACommentComponent();
      }

      if (data.customColors) {
        state.customColors = data.customColors;
        applyCustomColors();
      }

      if (data.tableWidthPercent) {
        state.tableWidthPercent = data.tableWidthPercent;
        const tableWrap = document.getElementById('mod-table');
        if (tableWrap && state.orientation === 'H') tableWrap.style.width = `${data.tableWidthPercent}%`;
      }

      if (data.aModuleSizes && typeof data.aModuleSizes === 'object') {
        ['table', 'comment'].forEach(key => {
          const size = data.aModuleSizes[key];
          if (!size || typeof size !== 'object') return;
          state.aModuleSizes[key] = {
            width: Number.isFinite(size.width) ? size.width : null,
            height: Number.isFinite(size.height) ? size.height : null,
            scale: Number.isFinite(size.scale) ? size.scale : 1,
            baseWidth: Number.isFinite(size.baseWidth) ? size.baseWidth : null,
            baseHeight: Number.isFinite(size.baseHeight) ? size.baseHeight : null,
            ...(key === 'comment' ? { fitContent: Boolean(size.fitContent) } : {})
          };
        });
        applyAModuleSizes();
      }

      if (data.tableFitFill !== undefined) {
        state.tableFitFill = data.tableFitFill;
        const chkFit = document.getElementById('chk-a-fit');
        if (chkFit) chkFit.checked = data.tableFitFill;
        const tableWrap = document.getElementById('mod-table');
        if (tableWrap) tableWrap.classList.toggle('fit-fill', data.tableFitFill);
      }

      if (data.showAComment !== undefined) {
        state.showAComment = data.showAComment;
        const chk = document.getElementById('chk-a-comment');
        if (chk) chk.checked = data.showAComment;
        const box = document.getElementById('mod-comment');
        if (box) box.style.display = data.showAComment ? '' : 'none';
        const resizer = document.getElementById('a-resizer');
        if (resizer) resizer.style.display = (state.layout === 'A' && data.showAComment && state.orientation === 'H') ? 'flex' : 'none';
      }

      if (data.avatarDataUrl) {
        state.avatarDataUrl = data.avatarDataUrl;
        const preview = document.getElementById('avatar-preview');
        if (preview) {
          preview.src = data.avatarDataUrl;
          preview.style.display = 'block';
        }
        const lbl = document.getElementById('avatar-label');
        if (lbl) lbl.style.display = 'none';
      }

      const cardEl = document.getElementById('export-card');
      if (cardEl) {
        if (data.bgDataUrl && data.bgDataUrl.trim()) {
          state.bgDataUrl = data.bgDataUrl;
          cardEl.style.backgroundImage = `url(${data.bgDataUrl})`;
          cardEl.classList.add('has-bg-image');
          const btnRemove = document.getElementById('btn-remove-bg-img');
          if (btnRemove) btnRemove.style.display = 'inline-flex';
        } else {
          state.bgDataUrl = '';
          cardEl.style.backgroundImage = 'none';
          cardEl.classList.remove('has-bg-image');
          const btnRemove = document.getElementById('btn-remove-bg-img');
          if (btnRemove) btnRemove.style.display = 'none';
        }
      }

      if (data.matrixRows && Array.isArray(data.matrixRows)) {
        state.matrixRows = data.matrixRows;
        setupMatrixTable();
      }

      if (data.tableLabels && Array.isArray(data.tableLabels)) {
        const inputs = document.querySelectorAll('#layout-a input[type="text"]');
        data.tableLabels.forEach((val, i) => { if (inputs[i]) inputs[i].value = val; });
      }

      if (data.qaList && Array.isArray(data.qaList)) {
        state.qaList = data.qaList;
        setupQAComponent();
      }

      if (data.stickers) {
        layerMgr.loadSerialized(data.stickers);
      }

      alert("데이터가 정상적으로 복원되었습니다!");
    } catch (e) {
      console.error("복원 중 오류 발생:", e);
      alert("데이터 복원 중 일부 속성을 불러오지 못했습니다.");
    }
  });
}
