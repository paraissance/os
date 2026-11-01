/**
 * The shell remembers the sidebar (folded unless it was opened) and the theme
 * (the system's until one is chosen). The head script applies both before the
 * first paint, so a reload never flashes the wrong one.
 */
export const NAV_KEY = "jodyos-nav";
export const THEME_KEY = "jodyos-theme";
export const SHELL_SCRIPT = `(function(){var d=document.documentElement,n,t;try{n=localStorage.getItem("${NAV_KEY}");t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(n!=="open")d.dataset.nav="closed";if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))d.dataset.theme="dark"})()`;
