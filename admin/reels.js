/**
 * @fileoverview Módulo de Gestão de Reels.
 */
import { collection, getDocs, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../firebase-config.js'; // Importa a instância db do ficheiro de configuração centralizado
import { DOMElements, showToast, showAdminConfirmationModal } from './ui.js'; // Importa showAdminConfirmationModal

export async function fetchAndRenderReels() {
    try {
        const querySnapshot = await getDocs(collection(db, "reels"));
        DOMElements.reelListBody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const reel = { id: doc.id, ...doc.data() };
            const row = document.createElement('tr');
            row.className = 'border-b';
            row.innerHTML = `
                <td class="py-3 px-2"><img src="${reel.thumbnail}" alt="Reel Thumbnail" class="w-24 h-24 object-cover rounded-md"></td>
                <td class="py-3 px-2 break-all"><a href="${reel.url}" target="_blank" class="text-blue-500 hover:underline">${reel.url}</a></td>
                <td class="py-3 px-2">
                    <button class="delete-reel-btn text-red-500 hover:text-red-700" data-id="${reel.id}"><i data-feather="trash-2" class="w-5 h-5"></i></button>
                </td>`;
            DOMElements.reelListBody.appendChild(row);
        });
        feather.replace();
    } catch (error) {
        console.error("Error fetching reels: ", error);
        showToast("Erro ao carregar reels.", true);
    }
}

export async function handleAddReelFormSubmit(e) {
    e.preventDefault();
    const newReel = {
        url: DOMElements.addReelForm['reel-url'].value,
        thumbnail: DOMElements.addReelForm['reel-thumbnail'].value
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

export async function deleteReel(reelId) {
    // Usa o modal de confirmação personalizado
    const confirmed = await showAdminConfirmationModal('Tem a certeza que quer eliminar este reel?', 'Eliminar Reel');
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "reels", reelId));
            showToast('Reel eliminado com sucesso.');
            await fetchAndRenderReels();
        } catch (error) {
            showToast('Erro ao eliminar reel.', true);
        }
    }
}
