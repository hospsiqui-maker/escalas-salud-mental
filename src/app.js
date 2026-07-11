const CLIENT_ID = "139979637748-sjtgd4sns245bvltopnu1keakuartvd0.apps.googleusercontent.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FOLDER_NAME = "Escalas Salud Mental";

const thermometers = [
  ["sleep", "Descanso reparador", "0 = nada reparador, 10 = reparador"],
  ["anxiety", "Ansiedad o tension", "0 = ausente, 10 = maxima"],
  ["mood", "Animo", "0 = muy bajo, 10 = estable"],
  ["energy", "Energia", "0 = agotamiento, 10 = energia adecuada"],
  ["clarity", "Claridad mental", "0 = nula, 10 = clara"],
  ["functioning", "Funcionamiento diario", "0 = muy afectado, 10 = conservado"]
];

const scaleOptions = [
  "Nada",
  "Varios dias",
  "Mas de la mitad de los dias",
  "Casi todos los dias"
];

const briefQuestions = [
  { id: "phq_interest", domain: "PHQ-2", text: "Poco interes o placer en hacer cosas." },
  { id: "phq_mood", domain: "PHQ-2", text: "Se ha sentido decaido, deprimido o sin esperanza." },
  { id: "gad_nervous", domain: "GAD-2", text: "Se ha sentido nervioso, ansioso o al limite." },
  { id: "gad_worry", domain: "GAD-2", text: "No ha podido parar o controlar la preocupacion." },
  { id: "sleep_onset", domain: "Sueno breve", text: "Dificultad para conciliar o mantener el sueno." },
  { id: "sleep_impact", domain: "Sueno breve", text: "El mal dormir afecta su funcionamiento al dia siguiente." }
];

const riskFlags = [
  ["self_harm", "Ideas de hacerse dano o no querer vivir"],
  ["mania", "Episodios de energia anormalmente alta con menor necesidad de dormir"],
  ["substances", "Consumo de alcohol o sustancias con perdida de control"],
  ["panic", "Crisis de panico recientes"],
  ["severe_insomnia", "Insomnio severo o varios dias casi sin dormir"],
  ["functional_drop", "Deterioro marcado laboral, familiar o social"]
];

const personalityItems = [
  { id: "open", trait: "Apertura", reverse: false, text: "Me adapto bien a ideas nuevas y disfruto resolver problemas complejos." },
  { id: "open_r", trait: "Apertura", reverse: true, text: "Prefiero evitar cambios aunque una situacion pida una mirada diferente." },
  { id: "conscientious", trait: "Responsabilidad", reverse: false, text: "Suelo organizarme y sostener compromisos aun bajo presion." },
  { id: "conscientious_r", trait: "Responsabilidad", reverse: true, text: "Cuando estoy exigido, pierdo orden y dejo tareas importantes abiertas." },
  { id: "extraversion", trait: "Extraversión", reverse: false, text: "Recupero energia al interactuar y comunicar lo que necesito." },
  { id: "extraversion_r", trait: "Extraversión", reverse: true, text: "Bajo presion tiendo a aislarme y me cuesta pedir apoyo." },
  { id: "agreeable", trait: "Amabilidad", reverse: false, text: "Puedo considerar el punto de vista de otros incluso en desacuerdo." },
  { id: "agreeable_r", trait: "Amabilidad", reverse: true, text: "Cuando estoy tenso, respondo con dureza o impaciencia." },
  { id: "stability", trait: "Estabilidad emocional", reverse: false, text: "Puedo regularme despues de una situacion dificil." },
  { id: "stability_r", trait: "Estabilidad emocional", reverse: true, text: "La preocupacion o irritabilidad se me quedan activadas por mucho tiempo." }
];

let tokenClient;
let accessToken = "";
let latestPayload = null;

const form = document.querySelector("#screeningForm");
const results = document.querySelector("#results");
const emptyState = document.querySelector("#emptyState");
const afterCare = document.querySelector("#afterCare");
const homeScales = document.querySelector("#homeScales");
const saveDriveButton = document.querySelector("#saveDrive");
const downloadJsonButton = document.querySelector("#downloadJson");
const printSummaryButton = document.querySelector("#printSummary");
const driveStatus = document.querySelector("#driveStatus");

