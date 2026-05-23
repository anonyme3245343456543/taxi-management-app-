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
  perKilometer: 1.8,
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
const addressAutocompleteFields = [
  {
    input: pickupInput,
    menu: document.querySelector("[data-address-suggestions='pickup']"),
    timer: null,
    controller: null,
  },
  {
    input: destinationInput,
    menu: document.querySelector("[data-address-suggestions='destination']"),
    timer: null,
    controller: null,
  },
];


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
    hideAllAddressSuggestions();
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
  hideAllAddressSuggestions();
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

async function fetchPhotonFeatures(query, signal, limit = 1) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    lat: "48.8566",
    lon: "2.3522",
    lang: window.TaxiI18n.currentLanguage(),
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Geocoding failed");
  const data = await response.json();
  return Array.isArray(data.features) ? data.features : [];
}

async function geocodeAddress(address, signal) {
  const feature = (await fetchPhotonFeatures(address, signal, 1))[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error("Address not found");
  return { lon: coordinates[0], lat: coordinates[1] };
}

function addressSuggestionFromFeature(feature) {
  const properties = feature.properties || {};
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const place = properties.name || street || properties.city || properties.county || properties.state || properties.country;
  const cityLine = [properties.postcode, properties.city || properties.county || properties.state].filter(Boolean).join(" ");
  const detailParts = [street && street !== place ? street : "", cityLine, properties.country].filter(Boolean);
  const secondary = [...new Set(detailParts)].join(", ");
  const label = [place, secondary].filter(Boolean).join(", ");

  if (!label) return null;
  return {
    label,
    main: place || label,
    secondary,
  };
}

function hideAddressSuggestions(field) {
  clearTimeout(field.timer);
  if (field.controller) field.controller.abort();
  field.controller = null;
  field.menu.replaceChildren();
  field.menu.classList.add("hidden");
  field.input.setAttribute("aria-expanded", "false");
}

function hideAllAddressSuggestions() {
  addressAutocompleteFields.forEach(hideAddressSuggestions);
}

function selectAddressSuggestion(field, suggestion) {
  field.input.value = suggestion.label;
  field.input.focus();
  hideAddressSuggestions(field);
  scheduleEstimate(0);
}

function renderAddressSuggestions(field, suggestions) {
  if (!suggestions.length) {
    hideAddressSuggestions(field);
    return;
  }

  const fragment = document.createDocumentFragment();
  suggestions.forEach((suggestion, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "address-option";
    option.id = `${field.menu.id}-option-${index}`;
    option.setAttribute("role", "option");

    const main = document.createElement("strong");
    main.textContent = suggestion.main;
    option.append(main);

    if (suggestion.secondary) {
      const secondary = document.createElement("span");
      secondary.textContent = suggestion.secondary;
      option.append(secondary);
    }

    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => selectAddressSuggestion(field, suggestion));
    fragment.append(option);
  });

  field.menu.replaceChildren(fragment);
  field.menu.classList.remove("hidden");
  field.input.setAttribute("aria-expanded", "true");
}

function scheduleAddressSuggestions(field) {
  clearTimeout(field.timer);
  if (field.controller) field.controller.abort();

  const query = field.input.value.trim();
  if (query.length < 3) {
    hideAddressSuggestions(field);
    return;
  }

  field.timer = setTimeout(async () => {
    const controller = new AbortController();
    field.controller = controller;
    try {
      const features = await fetchPhotonFeatures(query, controller.signal, 5);
      if (field.controller !== controller) return;
      const suggestions = features.map(addressSuggestionFromFeature).filter(Boolean);
      renderAddressSuggestions(field, suggestions);
    } catch (error) {
      if (error.name !== "AbortError" && field.controller === controller) hideAddressSuggestions(field);
    }
  }, 300);
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

function scheduleEstimate(delay = 650) {
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
  }, delay);
}

addressAutocompleteFields.forEach((field) => {
  field.menu.id = field.menu.id || `${field.input.id}-suggestions`;
  field.input.setAttribute("aria-controls", field.menu.id);
  field.input.addEventListener("input", () => {
    scheduleEstimate();
    scheduleAddressSuggestions(field);
  });
  field.input.addEventListener("change", () => scheduleEstimate());
  field.input.addEventListener("focus", () => scheduleAddressSuggestions(field));
  field.input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideAddressSuggestions(field);
  });
});

document.addEventListener("click", (event) => {
  addressAutocompleteFields.forEach((field) => {
    if (!field.input.closest(".address-field").contains(event.target)) hideAddressSuggestions(field);
  });
});
