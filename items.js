const DB_NAME = "AlmoxarifadoDB";
const STORE_SAIDAS = "saidas";
const STORE_ITENS = "itens_cadastro";
const ITEM_PAGE_CONTEXT_KEY = "almox_item_page_context";

let db;
let catalogoItens = [];
let contextoPagina = consumirContextoPagina();
let resolverModalAtencao = null;
let ultimoElementoFocadoAtencao = null;

const formCadastroItem = document.getElementById("formCadastroItem");
const inputCadCodigo = document.getElementById("cadCodigo");
const inputCadCodigoOriginal = document.getElementById("cadCodigoOriginal");
const inputCadDescricao = document.getElementById("cadDescricao");
const inputCadCodigoOriginalMaterial = document.getElementById("cadCodigoOriginalMaterial");
const inputCadLocalizacao = document.getElementById("cadLocalizacao");
const inputCadMinimo = document.getElementById("cadMinimo");
const inputCadMaximo = document.getElementById("cadMaximo");
const inputCadSaldo = document.getElementById("cadSaldo");
const inputBuscaItemCatalogo = document.getElementById("buscaItemCatalogo");
const listaItensCadastrados = document.getElementById("listaItensCadastrados");
const contadorItensCatalogo = document.getElementById("contadorItensCatalogo");
const btnSalvarItem = document.getElementById("btnSalvarItem");
const btnCancelarEdicaoItem = document.getElementById("btnCancelarEdicaoItem");
const linkVoltarSaidas = document.getElementById("linkVoltarSaidas");
const subtituloPaginaItens = document.getElementById("subtituloPaginaItens");
const mensagemPaginaItens = document.getElementById("mensagemPaginaItens");
const modalAtencao = document.getElementById("modalAtencao");
const modalAtencaoCard = document.querySelector("#modalAtencao .modal-critical-card");
const modalAtencaoBadge = document.getElementById("modalAtencaoBadge");
const modalAtencaoTitulo = document.getElementById("modalAtencaoTitulo");
const modalAtencaoMensagem = document.getElementById("modalAtencaoMensagem");
const modalAtencaoDetalhe = document.getElementById("modalAtencaoDetalhe");
const btnModalAtencaoCancelar = document.getElementById("btnModalAtencaoCancelar");
const btnModalAtencaoConfirmar = document.getElementById("btnModalAtencaoConfirmar");
const modalAtencaoAcoes = document.querySelector("#modalAtencao .modal-critical-actions");

inicializarPagina();

function inicializarPagina() {
    configurarNavegacaoOrigem();
    inicializarEventos();
    inicializarBanco();
}

function consumirContextoPagina() {
    try {
        const raw = sessionStorage.getItem(ITEM_PAGE_CONTEXT_KEY);
        sessionStorage.removeItem(ITEM_PAGE_CONTEXT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function configurarNavegacaoOrigem() {
    const destino = typeof contextoPagina?.returnUrl === "string" && contextoPagina.returnUrl.trim()
        ? contextoPagina.returnUrl.trim()
        : "index.html";

    linkVoltarSaidas.href = destino;

    if (contextoPagina?.cadastroRapido && contextoPagina.codigo) {
        subtituloPaginaItens.textContent = `Cadastro rápido para o código ${contextoPagina.codigo}. Salve o item para voltar ao almoxarifado.`;
    }
}

function inicializarEventos() {
    document.addEventListener("keydown", tratarTecladoModalAtencao);
    definirEstadoModal(modalAtencao, false);
    const renderizarCatalogoComDebounce = criarDebounce(() => {
        renderizarListaItens();
    }, 120);

    inputBuscaItemCatalogo.addEventListener("input", () => {
        renderizarCatalogoComDebounce();
    });

    btnCancelarEdicaoItem.addEventListener("click", () => {
        resetarFormularioItem();
        definirMensagem("");
        focarCampo(inputCadCodigo, { selecionar: true });
    });

    formCadastroItem.addEventListener("submit", (event) => {
        event.preventDefault();
        salvarItemCatalogo();
    });

    btnModalAtencaoCancelar.addEventListener("click", () => {
        fecharModalAtencao(false);
    });

    btnModalAtencaoConfirmar.addEventListener("click", () => {
        fecharModalAtencao(true);
    });

    modalAtencao.addEventListener("click", (event) => {
        if (event.target === modalAtencao) {
            fecharModalAtencao(false);
        }
    });

    inputCadCodigo.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
            return;
        }

        event.preventDefault();

        if (!inputCadCodigo.value.trim()) {
            focarCampo(inputCadCodigo, { selecionar: true });
            return;
        }

        focarCampo(inputCadDescricao, { selecionar: true });
    });

    inputCadDescricao.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
            return;
        }

        event.preventDefault();
        formCadastroItem.requestSubmit();
    });
}

