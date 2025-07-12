/**
 * @fileoverview Módulo de Gestão de Avaliações.
 */
import { collection, getDocs, doc, updateDoc, getDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js'; // Importa a instância db do ficheiro de configuração centralizado
import { DOMElements, showToast, renderStars, showAdminConfirmationModal } from './ui.js'; // Importa showAdminConfirmationModal
import { fetchStats } from './stats.js';

export async function fetchAndRenderReviews() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        DOMElements.reviewListBody.innerHTML = '';
        productsSnapshot.forEach(pDoc => {
            const product = { id: pDoc.id, ...pDoc.data() };
            if (product.reviews && product.reviews.length > 0) {
                product.reviews.forEach((review, index) => {
                    const row = document.createElement('tr');
                    row.className = 'border-b';
                    row.innerHTML = `
                        <td class="py-3 px-2">${product.name}</td>
                        <td class="py-3 px-2">${review.userName}</td>
                        <td class="py-3 px-2">${renderStars(review.rating)}</td>
                        <td class="py-3 px-2 text-xs">${review.text}</td>
                        <td class="py-3 px-2">
                            <button class="delete-review-btn text-red-500 hover:text-red-700" data-product-id="${product.id}" data-review-index="${index}"><i data-feather="trash-2" class="w-5 h-5"></i></button>
                        </td>`;
                    DOMElements.reviewListBody.appendChild(row);
                });
            }
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching reviews: ", error);
        showToast("Erro ao carregar avaliações.", true);
    }
}

export async function deleteReview(productId, reviewIndex) {
    // Usa o modal de confirmação personalizado
    const confirmed = await showAdminConfirmationModal('Tem a certeza que quer eliminar esta avaliação?', 'Eliminar Avaliação');
    if (confirmed) {
        const productRef = doc(db, "products", productId);
        try {
            const productDoc = await getDoc(productRef);
            if (!productDoc.exists()) throw new Error("Produto não encontrado");
            
            const reviewToDelete = productDoc.data().reviews[reviewIndex];
            if (!reviewToDelete) throw new Error("Avaliação não encontrada");

            await updateDoc(productRef, { reviews: arrayRemove(reviewToDelete) });

            // Recalcula a média após a remoção
            const updatedDoc = await getDoc(productRef);
            const updatedReviews = updatedDoc.data().reviews || [];
            const newAvgRating = updatedReviews.length > 0
                ? updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length
                : 0;
            await updateDoc(productRef, { rating: newAvgRating });

            showToast('Avaliação eliminada com sucesso.');
            await fetchAndRenderReviews();
            await fetchStats();
        } catch (error) {
            console.error("Error deleting review: ", error);
            showToast('Erro ao eliminar avaliação.', true);
        }
    }
}
