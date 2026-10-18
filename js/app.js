import { LayerManager } from './layerManager.js';
import { generateCode, parseCode } from './storage.js';
import { createCardPreview, exportCardAsPNG } from './export.js';

// 기능 수정 시 이 번호를 올리면 페이지 상단 표기도 함께 갱신된다.
const APP_VERSION = '1.0.4';

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
  bCenterLine: false,
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
  const versionLabel = document.getElementById('app-version');
  if (versionLabel) versionLabel.textContent = APP_VERSION;
  setupPrivacyNotice();
  setupLayoutSwitch();
  setupOrientationSwitch();
  setupProfileSizeButtons();
  setupBInputScaleButtons();
  setupProfileModuleControls();
  setupColorCustomModal();
  setupACommentToggle();
  setupACommentComponent();
  setupACommentAutoFitObserver();
  setupRichTextToolbar();
  setupTableResizer();
  setupAModuleResizers();
  setupACommentFitControl();
  setupModuleSizeReset();
  setupModuleFitToCard();
  setupTableFitToggle();
  setupTableBgControl();
  setupTheme();
  setupUploads();
  setupMatrixTable();
  setupQAComponent();
  setupBCenterLineControl();
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
  const toolACommentFit = document.getElementById('tool-a-comment-fit-wrap');
  const toolBScale = document.getElementById('tool-b-scale-wrap');
  const btnResetModuleSizes = document.getElementById('btn-reset-module-sizes');
  const btnFitModulesToCard = document.getElementById('btn-fit-modules-to-card');

  const isA = (mode === 'A');

  if (tabA) tabA.classList.toggle('active', isA);
  if (tabB) tabB.classList.toggle('active', !isA);

  if (viewA) viewA.style.display = isA ? 'flex' : 'none';
  if (viewB) viewB.style.display = isA ? 'none' : 'block';
  
  if (toolAComment) toolAComment.style.display = isA ? 'inline-flex' : 'none';
  if (toolAFit) toolAFit.style.display = isA ? 'inline-flex' : 'none';
  if (toolACommentFit) toolACommentFit.style.display = isA ? 'inline-flex' : 'none';
  if (toolBScale) toolBScale.style.display = isA ? 'none' : 'inline-flex';
  if (btnResetModuleSizes) btnResetModuleSizes.style.display = isA ? 'inline-flex' : 'none';
  if (btnFitModulesToCard) btnFitModulesToCard.style.display = isA ? 'inline-flex' : 'none';

  const resizer = document.getElementById('a-resizer');
  if (resizer) {
    resizer.style.display = (isA && state.showAComment && state.orientation === 'H') ? 'flex' : 'none';
  }
  if (isA) window.requestAnimationFrame(applyACommentContentFit);
  window.requestAnimationFrame(scheduleBCenterDividers);
}

// 3. 가로/세로 방향 전환
function applyOrientation(orient, preserveModuleSizes = false) {
  const previousOrientation = state.orientation;
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

  // 방향이 바뀌면 이전 방향의 수동 픽셀 크기는 새 축에서 유효하지 않아
  // 모듈이 카드 밖으로 튀어나온다. 사용자 클릭 전환에서는 안전한 기본값으로 되돌린다.
  if (!preserveModuleSizes && previousOrientation !== orient) {
    const commentFit = Boolean(state.aModuleSizes.comment.fitContent);
    state.aModuleSizes = {
      table: { width: null, height: null, scale: 1, baseWidth: null, baseHeight: null },
      comment: { width: null, height: null, scale: 1, baseWidth: null, baseHeight: null, fitContent: commentFit }
    };
    ['mod-table', 'mod-comment'].forEach((id) => {
      const module = document.getElementById(id);
      if (!module) return;
      module.style.width = '';
      module.style.height = '';
      module.style.flex = '';
      module.style.alignSelf = '';
      applyAModuleContentScale(module, 1);
    });
  }

  // 표 너비 리사이즈 값은 가로 모드 전용이다. 세로 모드에서는 100% 폭을 사용한다.
  syncAHorizontalModuleSplit();
  applyAModuleSizes();
  scheduleBCenterDividers();
  // 배경 맞춤을 사용 중인 상태에서 가로/세로를 바꿔도 모듈이 새 배경 범위를 넘지 않게 한다.
  if (card?.classList.contains('module-fit-locked')) fitAModulesToBackground(card);
}