function inicializarBanco() {
    const request = indexedDB.open(DB_NAME, 4);

    request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const oldVersion = event.oldVersion;

        // Criar stores se não existirem
        let storeSaidas, storeItens;

        if (!database.objectStoreNames.contains(STORE_SAIDAS)) {
            storeSaidas = database.createObjectStore(STORE_SAIDAS, { keyPath: "id", autoIncrement: true });
        } else {
            storeSaidas = event.target.transaction.objectStore(STORE_SAIDAS);
        }

        if (!database.objectStoreNames.contains(STORE_ITENS)) {
            storeItens = database.createObjectStore(STORE_ITENS, { keyPath: "codigo" });
        } else {
            storeItens = event.target.transaction.objectStore(STORE_ITENS);
        }

        // Adicionar índices para melhor performance (versão 4)
        if (oldVersion < 4) {
            // Índices para saídas
            if (!storeSaidas.indexNames.contains("frota")) {
                storeSaidas.createIndex("frota", "frota", { unique: false });
            }
            if (!storeSaidas.indexNames.contains("codigo")) {
                storeSaidas.createIndex("codigo", "codigo", { unique: false });
            }
            if (!storeSaidas.indexNames.contains("data")) {
                storeSaidas.createIndex("data", "data", { unique: false });
            }
            if (!storeSaidas.indexNames.contains("atualizadoEm")) {
                storeSaidas.createIndex("atualizadoEm", "atualizadoEm", { unique: false });
            }

            // Índices para itens
            if (!storeItens.indexNames.contains("descricao")) {
                storeItens.createIndex("descricao", "descricao", { unique: false });
            }
            if (!storeItens.indexNames.contains("quantidade")) {
                storeItens.createIndex("quantidade", "quantidade", { unique: false });
            }
            if (!storeItens.indexNames.contains("atualizadoEm")) {
                storeItens.createIndex("atualizadoEm", "atualizadoEm", { unique: false });
            }
        }
    };

    request.onsuccess = async (event) => {
        db = event.target.result;
        await carregarCatalogo();

        if (aplicarContextoInicial()) {
            return;
        }

        focarCampo(inputCadCodigo, { selecionar: true });
    };

    request.onerror = () => {
        mostrarAvisoCritico({
            variant: "danger",
            badge: "Falha crítica",
            titulo: "Banco de dados indisponível",
            mensagem: "Não foi possível abrir o banco de dados do navegador.",
            detalhe: "Recarregue a página. Se o problema continuar, verifique as permissões de armazenamento do navegador."
        });
    };

    request.onblocked = () => {
        mostrarAvisoCritico({
            variant: "danger",
            badge: "Falha crítica",
            titulo: "Banco de dados bloqueado",
            mensagem: "Outra aba ou janela está usando a base de dados e impede a atualização.",
            detalhe: "Feche outras abas do aplicativo e recarregue para continuar."
        });
    };
}

function executarTransacao(storeName, mode) {
    if (!db) {
        throw new Error("Banco de dados ainda não inicializado.");
    }

    return db.transaction(storeName, mode).objectStore(storeName);
}

