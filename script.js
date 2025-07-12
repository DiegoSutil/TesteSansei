// Import Firebase modules from the latest SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc, query, where, Timestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4-kp4wBq6fz-pG1Rm3VQcq6pO17OEeOI",
  authDomain: "sansei-d3cf6.firebaseapp.com",
  projectId: "sansei-d3cf6",
  storageBucket: "sansei-d3cf6.appspot.com",
  messagingSenderId: "774111823223",
  appId: "1:774111823223:web:c03c73c4b89d96244b8d72"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =================================================================
// GLOBAL STATE & VARIABLES
// =================================================================
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
let appliedCoupon = null;
let currentUserData = null;
let allCoupons = [];
let selectedShipping = null;


// =================================================================
// UTILITY FUNCTIONS
// =================================================================
function showToast(message, isError = false) {
    const toastContainer = document.getElementById('toast-notification');
    if (!toastContainer) return;

    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `flex items-center gap-4 px-6 py-3 mb-2 rounded-xl shadow-lg bg-white text-slate-800 border-l-4 transform transition-all duration-300 opacity-0 translate-y-10 ${isError ? 'border-red-400' : 'border-green-400'}`;
    
    const iconName = isError ? 'x-circle' : 'check-circle';
    const iconColorClass = isError ? 'text-red-500' : 'text-green-500';

    toast.innerHTML = `
        <span class="flex-shrink-0"><i data-feather="${iconName}" class="${iconColorClass}"></i></span>
        <span class="font-medium">${message}</span>
    `;

    toastContainer.appendChild(toast);
    feather.replace();

    // Animate in
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-10');
    }, 10);

    // Animate out
    setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

const showLoader = (show) => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

/**
 * Exibe um modal de confirmação personalizado.
 * @param {string} message A mensagem a ser exibida no modal.
 * @param {string} [title='Confirmação'] O título do modal.
 * @returns {Promise<boolean>} Uma promessa que resolve para `true` se o usuário confirmar, `false` caso contrário.
 */
