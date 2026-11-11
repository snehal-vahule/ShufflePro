import { isSupabaseConfigured, supabase } from "./supabaseClient.mjs";

const elements = {
  authSection: document.getElementById("authSection"),
  appShell: document.getElementById("appShell"),
  authForm: document.getElementById("authForm"),
  authTitle: document.getElementById("authTitle"),
  authDescription: document.getElementById("authDescription"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authPasswordField: document.getElementById("authPasswordField"),
  authPasswordLabel: document.getElementById("authPasswordLabel"),
  authSubmit: document.getElementById("authSubmit"),
  authStatus: document.getElementById("authStatus"),
  showForgotPassword: document.getElementById("showForgotPassword"),
  showRegister: document.getElementById("showRegister"),
  showLogin: document.getElementById("showLogin"),
  accountEmail: document.getElementById("accountEmail"),
  signOutBtn: document.getElementById("signOutBtn")
};

let view = "login";
let callbacks = null;

function showStatus(message, isError = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle("error", isError);
}

function renderView() {
  const views = {
    login: {
      title: "Sign in",
      description: "Sign in to manage your ShufflePro courts.",
      submit: "Sign in",
      showPassword: true,
      passwordLabel: "Password",
      passwordAutocomplete: "current-password",
      showForgot: true,
      showRegister: true,
      showLogin: false
    },
    register: {
      title: "Create an account",
      description: "Register with your email address and a password.",
      submit: "Create account",
      showPassword: true,
      passwordLabel: "Password",
      passwordAutocomplete: "new-password",
      showForgot: false,
      showRegister: false,
      showLogin: true
    },
    forgot: {
      title: "Reset your password",
      description: "We’ll email you a link to reset your password.",
      submit: "Send reset link",
      showPassword: false,
      showForgot: false,
      showRegister: false,
      showLogin: true
    },
    recovery: {
      title: "Choose a new password",
      description: "Enter a new password for your account.",
      submit: "Update password",
      showPassword: true,
      passwordLabel: "New password",
      passwordAutocomplete: "new-password",
      showForgot: false,
      showRegister: false,
      showLogin: false
    }
  };
  const config = views[view];

  elements.authTitle.textContent = config.title;
  elements.authDescription.textContent = config.description;
  elements.authSubmit.textContent = config.submit;
  elements.authPasswordField.classList.toggle("hidden", !config.showPassword);
  elements.authPassword.required = config.showPassword;
  elements.authPassword.autocomplete = config.passwordAutocomplete || "new-password";
  if (config.passwordLabel) {
    elements.authPasswordLabel.textContent = config.passwordLabel;
  }
  elements.showForgotPassword.classList.toggle("hidden", !config.showForgot);
  elements.showRegister.classList.toggle("hidden", !config.showRegister);
  elements.showLogin.classList.toggle("hidden", !config.showLogin);
}

function setView(nextView) {
  const email = elements.authEmail.value;
  view = nextView;
  elements.authForm.reset();
  elements.authEmail.value = email;
  showStatus("");
  renderView();
}

function showSignedOut() {
  elements.appShell.classList.add("hidden");
  elements.authSection.classList.remove("hidden");
}

function showSignedIn(user) {
  elements.accountEmail.textContent = user.email || "";
  elements.authSection.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
}

async function submitAuth(event) {
  event.preventDefault();
  if (!supabase) {
    showStatus("Supabase is not configured. Add the project URL and anon key to .env.", true);
    return;
  }

  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  elements.authSubmit.disabled = true;
  showStatus("");

  try {
    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else if (view === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`
        }
      });
      if (error) throw error;
      if (!data.session) {
        showStatus("Check your email to confirm your account, then sign in.");
      }
    } else if (view === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`
      });
      if (error) throw error;
      showStatus("If an account exists for that email, a reset link has been sent.");
    } else if (view === "recovery") {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      showStatus("Password updated. You can continue using ShufflePro.");
    }
  } catch (error) {
    showStatus(error.message || "Authentication failed. Please try again.", true);
  } finally {
    elements.authSubmit.disabled = false;
  }
}

export function initializeAuth({ onAuthenticated, onSignedOut }) {
  callbacks = { onAuthenticated, onSignedOut };
  renderView();

  elements.showForgotPassword.addEventListener("click", () => setView("forgot"));
  elements.showRegister.addEventListener("click", () => setView("register"));
  elements.showLogin.addEventListener("click", () => setView("login"));
  elements.authForm.addEventListener("submit", submitAuth);
  elements.signOutBtn.addEventListener("click", async () => {
    if (!supabase) return;
    elements.signOutBtn.disabled = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      showStatus(error.message || "Sign out failed. Please try again.", true);
      showSignedOut();
    } finally {
      elements.signOutBtn.disabled = false;
    }
  });

  if (!isSupabaseConfigured) {
    showStatus("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable sign-in.", true);
    return;
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      setView("recovery");
      showSignedOut();
      return;
    }

    if (session?.user) {
      showSignedIn(session.user);
      callbacks.onAuthenticated(session.user);
    } else {
      showSignedOut();
      callbacks.onSignedOut();
    }
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      showStatus(error.message, true);
      return;
    }
    if (!data.session) showSignedOut();
  }).catch((error) => {
    showStatus(error.message || "Could not check the current sign-in session.", true);
  });
}
