// Pages that are only content plus the menu: about.html and 404.html. Shared helpers are in common.js.
//
// The public (user) menu is the default, because anyone can land here (a link, a QR code, a mistyped address).
// Age managers arrive from their own menu, whose about link carries ?source=leader.
loadMenu(getMenuSource("user"));
