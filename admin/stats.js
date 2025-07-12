/**
 * @fileoverview Módulo para buscar estatísticas do Dashboard.
 */
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js'; // Importa a instância db do ficheiro de configuração centralizado
import { showToast } from './ui.js';

export async function fetchStats() {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const usersSnapshot = await getDocs(collection(db, "users"));
        const couponsSnapshot = await getDocs(collection(db, "coupons"));
        const ordersSnapshot = await getDocs(collection(db, "orders"));
        
        let totalReviews = 0;
        productsSnapshot.forEach(doc => {
            totalReviews += doc.data().reviews?.length || 0;
        });

        document.getElementById('stats-orders').textContent = ordersSnapshot.size;
        document.getElementById('stats-products').textContent = productsSnapshot.size;
        document.getElementById('stats-users').textContent = usersSnapshot.size;
        document.getElementById('stats-reviews').textContent = totalReviews;
    } catch (e) {
        console.error("Error fetching stats:", e);
        showToast("Erro ao carregar estatísticas.", true);
    }
}