function renderInputs() {
  const thermoRoot = document.querySelector("#thermometers");
  thermoRoot.innerHTML = thermometers.map(([id, label, help]) => `
    <div class="slider-card">
      <div class="slider-top">
        <label for="${id}">${label}<span class="fine-print">${help}</span></label>
        <span class="score-badge" data-value-for="${id}">5</span>
      </div>
      <input id="${id}" name="${id}" type="range" min="0" max="10" value="5">
    </div>
  `).join("");

  const briefRoot = document.querySelector("#briefScales");
  briefRoot.innerHTML = briefQuestions.map((question) => renderSelectQuestion(question.id, question.text, question.domain, scaleOptions)).join("");

  const riskRoot = document.querySelector("#riskFlags");
  riskRoot.innerHTML = riskFlags.map(([id, label]) => `
    <label class="check-row">
      <input name="${id}" type="checkbox">
      <span>${label}</span>
    </label>
  `).join("");

  const personalityRoot = document.querySelector("#personalityItems");
  personalityRoot.innerHTML = personalityItems.map((item) => renderSelectQuestion(item.id, item.text, item.trait, [
    "Muy en desacuerdo",
    "En desacuerdo",
    "Neutral",
    "De acuerdo",
    "Muy de acuerdo"
  ], 2)).join("");

  document.querySelectorAll("input[type='range']").forEach((input) => {
    input.addEventListener("input", () => {
      document.querySelector(`[data-value-for="${input.id}"]`).textContent = input.value;
    });
  });
}

