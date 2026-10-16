/**
 * 스티커 배치, 마우스 휠 리사이즈, 레이어 순서 관리 모듈
 */
export class LayerManager {
  constructor(backContainerId, frontContainerId) {
    this.layerBack = document.getElementById(backContainerId);
    this.layerFront = document.getElementById(frontContainerId);
    this.items = [];

    window.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.floating-img-item')) {
        document.querySelectorAll('.floating-img-item.active').forEach(el => el.classList.remove('active'));
      }
    });
  }

  addImage(src, layer = 'front') {
    const id = 'img_' + Date.now() + Math.random().toString(36).substr(2, 4);
    // 카드 크기가 달라져도 같은 위치에 남도록 모든 좌표를 백분율로 보관한다.
    const itemData = { id, src, xRatio: 6, yRatio: 20, widthRatio: 15, rotation: 0, flipX: false, layer };
    this.items.push(itemData);
    this.renderItem(itemData);
  }

  renderItem(itemData) {
    const el = document.createElement('div');
    el.id = itemData.id;
    el.className = 'floating-img-item';
    el.style.left = `${itemData.xRatio}%`;
    el.style.top = `${itemData.yRatio}%`;
    el.style.width = `${itemData.widthRatio}%`;
    this.applyTransform(el, itemData);

    el.innerHTML = `
      <div class="floating-img-controls">
        <button type="button" class="btn-up">글자 위로</button>
        <button type="button" class="btn-down">글자 아래로</button>
        <button type="button" class="btn-rotate" title="시계 방향으로 15도 회전">↻ 회전</button>
        <button type="button" class="btn-flip" title="스티커 좌우 반전">↔ 반전</button>
        <button type="button" class="btn-del">삭제</button>
      </div>
      <img src="${itemData.src}" alt="스티커" />
      <div class="img-resize-handle"></div>
      <div class="img-rotate-handle" title="드래그하여 회전"></div>
    `;

    el.addEventListener('mousedown', () => {
      document.querySelectorAll('.floating-img-item.active').forEach(item => item.classList.remove('active'));
      el.classList.add('active');
    });

    el.querySelector('.btn-up').onclick = (e) => {
      e.stopPropagation();
      this.switchLayer(itemData.id, 'front');
    };
    el.querySelector('.btn-down').onclick = (e) => {
      e.stopPropagation();
      this.switchLayer(itemData.id, 'back');
    };
    el.querySelector('.btn-rotate').onclick = (e) => {
      e.stopPropagation();
      itemData.rotation = (itemData.rotation + 15) % 360;
      this.applyTransform(el, itemData);
    };
    el.querySelector('.btn-flip').onclick = (e) => {
      e.stopPropagation();
      itemData.flipX = !itemData.flipX;
      this.applyTransform(el, itemData);
    };
    el.querySelector('.btn-del').onclick = (e) => {
      e.stopPropagation();
      this.removeItem(itemData.id);
    };

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const parentWidth = el.parentElement.getBoundingClientRect().width || 1;
      const delta = (e.deltaY < 0 ? 12 : -12) / parentWidth * 100;
      itemData.widthRatio = Math.max(5, Math.min(80, itemData.widthRatio + delta));
      el.style.width = `${itemData.widthRatio}%`;
    }, { passive: false });

    const resizeHandle = el.querySelector('.img-resize-handle');
    resizeHandle.onmousedown = (e) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = itemData.widthRatio;

      const onMouseMove = (moveEvt) => {
        const parentWidth = el.parentElement.getBoundingClientRect().width || 1;
        const newWidth = Math.max(5, Math.min(80, startWidth + ((moveEvt.clientX - startX) / parentWidth * 100)));
        itemData.widthRatio = newWidth;
        el.style.width = `${newWidth}%`;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const rotateHandle = el.querySelector('.img-rotate-handle');
    rotateHandle.onmousedown = (e) => {
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const startRotation = itemData.rotation;

      const onMouseMove = (moveEvt) => {
        const currentAngle = Math.atan2(moveEvt.clientY - centerY, moveEvt.clientX - centerX);
        const degrees = (currentAngle - startAngle) * (180 / Math.PI);
        // 5도 단위로 보정해 미세한 흔들림 없이 회전한다.
        itemData.rotation = Math.round((startRotation + degrees) / 5) * 5;
        this.applyTransform(el, itemData);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    el.onmousedown = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.classList.contains('img-resize-handle') || e.target.classList.contains('img-rotate-handle')) return;
      const rect = el.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;
      
      const onMouseMove = (moveEvt) => {
        const parentRect = el.parentElement.getBoundingClientRect();
        const newX = ((moveEvt.clientX - startX - parentRect.left) / parentRect.width) * 100;
        const newY = ((moveEvt.clientY - startY - parentRect.top) / parentRect.height) * 100;
        itemData.xRatio = newX;
        itemData.yRatio = newY;
        el.style.left = `${newX}%`;
        el.style.top = `${newY}%`;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const targetParent = itemData.layer === 'front' ? this.layerFront : this.layerBack;
    targetParent.appendChild(el);
  }

  switchLayer(id, targetLayer) {
    const item = this.items.find(i => i.id === id);
    const el = document.getElementById(id);
    if (!item || !el) return;

    item.layer = targetLayer;
    const newParent = targetLayer === 'front' ? this.layerFront : this.layerBack;
    newParent.appendChild(el);
  }

  applyTransform(el, itemData) {
    const scaleX = itemData.flipX ? -1 : 1;
    const image = el.querySelector('img');
    if (image) image.style.transform = `rotate(${itemData.rotation}deg) scaleX(${scaleX})`;
  }

  removeItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  clearAll() {
    this.layerBack.innerHTML = '';
    this.layerFront.innerHTML = '';
    this.items = [];
  }

  getSerialized() {
    return this.items.map(item => ({
      src: item.src,
      xRatio: item.xRatio,
      yRatio: item.yRatio,
      widthRatio: item.widthRatio,
      rotation: item.rotation,
      flipX: item.flipX,
      layer: item.layer
    }));
  }

  loadSerialized(serializedItems) {
    this.clearAll();
    if (!Array.isArray(serializedItems)) return;
    serializedItems.forEach(item => {
      const id = 'img_' + Date.now() + Math.random().toString(36).substr(2, 4);
      const layerRect = (item.layer === 'back' ? this.layerBack : this.layerFront).getBoundingClientRect();
      const itemData = {
        id,
        src: item.src,
        // 이전 식별코드의 픽셀 좌표도 현재 카드 크기를 기준으로 변환한다.
        xRatio: Number.isFinite(item.xRatio) ? item.xRatio : ((item.x || 50) / (layerRect.width || 780) * 100),
        yRatio: Number.isFinite(item.yRatio) ? item.yRatio : ((item.y || 120) / (layerRect.height || 580) * 100),
        widthRatio: Number.isFinite(item.widthRatio) ? item.widthRatio : ((item.width || 120) / (layerRect.width || 780) * 100),
        rotation: Number.isFinite(item.rotation) ? item.rotation : 0,
        flipX: item.flipX === true,
        layer: item.layer || 'front'
      };
      this.items.push(itemData);
      this.renderItem(itemData);
    });
  }
}