function obterElementoFocadoSeguro() {
    return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function manterFocoNoModal(event, modal) {
    const elementosFocaveis = Array.from(
        modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((elemento) => !elemento.disabled && elemento.offsetParent !== null);

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

function abrirModalAtencao({
    variant = "warning",
    badge = "Atenção total",
    titulo = "Confirmar ação",
    mensagem = "",
    detalhe = "",
    textoConfirmar = "Continuar",
    textoCancelar = "Cancelar",
    mostrarCancelar = true,
    focoInicial = "confirmar"
} = {}) {
    modalAtencaoCard.dataset.variant = variant;
    modalAtencaoBadge.textContent = badge;
    modalAtencaoTitulo.textContent = titulo;
    modalAtencaoMensagem.textContent = mensagem;
    modalAtencaoDetalhe.textContent = detalhe;
    modalAtencaoDetalhe.hidden = !detalhe;
    btnModalAtencaoConfirmar.textContent = textoConfirmar;
    btnModalAtencaoCancelar.textContent = textoCancelar;
    btnModalAtencaoCancelar.hidden = !mostrarCancelar;
    modalAtencaoAcoes.classList.toggle("is-single-action", !mostrarCancelar);
    ultimoElementoFocadoAtencao = obterElementoFocadoSeguro();
    definirEstadoModal(modalAtencao, true);

    const alvoFoco = focoInicial === "cancelar" && mostrarCancelar
        ? btnModalAtencaoCancelar
        : btnModalAtencaoConfirmar;

    alvoFoco.focus();

    return new Promise((resolve) => {
        resolverModalAtencao = resolve;
    });
}

function fecharModalAtencao(resultado) {
    if (modalAtencao.style.display !== "flex") {
        return;
    }

    definirEstadoModal(modalAtencao, false);

    if (ultimoElementoFocadoAtencao instanceof HTMLElement && document.body.contains(ultimoElementoFocadoAtencao)) {
        ultimoElementoFocadoAtencao.focus();
    }

    ultimoElementoFocadoAtencao = null;

    const resolve = resolverModalAtencao;
    resolverModalAtencao = null;

    if (typeof resolve === "function") {
        resolve(resultado);
    }
}

function mostrarAvisoCritico({
    variant = "warning",
    badge = "Atenção total",
    titulo = "Aviso importante",
    mensagem = "",
    detalhe = "",
    textoConfirmar = "Entendi"
} = {}) {
    return abrirModalAtencao({
        variant,
        badge,
        titulo,
        mensagem,
        detalhe,
        textoConfirmar,
        mostrarCancelar: false
    });
}

function confirmarAcaoCritica({
    variant = "danger",
    badge = "Confirmação crítica",
    titulo = "Confirmar ação",
    mensagem = "",
    detalhe = "",
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar",
    focoInicial = "cancelar"
} = {}) {
    return abrirModalAtencao({
        variant,
        badge,
        titulo,
        mensagem,
        detalhe,
        textoConfirmar,
        textoCancelar,
        mostrarCancelar: true,
        focoInicial
    });
}

function tratarTecladoModalAtencao(event) {
    if (modalAtencao.style.display !== "flex" || event.defaultPrevented || event.isComposing) {
        return;
    }

    if (event.key === "Tab") {
        manterFocoNoModal(event, modalAtencao);
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        fecharModalAtencao(false);
        return;
    }

    if (event.key !== "Enter" || event.shiftKey) {
        return;
    }

    event.preventDefault();

    if (document.activeElement === btnModalAtencaoCancelar) {
        fecharModalAtencao(false);
        return;
    }

    fecharModalAtencao(true);
}

function definirMensagem(texto, tipo = "", { toast = false, toastTitle = "Aviso" } = {}) {
    mensagemPaginaItens.textContent = texto;
    mensagemPaginaItens.className = "page-status";

    if (tipo) {
        mensagemPaginaItens.classList.add(`is-${tipo}`);
    }

    if (toast && texto) {
        window.mostrarToast?.({
            variant: tipo || "info",
            title: toastTitle,
            message: texto
        });
    }
}

function carregarCatalogo() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(STORE_ITENS, "readonly");
            const store = transaction.objectStore(STORE_ITENS);
            const request = store.getAll();

            request.onsuccess = (event) => {
                catalogoItens = event.target.result.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
                renderizarListaItens();
                resolve(catalogoItens);
            };

            request.onerror = (event) => {
                console.error("Erro ao carregar catálogo:", event.target.error);
                reject(event.target.error);
            };

            transaction.onerror = (event) => {
                console.error("Erro na transação do catálogo:", event.target.error);
                reject(event.target.error);
            };

        } catch (error) {
            console.error("Erro geral ao carregar catálogo:", error);
            reject(error);
        }
    });
}

