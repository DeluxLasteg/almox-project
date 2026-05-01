const APP_THEME_META_COLOR = document.querySelector('meta[name="theme-color"]');
const INSTALL_BUTTON_SELECTOR = "[data-install-button]";
const UNINSTALL_BUTTON_SELECTOR = "[data-uninstall-button]";
const APP_INSTALLED_STORAGE_KEY = "almoxAppInstalled";
const TOAST_REGION_ID = "toastRegion";
const TOAST_DEFAULT_DURATION = 4200;
const SETTINGS_MODAL_ID = "modalConfiguracoes";
const SETTINGS_OPEN_SELECTOR = "[data-settings-open]";
const SETTINGS_CLOSE_SELECTOR = "[data-settings-close]";

let deferredInstallPrompt = null;
let toastSequence = 0;
let toastRegionCreationScheduled = false;
let ultimoElementoFocadoConfiguracoes = null;
let recarregouPorAtualizacaoDoServiceWorker = false;

inicializarAplicacaoBase();

function inicializarAplicacaoBase() {
    criarRegiaoDeToasts();
    inicializarModalConfiguracoes();
    atualizarCorDoTemaNoChrome();
    observarMudancasDeTema();
    registrarEventosDeInstalacao();
    registrarServiceWorker();
    solicitarPersistenciaDeArmazenamento();
    window.mostrarToast = mostrarToast;
    window.abrirModalConfiguracoes = abrirModalConfiguracoes;
    window.fecharModalConfiguracoes = fecharModalConfiguracoes;
    window.atualizarClasseGlobalDeModais = atualizarClasseGlobalDeModais;
}

function obterModalConfiguracoes() {
    return document.getElementById(SETTINGS_MODAL_ID);
}

function atualizarClasseGlobalDeModais() {
    document.body.classList.toggle("has-modal-open", Boolean(document.querySelector(".modal.is-open")));
}

function definirEstadoDoModal(modal, aberto) {
    if (!(modal instanceof HTMLElement)) {
        return;
    }

    modal.style.display = aberto ? "flex" : "none";
    modal.classList.toggle("is-open", aberto);
    modal.setAttribute("aria-hidden", aberto ? "false" : "true");
    atualizarClasseGlobalDeModais();
}

function obterElementosFocaveis(modal) {
    if (!(modal instanceof HTMLElement)) {
        return [];
    }

    return Array.from(
        modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((elemento) => !elemento.disabled && elemento.offsetParent !== null);
}

function manterFocoNoModalBase(event, modal) {
    const elementosFocaveis = obterElementosFocaveis(modal);

    if (!elementosFocaveis.length) {
        return;
    }

    const primeiro = elementosFocaveis[0];
    const ultimo = elementosFocaveis[elementosFocaveis.length - 1];

    if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
        return;
    }

    if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
    }
}

function focarPrimeiroControleDeConfiguracoes(modal) {
    if (!(modal instanceof HTMLElement)) {
        return;
    }

    const alvoPreferencial = modal.querySelector("[data-settings-focus]");
    const alvo = alvoPreferencial instanceof HTMLElement
        ? alvoPreferencial
        : obterElementosFocaveis(modal)[0];

    alvo?.focus();
}

function abrirModalConfiguracoes() {
    const modal = obterModalConfiguracoes();
    if (!(modal instanceof HTMLElement)) {
        return;
    }

    if (document.querySelector(".modal.is-open") && !modal.classList.contains("is-open")) {
        return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !modal.contains(activeElement)) {
        ultimoElementoFocadoConfiguracoes = activeElement;
    }

    definirEstadoDoModal(modal, true);
    focarPrimeiroControleDeConfiguracoes(modal);
}

function fecharModalConfiguracoes({ restaurarFoco = true } = {}) {
    const modal = obterModalConfiguracoes();
    if (!(modal instanceof HTMLElement) || !modal.classList.contains("is-open")) {
        return;
    }

    definirEstadoDoModal(modal, false);

    if (restaurarFoco && ultimoElementoFocadoConfiguracoes instanceof HTMLElement && document.body.contains(ultimoElementoFocadoConfiguracoes)) {
        ultimoElementoFocadoConfiguracoes.focus();
    }

    ultimoElementoFocadoConfiguracoes = null;
}

function tratarTecladoModalConfiguracoes(event) {
    const modal = obterModalConfiguracoes();
    if (!(modal instanceof HTMLElement) || !modal.classList.contains("is-open")) {
        return;
    }

    if (event.key === "Tab") {
        event.stopPropagation();
        manterFocoNoModalBase(event, modal);
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        fecharModalConfiguracoes();
    }
}

