import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Use the same Firebase config as the e-commerce site
const firebaseConfig = {
  apiKey: "AIzaSyC4-kp4wBq6fz-pG1Rm3VQcq6pO17OEeOI",
  authDomain: "sansei-d3cf6.firebaseapp.com",
  projectId: "sansei-d3cf6",
  storageBucket: "sansei-d3cf6.appspot.com",
  messagingSenderId: "774111823223",
  appId: "1:774111823223:web:c03c73c4b89d96244b8d72"
};

// =================================================================
// INITIALIZATION
// =================================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// IMPORTANT: List of authorized admin emails
const ADMIN_EMAILS = ["admin@sansei.com", "diego.sutil@gmail.com"];

// =================================================================
// DOM ELEMENTS
// =================================================================
const DOMElements = {
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
    adminEmail: document.getElementById('admin-email'),
    productIdField: document.getElementById('product-id'),
    submitProductBtn: document.getElementById('submit-product-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
};

// =================================================================
// UTILITY & UI FUNCTIONS
// =================================================================

/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, displays an error-styled toast.
 */
function showToast(message, isError = false) {
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
 * Shows a message on the authentication screen.
 * @param {string} message - The message to display.
 * @param {'green' | 'red'} color - The color theme for the message.
 */
function showAuthMessage(message, color) {
    DOMElements.authMessage.textContent = message;
    DOMElements.authMessage.className = `mb-4 p-3 rounded-md text-center bg-${color}-100 text-${color}-700`;
}

/**
 * Switches the active view in the admin panel.
 * @param {string} viewToShow - The data-view attribute of the view to show.
 */
function switchView(viewToShow) {
    DOMElements.views.forEach(view => view.classList.add('hidden'));
    document.getElementById(`view-${viewToShow}`).classList.remove('hidden');

    DOMElements.navLinks.forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === viewToShow);
    });
}

// =================================================================
// DATA FETCHING & RENDERING
// =================================================================

async function fetchStats() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const usersSnapshot = await getDocs(collection(db, "users"));
        const couponsSnapshot = await getDocs(collection(db, "coupons"));
        
        document.getElementById('stats-products').textContent = productsSnapshot.size;
        document.getElementById('stats-users').textContent = usersSnapshot.size;
        document.getElementById('stats-coupons').textContent = couponsSnapshot.size;
    } catch (e) {
        console.error("Error fetching stats:", e);
        showToast("Erro ao carregar estatísticas.", true);
    }
}

async function fetchAndRenderProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        DOMElements.productListBody.innerHTML = ''; // Clear list
        querySnapshot.forEach((doc) => {
            const product = { id: doc.id, ...doc.data() };
            const row = document.createElement('tr');
            row.className = 'border-b';
            row.innerHTML = `
                <td class="py-3 px-2">${product.name}</td>
                <td class="py-3 px-2 capitalize">${product.category}</td>
                <td class="py-3 px-2">R$ ${product.price.toFixed(2)}</td>
                <td class="py-3 px-2">${product.stock}</td>
                <td class="py-3 px-2 flex gap-2">
                    <button class="edit-btn text-blue-500 hover:text-blue-700" data-id="${product.id}"><i data-feather="edit-2" class="w-5 h-5"></i></button>
                    <button class="delete-btn text-red-500 hover:text-red-700" data-id="${product.id}"><i data-feather="trash-2" class="w-5 h-5"></i></button>
                </td>
            `;
            DOMElements.productListBody.appendChild(row);
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching products: ", error);
        showToast('Erro ao carregar produtos.', true);
    }
}

async function fetchAndRenderCoupons() {
    try {
        const querySnapshot = await getDocs(collection(db, "coupons"));
        DOMElements.couponListBody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const coupon = { id: doc.id, ...doc.data() };
            const row = document.createElement('tr');
            row.className = 'border-b';
            row.innerHTML = `
                <td class="py-3 px-2 font-mono">${coupon.code}</td>
                <td class="py-3 px-2">${(coupon.discount * 100).toFixed(0)}%</td>
                <td class="py-3 px-2">
                    <button class="delete-coupon-btn text-red-500 hover:text-red-700" data-id="${coupon.id}"><i data-feather="trash-2" class="w-5 h-5"></i></button>
                </td>
            `;
            DOMElements.couponListBody.appendChild(row);
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching coupons: ", error);
        showToast("Erro ao carregar cupons.", true);
    }
}

// =================================================================
// CRUD & FORM HANDLING
// =================================================================

function resetProductForm() {
    DOMElements.productForm.reset();
    DOMElements.productIdField.value = '';
    DOMElements.submitProductBtn.textContent = 'Adicionar Produto';
    DOMElements.cancelEditBtn.classList.add('hidden');
}

