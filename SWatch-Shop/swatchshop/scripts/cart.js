class Cart {
    constructor() {
        this.items = this.getCartItems();
    }

    getCartItems() {
  try {
    const raw = localStorage.getItem('cart');
    if (!raw) return [];
    const data = JSON.parse(raw);

    // Chuẩn hoá: chấp nhận cả {items:[...]} hoặc [...]
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;

    // Nếu sai định dạng thì reset
    return [];
  } catch (e) {
    console.warn('Corrupt cart in localStorage, resetting…', e);
    localStorage.removeItem('cart');
    return [];
  }
}

    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.items));
        this.updateCartBadge();
    }

    addItem(product, variant, quantity = 1) {
        const existingItem = this.items.find(
            item => item.product.id === product.id && item.variant.id === variant.id
        );

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({ product, variant, quantity });
        }

        this.saveCart();
        return { success: true, message: 'Đã thêm vào giỏ hàng' };
    }

    updateQuantity(productId, variantId, quantity) {
        const item = this.items.find(
            item => item.product.id === productId && item.variant.id === variantId
        );

        if (item) {
            if (quantity <= 0) {
                this.removeItem(productId, variantId);
            } else {
                item.quantity = quantity;
                this.saveCart();
            }
        }
    }

    removeItem(productId, variantId) {
        this.items = this.items.filter(
            item => !(item.product.id === productId && item.variant.id === variantId)
        );
        this.saveCart();
    }

    getTotal() {
  const arr = Array.isArray(this.items) ? this.items : [];
  return arr.reduce((total, item) => total + (Number(item?.variant?.price) * Number(item?.quantity || 0)), 0);
}

    getItemCount() {
  const arr = Array.isArray(this.items) ? this.items : [];
  return arr.reduce((count, item) => count + Number(item?.quantity || 0), 0);
}

    clear() {
        this.items = [];
        this.saveCart();
    }

    updateCartBadge() {
        const badge = document.querySelector('.cart-badge');
        if (badge) {
            const count = this.getItemCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }
}

export default new Cart();