// A 타입 가로형은 중앙선이 관리하는 비율을 flex-basis에 즉시 반영해 두 모듈이
// 카드의 유효 너비를 빈틈없이 나눠 갖는다.
function syncAHorizontalModuleSplit() {
  const table = document.getElementById('mod-table');
  const comment = document.getElementById('mod-comment');
  if (!table || !comment) return;

  if (state.orientation !== 'H') {
    table.style.flexBasis = '';
    if (!Number.isFinite(state.aModuleSizes.table.height)) table.style.flex = '';
    if (!Number.isFinite(state.aModuleSizes.comment.height)) comment.style.flex = '';
    return;
  }

  const percent = Math.max(30, Math.min(70, Number(state.tableWidthPercent) || 55));
  state.tableWidthPercent = percent;
  table.style.flex = `0 0 ${percent}%`;
  table.style.width = `${percent}%`;
  comment.style.flex = '1 1 0';
  comment.style.width = '';
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
  
  const sizePx = isLarge ? 110 : 85;
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
  // transform 확대는 레이아웃 상의 실제 크기를 바꾸지 않아 다른 카드와 겹친다.
  // B 타입 범위에서만 CSS 변수를 바꾸는 클래스로 실제 여백과 글자를 함께 확장한다.
  document.getElementById('layout-b')?.classList.toggle('scale-large', isLarge);

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

  let activePointerId = null;

  const resize = (e) => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    const containerRect = container.getBoundingClientRect();
    if (!containerRect.width) return;

    // DOM 순서가 바뀌어도 첫 모듈을 기준으로 표의 실제 폭을 계산한다.
    const modules = Array.from(container.children)
      .filter((child) => child.classList.contains('inner-module'));
    const isTableFirst = modules[0] === tableWrap;
    const cursorWidth = isTableFirst
      ? e.clientX - containerRect.left
      : containerRect.right - e.clientX;

    // 표/입력창 모두 최소 폭을 지키고, 컨테이너의 30~70% 안에서만 움직인다.
    const dividerWidth = resizer.getBoundingClientRect().width || 20;
    const tableMin = 260;
    const commentMin = 240;
    const minWidth = Math.max(containerRect.width * 0.3, tableMin);
    const maxWidth = Math.min(
      containerRect.width * 0.7,
      containerRect.width - dividerWidth - commentMin
    );
    // 비정상적으로 좁은 데스크톱 폭에서도 역전된 경계값 때문에 튀지 않게 한다.
    const safeMaxWidth = Math.max(minWidth, maxWidth);
    const clampedWidth = Math.max(minWidth, Math.min(safeMaxWidth, cursorWidth));
    state.tableWidthPercent = (clampedWidth / containerRect.width) * 100;
    syncAHorizontalModuleSplit();
    // 가로 분할 비율 변화로 남는 세로 공간은 입력 영역이 즉시 채운다.
    window.requestAnimationFrame(applyACommentContentFit);
  };

  const stopResize = (e) => {
    if (activePointerId === null || (e && e.pointerId !== activePointerId)) return;
    if (resizer.hasPointerCapture(activePointerId)) resizer.releasePointerCapture(activePointerId);
    activePointerId = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  resizer.addEventListener('pointerdown', (e) => {
    if (state.orientation !== 'H' || e.button !== 0) return;
    e.preventDefault();
    activePointerId = e.pointerId;
    resizer.setPointerCapture(activePointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  resizer.addEventListener('pointermove', resize);
  resizer.addEventListener('pointerup', stopResize);
  resizer.addEventListener('pointercancel', stopResize);
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
      const cardRect = module.closest('.card-canvas')?.getBoundingClientRect() || containerRect;
      const moduleSize = state.aModuleSizes[key];
      // 최초 조절 시의 크기를 기준점으로 보관한다. 누적 비율 대신 기준점으로
      // 계산해야 축소 후 다시 확대했을 때 내용 크기도 원래대로 돌아온다.
      if (!Number.isFinite(moduleSize.baseWidth)) moduleSize.baseWidth = startRect.width;
      if (!Number.isFinite(moduleSize.baseHeight)) moduleSize.baseHeight = startRect.height;
      const isHorizontal = state.orientation === 'H';

      const onMouseMove = (moveEvt) => {
        // 가로 분할 비율은 중앙선 리사이저가 전담한다. 가로형 모서리 핸들은 높이만 조절한다.
        if (isHorizontal) {
          const maxHeightPx = Math.max(
            limits.minHeight,
            cardRect.bottom - startRect.top - 14
          );
          const heightPx = Math.max(
            limits.minHeight,
            Math.min(maxHeightPx, startRect.height + moveEvt.clientY - startY)
          );
          const nextScale = Math.max(0.2, Math.min(1, heightPx / moduleSize.baseHeight));
          state.aModuleSizes[key].height = Math.round(heightPx);
          state.aModuleSizes[key].scale = nextScale;
          module.style.height = `${state.aModuleSizes[key].height}px`;
          module.style.alignSelf = 'flex-start';
          applyAModuleContentScale(module, nextScale);
          syncAHorizontalModuleSplit();
          if (key === 'comment') window.requestAnimationFrame(applyACommentContentFit);
          return;
        }

        // 모듈의 오른쪽/아래쪽이 카드 배경을 벗어나지 않도록 현재 카드 경계로 제한한다.
        const maxWidthPx = Math.max(
          limits.minWidth,
          Math.min(containerRect.right, cardRect.right) - startRect.left - 14
        );
        const maxHeightPx = Math.max(
          limits.minHeight,
          cardRect.bottom - startRect.top - 14
        );
        const widthPx = Math.max(limits.minWidth, Math.min(maxWidthPx, startRect.width + moveEvt.clientX - startX));
        const heightPx = Math.max(limits.minHeight, Math.min(maxHeightPx, startRect.height + moveEvt.clientY - startY));
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
  const checkbox = document.getElementById('chk-a-comment-fit');
  if (!button && !checkbox) return;

  button?.addEventListener('mousedown', (e) => e.stopPropagation());
  button?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const commentSize = state.aModuleSizes.comment;
    commentSize.fitContent = !commentSize.fitContent;
    applyACommentContentFit();
    window.requestAnimationFrame(trimACommentModuleBlankSpace);
  });
  checkbox?.addEventListener('change', (e) => {
    state.aModuleSizes.comment.fitContent = e.target.checked;
    applyACommentContentFit();
    window.requestAnimationFrame(trimACommentModuleBlankSpace);
  });
  applyACommentContentFit();
}

// 자유 입력 카드의 입력 영역만 모듈 높이에 맞춘다. 카드 자체를 flex로 눌러
// 넣지 않아 제목/선택 버튼/체크박스가 찌그러지지 않는다.
function applyACommentContentFit() {
  const module = document.getElementById('mod-comment');
  const button = document.getElementById('btn-fit-a-comment');
  const checkbox = document.getElementById('chk-a-comment-fit');
  const content = module?.querySelector('.a-module-content-scale');
  if (!module || !content) return;
  // 입력창 맞춤 전에 가로형 모듈의 폭 분할을 먼저 동기화한다.
  if (state.orientation === 'H') syncAHorizontalModuleSplit();

  // 가로형은 두 모듈의 높이가 같아지므로, 입력창 맞춤을 자동 적용해 하단 빈 공간을 없앤다.
  const autoFitInHorizontal = state.orientation === 'H';
  const enabled = Boolean(state.aModuleSizes.comment.fitContent) || autoFitInHorizontal;
  module.classList.toggle('is-content-fitted', enabled);
  if (button) {
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? '✓ 입력창 맞춤' : '↕ 입력창 맞춤';
  }
  if (checkbox) checkbox.checked = enabled;

  if (!enabled) {
    content.style.height = '';
    content.querySelector('.a-comment-list')?.style.removeProperty('height');
    content.querySelectorAll('.qa-card-item').forEach((card) => card.style.removeProperty('height'));
    content.querySelectorAll('textarea, .rich-text-editor').forEach(textarea => { textarea.style.height = ''; });
    return;
  }

  const scale = Number.isFinite(state.aModuleSizes.comment.scale)
    ? state.aModuleSizes.comment.scale
    : 1;
  const dragBarHeight = module.querySelector('.module-drag-bar')?.offsetHeight ?? 0;
  if (module.clientHeight === 0) return;
  const verticalPadding = 24;
  const availableHeight = Math.max(80, module.clientHeight - dragBarHeight - verticalPadding - 10) / Math.max(scale, 0.1);
  const cards = content.querySelectorAll('.qa-card-item');
  const textareas = content.querySelectorAll('textarea, .rich-text-editor');
  // 스케일된 컨텐츠 영역 자체에 높이를 부여해야 카드와 입력 영역이 남는 공간까지 채운다.
  content.style.height = `${Math.floor(availableHeight)}px`;
  content.querySelector('.a-comment-list')?.style.removeProperty('height');
  cards.forEach((card) => card.style.removeProperty('height'));
  // 상단 컨트롤의 실제 높이를 빼서 편집 영역을 남은 공간까지 정확히 채운다.
  textareas.forEach((textarea) => textarea.style.removeProperty('height'));
}

function setupACommentAutoFitObserver() {
  const module = document.getElementById('mod-comment');
  const container = document.getElementById('a-container');
  if (!module || !container || !window.ResizeObserver) return;

  let frameId = null;
  const scheduleFit = () => {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      frameId = null;
      applyACommentContentFit();
    });
  };
  const observer = new ResizeObserver(scheduleFit);
  observer.observe(module);
  observer.observe(container);
}

