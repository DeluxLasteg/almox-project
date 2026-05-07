const DB_NAME = "AlmoxarifadoDB";
const STORE_SAIDAS = "saidas";
const ITEM_PAGE_PATH = "itens.html";
const APP_THEME_META_COLOR = document.querySelector('meta[name="theme-color"]');
const TOAST_REGION_ID = "toastRegion";
const TOAST_DEFAULT_DURATION = 4200;
const SETTINGS_MODAL_ID = "modalConfiguracoes";
const SETTINGS_OPEN_SELECTOR = "[data-settings-open]";
const SETTINGS_CLOSE_SELECTOR = "[data-settings-close]";
const ZONA_ATIVACAO_MENU_LARGURA = 50; // pixels para ativar menu no lado direito

let db;
let saidas = [];
let deferredInstallPrompt = null;
let toastSequence = 0;
let toastRegionCreationScheduled = false;
let ultimoElementoFocadoConfiguracoes = null;
let mouseNaZonaMenu = false;
let mouseSobreMenu = false;

const inputBuscaRelatorio = document.getElementById("buscaRelatorio");
const btnExportarRelatorio = document.getElementById("btnExportarRelatorio");
const statRegistros = document.getElementById("statRegistros");
const statQuantidade = document.getElementById("statQuantidade");
const statFrotas = document.getElementById("statFrotas");
const relatorioMensagem = document.getElementById("relatorioMensagem");
const topItensLista = document.getElementById("topItensLista");
const contadorSaidas = document.getElementById("contadorSaidas");
const corpoTabelaSaidas = document.getElementById("corpoTabelaSaidas");
const modalConfiguracoes = document.getElementById(SETTINGS_MODAL_ID);

inicializarAplicacaoBase();

function inicializarAplicacaoBase() {
    criarRegiaoDeToasts();
    inicializarModalConfiguracoes();
    atualizarCorDoTemaNoChrome();
    observarMudancasDeTema();
    registrarServiceWorker();
    solicitarPersistenciaDeArmazenamento();
    window.mostrarToast = mostrarToast;
    window.abrirModalConfiguracoes = abrirModalConfiguracoes;
    window.fecharModalConfiguracoes = fecharModalConfiguracoes;
    window.atualizarClasseGlobalDeModais = atualizarClasseGlobalDeModais;
}

function inicializarEventos() {
    document.addEventListener("keydown", tratarTecladoModalConfiguracoes, true);

    inputBuscaRelatorio.addEventListener("input", criarDebounce(() => {
        renderizarRelatorio();
    }, 120));

    btnExportarRelatorio.addEventListener("click", exportarCSV);
}

function inicializarBanco() {
    const request = indexedDB.open(DB_NAME, 5);

    request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const oldVersion = event.oldVersion;

        if (!database.objectStoreNames.contains(STORE_SAIDAS)) {
            database.createObjectStore(STORE_SAIDAS, { keyPath: "id", autoIncrement: true });
        }

        if (!database.objectStoreNames.contains("itens_cadastro")) {
            database.createObjectStore("itens_cadastro", { keyPath: "codigo" });
        }

        if (!database.objectStoreNames.contains("backup_saidas")) {
            database.createObjectStore("backup_saidas", { keyPath: "id" });
        }
    };

    request.onsuccess = async (event) => {
        db = event.target.result;
        await carregarDados();
        if (document.activeElement === document.body) {
            inputBuscaRelatorio.focus();
        }
        inicializarEventos();
    };

    request.onerror = () => {
        mostrarToast({
            variant: "danger",
            title: "Erro de banco",
            message: "Não foi possível abrir o banco de dados."
        });
    };
}

function carregarDados() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(STORE_SAIDAS, "readonly");
            const store = transaction.objectStore(STORE_SAIDAS);
            const request = store.getAll();

            request.onsuccess = (event) => {
                saidas = event.target.result.sort((a, b) => (a.id || 0) - (b.id || 0));
                renderizarRelatorio();
                resolve(saidas);
            };

            request.onerror = (event) => {
                console.error("Erro ao carregar saídas:", event.target.error);
                reject(event.target.error);
            };

            transaction.onerror = (event) => {
                console.error("Erro na transação de saídas:", event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            console.error("Erro geral ao carregar dados:", error);
            reject(error);
        }
    });
}

function filtrarSaidas() {
    const termo = normalizarBusca(inputBuscaRelatorio.value);

    if (!termo) {
        return saidas;
    }

    return saidas.filter((item) => {
        const baseBusca = [
            item.frota,
            item.codigo,
            item.desc,
            item.os,
            item.data,
            formatarDataExibicao(item)
        ].join(" ");

        return normalizarBusca(baseBusca).includes(termo);
    });
}

function renderizarRelatorio() {
    const listaFiltrada = filtrarSaidas();
    const totalRegistros = listaFiltrada.length;
    const totalQuantidade = listaFiltrada.reduce((sum, item) => sum + (item.qtd || 0), 0);
    const totalFrotas = new Set(listaFiltrada.map((item) => item.frota)).size;

    statRegistros.textContent = String(totalRegistros);
    statQuantidade.textContent = String(totalQuantidade);
    statFrotas.textContent = String(totalFrotas);

    relatorioMensagem.textContent = totalRegistros
        ? `Exibindo ${formatarContagem(totalRegistros, "registro", "registros")}.` 
        : "Nenhum registro encontrado para o filtro atual.";

    renderizarTopItens(listaFiltrada);
    renderizarTabelaSaidas(listaFiltrada);
}

