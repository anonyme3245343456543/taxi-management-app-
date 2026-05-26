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
const dateInput = form.elements.date;
const timeInput = form.elements.time;
const bookingTypeInputs = [...form.querySelectorAll("input[name='booking_type']")];
const scheduleFields = [...form.querySelectorAll(".schedule-field")];
const urgentBookingMessage = document.querySelector("#urgent-booking-message");

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
const parisBias = {
  lat: 48.8566,
  lon: 2.3522,
};
const ileDeFranceBounds = {
  minLat: 48.12,
  maxLat: 49.25,
  minLon: 1.44,
  maxLon: 3.58,
};
const ileDeFranceDepartments = new Set(["75", "77", "78", "91", "92", "93", "94", "95"]);
const ileDeFranceLocationTerms = [
  "paris",
  "ile de france",
  "hauts de seine",
  "seine saint denis",
  "val de marne",
  "yvelines",
  "essonne",
  "seine et marne",
  "val doise",
];
const frenchCountryNames = new Set(["france", "frankreich", "francia", "frankrijk", "法国", "法國", "فرنسا"]);
const photonAutocompleteLimit = 12;
const photonCacheLimit = 40;
const visibleSuggestionLimit = 5;
const photonCache = new Map();
let estimateTimer;
let estimateAbortController;
let latestEstimate;
let submissionInFlight = false;
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

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function localDateValue(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function localTimeValue(date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function selectedBookingType() {
  return form.elements.booking_type?.value || "scheduled";
}

function setCurrentRideDateTime() {
  const now = new Date();
  dateInput.value = localDateValue(now);
  timeInput.value = localTimeValue(now);
}

function updateRideTiming(refreshImmediateTime = false) {
  const isImmediate = selectedBookingType() === "immediate";
  scheduleFields.forEach((field) => field.classList.toggle("hidden", isImmediate));
  urgentBookingMessage.classList.toggle("hidden", !isImmediate);
  dateInput.required = !isImmediate;
  timeInput.required = !isImmediate;

  if (isImmediate && (refreshImmediateTime || !dateInput.value || !timeInput.value)) {
    setCurrentRideDateTime();
  }
}

function payloadFromForm(formElement) {
  if (selectedBookingType() === "immediate") setCurrentRideDateTime();
  const payload = Object.fromEntries(new FormData(formElement).entries());
  if (latestEstimate && estimateCard.dataset.state === "ready") {
    payload.estimated_distance_km = latestEstimate.distanceKm.toFixed(1);
    payload.estimated_duration_minutes = String(Math.round(latestEstimate.durationMinutes));
    payload.estimated_price_eur = String(Math.round(latestEstimate.price));
  }
  return payload;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submissionInFlight) return;
  updateRideTiming(true);
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const button = form.querySelector("button[type='submit']");
  submissionInFlight = true;
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
    clearSelectedAddress(pickupInput);
    clearSelectedAddress(destinationInput);
    form.passenger_count.value = "1";
    form.elements.booking_type.value = "scheduled";
    updateRideTiming();
    hideEstimate();
    hideAllAddressSuggestions();
    setMessage(t("bookingSuccess"), "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    submissionInFlight = false;
    button.disabled = false;
    button.textContent = t("submitBooking");
  }
});

