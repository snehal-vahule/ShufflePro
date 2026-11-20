import { hasValidCredentials } from "./loginConfig.mjs";

const elements = {
  form: document.getElementById("loginForm"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  error: document.getElementById("loginError"),
  submit: document.getElementById("loginSubmit"),
  loginScreen: document.getElementById("loginScreen"),
  appShell: document.getElementById("appShell"),
  logout: document.getElementById("logoutBtn")
};

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.error.textContent = "";

  if (!hasValidCredentials(elements.username.value, elements.password.value)) {
    elements.error.textContent = "Incorrect username or password.";
    elements.password.value = "";
    elements.password.focus();
    return;
  }

  elements.submit.disabled = true;
  try {
    await import("./app.mjs");
    elements.loginScreen.classList.add("hidden");
    elements.appShell.classList.remove("hidden");
    elements.logout.addEventListener("click", () => window.location.reload());
  } catch (error) {
    console.error("Could not start ShufflePro.", error);
    elements.error.textContent = "Could not start the app. Please try again.";
  } finally {
    elements.submit.disabled = false;
  }
});