// 고정 크기가 설정된 자유 입력창은 실제 카드 높이까지만 차지하게 해 하단의
// 불필요한 빈 공간을 없앤다. 사용자가 다시 모서리를 드래그하면 그 크기가 새 기준이 된다.
function trimACommentModuleBlankSpace() {
  const module = document.getElementById('mod-comment');
  const content = module?.querySelector('.a-module-content-scale');
  const size = state.aModuleSizes.comment;
  if (!module || !content || !Number.isFinite(size.height) || module.classList.contains('is-resizing')) return;
  // 배경 맞춤 중에는 모듈이 콘텐츠를 따라 다시 커지면 안 된다.
  if (module.closest('.card-canvas')?.classList.contains('module-fit-locked')) return;

  const dragBarHeight = module.querySelector('.module-drag-bar')?.offsetHeight ?? 0;
  const contentHeight = content.getBoundingClientRect().height;
  if (!contentHeight) return;

  const desiredHeight = Math.max(
    A_MODULE_SIZE_LIMITS.comment.minHeight,
    Math.ceil(24 + dragBarHeight + 10 + contentHeight)
  );
  if (Math.abs(desiredHeight - size.height) > 1) {
    size.height = desiredHeight;
    module.style.height = `${desiredHeight}px`;
  }
}