document.addEventListener("languagechange", () => {
  const button = form.querySelector("button[type='submit']");
  button.textContent = button.disabled ? t("submitting") : t("submitBooking");
  if (latestEstimate) renderEstimate(latestEstimate);
  if (estimateCard.dataset.state === "loading") estimateStatus.textContent = t("estimateLoading");
  if (estimateCard.dataset.state === "select-address") estimateStatus.textContent = t("estimateSelectAddress");
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
  delete estimateCard.dataset.state;
}

function showEstimateLoading() {
  estimateCard.classList.remove("hidden");
  estimateCard.classList.add("loading");
  estimateCard.dataset.state = "loading";
  estimateDistance.textContent = "-";
  estimateDuration.textContent = "-";
  estimatePrice.textContent = "-";
  estimateStatus.textContent = t("estimateLoading");
}

function showEstimateSelectAddress() {
  latestEstimate = null;
  estimateCard.classList.remove("hidden", "loading");
  estimateCard.dataset.state = "select-address";
  estimateDistance.textContent = "-";
  estimateDuration.textContent = "-";
  estimatePrice.textContent = "-";
  estimateStatus.textContent = t("estimateSelectAddress");
}

function renderEstimate(estimate) {
  latestEstimate = estimate;
  estimateCard.classList.remove("hidden", "loading");
  estimateCard.dataset.state = "ready";
  estimateDistance.textContent = formatDistance(estimate.distanceKm);
  estimateDuration.textContent = formatMinutes(estimate.durationMinutes);
  estimatePrice.textContent = formatPrice(estimate.price);
  estimateStatus.textContent = "";
}

function photonCacheKey(query, limit) {
  return [
    window.TaxiI18n.currentLanguage(),
    String(limit),
    normalizeAddressText(query),
  ].join(":");
}

function rememberPhotonFeatures(key, features) {
  photonCache.set(key, features);
  if (photonCache.size > photonCacheLimit) {
    photonCache.delete(photonCache.keys().next().value);
  }
}

async function fetchPhotonFeatures(query, signal, limit = 1) {
  if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
  const cacheKey = photonCacheKey(query, limit);
  const cachedFeatures = photonCache.get(cacheKey);
  if (cachedFeatures) return cachedFeatures;

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    lat: String(parisBias.lat),
    lon: String(parisBias.lon),
    lang: window.TaxiI18n.currentLanguage(),
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal });
  if (!response.ok) throw new Error("Geocoding failed");
  const data = await response.json();
  const features = rankPhotonFeatures(Array.isArray(data.features) ? data.features : []);
  rememberPhotonFeatures(cacheKey, features);
  return features;
}