function carregarSaidas() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(STORE_SAIDAS, "readonly");
            const store = transaction.objectStore(STORE_SAIDAS);
            const request = store.getAll();

            request.onsuccess = (event) => {
                const saidas = event.target.result.sort((a, b) => (a.id || 0) - (b.id || 0));
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
            console.error("Erro geral ao carregar saídas:", error);
            reject(error);
        }
    });
}

function filtrarCatalogo() {
    const termo = normalizarBusca(inputBuscaItemCatalogo.value);

    if (!termo) {
        return catalogoItens;
    }

    return catalogoItens.filter((item) => {
        const baseBusca = [item.codigo, item.descricao, item.localizacao].join(" ");
        return normalizarBusca(baseBusca).includes(termo);
    });
}

function salvarItemCatalogo() {
    const codigo = inputCadCodigo.value.toUpperCase().trim();
    const descricao = inputCadDescricao.value.toUpperCase().trim();
    const codigoOriginal = inputCadCodigoOriginal.value.toUpperCase().trim();
    const codigoOriginalMaterial = inputCadCodigoOriginalMaterial.value.toUpperCase().trim();
    const localizacao = inputCadLocalizacao.value.toUpperCase().trim();
    const minimo = inputCadMinimo.value ? parseInt(inputCadMinimo.value, 10) : 0;
    const maximo = inputCadMaximo.value ? parseInt(inputCadMaximo.value, 10) : 0;
    const saldo = inputCadSaldo.value ? parseInt(inputCadSaldo.value, 10) : 0;
    const itemExistente = catalogoItens.find((item) => item.codigo === codigo);

    if (!codigo || !descricao) {
        definirMensagem("Preencha código e descrição para salvar.", "warning", {
            toast: true,
            toastTitle: "Campos incompletos"
        });
        return;
    }

    if (itemExistente && itemExistente.codigo !== codigoOriginal) {
        definirMensagem(`O código ${codigo} já existe no catálogo.`, "warning", {
            toast: true,
            toastTitle: "Código duplicado"
        });
        focarCampo(inputCadCodigo, { selecionar: true });
        return;
    }

    const agora = new Date().toISOString();
    const tx = db.transaction(STORE_ITENS, "readwrite");
    const store = tx.objectStore(STORE_ITENS);
    const itemOriginal = catalogoItens.find((item) => item.codigo === codigoOriginal);

    if (codigoOriginal && codigoOriginal !== codigo) {
        store.delete(codigoOriginal);
    }

    store.put({
        codigo,
        descricao,
        codigoOriginalMaterial,
        localizacao,
        minimo,
        maximo,
        saldo,
        criadoEm: itemOriginal?.criadoEm || agora,
        atualizadoEm: agora
    });

    tx.oncomplete = async () => {
        await carregarCatalogo();

        if (contextoPagina?.cadastroRapido && contextoPagina.returnUrl) {
            redirecionarParaOrigem(codigo);
            return;
        }

        resetarFormularioItem();
        definirMensagem(`Item ${codigo} salvo com sucesso.`, "success", {
            toast: true,
            toastTitle: "Item salvo"
        });
        focarCampo(inputCadCodigo, { selecionar: true });
    };

    tx.onerror = () => {
        definirMensagem("Não foi possível salvar o item agora.", "warning", {
            toast: true,
            toastTitle: "Falha ao salvar"
        });
    };
}

function aplicarContextoInicial() {
    const codigoContexto = normalizarBusca(contextoPagina?.codigo);

    if (!codigoContexto) {
        return false;
    }

    const itemExistente = catalogoItens.find((item) => item.codigo === codigoContexto);

    if (itemExistente) {
        prepararEdicaoItemCatalogo(itemExistente.codigo);
        definirMensagem(`O código ${itemExistente.codigo} já existe. Você pode atualizar os dados e salvar novamente.`, "warning");
        focarCampo(contextoPagina?.cadastroRapido ? inputCadDescricao : inputCadCodigo, {
            selecionar: !contextoPagina?.cadastroRapido
        });
        return true;
    }

    inputCadCodigo.value = codigoContexto;

    if (contextoPagina?.cadastroRapido) {
        definirMensagem(`Cadastro rápido iniciado para o código ${codigoContexto}.`, "info", {
            toast: true,
            toastTitle: "Cadastro rápido"
        });
        focarCampo(inputCadDescricao, { selecionar: true });
        return true;
    }

    focarCampo(inputCadCodigo, { selecionar: true });
    return true;
}

