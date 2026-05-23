const form = document.querySelector("#booking-form");
const message = document.querySelector("#booking-message");
const t = window.TaxiI18n.t;
const estimateCard = document.querySelector("#fare-estimate");
const estimateDistance = document.querySelector("#estimate-distance");
const estimateDuration = document.querySelector("#estimate-duration");
const estimatePrice = document.querySelector("#estimate-price");
const estimateStatus = document.querySelector("#estimate-status");
const pickupInput = form.elements.pickup_address;
const destinationInput = form.elements.destination;

const pricing = {
  baseFee: 10,
  perKilometer: 2,
  perMinute: 0.6,
};
const localeByLanguage = {
  fr: "fr-FR",
  en: "en-GB",
  zh: "zh-CN",
  ar: "ar-SA",
};
let estimateTimer;
let estimateAbortController;
let latestEstimate;


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
    hideEstimate();
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
  if (latestEstimate) renderEstimate(latestEstimate);
  if (estimateCard.classList.contains("loading")) estimateStatus.textContent = t("estimateLoading");
});


function estimateLocale() {
  return localeByLanguage[window.TaxiI18n.currentLanguage()] || "fr-FR";
}

function formatDistance(distanceKm) {
  return `${new Intl.NumberFormat(estimateLocale(), {
    maximumFractionDigits: 1,
    minimumFractionDigits: distanceKm < 10 ? 1 : 0,
  }).format(distanceKm)} km`;
}

function formatMinutes(durationMinutes) {
  return `${new Intl.NumberFormat(estimateLocale(), { maximumFractionDigits: 0 }).format(Math.round(durationMinutes))} min`;
}

function formatPrice(price) {
  return new Intl.NumberFormat(estimateLocale(), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(price));
}

function hideEstimate() {
  if (estimateAbortController) estimateAbortController.abort();
  clearTimeout(estimateTimer);
  latestEstimate = null;
  estimateCard.classList.add("hidden");
  estimateCard.classList.remove("loading");
}

function showEstimateLoading() {
  estimateCard.classList.remove("hidden");
  estimateCard.classList.add("loading");
  estimateDistance.textContent = "-";
  estimateDuration.textContent = "-";
  estimatePrice.textContent = "-";
  estimateStatus.textContent = t("estimateLoading");
}

function renderEstimate(estimate) {
  latestEstimate = estimate;
  estimateCard.classList.remove("hidden", "loading");
  estimateDistance.textContent = formatDistance(estimate.distanceKm);
  estimateDuration.textContent = formatMinutes(estimate.durationMinutes);
  estimatePrice.textContent = formatPrice(estimate.price);
  estimateStatus.textContent = "";
}

async function geocodeAddress(address, signal) {
  const params = new URLSearchParams({
    q: address,
    limit: "1",
    lat: "48.8566",
    lon: "2.3522",
    lang: window.TaxiI18n.currentLanguage(),
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Geocoding failed");
  const data = await response.json();
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error("Address not found");
  return { lon: coordinates[0], lat: coordinates[1] };
}

async function routeBetween(origin, destination, signal) {
  const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&alternatives=false&steps=false`,
    { signal }
  );
  if (!response.ok) throw new Error("Route failed");
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("Route not found");
  const distanceKm = route.distance / 1000;
  const durationMinutes = route.duration / 60;
  return {
    distanceKm,
    durationMinutes,
    price: pricing.baseFee + (distanceKm * pricing.perKilometer) + (durationMinutes * pricing.perMinute),
  };
}

function scheduleEstimate() {
  clearTimeout(estimateTimer);
  if (estimateAbortController) estimateAbortController.abort();

  const pickup = pickupInput.value.trim();
  const destination = destinationInput.value.trim();
  if (pickup.length < 3 || destination.length < 3) {
    hideEstimate();
    return;
  }

  estimateTimer = setTimeout(async () => {
    const controller = new AbortController();
    estimateAbortController = controller;
    showEstimateLoading();
    try {
      const [origin, target] = await Promise.all([
        geocodeAddress(pickup, controller.signal),
        geocodeAddress(destination, controller.signal),
      ]);
      const estimate = await routeBetween(origin, target, controller.signal);
      if (estimateAbortController === controller) renderEstimate(estimate);
    } catch (error) {
      if (error.name !== "AbortError" && estimateAbortController === controller) hideEstimate();
    }
  }, 650);
}

[pickupInput, destinationInput].forEach((input) => {
  input.addEventListener("input", scheduleEstimate);
  input.addEventListener("change", scheduleEstimate);
});
