/**
 * 자유 이미지 배치, 마우스 휠 리사이즈, 레이어 순서 관리 모듈
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
    const itemData = { id, src, x: 50, y: 120, width: 120, layer };
    this.items.push(itemData);
    this.renderItem(itemData);
  }

  renderItem(itemData) {
    const el = document.createElement('div');
    el.id = itemData.id;
    el.className = 'floating-img-item';
    el.style.left = `${itemData.x}px`;
    el.style.top = `${itemData.y}px`;
    el.style.width = `${itemData.width}px`;

    el.innerHTML = `
      <div class="floating-img-controls">
        <button type="button" class="btn-up">글자 위로</button>
        <button type="button" class="btn-down">글자 아래로</button>
        <button type="button" class="btn-del">삭제</button>
      </div>
      <img src="${itemData.src}" alt="스티커" />
      <div class="img-resize-handle"></div>
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
    el.querySelector('.btn-del').onclick = (e) => {
      e.stopPropagation();
      this.removeItem(itemData.id);
    };

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 12 : -12;
      itemData.width = Math.max(40, Math.min(600, itemData.width + delta));
      el.style.width = `${itemData.width}px`;
    }, { passive: false });

    const resizeHandle = el.querySelector('.img-resize-handle');
    resizeHandle.onmousedown = (e) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = itemData.width;

      const onMouseMove = (moveEvt) => {
        const newWidth = Math.max(40, startWidth + (moveEvt.clientX - startX));
        itemData.width = newWidth;
        el.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    el.onmousedown = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.classList.contains('img-resize-handle')) return;
      const startX = e.clientX - el.offsetLeft;
      const startY = e.clientY - el.offsetTop;
      
      const onMouseMove = (moveEvt) => {
        const newX = moveEvt.clientX - startX;
        const newY = moveEvt.clientY - startY;
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        itemData.x = newX;
        itemData.y = newY;
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
      x: item.x,
      y: item.y,
      width: item.width,
      layer: item.layer
    }));
  }

  loadSerialized(serializedItems) {
    this.clearAll();
    if (!Array.isArray(serializedItems)) return;
    serializedItems.forEach(item => {
      const id = 'img_' + Date.now() + Math.random().toString(36).substr(2, 4);
      const itemData = {
        id,
        src: item.src,
        x: item.x || 50,
        y: item.y || 120,
        width: item.width || 120,
        layer: item.layer || 'front'
      };
      this.items.push(itemData);
      this.renderItem(itemData);
    });
  }
}