function redirecionarParaOrigem(codigo) {
    const destino = new URL(contextoPagina.returnUrl, window.location.href);
    destino.searchParams.set("item", codigo);
    window.location.href = destino.toString();
}

function abrirCadastroPelasConfiguracoes() {
    window.fecharModalConfiguracoes?.();
    resetarFormularioItem();
    definirMensagem("");
    focarCampo(inputCadCodigo, { selecionar: true });
}

function abrirBuscaPelasConfiguracoes() {
    window.fecharModalConfiguracoes?.();
    focarCampo(inputBuscaItemCatalogo, { selecionar: true });
}

function resetarFormularioItem() {
    formCadastroItem.reset();
    inputCadCodigoOriginal.value = "";
    btnSalvarItem.textContent = "Salvar";
    btnSalvarItem.className = "btn-add";
    btnCancelarEdicaoItem.hidden = true;
}

function prepararEdicaoItemCatalogo(codigo) {
    const item = catalogoItens.find((registro) => registro.codigo === codigo);

    if (!item) {
        return;
    }

    inputCadCodigoOriginal.value = item.codigo;
    inputCadCodigo.value = item.codigo;
    inputCadDescricao.value = item.descricao;
    inputCadCodigoOriginalMaterial.value = item.codigoOriginalMaterial || "";
    inputCadLocalizacao.value = item.localizacao || "";
    inputCadMinimo.value = item.minimo || "";
    inputCadMaximo.value = item.maximo || "";
    inputCadSaldo.value = item.saldo || "";
    btnSalvarItem.textContent = "Atualizar";
    btnSalvarItem.className = "btn-update";
    btnCancelarEdicaoItem.hidden = false;
    focarCampo(inputCadCodigo, { selecionar: true });
}

function renderizarListaItens() {
    const itensFiltrados = filtrarCatalogo();
    contadorItensCatalogo.textContent = formatarContagem(itensFiltrados.length, "item", "itens");
    listaItensCadastrados.innerHTML = "";

    if (!itensFiltrados.length) {
        listaItensCadastrados.innerHTML = '<div class="scrollable-empty">Nenhum item encontrado.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    itensFiltrados.forEach((item) => {
        const linha = document.createElement("div");
        linha.className = "item-cadastrado";

        const info = document.createElement("div");
        info.className = "item-info";
        info.innerHTML = `
            <strong>${escapeHtml(item.codigo)}</strong>
            <span>${escapeHtml(item.descricao)}</span>
            <small>Localização: ${escapeHtml(item.localizacao || "N/A")} | Saldo: ${item.saldo || 0}</small>
        `;

        const actions = document.createElement("div");
        actions.className = "item-actions";

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-icon";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => {
            prepararEdicaoItemCatalogo(item.codigo);
            definirMensagem(`Editando o item ${item.codigo}.`, "warning");
        });

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-icon";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => {
            deletarItemCatalogo(item.codigo);
        });

        actions.appendChild(btnEditar);
        actions.appendChild(btnExcluir);
        linha.appendChild(info);
        linha.appendChild(actions);
        fragment.appendChild(linha);
    });

    listaItensCadastrados.appendChild(fragment);
}

