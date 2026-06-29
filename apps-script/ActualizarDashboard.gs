/**
 * Botón "Actualizar Dashboard" para el Sheet "Eco Dulce - Maestro Vinculado".
 *
 * Qué hace:
 * 1. Lee cada pestaña del Sheet y la convierte a CSV.
 * 2. Sube cada CSV a la carpeta data/ del repo de GitHub (vía API, commit directo a main).
 * 3. GitHub Actions (.github/workflows/build-data.yml) detecta el push, corre
 *    build_data.py y commitea data/data.json automáticamente.
 * 4. GitHub Pages publica el cambio solo — no hace falta tocar nada localmente.
 *
 * SETUP (una sola vez):
 * 1. En este Sheet: Extensiones > Apps Script. Pegar este archivo completo.
 * 2. Crear un token en GitHub: Settings > Developer settings > Personal access
 *    tokens > Fine-grained tokens > Generate new token.
 *    - Repository access: solo "ecodulce-dashboard"
 *    - Permissions: "Contents" = Read and write
 * 3. En el editor de Apps Script: ⚙️ Configuración del proyecto > Propiedades
 *    del script > Agregar propiedad de script:
 *      GITHUB_TOKEN = <el token que generaste>
 *    (El token queda guardado encriptado por Google, nunca pasa por este código
 *    ni por el chat — pegalo directo ahí.)
 * 4. Guardar, volver al Sheet y refrescar la página.
 * 5. Aparece un menú nuevo "📊 Dashboard" → "Actualizar ahora". Al tocarlo,
 *    Google pide autorización la primera vez (es normal, es el script propio).
 */

const GITHUB_OWNER = "coordinacionsgi-prog";
const GITHUB_REPO = "ecodulce-dashboard";
const GITHUB_BRANCH = "main";

// Mapeo: nombre de la pestaña del Sheet -> archivo CSV en el repo (carpeta data/)
const TAB_TO_FILE = {
  "Plan de Ventas": "plan-de-ventas.csv",
  "Materia Prima y Maquinas": "materia-prima.csv",
  "CAP": "cap.csv",
  "Fichas Tecnicas": "fichas-tecnicas.csv",
  "Guerchet": "guerchet.csv",
  "REL": "rel.csv",
  "Carga-Distancia": "carga-distancia.csv",
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📊 Dashboard")
    .addItem("Actualizar ahora", "actualizarDashboard")
    .addToUi();
}

function actualizarDashboard() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");

  if (!token) {
    ui.alert(
      "Falta configurar el token de GitHub.\n\n" +
      "Extensiones > Apps Script > ⚙️ Configuración del proyecto > " +
      "Propiedades del script > agregar GITHUB_TOKEN."
    );
    return;
  }

  let actualizados = [];
  let errores = [];

  for (const [tabName, fileName] of Object.entries(TAB_TO_FILE)) {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      errores.push(`Pestaña no encontrada: ${tabName}`);
      continue;
    }
    try {
      const csv = sheetToCsv(sheet);
      pushFileToGithub(token, `data/${fileName}`, csv);
      actualizados.push(fileName);
    } catch (e) {
      errores.push(`${fileName}: ${e.message}`);
    }
  }

  let msg = `Subidos: ${actualizados.join(", ") || "ninguno"}.`;
  if (errores.length) msg += `\n\nErrores:\n${errores.join("\n")}`;
  msg += "\n\nGitHub Actions va a regenerar data.json automáticamente " +
    "(1-2 min). El dashboard se actualiza solo, no hace falta nada más.";
  ui.alert(msg);
}

function sheetToCsv(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  return values
    .map((row) =>
      row
        .map((cell) => {
          let v = cell === null || cell === undefined ? "" : String(cell);
          if (v.includes(",") || v.includes('"') || v.includes("\n")) {
            v = '"' + v.replace(/"/g, '""') + '"';
          }
          return v;
        })
        .join(",")
    )
    .join("\n");
}

function pushFileToGithub(token, path, content) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
  };

  // 1. Buscar el sha del archivo actual (si existe) para poder actualizarlo.
  let sha = null;
  const getResp = UrlFetchApp.fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
    headers,
    muteHttpExceptions: true,
  });
  if (getResp.getResponseCode() === 200) {
    sha = JSON.parse(getResp.getContentText()).sha;
  }

  // 2. Crear o actualizar el archivo.
  const payload = {
    message: `Actualizar ${path} desde Google Sheets`,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: GITHUB_BRANCH,
  };
  if (sha) payload.sha = sha;

  const putResp = UrlFetchApp.fetch(apiUrl, {
    method: "put",
    headers,
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = putResp.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error(`GitHub API respondió ${code}: ${putResp.getContentText()}`);
  }
}
