import API from '../api.js';
import API_CONFIG from '../config.js';
import Auth from '../auth.js';
import { formatCurrency, formatDate } from '../utils.js';

class Dashboard {
    constructor() {
        this.init();
    }

    async init() {
        if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
            window.location.href = '../login.html';
            return;
        }

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });

        await this.loadStatistics();
        await this.loadRecentOrders();
    }

    async loadStatistics() {
  try {
    const [orders, orderDetails, variants] = await Promise.all([
      API.get(API_CONFIG.ENDPOINTS.orders),
      API.get(API_CONFIG.ENDPOINTS.orderDetails),
      API.get(API_CONFIG.ENDPOINTS.productVariants)
    ]);

    const completedIds = new Set(
      (Array.isArray(orders) ? orders : [])
        .filter(o => o.status === 'completed')
        .map(o => String(o.id))
    );

    const totalProductsSold = (Array.isArray(orderDetails) ? orderDetails : [])
      .filter(d => completedIds.has(String(d.order_id)))
      .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);

    const totalRevenue = (Array.isArray(orders) ? orders : [])
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const totalStock = (Array.isArray(variants) ? variants : [])
      .reduce((sum, v) => sum + (Number(v?.quantity) || 0), 0);

    const newOrders = (Array.isArray(orders) ? orders : [])
      .filter(o => o.status === 'pending').length;

    document.getElementById('totalProductsSold').textContent = totalProductsSold;
    document.getElementById('totalRevenue').textContent      = formatCurrency(totalRevenue);
    document.getElementById('totalStock').textContent         = totalStock;
    document.getElementById('newOrders').textContent          = newOrders;
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

    async loadRecentOrders() {
        try {
            const orders = await API.get(API_CONFIG.ENDPOINTS.orders);
            const recentOrders = orders.slice(-5).reverse();

            const tbody = document.getElementById('recentOrders');
            if (recentOrders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Chưa có đơn hàng nào</td></tr>';
                return;
            }

            tbody.innerHTML = recentOrders.map(order => `
                <tr>
                    <td>#${order.id}</td>
                    <td>${order.customer_name || 'N/A'}</td>
                    <td>${formatDate(order.created_date)}</td>
                    <td>${formatCurrency(order.total || 0)}</td>
                    <td>
                        <span style="padding: 5px 10px; border-radius: 5px; background: ${
                            order.status === 'pending' ? '#ff9800' : 
                            order.status === 'completed' ? '#4caf50' : '#f44336'
                        }; color: #fff;">
                            ${order.status === 'pending' ? 'Chờ xử lý' : 
                              order.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
                        </span>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading recent orders:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
