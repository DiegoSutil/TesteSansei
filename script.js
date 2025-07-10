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
let quizAnswers = {};


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
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
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
        
        cart = [];
        selectedShipping = null;
        localStorage.removeItem('sanseiCart');
        await syncCartWithFirestore();

        showToast("Encomenda realizada com sucesso!");
        updateCartIcon();
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
    if (!cepInput) return;
    const cep = cepInput.value.replace(/\D/g, '');
    const btn = document.getElementById('calculate-shipping-btn');
    if (!btn) return;
    const btnText = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader-sm');

    if (cep.length !== 8) {
        showToast("Por favor, insira um CEP válido.", true);
        return;
    }

    if (btnText) btnText.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
    btn.disabled = true;

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
        if (!response.ok) {
            throw new Error('CEP não encontrado ou API indisponível.');
        }
        
        const shippingOptions = [
            { Codigo: '04510', nome: 'PAC', PrazoEntrega: 10, Valor: '25,50' },
            { Codigo: '04014', nome: 'SEDEX', PrazoEntrega: 5, Valor: '45,80' }
        ];
        renderShippingOptions(shippingOptions);

    } catch (error) {
        console.error("Shipping calculation error:", error);
        showToast("Cálculo indisponível. Usando valores padrão.", true);
        
        const defaultShippingOptions = [
            { Codigo: '04510', nome: 'PAC (Estimado)', PrazoEntrega: 12, Valor: '28,00' },
            { Codigo: '04014', nome: 'SEDEX (Estimado)', PrazoEntrega: 7, Valor: '52,00' }
        ];
        renderShippingOptions(defaultShippingOptions);

    } finally {
        if (btnText) btnText.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
        btn.disabled = false;
    }
}

function renderShippingOptions(options) {
    const container = document.getElementById('shipping-options');
    if (!container) return;
    container.innerHTML = '';
    selectedShipping = null;
    renderCart();

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
    try {
        const userRef = doc(db, "users", currentUserData.uid);
        await updateDoc(userRef, { cart: cart });
    } catch (error) {
        console.error("Error syncing cart with Firestore:", error);
    }
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

    flyingImage.offsetHeight; 

    flyingImage.style.left = `${cartRect.left + cartRect.width / 2}px`;
    flyingImage.style.top = `${cartRect.top + cartRect.height / 2}px`;
    flyingImage.style.width = '20px';
    flyingImage.style.height = '20px';
    flyingImage.style.opacity = '0';

    setTimeout(() => {
        flyingImage.remove();
    }, 1000);
}


async function addToCart(productId, quantity = 1, event) {
    const button = event.target.closest('.add-to-cart-btn');
    if (!button) return;
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loader-sm"></span>';

    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error("Product not found:", productId);
        button.disabled = false;
        button.innerHTML = originalText;
        return;
    }
    
    const productImage = button.closest('.group')?.querySelector('img');
    if (productImage) {
        flyToCart(productImage);
    }

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
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('sanseiCart', JSON.stringify(cart));
    await syncCartWithFirestore();
    updateCartIcon();
    renderCart();
}