function renderizarTopItens(lista) {
    const frequencias = lista.reduce((acc, item) => {
        const codigo = item.codigo || "-";
        const chave = `${codigo}::${item.desc || "-"}`;
        if (!acc[chave]) {
            acc[chave] = { codigo, descricao: item.desc || "Sem descrição", quantidade: 0 };
        }
        acc[chave].quantidade += item.qtd || 0;
        return acc;
    }, {});

    const topItens = Object.values(frequencias)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 8);

    topItensLista.innerHTML = topItens.length
        ? topItens.map((item) => `
            <div class="report-summary-card">
                <strong>${escapeHtml(item.codigo)}</strong>
                <p>${escapeHtml(item.descricao)}</p>
                <span>${formatarContagem(item.quantidade, "unidade", "unidades")}</span>
            </div>
        `).join("")
        : `<p class="empty-state">Não há dados suficientes para gerar o top de peças.</p>`;
}

function renderizarTabelaSaidas(lista) {
    contadorSaidas.textContent = formatarContagem(lista.length, "registro", "registros");

    corpoTabelaSaidas.innerHTML = lista.length
        ? lista.map((item) => `
            <tr>
                <td>${escapeHtml(item.frota)}</td>
                <td>${escapeHtml(item.codigo)}</td>
                <td>${escapeHtml(String(item.qtd || 0))}</td>
                <td>${escapeHtml(item.desc)}</td>
                <td>${escapeHtml(item.os || "")}</td>
                <td>${escapeHtml(formatarDataExibicao(item))}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="6" class="empty-state">Nenhuma saída encontrada.</td></tr>`;
}

async function exportarCSV() {
    const listaExportacao = filtrarSaidas();
    let csv = "Frota;Código;Quantidade;Descrição;OS;Data;Data de atualização\n";

    for (const item of listaExportacao) {
        csv += `${item.frota || ""};${item.codigo || ""};${item.qtd || 0};${item.desc || ""};${item.os || ""};${item.data || ""};${formatarDataExibicao(item)}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relatorio-saidas.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function inicializarMenuAcesso() {
    // Menu lateral é inicializado por app.js
}

function inicializarModalConfiguracoes() {
    if (!(modalConfiguracoes instanceof HTMLElement)) {
        return;
    }

    definirEstadoModal(modalConfiguracoes, false);

    modalConfiguracoes.querySelectorAll(SETTINGS_CLOSE_SELECTOR).forEach((botao) => {
        botao.addEventListener("click", () => {
            fecharModalConfiguracoes();
        });
    });

    modalConfiguracoes.addEventListener("click", (event) => {
        if (event.target === modalConfiguracoes) {
            fecharModalConfiguracoes();
        }
    });
}

function tratarTecladoModalConfiguracoes(event) {
    if (!(modalConfiguracoes instanceof HTMLElement) || !modalConfiguracoes.classList.contains("is-open")) {
        return;
    }

    if (event.key === "Tab") {
        event.stopPropagation();
        manterFocoNoModalBase(event, modalConfiguracoes);
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        fecharModalConfiguracoes();
    }
}

function abrirModalConfiguracoes() {
    if (!(modalConfiguracoes instanceof HTMLElement)) {
        return;
    }

    definirEstadoModal(modalConfiguracoes, true);
    focarPrimeiroControleDeConfiguracoes(modalConfiguracoes);
}

function fecharModalConfiguracoes() {
    if (!(modalConfiguracoes instanceof HTMLElement)) {
        return;
    }

    definirEstadoModal(modalConfiguracoes, false);
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

function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker.register('service-worker.js').catch(() => {
        console.warn('Falha ao registrar service worker.');
    });
}

function solicitarPersistenciaDeArmazenamento() {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {
            console.warn('Persistência de armazenamento não disponível.');
        });
    }
}

function criarRegiaoDeToasts() {
    if (document.getElementById(TOAST_REGION_ID)) {
        return;
    }

    const container = document.createElement('div');
    container.id = TOAST_REGION_ID;
    container.className = 'toast-region';
    document.body.appendChild(container);
}

function mostrarToast({ variant = 'info', title = '', message = '' } = {}) {
    const region = document.getElementById(TOAST_REGION_ID);
    if (!region) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
    region.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('toast-hidden');
    }, TOAST_DEFAULT_DURATION);
    window.setTimeout(() => {
        toast.remove();
    }, TOAST_DEFAULT_DURATION + 250);
}

function focarPrimeiroControleDeConfiguracoes(modal) {
    if (!(modal instanceof HTMLElement)) {
        return;
    }

    const alvoPreferencial = modal.querySelector("[data-settings-focus]");
    const alvo = alvoPreferencial instanceof HTMLElement ? alvoPreferencial : obterElementosFocaveis(modal)[0];
    alvo?.focus();
}

function atualizarClasseGlobalDeModais() {
    document.body.classList.toggle("has-modal-open", Boolean(document.querySelector(".modal.is-open")));
}

inicializarBanco();
