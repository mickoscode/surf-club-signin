(async () => {
  const auth0 = await createAuth0Client({
    domain: "dev-zpl25b7w2wfbe4ne.us.auth0.com",
    client_id: "xdXzECUgLFQTgy764bQJNc8dlYP5LZms",
    redirect_uri: "https://sign-in-out.com/data/index.html",
    audience: "YOUR_API_IDENTIFIER",
    cacheLocation: "localstorage"
  });

  const isAuthenticated = await auth0.isAuthenticated();

  if (isAuthenticated) {
    const user = await auth0.getUser();
    document.getElementById("user-info").textContent = `Welcome, ${user.name}`;
    document.getElementById("login").style.display = "none";
    document.getElementById("logout").style.display = "inline";
  } else {
    document.getElementById("login").style.display = "inline";
  }

  document.getElementById("login").onclick = () => auth0.loginWithRedirect({ redirect_uri: window.location.href });
  document.getElementById("logout").onclick = () => auth0.logout({ returnTo: window.location.href });

  // Handle redirect callback
  if (window.location.search.includes("code=")) {
    await auth0.handleRedirectCallback();
    window.location.replace(window.location.pathname);
  }
})();
