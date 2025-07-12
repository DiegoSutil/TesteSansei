/**
 * @fileoverview Módulo de Gestão de Cupões.
 */
import { collection, getDocs, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js'; // Importa a instância db do ficheiro de configuração centralizado
import { DOMElements, showToast, showAdminConfirmationModal } from './ui.js'; // Importa showAdminConfirmationModal
import { fetchStats } from './stats.js';

export async function fetchAndRenderCoupons() {
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
                </td>`;
            DOMElements.couponListBody.appendChild(row);
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching coupons: ", error);
        showToast("Erro ao carregar cupons.", true);
    }
}

export async function handleCouponFormSubmit(e) {
    e.preventDefault();
    const newCoupon = {
        code: DOMElements.addCouponForm['coupon-code'].value.toUpperCase(),
        discount: parseFloat(DOMElements.addCouponForm['coupon-discount'].value) / 100,
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

export async function deleteCoupon(couponId) {
    // Usa o modal de confirmação personalizado
    const confirmed = await showAdminConfirmationModal('Tem a certeza que quer eliminar este cupom?', 'Eliminar Cupom');
    if (confirmed) {
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
