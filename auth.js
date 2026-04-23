(function () {
  const statusEl = document.getElementById("auth-status");
  const signInForm = document.getElementById("signin-form");
  const signUpForm = document.getElementById("signup-form");
  const tabSignIn = document.getElementById("tab-signin");
  const tabSignUp = document.getElementById("tab-signup");
  const signInPasswordEl = document.getElementById("signin-password");
  const signUpPasswordEl = document.getElementById("signup-password");
  const signUpPasswordConfirmEl = document.getElementById("signup-password-confirm");
  const toggleSignInPasswordBtn = document.getElementById("toggle-signin-password");
  const toggleSignUpPasswordBtn = document.getElementById("toggle-signup-password");
  const toggleSignUpConfirmPasswordBtn = document.getElementById("toggle-signup-confirm-password");

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? "#ffb3bf" : "#9bffcb";
  }

  function switchTab(mode) {
    const signIn = mode === "signin";
    tabSignIn.classList.toggle("active", signIn);
    tabSignUp.classList.toggle("active", !signIn);
    signInForm.classList.toggle("hidden", !signIn);
    signUpForm.classList.toggle("hidden", signIn);
    setStatus("");
  }

  function createClient() {
    const cfg = window.SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) {
      throw new Error("Missing Supabase URL/anon key in supabase-config.js");
    }
    return window.supabase.createClient(cfg.url, cfg.anonKey);
  }

  async function bootstrapSessionRedirect(client) {
    const { data } = await client.auth.getUser();
    if (data.user) {
      window.location.href = "index.html";
    }
  }

  async function init() {
    let client;
    try {
      client = createClient();
    } catch (error) {
      setStatus(error.message, true);
      return;
    }

    await bootstrapSessionRedirect(client);

    tabSignIn.addEventListener("click", () => switchTab("signin"));
    tabSignUp.addEventListener("click", () => switchTab("signup"));
    const wireToggle = (btn, input) => {
      if (!btn || !input) return;
      btn.addEventListener("click", () => {
        const nextType = input.type === "password" ? "text" : "password";
        input.type = nextType;
        btn.textContent = nextType === "password" ? "See" : "Hide";
      });
    };
    wireToggle(toggleSignInPasswordBtn, signInPasswordEl);
    wireToggle(toggleSignUpPasswordBtn, signUpPasswordEl);
    wireToggle(toggleSignUpConfirmPasswordBtn, signUpPasswordConfirmEl);

    signInForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("signin-email").value.trim();
      const password = document.getElementById("signin-password").value;

      setStatus("Signing in...");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message, true);
        return;
      }
      setStatus("Signed in. Redirecting...");
      window.location.href = "index.html";
    });

    signUpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const displayName = document.getElementById("signup-display-name").value.trim();
      const fullName = document.getElementById("signup-full-name").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;
      const passwordConfirm = signUpPasswordConfirmEl.value;

      if (password !== passwordConfirm) {
        setStatus("Passwords do not match.", true);
        return;
      }

      setStatus("Creating account...");
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            full_name: fullName
          }
        }
      });

      if (error) {
        setStatus(error.message, true);
        return;
      }

      // Optional profile table write for leaderboard naming.
      const user = data.user;
      if (user) {
        const { error: profileError } = await client.from("public_profiles").upsert(
          {
            user_id: user.id,
            display_name: displayName,
            full_name: fullName || null
          },
          { onConflict: "user_id" }
        );
        if (profileError) {
          console.warn("public_profiles upsert skipped/failed:", profileError.message);
        }
      }

      setStatus("Account created. Check email if confirmation is enabled. Then sign in.");
      switchTab("signin");
    });
  }

  init();
})();
