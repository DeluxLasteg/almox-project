const DB_NAME = "AlmoxarifadoDB";
const STORE_SAIDAS = "saidas";
const STORE_ITENS = "itens_cadastro";
const ITEM_PAGE_PATH = "itens.html";
const ITEM_PAGE_CONTEXT_KEY = "almox_item_page_context";
const SAIDA_DRAFT_STORAGE_KEY = "almox_saida_draft";

let db;
let saidas = [];
let catalogoItens = [];
let modalAberto = false;
let cadastroRapidoPendente = false;
let sugestoesVisiveis = [];
let indiceSugestaoAtiva = -1;
let ultimoElementoFocado = null;
let registroSaidaEmEdicao = null;
let resolverModalAtencao = null;
let saidasFiltradasAtuais = [];
let seletorFocoDetalhesFrotaPendente = null;
const frotasExpandidas = new Set();

const formSaida = document.getElementById("formSaida");
const formCadastroItem = document.getElementById("formCadastroItem");
const inputFrota = document.getElementById("frota");
const inputCodigo = document.getElementById("codigoPeca");
const inputQuantidade = document.getElementById("quantidade");
const inputDescricao = document.getElementById("descricao");
const inputOrdemServico = document.getElementById("ordemServico");
const inputBoxOrdemServico = document.getElementById("inputBoxOrdemServico");
const inputBuscaSaida = document.getElementById("buscaSaida");
const btnLimparBuscaSaida = document.getElementById("btnLimparBuscaSaida");
const inputCadCodigo = document.getElementById("cadCodigo");
const inputCadCodigoOriginal = document.getElementById("cadCodigoOriginal");
const inputCadDescricao = document.getElementById("cadDescricao");
const inputBuscaItemCatalogo = document.getElementById("buscaItemCatalogo");
const boxSugestao = document.getElementById("sugestaoItem");
const listaFrotas = document.getElementById("listaFrotas");
const listaImpressao = document.getElementById("listaImpressao");
const listaItensCadastrados = document.getElementById("listaItensCadastrados");
const modalItens = document.getElementById("modalItens");
const modalConfirmacao = document.getElementById("modalConfirmacao");
const modalAtencao = document.getElementById("modalAtencao");
const modalConfiguracoes = document.getElementById("modalConfiguracoes");
const btnSubmit = document.getElementById("btnSubmit");
const btnCancel = document.getElementById("btnCancel");
const btnSalvarItem = document.getElementById("btnSalvarItem");
const btnCancelarEdicaoItem = document.getElementById("btnCancelarEdicaoItem");
const btnConfirmCadastrar = document.getElementById("btnConfirmCadastrar");
const btnConfirmAvulso = document.getElementById("btnConfirmAvulso");
const tituloModalItens = document.getElementById("tituloModalItens");
const contadorItensCatalogo = document.getElementById("contadorItensCatalogo");
const statRegistros = document.getElementById("statRegistros");
const statQuantidade = document.getElementById("statQuantidade");
const statFrotas = document.getElementById("statFrotas");
const resumoBuscaSaida = document.getElementById("resumoBuscaSaida");
const modalAtencaoCard = document.querySelector("#modalAtencao .modal-critical-card");
const modalAtencaoBadge = document.getElementById("modalAtencaoBadge");
const modalAtencaoTitulo = document.getElementById("modalAtencaoTitulo");
const modalAtencaoMensagem = document.getElementById("modalAtencaoMensagem");
const modalAtencaoDetalhe = document.getElementById("modalAtencaoDetalhe");
const btnModalAtencaoCancelar = document.getElementById("btnModalAtencaoCancelar");
const btnModalAtencaoConfirmar = document.getElementById("btnModalAtencaoConfirmar");
const modalAtencaoAcoes = document.querySelector("#modalAtencao .modal-critical-actions");

inicializarEventos();
inicializarBanco();

function inicializarEventos() {
    document.addEventListener("keydown", tratarAtalhosTeclado);
    document.addEventListener("click", tratarCliqueForaDosCards, true);
    window.addEventListener("beforeprint", () => {
        renderizarListaImpressao(filtrarSaidas());
    });
    listaFrotas.addEventListener("click", tratarCliqueTabelaItens);
    listaFrotas.addEventListener("keydown", tratarTecladoTabelaItens);
    [modalItens, modalConfirmacao, modalAtencao].forEach((modal) => {
        definirEstadoModal(modal, false);
    });

    ativarComportamentoCampoOrdemServico();

    const atualizarSaidasComDebounce = criarDebounce(() => {
        atualizarInterfaceSaidas();
    }, 120);
    const renderizarCatalogoComDebounce = criarDebounce(() => {
        renderizarListaItens();
    }, 120);

    boxSugestao.addEventListener("mousedown", (event) => {
        event.preventDefault();
    });

    inputBuscaSaida.addEventListener("input", () => {
        atualizarSaidasComDebounce();
    });

    btnLimparBuscaSaida.addEventListener("click", () => {
        inputBuscaSaida.value = "";
        atualizarInterfaceSaidas();
        inputBuscaSaida.focus();
    });

    inputBuscaItemCatalogo.addEventListener("input", () => {
        renderizarCatalogoComDebounce();
    });

    btnCancelarEdicaoItem.addEventListener("click", () => {
        resetarFormularioItem();
        inputCadCodigo.focus();
    });

    btnModalAtencaoCancelar.addEventListener("click", () => {
        fecharModalAtencao(false);
    });

    btnModalAtencaoConfirmar.addEventListener("click", () => {
        fecharModalAtencao(true);
    });

    [modalItens, modalConfirmacao, modalAtencao].forEach((modal) => {
        modal.addEventListener("click", (event) => {
            if (event.target !== modal) {
                return;
            }

            if (modal === modalItens) {
                fecharModalItens();
                return;
            }

            if (modal === modalConfirmacao) {
                responderConfirmacaoItem(false);
                return;
            }

            fecharModalAtencao(false);
        });
    });
}

function definirCampoOrdemServicoAtivo(ativo, { focar = false } = {}) {
    inputOrdemServico.readOnly = !ativo;
    inputOrdemServico.tabIndex = ativo ? 0 : -1;
    inputOrdemServico.setAttribute("aria-readonly", ativo ? "false" : "true");
    inputBoxOrdemServico?.classList.toggle("is-optional-active", ativo);
    inputBoxOrdemServico?.classList.toggle("is-optional-idle", !ativo);

    if (ativo && focar) {
        window.requestAnimationFrame(() => {
            inputOrdemServico.focus();
        });
    }
}