function renderSelectQuestion(id, text, tag, options, defaultValue = 0) {
  return `
    <label class="question">
      <p><strong>${tag}</strong><br>${text}</p>
      <select name="${id}">
        ${options.map((option, index) => `<option value="${index}" ${index === defaultValue ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </label>
  `;
}

function collectForm() {
  const data = new FormData(form);
  const values = Object.fromEntries(data.entries());
  values.consent = data.get("consent") === "on";
  riskFlags.forEach(([id]) => {
    values[id] = data.get(id) === "on";
  });
  thermometers.forEach(([id]) => {
    values[id] = Number(values[id]);
  });
  briefQuestions.forEach(({ id }) => {
    values[id] = Number(values[id] || 0);
  });
  personalityItems.forEach(({ id }) => {
    values[id] = Number(values[id] || 0);
  });
  return values;
}

function score(values) {
  const phq2 = values.phq_interest + values.phq_mood;
  const gad2 = values.gad_nervous + values.gad_worry;
  const sleepBrief = values.sleep_onset + values.sleep_impact;
  const riskCount = riskFlags.reduce((sum, [id]) => sum + (values[id] ? 1 : 0), 0);
  const strain = Math.round(((10 - values.sleep) + values.anxiety + (10 - values.mood) + (10 - values.energy) + (10 - values.clarity) + (10 - values.functioning)) / 6);
  const personality = scorePersonality(values);
  return { phq2, gad2, sleepBrief, riskCount, strain, personality };
}

function scorePersonality(values) {
  const traits = {};
  personalityItems.forEach((item) => {
    const raw = values[item.id] + 1;
    const value = item.reverse ? 6 - raw : raw;
    if (!traits[item.trait]) traits[item.trait] = [];
    traits[item.trait].push(value);
  });
  return Object.fromEntries(Object.entries(traits).map(([trait, items]) => [
    trait,
    Number((items.reduce((a, b) => a + b, 0) / items.length).toFixed(1))
  ]));
}

function band(scoreValue, lowCut, highCut) {
  if (scoreValue >= highCut) return ["Alto", "risk"];
  if (scoreValue >= lowCut) return ["Vigilar", "watch"];
  return ["Bajo", "ok"];
}

function recommendations(scores, values) {
  const list = new Set(["PHQ-9", "GAD-7", "ISI completo"]);
  if (scores.sleepBrief >= 3 || values.reason.includes("Sueno")) list.add("ESS");
  if (scores.strain >= 5 || values.reason.includes("Estres")) list.add("PSS-10");
  if (values.substances) list.add("AUDIT-C");
  if (values.mania) list.add("MDQ");
  if (values.reason.includes("Atencion")) list.add("ASRS adulto");
  list.add("Perfil de rasgos ampliado");
  return [...list];
}

function buildPayload(values, scores) {
  return {
    app: "Escalas Salud Mental",
    version: "0.1.0-mvp",
    createdAt: new Date().toISOString(),
    patient: {
      code: values.patientCode,
      age: values.age,
      sex: values.sex || "No indicado",
      reason: values.reason
    },
    consent: {
      accepted: values.consent,
      text: "Autoriza registrar respuestas como apoyo a la atencion clinica y posible anexo a historia clinica."
    },
    thermometers: Object.fromEntries(thermometers.map(([id, label]) => [id, { label, value: values[id] }])),
    briefScales: {
      phq2: scores.phq2,
      gad2: scores.gad2,
      sleepBrief: scores.sleepBrief,
      strain: scores.strain
    },
    riskFlags: Object.fromEntries(riskFlags.map(([id, label]) => [id, { label, present: values[id] }])),
    personality: scores.personality,
    homeScales: recommendations(scores, values),
    clinicianNote: values.clinicianNote || "",
    disclaimer: "Resultados orientativos. Requieren interpretacion por profesional tratante."
  };
}

function renderResults(payload) {
  const scores = payload.briefScales;
  const [phqLabel, phqClass] = band(scores.phq2, 2, 3);
  const [gadLabel, gadClass] = band(scores.gad2, 2, 3);
  const [sleepLabel, sleepClass] = band(scores.sleepBrief, 2, 4);
  const [strainLabel, strainClass] = band(scores.strain, 4, 7);
  const riskClass = scores.riskCount > 0 ? "risk" : "ok";
  const riskLabel = scores.riskCount > 0 ? "Revisar hoy" : "Sin alerta marcada";

  results.innerHTML = `
    ${metric("Animo / PHQ-2", `${scores.phq2}/6`, phqLabel, phqClass, "Tamizaje breve; si esta elevado, completar PHQ-9.")}
    ${metric("Ansiedad / GAD-2", `${scores.gad2}/6`, gadLabel, gadClass, "Tamizaje breve; si esta elevado, completar GAD-7.")}
    ${metric("Sueno breve", `${scores.sleepBrief}/6`, sleepLabel, sleepClass, "Orientacion rapida; complementar con ISI y ESS si aplica.")}
    ${metric("Carga funcional", `${scores.strain}/10`, strainLabel, strainClass, "Integra descanso, energia, claridad, animo y funcionamiento.")}
    ${metric("Alertas clinicas", `${scores.riskCount}`, riskLabel, riskClass, "Cualquier alerta requiere juicio clinico y plan de seguridad si corresponde.")}
    ${metric("Perfil de rasgos", personalityText(payload.personality), "Orientativo", "info", "No diagnostica trastorno de personalidad; describe estilo de funcionamiento.")}
  `;
  homeScales.innerHTML = payload.homeScales.map((item) => `<li>${item}</li>`).join("");
  emptyState.hidden = true;
  results.hidden = false;
  afterCare.hidden = false;
  saveDriveButton.disabled = false;
  downloadJsonButton.disabled = false;
  printSummaryButton.disabled = false;
}

function metric(title, value, label, klass, help) {
  return `
    <div class="metric">
      <div>
        <strong>${title}: ${value}</strong>
        <p>${help}</p>
      </div>
      <span class="severity ${klass}">${label}</span>
    </div>
  `;
}

function personalityText(personality) {
  return Object.entries(personality).map(([trait, value]) => `${trait} ${value}/5`).join(" · ");
}

function downloadJson() {
  if (!latestPayload) return;
  const blob = new Blob([JSON.stringify(latestPayload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileBaseName(latestPayload) + ".json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function fileBaseName(payload) {
  const safeCode = payload.patient.code.replace(/[^a-z0-9_-]/gi, "_");
  const date = payload.createdAt.slice(0, 10);
  return `${date}_${safeCode}_primera_consulta`;
}

function printSummary() {
  window.print();
}

function initDrive() {
  if (!window.google?.accounts?.oauth2) {
    alert("Google Identity Services aun no ha cargado. Intenta de nuevo en unos segundos.");
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (response) => {
      if (response.error) {
        alert(`Google rechazo la autorizacion: ${response.error}`);
        return;
      }
      accessToken = response.access_token;
      driveStatus.textContent = "Drive conectado";
      driveStatus.classList.add("is-on");
    }
  });
  tokenClient.requestAccessToken({ prompt: "consent" });
}

async function saveToDrive() {
  if (!latestPayload) return;
  if (!accessToken) {
    initDrive();
    return;
  }
  saveDriveButton.disabled = true;
  saveDriveButton.textContent = "Guardando...";
  try {
    const folderId = await ensureDriveFolder();
    const jsonFile = new Blob([JSON.stringify(latestPayload, null, 2)], { type: "application/json" });
    const htmlFile = new Blob([summaryHtml(latestPayload)], { type: "text/html" });
    await uploadDriveFile(`${fileBaseName(latestPayload)}.json`, jsonFile, folderId, "application/json");
    await uploadDriveFile(`${fileBaseName(latestPayload)}.html`, htmlFile, folderId, "text/html");
    saveDriveButton.textContent = "Guardado en Drive";
  } catch (error) {
    console.error(error);
    alert("No se pudo guardar en Drive. Revisa autorizacion, usuario de prueba y origen localhost.");
    saveDriveButton.textContent = "Guardar en Drive";
  } finally {
    saveDriveButton.disabled = false;
  }
}

async function ensureDriveFolder() {
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`);
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`);
  const data = await response.json();
  if (data.files?.length) return data.files[0].id;
  const folder = await driveFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
  });
  const created = await folder.json();
  return created.id;
}

async function uploadDriveFile(name, blob, folderId, mimeType) {
  const metadata = { name, parents: [folderId], mimeType };
  const boundary = "escalas_sm_boundary";
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`
  ], { type: `multipart/related; boundary=${boundary}` });
  const response = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body
  });
  return response.json();
}