// 크기가 고정된 자유 입력창에 새 카드를 더할 때 기존 입력창을 압축하지 않고,
// 새 카드가 필요한 만큼 모듈 높이를 아래로 늘린다.
function growACommentModuleForNewCard(currentTextareaHeight = 65) {
  const module = document.getElementById('mod-comment');
  const size = state.aModuleSizes.comment;
  if (!module || !Number.isFinite(size.height)) return;
  // 고정 배경 안에서는 새 입력창을 추가해도 카드 배경을 키우지 않고 내부 영역에 맞춘다.
  if (module.closest('.card-canvas')?.classList.contains('module-fit-locked')) {
    applyACommentContentFit();
    return;
  }

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
    document.getElementById('export-card')?.classList.remove('module-fit-locked');
    document.getElementById('export-card')?.style.removeProperty('height');
    applyOrientation(state.orientation);
    applyACommentContentFit();
  });
}

// 수동 리사이즈한 뒤에도 각 A 모듈이 카드 배경 안에서 끝나도록 일괄 보정한다.
function getBackgroundFitHeight(card) {
  // 콘텐츠의 실제 높이는 모듈 크기에 따라 달라지므로 배경 맞춤 기준으로 쓰지 않는다.
  // CSS에 정의한 카드 배경의 고정 기준 높이만 사용한다.
  const configuredHeight = Number.parseFloat(
    window.getComputedStyle(card).getPropertyValue('--background-fit-height')
  );
  return Number.isFinite(configuredHeight) && configuredHeight > 0 ? configuredHeight : 580;
}

