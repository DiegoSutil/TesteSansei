/**
 * @fileoverview Módulo de Gestão de Encomendas.
 */
import { collection, getDocs, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js'; // Importa a instância db do ficheiro de configuração centralizado
import { DOMElements, showToast } from './ui.js';

export async function fetchAndRenderOrders() {
    try {
        // ATENÇÃO: Para esta consulta funcionar, você precisará criar um índice no Firestore.
        // O Firestore exige um índice composto para consultas que usam orderBy.
        // Se a consulta falhar, o console do Firebase fornecerá um link para criar o índice necessário.
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        DOMElements.orderListBody.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const order = { id: docSnap.id, ...docSnap.data() };
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');
            const statusColors = { Pendente: 'bg-yellow-100 text-yellow-800', Enviado: 'bg-blue-100 text-blue-800', Entregue: 'bg-green-100 text-green-800', Cancelado: 'bg-red-100 text-red-800' };
            const statusSelect = `
                <select class="order-status-select p-2 rounded-md border-gray-300 focus:ring-gold-500 ${statusColors[order.status]}" data-id="${order.id}">
                    <option value="Pendente" ${order.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="Enviado" ${order.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                    <option value="Entregue" ${order.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
                    <option value="Cancelado" ${order.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>`;
            const itemsList = order.items.map(item => `<li>${item.quantity}x ${item.name}</li>`).join('');
            row.innerHTML = `
                <td class="py-3 px-2 font-mono text-xs">${order.id}</td>
                <td class="py-3 px-2">${order.userEmail}</td>
                <td class="py-3 px-2">${orderDate}</td>
                <td class="py-3 px-2 font-semibold">R$ ${order.total.toFixed(2)}</td>
                <td class="py-3 px-2">${statusSelect}</td>
                <td class="py-3 px-2"><ul>${itemsList}</ul></td>`;
            DOMElements.orderListBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching orders: ", error);
        showToast('Erro ao carregar encomendas.', true);
    }
}

export async function updateOrderStatus(orderId, newStatus) {
    const orderRef = doc(db, "orders", orderId);
    try {
        await updateDoc(orderRef, { status: newStatus });
        showToast(`Estado da encomenda atualizado para ${newStatus}.`);
        await fetchAndRenderOrders(); // Recarrega para refletir a cor
    } catch (error) {
        console.error("Error updating order status: ", error);
        showToast("Erro ao atualizar o estado da encomenda.", true);
    }
}
