import API from '../api.js';
import API_CONFIG from '../config.js';
import Auth from '../auth.js';
import { showToast, formatCurrency } from '../utils.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

class ProductManager {
  state = {
    products: [],
    categories: [],
    variants: [],
    tempVariants: [],        // biến thể đang thao tác trong modal
    editingProductId: null,  // string | null
    editingVariantIndex: null
  };

  constructor() {
    this.init();
  }

  async init() {
    if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
      window.location.href = '../login.html';
      return;
    }

    this.cacheDom();
    this.bindEvents();
    await this.loadData();
  }

  cacheDom() {
    this.dom = {
      logoutBtn:      $('#logoutBtn'),
      addBtn:         $('#addProductBtn'),
      modal:          $('#productModal'),
      modalTitle:     $('#modalTitle'),
      closeBtns:      $$('.close-modal'),
      form:           $('#productForm'),
      listBody:       $('#productList'),
      // form fields
      f: {
        id:          $('#productId'),
        name:        $('#productName'),
        cate:        $('#productCategory'),
        detail:      $('#productDetail'),
        image:       $('#productImage'),
        imageFile:   $('#productImageFile'),
        imgPrevWrap: $('#imagePreview'),
        imgPrev:     $('#previewImg'),
      },
      // variant fields
      vf: {
        color:       $('#variantColor'),
        code:        $('#variantColorCode'),
        size:        $('#variantSize'),
        price:       $('#variantPrice'),
        qty:         $('#variantQuantity'),
        img:         $('#variantImage'),
        imgFile:     $('#variantImageFile'),
        imgPrevWrap: $('#variantImagePreview'),
        imgPrev:     $('#variantPreviewImg'),
        addBtn:      $('#addVariantBtn'),
        clearBtn:    $('#clearVariantInputs'),
        tableBody:   $('#variantsTableBody')
      }
    };
  }

  bindEvents() {
    on(this.dom.logoutBtn, 'click', (e) => { e.preventDefault(); Auth.logout(); });
    on(this.dom.addBtn, 'click', () => this.openModal());
    this.dom.closeBtns.forEach(btn => on(btn, 'click', () => this.closeModal()));
    on(this.dom.form, 'submit', (e) => { e.preventDefault(); this.saveProduct(); });

    // Table actions (edit/delete) via delegation
    on(this.dom.listBody, 'click', (e) => {
      const editBtn = e.target.closest('.edit-btn');
      const delBtn  = e.target.closest('.delete-btn');
      if (editBtn) this.editProduct(editBtn.dataset.id);
      if (delBtn)  this.deleteProduct(delBtn.dataset.id);
    });

    // Image uploads
    on(this.dom.f.imageFile, 'change', (e) => this.handleImageUpload(e, 'product'));
    on(this.dom.vf.imgFile,  'change', (e) => this.handleImageUpload(e, 'variant'));

    // Variant buttons
    on(this.dom.vf.addBtn, 'click', () => this.addOrUpdateVariant());
    on(this.dom.vf.clearBtn,'click', () => this.clearVariantInputs());

    // Variant table actions via delegation
    on(this.dom.vf.tableBody, 'click', (e) => {
      const editBtn = e.target.closest('.edit-variant-btn');
      const rmBtn   = e.target.closest('.remove-variant-btn');
      if (editBtn) this.editVariant(Number(editBtn.dataset.index));
      if (rmBtn && confirm('Xoá biến thể này?')) this.removeVariant(Number(rmBtn.dataset.index));
    });
  }

  async loadData() {
    try {
      const [products, categories, variants] = await Promise.all([
        API.get(API_CONFIG.ENDPOINTS.products),
        API.get(API_CONFIG.ENDPOINTS.categories),
        API.get(API_CONFIG.ENDPOINTS.productVariants)
      ]);
      this.state.products   = Array.isArray(products)   ? products   : [];
      this.state.categories = Array.isArray(categories) ? categories : [];
      this.state.variants   = Array.isArray(variants)   ? variants   : [];
      this.updateCategorySelect();
      this.renderList();
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Không tải được dữ liệu', 'error');
    }
  }

  /* ---------- RENDER ---------- */
  renderList() {
    const { products, categories, variants } = this.state;
    const tbody = this.dom.listBody;

    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">Chưa có sản phẩm nào</td></tr>`;
      return;
    }

    const cateMap = new Map(categories.map(c => [String(c.id), c.name]));
    const variantCountByPid = products.reduce((acc, p) => {
      const count = variants.filter(v => String(v.product_id) === String(p.id)).length;
      acc[String(p.id)] = count; return acc;
    }, {});

    tbody.innerHTML = products.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${cateMap.get(String(p.cate_id)) || '-'}</td>
        <td>${variantCountByPid[String(p.id)] || 0}</td>
        <td class="action-buttons">
          <button class="btn btn-small edit-btn"   data-id="${p.id}">Sửa</button>
          <button class="btn btn-small btn-danger delete-btn" data-id="${p.id}">Xoá</button>
        </td>
      </tr>
    `).join('');
  }

  updateCategorySelect() {
    const sel = this.dom.f.cate;
    sel.innerHTML = this.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  /* ---------- MODAL ---------- */
  openModal(product = null) {
    const { f, vf } = this.dom;
    this.state.tempVariants = [];
    this.state.editingVariantIndex = null;

    if (product) {
      this.dom.modalTitle.textContent = 'Sửa sản phẩm';
      f.id.value     = String(product.id);
      f.name.value   = product.name || '';
      f.cate.value   = String(product.cate_id || '');
      f.detail.value = product.detail || '';
      f.image.value  = product.image || '';
      if (product.image) { f.imgPrev.src = product.image; f.imgPrevWrap.style.display = 'block'; }
      else               { f.imgPrevWrap.style.display = 'none'; }

      // clone biến thể của sản phẩm
      this.state.tempVariants = this.state.variants
        .filter(v => String(v.product_id) === String(product.id))
        .map(v => ({ ...v }));
    } else {
      this.dom.modalTitle.textContent = 'Thêm sản phẩm';
      this.dom.form.reset();
      f.imgPrevWrap.style.display = 'none';
    }

    // reset form biến thể
    this.clearVariantInputs(false);
    this.renderVariantsList();
    this.dom.modal.classList.add('active');
    this.state.editingProductId = product ? String(product.id) : null;
  }

  closeModal() {
    this.dom.modal.classList.remove('active');
    this.state.tempVariants = [];
    this.state.editingProductId = null;
    this.state.editingVariantIndex = null;
  }

  /* ---------- IMAGE UPLOAD ---------- */
  handleImageUpload(event, type) {
    const file = event.target.files?.[0];
    if (!file) return;
    const valid = ['image/jpeg','image/jpg','image/png','image/webp'];
    if (!valid.includes(file.type)) { showToast('File ảnh không hợp lệ', 'error'); event.target.value=''; return; }
    if (file.size > 2*1024*1024)   { showToast('Ảnh tối đa 2MB', 'error'); event.target.value=''; return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      if (type === 'product') {
        this.dom.f.image.value = base64;
        this.dom.f.imgPrev.src = base64;
        this.dom.f.imgPrevWrap.style.display = 'block';
      } else {
        this.dom.vf.img.value = base64;
        this.dom.vf.imgPrev.src = base64;
        this.dom.vf.imgPrevWrap.style.display = 'block';
      }
      showToast('Đã tải ảnh', 'success');
    };
    reader.onerror = () => showToast('Lỗi đọc ảnh', 'error');
    reader.readAsDataURL(file);
  }

  /* ---------- VARIANTS ---------- */
  clearVariantInputs(clearPreview = true) {
    const { color, code, size, price, qty, img, imgPrevWrap } = this.dom.vf;
    color.value = code.value = size.value = img.value = '';
    price.value = qty.value = '';
    if (clearPreview) imgPrevWrap.style.display = 'none';
    this.state.editingVariantIndex = null;
    this.dom.vf.addBtn.textContent = 'Thêm biến thể';
  }

  addOrUpdateVariant() {
    const { color, code, size, price, qty, img } = this.dom.vf;
    if (!color.value || !code.value || !size.value || !price.value || !qty.value) {
      showToast('Điền đầy đủ thông tin biến thể', 'error'); return;
    }
    const v = {
      id: this.state.editingProductId ? `temp_${Date.now()}` : `new_${Date.now()}`,
      product_id: this.state.editingProductId,
      color: color.value.trim(),
      color_code: code.value.trim(),
      size: size.value.trim(),
      price: Number(price.value),
      quantity: Number(qty.value),
      image: img.value || this.dom.f.image.value || '/images/placeholder.svg'
    };

    if (this.state.editingVariantIndex !== null) {
      this.state.tempVariants[this.state.editingVariantIndex] = { ...this.state.tempVariants[this.state.editingVariantIndex], ...v };
      this.state.editingVariantIndex = null;
      this.dom.vf.addBtn.textContent = 'Thêm biến thể';
      showToast('Đã cập nhật biến thể', 'success');
    } else {
      this.state.tempVariants.push(v);
      showToast('Đã thêm biến thể', 'success');
    }
    this.renderVariantsList();
    this.clearVariantInputs();
  }

  editVariant(index) {
    const v = this.state.tempVariants[index];
    if (!v) return;
    this.state.editingVariantIndex = index;
    const { color, code, size, price, qty, img, imgPrevWrap, imgPrev } = this.dom.vf;
    color.value = v.color || '';
    code.value  = v.color_code || '';
    size.value  = v.size || '';
    price.value = v.price ?? '';
    qty.value   = v.quantity ?? '';
    img.value   = v.image || '';
    if (v.image) { imgPrev.src = v.image; imgPrevWrap.style.display = 'block'; }
    this.dom.vf.addBtn.textContent = 'Cập nhật biến thể';
  }

  removeVariant(index) {
    this.state.tempVariants.splice(index, 1);
    this.renderVariantsList();
  }

  renderVariantsList() {
    const tbody = this.dom.vf.tableBody;
    const list  = this.state.tempVariants;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:12px">Chưa có biến thể nào</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((v, i) => `
      <tr>
        <td style="padding:8px">
          <img src="${v.image || '/images/placeholder.svg'}" alt="${v.color}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--border)" onerror="this.src='/images/placeholder.svg'"/>
        </td>
        <td style="padding:8px">${v.color}</td>
        <td style="padding:8px">
          <span style="display:inline-block;width:18px;height:18px;background:${v.color_code};border:1px solid var(--border);border-radius:3px;vertical-align:middle"></span>
          <span style="margin-left:6px">${v.color_code}</span>
        </td>
        <td style="padding:8px">${v.size}</td>
        <td style="padding:8px">${formatCurrency(v.price)}</td>
        <td style="padding:8px">${v.quantity}</td>
        <td style="padding:8px">
          <button type="button" class="btn btn-small edit-variant-btn" data-index="${i}">Sửa</button>
          <button type="button" class="btn btn-small btn-danger remove-variant-btn" data-index="${i}">Xoá</button>
        </td>
      </tr>
    `).join('');
  }

  /* ---------- SAVE / DELETE ---------- */
  collectProductPayload() {
    const id   = this.dom.f.id.value?.trim();
    const data = {
      name:   this.dom.f.name.value.trim(),
      cate_id:this.dom.f.cate.value, // luôn để string để đồng nhất
      detail: this.dom.f.detail.value.trim(),
      image:  this.dom.f.image.value.trim()
    };
    if (!data.name || !data.cate_id) throw new Error('Vui lòng nhập Tên và Danh mục');
    return { id: id ? String(id) : null, data };
  }

  async saveProduct() {
    try {
      const { id, data } = this.collectProductPayload();
      let productId;

      if (id) {
        // Upsert an toàn cho json-server
        await API.put(API_CONFIG.ENDPOINTS.products, id, { ...data, id });
        productId = id;
        showToast('Cập nhật sản phẩm thành công', 'success');
      } else {
        const res = await API.post(API_CONFIG.ENDPOINTS.products, data);
        productId = String(res.id);
        showToast('Thêm sản phẩm thành công', 'success');
      }

      await this.saveVariants(productId);
      this.closeModal();
      await this.loadData();
    } catch (err) {
      console.error('Error saving product:', err);
      showToast(err?.message || 'Có lỗi xảy ra khi lưu sản phẩm', 'error');
    }
  }

  async saveVariants(productId) {
    const existingIds = new Set(
      this.state.variants.filter(v => String(v.product_id) === String(productId)).map(v => String(v.id))
    );

    // Xoá những biến thể cũ không còn trong tempVariants
    const keepIds = new Set(this.state.tempVariants.map(v => String(v.id)).filter(id => !id.startsWith('temp_') && !id.startsWith('new_')));
    for (const oldId of existingIds) {
      if (!keepIds.has(oldId)) {
        try { await API.delete(API_CONFIG.ENDPOINTS.productVariants, oldId); }
        catch (e) { console.warn('Delete variant failed:', e); }
      }
    }

    // Lưu/Upsert biến thể hiện tại
    for (const v of this.state.tempVariants) {
      const payload = {
        product_id: String(productId),
        color: v.color, color_code: v.color_code, size: v.size,
        price: Number(v.price), quantity: Number(v.quantity),
        image: v.image || ''
      };

      try {
        if (v.id && !v.id.startsWith('temp_') && !v.id.startsWith('new_')) {
          await API.put(API_CONFIG.ENDPOINTS.productVariants, String(v.id), { id: String(v.id), ...payload });
        } else {
          await API.post(API_CONFIG.ENDPOINTS.productVariants, payload);
        }
      } catch (e) {
        console.error('Error saving variant:', e);
      }
    }
  }

  editProduct(id) {
    const p = this.state.products.find(x => String(x.id) === String(id));
    if (p) this.openModal(p);
  }

  async deleteProduct(id) {
    if (!confirm('Xoá sản phẩm này? Tất cả biến thể sẽ bị xoá.')) return;
    try {
      // xoá biến thể trước
      const related = this.state.variants.filter(v => String(v.product_id) === String(id));
      for (const v of related) {
        try { await API.delete(API_CONFIG.ENDPOINTS.productVariants, String(v.id)); } catch {}
      }
      await API.delete(API_CONFIG.ENDPOINTS.products, String(id));
      showToast('Xoá sản phẩm thành công', 'success');
      await this.loadData();
    } catch (e) {
      console.error('Error deleting product:', e);
      showToast('Có lỗi khi xoá sản phẩm', 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new ProductManager());
