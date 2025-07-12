/**
 * @fileoverview Módulo de Gestão de Produtos.
 */
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, getDoc, query, orderBy, limit, startAfter, endBefore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js'; // Importa a instância db do ficheiro de configuração centralizado
import { DOMElements, showToast, showAdminConfirmationModal } from './ui.js'; // Importa showAdminConfirmationModal
import { fetchStats } from './stats.js';

// Estado da paginação
let lastVisibleProduct = null;
let firstVisibleProduct = null;
let productCurrentPage = 1;
const PRODUCTS_PER_PAGE = 10;

async function updateProductPaginationButtons() {
    DOMElements.productPageInfo.textContent = `Página ${productCurrentPage}`;
    DOMElements.prevProductPageBtn.disabled = productCurrentPage === 1;

    const productsRef = collection(db, "products");
    // ATENÇÃO: Para esta consulta funcionar, você precisará criar um índice no Firestore.
    // O Firestore exige um índice composto para consultas que usam orderBy e startAfter.
    // Se a consulta falhar, o console do Firebase fornecerá um link para criar o índice necessário.
    const nextQuery = query(productsRef, orderBy("name"), startAfter(lastVisibleProduct), limit(1));
    const nextSnap = await getDocs(nextQuery);
    DOMElements.nextProductPageBtn.disabled = nextSnap.empty;
}

export async function fetchAndRenderProducts(direction = 'first') {
    try {
        const productsRef = collection(db, "products");
        let q;
        // ATENÇÃO: Para esta consulta funcionar, você precisará criar um índice no Firestore.
        // O Firestore exige um índice composto para consultas que usam orderBy.
        // Se a consulta falhar, o console do Firebase fornecerá um link para criar o índice necessário.
        const baseQuery = query(productsRef, orderBy("name"));

        switch (direction) {
            case 'first':
                productCurrentPage = 1;
                q = query(baseQuery, limit(PRODUCTS_PER_PAGE));
                break;
            case 'next':
                if (!lastVisibleProduct) return;
                productCurrentPage++;
                q = query(baseQuery, startAfter(lastVisibleProduct), limit(PRODUCTS_PER_PAGE));
                break;
            case 'prev':
                if (!firstVisibleProduct) return;
                productCurrentPage--;
                q = query(baseQuery, endBefore(firstVisibleProduct), limit(PRODUCTS_PER_PAGE));
                break;
            default: return;
        }

        const documentSnapshots = await getDocs(q);
        if (documentSnapshots.empty) {
            if (direction === 'next') productCurrentPage--;
            if (direction === 'prev') productCurrentPage++;
            showToast("Não há mais produtos para mostrar.");
            return;
        }

        firstVisibleProduct = documentSnapshots.docs[0];
        lastVisibleProduct = documentSnapshots.docs[documentSnapshots.docs.length - 1];

        DOMElements.productListBody.innerHTML = '';
        documentSnapshots.docs.forEach((doc) => {
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
                </td>`;
            DOMElements.productListBody.appendChild(row);
        });
        feather.replace();
        await updateProductPaginationButtons();
    } catch (error) {
        console.error("Error fetching products: ", error);
        showToast('Erro ao carregar produtos.', true);
    }
}

export function resetProductForm() {
    DOMElements.productForm.reset();
    DOMElements.productIdField.value = '';
    DOMElements.submitProductBtn.textContent = 'Adicionar Produto';
    DOMElements.cancelEditBtn.classList.add('hidden');
    DOMElements.submitProductBtn.disabled = false;
}

export function populateProductForm(productId) {
    const productRef = doc(db, "products", productId);
    getDoc(productRef).then(docSnap => {
        if (docSnap.exists()) {
            const product = docSnap.data();
            DOMElements.productIdField.value = productId;
            DOMElements.productForm['product-name'].value = product.name;
            DOMElements.productForm['product-price'].value = product.price;
            DOMElements.productForm['product-category'].value = product.category;
            DOMElements.productForm['product-stock'].value = product.stock;
            DOMElements.productForm['product-image'].value = product.image;
            DOMElements.productForm['product-description'].value = product.description;
            DOMElements.submitProductBtn.textContent = 'Salvar Alterações';
            DOMElements.cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

export async function handleProductFormSubmit(e) {
    e.preventDefault();
    DOMElements.submitProductBtn.disabled = true;
    const productId = DOMElements.productIdField.value;
    const productData = {
        name: DOMElements.productForm['product-name'].value,
        price: parseFloat(DOMElements.productForm['product-price'].value),
        category: DOMElements.productForm['product-category'].value,
        stock: parseInt(DOMElements.productForm['product-stock'].value),
        image: DOMElements.productForm['product-image'].value,
        description: DOMElements.productForm['product-description'].value,
    };

    try {
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
        await fetchAndRenderProducts('first');
        await fetchStats();
    } catch (error) {
        console.error("Error saving product: ", error);
        showToast('Erro ao salvar produto.', true);
    } finally {
        DOMElements.submitProductBtn.disabled = false;
    }
}

export async function deleteProduct(productId) {
    // Usa o modal de confirmação personalizado
    const confirmed = await showAdminConfirmationModal('Tem a certeza que quer eliminar este produto?', 'Eliminar Produto');
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "products", productId));
            showToast('Produto eliminado com sucesso.');
            await fetchAndRenderProducts('first');
            await fetchStats();
        } catch (error) {
            console.error("Error deleting product: ", error);
            showToast('Erro ao eliminar produto.', true);
        }
    }
}