function showConfirmationModal(message, title = 'Confirmação') {
    return new Promise(resolve => {
        const modalOverlay = document.getElementById('confirmation-modal-overlay');
        const modal = document.getElementById('confirmation-modal');
        const modalTitle = document.getElementById('confirmation-modal-title');
        const modalMessage = document.getElementById('confirmation-modal-message');
        const confirmBtn = document.getElementById('confirmation-confirm-btn');
        const cancelBtn = document.getElementById('confirmation-cancel-btn');

        if (!modalOverlay || !modal || !modalTitle || !modalMessage || !confirmBtn || !cancelBtn) {
            console.error("Elementos do modal de confirmação não encontrados.");
            resolve(false); // Fallback to false if elements are missing
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Reset event listeners to prevent multiple bindings
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;

        confirmBtn.onclick = () => {
            hideConfirmationModal();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            hideConfirmationModal();
            resolve(false);
        };

        modalOverlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
    });
}

function hideConfirmationModal() {
    const modalOverlay = document.getElementById('confirmation-modal-overlay');
    const modal = document.getElementById('confirmation-modal');
    if (modalOverlay) modalOverlay.classList.add('hidden');
    if (modal) {
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}


// =================================================================
// CHECKOUT & ORDER FUNCTIONS
// =================================================================
async function handleCheckout() {
    if (!currentUserData) {
        showToast("Por favor, faça login para finalizar a compra.", true);
        toggleAuthModal(true);
        return;
    }

    if (cart.length === 0) {
        showToast("O seu carrinho está vazio.", true);
        return;
    }
    
    if (!selectedShipping) {
        showToast("Por favor, calcule e selecione uma opção de frete.", true);
        return;
    }

    showLoader(true);

    const total = calculateTotal();
    const orderItems = cart.map(item => {
        const product = allProducts.find(p => p.id === item.id);
        return {
            productId: item.id,
            name: product.name,
            quantity: item.quantity,
            price: product.price
        };
    });

    const newOrder = {
        userId: currentUserData.uid,
        userEmail: currentUserData.email,
        items: orderItems,
        total: total,
        shipping: selectedShipping,
        status: "Pendente",
        createdAt: Timestamp.now(),
        coupon: appliedCoupon ? appliedCoupon.code : null
    };

    try {
        await addDoc(collection(db, "orders"), newOrder);
        
        // Clear cart after successful order
        cart = [];
        selectedShipping = null;
        localStorage.removeItem('sanseiCart');
        await syncCartWithFirestore();

        showToast("Encomenda realizada com sucesso!");
        updateCartIcon();
        toggleCart(false);
        showPage('profile'); // Redirect to profile to see the new order
    } catch (error) {
        console.error("Error creating order: ", error);
        showToast("Ocorreu um erro ao processar a sua encomenda.", true);
    } finally {
        showLoader(false);
    }
}

function calculateSubtotal() {
    return cart.reduce((sum, item) => {
        const product = allProducts.find(p => p.id === item.id);
        return sum + (product ? product.price * item.quantity : 0);
    }, 0);
}

function calculateTotal() {
    let subtotal = calculateSubtotal();

    if (appliedCoupon) {
        const discountAmount = subtotal * appliedCoupon.discount;
        subtotal -= discountAmount;
    }

    const shippingCost = selectedShipping ? selectedShipping.price : 0;

    return subtotal + shippingCost;
}


// =================================================================
// SHIPPING FUNCTIONS
// =================================================================
async function handleCalculateShipping() {
    const cepInput = document.getElementById('cep-input');
    const cep = cepInput.value.replace(/\D/g, ''); // Remove non-digits
    const btn = document.getElementById('calculate-shipping-btn');
    const btnText = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader-sm');

    if (cep.length !== 8) {
        showToast("Por favor, insira um CEP válido.", true);
        return;
    }

    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    btn.disabled = true;

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
        if (!response.ok) {
            throw new Error('CEP não encontrado ou API indisponível.');
        }
        
        // This is a simplified calculation. For real scenarios, use Correios API with package dimensions.
        const shippingOptions = [
            { Codigo: '04510', nome: 'PAC', PrazoEntrega: 10, Valor: '25,50' },
            { Codigo: '04014', nome: 'SEDEX', PrazoEntrega: 5, Valor: '45,80' }
        ];

        renderShippingOptions(shippingOptions);

    } catch (error) {
        console.error("Shipping calculation error:", error);
        showToast("Cálculo indisponível. Usando valores padrão.", true);
        
        // Fallback logic: If the API fails, provide default shipping options.
        const defaultShippingOptions = [
            { Codigo: '04510', nome: 'PAC (Estimado)', PrazoEntrega: 12, Valor: '28,00' },
            { Codigo: '04014', nome: 'SEDEX (Estimado)', PrazoEntrega: 7, Valor: '52,00' }
        ];
        renderShippingOptions(defaultShippingOptions);

    } finally {
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
        btn.disabled = false;
    }
}

function renderShippingOptions(options) {
    const container = document.getElementById('shipping-options');
    container.innerHTML = '';
    selectedShipping = null;
    renderCart(); // Recalculate total without shipping

    if (!options || options.length === 0 || options.every(opt => opt.erro)) {
         container.innerHTML = `<p class="text-red-500 text-sm">Nenhuma opção de frete encontrada para o CEP informado.</p>`;
         return;
    }

    options.forEach(option => {
        if (option.erro) return;

        const price = parseFloat(option.Valor.replace(',', '.'));
        const optionId = `shipping-${option.Codigo}`;
        const label = document.createElement('label');
        label.className = 'flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-gray-50';
        label.innerHTML = `
            <div class="flex items-center">
                <input type="radio" name="shipping-option" id="${optionId}" value="${price}" data-name="${option.nome}" class="form-radio text-gold-500">
                <div class="ml-3">
                    <p class="font-semibold">${option.nome}</p>
                    <p class="text-sm text-gray-500">Prazo: ${option.PrazoEntrega} dias úteis</p>
                </div>
            </div>
            <span class="font-bold">R$ ${price.toFixed(2).replace('.', ',')}</span>
        `;
        
        label.querySelector('input').addEventListener('change', () => {
            selectedShipping = {
                method: option.nome,
                price: price,
                deadline: option.PrazoEntrega
            };
            renderCart();
        });

        container.appendChild(label);
    });
}


// =================================================================
// CART FUNCTIONS (WITH FIRESTORE INTEGRATION)
// =================================================================
async function syncCartWithFirestore() {
    if (!currentUserData) return;
    const userRef = doc(db, "users", currentUserData.uid);
    await updateDoc(userRef, { cart: cart });
}

function flyToCart(targetElement) {
    const cartIcon = document.getElementById('cart-button');
    if (!targetElement || !cartIcon) return;

    const rect = targetElement.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const flyingImage = document.createElement('img');
    flyingImage.src = targetElement.src;
    flyingImage.className = 'fly-to-cart';
    flyingImage.style.left = `${rect.left}px`;
    flyingImage.style.top = `${rect.top}px`;
    flyingImage.style.width = `${rect.width}px`;
    flyingImage.style.height = `${rect.height}px`;

    document.body.appendChild(flyingImage);

    // Force reflow to apply the initial state before the transition
    flyingImage.offsetHeight; 

    // Move to the cart
    flyingImage.style.left = `${cartRect.left + cartRect.width / 2}px`;
    flyingImage.style.top = `${cartRect.top + cartRect.height / 2}px`;
    flyingImage.style.width = '20px';
    flyingImage.style.height = '20px';
    flyingImage.style.opacity = '0';

    setTimeout(() => {
        flyingImage.remove();
    }, 1000); // Duração da animação
}


async function addToCart(productId, quantity = 1, event) {
    const button = event.target.closest('.add-to-cart-btn');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loader-sm"></span>';

    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error("Product not found in allProducts array:", productId);
        button.disabled = false;
        button.innerHTML = originalText;
        return;
    }
    
    const productImage = button.closest('.group').querySelector('img');
    flyToCart(productImage);

    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += quantity;
    } else {
        cart.push({ id: productId, quantity: quantity });
    }
    localStorage.setItem('sanseiCart', JSON.stringify(cart));
    await syncCartWithFirestore();
    updateCartIcon();
    
    setTimeout(() => {
        showToast(`${product.name} foi adicionado ao carrinho!`);
        button.disabled = false;
        button.innerHTML = originalText;
    }, 500);
}