function normalizeAddressText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[-–—_.,;:/()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function featureCoordinates(feature) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

function featurePostcode(feature) {
  const postcode = String(feature?.properties?.postcode || "").trim();
  return postcode;
}

function featureDepartmentCode(feature) {
  const postcode = featurePostcode(feature);
  const match = postcode.match(/^(\d{2})/);
  return match ? match[1] : "";
}

function featureCountryText(feature) {
  return normalizeAddressText(feature?.properties?.country);
}

function featureCountryIsFrance(feature) {
  const country = featureCountryText(feature);
  return frenchCountryNames.has(country);
}

function featureCountryIsKnownOutsideFrance(feature) {
  const country = featureCountryText(feature);
  return Boolean(country) && !frenchCountryNames.has(country);
}

function featureStructuredLocationText(feature) {
  const properties = feature?.properties || {};
  return normalizeAddressText([
    properties.city,
    properties.county,
    properties.state,
    properties.country,
  ].filter(Boolean).join(" "));
}

function featureIsInIleDeFrance(feature) {
  const postcode = featurePostcode(feature);
  const departmentCode = featureDepartmentCode(feature);
  if (postcode) {
    if (featureCountryIsKnownOutsideFrance(feature)) return false;
    return ileDeFranceDepartments.has(departmentCode);
  }
  if (featureCountryIsKnownOutsideFrance(feature)) return false;

  const text = featureStructuredLocationText(feature);
  if (
    featureCountryIsFrance(feature) &&
    ileDeFranceLocationTerms.some((term) => text.includes(term))
  ) {
    return true;
  }

  const coordinates = featureCoordinates(feature);
  if (!coordinates) return false;
  return (
    coordinates.lat >= ileDeFranceBounds.minLat &&
    coordinates.lat <= ileDeFranceBounds.maxLat &&
    coordinates.lon >= ileDeFranceBounds.minLon &&
    coordinates.lon <= ileDeFranceBounds.maxLon
  );
}

function distanceFromParis(feature) {
  const coordinates = featureCoordinates(feature);
  if (!coordinates) return Number.POSITIVE_INFINITY;

  const earthRadiusKm = 6371;
  const degreesToRadians = (degrees) => degrees * Math.PI / 180;
  const latDistance = degreesToRadians(coordinates.lat - parisBias.lat);
  const lonDistance = degreesToRadians(coordinates.lon - parisBias.lon);
  const startLat = degreesToRadians(parisBias.lat);
  const endLat = degreesToRadians(coordinates.lat);
  const a = Math.sin(latDistance / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDistance / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function featureRank(feature, originalIndex) {
  const isLocal = featureIsInIleDeFrance(feature);
  const countryPenalty = featureCountryIsKnownOutsideFrance(feature) ? 10000 : 0;
  const localPriority = isLocal ? -10000 : 0;
  return countryPenalty + localPriority + distanceFromParis(feature) + (originalIndex * 0.01);
}

function rankPhotonFeatures(features) {
  return features
    .map((feature, index) => ({ feature, rank: featureRank(feature, index) }))
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.feature);
}

function addressSuggestionFromFeature(feature) {
  const properties = feature.properties || {};
  const coordinates = featureCoordinates(feature);
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
    isLocal: featureIsInIleDeFrance(feature),
    coordinates,
  };
}

function roundedCoordinate(value) {
  return Number.isFinite(value) ? String(Math.round(value * 10000) / 10000) : "";
}

function uniqueAddressSuggestions(suggestions) {
  const seen = new Set();
  return suggestions.filter((suggestion) => {
    const key = [
      normalizeAddressText(suggestion.label),
      roundedCoordinate(suggestion.coordinates?.lat),
      roundedCoordinate(suggestion.coordinates?.lon),
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function clearSelectedAddress(input) {
  delete input.dataset.selectedAddressLabel;
  delete input.dataset.selectedLat;
  delete input.dataset.selectedLon;
}

function clearSelectedAddressIfEdited(input) {
  const selectedLabel = input.dataset.selectedAddressLabel;
  if (selectedLabel && normalizeAddressText(input.value) !== selectedLabel) clearSelectedAddress(input);
}

function selectedAddressCoordinates(input) {
  const selectedLabel = input.dataset.selectedAddressLabel;
  if (!selectedLabel || normalizeAddressText(input.value) !== selectedLabel) return null;

  const lat = Number(input.dataset.selectedLat);
  const lon = Number(input.dataset.selectedLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function selectAddressSuggestion(field, suggestion) {
  field.input.value = suggestion.label;
  clearSelectedAddress(field.input);
  if (suggestion.coordinates) {
    field.input.dataset.selectedAddressLabel = normalizeAddressText(suggestion.label);
    field.input.dataset.selectedLat = String(suggestion.coordinates.lat);
    field.input.dataset.selectedLon = String(suggestion.coordinates.lon);
  }
  field.input.focus();
  hideAddressSuggestions(field);
  scheduleEstimate(0);
}

function addressSuggestionNote() {
  const fallback = document.createElement("div");
  fallback.className = "address-suggestion-note";
  fallback.textContent = t("addressNoLocalResults");
  return fallback;
}

function renderAddressSuggestions(field, suggestions) {
  if (!suggestions.length) {
    field.menu.replaceChildren(addressSuggestionNote());
    field.menu.classList.remove("hidden");
    field.input.setAttribute("aria-expanded", "true");
    return;
  }

  const fragment = document.createDocumentFragment();
  if (!suggestions.some((suggestion) => suggestion.isLocal)) {
    fragment.append(addressSuggestionNote());
  }

  suggestions.forEach((suggestion, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "address-option";
    if (!suggestion.isLocal) option.classList.add("outside-idf");
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
      const features = await fetchPhotonFeatures(query, controller.signal, photonAutocompleteLimit);
      if (field.controller !== controller) return;
      const suggestions = uniqueAddressSuggestions(
        features.map(addressSuggestionFromFeature).filter(Boolean)
      ).slice(0, visibleSuggestionLimit);
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

  const origin = selectedAddressCoordinates(pickupInput);
  const target = selectedAddressCoordinates(destinationInput);
  if (!origin || !target) {
    showEstimateSelectAddress();
    return;
  }

  estimateTimer = setTimeout(async () => {
    const controller = new AbortController();
    estimateAbortController = controller;
    showEstimateLoading();
    try {
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
    clearSelectedAddressIfEdited(field.input);
    scheduleEstimate();
    scheduleAddressSuggestions(field);
  });
  field.input.addEventListener("change", () => {
    clearSelectedAddressIfEdited(field.input);
    scheduleEstimate();
  });
  field.input.addEventListener("focus", () => scheduleAddressSuggestions(field));
  field.input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideAddressSuggestions(field);
  });
});

bookingTypeInputs.forEach((input) => {
  input.addEventListener("change", () => updateRideTiming(true));
});

document.addEventListener("click", (event) => {
  addressAutocompleteFields.forEach((field) => {
    if (!field.input.closest(".address-field").contains(event.target)) hideAddressSuggestions(field);
  });
});

updateRideTiming();
