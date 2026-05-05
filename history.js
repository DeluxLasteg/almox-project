const DB_NAME = "AlmoxarifadoDB";
const STORE_SAIDAS = "saidas";

let db;
let saidas = [];

const inputBuscaHistorico = document.getElementById("buscaHistorico");
const btnExportarHistorico = document.getElementById("btnExportarHistorico");
const btnLimparHistorico = document.getElementById("btnLimparHistorico");
const statRegistros = document.getElementById("statRegistros");
const statQuantidade = document.getElementById("statQuantidade");
const statFrotas = document.getElementById("statFrotas");
const historicoMensagem = document.getElementById("historicoMensagem");
const contadorHistorico = document.getElementById("contadorHistorico");
const corpoTabelaHistorico = document.getElementById("corpoTabelaHistorico");

function inicializarHistorico() {
    inicializarBanco();
    inicializarEventos();
}

function inicializarEventos() {
    inputBuscaHistorico.addEventListener("input", criarDebounce(renderizarHistorico, 120));
    btnExportarHistorico.addEventListener("click", exportarCSV);
    btnLimparHistorico.addEventListener("click", limparHistorico);
}

function inicializarBanco() {
    const request = indexedDB.open(DB_NAME, 5);

    request.onupgradeneeded = (event) => {
        const database = event.target.result;
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
            inputBuscaHistorico.focus();
        }
    };

    request.onerror = () => {
        mostrarToast?.({
            variant: "danger",
            title: "Erro de banco",
            message: "Não foi possível abrir o banco de dados do navegador."
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
                renderizarHistorico();
                resolve(saidas);
            };

            request.onerror = (event) => {
                console.error("Erro ao carregar histórico:", event.target.error);
                reject(event.target.error);
            };

            transaction.onerror = (event) => {
                console.error("Erro na transação de histórico:", event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            console.error("Erro geral ao carregar histórico:", error);
            reject(error);
        }
    });
}

function filtrarSaidas() {
    const termo = normalizarBusca(inputBuscaHistorico.value);
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
            formatarDataExibicao(item),
            item.atualizadoEm ? new Date(item.atualizadoEm).toLocaleString("pt-BR") : ""
        ].join(" ");
        return normalizarBusca(baseBusca).includes(termo);
    });
}

function renderizarHistorico() {
    const listaFiltrada = filtrarSaidas();
    const totalRegistros = listaFiltrada.length;
    const totalQuantidade = listaFiltrada.reduce((sum, item) => sum + (item.qtd || 0), 0);
    const totalFrotas = new Set(listaFiltrada.map((item) => item.frota)).size;

    statRegistros.textContent = String(totalRegistros);
    statQuantidade.textContent = String(totalQuantidade);
    statFrotas.textContent = String(totalFrotas);
    contadorHistorico.textContent = formatarContagem(totalRegistros, "registro", "registros");

    historicoMensagem.textContent = totalRegistros
        ? `Exibindo ${formatarContagem(totalRegistros, "registro", "registros")}.`
        : "Nenhum registro encontrado para o filtro atual.";

    corpoTabelaHistorico.innerHTML = listaFiltrada.length
        ? listaFiltrada.map((item) => `
            <tr>
                <td>${escapeHtml(item.frota)}</td>
                <td>${escapeHtml(item.codigo)}</td>
                <td>${escapeHtml(String(item.qtd || 0))}</td>
                <td>${escapeHtml(item.desc)}</td>
                <td>${escapeHtml(item.os || "")}</td>
                <td>${escapeHtml(item.data || "")}</td>
                <td>${escapeHtml(formatarDataExibicao(item))}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="7" class="empty-state">Nenhuma saída encontrada.</td></tr>`;
}

function exportarCSV() {
    const listaExportacao = filtrarSaidas();
    let csv = "Frota;Código;Quantidade;Descrição;OS;Data;Atualizado em\n";
    listaExportacao.forEach((item) => {
        csv += `${item.frota || ""};${item.codigo || ""};${item.qtd || 0};${item.desc || ""};${item.os || ""};${item.data || ""};${formatarDataExibicao(item)}\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Almox_Project_Historico_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    mostrarToast?.({
        variant: "info",
        title: "Exportação concluída",
        message: `${formatarContagem(listaExportacao.length, "registro", "registros")} exportados.`
    });
}

function limparHistorico() {
    const confirmou = window.confirm("Deseja remover todo o histórico de saídas? Esta ação não pode ser desfeita.");
    if (!confirmou) {
        return;
    }

    try {
        const transaction = db.transaction(STORE_SAIDAS, "readwrite");
        const store = transaction.objectStore(STORE_SAIDAS);
        const clearRequest = store.clear();

        clearRequest.onsuccess = async () => {
            await carregarDados();
            mostrarToast?.({
                variant: "warning",
                title: "Histórico limpo",
                message: "Todas as saídas foram removidas do histórico."
            });
        };

        clearRequest.onerror = () => {
            console.error("Erro ao limpar histórico:", clearRequest.error);
            mostrarToast?.({
                variant: "danger",
                title: "Erro ao limpar",
                message: "Não foi possível limpar o histórico de saídas."
            });
        };
    } catch (error) {
        console.error("Erro ao limpar histórico:", error);
        mostrarToast?.({
            variant: "danger",
            title: "Erro ao limpar",
            message: error.message || "Não foi possível limpar o histórico."
        });
    }
}

inicializarHistorico();
