const state = {
  section: "dashboard",
  clients: [],
  appointments: [],
  stats: null,
};

const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");
const modal = document.querySelector("#modal");
const modalForm = document.querySelector("#modal-form");
const searchInput = document.querySelector("#global-search");
const statusFilter = document.querySelector("#status-filter");
const appMessage = document.querySelector("#app-message");

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const t = window.TaxiI18n.t;
const statusKeys = {
  pending: "pending",
  confirmed: "confirmed",
  in_progress: "inProgress",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "noShow",
};

function serializeForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(translateApiError(data.error) || t("requestFailed"));
  return data;
}

function translateApiError(message) {
  const map = {
    "Invalid username or password": "invalidLogin",
    "Authentication required": "authRequired",
    "Request failed": "requestFailed",
  };
  return map[message] ? t(map[message]) : message;
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

function statusLabel(value) {
  return t(statusKeys[value] || value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function setSection(section) {
  state.section = section;
  document.querySelectorAll(".section").forEach((el) => el.classList.toggle("active", el.id === section));
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.section === section));
  document.querySelector("#section-title").textContent = t(section);
  statusFilter.style.display = section === "appointments" ? "block" : "none";
}

function setAppMessage(text = "", type = "") {
  appMessage.textContent = text;
  appMessage.className = `message app-message ${type}`.trim();
}

async function loadAll() {
  const search = encodeURIComponent(searchInput.value.trim());
  const status = encodeURIComponent(statusFilter.value);
  setAppMessage("");
  try {
    const [clients, appointments, stats] = await Promise.all([
      api(`/api/clients${search ? `?search=${search}` : ""}`),
      api(`/api/appointments?search=${search}&status=${status}`),
      api("/api/stats/revenue"),
    ]);
    state.clients = clients.clients;
    state.appointments = appointments.appointments;
    state.stats = stats;
    render();
  } catch (error) {
    setAppMessage(error.message, "error");
  }
}

function render() {
  renderStats();
  renderClients();
  renderAppointments();
}

function renderStats() {
  const summary = state.stats?.summary || {};
  document.querySelector("#stat-total").textContent = summary.total_appointments || 0;
  document.querySelector("#stat-revenue").textContent = euro.format(Number(summary.completed_revenue || 0));
  document.querySelector("#stat-pending").textContent = summary.pending || 0;
  document.querySelector("#stat-completed").textContent = summary.completed || 0;

  const monthly = state.stats?.monthly || [];
  const max = Math.max(...monthly.map((row) => Number(row.revenue)), 1);
  document.querySelector("#monthly-revenue").innerHTML = monthly.length
    ? monthly.map((row) => `
      <div class="bar-row">
        <span>${escapeHtml(row.month)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Number(row.revenue) / max * 100)}%"></div></div>
        <strong>${euro.format(Number(row.revenue))}</strong>
      </div>
    `).join("")
    : `<p class="message">${t("noCompletedRevenue")}</p>`;
}

function renderClients() {
  const target = document.querySelector("#clients-list");
  target.innerHTML = state.clients.length ? state.clients.map((client) => `
    <article class="row-card">
      <div>
        <h4>${escapeHtml(client.name)}</h4>
        <div class="meta">
          <span>${escapeHtml(client.phone)}</span>
          ${client.email ? `<span>${escapeHtml(client.email)}</span>` : ""}
          <span>${client.appointment_count || 0} ${t("appointmentCount")}</span>
          <span>${euro.format(Number(client.total_revenue || 0))}</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="small-button" data-edit-client="${client.id}">${t("edit")}</button>
        <button class="small-button danger" data-delete-client="${client.id}">${t("delete")}</button>
      </div>
    </article>
  `).join("") : `<p class="message">${t("noClients")}</p>`;
}

function renderAppointments() {
  const target = document.querySelector("#appointments-list");
  target.innerHTML = state.appointments.length ? state.appointments.map((item) => `
    <article class="row-card">
      <div>
        <h4>${escapeHtml(item.client_name)} <span class="status ${item.status}">${statusLabel(item.status)}</span></h4>
        <div class="meta">
          <span>${escapeHtml(item.client_phone)}</span>
          <span>${escapeHtml(item.appointment_date)} ${t("at")} ${String(item.appointment_time).slice(0, 5)}</span>
          <span>${escapeHtml(item.pickup_address)} ${t("to")} ${escapeHtml(item.destination)}</span>
          <span>${item.passenger_count} ${t("passengers")}</span>
          ${item.fare_amount ? `<span>${euro.format(Number(item.fare_amount))}</span>` : ""}
        </div>
      </div>
      <div class="row-actions">
        <button class="small-button" data-edit-appointment="${item.id}">${t("edit")}</button>
        <button class="small-button danger" data-delete-appointment="${item.id}">${t("delete")}</button>
      </div>
    </article>
  `).join("") : `<p class="message">${t("noAppointments")}</p>`;
}

function openClientModal(client = {}) {
  modalForm.innerHTML = `
    <h3>${client.id ? t("editClient") : t("addClient")}</h3>
    <label>${t("name")}<input name="name" value="${escapeHtml(client.name || "")}" required></label>
    <label>${t("phone")}<input name="phone" value="${escapeHtml(client.phone || "")}" required></label>
    <label>${t("email")}<input name="email" type="email" value="${escapeHtml(client.email || "")}"></label>
    <label class="span-2">${t("notes")}<textarea name="notes" rows="3">${escapeHtml(client.notes || "")}</textarea></label>
    <div class="message span-2" aria-live="polite"></div>
    <div class="modal-actions">
      <button type="button" class="ghost" data-close>${t("cancel")}</button>
      <button type="submit" class="primary">${t("saveClient")}</button>
    </div>
  `;
  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    const body = serializeForm(modalForm);
    try {
      await api(client.id ? `/api/clients/${client.id}` : "/api/clients", {
        method: client.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      modal.close();
      await loadAll();
    } catch (error) {
      modalForm.querySelector(".message").textContent = error.message;
      modalForm.querySelector(".message").classList.add("error");
    }
  };
  modal.showModal();
}

function openAppointmentModal(item = {}) {
  modalForm.innerHTML = `
    <h3>${item.id ? t("editAppointment") : t("addAppointment")}</h3>
    <label>${t("clientName")}<input name="client_name" value="${escapeHtml(item.client_name || "")}" required></label>
    <label>${t("clientPhone")}<input name="client_phone" value="${escapeHtml(item.client_phone || "")}" required></label>
    <label class="span-2">${t("pickupAddress")}<input name="pickup_address" value="${escapeHtml(item.pickup_address || "")}" required></label>
    <label class="span-2">${t("destination")}<input name="destination" value="${escapeHtml(item.destination || "")}" required></label>
    <label>${t("date")}<input name="date" type="date" value="${escapeHtml(item.appointment_date || "")}" required></label>
    <label>${t("time")}<input name="time" type="time" value="${String(item.appointment_time || "").slice(0, 5)}" required></label>
    <label>${t("passengers")}<input name="passenger_count" type="number" min="1" max="99" value="${escapeHtml(item.passenger_count || 1)}" required></label>
    <label>${t("status")}<select name="status">
      ${["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"].map((status) => `
        <option value="${status}" ${status === (item.status || "pending") ? "selected" : ""}>${statusLabel(status)}</option>
      `).join("")}
    </select></label>
    <label>${t("fareAmount")}<input name="fare_amount" type="number" min="0" step="0.01" value="${escapeHtml(item.fare_amount || "")}"></label>
    <label class="span-2">${t("notes")}<textarea name="notes" rows="3">${escapeHtml(item.notes || "")}</textarea></label>
    <div class="message span-2" aria-live="polite"></div>
    <div class="modal-actions">
      <button type="button" class="ghost" data-close>${t("cancel")}</button>
      <button type="submit" class="primary">${t("saveAppointment")}</button>
    </div>
  `;
  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await api(item.id ? `/api/appointments/${item.id}` : "/api/appointments", {
        method: item.id ? "PATCH" : "POST",
        body: JSON.stringify(serializeForm(modalForm)),
      });
      modal.close();
      await loadAll();
    } catch (error) {
      modalForm.querySelector(".message").textContent = error.message;
      modalForm.querySelector(".message").classList.add("error");
    }
  };
  modal.showModal();
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#login-message");
  const button = event.target.querySelector("button");
  button.disabled = true;
  button.textContent = t("signingIn");
  message.textContent = "";
  try {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify(serializeForm(event.target)) });
    showApp();
    setSection("dashboard");
    await loadAll();
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  } finally {
    button.disabled = false;
    button.textContent = t("signIn");
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  showLogin();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setSection(button.dataset.section));
});

