// Import Firebase modules from the latest SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =================================================================
// FIREBASE CONFIGURATION
// =================================================================
// ATENÇÃO: É uma má prática de segurança expor suas chaves de API diretamente no código.
// Em um projeto real, use variáveis de ambiente para proteger essas informações.
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
let cart = [];
let appliedCoupon = null;
let currentUserData = null;
let allCoupons = [];
let selectedShipping = null;
let isInitializing = true; // Flag to control initial loading state

// =================================================================
// UTILITY FUNCTIONS
// =================================================================
function showToast(message, isError = false) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    const iconContainer = document.getElementById('toast-icon-container');
    if (!toast || !toastMessage || !iconContainer) return;

    const iconName = isError ? 'x-circle' : 'check-circle';
    const iconColorClass = isError ? 'text-red-400' : 'text-green-400';

    iconContainer.innerHTML = `<i data-feather="${iconName}" class="${iconColorClass}"></i>`;
    toastMessage.textContent = message;
    
    feather.replace();
    
    toast.classList.remove('opacity-0', 'translate-y-10');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

const showLoader = (show) => {
    document.getElementById('loader').classList.toggle('hidden', !show);
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
            name: product ? product.name : 'Produto não encontrado',
            quantity: item.quantity,
            price: product ? product.price : 0
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
        
        cart = [];
        selectedShipping = null;
        appliedCoupon = null;
        await syncCartWithFirestore();

        showToast("Encomenda realizada com sucesso!");
        updateCartUI();
        toggleCart(false);
        showPage('profile');
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
    const cep = cepInput.value.replace(/\D/g, '');
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

    const body = {
        from: { postal_code: "84261090" }, // Substitua pelo seu CEP de origem
        to: { postal_code: cep },
        services: ["PAC", "SEDEX"],
        package: {
            weight: 0.5,
            width: 15,
            height: 10,
            length: 20,
        },
        products: cart.map(item => {
            const product = allProducts.find(p => p.id === item.id);
            return {
                id: item.id,
                quantity: item.quantity,
                price: product ? product.price : 0
            }
        })
    };

    try {
        const response = await fetch(`https://brasilapi.com.br/api/shipping/v1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao calcular o frete.');
        }

        const data = await response.json();
        renderShippingOptions(data.services);

    } catch (error) {
        console.error("Shipping calculation error:", error);
        showToast(error.message || "Não foi possível calcular o frete para este CEP.", true);
        document.getElementById('shipping-options').innerHTML = '';
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
    renderCart();

    if (!options || options.length === 0 || options.every(opt => opt.error)) {
        container.innerHTML = `<p class="text-red-500 text-sm">Nenhuma opção de frete encontrada para o CEP informado.</p>`;
        return;
    }

    options.forEach(option => {
        if (option.error) return;

        const optionId = `shipping-${option.name.replace(/\s+/g, '-')}`;
        const label = document.createElement('label');
        label.className = 'flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-gray-50';
        label.innerHTML = `
            <div class="flex items-center">
                <input type="radio" name="shipping-option" id="${optionId}" class="form-radio text-gold-500">
                <div class="ml-3">
                    <p class="font-semibold">${option.name}</p>
                    <p class="text-sm text-gray-500">Prazo: ${option.delivery_time} dias úteis</p>
                </div>
            </div>
            <span class="font-bold">R$ ${option.price.toFixed(2).replace('.', ',')}</span>
        `;
        
        label.querySelector('input').addEventListener('change', () => {
            selectedShipping = {
                method: option.name,
                price: option.price,
                deadline: option.delivery_time
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
    try {
        await updateDoc(userRef, { cart: cart });
    } catch (error) {
        console.error("Failed to sync cart with Firestore:", error);
    }
}

async function addToCart(productId, quantity = 1) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += quantity;
    } else {
        cart.push({ id: productId, quantity: quantity });
    }
    
    if (currentUserData) {
        await syncCartWithFirestore();
    } else {
        localStorage.setItem('sanseiCart', JSON.stringify(cart));
    }
    
    updateCartUI();
    showToast(`${product.name} foi adicionado ao carrinho!`);
}

async function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    if (currentUserData) {
        await syncCartWithFirestore();
    } else {
        localStorage.setItem('sanseiCart', JSON.stringify(cart));
    }
    updateCartUI();
}

async function updateQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
        await removeFromCart(productId);
    } else {
        const cartItem = cart.find(item => item.id === productId);
        if (cartItem) {
            cartItem.quantity = newQuantity;
            if (currentUserData) {
                await syncCartWithFirestore();
            } else {
                localStorage.setItem('sanseiCart', JSON.stringify(cart));
            }
            updateCartUI();
        }
    }
}

function updateCartUI() {
    updateCartIcon();
    if (!document.getElementById('cart-modal').classList.contains('translate-x-full')) {
        renderCart();
    }
}

function updateCartIcon() {
    const cartCountEl = document.getElementById('cart-count');
    if (!cartCountEl) return;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountEl.textContent = totalItems;
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartTotalEl = document.getElementById('cart-total');
    const discountInfoEl = document.getElementById('discount-info');
    const shippingCostLine = document.getElementById('shipping-cost-line');
    const shippingCostEl = document.getElementById('shipping-cost');
    
    if (!cartItemsEl) return;
    
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center">Seu carrinho está vazio.</p>';
        cartSubtotalEl.textContent = 'R$ 0,00';
        cartTotalEl.textContent = 'R$ 0,00';
        shippingCostLine.classList.add('hidden');
        discountInfoEl.innerHTML = '';
        document.getElementById('shipping-calculator').classList.add('hidden');
        return;
    }
    
    document.getElementById('shipping-calculator').classList.remove('hidden');
    let subtotal = calculateSubtotal();
    cartSubtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.',',')}`;

    if (appliedCoupon) {
        const discountAmount = subtotal * appliedCoupon.discount;
        discountInfoEl.innerHTML = `Cupom "${appliedCoupon.code}" aplicado! (-R$ ${discountAmount.toFixed(2).replace('.',',')}) <button id="remove-coupon-btn" class="text-red-500 ml-2 font-semibold">Remover</button>`;
        document.getElementById('remove-coupon-btn').addEventListener('click', removeCoupon);
    } else {
        discountInfoEl.innerHTML = '';
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
        if (!product) return '';
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

function createProductCard(product) {
    const isInWishlist = currentUserData && currentUserData.wishlist && currentUserData.wishlist.includes(product.id);
    return `
        <div class="bg-white group text-center rounded-lg shadow-sm flex flex-col transition-all-ease hover:-translate-y-2 hover:shadow-xl" data-aos="fade-up">
            <div class="relative overflow-hidden rounded-t-lg">
                <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover group-hover:scale-105 transition-all-ease cursor-pointer product-details-trigger" data-id="${product.id}">
                <button class="wishlist-heart absolute top-4 right-4 p-2 bg-white/70 rounded-full ${isInWishlist ? 'active' : ''}" data-id="${product.id}">
                    <i data-feather="heart" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <h3 class="font-heading font-semibold text-xl cursor-pointer product-details-trigger" data-id="${product.id}">${product.name}</h3>
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
        productListEl.innerHTML = '<p class="text-gray-600 col-span-full text-center">Nenhum produto encontrado.</p>';
    } else {
        productListEl.innerHTML = productsToRender.map(createProductCard).join('');
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

    const priceFilter = document.querySelector('input[name="price"]:checked').value;
    if (priceFilter !== 'all') {
        if (priceFilter === '150') { filteredProducts = filteredProducts.filter(p => p.price <= 150); }
        else if (priceFilter === '500') { filteredProducts = filteredProducts.filter(p => p.price > 150 && p.price <= 500); }
        else if (priceFilter === '501') { filteredProducts = filteredProducts.filter(p => p.price > 500); }
    }
    
    const sortBy = document.getElementById('sort-by').value;
    if (sortBy === 'price-asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'popularity') {
        filteredProducts.sort((a, b) => b.rating - a.rating);
    }

    renderProducts(filteredProducts, 'product-list-fragrances');
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
        reelsContainer.innerHTML = '';
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
            <button type="submit" class="w-full bg-gold-500 text-black font-bold py-3 rounded-md hover:bg-gold-600 transition-all-ease">${isLogin ? 'Entrar' : 'Registar'}</button>
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
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
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
        await createUserWithEmailAndPassword(auth, email, password);
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
    showToast('Sessão terminada.');
    showPage('inicio');
}

function updateAuthUI(user) {
    const userButton = document.getElementById('user-button');
    const mobileUserLink = document.getElementById('mobile-user-link');
    if (!userButton || !mobileUserLink) return;

    if (user) {
        userButton.onclick = () => showPage('profile');
        mobileUserLink.onclick = (e) => { e.preventDefault(); showPage('profile'); };
        mobileUserLink.textContent = 'Minha Conta';
    } else {
        userButton.onclick = () => toggleAuthModal(true);
        mobileUserLink.onclick = (e) => { e.preventDefault(); toggleAuthModal(true); };
        mobileUserLink.textContent = 'Login / Registar';
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
        refreshAllProductViews();
    } catch (error) {
        console.error("Error updating wishlist:", error);
        showToast("Erro ao atualizar a lista de desejos.", true);
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    if (query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }
    const results = allProducts.filter(p => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
    if (results.length > 0) {
        resultsContainer.innerHTML = results.slice(0, 5).map(product => `
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
        renderCart();
        cartModalOverlay.classList.remove('hidden');
        cartModal.classList.remove('translate-x-full');
    } else {
        cartModalOverlay.classList.add('hidden');
        cartModal.classList.add('translate-x-full');
    }
}

function showProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const contentEl = document.getElementById('product-details-content');
    contentEl.innerHTML = `
        <div class="w-full md:w-1/2 p-8">
            <img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg shadow-lg">
        </div>
        <div class="w-full md:w-1/2 p-8 flex flex-col">
            <h2 class="font-heading text-4xl font-bold mb-2">${product.name}</h2>
            <div class="flex items-center gap-2 mb-4">
                ${renderStars(product.rating)}
                <span class="text-gray-500 text-sm">(${(product.reviews ? product.reviews.length : 0)} avaliações)</span>
            </div>
            <p class="text-gray-600 mb-6 text-lg leading-relaxed">${product.description || ''}</p>
            <div class="mt-auto">
                <p class="text-gold-500 font-bold text-3xl mb-6">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn w-full bg-gold-500 text-black font-bold py-3 rounded-md hover:bg-gold-600 transition-all-ease" data-id="${product.id}">Adicionar ao Carrinho</button>
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
function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) { targetPage.classList.remove('hidden'); }
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    if(activeLink) { activeLink.classList.add('active'); }
    
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileMenu.classList.contains('hidden')) { mobileMenu.classList.add('hidden'); }
    
    if (pageId === 'fragrancias') {
        applyFilters();
    } else if (pageId === 'decants') {
        const decantProducts = allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    } else if (pageId === 'profile') {
        if (!currentUserData) {
            showPage('inicio');
            toggleAuthModal(true);
            return;
        }
        document.getElementById('profile-email').textContent = `Bem-vindo(a), ${currentUserData.email}`;
        renderWishlist();
        renderOrders();
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

    const q = query(collection(db, "orders"), where("userId", "==", currentUserData.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        ordersListContainer.innerHTML = '<p class="text-gray-500 text-center">Você ainda não fez nenhuma encomenda.</p>';
        return;
    }

    ordersListContainer.innerHTML = '';
    const orders = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    orders.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    orders.forEach(order => {
        const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');
        const orderElement = document.createElement('div');
        orderElement.className = 'bg-gray-50 p-4 rounded-lg shadow-sm mb-4';
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

// =================================================================
// EVENT LISTENERS SETUP
// =================================================================
function setupEventListeners() {
    document.body.addEventListener('click', (e) => {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        const wishlistHeart = e.target.closest('.wishlist-heart');
        const productLink = e.target.closest('.product-details-trigger');
        const searchResult = e.target.closest('.search-result-item');
        const cartQtyBtn = e.target.closest('.cart-qty-btn');
        const cartRemoveBtn = e.target.closest('.cart-remove-btn');

        if (addToCartBtn) { e.preventDefault(); addToCart(addToCartBtn.dataset.id); }
        else if (wishlistHeart) { e.preventDefault(); toggleWishlist(wishlistHeart.dataset.id); }
        else if (productLink) { e.preventDefault(); showProductDetails(productLink.dataset.id); }
        else if (searchResult) { 
            e.preventDefault(); 
            showProductDetails(searchResult.dataset.id); 
            document.getElementById('search-bar').classList.add('hidden'); 
            document.getElementById('search-input').value = ''; 
            document.getElementById('search-results').innerHTML = ''; 
        }
        else if (cartQtyBtn) { updateQuantity(cartQtyBtn.dataset.id, parseInt(cartQtyBtn.dataset.qty)); }
        else if (cartRemoveBtn) { removeFromCart(cartRemoveBtn.dataset.id); }
    });

    document.querySelectorAll('.nav-link, .mobile-nav-link, .nav-link-footer, .nav-link-button, #logo-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page || 'inicio';
            showPage(page);
        });
    });
    
    document.getElementById('cart-button').addEventListener('click', () => toggleCart(true));
    document.getElementById('close-cart-button').addEventListener('click', () => toggleCart(false));
    document.getElementById('cart-modal-overlay').addEventListener('click', () => toggleCart(false));
    document.getElementById('checkout-button').addEventListener('click', handleCheckout);
    document.getElementById('calculate-shipping-btn').addEventListener('click', handleCalculateShipping);
    document.getElementById('close-product-details-modal').addEventListener('click', () => toggleProductDetailsModal(false));
    document.getElementById('product-details-modal-overlay').addEventListener('click', () => toggleProductDetailsModal(false));
    document.getElementById('mobile-menu-button').addEventListener('click', () => { document.getElementById('mobile-menu').classList.toggle('hidden'); });
    document.getElementById('coupon-form').addEventListener('submit', handleApplyCoupon);
    document.getElementById('close-auth-modal').addEventListener('click', () => toggleAuthModal(false));
    document.getElementById('auth-modal-overlay').addEventListener('click', () => toggleAuthModal(false));
    document.getElementById('logout-button').addEventListener('click', logout);
    document.getElementById('contact-form').addEventListener('submit', handleContactFormSubmit);
    document.getElementById('newsletter-form').addEventListener('submit', handleNewsletterSubmit);
    document.getElementById('search-button').addEventListener('click', () => document.getElementById('search-bar').classList.toggle('hidden'));
    document.getElementById('close-search-bar').addEventListener('click', () => {
        document.getElementById('search-bar').classList.add('hidden');
        document.getElementById('search-input').value = '';
        document.getElementById('search-results').innerHTML = '';
    });
    document.getElementById('search-input').addEventListener('keyup', handleSearch);
    document.querySelectorAll('.filter-control').forEach(el => el.addEventListener('change', applyFilters));
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('i');
            const isOpening = !answer.style.maxHeight;
            answer.style.maxHeight = isOpening ? answer.scrollHeight + "px" : null;
            icon.style.transform = isOpening ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    });
}

// =================================================================
// MAIN APP INITIALIZATION
// =================================================================
async function handleAuthentication() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
                        if (firestoreItem) {
                            firestoreItem.quantity = (firestoreItem.quantity || 0) + localItem.quantity;
                        } else {
                            mergedCart.push(localItem);
                        }
                    });
                    cart = mergedCart;
                } else {
                    cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
                    const newUser = { email: user.email, wishlist: [], cart: cart };
                    await setDoc(userDocRef, newUser);
                    currentUserData = { uid: user.uid, ...newUser };
                }
            } else {
                currentUserData = null;
                cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
            }
            
            localStorage.removeItem('sanseiCart');
            updateAuthUI(user);
            updateCartUI();
            
            if (!isInitializing) {
                refreshAllProductViews();
            }
            
            unsubscribe(); // Unsubscribe to prevent multiple triggers
            resolve();
        });
    });
}


async function main() {
    showLoader(true);
    setupEventListeners();
    AOS.init({ duration: 800, once: true });

    try {
        const productsPromise = getDocs(collection(db, "products"));
        const couponsPromise = getDocs(collection(db, "coupons"));
        const reelsPromise = fetchAndRenderReels();

        const [productsData, couponsData] = await Promise.all([productsPromise, couponsPromise, reelsPromise]);

        allProducts = productsData.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCoupons = couponsData.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        await handleAuthentication();

        showPage('inicio');
        renderProducts(allProducts.slice(0, 4), 'product-list-home');
        document.getElementById('nav-inicio').classList.add('active');

    } catch (error) {
        console.error("Critical error during initialization:", error);
        showToast("Ocorreu um erro crítico ao carregar o site.", true);
    } finally {
        isInitializing = false;
        showLoader(false);
        feather.replace();
    }
}

document.addEventListener('DOMContentLoaded', main);
" of the Canvas. Please provide a response based on my query below.
o site esta em portugues mas o script esta em ingles, pode arrum