async function removeFromCart(productId) {
    const confirmed = await showConfirmationModal('Tem certeza que deseja remover este item do carrinho?', 'Remover do Carrinho');
    if (confirmed) {
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('sanseiCart', JSON.stringify(cart));
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
    }
}

async function updateQuantity(productId, newQuantity) {
    const cartItem = cart.find(item => item.id === productId); // Corrigido: era item.id !== productId
    if (!cartItem) return;
    if (newQuantity <= 0) {
        await removeFromCart(productId);
    } else {
        cartItem.quantity = newQuantity;
        localStorage.setItem('sanseiCart', JSON.stringify(cart));
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
    }
}

function updateCartIcon() {
    const cartCountEl = document.getElementById('cart-count');
    const mobileCartCountEl = document.getElementById('mobile-cart-count'); // New mobile cart count
    if (cartCountEl) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountEl.textContent = totalItems;
        if (mobileCartCountEl) {
            mobileCartCountEl.textContent = totalItems;
        }
    }
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartTotalEl = document.getElementById('cart-total');
    const discountInfoEl = document.getElementById('discount-info');
    const shippingCostLine = document.getElementById('shipping-cost-line');
    const shippingCostEl = document.getElementById('shipping-cost');
    
    if (!cartItemsEl || !cartSubtotalEl || !cartTotalEl) {
        return;
    }
    
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center">Seu carrinho está vazio.</p>';
        cartSubtotalEl.textContent = 'R$ 0,00';
        cartTotalEl.textContent = 'R$ 0,00';
        shippingCostLine.classList.add('hidden');
        if(discountInfoEl) discountInfoEl.innerHTML = '';
        return;
    }
    
    let subtotal = calculateSubtotal();
    cartSubtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.',',')}`;

    if (appliedCoupon) {
        const discountAmount = subtotal * appliedCoupon.discount;
        subtotal -= discountAmount;
        discountInfoEl.innerHTML = `Cupom "${appliedCoupon.code}" aplicado! (-R$ ${discountAmount.toFixed(2).replace('.',',')}) <button id="remove-coupon-btn" class="text-red-500 ml-2 font-semibold">Remover</button>`;
        document.getElementById('remove-coupon-btn').addEventListener('click', removeCoupon);
    } else {
        if(discountInfoEl) discountInfoEl.innerHTML = '';
    }

    if(selectedShipping) {
        shippingCostEl.textContent = `R$ ${selectedShipping.price.toFixed(2).replace('.', ',')}`;
        shippingCostLine.classList.remove('hidden');
    } else {
        shippingCostLine.classList.add('hidden');
    }

    const total = calculateTotal();
    cartTotalEl.textContent = `R$ ${total.toFixed(2).replace('.',',')}`;
    
    cartItemsEl.innerHTML = cart.map(item => {
        const product = allProducts.find(p => p.id === item.id);
        if (!product) return ''; // Skip if product not found
        return `
        <div class="flex items-center gap-4 mb-4">
            <img src="${product.image}" alt="${product.name}" class="w-16 h-20 object-cover rounded-md">
            <div class="flex-grow">
                <h4 class="font-semibold">${product.name}</h4>
                <p class="text-sm text-gray-600">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <div class="flex items-center mt-2">
                    <button data-id="${item.id}" data-qty="${item.quantity - 1}" class="cart-qty-btn w-6 h-6 border rounded-md">-</button>
                    <span class="px-3">${item.quantity}</span>
                    <button data-id="${item.id}" data-qty="${item.quantity + 1}" class="cart-qty-btn w-6 h-6 border rounded-md">+</button>
                </div>
            </div>
            <button data-id="${item.id}" class="cart-remove-btn text-red-500 hover:text-red-700"><i data-feather="trash-2" class="w-5 h-5"></i></button>
        </div>
    `}).join('');
    
    feather.replace();
}

function handleApplyCoupon(e) {
    e.preventDefault();
    const couponInput = document.getElementById('coupon-input');
    const code = couponInput.value.trim().toUpperCase();
    const coupon = allCoupons.find(c => c.code === code);

    if (coupon) {
        appliedCoupon = coupon;
        showToast(`Cupom "${code}" aplicado com sucesso!`);
        renderCart();
    } else {
        showToast('Cupom inválido.', true);
    }
    couponInput.value = '';
}

function removeCoupon() {
    appliedCoupon = null;
    renderCart();
    showToast('Cupom removido.');
}

// =================================================================
// PRODUCT & RENDERING FUNCTIONS
// =================================================================
function renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += `<i data-feather="star" class="feather-star ${i <= rating ? 'filled' : ''}"></i>`;
    }
    return `<div class="flex items-center star-rating">${stars}</div>`;
}