document.querySelector("#new-client").addEventListener("click", () => openClientModal());
document.querySelector("#new-appointment").addEventListener("click", () => openAppointmentModal());

document.body.addEventListener("click", async (event) => {
  const close = event.target.closest("[data-close]");
  if (close) modal.close();

  const editClient = event.target.closest("[data-edit-client]");
  if (editClient) openClientModal(state.clients.find((client) => String(client.id) === editClient.dataset.editClient));

  const deleteClient = event.target.closest("[data-delete-client]");
  if (deleteClient && confirm(t("deleteClientConfirm"))) {
    await api(`/api/clients/${deleteClient.dataset.deleteClient}`, { method: "DELETE" });
    await loadAll();
  }

  const editAppointment = event.target.closest("[data-edit-appointment]");
  if (editAppointment) {
    openAppointmentModal(state.appointments.find((item) => String(item.id) === editAppointment.dataset.editAppointment));
  }

  const deleteAppointment = event.target.closest("[data-delete-appointment]");
  if (deleteAppointment && confirm(t("deleteAppointmentConfirm"))) {
    await api(`/api/appointments/${deleteAppointment.dataset.deleteAppointment}`, { method: "DELETE" });
    await loadAll();
  }
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadAll, 250);
});
statusFilter.addEventListener("change", loadAll);

api("/api/auth/me")
  .then(async () => {
    showApp();
    setSection("dashboard");
    await loadAll();
  })
  .catch(() => showLogin());

document.addEventListener("languagechange", () => {
  setSection(state.section);
  render();
  const loginButton = document.querySelector("#login-form button[type='submit']");
  loginButton.textContent = loginButton.disabled ? t("signingIn") : t("signIn");
});