function fitAModulesToBackground(card) {
  const backgroundHeight = getBackgroundFitHeight(card);
  card.style.height = `${backgroundHeight}px`;
  card.classList.add('module-fit-locked');

  window.requestAnimationFrame(() => {
    const isHorizontal = state.orientation === 'H';
    const commentReserve = isHorizontal ? 0 : A_MODULE_SIZE_LIMITS.comment.minHeight + 16;

    ['table', 'comment'].forEach((key) => {
      const module = document.getElementById(key === 'table' ? 'mod-table' : 'mod-comment');
      if (!module) return;

      const cardRect = card.getBoundingClientRect();
      const rect = module.getBoundingClientRect();
      // 세로형에서는 표가 자유 입력창의 자리를 침범하지 않도록 미리 남겨 둔다.
      const reservedBelow = key === 'table' ? commentReserve : 0;
      const availableHeight = Math.floor(cardRect.bottom - rect.top - 14 - reservedBelow);
      const targetHeight = Math.max(80, availableHeight);
      const currentScale = Number.isFinite(state.aModuleSizes[key].scale)
        ? state.aModuleSizes[key].scale
        : 1;
      const nextScale = Math.max(0.2, Math.min(currentScale, targetHeight / Math.max(rect.height, 1)));

      state.aModuleSizes[key].height = targetHeight;
      state.aModuleSizes[key].scale = nextScale;
      module.style.height = `${targetHeight}px`;
      module.style.flex = 'none';
      module.style.alignSelf = 'flex-start';
      applyAModuleContentScale(module, nextScale);
    });

    state.aModuleSizes.comment.fitContent = true;
    syncAHorizontalModuleSplit();
    applyACommentContentFit();
    trimACommentModuleBlankSpace();
  });
}

function setupModuleFitToCard() {
  const button = document.getElementById('btn-fit-modules-to-card');
  if (!button) return;

  button.addEventListener('click', () => {
    const card = document.getElementById('export-card');
    if (!card) return;
    fitAModulesToBackground(card);
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
      if (state.orientation !== 'H') module.style.flex = 'none';
      module.style.alignSelf = 'flex-start';
    }
    applyAModuleContentScale(module, Number.isFinite(size.scale) ? size.scale : 1);
  });
  syncAHorizontalModuleSplit();
  applyACommentContentFit();
  window.requestAnimationFrame(trimACommentModuleBlankSpace);
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

let activeRichTextEditor = null;
let richTextToolbar = null;
let activeRichTextRange = null;
let isRichToolbarInteracting = false;

function escapeHtml(value) {
  const element = document.createElement('div');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function sanitizeRichHtml(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value ?? '');
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'S', 'STRIKE', 'FONT', 'BR', 'DIV', 'SPAN']);
  template.content.querySelectorAll('*').forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ''));
      return;
    }
    Array.from(element.attributes).forEach((attribute) => {
      const isAllowedFontSize = element.tagName === 'FONT'
        && attribute.name.toLowerCase() === 'size'
        && /^[1-7]$/.test(attribute.value);
      if (!isAllowedFontSize) element.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
}

// 선택한 문장에만 적용되는 서식 도구. textarea 대신 contenteditable을 써서
// 굵게/기울임/취소선/글자 크기를 이미지 출력에도 그대로 보존한다.
function setupRichTextToolbar() {
  if (document.getElementById('rich-text-toolbar')) return;

  richTextToolbar = document.createElement('div');
  richTextToolbar.id = 'rich-text-toolbar';
  richTextToolbar.className = 'rich-text-toolbar';
  richTextToolbar.setAttribute('role', 'toolbar');
  richTextToolbar.setAttribute('aria-label', '선택한 글자 서식');
  richTextToolbar.innerHTML = `
    <label class="rich-text-size" title="글자 크기">
      <span>크기</span>
      <input type="number" min="1" max="7" step="1" value="3" aria-label="글자 크기" />
    </label>
    <button type="button" data-command="bold" title="굵게"><strong>B</strong></button>
    <button type="button" data-command="italic" title="기울이기"><em>I</em></button>
    <button type="button" data-command="strikeThrough" title="취소선"><s>S</s></button>
  `;
  document.body.appendChild(richTextToolbar);

  // 버튼 클릭으로 선택 범위가 사라지는 것을 막는다.
  richTextToolbar.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) event.preventDefault();
    if (event.target.closest('input[type="number"]')) {
      // 숫자 입력칸으로 포커스가 옮겨가는 동안 선택 범위를 보존한다.
      isRichToolbarInteracting = true;
    }
  });
  richTextToolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-command]');
    if (!button || !activeRichTextEditor) return;
    activeRichTextEditor.focus();
    restoreRichTextRange();
    document.execCommand(button.dataset.command, false, button.dataset.value || null);
    activeRichTextEditor.dispatchEvent(new Event('input', { bubbles: true }));
  });
  richTextToolbar.querySelector('input[type="number"]')?.addEventListener('change', (event) => {
    const size = Math.max(1, Math.min(7, Number(event.target.value) || 3));
    event.target.value = String(size);
    if (!activeRichTextEditor) return;
    activeRichTextEditor.focus();
    restoreRichTextRange();
    document.execCommand('fontSize', false, String(size));
    activeRichTextEditor.dispatchEvent(new Event('input', { bubbles: true }));
    isRichToolbarInteracting = false;
  });

  document.addEventListener('selectionchange', updateRichTextToolbar);
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.rich-text-editor, .rich-text-toolbar')) hideRichTextToolbar();
  });
}

