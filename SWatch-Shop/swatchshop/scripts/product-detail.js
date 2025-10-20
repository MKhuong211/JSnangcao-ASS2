import API from './api.js';
import API_CONFIG from './config.js';
import Auth from './auth.js';
import Cart from './cart.js';
import { formatCurrency, showToast } from './utils.js';

class ProductDetailPage {
    constructor() {
        this.product = null;
        this.variants = [];
        this.selectedColor = null;
        this.selectedSize = null;
        this.selectedVariant = null;
        this.init();
    }

    async init() {
        this.updateAuthUI();
        Cart.updateCartBadge();
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (productId) {
            await this.loadProduct(productId);
        } else {
            window.location.href = 'index.html';
        }
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

    async loadProduct(id) {
        try {
            this.product = await API.get(API_CONFIG.ENDPOINTS.products, id);
            const allVariants = await API.get(API_CONFIG.ENDPOINTS.productVariants);
            this.variants = allVariants.filter(v => v.product_id == id);

            if (this.variants.length > 0) {
                this.selectedColor = this.variants[0].color;
                this.selectedSize = this.variants[0].size;
                this.updateSelectedVariant();
            }

            this.render();
        } catch (error) {
            console.error('Error loading product:', error);
            document.getElementById('productDetail').innerHTML = 
                '<p style="color: red;">Không thể tải sản phẩm</p>';
        }
    }

    getAvailableColors() {
        const colors = new Map();
        this.variants.forEach(v => {
            if (!colors.has(v.color)) {
                colors.set(v.color, v.color_code);
            }
        });
        return Array.from(colors, ([name, code]) => ({ name, code }));
    }

    getAvailableSizes(color) {
        return [...new Set(this.variants
            .filter(v => !color || v.color === color)
            .map(v => v.size))];
    }

    updateSelectedVariant() {
        this.selectedVariant = this.variants.find(v => 
            v.color === this.selectedColor && v.size === this.selectedSize
        );

        if (!this.selectedVariant && this.selectedColor) {
            const availableSizes = this.getAvailableSizes(this.selectedColor);
            if (availableSizes.length > 0) {
                this.selectedSize = availableSizes[0];
                this.selectedVariant = this.variants.find(v => 
                    v.color === this.selectedColor && v.size === this.selectedSize
                );
            }
        }

        // Cập nhật ảnh khi thay đổi biến thể - chỉ dùng ảnh biến thể
        const productImage = document.querySelector('#productDetail img');
        if (productImage && this.selectedVariant) {
            productImage.src = this.selectedVariant.image || '/images/placeholder.svg';
        }
    }

    render() {
        const container = document.getElementById('productDetail');
        const availableColors = this.getAvailableColors();
        const availableSizes = this.getAvailableSizes(this.selectedColor);

        // Trang chi tiết chỉ hiển thị ảnh biến thể
        const displayImage = this.selectedVariant?.image || 'images/placeholder.svg';

        container.innerHTML = `
            <div style="flex: 1; min-width: 300px;">
                <img src="${displayImage}" 
                     alt="${this.product.name}" 
                     style="width: 100%; border-radius: 8px;"
                     onerror="this.src='images/placeholder.svg'">
            </div>
            <div style="flex: 1; min-width: 300px;">
                <h1>${this.product.name}</h1>
                <p style="color: #666; margin: 20px 0;">${this.product.detail || 'Không có mô tả'}</p>

                ${availableColors.length > 1 ? `
                    <div style="margin: 30px 0;">
                        <h3 style="margin-bottom: 15px;">Màu sắc: <span style="color: var(--primary-color);">${this.selectedColor}</span></h3>
                        <div id="colorList" style="display: flex; gap: 12px; flex-wrap: wrap;">
                            ${availableColors.map(color => `
                                <button class="color-btn ${color.name === this.selectedColor ? 'active' : ''}" 
                                        data-color="${color.name}"
                                        style="width: 45px; height: 45px; border: 3px solid ${color.name === this.selectedColor ? 'var(--primary-color)' : '#ddd'}; 
                                               border-radius: 50%; background: ${color.code}; cursor: pointer;
                                               box-shadow: ${color.name === this.selectedColor ? '0 0 10px rgba(224, 52, 127, 0.3)' : 'none'};
                                               position: relative; transition: all 0.3s ease;"
                                        title="${color.name}">
                                    ${color.code === '#FFFFFF' ? '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 1px solid #ddd; border-radius: 50%;"></div>' : ''}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${availableSizes.length > 1 || (availableSizes.length === 1 && availableSizes[0] !== 'OneSize') ? `
                    <div style="margin: 30px 0;">
                        <h3 style="margin-bottom: 15px;">Kích thước: <span style="color: var(--primary-color);">${this.selectedSize}</span></h3>
                        <div id="sizeList" style="display: flex; gap: 10px; flex-wrap: wrap;">
                            ${availableSizes.map(size => `
                                <button class="size-btn ${size === this.selectedSize ? 'active' : ''}" 
                                        data-size="${size}"
                                        style="padding: 12px 24px; border: 2px solid ${size === this.selectedSize ? 'var(--primary-color)' : '#ddd'}; 
                                               border-radius: 8px; background: ${size === this.selectedSize ? 'var(--primary-color)' : '#fff'};
                                               color: ${size === this.selectedSize ? '#fff' : '#333'}; cursor: pointer;
                                               font-weight: ${size === this.selectedSize ? 'bold' : 'normal'};
                                               transition: all 0.3s ease;">
                                    ${size}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="margin: 30px 0;">
                    <p style="font-size: 32px; color: var(--primary-color); font-weight: bold;">
                        ${this.selectedVariant ? formatCurrency(this.selectedVariant.price) : 'Chọn biến thể'}
                    </p>
                    ${this.selectedVariant ? `
                        <p style="color: ${this.selectedVariant.quantity > 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            ${this.selectedVariant.quantity > 0 ? `Còn ${this.selectedVariant.quantity} sản phẩm` : 'Hết hàng'}
                        </p>
                    ` : ''}
                </div>

                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="number" id="quantity" value="1" min="1" max="${this.selectedVariant?.quantity || 0}" 
                           style="width: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;"
                           ${!this.selectedVariant || this.selectedVariant.quantity === 0 ? 'disabled' : ''}>
                    <button id="addToCart" class="btn" 
                            ${!this.selectedVariant || this.selectedVariant.quantity === 0 ? 'disabled' : ''}>
                        Thêm vào giỏ hàng
                    </button>
                </div>
            </div>
        `;

        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const colorName = e.currentTarget.dataset.color;
                this.selectedColor = colorName;
                this.updateSelectedVariant();
                this.render();
            });
        });

        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sizeName = e.currentTarget.dataset.size;
                this.selectedSize = sizeName;
                this.updateSelectedVariant();
                this.render();
            });
        });

        const addToCartBtn = document.getElementById('addToCart');
        if (addToCartBtn && this.selectedVariant && this.selectedVariant.quantity > 0) {
            addToCartBtn.addEventListener('click', () => {
                const quantity = parseInt(document.getElementById('quantity').value);
                const result = Cart.addItem(this.product, this.selectedVariant, quantity);
                showToast(result.message, result.success ? 'success' : 'error');
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ProductDetailPage();
});