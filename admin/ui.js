/**
 * @fileoverview Módulo de Funções de Interface (UI) para o Painel de Admin.
 * Exporta funções para manipulação do DOM e feedback ao utilizador.
 */

// Centraliza todos os seletores de elementos do DOM para fácil manutenção.
export const DOMElements = {
    authScreen: document.getElementById('auth-screen'),
    adminPanel: document.getElementById('admin-panel'),
    loginForm: document.getElementById('login-form'),
    logoutButton: document.getElementById('logout-button'),
    productForm: document.getElementById('product-form'),
    productListBody: document.getElementById('product-list-body'),
    authMessage: document.getElementById('auth-message'),
    navLinks: document.querySelectorAll('.admin-nav-link'),
    views: document.querySelectorAll('.admin-view'),
    addCouponForm: document.getElementById('add-coupon-form'),
    couponListBody: document.getElementById('coupon-list-body'),
    addReelForm: document.getElementById('add-reel-form'),
    reelListBody: document.getElementById('reel-list-body'),
    orderListBody: document.getElementById('order-list-body'),
    reviewListBody: document.getElementById('review-list-body'),
    adminEmail: document.getElementById('admin-email'),
    productIdField: document.getElementById('product-id'),
    submitProductBtn: document.getElementById('submit-product-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    prevProductPageBtn: document.getElementById('prev-product-page'),
    nextProductPageBtn: document.getElementById('next-product-page'),
    productPageInfo: document.getElementById('product-page-info'),
};

/**
 * Mostra uma notificação toast.
 * @param {string} message - A mensagem a ser exibida.
 * @param {boolean} isError - Se a notificação é de erro.
 */
export function showToast(message, isError = false) {
    const toast = document.getElementById('admin-toast');
    const toastMessage = document.getElementById('admin-toast-message');
    const iconContainer = document.getElementById('admin-toast-icon');
    if (!toast || !toastMessage || !iconContainer) return;

    const iconName = isError ? 'x-circle' : 'check-circle';
    const iconColorClass = isError ? 'text-red-400' : 'text-green-400';

    iconContainer.innerHTML = `<i data-feather="${iconName}" class="${iconColorClass}"></i>`;
    toastMessage.textContent = message;
    
    feather.replace();
    
    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

/**
 * Mostra uma mensagem na tela de autenticação.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} color - A cor base para o estilo da mensagem (ex: 'red', 'green').
 */
export function showAuthMessage(message, color) {
    DOMElements.authMessage.textContent = message;
    DOMElements.authMessage.className = `mb-4 p-3 rounded-md text-center bg-${color}-100 text-${color}-700`;
}

/**
 * Alterna a visibilidade das diferentes "views" do painel.
 * @param {string} viewToShow - O ID da view a ser mostrada (ex: 'dashboard').
 */
export function switchView(viewToShow) {
    DOMElements.views.forEach(view => view.classList.add('hidden'));
    document.getElementById(`view-${viewToShow}`).classList.remove('hidden');

    DOMElements.navLinks.forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === viewToShow);
    });
}

/**
 * Renderiza estrelas de avaliação com base numa nota.
 * @param {number} rating - A nota da avaliação.
 * @returns {string} O HTML das estrelas.
 */
export function renderStars(rating) {
    let stars = '';
    const ratingValue = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
        stars += `<i data-feather="star" class="w-4 h-4 ${i <= ratingValue ? 'text-yellow-500 fill-current' : 'text-gray-300'}"></i>`;
    }
    return `<div class="flex items-center">${stars}</div>`;
}
