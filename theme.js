const THEME_STORAGE_KEY = "almox_theme";
const DEFAULT_THEME = "default";
const AVAILABLE_THEMES = new Set(["default", "light"]);
const THEME_META_COLORS = Object.freeze({
    default: "#1e293b",
    light: "#ffffff"
});

inicializarTema();

function inicializarTema() {
    const themeSelect = document.getElementById("themeSelect");
    const savedTheme = obterTemaSalvo();

    aplicarTema(savedTheme, false);

    if (!themeSelect) {
        return;
    }

    themeSelect.value = savedTheme;
    themeSelect.addEventListener("change", (event) => {
        aplicarTema(event.target.value, true);
    });
}

function obterTemaSalvo() {
    try {
        return normalizarTema(localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME);
    } catch (error) {
        return DEFAULT_THEME;
    }
}

function aplicarTema(themeName, persist = true) {
    const normalizedTheme = normalizarTema(themeName);
    document.documentElement.setAttribute("data-theme", normalizedTheme);
    atualizarMetaThemeColor(normalizedTheme);

    const themeSelect = document.getElementById("themeSelect");
    if (themeSelect && themeSelect.value !== normalizedTheme) {
        themeSelect.value = normalizedTheme;
    }

    if (!persist) {
        return;
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    } catch (error) {
        console.warn("Não foi possível salvar o tema selecionado.");
    }
}

function normalizarTema(themeName) {
    return AVAILABLE_THEMES.has(themeName) ? themeName : DEFAULT_THEME;
}

function atualizarMetaThemeColor(themeName) {
    const themeMetaColor = document.querySelector('meta[name="theme-color"]');
    if (!themeMetaColor) {
        return;
    }

    themeMetaColor.setAttribute("content", THEME_META_COLORS[themeName] || THEME_META_COLORS[DEFAULT_THEME]);
}

window.aplicarTema = aplicarTema;