function inicializarModalConfiguracoes() {
    const modal = obterModalConfiguracoes();
    if (!(modal instanceof HTMLElement)) {
        return;
    }

    definirEstadoDoModal(modal, false);

    // Adiciona evento ao botão do menu lateral (data-action="configuracoes")
    const botaoMenuConfiguracoes = document.querySelector('.retractable-content [data-action="configuracoes"]');
    if (botaoMenuConfiguracoes) {
        botaoMenuConfiguracoes.addEventListener("click", (event) => {
            event.preventDefault();
            abrirModalConfiguracoes();
        });
    }

    modal.querySelectorAll(SETTINGS_CLOSE_SELECTOR).forEach((botao) => {
        botao.addEventListener("click", () => {
            fecharModalConfiguracoes();
        });
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            fecharModalConfiguracoes();
        }
    });

    document.addEventListener("keydown", tratarTecladoModalConfiguracoes, true);
}

function atualizarCorDoTemaNoChrome() {
    if (!APP_THEME_META_COLOR) {
        return;
    }

    const estilos = getComputedStyle(document.documentElement);
    const cor = estilos.getPropertyValue("--surface").trim() || "#1e293b";
    APP_THEME_META_COLOR.setAttribute("content", cor);
}

function observarMudancasDeTema() {
    const observer = new MutationObserver(() => {
        atualizarCorDoTemaNoChrome();
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
    });
}

function registrarEventosDeInstalacao() {
    atualizarBotoesDeInstalacao();

    const mediaStandalone = window.matchMedia("(display-mode: standalone)");
    const atualizarPeloModoDeExibicao = () => {
        if (aplicativoEmModoInstalado()) {
            registrarAplicativoComoInstalado();
        }

        atualizarBotoesDeInstalacao();
    };

    if (typeof mediaStandalone.addEventListener === "function") {
        mediaStandalone.addEventListener("change", atualizarPeloModoDeExibicao);
    } else if (typeof mediaStandalone.addListener === "function") {
        mediaStandalone.addListener(atualizarPeloModoDeExibicao);
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        // Não chamamos preventDefault() para permitir que o navegador mostre o banner nativo
        deferredInstallPrompt = event;
        removerMarcaDeAplicativoInstalado();
        atualizarBotoesDeInstalacao();
    });

    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        registrarAplicativoComoInstalado();
        atualizarBotoesDeInstalacao();
        mostrarToast({
            variant: "success",
            title: "Aplicativo instalado",
            message: "O Almoxarifado já pode ser aberto como app nesta máquina."
        });
    });

    document.querySelectorAll(INSTALL_BUTTON_SELECTOR).forEach((botao) => {
        botao.addEventListener("click", async () => {
            if (!deferredInstallPrompt) {
                return;
            }

            deferredInstallPrompt.prompt();
            try {
                await deferredInstallPrompt.userChoice;
            } finally {
                deferredInstallPrompt = null;
                atualizarBotoesDeInstalacao();
            }
        });
    });

    document.querySelectorAll(UNINSTALL_BUTTON_SELECTOR).forEach((botao) => {
        botao.addEventListener("click", orientarDesinstalacaoDoAplicativo);
    });

    atualizarPeloModoDeExibicao();
}

function aplicativoEmModoInstalado() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
}

function aplicativoMarcadoComoInstalado() {
    try {
        return window.localStorage.getItem(APP_INSTALLED_STORAGE_KEY) === "true";
    } catch (error) {
        return false;
    }
}

function registrarAplicativoComoInstalado() {
    try {
        window.localStorage.setItem(APP_INSTALLED_STORAGE_KEY, "true");
    } catch (error) {
        // O botao ainda funciona em modo instalado mesmo sem armazenamento local.
    }
}

function removerMarcaDeAplicativoInstalado() {
    try {
        window.localStorage.removeItem(APP_INSTALLED_STORAGE_KEY);
    } catch (error) {
        // Sem armazenamento local, o estado volta a ser inferido pelo navegador.
    }
}

function atualizarVisibilidadeDoBotaoInstalar(visivel) {
    document.querySelectorAll(INSTALL_BUTTON_SELECTOR).forEach((botao) => {
        botao.hidden = !visivel;
    });
}

function atualizarVisibilidadeDoBotaoDesinstalar(visivel) {
    document.querySelectorAll(UNINSTALL_BUTTON_SELECTOR).forEach((botao) => {
        botao.hidden = !visivel;
    });
}

function atualizarBotoesDeInstalacao() {
    const instalado = aplicativoEmModoInstalado() || aplicativoMarcadoComoInstalado();
    atualizarVisibilidadeDoBotaoInstalar(Boolean(deferredInstallPrompt) && !instalado);
    atualizarVisibilidadeDoBotaoDesinstalar(instalado);
}

