// Age manager guide: show the same menu as the other age manager pages (bulk, live, history, about).
// That menu is the Youth view's leader menu in the site root, one folder up, so it is loaded from there and its ./ links are
// pointed back up. Shared helpers (common.js), the stylesheet and the icon are loaded from the site root too (see index.html).
loadHeader("../header_leader.snippet", "../");
