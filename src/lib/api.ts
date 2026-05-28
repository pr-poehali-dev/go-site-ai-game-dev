const URLS = {
  auth: "https://functions.poehali.dev/dbe421e3-8c22-49b1-b950-72c55b2c8b30",
  projects: "https://functions.poehali.dev/64277570-8553-4968-8681-ffe7548638cf",
  wallet: "https://functions.poehali.dev/1a954e08-0583-4766-9613-d5293fdde716",
  payment: "https://functions.poehali.dev/277bf815-881e-49d8-8edf-9d6d7d582227",
};

function getToken(): string {
  return localStorage.getItem("nexus_token") || "";
}

function setToken(token: string) {
  localStorage.setItem("nexus_token", token);
}

function clearToken() {
  localStorage.removeItem("nexus_token");
  localStorage.removeItem("nexus_user");
}

async function call(url: string, body: object) {
  const token = getToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(url: string) {
  const token = getToken();
  const res = await fetch(url, {
    method: "GET",
    headers: token ? { "X-Auth-Token": token } : {},
  });
  return res.json();
}

export const api = {
  // AUTH
  async register(email: string, password: string, username: string) {
    const data = await call(URLS.auth, { action: "register", email, password, username });
    if (data.token) {
      setToken(data.token);
      localStorage.setItem("nexus_user", JSON.stringify(data.user));
    }
    return data;
  },

  async login(email: string, password: string) {
    const data = await call(URLS.auth, { action: "login", email, password });
    if (data.token) {
      setToken(data.token);
      localStorage.setItem("nexus_user", JSON.stringify(data.user));
    }
    return data;
  },

  async logout() {
    await call(URLS.auth, { action: "logout" });
    clearToken();
  },

  async me() {
    if (!getToken()) return null;
    const data = await get(URLS.auth);
    if (data.user) {
      localStorage.setItem("nexus_user", JSON.stringify(data.user));
    }
    return data.user || null;
  },

  getLocalUser() {
    const raw = localStorage.getItem("nexus_user");
    return raw ? JSON.parse(raw) : null;
  },

  isLoggedIn() {
    return !!getToken();
  },

  // PROJECTS
  async getProjects() {
    const data = await call(URLS.projects, { action: "list" });
    return data.projects || [];
  },

  async createProject(project: {
    title: string;
    description?: string;
    genre?: string;
    engine?: string;
    platform?: string;
    graphics_style?: string;
  }) {
    return call(URLS.projects, { action: "create", ...project });
  },

  async updateProject(project_id: number, fields: object) {
    return call(URLS.projects, { action: "update", project_id, ...fields });
  },

  async getPortfolio() {
    const data = await call(URLS.projects, { action: "portfolio" });
    return data.projects || [];
  },

  // WALLET
  async getWallet() {
    return call(URLS.wallet, { action: "balance" });
  },

  async subscribe(plan: string) {
    return call(URLS.wallet, { action: "subscribe", plan });
  },

  // PAYMENT
  async createPayment(plan: string, gateway: string) {
    return call(URLS.payment, { action: "create", plan, gateway });
  },

  async getPaymentConfig() {
    return call(URLS.payment, { action: "config" });
  },

  async checkSubscription() {
    return call(URLS.payment, { action: "check" });
  },
};