function ativarComportamentoCampoOrdemServico() {
    definirCampoOrdemServicoAtivo(false);

    inputBoxOrdemServico?.addEventListener("pointerdown", (event) => {
        if (!(event.pointerType === "mouse" || event.pointerType === "pen")) {
            return;
        }

        if (inputOrdemServico.readOnly) {
            definirCampoOrdemServicoAtivo(true);
        }
    });

    inputOrdemServico.addEventListener("focus", () => {
        if (inputOrdemServico.readOnly) {
            inputOrdemServico.blur();
        }
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

        // Migração de dados antigos do localStorage (se existir)
        if (oldVersion < 4) {
            migrarDadosAntigos(event.target.transaction);
        }
    };

    request.onsuccess = async (event) => {
        db = event.target.result;
        await carregarCatalogo();
        await carregarDados();

        // Agendar backup automático (uma vez por dia)
        agendarBackupAutomatico();

        if (restaurarRascunhoSaida()) {
            return;
        }

        if (document.activeElement === document.body) {
            inputFrota.focus();
        }
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

function migrarDadosAntigos(transaction) {
    try {
        if (!transaction) {
            return;
        }

        const dadosAntigosSaidas = localStorage.getItem("almox_saidas");
        const dadosAntigosItens = localStorage.getItem("almox_itens_cadastro");

        if (!dadosAntigosSaidas && !dadosAntigosItens) {
            return; // Não há dados para migrar
        }

        console.log("Migrando dados antigos do localStorage para IndexedDB...");

        const storeSaidas = transaction.objectStore(STORE_SAIDAS);
        const storeItens = transaction.objectStore(STORE_ITENS);

        // Migrar saídas
        if (dadosAntigosSaidas) {
            const saidasAntigas = JSON.parse(dadosAntigosSaidas);
            if (Array.isArray(saidasAntigas)) {
                for (const saida of saidasAntigas) {
                    if (!saida.criadoEm) {
                        saida.criadoEm = new Date().toISOString();
                    }
                    if (!saida.atualizadoEm) {
                        saida.atualizadoEm = saida.criadoEm;
                    }
                    storeSaidas.add(saida);
                }
            }
        }

        // Migrar itens
        if (dadosAntigosItens) {
            const itensAntigos = JSON.parse(dadosAntigosItens);
            if (Array.isArray(itensAntigos)) {
                for (const item of itensAntigos) {
                    if (!item.criadoEm) {
                        item.criadoEm = new Date().toISOString();
                    }
                    if (!item.atualizadoEm) {
                        item.atualizadoEm = item.criadoEm;
                    }
                    storeItens.add(item);
                }
            }
        }

        transaction.oncomplete = () => {
            if (dadosAntigosSaidas) localStorage.removeItem("almox_saidas");
            if (dadosAntigosItens) localStorage.removeItem("almox_itens_cadastro");
            console.log("Migração concluída com sucesso");
            window.mostrarToast?.({
                variant: "info",
                title: "Migração concluída",
                message: "Dados antigos foram migrados para o novo sistema de armazenamento."
            });
        };

        transaction.onerror = (event) => {
            console.error("Erro durante migração:", event.target.error);
            window.mostrarToast?.({
                variant: "warning",
                title: "Migração com erro",
                message: "Houve um problema ao migrar dados antigos. Os dados podem ter sido perdidos."
            });
        };
    } catch (error) {
        console.error("Erro durante migração:", error);
        window.mostrarToast?.({
            variant: "warning",
            title: "Migração com erro",
            message: "Houve um problema ao migrar dados antigos. Os dados podem ter sido perdidos."
        });
    }
}

function agendarBackupAutomatico() {
    // Verificar se já fez backup hoje
    const ultimoBackup = localStorage.getItem("almox_ultimo_backup_auto");
    const hoje = new Date().toDateString();

    if (ultimoBackup === hoje) {
        return; // Já fez backup hoje
    }

    // Agendar backup para meia-noite
    const agora = new Date();
    const meiaNoite = new Date(agora);
    meiaNoite.setHours(24, 0, 0, 0);
    const tempoAteMeiaNoite = meiaNoite - agora;

    setTimeout(async () => {
        try {
            await fazerBackupAutomatico();
            localStorage.setItem("almox_ultimo_backup_auto", new Date().toDateString());
        } catch (error) {
            console.error("Erro no backup automático:", error);
        }
    }, tempoAteMeiaNoite);
}

async function fazerBackupAutomatico() {
    try {
        // Carregar dados mais recentes
        await carregarCatalogo();
        await carregarDados();

        const dadosBackup = {
            saidas: saidas,
            itens: catalogoItens,
            versao: "1.0",
            dataBackup: new Date().toISOString(),
            aplicacao: "Almox Project",
            tipo: "backup_automatico"
        };

        // Salvar no localStorage como backup automático (limitado)
        const json = JSON.stringify(dadosBackup);
        localStorage.setItem("almox_backup_auto", json);

        console.log("Backup automático realizado:", new Date().toLocaleString());

    } catch (error) {
        console.error("Erro no backup automático:", error);
    }
}

async function restaurarBackupAutomatico() {
    try {
        if (!db) {
            throw new Error("Banco de dados ainda não inicializado. Tente novamente em alguns segundos.");
        }

        const backupJson = localStorage.getItem("almox_backup_auto");
        if (!backupJson) {
            window.mostrarToast?.({
                variant: "warning",
                title: "Backup não encontrado",
                message: "Nenhum backup automático foi encontrado."
            });
            return;
        }

        const dadosBackup = JSON.parse(backupJson);

        // Validar backup
        if (!dadosBackup.saidas || !dadosBackup.itens || !Array.isArray(dadosBackup.saidas) || !Array.isArray(dadosBackup.itens)) {
            throw new Error("Backup inválido ou corrompido.");
        }

        const dataBackup = new Date(dadosBackup.dataBackup);
        const diasAtras = Math.floor((new Date() - dataBackup) / (1000 * 60 * 60 * 24));

        // Confirmar restauração
        const confirmou = await confirmarAcaoCritica({
            variant: "warning",
            badge: "Restaurar backup",
            titulo: "Restaurar backup automático",
            mensagem: `Deseja restaurar o backup de ${formatarContagem(diasAtras, "dia", "dias")} atrás?`,
            detalhe: `Backup criado em: ${dataBackup.toLocaleString()}\nContém: ${formatarContagem(dadosBackup.saidas.length, "saída", "saídas")} e ${formatarContagem(dadosBackup.itens.length, "item", "itens")}\n\nOs dados atuais serão substituídos.`,
            textoConfirmar: "Restaurar backup"
        });

        if (!confirmou) return;

        // Limpar dados atuais
        const transaction = db.transaction([STORE_SAIDAS, STORE_ITENS], "readwrite");
        const storeSaidas = transaction.objectStore(STORE_SAIDAS);
        const storeItens = transaction.objectStore(STORE_ITENS);

        await Promise.all([
            new Promise(resolve => storeSaidas.clear().onsuccess = resolve),
            new Promise(resolve => storeItens.clear().onsuccess = resolve)
        ]);

        // Restaurar dados do backup
        for (const saida of dadosBackup.saidas) {
            storeSaidas.add(saida);
        }

        for (const item of dadosBackup.itens) {
            storeItens.add(item);
        }

        // Aguardar transação completar
        await new Promise(resolve => transaction.oncomplete = resolve);

        // Recarregar dados
        await carregarCatalogo();
        await carregarDados();

        window.mostrarToast?.({
            variant: "success",
            title: "Backup restaurado",
            message: `Backup de ${formatarContagem(diasAtras, "dia", "dias")} atrás restaurado com sucesso.`
        });

    } catch (error) {
        console.error("Erro ao restaurar backup:", error);
        window.mostrarToast?.({
            variant: "danger",
            title: "Erro na restauração",
            message: error.message || "Não foi possível restaurar o backup."
        });
    }
}

function definirSugestoesVisiveis(visivel) {
    boxSugestao.hidden = !visivel;
}

function sugestoesEstaoVisiveis() {
    return !boxSugestao.hidden;
}

function formatarDataExibicao(item) {
    if (item.atualizadoEm) {
        return new Date(item.atualizadoEm).toLocaleDateString("pt-BR");
    }

    return item.data || "-";
}

function formatarDataHoraImpressao(data = new Date()) {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(data);
}

function gerarIdFrota(frota) {
    const base = normalizarBusca(frota)
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return base || "FROTA";
}

function obterFrotaExpandidaAtual() {
    const iterator = frotasExpandidas.values().next();
    return iterator.done ? null : iterator.value;
}

function definirFocoPendenteFrota(seletor) {
    seletorFocoDetalhesFrotaPendente = seletor;
}

function aplicarFocoPendenteFrota() {
    if (!seletorFocoDetalhesFrotaPendente) {
        return;
    }

    const seletor = seletorFocoDetalhesFrotaPendente;
    seletorFocoDetalhesFrotaPendente = null;

    window.requestAnimationFrame(() => {
        document.querySelector(seletor)?.focus();
    });
}

function salvarSessionStorage(chave, valor) {
    try {
        sessionStorage.setItem(chave, JSON.stringify(valor));
    } catch (error) {
        console.warn(`Não foi possível salvar ${chave} na sessão.`);
    }
}

function obterSessionStorage(chave) {
    try {
        const raw = sessionStorage.getItem(chave);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function removerSessionStorage(chave) {
    try {
        sessionStorage.removeItem(chave);
    } catch (error) {
        console.warn(`Não foi possível limpar ${chave} da sessão.`);
    }
}

function salvarRascunhoSaida() {
    const rascunho = {
        frota: inputFrota.value,
        codigo: inputCodigo.value,
        quantidade: inputQuantidade.value,
        descricao: inputDescricao.value,
        ordemServico: inputOrdemServico.value
    };

    const possuiConteudo = Object.values(rascunho).some((value) => String(value || "").trim());

    if (!possuiConteudo) {
        removerSessionStorage(SAIDA_DRAFT_STORAGE_KEY);
        return;
    }

    salvarSessionStorage(SAIDA_DRAFT_STORAGE_KEY, rascunho);
}

function restaurarRascunhoSaida() {
    const rascunho = obterSessionStorage(SAIDA_DRAFT_STORAGE_KEY);
    const url = new URL(window.location.href);
    const itemRetornado = normalizarBusca(url.searchParams.get("item"));
    let restaurou = false;

    if (rascunho && typeof rascunho === "object") {
        inputFrota.value = String(rascunho.frota || "").toUpperCase().trim();
        inputCodigo.value = String(rascunho.codigo || "").toUpperCase().trim();
        inputQuantidade.value = String(rascunho.quantidade || "").trim();
        inputDescricao.value = String(rascunho.descricao || "").toUpperCase().trim();
        inputOrdemServico.value = String(rascunho.ordemServico || "").toUpperCase().trim();
        definirCampoOrdemServicoAtivo(false);

        const itemCatalogado = catalogoItens.find((registro) => registro.codigo === inputCodigo.value);
        if (itemCatalogado) {
            inputDescricao.value = itemCatalogado.descricao;
        }

        removerSessionStorage(SAIDA_DRAFT_STORAGE_KEY);
        restaurou = true;
    }

    if (itemRetornado) {
        const itemCatalogado = catalogoItens.find((registro) => registro.codigo === itemRetornado);

        if (itemCatalogado && (!inputCodigo.value || inputCodigo.value === itemRetornado)) {
            inputCodigo.value = itemCatalogado.codigo;
            inputDescricao.value = itemCatalogado.descricao;
            window.mostrarToast?.({
                variant: "success",
                title: "Item cadastrado",
                message: `O código ${itemCatalogado.codigo} voltou pronto para uso no formulário.`
            });
        }

        url.searchParams.delete("item");
        const destino = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}${url.hash}`;
        window.history.replaceState({}, document.title, destino);
        inputQuantidade.focus();
        return true;
    }

    if (restaurou) {
        if (inputCodigo.value) {
            inputCodigo.focus();
            return true;
        }

        inputFrota.focus();
    }

    return restaurou;
}

function abrirPaginaItens({ codigo = inputCodigo.value, cadastroRapido = false } = {}) {
    salvarRascunhoSaida();
    salvarSessionStorage(ITEM_PAGE_CONTEXT_KEY, {
        codigo: String(codigo || "").toUpperCase().trim(),
        cadastroRapido,
        returnUrl: "index.html"
    });
    window.location.href = ITEM_PAGE_PATH;
}

function carregarCatalogo() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(STORE_ITENS, "readonly");
            const store = transaction.objectStore(STORE_ITENS);
            const request = store.getAll();

            request.onsuccess = (event) => {
                catalogoItens = event.target.result.sort((a, b) => a.codigo.localeCompare(b.codigo));
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

function carregarDados() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(STORE_SAIDAS, "readonly");
            const store = transaction.objectStore(STORE_SAIDAS);
            const request = store.getAll();

            request.onsuccess = (event) => {
                saidas = event.target.result.sort((a, b) => (a.id || 0) - (b.id || 0));
                atualizarInterfaceSaidas();
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

function existeModalAbertoGlobal() {
    return modalAberto
        || document.body.classList.contains("has-modal-open")
        || document.body.classList.contains("has-frota-spotlight");
}

function guardarFocoAtual() {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof HTMLElement)) {
        return;
    }

    if (
        modalItens.contains(activeElement)
        || modalConfirmacao.contains(activeElement)
        || modalAtencao.contains(activeElement)
        || modalConfiguracoes?.contains(activeElement)
    ) {
        return;
    }

    ultimoElementoFocado = activeElement;
}

function restaurarFocoAnterior(fallback = inputCodigo) {
    const alvo = ultimoElementoFocado instanceof HTMLElement && document.body.contains(ultimoElementoFocado)
        ? ultimoElementoFocado
        : fallback;

    ultimoElementoFocado = null;
    alvo.focus();
}

function atualizarEstadoModal() {
    modalAberto = modalItens.style.display === "flex"
        || modalConfirmacao.style.display === "flex"
        || modalAtencao.style.display === "flex";

    if (typeof window.atualizarClasseGlobalDeModais === "function") {
        window.atualizarClasseGlobalDeModais();
        return;
    }

    document.body.classList.toggle("has-modal-open", modalAberto);
}

function abrirModalItens(cadastroRapido = false) {
    guardarFocoAtual();
    cadastroRapidoPendente = cadastroRapido;
    definirEstadoModal(modalItens, true);
    atualizarEstadoModal();
    renderizarListaItens();
    inputCadCodigo.focus();
}

function fecharModalItens({ restaurarFoco = true, fallback = inputCodigo } = {}) {
    definirEstadoModal(modalItens, false);
    cadastroRapidoPendente = false;
    resetarFormularioItem();
    atualizarEstadoModal();

    if (restaurarFoco) {
        restaurarFocoAnterior(fallback);
    }
}

function abrirModalConfirmacao(codigo) {
    guardarFocoAtual();
    document.getElementById("codigoNaoEncontrado").innerText = codigo;
    definirEstadoModal(modalConfirmacao, true);
    atualizarEstadoModal();
    btnConfirmCadastrar.focus();
}

function fecharModalConfirmacao({ restaurarFoco = true, fallback = inputCodigo } = {}) {
    definirEstadoModal(modalConfirmacao, false);
    atualizarEstadoModal();

    if (restaurarFoco) {
        restaurarFocoAnterior(fallback);
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
    guardarFocoAtual();
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
    definirEstadoModal(modalAtencao, true);
    atualizarEstadoModal();

    const alvoFoco = focoInicial === "cancelar" && mostrarCancelar
        ? btnModalAtencaoCancelar
        : btnModalAtencaoConfirmar;

    alvoFoco.focus();

    return new Promise((resolve) => {
        resolverModalAtencao = resolve;
    });
}

function fecharModalAtencao(resultado, { restaurarFoco = true, fallback = inputCodigo } = {}) {
    if (modalAtencao.style.display !== "flex") {
        return;
    }

    definirEstadoModal(modalAtencao, false);
    atualizarEstadoModal();

    const resolve = resolverModalAtencao;
    resolverModalAtencao = null;

    if (restaurarFoco) {
        restaurarFocoAnterior(fallback);
    }

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

function resetarFormularioItem() {
    formCadastroItem.reset();
    inputCadCodigoOriginal.value = "";
    tituloModalItens.textContent = "Gerenciar itens";
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
    tituloModalItens.textContent = `Editar item ${item.codigo}`;
    btnSalvarItem.textContent = "Atualizar";
    btnSalvarItem.className = "btn-update";
    btnCancelarEdicaoItem.hidden = false;
    inputCadCodigo.focus();
}

function filtrarCatalogo() {
    const termo = normalizarBusca(inputBuscaItemCatalogo.value);

    if (!termo) {
        return catalogoItens;
    }

    return catalogoItens.filter((item) => {
        const baseBusca = [
            item.codigo,
            item.descricao
        ].join(" ");

        return normalizarBusca(baseBusca).includes(termo);
    });
}

formCadastroItem.addEventListener("submit", async (event) => {
    event.preventDefault();

    const codigo = inputCadCodigo.value.toUpperCase().trim();
    const descricao = inputCadDescricao.value.toUpperCase().trim();
    const codigoOriginal = inputCadCodigoOriginal.value.toUpperCase().trim();
    const itemExistente = catalogoItens.find((item) => item.codigo === codigo);

    if (!codigo || !descricao) {
        return;
    }

    if (itemExistente && itemExistente.codigo !== codigoOriginal) {
        await mostrarAvisoCritico({
            variant: "warning",
            badge: "Duplicidade detectada",
            titulo: "Código já cadastrado",
            mensagem: `O código ${codigo} já existe no catálogo.`,
            detalhe: "Use outro código ou edite o item já existente para atualizar a descrição."
        });
        inputCadCodigo.focus();
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
        criadoEm: itemOriginal?.criadoEm || agora,
        atualizadoEm: agora
    });

    tx.oncomplete = async () => {
        await carregarCatalogo();

        if (normalizarBusca(inputCodigo.value) === normalizarBusca(codigoOriginal || codigo)) {
            inputCodigo.value = codigo;
            inputDescricao.value = descricao;
        }

        if (cadastroRapidoPendente && normalizarBusca(inputCodigo.value) === normalizarBusca(codigo)) {
            fecharModalItens({ restaurarFoco: false });
            window.mostrarToast?.({
                variant: "success",
                title: "Item salvo",
                message: `O código ${codigo} foi cadastrado e já está disponível no formulário.`
            });
            inputQuantidade.focus();
            return;
        }

        resetarFormularioItem();
        window.mostrarToast?.({
            variant: "success",
            title: "Item salvo",
            message: `O código ${codigo} foi salvo no catálogo.`
        });
        inputCadCodigo.focus();
    };
});

function renderizarListaItens() {
    if (modalItens.style.display !== "flex") {
        return;
    }

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
        info.innerHTML = `<strong>${escapeHtml(item.codigo)}</strong><span>${escapeHtml(item.descricao)}</span>`;

        const actions = document.createElement("div");
        actions.className = "item-actions";

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-icon";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => prepararEdicaoItemCatalogo(item.codigo));

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-icon";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => deletarItemCatalogo(item.codigo));

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
        badge: "Remocao permanente",
        titulo: "Excluir item do catálogo",
        mensagem: `Deseja remover o código ${codigo} do catálogo?`,
        detalhe: "Essa ação afeta pesquisas futuras desse item e não poderá ser desfeita facilmente.",
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

        if (normalizarBusca(inputCodigo.value) === normalizarBusca(codigo)) {
            inputDescricao.value = "";
        }

        await carregarCatalogo();
        window.mostrarToast?.({
            variant: "success",
            title: "Item removido",
            message: `O código ${codigo} foi removido do catálogo.`
        });
        inputCadCodigo.focus();
    };

    deleteRequest.onerror = () => {
        console.error("Erro ao deletar item:", deleteRequest.error);
        window.mostrarToast?.({
            variant: "danger",
            title: "Erro ao remover",
            message: `Não foi possível remover o item ${codigo}.`
        });
    };
}

function limparSugestoes() {
    boxSugestao.innerHTML = "";
    definirSugestoesVisiveis(false);
    boxSugestao.scrollTop = 0;
    sugestoesVisiveis = [];
    indiceSugestaoAtiva = -1;
}

function manterSugestaoVisivel(elemento, behavior = "smooth") {
    if (!(elemento instanceof HTMLElement) || !sugestoesEstaoVisiveis()) {
        return;
    }

    const topoElemento = elemento.offsetTop;
    const baseElemento = topoElemento + elemento.offsetHeight;
    const topoVisivel = boxSugestao.scrollTop;
    const baseVisivel = topoVisivel + boxSugestao.clientHeight;

    if (topoElemento >= topoVisivel && baseElemento <= baseVisivel) {
        return;
    }

    const destino = topoElemento - Math.max(12, Math.round((boxSugestao.clientHeight - elemento.offsetHeight) / 2));
    boxSugestao.scrollTo({
        top: Math.max(0, destino),
        behavior
    });
}

function atualizarSugestaoAtiva(indice) {
    const sugestoes = Array.from(boxSugestao.querySelectorAll(".sugestao-item"));

    if (!sugestoes.length) {
        indiceSugestaoAtiva = -1;
        return;
    }

    const tamanho = sugestoes.length;
    indiceSugestaoAtiva = ((indice % tamanho) + tamanho) % tamanho;

    sugestoes.forEach((elemento, posicao) => {
        elemento.classList.toggle("is-active", posicao === indiceSugestaoAtiva);
        elemento.setAttribute("aria-selected", posicao === indiceSugestaoAtiva ? "true" : "false");
    });

    manterSugestaoVisivel(sugestoes[indiceSugestaoAtiva], "smooth");
}

function moverSugestao(delta) {
    if (!sugestoesVisiveis.length) {
        return;
    }

    if (indiceSugestaoAtiva === -1) {
        atualizarSugestaoAtiva(delta > 0 ? 0 : sugestoesVisiveis.length - 1);
        return;
    }

    atualizarSugestaoAtiva(indiceSugestaoAtiva + delta);
}

function selecionarSugestao(item) {
    inputCodigo.value = item.codigo;
    inputDescricao.value = item.descricao;
    limparSugestoes();

    if (sincronizarEdicaoRegistroExistente({ focarQuantidade: true, mostrarAviso: true })) {
        return;
    }

    inputQuantidade.focus();
}

function selecionarSugestaoAtiva() {
    if (!sugestoesVisiveis.length) {
        return false;
    }

    const indice = indiceSugestaoAtiva === -1 ? 0 : indiceSugestaoAtiva;
    selecionarSugestao(sugestoesVisiveis[indice]);
    return true;
}

function validarCodigoPeca({ abrirModalSeNecessario = true, avancarFoco = false } = {}) {
    const valor = inputCodigo.value.toUpperCase().trim();
    inputCodigo.value = valor;

    if (!valor || existeModalAbertoGlobal()) {
        return false;
    }

    const item = catalogoItens.find((registro) => registro.codigo === valor);

    if (item) {
        inputDescricao.value = item.descricao;

        if (sincronizarEdicaoRegistroExistente({ focarQuantidade: avancarFoco })) {
            return true;
        }

        if (avancarFoco) {
            inputQuantidade.focus();
        }

        return true;
    }

    if (abrirModalSeNecessario) {
        abrirModalConfirmacao(valor);
    }

    return false;
}

function encontrarRegistroExistentePorFrotaECodigo({ frota, codigo, ignorarId = null } = {}) {
    const frotaNormalizada = normalizarBusca(frota);
    const codigoNormalizado = normalizarBusca(codigo);

    if (!frotaNormalizada || !codigoNormalizado) {
        return null;
    }

    const candidatos = saidas
        .filter((item) => {
            if (ignorarId !== null && item.id === ignorarId) {
                return false;
            }

            return normalizarBusca(item.frota) === frotaNormalizada
                && normalizarBusca(item.codigo) === codigoNormalizado;
        })
        .sort((a, b) => {
            const dataA = String(a.atualizadoEm || a.criadoEm || a.data || "");
            const dataB = String(b.atualizadoEm || b.criadoEm || b.data || "");
            return dataB.localeCompare(dataA) || (b.id || 0) - (a.id || 0);
        });

    return candidatos[0] || null;
}

function aplicarRegistroEmEdicao(item, { focarQuantidade = false, destacarQuantidade = false } = {}) {
    if (!item) {
        return false;
    }

    registroSaidaEmEdicao = item;
    document.getElementById("editId").value = item.id;
    document.getElementById("editData").value = item.data;
    inputFrota.value = item.frota;
    inputCodigo.value = item.codigo;
    inputQuantidade.value = item.qtd;
    inputDescricao.value = item.desc;
    inputOrdemServico.value = item.os || "";
    definirCampoOrdemServicoAtivo(false);
    btnSubmit.textContent = "Atualizar";
    btnSubmit.className = "btn-update";
    btnCancel.hidden = false;
    document.getElementById("containerCampos").classList.add("form-editing");

    const campoFoco = focarQuantidade ? inputQuantidade : inputFrota;
    campoFoco.focus();

    if (destacarQuantidade && typeof inputQuantidade.select === "function") {
        inputQuantidade.select();
    }

    return true;
}

function sincronizarEdicaoRegistroExistente({ focarQuantidade = false, mostrarAviso = false } = {}) {
    const registroExistente = encontrarRegistroExistentePorFrotaECodigo({
        frota: inputFrota.value,
        codigo: inputCodigo.value,
        ignorarId: registroSaidaEmEdicao?.id ?? null
    });

    if (!registroExistente) {
        return false;
    }

    if (registroSaidaEmEdicao?.id === registroExistente.id) {
        if (focarQuantidade) {
            inputQuantidade.focus();
            if (typeof inputQuantidade.select === "function") {
                inputQuantidade.select();
            }
        }

        return true;
    }

    aplicarRegistroEmEdicao(registroExistente, {
        focarQuantidade,
        destacarQuantidade: focarQuantidade
    });

    if (mostrarAviso) {
        window.mostrarToast?.({
        variant: "info",
        title: "Registro encontrado",
        message: `O código ${registroExistente.codigo} da frota ${registroExistente.frota} foi carregado para atualização.`
        });
    }

    return true;
}

inputCodigo.addEventListener("input", function () {
    const valor = this.value.toUpperCase().trim();
    this.value = valor;

    if (!valor) {
        inputDescricao.value = "";
        limparSugestoes();
        return;
    }

    const itemExato = catalogoItens.find((item) => item.codigo === valor);
    inputDescricao.value = itemExato ? itemExato.descricao : "";

    const matches = catalogoItens
        .filter((item) => item.codigo.includes(valor) || normalizarBusca(item.descricao).includes(normalizarBusca(valor)))
        .slice(0, 5);

    if (!matches.length) {
        limparSugestoes();
        return;
    }

    sugestoesVisiveis = matches;
    boxSugestao.innerHTML = "";
    definirSugestoesVisiveis(true);
    boxSugestao.scrollTop = 0;
    boxSugestao.setAttribute("role", "listbox");

    matches.forEach((item, indice) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "sugestao-item";
        itemDiv.setAttribute("role", "option");
        itemDiv.setAttribute("aria-selected", "false");
        itemDiv.innerHTML = `<strong>${escapeHtml(item.codigo)}</strong> - ${escapeHtml(item.descricao)}`;
        itemDiv.addEventListener("mousemove", () => {
            if (indiceSugestaoAtiva !== indice) {
                atualizarSugestaoAtiva(indice);
            }
        });
        itemDiv.addEventListener("touchstart", () => {
            if (indiceSugestaoAtiva !== indice) {
                atualizarSugestaoAtiva(indice);
            }
        }, { passive: true });
        itemDiv.onclick = () => selecionarSugestao(item);
        boxSugestao.appendChild(itemDiv);
    });

    atualizarSugestaoAtiva(0);
});

inputCodigo.addEventListener("blur", () => {
    setTimeout(() => {
        limparSugestoes();
        validarCodigoPeca({ abrirModalSeNecessario: true, avancarFoco: false });
    }, 150);
});

function responderConfirmacaoItem(cadastrar) {
    const codigo = document.getElementById("codigoNaoEncontrado").innerText;
    fecharModalConfirmacao({ restaurarFoco: false });

    if (cadastrar) {
        abrirPaginaItens({ codigo, cadastroRapido: true });
        return;
    }

    inputDescricao.focus();
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

function focarPrimeiraAcaoTabela() {
    const primeiroElemento = listaFrotas.querySelector(
        ".frota-spotlight-card .itens-table-row, .frota-spotlight-card .table-action-btn, .frota-spotlight-card .frota-toggle, .frota-toggle, .btn-icon"
    );

    if (primeiroElemento instanceof HTMLElement) {
        primeiroElemento.focus();
        return true;
    }

    return false;
}

function focarPrimeiraAcaoCatalogo() {
    const primeiroBotao = listaItensCadastrados.querySelector(".btn-icon");
    if (primeiroBotao instanceof HTMLElement) {
        primeiroBotao.focus();
        return true;
    }

    return false;
}

function tratarAtalhosTeclado(event) {
    if (event.defaultPrevented || event.isComposing) {
        return;
    }

    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    const activeElement = document.activeElement;
    const tagName = activeElement?.tagName || "";
    const modalItensAberto = modalItens.style.display === "flex";
    const modalConfirmacaoAberto = modalConfirmacao.style.display === "flex";
    const modalAtencaoAberto = modalAtencao.style.display === "flex";
    const modalConfiguracoesAberto = modalConfiguracoes?.classList.contains("is-open");
    const spotlightCard = listaFrotas.querySelector(".frota-spotlight-card");
    const spotlightAberto = spotlightCard instanceof HTMLElement;
    const sugestaoAberta = sugestoesEstaoVisiveis();
    const emEdicao = Boolean(document.getElementById("editId").value);

    if (event.key === "Tab") {
        if (spotlightAberto && spotlightCard instanceof HTMLElement) {
            manterFocoNoModal(event, spotlightCard);
            return;
        }

        if (modalConfiguracoesAberto) {
            return;
        }

        if (modalAtencaoAberto) {
            manterFocoNoModal(event, modalAtencao);
            return;
        }

        if (modalConfirmacaoAberto) {
            manterFocoNoModal(event, modalConfirmacao);
            return;
        }

        if (modalItensAberto) {
            manterFocoNoModal(event, modalItens);
        }

        return;
    }

    if (activeElement === inputCodigo && sugestaoAberta && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        moverSugestao(event.key === "ArrowDown" ? 1 : -1);
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();

        if (spotlightAberto) {
            minimizarDetalhesFrotas();
            return;
        }

        if (modalConfiguracoesAberto) {
            return;
        }

        if (modalAtencaoAberto) {
            fecharModalAtencao(false);
            return;
        }

        if (modalConfirmacaoAberto) {
            btnConfirmAvulso.click();
            return;
        }

        if (modalItensAberto) {
            fecharModalItens();
            return;
        }

        if (sugestaoAberta) {
            limparSugestoes();
            return;
        }

        if (frotasExpandidas.size) {
            minimizarDetalhesFrotas();
            return;
        }

        if (emEdicao) {
            resetarFormulario(false);
        }

        return;
    }

    if (event.key !== "Enter" || event.shiftKey) {
        return;
    }

    if (modalAtencaoAberto) {
        event.preventDefault();

        if (activeElement === btnModalAtencaoCancelar) {
            fecharModalAtencao(false);
            return;
        }

        fecharModalAtencao(true);
        return;
    }

    if (modalConfirmacaoAberto) {
        event.preventDefault();

        if (activeElement instanceof HTMLElement && modalConfirmacao.contains(activeElement) && activeElement.closest("button")) {
            activeElement.click();
            return;
        }

        btnConfirmCadastrar.click();
        return;
    }

    if (tagName === "BUTTON" || tagName === "SELECT" || tagName === "TEXTAREA") {
        return;
    }

    if (activeElement === inputBuscaSaida) {
        event.preventDefault();
        if (!focarPrimeiraAcaoTabela()) {
            inputFrota.focus();
        }
        return;
    }

    if (modalItensAberto && activeElement === inputBuscaItemCatalogo) {
        event.preventDefault();
        if (!focarPrimeiraAcaoCatalogo()) {
            inputCadCodigo.focus();
        }
        return;
    }

    if (activeElement === inputFrota) {
        event.preventDefault();
        inputCodigo.focus();
        return;
    }

    if (activeElement === inputCodigo) {
        event.preventDefault();

        if (sugestaoAberta && selecionarSugestaoAtiva()) {
            return;
        }

        validarCodigoPeca({ abrirModalSeNecessario: true, avancarFoco: true });
        return;
    }

    if (activeElement === inputQuantidade) {
        event.preventDefault();
        inputDescricao.focus();
        return;
    }

    if (activeElement === inputDescricao) {
        event.preventDefault();
        formSaida.requestSubmit();
        return;
    }

    if (activeElement === inputOrdemServico) {
        event.preventDefault();
        formSaida.requestSubmit();
        return;
    }

    if (modalItensAberto && activeElement === inputCadCodigo) {
        event.preventDefault();
        inputCadDescricao.focus();
        return;
    }

    if (modalItensAberto && activeElement === inputCadDescricao) {
        event.preventDefault();
        formCadastroItem.requestSubmit();
        return;
    }

    if (activeElement?.form === formSaida) {
        event.preventDefault();
        formSaida.requestSubmit();
        return;
    }

    if (modalItensAberto && activeElement?.form === formCadastroItem) {
        event.preventDefault();
        formCadastroItem.requestSubmit();
    }
}

formSaida.addEventListener("submit", (event) => {
    event.preventDefault();

    const idAtual = document.getElementById("editId").value;
    const registroExistente = encontrarRegistroExistentePorFrotaECodigo({
        frota: inputFrota.value,
        codigo: inputCodigo.value,
        ignorarId: idAtual ? Number.parseInt(idAtual, 10) : null
    });
    const id = idAtual || (registroExistente ? String(registroExistente.id) : "");
    const agora = new Date();
    const item = {
        frota: inputFrota.value.toUpperCase().trim(),
        codigo: inputCodigo.value.toUpperCase().trim(),
        qtd: Number.parseInt(inputQuantidade.value, 10),
        desc: inputDescricao.value.toUpperCase().trim(),
        os: inputOrdemServico.value.toUpperCase().trim(),
        data: id ? (registroExistente?.data || document.getElementById("editData").value) : agora.toLocaleDateString("pt-BR"),
        criadoEm: registroExistente?.criadoEm || registroSaidaEmEdicao?.criadoEm || agora.toISOString(),
        atualizadoEm: agora.toISOString()
    };

    if (!item.frota || !item.codigo || !item.qtd || !item.desc) {
        return;
    }

    if (id) {
        item.id = Number.parseInt(id, 10);
    }

    const store = executarTransacao(STORE_SAIDAS, "readwrite");
    const putRequest = store.put(item);

    putRequest.onsuccess = async () => {
        resetarFormulario(true);
        await carregarDados();
        // Notificar outras abas sobre atualização de saídas
        localStorage.setItem('almox_saidas_updated', Date.now().toString());
        window.mostrarToast?.({
            variant: "success",
            title: id ? "Saída atualizada" : "Saída registrada",
            message: `A frota ${item.frota} foi ${id ? "atualizada" : "registrada"} com sucesso.`
        });
    };

    putRequest.onerror = () => {
        console.error("Erro ao salvar saída:", putRequest.error);
        window.mostrarToast?.({
            variant: "danger",
            title: "Erro ao salvar",
            message: "Não foi possível salvar a saída agora."
        });
    };
});

function filtrarSaidas() {
    const termo = normalizarBusca(inputBuscaSaida.value);

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

function agruparSaidasPorFrota(lista) {
    return lista.reduce((acc, item) => {
        if (!acc[item.frota]) {
            acc[item.frota] = [];
        }

        acc[item.frota].push(item);
        return acc;
    }, {});
}

function atualizarResumoSaidas(listaFiltrada) {
    const totalRegistros = listaFiltrada.length;
    const totalQuantidade = listaFiltrada.reduce((acc, item) => acc + (item.qtd || 0), 0);
    const totalFrotas = new Set(listaFiltrada.map((item) => item.frota)).size;

    statRegistros.textContent = String(totalRegistros);
    statQuantidade.textContent = String(totalQuantidade);
    statFrotas.textContent = String(totalFrotas);

    if (inputBuscaSaida.value.trim()) {
        resumoBuscaSaida.textContent = `Exibindo ${formatarContagem(totalRegistros, "registro", "registros")} de ${formatarContagem(saidas.length, "registro", "registros")} para "${inputBuscaSaida.value.trim()}".`;
        return;
    }

    resumoBuscaSaida.textContent = saidas.length
        ? `Exibindo todos os ${formatarContagem(saidas.length, "registro", "registros")}.`
        : "Nenhum registro cadastrado ainda.";
}

function atualizarInterfaceSaidas() {
    const listaFiltrada = filtrarSaidas();
    saidasFiltradasAtuais = listaFiltrada;
    atualizarResumoSaidas(listaFiltrada);
    renderizarTabelas(listaFiltrada);
    renderizarListaImpressao(listaFiltrada);
}

function minimizarDetalhesFrotas({ restaurarFoco = true } = {}) {
    const frotaExpandida = obterFrotaExpandidaAtual();

    if (!frotaExpandida) {
        return;
    }

    frotasExpandidas.clear();

    if (restaurarFoco) {
        definirFocoPendenteFrota(`#frota-toggle-${gerarIdFrota(frotaExpandida)}`);
    }

    renderizarTabelas(saidasFiltradasAtuais);
}

function tratarCliqueForaDosCards(event) {
    if (!frotasExpandidas.size || existeModalAbertoGlobal()) {
        return;
    }

    const caminhoEvento = typeof event.composedPath === "function" ? event.composedPath() : [];
    const clicouNoToggle = caminhoEvento.some((node) =>
        node instanceof Element && node.matches(".frota-toggle")
    );
    const clicouEmCardExpandido = caminhoEvento.some((node) =>
        node instanceof Element && node.matches(".frota-spotlight-card")
    );

    if (clicouNoToggle || clicouEmCardExpandido) {
        return;
    }

    minimizarDetalhesFrotas();
}

function toggleDetalhesFrota(frota) {
    if (frotasExpandidas.has(frota)) {
        frotasExpandidas.delete(frota);
        definirFocoPendenteFrota(`#frota-toggle-${gerarIdFrota(frota)}`);
    } else {
        frotasExpandidas.clear();
        frotasExpandidas.add(frota);
        definirFocoPendenteFrota(`#frota-spotlight-close-${gerarIdFrota(frota)}`);
    }

    renderizarTabelas(saidasFiltradasAtuais);
}

function prepararEdicaoPeloSpotlight(id) {
    minimizarDetalhesFrotas({ restaurarFoco: false });
    prepararEdicao(id);
}

function deletarItemPeloSpotlight(id) {
    minimizarDetalhesFrotas({ restaurarFoco: false });
    deletarItem(id);
}

function obterSaidaPorId(id) {
    return saidas.find((item) => item.id === id) || null;
}

function handleRowClick(item) {
    if (!item) {
        return;
    }

    prepararEdicaoPeloSpotlight(item.id);
}

function tratarCliqueTabelaItens(event) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
        return;
    }

    const actionButton = target.closest("[data-table-action]");
    if (actionButton instanceof HTMLButtonElement && listaFrotas.contains(actionButton)) {
        event.preventDefault();
        event.stopPropagation();

        const id = Number.parseInt(actionButton.dataset.itemId || "", 10);
        if (!Number.isInteger(id)) {
            return;
        }

        if (actionButton.dataset.tableAction === "edit") {
            prepararEdicaoPeloSpotlight(id);
            return;
        }

        if (actionButton.dataset.tableAction === "delete") {
            deletarItemPeloSpotlight(id);
        }

        return;
    }

    const row = target.closest(".itens-table-row");
    if (!(row instanceof HTMLElement) || !listaFrotas.contains(row)) {
        return;
    }

    const item = obterSaidaPorId(Number.parseInt(row.dataset.itemId || "", 10));
    handleRowClick(item);
}

function tratarTecladoTabelaItens(event) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target || target.closest("[data-table-action]")) {
        return;
    }

    const row = target.closest(".itens-table-row");
    if (!(row instanceof HTMLElement) || !listaFrotas.contains(row)) {
        return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const item = obterSaidaPorId(Number.parseInt(row.dataset.itemId || "", 10));
    handleRowClick(item);
}

function renderizarIconeAcao(tipo) {
    if (tipo === "edit") {
        return `
            <svg class="table-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 20.5V17l9.9-9.9 3.5 3.5-9.9 9.9H4zm11.4-11.9 1.4-1.4a1 1 0 0 1 1.4 0l1.8 1.8a1 1 0 0 1 0 1.4L18.6 12l-3.2-3.4z"></path>
            </svg>
        `;
    }

    return `
        <svg class="table-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 7h2v8h-2v-8zm4 0h2v8h-2v-8zM7 10h2v8H7v-8zm1 11a2 2 0 0 1-2-2V8h12v11a2 2 0 0 1-2 2H8z"></path>
        </svg>
    `;
}

function renderizarBotaoAcaoTabela(item, action) {
    const isEdit = action === "edit";
    const label = isEdit ? "Editar" : "Excluir";
    const ariaLabel = `${label} registro do código ${item.codigo}`;
    const buttonClass = [
        "table-action-btn",
        isEdit ? "table-action-btn-edit" : "table-action-btn-delete",
        "no-print"
    ].join(" ");

    return `
        <button
            type="button"
            class="${buttonClass}"
            data-table-action="${action}"
            data-item-id="${item.id}"
            aria-label="${escapeHtml(ariaLabel)}"
        >
            ${renderizarIconeAcao(action)}
        </button>
    `;
}

function renderizarLinhaTabelaItem(item) {
    return `
        <tr
            class="itens-table-row"
            tabindex="0"
            role="button"
            data-item-id="${item.id}"
            aria-label="Abrir registro do código ${escapeHtml(item.codigo)}"
        >
            <td class="itens-table-cell cell-codigo">
                <span class="cell-singleline-content">${escapeHtml(item.codigo)}</span>
            </td>
            <td class="itens-table-cell cell-descricao">
                <span class="cell-descricao-content">${escapeHtml(item.desc)}</span>
            </td>
            <td class="itens-table-cell cell-qtd">
                <span class="cell-singleline-content">${escapeHtml(item.qtd)}</span>
            </td>
            <td class="itens-table-cell cell-os">
                <span class="cell-singleline-content">${escapeHtml(item.os || "-")}</span>
            </td>
            <td class="itens-table-cell cell-data">
                <span class="cell-singleline-content">${escapeHtml(formatarDataExibicao(item))}</span>
            </td>
            <td class="itens-table-cell cell-acoes no-print">
                <div class="table-actions-group">
                    ${renderizarBotaoAcaoTabela(item, "edit")}
                    ${renderizarBotaoAcaoTabela(item, "delete")}
                </div>
            </td>
        </tr>
    `;
}

function TabelaItens({ registros = [] } = {}) {
    if (!registros.length) {
        return `
            <div class="itens-table-shell">
                <div class="itens-table-empty">Nenhum registro encontrado para esta frota.</div>
            </div>
        `;
    }

    return `
        <div class="itens-table-shell" role="region" aria-label="Tabela de itens registrados da frota">
            <table class="itens-table">
                <caption class="visually-hidden">Itens registrados da frota selecionada</caption>
                <thead>
                    <tr>
                        <th scope="col">Código</th>
                        <th scope="col">Descrição</th>
                        <th scope="col">Qtd</th>
                        <th scope="col" class="col-os">OS</th>
                        <th scope="col" class="col-data">Data</th>
                        <th scope="col" class="col-acoes">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${registros.map((item) => renderizarLinhaTabelaItem(item)).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderizarRegistrosFrota(registros) {
    const acaoEditar = "prepararEdicao";
    const acaoExcluir = "deletarItem";

    return registros.map((item) => `
        <article class="registro-card">
            <div class="registro-fields">
                <div class="registro-field">
                    <span class="registro-label">Código</span>
                    <strong class="registro-value">${escapeHtml(item.codigo)}</strong>
                </div>
                <div class="registro-field">
                    <span class="registro-label">Qtd</span>
                    <strong class="registro-value">${escapeHtml(item.qtd)}</strong>
                </div>
                <div class="registro-field registro-field-wide">
                    <span class="registro-label">Descrição</span>
                    <strong class="registro-value">${escapeHtml(item.desc)}</strong>
                </div>
                <div class="registro-field">
                    <span class="registro-label">OS</span>
                    <strong class="registro-value">${escapeHtml(item.os || "-")}</strong>
                </div>
                <div class="registro-field">
                    <span class="registro-label">Data</span>
                    <strong class="registro-value">${escapeHtml(formatarDataExibicao(item))}</strong>
                </div>
            </div>
            <div class="registro-actions no-print">
                <button type="button" onclick="${acaoEditar}(${item.id})" class="btn-icon">Editar</button>
                <button type="button" onclick="${acaoExcluir}(${item.id})" class="btn-icon">Excluir</button>
            </div>
        </article>
    `).join("");
}

function renderizarResumoFrota(totalItens, totalQuantidade) {
    return `
        <div class="frota-summary">
            <span>${formatarContagem(totalItens, "registro", "registros")}</span>
            <span>${formatarContagem(totalQuantidade, "item", "itens")}</span>
        </div>
    `;
}

function compararRegistrosParaImpressao(a, b) {
    const comparacaoFrota = String(a.frota || "").localeCompare(String(b.frota || ""), "pt-BR", {
        numeric: true,
        sensitivity: "base"
    });

    if (comparacaoFrota !== 0) {
        return comparacaoFrota;
    }

    const comparacaoCodigo = String(a.codigo || "").localeCompare(String(b.codigo || ""), "pt-BR", {
        numeric: true,
        sensitivity: "base"
    });

    if (comparacaoCodigo !== 0) {
        return comparacaoCodigo;
    }

    const dataA = String(a.atualizadoEm || a.criadoEm || a.data || "");
    const dataB = String(b.atualizadoEm || b.criadoEm || b.data || "");
    return dataB.localeCompare(dataA);
}

function renderizarLinhaImpressao(item) {
    return `
        <tr class="print-table-row">
            <td class="print-table-cell print-table-cell-codigo">
                <span class="print-cell-singleline-content">${escapeHtml(item.codigo)}</span>
            </td>
            <td class="print-table-cell print-table-cell-qtd">
                <span class="print-cell-singleline-content">${escapeHtml(item.qtd)}</span>
            </td>
            <td class="print-table-cell print-table-cell-descricao">
                <span class="print-cell-descricao-content">${escapeHtml(item.desc)}</span>
            </td>
            <td class="print-table-cell print-table-cell-os">
                <span class="print-cell-singleline-content">${escapeHtml(item.os || "-")}</span>
            </td>
            <td class="print-table-cell print-table-cell-data">
                <span class="print-cell-singleline-content">${escapeHtml(formatarDataExibicao(item))}</span>
            </td>
        </tr>
    `;
}

function renderizarSecaoImpressaoFrota(frota, registros) {
    const totalQuantidade = registros.reduce((acc, item) => acc + (Number(item.qtd) || 0), 0);

    return `
        <section class="print-frota-section">
            <div class="print-frota-head">
                <strong class="print-frota-title">Frota: ${escapeHtml(frota)}</strong>
                <span class="print-frota-meta">${formatarContagem(registros.length, "registro", "registros")} | ${formatarContagem(totalQuantidade, "item", "itens")}</span>
            </div>
            <table class="print-table">
                <colgroup>
                    <col class="print-col-codigo">
                    <col class="print-col-qtd">
                    <col class="print-col-descricao">
                    <col class="print-col-os">
                    <col class="print-col-data">
                </colgroup>
                <thead>
                    <tr>
                        <th scope="col">Código</th>
                        <th scope="col">Qtd</th>
                        <th scope="col">Descrição</th>
                        <th scope="col">OS</th>
                        <th scope="col">Data</th>
                    </tr>
                </thead>
                <tbody>
                    ${registros.map((item) => renderizarLinhaImpressao(item)).join("")}
                </tbody>
            </table>
        </section>
    `;
}

function renderizarListaImpressao(listaFiltrada = saidas) {
    if (!listaImpressao) {
        return;
    }

    if (!listaFiltrada.length) {
        listaImpressao.innerHTML = "";
        return;
    }

    const filtroAtual = inputBuscaSaida.value.trim();
    const registrosOrdenados = [...listaFiltrada].sort(compararRegistrosParaImpressao);
    const totalQuantidade = registrosOrdenados.reduce((acc, item) => acc + (Number(item.qtd) || 0), 0);
    const totalFrotas = new Set(registrosOrdenados.map((item) => item.frota)).size;
    const agrupadoPorFrota = agruparSaidasPorFrota(registrosOrdenados);
    const frotasOrdenadas = Object.keys(agrupadoPorFrota).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    const resumoImpressao = `${formatarContagem(totalFrotas, "frota", "frotas")} | ${formatarContagem(registrosOrdenados.length, "registro", "registros")} | ${formatarContagem(totalQuantidade, "item", "itens")}`;
    const detalheFiltro = filtroAtual
        ? `Filtro aplicado: "${filtroAtual}".`
        : "Relatório completo organizado por frota.";
    const dataImpressao = formatarDataHoraImpressao();

    listaImpressao.innerHTML = `
        <div class="print-sheet-head">
            <div class="print-sheet-title-group">
                <strong class="print-sheet-title">Almox Project</strong>
                <span class="print-sheet-subtitle">Relatório de saídas por frota</span>
            </div>
            <div class="print-sheet-meta-group">
                <span class="print-sheet-meta">${escapeHtml(resumoImpressao)}</span>
                <span class="print-sheet-meta">${escapeHtml(detalheFiltro)}</span>
                <span class="print-sheet-meta">Impresso em ${escapeHtml(dataImpressao)}</span>
            </div>
        </div>
        <div class="print-sheet-sections">
            ${frotasOrdenadas.map((frota) => renderizarSecaoImpressaoFrota(frota, agrupadoPorFrota[frota])).join("")}
        </div>
    `;
}

function renderizarSpotlightFrota(frota, registros) {
    const spotlightId = gerarIdFrota(frota);
    const totalItens = registros.length;
    const totalQuantidade = registros.reduce((acc, item) => acc + (item.qtd || 0), 0);

    return `
        <div class="frota-spotlight-layer no-print" aria-hidden="false">
            <div class="frota-spotlight-backdrop" onclick="minimizarDetalhesFrotas()"></div>
            <article
                class="frota-card frota-spotlight-card is-expanded"
                role="dialog"
                aria-modal="true"
                aria-labelledby="frota-spotlight-title-${spotlightId}"
            >
                <button
                    type="button"
                    id="frota-spotlight-close-${spotlightId}"
                    class="frota-toggle no-print"
                    aria-label="Fechar detalhes da frota ${escapeHtml(frota)}"
                    data-frota="${escapeHtml(frota)}"
                    onclick="toggleDetalhesFrota(this.getAttribute('data-frota'))"
                >
                    Fechar
                </button>
                <div class="frota-hero">
                    <strong class="frota-number" id="frota-spotlight-title-${spotlightId}">${escapeHtml(frota)}</strong>
                </div>
                <div class="frota-details">
                    ${renderizarResumoFrota(totalItens, totalQuantidade)}
                    ${TabelaItens({ registros })}
                </div>
            </article>
        </div>
    `;
}

function renderizarTabelas(listaFiltrada = saidas) {
    const agrupado = agruparSaidasPorFrota(listaFiltrada);
    const frotas = Object.keys(agrupado).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    const frotaExpandida = obterFrotaExpandidaAtual();
    const spotlightAtivo = Boolean(frotaExpandida && agrupado[frotaExpandida]);

    document.body.classList.toggle("has-frota-spotlight", spotlightAtivo);

    if (!frotas.length) {
        document.body.classList.remove("has-frota-spotlight");
        if (saidas.length && inputBuscaSaida.value.trim()) {
            listaFrotas.innerHTML = '<div class="frota-card frota-card-empty"><strong>Nenhum resultado</strong><span>A busca atual não encontrou registros. Ajuste os filtros para continuar.</span></div>';
            return;
        }

        listaFrotas.innerHTML = '<div class="frota-card frota-card-empty"><strong>Nenhuma saída registrada</strong><span>Cadastre a primeira movimentação usando o formulário acima.</span></div>';
        return;
    }

    const cardsHtml = frotas
        .map((frota) => {
            const registros = agrupado[frota];
            const totalItens = registros.length;
            const totalQuantidade = registros.reduce((acc, item) => acc + (item.qtd || 0), 0);
            const detalhesId = `detalhes-frota-${gerarIdFrota(frota)}`;
            const expandida = frotasExpandidas.has(frota);
            const textoBotao = expandida ? "Ocultar" : "Ver";
            const acaoBotao = expandida ? "Ocultar" : "Visualizar";
            const classesCard = [
                "frota-card",
                expandida ? "is-expanded" : "",
                spotlightAtivo ? "is-dimmed" : ""
            ].filter(Boolean).join(" ");

            return `
                <article class="${classesCard}">
                    <button
                        type="button"
                        id="frota-toggle-${gerarIdFrota(frota)}"
                        class="frota-toggle no-print"
                        aria-expanded="${expandida}"
                        aria-haspopup="dialog"
                        aria-label="${acaoBotao} detalhes da frota ${escapeHtml(frota)}"
                        data-frota="${escapeHtml(frota)}"
                        onclick="toggleDetalhesFrota(this.getAttribute('data-frota'))"
                    >
                        ${textoBotao}
                    </button>
                    <div class="frota-hero">
                        <strong class="frota-number">${escapeHtml(frota)}</strong>
                    </div>
                    <div class="frota-details is-hidden" id="${detalhesId}">
                        ${renderizarResumoFrota(totalItens, totalQuantidade)}
                        <div class="registros-grid">
                            ${renderizarRegistrosFrota(registros)}
                        </div>
                    </div>
                </article>
            `;
        })
        .join("");

    const spotlightHtml = spotlightAtivo
        ? renderizarSpotlightFrota(frotaExpandida, agrupado[frotaExpandida])
        : "";

    listaFrotas.innerHTML = `${cardsHtml}${spotlightHtml}`;
    aplicarFocoPendenteFrota();
}

function prepararEdicao(id) {
    executarTransacao(STORE_SAIDAS, "readonly").get(id).onsuccess = (event) => {
        const item = event.target.result;
        if (!item) {
            return;
        }

        aplicarRegistroEmEdicao(item);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
}

async function deletarItem(id) {
    const confirmou = await confirmarAcaoCritica({
        variant: "danger",
        badge: "Exclusão de registro",
        titulo: "Excluir saída registrada",
        mensagem: "Deseja excluir esta saída?",
        detalhe: "O registro será removido da frota e deixará de aparecer nos relatórios e na exportação.",
        textoConfirmar: "Excluir saída"
    });

    if (!confirmou) {
        return;
    }

    executarTransacao(STORE_SAIDAS, "readwrite").delete(id).onsuccess = async () => {
        if (registroSaidaEmEdicao?.id === id) {
            resetarFormulario(false);
        }

        await carregarDados();
        // Notificar outras abas sobre atualização de saídas
        localStorage.setItem('almox_saidas_updated', Date.now().toString());
        window.mostrarToast?.({
            variant: "success",
            title: "Saída removida",
            message: "O registro foi excluído da lista com sucesso."
        });
        inputFrota.focus();
    };
}

function resetarFormulario(manterFrota = false) {
    const frotaAtual = inputFrota.value;
    formSaida.reset();
    definirCampoOrdemServicoAtivo(false);
    removerSessionStorage(SAIDA_DRAFT_STORAGE_KEY);
    document.getElementById("editId").value = "";
    document.getElementById("editData").value = "";
    registroSaidaEmEdicao = null;
    btnSubmit.textContent = "Registrar saída";
    btnSubmit.className = "btn-add";
    btnCancel.hidden = true;
    document.getElementById("containerCampos").classList.remove("form-editing");
    limparSugestoes();

    if (manterFrota) {
        inputFrota.value = frotaAtual;
        inputQuantidade.value = "1";
        inputCodigo.focus();
        return;
    }

    inputQuantidade.value = "1";
    inputFrota.focus();
}

function exportarCSV() {
    const listaExportacao = filtrarSaidas();
    let csv = "Frota;Código;Quantidade;Descrição;OS;Data;Atualizado em\n";

    listaExportacao.forEach((item) => {
        csv += `${item.frota};${item.codigo};${item.qtd};${item.desc};${item.os || ""};${item.data};${formatarDataExibicao(item)}\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Almox_Project_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.mostrarToast?.({
        variant: "info",
        title: "Exportação concluída",
        message: `${formatarContagem(listaExportacao.length, "registro", "registros")} enviados para o arquivo CSV.`
    });
}

async function limparTudo() {
    const confirmou = await confirmarAcaoCritica({
        variant: "danger",
        badge: "Ação irreversível",
        titulo: "Limpar todas as saídas",
        mensagem: "Deseja remover todas as saídas registradas?",
        detalhe: "O catálogo de itens será mantido, mas todo o histórico de movimentações será apagado.",
        textoConfirmar: "Limpar histórico"
    });

    if (!confirmou) {
        return;
    }

    const store = executarTransacao(STORE_SAIDAS, "readwrite");
    const clearRequest = store.clear();

    clearRequest.onsuccess = async () => {
        resetarFormulario(false);
        await carregarDados();
        window.mostrarToast?.({
            variant: "warning",
            title: "Histórico limpo",
            message: "Todas as saídas registradas foram removidas. O catálogo de itens foi mantido."
        });
        inputFrota.focus();
    };

    clearRequest.onerror = () => {
        console.error("Erro ao limpar histórico:", clearRequest.error);
        window.mostrarToast?.({
            variant: "danger",
            title: "Erro ao limpar",
            message: "Não foi possível limpar o histórico de saídas."
        });
    };
}

async function exportarTodosDados() {
    try {
        if (!db) {
            throw new Error("Banco de dados ainda não inicializado. Tente novamente em alguns segundos.");
        }

        // Carregar dados mais recentes
        await carregarCatalogo();
        await carregarDados();

        const dadosExportacao = {
            saidas: saidas,
            itens: catalogoItens,
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

        window.mostrarToast?.({
            variant: "info",
            title: "Exportação concluída",
            message: `${formatarContagem(saidas.length, "saída", "saídas")} e ${formatarContagem(catalogoItens.length, "item", "itens")} exportados.`
        });
    } catch (error) {
        console.error("Erro ao exportar dados:", error);
        window.mostrarToast?.({
            variant: "danger",
            title: "Erro na exportação",
            message: "Não foi possível exportar os dados."
        });
    }
}

async function importarDados() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            if (!db) {
                throw new Error("Banco de dados ainda não inicializado. Tente novamente em alguns segundos.");
            }

            const text = await file.text();
            const dadosImportacao = JSON.parse(text);

            // Validar estrutura do arquivo
            if (!dadosImportacao.saidas || !dadosImportacao.itens || !Array.isArray(dadosImportacao.saidas) || !Array.isArray(dadosImportacao.itens)) {
                throw new Error("Arquivo inválido: estrutura incorreta. Deve conter arrays 'saidas' e 'itens'.");
            }

            // Validar dados das saídas
            for (const saida of dadosImportacao.saidas) {
                if (typeof saida !== 'object' || !saida.frota || !saida.codigo || typeof saida.qtd !== 'number') {
                    throw new Error("Dados de saída inválidos: cada saída deve ter 'frota', 'codigo' e 'qtd' (número).");
                }
            }

            // Validar dados dos itens
            for (const item of dadosImportacao.itens) {
                if (typeof item !== 'object' || !item.codigo || !item.descricao) {
                    throw new Error("Dados de item inválidos: cada item deve ter 'codigo' e 'descricao'.");
                }
            }

            // Confirmar importacao
            const confirmou = await confirmarAcaoCritica({
                variant: "warning",
                badge: "Importação de dados",
                titulo: "Importar dados do backup",
                mensagem: `Deseja importar ${formatarContagem(dadosImportacao.saidas.length, "saída", "saídas")} e ${formatarContagem(dadosImportacao.itens.length, "item", "itens")}?`,
                detalhe: "Os dados atuais serão substituídos pelos dados do arquivo. Esta ação não pode ser desfeita.",
                textoConfirmar: "Importar dados"
            });

            if (!confirmou) return;

            // Limpar dados atuais
            const transaction = db.transaction([STORE_SAIDAS, STORE_ITENS], "readwrite");
            const storeSaidas = transaction.objectStore(STORE_SAIDAS);
            const storeItens = transaction.objectStore(STORE_ITENS);

            await Promise.all([
                new Promise(resolve => storeSaidas.clear().onsuccess = resolve),
                new Promise(resolve => storeItens.clear().onsuccess = resolve)
            ]);

            // Importar saidas
            const saidasPromises = dadosImportacao.saidas.map(saida => {
                return new Promise((resolve, reject) => {
                    const request = storeSaidas.put(saida);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(new Error(`Erro ao importar saída: ${saida.id || 'sem id'}`));
                });
            });

            // Importar itens
            const itensPromises = dadosImportacao.itens.map(item => {
                return new Promise((resolve, reject) => {
                    const request = storeItens.put(item);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(new Error(`Erro ao importar item: ${item.codigo}`));
                });
            });

            // Aguardar todas as operações
            await Promise.all([...saidasPromises, ...itensPromises]);

            // Aguardar transacao completar
            await new Promise(resolve => transaction.oncomplete = resolve);

            // Recarregar dados
            await carregarCatalogo();
            await carregarDados();

            // Notificar outras abas sobre atualização de saídas
            localStorage.setItem('almox_saidas_updated', Date.now().toString());

            window.mostrarToast?.({
                variant: "success",
                title: "Importação concluída",
                message: `${formatarContagem(dadosImportacao.saidas.length, "saída", "saídas")} e ${formatarContagem(dadosImportacao.itens.length, "item", "itens")} importados.`
            });

        } catch (error) {
            console.error("Erro ao importar dados:", error);
            window.mostrarToast?.({
                variant: "danger",
                title: "Erro na importação",
                message: error.message || "Não foi possível importar os dados."
            });
        }
    };

    input.click();
}

window.abrirModalItens = abrirModalItens;
window.abrirPaginaItens = abrirPaginaItens;
window.fecharModalItens = fecharModalItens;
window.prepararEdicaoItemCatalogo = prepararEdicaoItemCatalogo;
window.deletarItemCatalogo = deletarItemCatalogo;
window.responderConfirmacaoItem = responderConfirmacaoItem;
window.prepararEdicao = prepararEdicao;
window.prepararEdicaoPeloSpotlight = prepararEdicaoPeloSpotlight;
window.deletarItem = deletarItem;
window.deletarItemPeloSpotlight = deletarItemPeloSpotlight;
window.handleRowClick = handleRowClick;
window.toggleDetalhesFrota = toggleDetalhesFrota;
window.minimizarDetalhesFrotas = minimizarDetalhesFrotas;
window.resetarFormulario = resetarFormulario;
window.exportarCSV = exportarCSV;
window.exportarTodosDados = exportarTodosDados;
window.importarDados = importarDados;
window.restaurarBackupAutomatico = restaurarBackupAutomatico;
window.limparTudo = limparTudo;