function updateRichTextToolbar() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    const toolbarOwnsFocus = richTextToolbar?.contains(document.activeElement);
    if ((isRichToolbarInteracting || toolbarOwnsFocus) && activeRichTextEditor && activeRichTextRange) return;
    hideRichTextToolbar();
    return;
  }

  const range = selection.getRangeAt(0);
  const selectedNode = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const editor = selectedNode?.closest?.('.rich-text-editor');
  if (!editor) {
    hideRichTextToolbar();
    return;
  }

  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return;
  activeRichTextEditor = editor;
  activeRichTextRange = range.cloneRange();
  const sizeInput = richTextToolbar.querySelector('input[type="number"]');
  const selectedSize = Number(document.queryCommandValue('fontSize'));
  if (sizeInput && Number.isFinite(selectedSize) && selectedSize >= 1 && selectedSize <= 7) {
    sizeInput.value = String(selectedSize);
  }
  const toolbarWidth = 190;
  const left = Math.max(8, Math.min(window.innerWidth - toolbarWidth - 8, rect.left + rect.width / 2 - toolbarWidth / 2));
  richTextToolbar.style.left = `${left}px`;
  richTextToolbar.style.top = `${Math.max(8, rect.top - 42)}px`;
  richTextToolbar.classList.add('is-visible');
}

function hideRichTextToolbar() {
  richTextToolbar?.classList.remove('is-visible');
  activeRichTextEditor = null;
  activeRichTextRange = null;
}