async function driveFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

function summaryHtml(payload) {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>${fileBaseName(payload)}</title>
  <body style="font-family:Arial,sans-serif;line-height:1.5;color:#2B2E36;padding:24px">
  <h1>Escalas Salud Mental - primera consulta</h1>
  <p><strong>Paciente:</strong> ${payload.patient.code} | <strong>Fecha:</strong> ${payload.createdAt}</p>
  <p><strong>Motivo:</strong> ${payload.patient.reason}</p>
  <h2>Resultados</h2>
  <ul>
    <li>PHQ-2: ${payload.briefScales.phq2}/6</li>
    <li>GAD-2: ${payload.briefScales.gad2}/6</li>
    <li>Sueno breve: ${payload.briefScales.sleepBrief}/6</li>
    <li>Carga funcional: ${payload.briefScales.strain}/10</li>
  </ul>
  <h2>Perfil de rasgos</h2>
  <p>${personalityText(payload.personality)}</p>
  <h2>Escalas sugeridas para casa</h2>
  <ul>${payload.homeScales.map((item) => `<li>${item}</li>`).join("")}</ul>
  <p><strong>Nota:</strong> ${payload.clinicianNote || "Sin nota adicional."}</p>
  <p>${payload.disclaimer}</p></body></html>`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = collectForm();
  const scores = score(values);
  latestPayload = buildPayload(values, scores);
  renderResults(latestPayload);
});

document.querySelector("#resetForm").addEventListener("click", () => {
  form.reset();
  latestPayload = null;
  emptyState.hidden = false;
  results.hidden = true;
  afterCare.hidden = true;
  saveDriveButton.disabled = true;
  downloadJsonButton.disabled = true;
  printSummaryButton.disabled = true;
});

document.querySelector("#connectDrive").addEventListener("click", initDrive);
saveDriveButton.addEventListener("click", saveToDrive);
downloadJsonButton.addEventListener("click", downloadJson);
printSummaryButton.addEventListener("click", printSummary);

renderInputs();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
