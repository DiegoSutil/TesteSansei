/**
 * @fileoverview Módulo de Autenticação para o Painel de Admin.
 */
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from '../firebase-config.js'; // Importa a instância auth do ficheiro de configuração centralizado
import { DOMElements, showAuthMessage, switchView } from './ui.js';
import { initializeAdminPanel } from './main.js';

// Lista de emails autorizados. Considere usar Custom Claims para maior segurança em produção.
const ADMIN_EMAILS = ["admin@sansei.com", "diego.sutil@gmail.com", "sanseiadmin@gmail.com"];

/**
 * Tenta fazer login do administrador.
 * @param {Event} e - O evento do formulário.
 */
export async function handleLogin(e) {
    e.preventDefault();
    const email = DOMElements.loginForm.email.value;
    const password = DOMElements.loginForm.password.value;

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

/**
 * Faz logout do utilizador atual.
 */
export async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

/**
 * Observa mudanças no estado de autenticação e controla o acesso ao painel.
 */
export function authStateObserver() {
    onAuthStateChanged(auth, async (user) => {
        if (user && ADMIN_EMAILS.includes(user.email)) {
            DOMElements.authScreen.classList.add('hidden');
            DOMElements.adminPanel.classList.remove('hidden');
            DOMElements.adminEmail.textContent = user.email;
            
            // Se o utilizador for um admin, inicializa o painel
            initializeAdminPanel();
        } else {
            DOMElements.authScreen.classList.remove('hidden');
            DOMElements.adminPanel.classList.add('hidden');
            if (user) { 
                // Se o utilizador está logado mas não é admin, faz logout
                await signOut(auth);
            }
        }
        // Garante que os ícones Feather sejam renderizados após as mudanças no DOM
        feather.replace();
    });
}
