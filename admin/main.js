/**
 * @fileoverview Ficheiro principal (entry point) do Painel de Admin.
 * Orquestra a inicialização dos módulos e a gestão de eventos.
 */

// Módulos de UI e Autenticação
import { DOMElements, switchView } from './ui.js';
import { authStateObserver, handleLogin, handleLogout } from './auth.js';

// Módulos de Gestão de Conteúdo
import { fetchAndRenderProducts, handleProductFormSubmit, resetProductForm, populateProductForm, deleteProduct } from './products.js';
import { fetchAndRenderOrders, updateOrderStatus } from './orders.js';
import { fetchAndRenderReviews, deleteReview } from './reviews.js';
import { fetchAndRenderCoupons, handleCouponFormSubmit, deleteCoupon } from './coupons.js';
import { fetchAndRenderReels, handleAddReelFormSubmit, deleteReel } from './reels.js';
import { fetchStats } from './stats.js';
import { hideAdminConfirmationModal } from './ui.js'; // Importa a função para fechar o modal

/**
 * Inicializa todas as funcionalidades do painel após o login do admin.
 */
export function initializeAdminPanel() {
    switchView('dashboard');
    fetchStats();
    fetchAndRenderProducts('first');
    fetchAndRenderOrders();
    fetchAndRenderReviews();
    fetchAndRenderCoupons();
    fetchAndRenderReels();
}

/**
 * Configura todos os event listeners da aplicação.
 */
function setupEventListeners() {
    // Autenticação
    DOMElements.loginForm.addEventListener('submit', handleLogin);
    DOMElements.logoutButton.addEventListener('click', handleLogout);

    // Navegação Principal
    DOMElements.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.dataset.view);
        });
    });

    // Produtos
    DOMElements.productForm.addEventListener('submit', handleProductFormSubmit);
    DOMElements.cancelEditBtn.addEventListener('click', resetProductForm);
    DOMElements.productListBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        if (editBtn) populateProductForm(editBtn.dataset.id);
        // Chama a função deleteProduct do módulo products.js
        if (deleteBtn) deleteProduct(deleteBtn.dataset.id);
    });
    DOMElements.nextProductPageBtn.addEventListener('click', () => fetchAndRenderProducts('next'));
    DOMElements.prevProductPageBtn.addEventListener('click', () => fetchAndRenderProducts('prev'));

    // Encomendas
    DOMElements.orderListBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('order-status-select')) {
            updateOrderStatus(e.target.dataset.id, e.target.value);
        }
    });
    
    // Avaliações
    DOMElements.reviewListBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-review-btn');
        if (deleteBtn) {
            const productId = deleteBtn.dataset.productId;
            const reviewIndex = parseInt(deleteBtn.dataset.reviewIndex, 10);
            // Chama a função deleteReview do módulo reviews.js
            deleteReview(productId, reviewIndex);
        }
    });

    // Cupões
    DOMElements.addCouponForm.addEventListener('submit', handleCouponFormSubmit);
    DOMElements.couponListBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-coupon-btn');
        // Chama a função deleteCoupon do módulo coupons.js
        if (deleteBtn) deleteCoupon(deleteBtn.dataset.id);
    });

    // Reels
    DOMElements.addReelForm.addEventListener('submit', handleAddReelFormSubmit);
    DOMElements.reelListBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-reel-btn');
        // Chama a função deleteReel do módulo reels.js
        if (deleteBtn) deleteReel(deleteBtn.dataset.id);
    });

    // Listener para fechar o modal de confirmação com a tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAdminConfirmationModal();
        }
    });
}

// Ponto de entrada da aplicação do painel de admin
document.addEventListener('DOMContentLoaded', () => {
    feather.replace(); // Inicializa Feather Icons
    setupEventListeners(); // Configura todos os event listeners
    authStateObserver(); // Inicia a verificação de login e o fluxo do painel
});
