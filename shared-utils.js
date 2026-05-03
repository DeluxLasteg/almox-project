"use strict";

/* Shared utilities for DOM, formatting, and modal behavior. */

function normalizarBusca(value) {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

function formatarContagem(valor, singular, plural = `${singular}s`) {
    return `${valor} ${valor === 1 ? singular : plural}`;
}

function criarDebounce(callback, wait = 120) {
    let timeoutId = null;

    return (...args) => {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
        }

        timeoutId = window.setTimeout(() => {
            timeoutId = null;
            callback(...args);
        }, wait);
    };
}

function focarCampo(elemento, { selecionar = false } = {}) {
    if (!(elemento instanceof HTMLElement)) {
        return;
    }

    const aplicarFoco = () => {
        if (!document.body.contains(elemento)) {
            return;
        }

        try {
            elemento.focus({ preventScroll: true });
        } catch (error) {
            elemento.focus();
        }

        if (
            selecionar &&
            (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) &&
            typeof elemento.select === "function"
        ) {
            elemento.select();
        }
    };

    aplicarFoco();
    window.requestAnimationFrame(aplicarFoco);
    window.setTimeout(aplicarFoco, 40);
}

function obterElementosFocaveis(modal) {
    if (!(modal instanceof HTMLElement)) {
        return [];
    }

    return Array.from(
        modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((elemento) => !elemento.disabled && elemento.offsetParent !== null);
}

function definirEstadoModal(modal, aberto) {
    if (!(modal instanceof HTMLElement)) {
        return;
    }

    modal.style.display = aberto ? "flex" : "none";
    modal.classList.toggle("is-open", aberto);
    modal.setAttribute("aria-hidden", aberto ? "false" : "true");

    if (typeof window.atualizarClasseGlobalDeModais === "function") {
        window.atualizarClasseGlobalDeModais();
        return;
    }

    document.body.classList.toggle("has-modal-open", aberto);
}

function escapeHtml(value) {
    if (value == null) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

window.normalizarBusca = normalizarBusca;
window.formatarContagem = formatarContagem;
window.criarDebounce = criarDebounce;
window.focarCampo = focarCampo;
window.obterElementosFocaveis = obterElementosFocaveis;
window.definirEstadoModal = definirEstadoModal;
window.escapeHtml = escapeHtml;