function populateProductForm(productId) {
    const productRef = doc(db, "products", productId);
    getDoc(productRef).then(docSnap => {
        if (docSnap.exists()) {
            const product = docSnap.data();
            DOMElements.productIdField.value = productId;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-category').value = product.category;
            document.getElementById('product-stock').value = product.stock;
            document.getElementById('product-image').value = product.image;
            document.getElementById('product-description').value = product.description;

            DOMElements.submitProductBtn.textContent = 'Salvar Alterações';
            DOMElements.cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

async function handleProductFormSubmit(e) {
    e.preventDefault();
    const productId = DOMElements.productIdField.value;
    const productData = {
        name: document.getElementById('product-name').value,
        price: parseFloat(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value,
        stock: parseInt(document.getElementById('product-stock').value),
        image: document.getElementById('product-image').value,
        description: document.getElementById('product-description').value,
    };

    try {
        if (productId) { // Update existing product
            await updateDoc(doc(db, "products", productId), productData);
            showToast('Produto atualizado com sucesso!');
        } else { // Add new product
            // Add fields that are only set on creation
            productData.rating = 0;
            productData.reviews = [];
            await addDoc(collection(db, "products"), productData);
            showToast('Produto adicionado com sucesso!');
        }
        resetProductForm();
        await fetchAndRenderProducts();
        await fetchStats();
    } catch (error) {
        console.error("Error saving product: ", error);
        showToast('Erro ao salvar produto.', true);
    }
}

async function deleteProduct(productId) {
    if (confirm('Tem a certeza que quer eliminar este produto?')) {
        try {
            await deleteDoc(doc(db, "products", productId));
            showToast('Produto eliminado com sucesso.');
            await fetchAndRenderProducts();
            await fetchStats();
        } catch (error) {
            console.error("Error deleting product: ", error);
            showToast('Erro ao eliminar produto.', true);
        }
    }
}

async function handleCouponFormSubmit(e) {
    e.preventDefault();
    const newCoupon = {
        code: document.getElementById('coupon-code').value.toUpperCase(),
        discount: parseFloat(document.getElementById('coupon-discount').value)
    };
    try {
        await addDoc(collection(db, "coupons"), newCoupon);
        DOMElements.addCouponForm.reset();
        showToast('Cupom adicionado com sucesso!');
        await fetchAndRenderCoupons();
        await fetchStats();
    } catch (error) {
        showToast('Erro ao adicionar cupom.', true);
    }
}

async function deleteCoupon(couponId) {
    if (confirm('Tem a certeza que quer eliminar este cupom?')) {
        try {
            await deleteDoc(doc(db, "coupons", couponId));
            showToast('Cupom eliminado com sucesso.');
            await fetchAndRenderCoupons();
            await fetchStats();
        } catch (error) {
            showToast('Erro ao eliminar cupom.', true);
        }
    }
}

// =================================================================
// AUTHENTICATION
// =================================================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!ADMIN_EMAILS.includes(email)) {
        showAuthMessage('Acesso negado. Este email não é de um administrador.', 'red');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Error:", error.code);
        showAuthMessage('Email ou senha inválidos.', 'red');
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

// =================================================================
// MAIN APP LOGIC & EVENT LISTENERS
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    onAuthStateChanged(auth, async (user) => {
        if (user && ADMIN_EMAILS.includes(user.email)) {
            DOMElements.authScreen.classList.add('hidden');
            DOMElements.adminPanel.classList.remove('hidden');
            DOMElements.adminEmail.textContent = user.email;
            
            switchView('dashboard');
            await fetchStats();
            await fetchAndRenderProducts();
            await fetchAndRenderCoupons();
        } else {
            DOMElements.authScreen.classList.remove('hidden');
            DOMElements.adminPanel.classList.add('hidden');
            if (user) { // If a non-admin user is logged in, sign them out
                signOut(auth);
            }
        }
        feather.replace();
    });

    DOMElements.loginForm.addEventListener('submit', handleLogin);
    DOMElements.logoutButton.addEventListener('click', handleLogout);
    DOMElements.productForm.addEventListener('submit', handleProductFormSubmit);
    DOMElements.addCouponForm.addEventListener('submit', handleCouponFormSubmit);
    DOMElements.cancelEditBtn.addEventListener('click', resetProductForm);

    DOMElements.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.dataset.view);
        });
    });

    DOMElements.productListBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        if (editBtn) populateProductForm(editBtn.dataset.id);
        if (deleteBtn) deleteProduct(deleteBtn.dataset.id);
    });

    DOMElements.couponListBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-coupon-btn');
        if (deleteBtn) deleteCoupon(deleteBtn.dataset.id);
    });
});