function createProductCard(product, delay = 0) {
    const isInWishlist = currentUserData && currentUserData.wishlist.includes(product.id);
    return `
        <div class="bg-white group text-center rounded-lg shadow-sm flex flex-col transition-all-ease hover:-translate-y-2 hover:shadow-xl whitespace-normal flex-shrink-0 w-full sm:w-auto" data-aos="fade-up" data-aos-delay="${delay}">
            <div class="relative overflow-hidden rounded-t-lg">
                <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover group-hover:scale-105 transition-all-ease cursor-pointer" data-id="${product.id}">
                <button class="wishlist-heart absolute top-4 right-4 p-2 bg-white/70 rounded-full ${isInWishlist ? 'active' : ''}" data-id="${product.id}">
                    <i data-feather="heart" class="w-5 h-5"></i>
                </button>
                <!-- Quick View Button -->
                <button class="quick-view-btn absolute bottom-0 left-0 right-0 bg-black/70 text-white py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" data-id="${product.id}">
                    Visualização Rápida
                </button>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <h3 class="font-heading font-semibold text-xl cursor-pointer" data-id="${product.id}">${product.name}</h3>
                <div class="flex justify-center my-2">${renderStars(product.rating)}</div>
                <p class="text-gold-500 font-bold mt-auto text-lg">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn mt-4 bg-black text-white py-2 px-6 rounded-full hover:bg-gold-500 hover:text-black transition-all-ease" data-id="${product.id}">Adicionar ao Carrinho</button>
            </div>
        </div>
    `;
}

function renderProducts(productsToRender, containerId) {
    const productListEl = document.getElementById(containerId);
    if (!productListEl) return;
    
    if (productsToRender.length === 0) {
        productListEl.innerHTML = `
            <div class="col-span-full text-center text-gray-600">
                <p class="text-xl mb-2">Nenhum perfume encontrado com estes filtros.</p>
                <p>Que tal tentar uma nova combinação ou ver os nossos mais vendidos?</p>
            </div>
        `;
    } else {
        // Apply cascade animations with data-aos-delay
        productListEl.innerHTML = productsToRender.map((product, index) => createProductCard(product, index * 100)).join('');
    }
    AOS.refresh();
    feather.replace();
}

function applyFilters() {
    let filteredProducts = [...allProducts];
    const selectedCategories = Array.from(document.querySelectorAll('#filter-cat-perfume, #filter-cat-decant'))
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (selectedCategories.length > 0) {
        filteredProducts = filteredProducts.filter(p => selectedCategories.includes(p.category));
    }

    // Price Range Filter
    const priceMin = parseFloat(document.getElementById('price-min').value);
    const priceMax = parseFloat(document.getElementById('price-max').value);
    filteredProducts = filteredProducts.filter(p => p.price >= priceMin && p.price <= priceMax);

    // Update price display
    document.getElementById('price-min-display').textContent = `R$ ${priceMin.toFixed(2).replace('.', ',')}`;
    document.getElementById('price-max-display').textContent = `R$ ${priceMax.toFixed(2).replace('.', ',')}`;
    
    const sortBy = document.getElementById('sort-by').value;
    if (sortBy === 'price-asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'popularity') {
        filteredProducts.sort((a, b) => b.rating - a.rating);
    }

    renderProducts(filteredProducts, 'product-list-fragrancias');
}

async function fetchAndRenderReels() {
    const reelsContainer = document.getElementById('reels-container');
    if (!reelsContainer) return;

    try {
        const reelsSnapshot = await getDocs(collection(db, "reels"));
        if (reelsSnapshot.empty) {
            reelsContainer.innerHTML = '<p class="text-gray-400 col-span-full text-center">Nenhum reel encontrado.</p>';
            return;
        }
        reelsContainer.innerHTML = ''; // Clear existing
        reelsSnapshot.forEach(doc => {
            const reel = doc.data();
            const reelElement = document.createElement('a');
            reelElement.href = reel.url;
            reelElement.target = '_blank';
            reelElement.className = 'block relative group';
            reelElement.innerHTML = `
                <img src="${reel.thumbnail}" alt="Reel" class="w-full h-full object-cover rounded-lg aspect-square">
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all-ease flex items-center justify-center">
                    <i data-feather="play-circle" class="text-white opacity-0 group-hover:opacity-100 w-10 h-10"></i>
                </div>
            `;
            reelsContainer.appendChild(reelElement);
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching reels for homepage:", error);
        reelsContainer.innerHTML = '<p class="text-red-500 col-span-full text-center">Não foi possível carregar os reels.</p>';
    }
}

// =================================================================
// AUTH, WISHLIST & SEARCH
// =================================================================

function renderAuthForm(isLogin = true) {
    const authContent = document.getElementById('auth-content');
    if (!authContent) return;
    let formHtml = `
        <h2 class="font-heading text-3xl font-bold text-center mb-6">${isLogin ? 'Login' : 'Criar Conta'}</h2>
        <div id="auth-error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 hidden" role="alert"></div>
        <form id="auth-form">
            <div class="mb-4">
                <label for="auth-email" class="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" id="auth-email" required class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
            </div>
            <div class="mb-4">
                <label for="auth-password" class="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
                <input type="password" id="auth-password" required class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
            </div>
    `;
    if (!isLogin) {
        formHtml += `
            <div class="mb-6">
                <label for="auth-confirm-password" class="block text-sm font-semibold text-gray-700 mb-2">Confirmar Senha</label>
                <input type="password" id="auth-confirm-password" required class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500">
            </div>
        `;
    }
    formHtml += `
            <button type="submit" class="w-full bg-gold-500 text-black font-bold py-3 rounded-md hover:bg-gold-600 transition-all-ease">
                ${isLogin ? 'Entrar' : 'Registar'}
            </button>
        </form>
        <p class="text-center text-sm mt-4">
            ${isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <a href="#" id="auth-switch" class="text-gold-500 font-semibold">
                ${isLogin ? 'Crie uma aqui.' : 'Faça login.'}
            </a>
        </p>
    `;
    authContent.innerHTML = formHtml;
    document.getElementById('auth-form').addEventListener('submit', isLogin ? handleLogin : handleRegister);
    document.getElementById('auth-switch').addEventListener('click', (e) => {
        e.preventDefault();
        renderAuthForm(!isLogin);
    });
}

function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    showLoader(true);
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        toggleAuthModal(false);
        showToast(`Bem-vindo(a) de volta!`);
    } catch (error) {
        showAuthError('Email ou senha inválidos.');
        console.error("Login error:", error);
    } finally {
        showLoader(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const confirmPassword = document.getElementById('auth-confirm-password').value;
    
    if (password !== confirmPassword) {
        showAuthError('As senhas não coincidem.');
        return;
    }
    showLoader(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            wishlist: [],
            cart: [] // Initialize cart in Firestore
        });
        showToast('Conta criada com sucesso! Faça login para continuar.');
        renderAuthForm(true);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showAuthError('Este email já está registado.');
        } else {
            showAuthError('Ocorreu um erro ao criar a conta.');
        }
        console.error("Register error:", error);
    } finally {
        showLoader(false);
    }
}

