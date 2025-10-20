import API from './api.js';
import API_CONFIG from './config.js';
import Auth from './auth.js';
import Cart from './cart.js';
import { formatCurrency, showToast } from './utils.js';

class HomePage {
    constructor() {
        this.products = [];
        this.categories = [];
        this.filteredProducts = [];
        this.init();
    }

    async init() {
        this.updateAuthUI();
        Cart.updateCartBadge();
        await this.loadCategories();
        await this.loadProducts();
        this.setupEventListeners();
    }

    updateAuthUI() {
        const authLink = document.querySelector('.auth-link');
        const userMenu = document.querySelector('.user-menu');

        if (Auth.isLoggedIn()) {
            userMenu.innerHTML = `
                <a href="#">${Auth.currentUser.name}</a>
                ${Auth.isAdmin() ? '<a href="admin/index.html">Quản trị</a>' : ''}
                <a href="#" class="logout-btn">Đăng xuất</a>
            `;
            document.querySelector('.logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }
    }

    async loadCategories() {
        try {
            this.categories = await API.get(API_CONFIG.ENDPOINTS.categories);
            this.renderCategoryFilter();
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    renderCategoryFilter() {
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.innerHTML = '<option value="">Tất cả danh mục</option>';
        this.categories.forEach(category => {
            categoryFilter.innerHTML += `<option value="${category.id}">${category.name}</option>`;
        });
    }

    async loadProducts() {
        try {
            this.products = await API.get(API_CONFIG.ENDPOINTS.products);
            await this.loadProductVariants();
            this.filteredProducts = [...this.products];
            this.renderProducts();
        } catch (error) {
            console.error('Error loading products:', error);
            document.getElementById('productGrid').innerHTML = 
                '<p style="text-align: center; color: red;">Không thể tải sản phẩm. Vui lòng thử lại sau.</p>';
        }
    }

    async loadProductVariants() {
  try {
    const variants = await API.get(API_CONFIG.ENDPOINTS.productVariants);

    this.products = (Array.isArray(this.products) ? this.products : []).map(p => {
      const vs = (Array.isArray(variants) ? variants : [])
        .filter(v => String(v.product_id) === String(p.id))
        .map(v => ({
          ...v,
          price: Number(v.price) || 0,
          quantity: Number(v.quantity) || 0
        }));
      return { ...p, variants: vs };
    });

  } catch (error) {
    console.error('Error loading variants:', error);
    this.products = (this.products || []).map(p => ({ ...p, variants: [] }));
  }
}


    renderProducts() {
  const grid = document.getElementById('productGrid');

  const list = Array.isArray(this.filteredProducts) ? this.filteredProducts : [];

  if (list.length > 0) {
    const sample = list[0] || {};
    console.log('Rendering products:', list.length);
    console.log('Sample product:', sample);
    console.log('Sample product variants length:', Array.isArray(sample.variants) ? sample.variants.length : 0);
  } else {
    console.log('Rendering products: 0');
  }

  if (list.length === 0) {
    grid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Không tìm thấy sản phẩm nào</p>';
    return;
  }

  const html = list.map((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const minPrice = variants.length ? Math.min(...variants.map(v => Number(v.price) || 0)) : 0;
    const hasStock = variants.some(v => Number(v.quantity) > 0);
    const defaultVariant = variants.find(v => Number(v.quantity) > 0) || variants[0];

    const displayImage = product.image || 'images/placeholder.svg';

    return `
      <div class="product-card" data-id="${product.id}">
        <img src="${displayImage}" alt="${product.name}" class="product-image"
             onerror="this.src='images/placeholder.svg'">
        <div class="product-info">
          <h3 class="product-name">${product.name}</h3>
          <p class="product-price">Giá ${formatCurrency(minPrice)}</p>
          <div style="display:flex;gap:8px;">
            <a class="btn view-product-link"
                href="product-detail.html?id=${encodeURIComponent(String(product.id))}">
                Chi tiết
            </a>

            ${defaultVariant && Number(defaultVariant.quantity) > 0
              ? `<button class="btn btn-secondary" style="flex:1;"
                        onclick="addToCartFromHome('${product.id}','${defaultVariant.id}')">
                   Thêm giỏ
                 </button>`
              : `<button class="btn btn-disabled" style="flex:1;" disabled>Hết hàng</button>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = html;
}


    setupEventListeners() {
  const minSlider = document.getElementById('minPriceSlider');
  const maxSlider = document.getElementById('maxPriceSlider');
  const applyBtn  = document.getElementById('applyFilter');
  const resetBtn  = document.getElementById('resetFilter');
  const cateSel   = document.getElementById('categoryFilter');

  applyBtn?.addEventListener('click', () => this.applyFilters());
  resetBtn?.addEventListener('click', () => this.resetFilters());

  cateSel?.addEventListener('change', () => this.applyFilters());

  ['input','change'].forEach(ev => {
    minSlider?.addEventListener(ev, () => this.applyFilters());
    maxSlider?.addEventListener(ev, () => this.applyFilters());
  });
}


    applyFilters() {
  const categoryEl = document.getElementById('categoryFilter');
  const minEl = document.getElementById('minPriceSlider');
  const maxEl = document.getElementById('maxPriceSlider');

  const categoryId = categoryEl?.value ?? ""; // string
  const minPrice   = Number(minEl?.value ?? 0);
  const maxPrice   = Number(maxEl?.value ?? Number.POSITIVE_INFINITY);

  const products = Array.isArray(this.products) ? this.products : [];

  this.filteredProducts = products.filter((product) => {
    // lọc theo danh mục (để trống = tất cả)
    const matchCategory = !categoryId || String(product.cate_id) === String(categoryId);

    // lấy min price từ biến thể (nếu không có biến thể thì 0)
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const productMinPrice = variants.length
      ? Math.min(...variants.map(v => Number(v.price) || 0))
      : 0;

    const matchPrice = productMinPrice >= minPrice && productMinPrice <= maxPrice;
    return matchCategory && matchPrice;
  });

  // cập nhật text hiển thị khoảng giá (nếu có)
  const disp = document.getElementById('priceRangeDisplay');
  if (disp) disp.textContent = `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;

  this.renderProducts();
}




    resetFilters() {
        document.getElementById('categoryFilter').value = '';
        document.getElementById('minPriceSlider').value = '0';
        document.getElementById('maxPriceSlider').value = '10000000';
        document.getElementById('priceRangeDisplay').textContent = '0đ - 10,000,000đ';
        this.filteredProducts = [...this.products];
        this.renderProducts();
    }
}

// Hàm global để thêm vào giỏ hàng từ trang chủ
window.addToCartFromHome = (productId, variantId) => {
  const homePage = window.homePageInstance;
  if (!homePage) return;

  const pid = String(productId);
  const vid = String(variantId);

  const product = homePage.products.find(p => String(p.id) === pid);
  const variant = product?.variants.find(v => String(v.id) === vid);

  if (product && variant && Number(variant.quantity) > 0) {
    const result = Cart.addItem(product, variant, 1);
    showToast(result.message, result.success ? 'success' : 'error');
  } else {
    showToast('Sản phẩm đã hết hàng', 'error');
  }
};


document.addEventListener('DOMContentLoaded', () => {
    window.homePageInstance = new HomePage();
});