async function deletarItemCatalogo(codigo) {
    const confirmou = await confirmarAcaoCritica({
        variant: "danger",
        badge: "Remoção permanente",
        titulo: "Excluir item do catálogo",
        mensagem: `Deseja remover o código ${codigo} do catálogo?`,
        detalhe: "Essa ação exclui o item das pesquisas do sistema e exige um novo cadastro para voltar ao catálogo.",
        textoConfirmar: "Excluir item"
    });

    if (!confirmou) {
        return;
    }

    const store = executarTransacao(STORE_ITENS, "readwrite");
    const deleteRequest = store.delete(codigo);

    deleteRequest.onsuccess = async () => {
        if (inputCadCodigoOriginal.value === codigo) {
            resetarFormularioItem();
        }

        await carregarCatalogo();
        definirMensagem(`Item ${codigo} removido do catálogo.`, "success", {
            toast: true,
            toastTitle: "Item removido"
        });
        focarCampo(inputCadCodigo, { selecionar: true });
    };

    deleteRequest.onerror = () => {
        console.error("Erro ao deletar item:", deleteRequest.error);
        definirMensagem("Não foi possível remover o item agora.", "warning", {
            toast: true,
            toastTitle: "Falha ao remover"
        });
    };
}

async function exportarTodosDados() {
    try {
        if (!db) {
            throw new Error("Banco de dados ainda não inicializado. Tente novamente em alguns segundos.");
        }

        const [saidas, itens] = await Promise.all([
            carregarSaidas(),
            carregarCatalogo()
        ]);

        const dadosExportacao = {
            saidas,
            itens,
            versao: "1.0",
            dataExportacao: new Date().toISOString(),
            aplicacao: "Almox Project"
        };

        const json = JSON.stringify(dadosExportacao, null, 2);
        const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Almox_Project_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);

        definirMensagem(`${formatarContagem(saidas.length, "saída", "saídas")} e ${formatarContagem(itens.length, "item", "itens")} exportados.`, "info", {
            toast: true,
            toastTitle: "Exportação concluída"
        });
    } catch (error) {
        console.error("Erro ao exportar dados:", error);
        definirMensagem("Não foi possível exportar os dados.", "warning", {
            toast: true,
            toastTitle: "Erro na exportação"
        });
    }
}

async function importarDados() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        try {
            if (!db) {
                throw new Error("Banco de dados ainda não inicializado. Tente novamente em alguns segundos.");
            }

            const text = await file.text();
            const dadosImportacao = JSON.parse(text);

            if (!dadosImportacao.saidas || !dadosImportacao.itens || !Array.isArray(dadosImportacao.saidas) || !Array.isArray(dadosImportacao.itens)) {
                throw new Error("Arquivo inválido: estrutura incorreta. Deve conter arrays 'saidas' e 'itens'.");
            }

            for (const saida of dadosImportacao.saidas) {
                if (typeof saida !== "object" || !saida.frota || !saida.codigo || typeof saida.qtd !== "number") {
                    throw new Error("Dados de saída inválidos: cada saída deve ter 'frota', 'codigo' e 'qtd' (número).");
                }
            }

            for (const item of dadosImportacao.itens) {
                if (typeof item !== "object" || !item.codigo || !item.descricao) {
                    throw new Error("Dados de item inválidos: cada item deve ter 'codigo' e 'descricao'.");
                }
            }

            const confirmou = await confirmarAcaoCritica({
                variant: "warning",
                badge: "Importação de dados",
                titulo: "Importar dados do backup",
                mensagem: `Deseja importar ${formatarContagem(dadosImportacao.saidas.length, "saída", "saídas")} e ${formatarContagem(dadosImportacao.itens.length, "item", "itens")}?`,
                detalhe: "Os dados atuais serão substituídos pelos dados do arquivo. Esta ação não pode ser desfeita.",
                textoConfirmar: "Importar dados"
            });

            if (!confirmou) {
                return;
            }

            const transaction = db.transaction([STORE_SAIDAS, STORE_ITENS], "readwrite");
            const storeSaidas = transaction.objectStore(STORE_SAIDAS);
            const storeItens = transaction.objectStore(STORE_ITENS);

            await Promise.all([
                new Promise((resolve) => {
                    storeSaidas.clear().onsuccess = resolve;
                }),
                new Promise((resolve) => {
                    storeItens.clear().onsuccess = resolve;
                })
            ]);

            const saidasPromises = dadosImportacao.saidas.map((saida) => {
                return new Promise((resolve, reject) => {
                    const request = storeSaidas.put(saida);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(new Error(`Erro ao importar saída: ${saida.id || "sem id"}`));
                });
            });

            const itensPromises = dadosImportacao.itens.map((item) => {
                return new Promise((resolve, reject) => {
                    const request = storeItens.put(item);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(new Error(`Erro ao importar item: ${item.codigo}`));
                });
            });

            await Promise.all([...saidasPromises, ...itensPromises]);
            await new Promise((resolve) => {
                transaction.oncomplete = resolve;
            });

            resetarFormularioItem();
            await carregarCatalogo();
            aplicarContextoInicial();

            definirMensagem(`${formatarContagem(dadosImportacao.itens.length, "item", "itens")} e ${formatarContagem(dadosImportacao.saidas.length, "saída", "saídas")} importados.`, "success", {
                toast: true,
                toastTitle: "Importação concluída"
            });
        } catch (error) {
            console.error("Erro ao importar dados:", error);
            definirMensagem(error.message || "Não foi possível importar os dados.", "warning", {
                toast: true,
                toastTitle: "Erro na importação"
            });
        }
    };

    input.click();
}