async function logout() {
    await signOut(auth);
    currentUserData = null;
    cart = JSON.parse(localStorage.getItem('sanseiCart')) || []; // Revert to local cart
    updateAuthUI();
    updateCartIcon();
    showPage('inicio');
    showToast('Sessão terminada.');
}

function updateAuthUI(user) {
    const userButton = document.getElementById('user-button');
    const mobileUserLink = document.getElementById('mobile-user-link');
    const mobileBottomUserLink = document.getElementById('mobile-bottom-user-link'); // New
    if (user) {
        userButton.onclick = () => showPage('profile');
        mobileUserLink.onclick = (e) => { e.preventDefault(); showPage('profile'); };
        mobileUserLink.textContent = 'Minha Conta';
        if (mobileBottomUserLink) { // Update new mobile bottom nav link
            mobileBottomUserLink.onclick = (e) => { e.preventDefault(); showPage('profile'); };
            mobileBottomUserLink.querySelector('span').textContent = 'Conta';
        }
    } else {
        userButton.onclick = () => toggleAuthModal(true);
        mobileUserLink.onclick = (e) => { e.preventDefault(); toggleAuthModal(true); };
        mobileUserLink.textContent = 'Login / Registar';
        if (mobileBottomUserLink) { // Update new mobile bottom nav link
            mobileBottomUserLink.onclick = (e) => { e.preventDefault(); toggleAuthModal(true); };
            mobileBottomUserLink.querySelector('span').textContent = 'Login';
        }
    }
}

async function toggleWishlist(productId) {
    if (!currentUserData) {
        showToast('Faça login para adicionar à lista de desejos.', true);
        toggleAuthModal(true);
        return;
    }
    const userRef = doc(db, "users", currentUserData.uid);
    const isInWishlist = currentUserData.wishlist.includes(productId);
    try {
        if (isInWishlist) {
            await updateDoc(userRef, { wishlist: arrayRemove(productId) });
            currentUserData.wishlist = currentUserData.wishlist.filter(id => id !== productId);
            showToast('Removido da lista de desejos.');
        } else {
            await updateDoc(userRef, { wishlist: arrayUnion(productId) });
            currentUserData.wishlist.push(productId);
            showToast('Adicionado à lista de desejos!');
        }
        // Re-render all visible products to update heart icons
        refreshAllProductViews();
    } catch (error) {
        console.error("Error updating wishlist:", error);
        showToast("Erro ao atualizar a lista de desejos.", true);
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }
    const results = allProducts.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));
    if (results.length > 0) {
        resultsContainer.innerHTML = results.map(product => `
            <a href="#" class="search-result-item flex items-center gap-4 p-2 hover:bg-gray-100 rounded-md" data-id="${product.id}">
                <img src="${product.image}" alt="${product.name}" class="w-12 h-16 object-cover rounded">
                <div>
                    <p class="font-semibold">${product.name}</p>
                    <p class="text-sm text-gray-600">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                </div>
            </a>
        `).join('');
    } else {
        resultsContainer.innerHTML = '<p class="text-gray-500 p-2">Nenhum resultado encontrado.</p>';
    }
}

// =================================================================
// MODAL & PAGE LOGIC
// =================================================================
function toggleCart(show) {
    const cartModalOverlay = document.getElementById('cart-modal-overlay');
    const cartModal = document.getElementById('cart-modal');
    if (show) {
        cartModalOverlay.classList.remove('hidden');
        cartModal.classList.remove('translate-x-full');
        renderCart();
    } else {
        cartModalOverlay.classList.add('hidden');
        cartModal.classList.add('translate-x-full');
    }
}

function showProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    // FIX: Using the correct ID for the content area
    const contentEl = document.getElementById('product-details-main-content');
    if (!contentEl) {
        console.error('Element with ID "product-details-main-content" not found!');
        return;
    }
    contentEl.innerHTML = `
        <div class="w-full md:w-1/2 p-8">
            <img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg shadow-lg">
        </div>
        <div class="w-full md:w-1/2 p-8 flex flex-col">
            <h2 class="font-heading text-4xl font-bold mb-2">${product.name}</h2>
            <div class="flex items-center gap-2 mb-4">
                ${renderStars(product.rating)}
                <span class="text-gray-500 text-sm">(${product.reviews ? product.reviews.length : 0} avaliações)</span>
            </div>
            <p class="text-gray-600 mb-6 text-lg leading-relaxed">${product.description}</p>
            <div class="mt-auto">
                <p class="text-gold-500 font-bold text-3xl mb-6">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn w-full bg-black text-white py-3 rounded-md hover:bg-gold-500 hover:text-black transition-all-ease" data-id="${product.id}">Adicionar ao Carrinho</button>
            </div>
        </div>
    `;
    feather.replace();
    toggleProductDetailsModal(true);
}

function toggleProductDetailsModal(show) {
    const overlay = document.getElementById('product-details-modal-overlay');
    const modal = document.getElementById('product-details-modal');
    if (show) {
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
    } else {
        overlay.classList.add('hidden');
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function toggleAuthModal(show) {
    const overlay = document.getElementById('auth-modal-overlay');
    const modal = document.getElementById('auth-modal');
    if (show) {
        renderAuthForm();
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
    } else {
        overlay.classList.add('hidden');
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

// NEW: Function to toggle mobile menu
function toggleMobileMenu(show) {
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    if (show) {
        mobileMenu.classList.remove('-translate-x-full');
        mobileMenuOverlay.classList.remove('hidden');
    } else {
        mobileMenu.classList.add('-translate-x-full');
        mobileMenuOverlay.classList.add('hidden');
    }
}


function handleContactFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const messageDiv = document.getElementById('contact-form-message');
    messageDiv.innerHTML = 'Obrigado pelo seu contato! Sua mensagem foi enviada com sucesso.';
    messageDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700');
    messageDiv.classList.add('bg-green-100', 'text-green-700');
    form.reset();
    setTimeout(() => messageDiv.classList.add('hidden'), 5000);
}

function handleNewsletterSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('newsletter-email');
    showToast(`Obrigado por se inscrever, ${emailInput.value}!`);
    emailInput.value = '';
}

// =================================================================
// PAGE INITIALIZATION & NAVIGATION
// =================================================================
const pages = document.querySelectorAll('.page-content');
const navLinks = document.querySelectorAll('.nav-link');
const mobileBottomNavLinks = document.querySelectorAll('#mobile-bottom-nav .mobile-bottom-nav-link');


function showPage(pageId, categoryFilter = null) { // Adicionado categoryFilter
    console.log("Attempting to show page:", pageId, "with filter:", categoryFilter); // Log para depuração
    pages.forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) { 
        targetPage.classList.remove('hidden'); 
        console.log("Page shown successfully:", pageId); // Log para depuração
    } else {
        console.warn("Page element not found for ID:", pageId); // Log para depuração
    }
    
    // Update top navigation active state
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById('nav-' + pageId);
    if(activeLink) { activeLink.classList.add('active'); }

    // Update mobile bottom navigation active state
    mobileBottomNavLinks.forEach(link => link.classList.remove('active'));
    const activeBottomLink = document.querySelector(`#mobile-bottom-nav a[data-page="${pageId}"]`);
    if (activeBottomLink) {
        activeBottomLink.classList.add('active');
    } else if (pageId === 'search') { // Special handling for search button
        document.getElementById('mobile-bottom-search-btn').classList.add('active');
    } else if (pageId === 'cart') { // Special handling for cart button
        document.getElementById('mobile-bottom-cart-btn').classList.add('active');
    }

    // Close mobile menu if open after navigation
    toggleMobileMenu(false);
    
    // Page-specific logic
    if (pageId === 'fragrancias') {
        // Se houver um filtro de categoria, aplique-o
        if (categoryFilter) {
            // Desmarcar todos os checkboxes de categoria primeiro
            document.querySelectorAll('#filter-cat-perfume, #filter-cat-decant').forEach(cb => cb.checked = false);
            // Marcar o checkbox correspondente ao filtro
            const filterCheckbox = document.querySelector(`#filter-cat-${categoryFilter}`);
            if (filterCheckbox) {
                filterCheckbox.checked = true;
            }
        }
        applyFilters(); // Reaplicar filtros para refletir a nova seleção
    } else if (pageId === 'decants') {
        const decantProducts = allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    } else if (pageId === 'profile') {
        if (!currentUserData) {
            showPage('inicio');
            toggleAuthModal(true);
            return;
        }
        const profileEmailEl = document.getElementById('profile-email');
        if (profileEmailEl) {
            profileEmailEl.textContent = `Bem-vindo(a), ${currentUserData.email}`;
        }
        renderWishlist();
        renderOrders();
    }
    // Lógica para as novas páginas do menu mobile
    else if (pageId === 'homespray' || pageId === 'difusores' || pageId === 'kits' || pageId === 'mais-vendidos' || pageId === 'descontos' || pageId === 'cupom') {
        // Para estas páginas, você pode adicionar lógica específica de renderização ou conteúdo
        // Por enquanto, apenas para demonstração, vamos mostrar um toast
        showToast(`Navegando para a página: ${pageId.replace('-', ' ').toUpperCase()}`);
        // Se você tiver um elemento div para cada uma dessas páginas (ex: <div id="page-homespray" class="page-content hidden">),
        // elas já serão mostradas pela lógica inicial de showPage.
        // Caso contrário, você precisará adicionar o HTML para essas páginas no index.html.
    }
    
    window.scrollTo(0, 0);
    AOS.refresh();
}

async function renderWishlist() {
    const wishlistContainer = document.getElementById('wishlist-items');
    if (!currentUserData || !wishlistContainer) return;

    const wishlistProducts = allProducts.filter(p => currentUserData.wishlist.includes(p.id));
    if (wishlistProducts.length === 0) {
        wishlistContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">A sua lista de desejos está vazia.</p>';
        return;
    }
    renderProducts(wishlistProducts, 'wishlist-items');
}

async function renderOrders() {
    const ordersListContainer = document.getElementById('orders-list');
    if (!currentUserData || !ordersListContainer) return;

    // ATENÇÃO: Para esta consulta funcionar, você precisará criar um índice no Firestore.
    // O Firestore exige um índice composto para consultas que usam where e orderBy.
    // Se a consulta falhar, o console do Firebase fornecerá um link para criar o índice necessário.
    const q = query(collection(db, "orders"), where("userId", "==", currentUserData.uid), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        ordersListContainer.innerHTML = '<p class="text-gray-500 text-center">Você ainda não fez nenhuma encomenda.</p>';
        return;
    }

    ordersListContainer.innerHTML = '';
    querySnapshot.forEach(doc => {
        const order = {id: doc.id, ...doc.data()};
        const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');
        const orderElement = document.createElement('div');
        orderElement.className = 'bg-gray-50 p-4 rounded-lg shadow-sm';
        orderElement.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-bold">Encomenda #${order.id.substring(0, 7)}</p>
                    <p class="text-sm text-gray-500">Data: ${orderDate}</p>
                </div>
                <div>
                    <p class="font-bold">Total: R$ ${order.total.toFixed(2).replace('.',',')}</p>
                    <p class="text-sm text-right font-semibold ${order.status === 'Pendente' ? 'text-yellow-500' : 'text-green-500'}">${order.status}</p>
                </div>
            </div>
        `;
        ordersListContainer.appendChild(orderElement);
    });
}

function refreshAllProductViews() {
    const currentPage = document.querySelector('.page-content:not(.hidden)');
    if (!currentPage) return;
    const pageId = currentPage.id.replace('page-', '');

    if (pageId === 'inicio') {
        renderProducts(allProducts.slice(0, 4), 'product-list-home');
    } else if (pageId === 'fragrancias') {
        applyFilters();
    } else if (pageId === 'decants') {
         const decantProducts = allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    } else if (pageId === 'profile') {
        renderWishlist();
    }
}

async function fetchInitialData() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const couponsSnapshot = await getDocs(collection(db, "coupons"));
        allCoupons = couponsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderProducts(allProducts.slice(0, 4), 'product-list-home');
        const navInicio = document.getElementById('nav-inicio');
        if (navInicio) {
            navInicio.classList.add('active');
        }
        
    } catch (error) {
        console.error("Error fetching initial data: ", error);
        showToast("Não foi possível carregar os dados do site.", true);
    }
}

function initializeEventListeners() {
    const safeAddEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        }
    };

    safeAddEventListener('logo-link', 'click', (e) => { e.preventDefault(); showPage('inicio'); });
    document.querySelectorAll('.nav-link, .nav-link-footer, .nav-link-button').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page) showPage(page);
        });
    });
    // NEW: Event listeners for mobile menu toggle
    safeAddEventListener('mobile-menu-button', 'click', () => toggleMobileMenu(true));
    safeAddEventListener('close-mobile-menu', 'click', () => toggleMobileMenu(false));
    safeAddEventListener('mobile-menu-overlay', 'click', () => toggleMobileMenu(false));

    // NEW: Event listeners for mobile nav items inside the sliding menu
    // Corrigido o seletor para '.mobile-nav-link'
    document.querySelectorAll('.mobile-nav-link').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            const categoryFilter = item.dataset.categoryFilter; // Obter o filtro de categoria
            if (page) showPage(page, categoryFilter); // Passar o filtro de categoria
            toggleMobileMenu(false); // Close menu after navigating
        });
    });


    safeAddEventListener('cart-button', 'click', () => toggleCart(true));
    safeAddEventListener('close-cart-button', 'click', () => toggleCart(false));
    safeAddEventListener('cart-modal-overlay', 'click', () => toggleCart(false));
    safeAddEventListener('checkout-button', 'click', handleCheckout);
    safeAddEventListener('calculate-shipping-btn', 'click', handleCalculateShipping);
    safeAddEventListener('close-product-details-modal', 'click', () => toggleProductDetailsModal(false));
    safeAddEventListener('product-details-modal-overlay', 'click', () => toggleProductDetailsModal(false));
    safeAddEventListener('coupon-form', 'submit', handleApplyCoupon);
    safeAddEventListener('close-auth-modal', 'click', () => toggleAuthModal(false));
    safeAddEventListener('auth-modal-overlay', 'click', () => toggleAuthModal(false));
    safeAddEventListener('logout-button', 'click', logout);
    safeAddEventListener('contact-form', 'submit', handleContactFormSubmit);
    safeAddEventListener('newsletter-form', 'submit', handleNewsletterSubmit);
    safeAddEventListener('search-button-mobile', 'click', () => document.getElementById('search-bar').classList.toggle('hidden'));
    safeAddEventListener('close-search-bar', 'click', () => {
        document.getElementById('search-bar').classList.add('hidden');
        document.getElementById('search-input').value = '';
        document.getElementById('search-results').innerHTML = '';
    });
    safeAddEventListener('search-input', 'keyup', handleSearch);
    safeAddEventListener('search-input-header', 'keyup', handleSearch); // Add listener for header search input
    safeAddEventListener('header-search-form', 'submit', (e) => e.preventDefault()); // Prevent form submission

    
    // New: Mobile Bottom Nav Listeners
    safeAddEventListener('mobile-bottom-search-btn', 'click', () => {
        document.getElementById('search-bar').classList.toggle('hidden');
        // You might want a dedicated search page or just toggle the bar
    });
    safeAddEventListener('mobile-bottom-cart-btn', 'click', () => toggleCart(true));
    document.querySelectorAll('#mobile-bottom-nav a[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });


    // Filter controls
    document.querySelectorAll('.filter-control').forEach(el => el.addEventListener('change', applyFilters));
    
    // Price range slider listeners
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');
    if (priceMinInput && priceMaxInput) {
        priceMinInput.addEventListener('input', applyFilters);
        priceMaxInput.addEventListener('input', applyFilters);
    }


    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('i');
            if (answer && icon) {
                if (answer.style.maxHeight) {
                    answer.style.maxHeight = null;
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    answer.style.maxHeight = answer.scrollHeight + "px";
                    icon.style.transform = 'rotate(180deg)';
                }
            }
        });
    });
    document.body.addEventListener('click', (e) => {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        const wishlistHeart = e.target.closest('.wishlist-heart');
        const productLink = e.target.closest('img[data-id], h3[data-id]');
        const quickViewBtn = e.target.closest('.quick-view-btn'); // New
        const searchResult = e.target.closest('.search-result-item');
        const cartQtyBtn = e.target.closest('.cart-qty-btn');
        const cartRemoveBtn = e.target.closest('.cart-remove-btn');

        if (addToCartBtn) { e.stopPropagation(); addToCart(addToCartBtn.dataset.id, 1, e); }
        else if (wishlistHeart) { e.stopPropagation(); toggleWishlist(wishlistHeart.dataset.id); }
        else if (productLink) { e.stopPropagation(); showProductDetails(productLink.dataset.id); }
        else if (quickViewBtn) { e.stopPropagation(); showProductDetails(quickViewBtn.dataset.id); } // Handle quick view
        else if (searchResult) { e.preventDefault(); showProductDetails(searchResult.dataset.id); document.getElementById('search-bar').classList.add('hidden'); document.getElementById('search-input').value = ''; document.getElementById('search-results').innerHTML = ''; }
        else if (cartQtyBtn) { updateQuantity(cartQtyBtn.dataset.id, parseInt(cartQtyBtn.dataset.qty)); }
        else if (cartRemoveBtn) { removeFromCart(cartRemoveBtn.dataset.id); }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleCart(false);
            toggleProductDetailsModal(false);
            toggleAuthModal(false);
            toggleMobileMenu(false); // Close mobile menu on escape
            hideConfirmationModal(); // Close confirmation modal on escape
        }
    });
}

// =================================================================
// MAIN APP LOGIC
// =================================================================
async function main() {
    try {
        showLoader(true);
        initializeEventListeners();
        
        // Initial UI setup that doesn't depend on data
        feather.replace();
        AOS.init({ duration: 800, once: true });
        updateCartIcon();

        // Fetch all site data first
        await Promise.all([fetchInitialData(), fetchAndRenderReels()]);

        // Now set up the auth listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    currentUserData = { uid: user.uid, ...userDoc.data() };
                    const firestoreCart = currentUserData.cart || [];
                    const localCart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
                    const mergedCart = [...firestoreCart];
                    localCart.forEach(localItem => {
                        const firestoreItem = mergedCart.find(fi => fi.id === localItem.id);
                        if (firestoreItem) { firestoreItem.quantity += localItem.quantity; }
                        else { mergedCart.push(localItem); }
                    });
                    cart = mergedCart;
                    localStorage.removeItem('sanseiCart');
                    await syncCartWithFirestore();
                } else {
                    const newUser = { email: user.email, wishlist: [], cart: cart };
                    await setDoc(userDocRef, newUser);
                    currentUserData = { uid: user.uid, ...newUser };
                    await syncCartWithFirestore();
                }
            } else {
                currentUserData = null;
                cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
            }
            updateAuthUI(user);
            updateCartIcon();
            refreshAllProductViews();
        });
    } catch (error) {
        console.error("Critical error during initialization:", error);
        showToast("Ocorreu um erro crítico ao carregar o site.", true);
    } finally {
        showLoader(false);
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', main);