function restoreRichTextRange() {
  if (!activeRichTextRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(activeRichTextRange);
}

function renderCardContent(bodyEl, qa) {
  bodyEl.innerHTML = '';

  if (qa.type === 'textarea') {
    const editor = document.createElement('div');
    editor.className = 'rich-text-editor';
    editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.dataset.placeholder = '내용을 입력하세요.';
    // 기존 식별코드의 일반 텍스트는 안전하게 표시하고, 새 데이터만 서식 HTML을 사용한다.
    editor.innerHTML = typeof qa.html === 'string'
      ? sanitizeRichHtml(qa.html)
      : escapeHtml(qa.value || '');
    editor.addEventListener('input', () => {
      qa.html = editor.innerHTML;
      qa.value = editor.innerText;
    });
    bodyEl.appendChild(editor);
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
    window.requestAnimationFrame(() => {
      applyACommentContentFit();
      trimACommentModuleBlankSpace();
    });
  }

  btnAdd.onclick = () => {
    const firstTextarea = container.querySelector('textarea, .rich-text-editor');
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
    scheduleBCenterDividers();
  }

  btnAdd.onclick = () => {
    state.qaList.push({ title: "Q. 새로운 질문", type: "textarea", value: "" });
    render();
  };

  render();
}

function updateBCenterLineButton() {
  const button = document.getElementById('btn-b-center-line');
  const container = document.getElementById('qa-container');
  if (button) {
    button.setAttribute('aria-pressed', String(state.bCenterLine));
    button.textContent = state.bCenterLine ? '✓ 중앙선' : '＋ 중앙선';
  }
  container?.classList.toggle('has-center-lines', state.bCenterLine);
}

function renderBCenterDividers() {
  const container = document.getElementById('qa-container');
  if (!container) return;
  container.querySelector('.b-center-divider-layer')?.remove();
  if (!state.bCenterLine) return;

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

  const layer = document.createElement('div');
  layer.className = 'b-center-divider-layer';
  const addLine = (direction, style) => {
    const line = document.createElement('i');
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
    const upperCards = rows[index].cards.map(({ rect }) => rect);
    const lowerCards = rows[index + 1].cards.map(({ rect }) => rect);
    const upperBottom = Math.max(...upperCards.map((rect) => rect.bottom));
    const lowerTop = Math.min(...lowerCards.map((rect) => rect.top));
    const y = ((upperBottom + lowerTop) / 2) - containerRect.top;
    const allCards = [...upperCards, ...lowerCards];
    const left = Math.min(...allCards.map((rect) => rect.left)) - containerRect.left;
    const right = Math.max(...allCards.map((rect) => rect.right)) - containerRect.left;
    addLine('horizontal', { left: `${left}px`, top: `${y - 1}px`, width: `${Math.max(0, right - left)}px` });
  }
  container.appendChild(layer);
}

function scheduleBCenterDividers() {
  window.requestAnimationFrame(renderBCenterDividers);
}

function setupBCenterLineControl() {
  const button = document.getElementById('btn-b-center-line');
  const container = document.getElementById('qa-container');
  if (!button || !container) return;

  button.addEventListener('mousedown', (event) => event.stopPropagation());
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.bCenterLine = !state.bCenterLine;
    updateBCenterLineButton();
    scheduleBCenterDividers();
  });
  container.addEventListener('input', scheduleBCenterDividers);
  if (window.ResizeObserver) new ResizeObserver(scheduleBCenterDividers).observe(container);
  window.addEventListener('resize', scheduleBCenterDividers);
  updateBCenterLineButton();
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
          <div class="editable-cell-td rich-text-editor" contenteditable="true" role="textbox" aria-label="체크 항목"></div>
        </td>
        <td class="td-radio"><input type="radio" name="chk_${idx}" value="1" ${row.value === '1' ? 'checked' : ''} /></td>
        <td class="td-radio"><input type="radio" name="chk_${idx}" value="2" ${row.value === '2' ? 'checked' : ''} /></td>
        <td class="td-radio"><input type="radio" name="chk_${idx}" value="3" ${row.value === '3' ? 'checked' : ''} /></td>
        <td class="td-del-action">
          <button type="button" class="matrix-row-del-btn" title="항목 삭제">✕</button>
        </td>
      `;

      const textInput = tr.querySelector('.editable-cell-td');
      textInput.innerHTML = typeof row.html === 'string'
        ? sanitizeRichHtml(row.html)
        : escapeHtml(row.title || '');
      textInput.addEventListener('input', (e) => {
        row.html = e.currentTarget.innerHTML;
        row.title = e.currentTarget.innerText;
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
    // 모듈 헤더의 빈 영역 또는 드래그 아이콘에서 시작한 경우만 모듈 이동을 허용한다.
    // 입력 카드·버튼·스티커에서 올라온 이벤트는 부모 모듈의 dragstart로 승격되지 않는다.
    const isDirectHandleTarget = e.target === handle || e.target.classList.contains('drag-handle-icon');
    if (!targetItem || targetItem.parentNode !== container) return;
    targetItem.draggable = isDirectHandleTarget;
    if (!isDirectHandleTarget) return;
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
      bCenterLine: state.bCenterLine,
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
        applyOrientation(data.orientation, true);
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
      if (data.bCenterLine !== undefined) {
        state.bCenterLine = Boolean(data.bCenterLine);
        updateBCenterLineButton();
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
        // 예전 식별코드의 과도한 값도 현재 리사이저 범위 안에서 안전하게 복원한다.
        const savedTableWidth = Number(data.tableWidthPercent);
        state.tableWidthPercent = Number.isFinite(savedTableWidth)
          ? Math.max(30, Math.min(70, savedTableWidth))
          : 55;
        syncAHorizontalModuleSplit();
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
        scheduleBCenterDividers();
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