async function restaurarBackupAutomatico() {
    try {
        if (!db) {
            throw new Error("Banco de dados ainda não inicializado. Tente novamente em alguns segundos.");
        }

        const backupJson = localStorage.getItem("almox_backup_auto");
        if (!backupJson) {
            definirMensagem("Nenhum backup automático foi encontrado.", "warning", {
                toast: true,
                toastTitle: "Backup não encontrado"
            });
            return;
        }

        const dadosBackup = JSON.parse(backupJson);

        if (!dadosBackup.saidas || !dadosBackup.itens || !Array.isArray(dadosBackup.saidas) || !Array.isArray(dadosBackup.itens)) {
            throw new Error("Backup inválido ou corrompido.");
        }

        const dataBackup = new Date(dadosBackup.dataBackup);
        const diasAtras = Math.floor((new Date() - dataBackup) / (1000 * 60 * 60 * 24));

        const confirmou = await confirmarAcaoCritica({
            variant: "warning",
            badge: "Restaurar backup",
            titulo: "Restaurar backup automático",
            mensagem: `Deseja restaurar o backup de ${formatarContagem(diasAtras, "dia", "dias")} atrás?`,
            detalhe: `Backup criado em: ${dataBackup.toLocaleString()}\nContém: ${formatarContagem(dadosBackup.saidas.length, "saída", "saídas")} e ${formatarContagem(dadosBackup.itens.length, "item", "itens")}\n\nOs dados atuais serão substituídos.`,
            textoConfirmar: "Restaurar backup"
        });

        if (!confirmou) {
            return;
        }

        const transaction = db.transaction([STORE_SAIDAS, STORE_ITENS], "readwrite");
        const storeSaidas = transaction.objectStore(STORE_SAIDAS);
        const storeItens = transaction.objectStore(STORE_ITENS);

        await Promise.all([
            new Promise((resolve) => {
                storeSaidas.clear().onsuccess = resolve;
            }),
            new Promise((resolve) => {
                storeItens.clear().onsuccess = resolve;
            })
        ]);

        for (const saida of dadosBackup.saidas) {
            storeSaidas.add(saida);
        }

        for (const item of dadosBackup.itens) {
            storeItens.add(item);
        }

        await new Promise((resolve) => {
            transaction.oncomplete = resolve;
        });

        resetarFormularioItem();
        await carregarCatalogo();
        aplicarContextoInicial();

        definirMensagem(`Backup restaurado com ${formatarContagem(dadosBackup.itens.length, "item", "itens")} e ${formatarContagem(dadosBackup.saidas.length, "saída", "saídas")}.`, "success", {
            toast: true,
            toastTitle: "Backup restaurado"
        });
    } catch (error) {
        console.error("Erro ao restaurar backup:", error);
        definirMensagem(error.message || "Não foi possível restaurar o backup.", "warning", {
            toast: true,
            toastTitle: "Erro na restauração"
        });
    }
}

window.abrirCadastroPelasConfiguracoes = abrirCadastroPelasConfiguracoes;
window.abrirBuscaPelasConfiguracoes = abrirBuscaPelasConfiguracoes;
window.exportarTodosDados = exportarTodosDados;
window.importarDados = importarDados;
window.restaurarBackupAutomatico = restaurarBackupAutomatico;