function orientarDesinstalacaoDoAplicativo() {
    fecharModalConfiguracoes({ restaurarFoco: false });
    mostrarToast({
        variant: "info",
        title: "Desinstalar aplicativo",
        message: "Abra o menu do app ou do navegador e escolha a opcao de desinstalar/remover o Almoxarifado.",
        duration: 9000
    });
}

function ambientePermiteServiceWorker() {
    // Permite testes de desenvolvimento sem restringir o service worker ao localhost.
    return "serviceWorker" in navigator;
}

function registrarServiceWorker() {
    if (!ambientePermiteServiceWorker()) {
        return;
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (recarregouPorAtualizacaoDoServiceWorker) {
            return;
        }

        recarregouPorAtualizacaoDoServiceWorker = true;
        window.location.reload();
    });

    window.addEventListener("load", async () => {
        try {
            await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
        } catch (error) {
            console.warn("Não foi possível registrar o modo offline.");
        }
    });
}

async function solicitarPersistenciaDeArmazenamento() {
    if (!navigator.storage || typeof navigator.storage.persist !== "function") {
        return;
    }

    try {
        const storagePersistente = await navigator.storage.persisted();
        if (!storagePersistente) {
            await navigator.storage.persist();
        }
    } catch (error) {
        console.warn("Não foi possível solicitar armazenamento persistente.");
    }
}

function criarRegiaoDeToasts() {
    if (document.getElementById(TOAST_REGION_ID)) {
        return document.getElementById(TOAST_REGION_ID);
    }

    if (!document.body) {
        if (!toastRegionCreationScheduled) {
            toastRegionCreationScheduled = true;
            document.addEventListener("DOMContentLoaded", () => {
                toastRegionCreationScheduled = false;
                criarRegiaoDeToasts();
            }, { once: true });
        }

        return null;
    }

    const regiao = document.createElement("div");
    regiao.id = TOAST_REGION_ID;
    regiao.className = "toast-region";
    regiao.setAttribute("aria-live", "polite");
    regiao.setAttribute("aria-atomic", "false");
    document.body.appendChild(regiao);
    return regiao;
}

function obterRegiaoDeToasts() {
    return document.getElementById(TOAST_REGION_ID) || criarRegiaoDeToasts();
}

function tornarToastVisivel(toast) {
    if (!(toast instanceof HTMLElement) || !toast.isConnected) {
        return;
    }

    toast.classList.add("is-visible");
}

function agendarExibicaoToast(toast) {
    if (!(toast instanceof HTMLElement)) {
        return;
    }

    if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                tornarToastVisivel(toast);
            });
        });
    } else {
        window.setTimeout(() => {
            tornarToastVisivel(toast);
        }, 16);
    }

    window.setTimeout(() => {
        tornarToastVisivel(toast);
    }, 60);
}

function mostrarToast({
    variant = "info",
    title = "Aviso",
    message = "",
    duration = TOAST_DEFAULT_DURATION,
    dismissible = true
} = {}) {
    const regiao = obterRegiaoDeToasts();
    if (!regiao) {
        return;
    }

    const toastId = `toast-${++toastSequence}`;
    const toast = document.createElement("article");
    toast.className = `toast toast-${variant}`;
    toast.id = toastId;
    toast.setAttribute("role", variant === "danger" || variant === "warning" ? "alert" : "status");

    const texto = document.createElement("div");
    texto.className = "toast-copy";

    const titulo = document.createElement("strong");
    titulo.className = "toast-title";
    titulo.textContent = title;

    texto.appendChild(titulo);

    if (message) {
        const mensagem = document.createElement("p");
        mensagem.className = "toast-message";
        mensagem.textContent = message;
        texto.appendChild(mensagem);
    }

    toast.appendChild(texto);

    if (dismissible) {
        const fechar = document.createElement("button");
        fechar.type = "button";
        fechar.className = "toast-close";
        fechar.setAttribute("aria-label", `Fechar aviso ${title}`);
        fechar.textContent = "x";
        fechar.addEventListener("click", () => removerToast(toast));
        toast.appendChild(fechar);
    }

    regiao.appendChild(toast);
    agendarExibicaoToast(toast);

    if (duration > 0) {
        window.setTimeout(() => {
            removerToast(toast);
        }, duration);
    }
}

function removerToast(toast) {
    if (!(toast instanceof HTMLElement) || !toast.isConnected) {
        return;
    }

    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");

    window.setTimeout(() => {
        if (toast.isConnected) {
            toast.remove();
        }
    }, 220);
}