async function updateQuantity(productId, newQuantity) {
    const cartItem = cart.find(item => item.id === productId);
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
    if (cartCountEl) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountEl.textContent = totalItems;
    }
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartTotalEl = document.getElementById('cart-total');
    const discountInfoEl = document.getElementById('discount-info');
    const shippingCostLine = document.getElementById('shipping-cost-line');
    const shippingCostEl = document.getElementById('shipping-cost');
    
    if (!cartItemsEl || !cartSubtotalEl || !cartTotalEl || !discountInfoEl || !shippingCostLine || !shippingCostEl) {
        return;
    }
    
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center">Seu carrinho está vazio.</p>';
        cartSubtotalEl.textContent = 'R$ 0,00';
        cartTotalEl.textContent = 'R$ 0,00';
        shippingCostLine.classList.add('hidden');
        discountInfoEl.innerHTML = '';
        return;
    }
    
    let subtotal = calculateSubtotal();
    cartSubtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.',',')}`;

    if (appliedCoupon) {
        const discountAmount = subtotal * appliedCoupon.discount;
        subtotal -= discountAmount;
        discountInfoEl.innerHTML = `Cupom "${appliedCoupon.code}" aplicado! (-R$ ${discountAmount.toFixed(2).replace('.',',')}) <button id="remove-coupon-btn" class="text-red-500 ml-2 font-semibold">Remover</button>`;
        const removeBtn = document.getElementById('remove-coupon-btn');
        if (removeBtn) removeBtn.addEventListener('click', removeCoupon);
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
    if (!couponInput) return;
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
    if (!product) return '';
    const isInWishlist = currentUserData && currentUserData.wishlist && currentUserData.wishlist.includes(product.id);
    return `
        <div class="bg-white group text-center rounded-lg shadow-sm flex flex-col transition-all-ease hover:-translate-y-2 hover:shadow-xl" data-aos="fade-up">
            <div class="relative overflow-hidden rounded-t-lg">
                <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover group-hover:scale-105 transition-all-ease cursor-pointer" data-id="${product.id}">
                <button class="wishlist-heart absolute top-4 right-4 p-2 bg-white/70 rounded-full ${isInWishlist ? 'active' : ''}" data-id="${product.id}">
                    <i data-feather="heart" class="w-5 h-5"></i>
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
    
    if (!productsToRender || productsToRender.length === 0) {
        productListEl.innerHTML = `
            <div class="col-span-full text-center text-gray-600 py-10">
                <p class="text-xl mb-2">Nenhum produto encontrado.</p>
                <p>Tente ajustar os filtros ou veja nossa coleção completa.</p>
            </div>
        `;
    } else {
        productListEl.innerHTML = productsToRender.map(createProductCard).join('');
    }
    AOS.refresh();
    feather.replace();
}

function applyFilters() {
    let filteredProducts = [...allProducts];
    
    const categoryFilters = document.querySelectorAll('input[name="category"]:checked');
    if (categoryFilters.length > 0) {
        const selectedCategories = Array.from(categoryFilters).map(cb => cb.value);
        filteredProducts = filteredProducts.filter(p => selectedCategories.includes(p.category));
    }

    const priceFilterEl = document.querySelector('input[name="price"]:checked');
    if (priceFilterEl) {
        const priceFilter = priceFilterEl.value;
        if (priceFilter !== 'all') {
            if (priceFilter === '150') { filteredProducts = filteredProducts.filter(p => p.price <= 150); }
            else if (priceFilter === '500') { filteredProducts = filteredProducts.filter(p => p.price > 150 && p.price <= 500); }
            else if (priceFilter === '501') { filteredProducts = filteredProducts.filter(p => p.price > 500); }
        }
    }
    
    const sortByEl = document.getElementById('sort-by');
    if (sortByEl) {
        const sortBy = sortByEl.value;
        if (sortBy === 'price-asc') {
            filteredProducts.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-desc') {
            filteredProducts.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'popularity') {
            filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
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
        console.error("Error fetching reels:", error);
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
    document.getElementById('auth-form')?.addEventListener('submit', isLogin ? handleLogin : handleRegister);
    document.getElementById('auth-switch')?.addEventListener('click', (e) => {
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
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
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
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    const confirmPassword = document.getElementById('auth-confirm-password')?.value;
    
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
            cart: []
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
    cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
    updateAuthUI();
    updateCartIcon();
    showPage('inicio');
    showToast('Sessão terminada.');
}

function updateAuthUI(user) {
    const userButton = document.getElementById('user-button');
    const mobileUserLink = document.getElementById('mobile-user-link');

    if (!userButton || !mobileUserLink) {
        console.error("Auth UI elements not found. Could not update UI.");
        return;
    }

    if (user) {
        userButton.onclick = () => showPage('profile');
        mobileUserLink.dataset.page = 'profile';
        mobileUserLink.onclick = (e) => {
            e.preventDefault();
            showPage('profile');
            document.getElementById('mobile-menu')?.classList.add('hidden');
        };
        mobileUserLink.textContent = 'Minha Conta';
    } else {
        userButton.onclick = () => toggleAuthModal(true);
        delete mobileUserLink.dataset.page;
        mobileUserLink.onclick = (e) => {
            e.preventDefault();
            toggleAuthModal(true);
            document.getElementById('mobile-menu')?.classList.add('hidden');
        };
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
    if (!cartModalOverlay || !cartModal) return;
    if (show) {
        cartModalOverlay.classList.remove('hidden');
        cartModal.classList.remove('translate-x-full');
        renderCart();
    } else {
        cartModalOverlay.classList.add('hidden');
        cartModal.classList.add('translate-x-full');
    }
}

// FIX: Updated function to show reviews and review form
async function showProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const mainContentWrapper = document.getElementById('product-details-main-content');
    const extraContentWrapper = document.getElementById('product-details-extra-content');
    if (!mainContentWrapper || !extraContentWrapper) return;
    
    mainContentWrapper.innerHTML = `
      <div class="flex flex-col md:flex-row">
        <div class="w-full md:w-1/2 p-8">
            <img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg shadow-lg">
        </div>
        <div class="w-full md:w-1/2 p-8 flex flex-col">
            <h2 class="font-heading text-4xl font-bold mb-2">${product.name}</h2>
            <div class="flex items-center gap-2 mb-4">
                ${renderStars(product.rating)}
                <span class="text-gray-500 text-sm">(${(product.reviews || []).length} avaliações)</span>
            </div>
            <p class="text-gray-600 mb-6 text-lg leading-relaxed">${product.description}</p>
            <div class="mt-auto">
                <p class="text-gold-500 font-bold text-3xl mb-6">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn w-full bg-gold-500 text-black font-bold py-3 rounded-md hover:bg-gold-600 transition-all-ease" data-id="${product.id}">Adicionar ao Carrinho</button>
            </div>
        </div>
      </div>
    `;

    renderProductReviews(product, extraContentWrapper);
    
    feather.replace();
    toggleProductDetailsModal(true);
}

// NEW: Function to render reviews and the review form
function renderProductReviews(product, container) {
    container.innerHTML = ''; // Clear previous content

    // Section Title
    const reviewsTitle = document.createElement('h3');
    reviewsTitle.className = 'font-heading text-3xl font-bold mb-6 text-center';
    reviewsTitle.textContent = 'Avaliações de Clientes';
    container.appendChild(reviewsTitle);

    // Reviews List
    const reviewsList = document.createElement('div');
    reviewsList.className = 'space-y-6 mb-8';
    if (product.reviews && product.reviews.length > 0) {
        product.reviews.forEach(review => {
            const reviewEl = document.createElement('div');
            reviewEl.className = 'border-b border-gray-200 pb-4';
            reviewEl.innerHTML = `
                <div class="flex items-center mb-2">
                    ${renderStars(review.rating)}
                    <p class="ml-4 font-semibold">${review.userName || 'Anónimo'}</p>
                </div>
                <p class="text-gray-600">${review.text}</p>
            `;
            reviewsList.appendChild(reviewEl);
        });
    } else {
        reviewsList.innerHTML = '<p class="text-center text-gray-500">Este produto ainda não tem avaliações. Seja o primeiro a avaliar!</p>';
    }
    container.appendChild(reviewsList);

    // Review Form (only for logged-in users)
    if (currentUserData) {
        const formTitle = document.createElement('h3');
        formTitle.className = 'font-heading text-2xl font-bold mb-4 pt-6 border-t mt-8';
        formTitle.textContent = 'Deixe a sua avaliação';
        container.appendChild(formTitle);

        const reviewForm = document.createElement('form');
        reviewForm.id = 'review-form';
        reviewForm.innerHTML = `
            <div class="mb-4">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Sua nota:</label>
                <div class="flex items-center star-rating-input">
                    ${[1, 2, 3, 4, 5].map(i => `<i data-feather="star" class="w-6 h-6 cursor-pointer text-gray-400" data-value="${i}"></i>`).join('')}
                </div>
                <input type="hidden" id="review-rating" name="rating" value="0">
            </div>
            <div class="mb-4">
                <label for="review-text" class="block text-sm font-semibold text-gray-700 mb-2">Sua opinião:</label>
                <textarea id="review-text" name="text" required class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500" rows="4" placeholder="O que você achou do produto?"></textarea>
            </div>
            <button type="submit" class="bg-gold-500 text-black font-bold py-2 px-6 rounded-md hover:bg-gold-600 transition-all-ease">Enviar Avaliação</button>
        `;
        container.appendChild(reviewForm);
        
        // Add event listeners for star rating input
        const stars = reviewForm.querySelectorAll('.star-rating-input i');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const rating = star.dataset.value;
                reviewForm.querySelector('#review-rating').value = rating;
                stars.forEach(s => {
                    s.classList.toggle('filled', s.dataset.value <= rating);
                    s.classList.toggle('text-gray-400', s.dataset.value > rating);
                });
                feather.replace();
            });
        });

        reviewForm.addEventListener('submit', (e) => handleReviewSubmit(e, product.id));
    }
}

// NEW: Function to handle review submission
async function handleReviewSubmit(e, productId) {
    e.preventDefault();
    if (!currentUserData) {
        showToast("Você precisa estar logado para avaliar.", true);
        return;
    }

    const form = e.target;
    const rating = parseInt(form.querySelector('#review-rating').value, 10);
    const text = form.querySelector('#review-text').value;

    if (rating === 0) {
        showToast("Por favor, selecione uma nota (de 1 a 5 estrelas).", true);
        return;
    }
    if (!text.trim()) {
        showToast("Por favor, escreva sua opinião.", true);
        return;
    }

    showLoader(true);

    const productRef = doc(db, "products", productId);

    try {
        const newReview = {
            userId: currentUserData.uid,
            userName: currentUserData.email.split('@')[0], // Use part of email as name
            rating: rating,
            text: text,
            createdAt: Timestamp.now()
        };

        // Add the new review to the product's reviews array
        await updateDoc(productRef, {
            reviews: arrayUnion(newReview)
        });

        // Recalculate the average rating
        const productDoc = await getDoc(productRef);
        const updatedReviews = productDoc.data().reviews || [];
        const newAvgRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length;
        
        await updateDoc(productRef, {
            rating: newAvgRating
        });

        // Update local product data
        const productIndex = allProducts.findIndex(p => p.id === productId);
        if (productIndex > -1) {
            allProducts[productIndex].reviews.push(newReview);
            allProducts[productIndex].rating = newAvgRating;
        }

        showToast("Sua avaliação foi enviada com sucesso!");
        // Refresh the modal to show the new review
        showProductDetails(productId);

    } catch (error) {
        console.error("Error submitting review:", error);
        showToast("Ocorreu um erro ao enviar sua avaliação.", true);
    } finally {
        showLoader(false);
    }
}


function toggleProductDetailsModal(show) {
    const overlay = document.getElementById('product-details-modal-overlay');
    const modal = document.getElementById('product-details-modal');
    if (!overlay || !modal) return;
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
    if (!overlay || !modal) return;
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
    if (messageDiv) {
        messageDiv.innerHTML = 'Obrigado pelo seu contato! Sua mensagem foi enviada com sucesso.';
        messageDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700');
        messageDiv.classList.add('bg-green-100', 'text-green-700');
        setTimeout(() => messageDiv.classList.add('hidden'), 5000);
    }
    if (form) form.reset();
}

function handleNewsletterSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('newsletter-email');
    if (emailInput) {
        showToast(`Obrigado por se inscrever, ${emailInput.value}!`);
        emailInput.value = '';
    }
}

// =================================================================
// PAGE INITIALIZATION & NAVIGATION
// =================================================================
const pages = document.querySelectorAll('.page-content');

function showPage(pageId) {
    if (!pageId) return;

    pages.forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById('page-' + pageId);
    
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        console.warn(`Page with id 'page-${pageId}' not found. Defaulting to home.`);
        const homePage = document.getElementById('page-inicio');
        if (homePage) homePage.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageId) {
            link.classList.add('active');
        }
    });
    
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
    }

    // FIX: Add page-specific logic for the quiz
    if (pageId === 'quiz') {
        startQuiz();
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
    
    window.scrollTo(0, 0);
    AOS.refresh();
}

async function renderWishlist() {
    const wishlistContainer = document.getElementById('wishlist-items');
    if (!currentUserData || !wishlistContainer) return;

    const wishlistProducts = allProducts.filter(p => currentUserData.wishlist.includes(p.id));
    renderProducts(wishlistProducts, 'wishlist-items');
}

async function renderOrders() {
    const ordersListContainer = document.getElementById('orders-list');
    if (!currentUserData || !ordersListContainer) return;

    try {
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
    } catch (error) {
        console.error("Error fetching orders:", error);
        ordersListContainer.innerHTML = '<p class="text-red-500 text-center">Não foi possível carregar as suas encomendas.</p>';
    }
}

function refreshAllProductViews() {
    const currentPage = document.querySelector('.page-content:not(.hidden)');
    if (!currentPage) return;
    const pageId = currentPage.id.replace('page-', '');

    const containerId = `product-list-${pageId}`;
    const container = document.getElementById(containerId);

    if (container) {
        const currentProductIds = Array.from(container.querySelectorAll('[data-id]')).map(el => el.dataset.id);
        const uniqueIds = [...new Set(currentProductIds)];
        const currentProducts = uniqueIds.map(id => allProducts.find(p => p.id === id)).filter(Boolean);
        renderProducts(currentProducts, containerId);
    } else if (pageId === 'profile') {
        renderWishlist();
    } else if (pageId === 'inicio') {
        renderProducts(allProducts.slice(0, 4), 'product-list-home');
    }
}

async function fetchInitialData() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const couponsSnapshot = await getDocs(collection(db, "coupons"));
        allCoupons = couponsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderProducts(allProducts.slice(0, 4), 'product-list-home');
        
        const initialLink = document.querySelector('.nav-link[data-page="inicio"]');
        if (initialLink) {
            initialLink.classList.add('active');
        }
        
    } catch (error) {
        console.error("Error fetching initial data: ", error);
        showToast("Não foi possível carregar os dados do site.", true);
    }
}

function generateMobileMenu() {
    const desktopNavContainer = document.getElementById('desktop-nav-links');
    const mobileMenuContainer = document.getElementById('mobile-menu');

    if (!desktopNavContainer || !mobileMenuContainer) return;

    mobileMenuContainer.innerHTML = '';

    const desktopLinksClone = desktopNavContainer.cloneNode(true);
    mobileMenuContainer.innerHTML = desktopLinksClone.innerHTML;

    const mobileUserLink = document.createElement('a');
    mobileUserLink.href = '#';
    mobileUserLink.id = 'mobile-user-link';
    mobileUserLink.className = 'nav-link mobile-nav-link text-gray-600 hover:text-gold-500 transition-all-ease font-semibold block py-2';
    mobileMenuContainer.appendChild(mobileUserLink);

    mobileMenuContainer.querySelectorAll('.nav-link').forEach(link => {
        link.classList.add('block', 'py-2');
    });
    
    mobileMenuContainer.querySelectorAll('.dropdown').forEach(dropdown => {
        const mainLink = dropdown.querySelector('a');
        const dropdownMenu = dropdown.querySelector('.dropdown-menu');
        
        if (mainLink && dropdownMenu) {
            dropdownMenu.classList.remove('absolute', 'hidden', 'shadow-lg', 'rounded-md', 'mt-2', 'py-2', 'w-48');
            dropdownMenu.classList.add('pl-4', 'space-y-2');
            mainLink.addEventListener('click', (e) => e.preventDefault());
        }
    });
}

// =================================================================
// QUIZ LOGIC
// =================================================================
const quizData = [
    {
        id: 'family',
        question: "Qual família olfativa mais lhe agrada?",
        options: [
            { text: "Cítrico & Fresco", value: "citrus" },
            { text: "Floral & Delicado", value: "floral" },
            { text: "Amadeirado & Intenso", value: "woody" },
            { text: "Oriental & Adocicado", value: "oriental" },
        ],
    },
    {
        id: 'occasion',
        question: "Para qual ocasião você usaria o perfume?",
        options: [
            { text: "Dia a dia, trabalho", value: "daily" },
            { text: "Eventos noturnos, festas", value: "night" },
            { text: "Encontros românticos", value: "romantic" },
            { text: "Momentos de lazer", value: "leisure" },
        ],
    },
];

function startQuiz() {
    quizAnswers = {};
    renderQuestion(0);
}

function renderQuestion(index) {
    const quizContainer = document.getElementById('quiz-container');
    if (!quizContainer) return;

    if (index >= quizData.length) {
        showQuizResults();
        return;
    }

    const currentQuestion = quizData[index];
    quizContainer.innerHTML = `
        <div class="bg-white p-8 rounded-lg shadow-lg text-center" data-aos="fade-up">
            <p class="text-lg text-gray-500 mb-2">Pergunta ${index + 1} de ${quizData.length}</p>
            <h2 class="font-heading text-3xl font-bold mb-8">${currentQuestion.question}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${currentQuestion.options.map(opt => `
                    <button class="quiz-option-btn bg-gray-100 hover:bg-gold-500 hover:text-black transition-all-ease p-6 rounded-lg font-semibold text-lg" data-question-id="${currentQuestion.id}" data-value="${opt.value}">
                        ${opt.text}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    quizContainer.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            quizAnswers[btn.dataset.questionId] = btn.dataset.value;
            renderQuestion(index + 1);
        });
    });
}

function showQuizResults() {
    const quizContainer = document.getElementById('quiz-container');
    if (!quizContainer) return;

    // Simple recommendation logic (can be improved)
    // This is a placeholder. A real implementation would have tags on products.
    let recommendedProducts = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, 4);

    quizContainer.innerHTML = `
        <div class="text-center" data-aos="fade-up">
            <h2 class="font-heading text-4xl font-bold text-black mb-4">Suas Recomendações!</h2>
            <p class="text-gray-600 mb-12 max-w-2xl mx-auto">Com base nas suas respostas, aqui estão algumas fragrâncias que você pode amar.</p>
            <div id="quiz-results-products" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                ${recommendedProducts.map(createProductCard).join('')}
            </div>
            <button id="restart-quiz-btn" class="mt-12 bg-black text-white font-bold py-3 px-10 rounded-full hover:bg-gray-800 transition-all-ease">Refazer o Quiz</button>
        </div>
    `;
    feather.replace();
    AOS.refresh();

    document.getElementById('restart-quiz-btn').addEventListener('click', startQuiz);
}

function initializeEventListeners() {
    const safeAddEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        }
    };

    document.querySelectorAll('.nav-link, .mobile-nav-link, .nav-link-footer, .nav-link-button').forEach(link => {
        if (link.dataset.page) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showPage(link.dataset.page);
            });
        }
    });

    safeAddEventListener('cart-button', 'click', () => toggleCart(true));
    safeAddEventListener('close-cart-button', 'click', () => toggleCart(false));
    safeAddEventListener('cart-modal-overlay', 'click', () => toggleCart(false));
    safeAddEventListener('checkout-button', 'click', handleCheckout);
    safeAddEventListener('calculate-shipping-btn', 'click', handleCalculateShipping);
    safeAddEventListener('close-product-details-modal', 'click', () => toggleProductDetailsModal(false));
    safeAddEventListener('product-details-modal-overlay', 'click', () => toggleProductDetailsModal(false));
    safeAddEventListener('mobile-menu-button', 'click', () => { document.getElementById('mobile-menu')?.classList.toggle('hidden'); });
    safeAddEventListener('coupon-form', 'submit', handleApplyCoupon);
    safeAddEventListener('close-auth-modal', 'click', () => toggleAuthModal(false));
    safeAddEventListener('auth-modal-overlay', 'click', () => toggleAuthModal(false));
    safeAddEventListener('logout-button', 'click', logout);
    safeAddEventListener('contact-form', 'submit', handleContactFormSubmit);
    safeAddEventListener('newsletter-form', 'submit', handleNewsletterSubmit);
    safeAddEventListener('search-button', 'click', () => { document.getElementById('search-bar')?.classList.toggle('hidden'); });
    safeAddEventListener('close-search-bar', 'click', () => {
        const searchBar = document.getElementById('search-bar');
        if (searchBar) {
            searchBar.classList.add('hidden');
            document.getElementById('search-input').value = '';
            document.getElementById('search-results').innerHTML = '';
        }
    });
    safeAddEventListener('search-input', 'keyup', handleSearch);
    
    document.querySelectorAll('.filter-control').forEach(el => el.addEventListener('change', applyFilters));
    
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
        const searchResult = e.target.closest('.search-result-item');
        const cartQtyBtn = e.target.closest('.cart-qty-btn');
        const cartRemoveBtn = e.target.closest('.cart-remove-btn');

        if (addToCartBtn) { e.stopPropagation(); addToCart(addToCartBtn.dataset.id, 1, e); }
        else if (wishlistHeart) { e.stopPropagation(); toggleWishlist(wishlistHeart.dataset.id); }
        else if (productLink) { e.stopPropagation(); showProductDetails(productLink.dataset.id); }
        else if (searchResult) { e.preventDefault(); showProductDetails(searchResult.dataset.id); document.getElementById('search-bar')?.classList.add('hidden'); document.getElementById('search-input').value = ''; document.getElementById('search-results').innerHTML = ''; }
        else if (cartQtyBtn) { updateQuantity(cartQtyBtn.dataset.id, parseInt(cartQtyBtn.dataset.qty)); }
        else if (cartRemoveBtn) { removeFromCart(cartRemoveBtn.dataset.id); }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleCart(false);
            toggleProductDetailsModal(false);
            toggleAuthModal(false);
        }
    });
}

// =================================================================
// MAIN APP LOGIC
// =================================================================
async function main() {
    try {
        showLoader(true);
        
        generateMobileMenu();
        initializeEventListeners();
        
        feather.replace();
        AOS.init({ duration: 800, once: true });
        updateCartIcon();

        await Promise.all([fetchInitialData(), fetchAndRenderReels()]);

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
                        if (firestoreItem) { 
                            firestoreItem.quantity = (firestoreItem.quantity || 0) + localItem.quantity; 
                        } else { 
                            mergedCart.push(localItem); 
                        }
                    });
                    cart = mergedCart.filter(item => item.id && item.quantity > 0);
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

document.addEventListener('DOMContentLoaded', main);
