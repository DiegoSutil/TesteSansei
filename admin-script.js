import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc, updateDoc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const storage = getStorage(app);

// IMPORTANT: List of authorized admin emails
const ADMIN_EMAILS = ["admin@sansei.com", "diego.sutil@gmail.com", "sanseiadmin@gmail.com"];

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
    addReelForm: document.getElementById('add-reel-form'),
    reelListBody: document.getElementById('reel-list-body'),
    orderListBody: document.getElementById('order-list-body'),
    adminEmail: document.getElementById('admin-email'),
    productIdField: document.getElementById('product-id'),
    productImageUrlField: document.getElementById('product-image-url'),
    imagePreview: document.getElementById('image-preview'),
    imageUploadInput: document.getElementById('product-image-upload'),
    submitProductBtn: document.getElementById('submit-product-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
};

// =================================================================
// UTILITY & UI FUNCTIONS
// =================================================================

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

function showAuthMessage(message, color) {
    DOMElements.authMessage.textContent = message;
    DOMElements.authMessage.className = `mb-4 p-3 rounded-md text-center bg-${color}-100 text-${color}-700`;
}

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
        const ordersSnapshot = await getDocs(collection(db, "orders"));
        
        document.getElementById('stats-orders').textContent = ordersSnapshot.size;
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
        DOMElements.productListBody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const product = { id: doc.id, ...doc.data() };
            const row = document.createElement('tr');
            row.className = 'border-b';
            row.innerHTML = `
                <td class="py-2 px-2"><img src="${product.image}" alt="${product.name}" class="w-12 h-12 object-cover rounded-md"></td>
                <td class="py-3 px-2">${product.name}</td>
                <td class="py-3 px-2 capitalize">${product.category}</td>
                <td class="py-3 px-2">R$ ${product.price.toFixed(2)}</td>
                <td class="py-3 px-2">${product.stock}</td>
                <td class="py-3 px-2 flex gap-2 items-center">
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

async function fetchAndRenderReels() {
    try {
        const querySnapshot = await getDocs(collection(db, "reels"));
        DOMElements.reelListBody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const reel = { id: doc.id, ...doc.data() };
            const row = document.createElement('tr');
            row.className = 'border-b';
            row.innerHTML = `
                <td class="py-3 px-2">
                    <img src="${reel.thumbnail}" alt="Reel Thumbnail" class="w-24 h-24 object-cover rounded-md">
                </td>
                <td class="py-3 px-2 break-all"><a href="${reel.url}" target="_blank" class="text-blue-500 hover:underline">${reel.url}</a></td>
                <td class="py-3 px-2">
                    <button class="delete-reel-btn text-red-500 hover:text-red-700" data-id="${reel.id}"><i data-feather="trash-2" class="w-5 h-5"></i></button>
                </td>
            `;
            DOMElements.reelListBody.appendChild(row);
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching reels: ", error);
        showToast("Erro ao carregar reels.", true);
    }
}

async function fetchAndRenderOrders() {
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        DOMElements.orderListBody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const order = { id: doc.id, ...doc.data() };
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');

            const statusColors = {
                Pendente: 'bg-yellow-100 text-yellow-800',
                Enviado: 'bg-blue-100 text-blue-800',
                Entregue: 'bg-green-100 text-green-800',
                Cancelado: 'bg-red-100 text-red-800',
            };

            const statusSelect = `
                <select class="order-status-select p-2 rounded-md border-gray-300 focus:ring-gold-500 ${statusColors[order.status]}" data-id="${order.id}">
                    <option value="Pendente" ${order.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="Enviado" ${order.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                    <option value="Entregue" ${order.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
                    <option value="Cancelado" ${order.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            `;

            const itemsList = order.items.map(item => `<li>${item.quantity}x ${item.name}</li>`).join('');

            row.innerHTML = `
                <td class="py-3 px-2 font-mono text-xs">${order.id}</td>
                <td class="py-3 px-2">${order.userEmail}</td>
                <td class="py-3 px-2">${orderDate}</td>
                <td class="py-3 px-2 font-semibold">R$ ${order.total.toFixed(2)}</td>
                <td class="py-3 px-2">${statusSelect}</td>
                <td class="py-3 px-2"><ul>${itemsList}</ul></td>
            `;
            DOMElements.orderListBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching orders: ", error);
        showToast('Erro ao carregar encomendas.', true);
    }
}

// =================================================================
// CRUD & FORM HANDLING
// =================================================================

async function updateOrderStatus(orderId, newStatus) {
    const orderRef = doc(db, "orders", orderId);
    try {
        await updateDoc(orderRef, { status: newStatus });
        showToast(`Estado da encomenda atualizado para ${newStatus}.`);
        fetchAndRenderOrders(); // Refresh the list to show color changes
    } catch (error) {
        console.error("Error updating order status: ", error);
        showToast("Erro ao atualizar o estado da encomenda.", true);
    }
}

function resetProductForm() {
    DOMElements.productForm.reset();
    DOMElements.productIdField.value = '';
    DOMElements.productImageUrlField.value = '';
    DOMElements.imagePreview.src = '';
    DOMElements.imagePreview.classList.add('hidden');
    DOMElements.submitProductBtn.textContent = 'Adicionar Produto';
    DOMElements.cancelEditBtn.classList.add('hidden');
    DOMElements.submitProductBtn.disabled = false;
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
            document.getElementById('product-description').value = product.description;
            
            // Store existing image URL and show preview
            DOMElements.productImageUrlField.value = product.image;
            DOMElements.imagePreview.src = product.image;
            DOMElements.imagePreview.classList.remove('hidden');

            DOMElements.submitProductBtn.textContent = 'Salvar Alterações';
            DOMElements.cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

async function handleProductFormSubmit(e) {
    e.preventDefault();
    DOMElements.submitProductBtn.disabled = true;
    DOMElements.submitProductBtn.textContent = 'A guardar...';

    const productId = DOMElements.productIdField.value;
    const imageFile = DOMElements.imageUploadInput.files[0];
    let imageUrl = DOMElements.productImageUrlField.value;

    try {
        // If a new image file is selected, upload it
        if (imageFile) {
            const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
            const snapshot = await uploadBytes(storageRef, imageFile);
            imageUrl = await getDownloadURL(snapshot.ref);
        }

        if (!imageUrl) {
            showToast("Por favor, selecione uma imagem para o produto.", true);
            DOMElements.submitProductBtn.disabled = false;
            DOMElements.submitProductBtn.textContent = productId ? 'Salvar Alterações' : 'Adicionar Produto';
            return;
        }

        const productData = {
            name: document.getElementById('product-name').value,
            price: parseFloat(document.getElementById('product-price').value),
            category: document.getElementById('product-category').value,
            stock: parseInt(document.getElementById('product-stock').value),
            image: imageUrl,
            description: document.getElementById('product-description').value,
        };

        if (productId) {
            await updateDoc(doc(db, "products", productId), productData);
            showToast('Produto atualizado com sucesso!');
        } else {
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
    } finally {
        DOMElements.submitProductBtn.disabled = false;
        // The text is reset inside resetProductForm
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

async function handleAddReelFormSubmit(e) {
    e.preventDefault();
    const newReel = {
        url: document.getElementById('reel-url').value,
        thumbnail: document.getElementById('reel-thumbnail').value
    };
    try {
        await addDoc(collection(db, "reels"), newReel);
        DOMElements.addReelForm.reset();
        showToast('Reel adicionado com sucesso!');
        await fetchAndRenderReels();
    } catch (error) {
        showToast('Erro ao adicionar reel.', true);
    }
}

async function deleteReel(reelId) {
    if (confirm('Tem a certeza que quer eliminar este reel?')) {
        try {
            await deleteDoc(doc(db, "reels", reelId));
            showToast('Reel eliminado com sucesso.');
            await fetchAndRenderReels();
        } catch (error) {
            showToast('Erro ao eliminar reel.', true);
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
            await fetchAndRenderReels();
            await fetchAndRenderOrders();
        } else {
            DOMElements.authScreen.classList.remove('hidden');
            DOMElements.adminPanel.classList.add('hidden');
            if (user) { 
                signOut(auth);
            }
        }
        feather.replace();
    });

    DOMElements.loginForm.addEventListener('submit', handleLogin);
    DOMElements.logoutButton.addEventListener('click', handleLogout);
    DOMElements.productForm.addEventListener('submit', handleProductFormSubmit);
    DOMElements.addCouponForm.addEventListener('submit', handleCouponFormSubmit);
    DOMElements.addReelForm.addEventListener('submit', handleAddReelFormSubmit);
    DOMElements.cancelEditBtn.addEventListener('click', resetProductForm);

    DOMElements.imageUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                DOMElements.imagePreview.src = event.target.result;
                DOMElements.imagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

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

    DOMElements.reelListBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-reel-btn');
        if (deleteBtn) deleteReel(deleteBtn.dataset.id);
    });

    DOMElements.orderListBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('order-status-select')) {
            const orderId = e.target.dataset.id;
            const newStatus = e.target.value;
            updateOrderStatus(orderId, newStatus);
        }
    });
});
