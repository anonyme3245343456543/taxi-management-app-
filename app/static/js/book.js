const form = document.querySelector("#booking-form");
const message = document.querySelector("#booking-message");
const t = window.TaxiI18n.t;

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message span-2 ${type}`.trim();
}

function payloadFromForm(formElement) {
  return Object.fromEntries(new FormData(formElement).entries());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = t("submitting");
  setMessage("");

  try {
    const response = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(form)),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("bookingError"));
    form.reset();
    form.passenger_count.value = "1";
    setMessage(t("bookingSuccess"), "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = t("submitBooking");
  }
});

document.addEventListener("languagechange", () => {
  const button = form.querySelector("button[type='submit']");
  button.textContent = button.disabled ? t("submitting") : t("submitBooking");
});
