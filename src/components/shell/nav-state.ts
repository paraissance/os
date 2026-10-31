/**
 * The desktop sidebar remembers being folded to its icon rail. The head script
 * applies that before the first paint, so a reload never flashes it open.
 */
export const NAV_KEY = "jodyos-nav";
export const NAV_SCRIPT = `try{if(localStorage.getItem("${NAV_KEY}")==="closed")document.documentElement.dataset.nav="closed"}catch(e){}`;
