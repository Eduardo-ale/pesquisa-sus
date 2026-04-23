const appRoot = document.getElementById("app-root");
const form = document.getElementById("form-busca");
const inputCns = document.getElementById("input-cns");
const inputCpf = document.getElementById("input-cpf");
const wrapCns = document.getElementById("wrap-cns");
const wrapCpf = document.getElementById("wrap-cpf");
const countCns = document.getElementById("count-cns");
const countCpf = document.getElementById("count-cpf");
const searchCard = document.getElementById("search-card");
const radioCns = document.getElementById("modo-cns");
const radioCpf = document.getElementById("modo-cpf");
const btnBuscar = document.getElementById("btn-buscar");
const btnLimpar = document.getElementById("btn-limpar");
const btnNovaConsulta = document.getElementById("btn-nova-consulta");
const btnExportarTxt = document.getElementById("btn-exportar-txt");
const btnExportarPdf = document.getElementById("btn-exportar-pdf");
const btnExportarXlsx = document.getElementById("btn-exportar-xlsx");
const btnImprimir = document.getElementById("btn-imprimir");
const btnCopiarResumo = document.getElementById("btn-copiar-resumo");
const btnCopiarEndereco = document.getElementById("btn-copiar-endereco");
const btnOcultarDados = document.getElementById("btn-ocultar-dados");
const comparacaoMsg = document.getElementById("comparacao-msg");
const resumoLines = document.getElementById("resumo-lines");
const heroBadges = document.getElementById("hero-badges");
const sessionRecent = document.getElementById("session-recent");
const sessionRecentList = document.getElementById("session-recent-list");
const msgErro = document.getElementById("msg-erro");
const liveErro = document.getElementById("live-erro");
const statusConsulta = document.getElementById("status-consulta");
const msgVazio = document.getElementById("msg-vazio");
const resultado = document.getElementById("resultado");
const skel = document.getElementById("resultado-skeleton");
const conteudo = document.getElementById("resultado-conteudo");
const tablist = document.getElementById("tablist-principal");
const tabButtons = () => Array.from(document.querySelectorAll("#tablist-principal .tabs__tab"));

const el = (id) => document.getElementById(id);

/** Controlador da requisição em curso (evita respostas fora de ordem e permite cancelar). */
let aborter = null;
let buscarSeq = 0;
/** Dados do último preenchimento (exportar / imprimir). */
let pacienteAtual = null;
/** Snapshot da consulta anterior nesta aba, para comparação leve. */
let ultimoSnapshot = null;
/** Histórico em memória (não persiste após fechar a aba). */
const HISTORICO_MAX = 8;
let historicoSessao = [];

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function modoAtual() {
  return radioCpf.checked ? "cpf" : "cns";
}

function maskCpfInput(raw) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskCnsInput(raw) {
  const d = onlyDigits(raw).slice(0, 15);
  if (!d) return "";
  const a = d.slice(0, 3);
  const b = d.slice(3, 7);
  const c = d.slice(7, 11);
  const e = d.slice(11, 15);
  return [a, b, c, e].filter(Boolean).join(" ");
}

function updateDigitCounts() {
  if (countCns) {
    const n = onlyDigits(inputCns.value).length;
    countCns.textContent = `${n}/15`;
  }
  if (countCpf) {
    const n = onlyDigits(inputCpf.value).length;
    countCpf.textContent = `${n}/11`;
  }
}

function setFieldValidity(valid) {
  if (valid) {
    inputCns.removeAttribute("aria-invalid");
    inputCpf.removeAttribute("aria-invalid");
  } else if (modoAtual() === "cns") {
    inputCns.setAttribute("aria-invalid", "true");
    inputCpf.removeAttribute("aria-invalid");
  } else {
    inputCpf.setAttribute("aria-invalid", "true");
    inputCns.removeAttribute("aria-invalid");
  }
}

function syncModoUI() {
  const modo = modoAtual();
  if (modo === "cns") {
    wrapCns.hidden = false;
    wrapCpf.hidden = true;
    inputCpf.disabled = true;
    inputCns.disabled = false;
    inputCpf.value = "";
    inputCns.value = maskCnsInput(inputCns.value);
  } else {
    wrapCns.hidden = true;
    wrapCpf.hidden = false;
    inputCns.disabled = true;
    inputCpf.disabled = false;
    inputCns.value = "";
    inputCpf.value = maskCpfInput(inputCpf.value);
  }
  setFieldValidity(true);
  updateDigitCounts();
}

function formatCpf(n) {
  const d = onlyDigits(n);
  if (d.length !== 11) return String(n ?? "—");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCns(n) {
  const d = onlyDigits(String(n ?? ""));
  if (d.length !== 15) return String(n ?? "—");
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7, 11)} ${d.slice(11)}`;
}

function formatCep(n) {
  const d = onlyDigits(String(n ?? ""));
  if (d.length !== 8) return n != null && n !== "" ? String(n) : "—";
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatTelFone(p) {
  if (p == null) return "—";
  if (p.numeroTelefone != null && p.DDD != null) {
    const ddi = p.DDI || 55;
    return `+${ddi} (${p.DDD}) ${p.numeroTelefone}`;
  }
  const t = v(p.Telefone);
  return t === "—" ? "—" : t;
}

function buildTelUrl(p) {
  if (p == null) return null;
  if (p.numeroTelefone != null && p.DDD != null) {
    const ddi = p.DDI || 55;
    const raw = onlyDigits(String(ddi) + String(p.DDD) + String(p.numeroTelefone));
    if (raw.length >= 10) return `tel:+${raw}`;
  }
  return null;
}

function brDate(s) {
  if (!s) return "—";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function iniciaisNome(nome) {
  const parts = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const a = parts[0][0];
  const b = parts[parts.length - 1][0];
  return (a + b).toUpperCase();
}

function v(x) {
  if (x == null || x === "") return "—";
  const t = String(x).trim();
  if (t === "") return "—";
  if (t === "true") return "Sim";
  if (t === "false") return "Não";
  if (/^sem informa/i.test(t)) return "—";
  return t;
}

/** Converte booleanos e strings típicas da API em Sim/Não ou texto. */
function strBoolish(x) {
  if (x == null || x === "") return null;
  if (x === true || x === 1) return "Sim";
  if (x === false || x === 0) return "Não";
  const t = String(x).trim().toLowerCase();
  if (t === "true") return "Sim";
  if (t === "false") return "Não";
  return v(x) === "—" ? null : v(x);
}

function cidadeDoBlobMunicipio(s) {
  if (!s) return "—";
  const str = String(s);
  const m = str.match(/\d+([A-ZÁÀÂÃÊÉÍÓÔÕÚÇa-záàâãêéíóôõúç][A-ZÁÀÂÃÊÉÍÓÔÕÚÇa-záàâãêéíóôõúç\s]+?)(?=\d{2}|\d{4,}|$)/);
  if (m && m[1]) return m[1].trim();
  return v(s);
}

function addRows(dl, rows) {
  dl.innerHTML = "";
  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const k = row[0];
    const val = row[1];
    const hint = row[2];
    if (val == null || val === "" || val === "—") continue;
    const dt = document.createElement("dt");
    dt.textContent = k;
    if (hint) dt.title = hint;
    const dd = document.createElement("dd");
    dd.textContent = val;
    dl.append(dt, dd);
  }
  if (!dl.children.length) {
    const dt = document.createElement("dt");
    dt.className = "full";
    dt.textContent = "Sem informações";
    const dd = document.createElement("dd");
    dd.className = "full";
    dd.textContent = "—";
    dl.append(dt, dd);
  }
}

function addRowWithCopy(dl, label, displayText, copyPlain) {
  const hasCopy = copyPlain && String(copyPlain).replace(/\D/g, "").length > 0;
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  if (!hasCopy) {
    dd.textContent = displayText;
    dl.append(dt, dd);
    return;
  }
  dd.className = "dd-with-action";
  const span = document.createElement("span");
  span.className = "dd__value";
  span.textContent = displayText;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn--copy";
  const shortL = label.split("(")[0].trim();
  btn.setAttribute("aria-label", `Copiar ${shortL}`);
  btn.textContent = "Copiar";
  btn.addEventListener("click", () => {
    void copyPlainText(displayText, btn);
  });
  dd.append(span, btn);
  dl.append(dt, dd);
}

function addRowContato(dl, k, text, href) {
  if (text == null || text === "" || text === "—") return;
  const dt = document.createElement("dt");
  dt.textContent = k;
  const dd = document.createElement("dd");
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.className = "dd-link";
    a.textContent = text;
    dd.appendChild(a);
  } else {
    dd.textContent = text;
  }
  dl.append(dt, dd);
}

async function copyPlainText(text, btn) {
  const orig = btn.textContent;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    btn.textContent = "Copiado";
    setTimeout(() => {
      btn.textContent = orig;
    }, 2000);
  } catch {
    btn.textContent = "Erro";
    setTimeout(() => {
      btn.textContent = orig;
    }, 2000);
  }
}

/** Idade em anos completos a partir de YYYY-MM-DD. */
function calcIdadeAnos(dataNasc) {
  if (!dataNasc) return null;
  const m = String(dataNasc).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const born = new Date(y, mo, d);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const md = today.getMonth() - born.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function textoIdade(p) {
  const n = calcIdadeAnos(p.dataNascimento);
  if (n == null) return null;
  return `${n} ${n === 1 ? "ano" : "anos"}`;
}

/** Linha única de endereço + chave normalizada para comparar na sessão. */
function buildEnderecoCompleto(p) {
  const endLog =
    v(p.nomeLogradouro) !== "—"
      ? `${v(p.descricaoTipoLogradouro) !== "—" ? `${v(p.descricaoTipoLogradouro)} ` : ""}${v(p.nomeLogradouro)}`.trim()
      : "";
  const munRes = p.Municipio ? cidadeDoBlobMunicipio(p.Municipio) : v(p.nomeMunicipio);
  const bairro = v(p.Bairro) !== "—" ? v(p.Bairro) : v(p.descricaoBairro);
  const partes = [
    [endLog, p.numero != null && p.numero !== "" ? `nº ${p.numero}` : null, p.complemento ? v(p.complemento) : null]
      .filter(Boolean)
      .join(", "),
    bairro && bairro !== "—" ? bairro : null,
    formatCep(p.CEP ?? p.numeroCEP) !== "—" ? `CEP ${formatCep(p.CEP ?? p.numeroCEP)}` : null,
    [munRes, p.siglaUF || ""].filter((x) => x && x !== "—").join(" / ") || null,
    v(p.Pais) !== "—" ? v(p.Pais) : null,
  ].filter(Boolean);
  const linha = partes.join(" — ") || "—";
  const key = partes
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return { linha, key };
}

function snapshotParaComparacao(p) {
  const { key } = buildEnderecoCompleto(p);
  return {
    enderecoKey: key,
    nome: String(v(p.NomeCompleto) || "")
      .trim()
      .toLowerCase(),
  };
}

function preencherComparacaoMsg(p) {
  if (!comparacaoMsg) return;
  if (!ultimoSnapshot) {
    comparacaoMsg.setAttribute("hidden", "");
    comparacaoMsg.textContent = "";
    return;
  }
  const cur = snapshotParaComparacao(p);
  const msgs = [];
  if (ultimoSnapshot.enderecoKey && cur.enderecoKey && ultimoSnapshot.enderecoKey !== cur.enderecoKey) {
    msgs.push("Endereço de residência alterado em relação à consulta anterior nesta aba.");
  }
  if (ultimoSnapshot.nome && cur.nome && ultimoSnapshot.nome !== cur.nome) {
    msgs.push("Nome exibido difere da consulta anterior nesta aba (outro cadastro ou atualização).");
  }
  if (msgs.length) {
    comparacaoMsg.textContent = msgs.join(" ");
    comparacaoMsg.removeAttribute("hidden");
  } else {
    comparacaoMsg.setAttribute("hidden", "");
    comparacaoMsg.textContent = "";
  }
}

function preencherResumoExec(p, cpfFmt, cnsFmt) {
  if (!resumoLines) return;
  const idade = textoIdade(p);
  const tel = formatTelFone(p);
  const { linha: endLinha } = buildEnderecoCompleto(p);
  const email =
    p.descricaoEmail && String(p.descricaoEmail).trim() ? v(p.descricaoEmail) : v(p.Email) !== "—" ? v(p.Email) : null;
  const linhas = [
    `Nome: ${v(p.NomeCompleto)}`,
    p.NomeSocial && v(p.NomeSocial) !== "—" ? `Nome social: ${v(p.NomeSocial)}` : null,
    `CPF: ${cpfFmt} · CNS: ${cnsFmt}`,
    p.dataNascimento ? `Nascimento: ${brDate(p.dataNascimento)}${idade ? ` (${idade})` : ""}` : null,
    tel && tel !== "—" ? `Telefone: ${tel}` : null,
    email && email !== "—" ? `E-mail: ${email}` : null,
    `Endereço: ${endLinha}`,
  ].filter(Boolean);
  resumoLines.textContent = linhas.join("\n");
}

function preencherHeroBadges(p) {
  if (!heroBadges) return;
  heroBadges.innerHTML = "";
  const q = p.percentualQualidade;
  const alinhado = p.originalRFB === "true" || p.originalRFB === true;
  if (alinhado) {
    const s = document.createElement("span");
    s.className = "hero-badge hero-badge--ok";
    s.textContent = "RFB: alinhado";
    s.title = "Indicador originalRFB = verdadeiro na resposta da API.";
    heroBadges.appendChild(s);
  } else if (p.originalRFB != null) {
    const s = document.createElement("span");
    s.className = "hero-badge hero-badge--muted";
    s.textContent = "RFB: não alinhado";
    s.title = "Conferir regras do cadastro na instituição.";
    heroBadges.appendChild(s);
  }
  if (q != null && q !== "") {
    const n = Number(q);
    const low = !Number.isNaN(n) && n < 70;
    const s = document.createElement("span");
    s.className = `hero-badge ${low ? "hero-badge--warn" : "hero-badge--info"}`;
    s.textContent = `Qualidade: ${q}%`;
    s.title = "Grau de qualidade informado pelo cadastro (API).";
    heroBadges.appendChild(s);
  }
}

/**
 * Monta o mesmo conteúdo do relatório .txt em linhas e, em paralelo, linhas para planilha (.xlsx).
 * @returns {{ textLines: string[], sheetRows: string[][] }}
 */
function buildRelatorioExportData(p) {
  const cpfFmt = formatCpf(p.numeroCPF ?? p.CPF);
  const cnsFmt = formatCns(p.numeroCNS);
  const { linha: endLinha } = buildEnderecoCompleto(p);
  const idade = textoIdade(p);
  const munNasc = p.MunicipioNascimento ? cidadeDoBlobMunicipio(p.MunicipioNascimento) : "—";

  const textLines = [];
  const sheetRows = [["Campo", "Valor"]];

  const pushSection = (name) => {
    textLines.push(name, "—".repeat(40));
    sheetRows.push([name, ""]);
  };
  const pushBlank = () => {
    textLines.push("");
    sheetRows.push(["", ""]);
  };
  const addField = (label, displayValue) => {
    const disp = displayValue == null ? "—" : String(displayValue);
    textLines.push(`${label}: ${disp}`);
    sheetRows.push([label, disp]);
  };

  textLines.push("CONSULTA CADASTRO SUS (memória de sessão — não compartilhe indevidamente)", "");
  sheetRows.push(["CONSULTA CADASTRO SUS (memória de sessão — não compartilhe indevidamente)", ""]);
  sheetRows.push(["", ""]);

  pushSection("IDENTIFICAÇÃO");
  addField("Nome", v(p.NomeCompleto));
  if (p.NomeSocial && v(p.NomeSocial) !== "—") addField("Nome social", v(p.NomeSocial));
  addField("CPF", cpfFmt);
  addField("CNS", cnsFmt);
  if (p.dataAtribuicao) addField("CNS atribuição", v(p.dataAtribuicao));
  pushBlank();

  pushSection("DEMOGRAFIA");
  const nascText = `Nasc.: ${p.dataNascimento ? brDate(p.dataNascimento) : "—"}${idade ? ` | Idade: ${idade}` : ""}`;
  textLines.push(nascText);
  sheetRows.push([
    "Nascimento / idade",
    `${p.dataNascimento ? brDate(p.dataNascimento) : "—"}${idade ? ` (${idade})` : ""}`,
  ]);
  addField("Sexo", p.descricaoSexo || v(p.Sexo));
  addField("Cor/raça", p.descricaoRacaCor || v(p.RacaCor));
  addField("Mãe", v(p.Mae));
  addField("Pai", v(p.Pai));
  pushBlank();

  pushSection("DOCUMENTOS");
  addField("RG", p.numeroIdentidade != null ? String(p.numeroIdentidade) : "—");
  addField("Órgão", p.nomeOrgaoEmissor || v(p.OrgaoEmissor));
  addField("Emissão", p.dataExpedicao ? brDate(p.dataExpedicao) : "—");
  addField("Tipo cartão", v(p.tipoCartao));
  pushBlank();

  pushSection("NATURALIDADE");
  addField("Município nasc.", munNasc);
  addField("UF", p.siglaUF || v(p.UF));
  addField("País", p.nomePais || v(p.PaisNascimento));
  pushBlank();

  pushSection("ENDEREÇO");
  textLines.push(endLinha, "");
  sheetRows.push(["Endereço", endLinha]);
  sheetRows.push(["", ""]);

  pushSection("CONTATO E SITUAÇÃO");
  const t = formatTelFone(p);
  if (t && t !== "—") addField("Telefone", t);
  const email = p.descricaoEmail || (v(p.Email) !== "—" ? v(p.Email) : null);
  if (email && email !== "—") addField("E-mail", email);
  addField("Qualidade (%)", p.percentualQualidade != null ? String(p.percentualQualidade) : "—");
  addField(
    "Alinhado RFB",
    p.originalRFB === "true" || p.originalRFB === true
      ? "Sim"
      : p.originalRFB != null
        ? "Não"
        : "—",
  );
  addField("Situação ativa", strBoolish(p.Situacao) ?? "—");
  const vipP = [strBoolish(p.Vip), strBoolish(p.protecaoTestemunha)].filter((x) => x != null && x !== "—");
  if (vipP.length) {
    textLines.push(`Proteção: ${vipP.join(" · ")}`);
    sheetRows.push(["Proteção", vipP.join(" · ")]);
  }
  pushBlank();

  const stamp = new Date();
  const gerado = `Gerado em: ${String(stamp.getDate()).padStart(2, "0")}/${String(stamp.getMonth() + 1).padStart(2, "0")}/${stamp.getFullYear()} ${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
  textLines.push(gerado);
  sheetRows.push(["Gerado em", gerado.replace(/^Gerado em: /, "")]);

  return { textLines, sheetRows };
}

function buildRelatorioTexto(p) {
  const { textLines } = buildRelatorioExportData(p);
  return textLines.join("\n");
}

function exportFilenameStem() {
  const now = new Date();
  return `consulta_sus_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
}

function downloadBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/** Quebra uma linha para largura máxima em PDF (Helvetica). */
function wrapPdfLine(text, maxW, font, fontSize) {
  const s = String(text ?? "");
  if (!s.trim()) return [""];
  const words = s.split(/\s+/);
  const out = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    try {
      if (font.widthOfTextAtSize(test, fontSize) <= maxW || !cur) {
        cur = test;
      } else {
        out.push(cur);
        cur = w;
      }
    } catch {
      out.push(cur || w);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

async function downloadRelatorioPdf(p) {
  if (typeof PDFLib === "undefined") {
    mostrarErro("Não foi possível carregar a biblioteca de PDF. Verifique a conexão e recarregue a página.");
    return;
  }
  const { textLines } = buildRelatorioExportData(p);
  const { PDFDocument, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 9;
  const lineHeight = fontSize * 1.25;
  const margin = 48;
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  const maxW = width - 2 * margin;
  let y = height - margin;

  const novaPagina = () => {
    page = pdfDoc.addPage();
    ({ width, height } = page.getSize());
    y = height - margin;
  };

  for (const line of textLines) {
    if (line === "") {
      y -= lineHeight * 0.45;
      if (y < margin) novaPagina();
      continue;
    }
    const partes = wrapPdfLine(line, maxW, font, fontSize);
    for (const parte of partes) {
      if (y < margin + lineHeight) novaPagina();
      try {
        page.drawText(parte, { x: margin, y, size: fontSize, font });
      } catch {
        page.drawText(parte.replace(/[^\x00-\xff]/g, "?"), { x: margin, y, size: fontSize, font });
      }
      y -= lineHeight;
    }
  }

  const bytes = await pdfDoc.save();
  downloadBlob(`${exportFilenameStem()}.pdf`, new Blob([bytes], { type: "application/pdf" }));
}

function downloadRelatorioXlsx(p) {
  if (typeof XLSX === "undefined") {
    mostrarErro("Não foi possível carregar a biblioteca Excel. Verifique a conexão e recarregue a página.");
    return;
  }
  const { sheetRows } = buildRelatorioExportData(p);
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = [{ wch: 36 }, { wch: 52 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cadastro SUS");
  XLSX.writeFile(wb, `${exportFilenameStem()}.xlsx`);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function registrarNoHistorico(p, modo, docDigits) {
  if (!sessionRecentList || !docDigits) return;
  const key = `${modo}:${docDigits}`;
  const label = v(p.NomeCompleto) !== "—" && String(v(p.NomeCompleto)).trim() ? v(p.NomeCompleto) : "Sem nome no retorno";
  const ix = historicoSessao.findIndex((h) => h.key === key);
  if (ix >= 0) historicoSessao.splice(ix, 1);
  historicoSessao.unshift({ key, modo, digits: docDigits, label, ts: Date.now() });
  if (historicoSessao.length > HISTORICO_MAX) historicoSessao.length = HISTORICO_MAX;
  renderHistoricoLista();
}

function formatDocHistorico(modo, digits) {
  if (modo === "cns") return formatCns(digits);
  if (modo === "cpf") return formatCpf(digits);
  return digits;
}

function renderHistoricoLista() {
  if (!sessionRecentList || !sessionRecent) return;
  sessionRecentList.innerHTML = "";
  for (const h of historicoSessao) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "session-recent__item";
    const hora = new Date(h.ts);
    const tStr = `${String(hora.getHours()).padStart(2, "0")}:${String(hora.getMinutes()).padStart(2, "0")}`;
    btn.textContent = `${h.label} · ${h.modo === "cns" ? "CNS" : "CPF"} ${formatDocHistorico(h.modo, h.digits)} · ${tStr}`;
    btn.addEventListener("click", () => {
      if (h.modo === "cns") {
        radioCns.checked = true;
      } else {
        radioCpf.checked = true;
      }
      syncModoUI();
      if (h.modo === "cns") {
        inputCns.value = maskCnsInput(h.digits);
        inputCns.focus();
      } else {
        inputCpf.value = maskCpfInput(h.digits);
        inputCpf.focus();
      }
      updateDigitCounts();
      setFieldValidity(true);
    });
    li.appendChild(btn);
    sessionRecentList.appendChild(li);
  }
  sessionRecent.hidden = historicoSessao.length === 0;
}

function setResultadoBusy(busy) {
  resultado.setAttribute("aria-busy", busy ? "true" : "false");
}

function mostrarErro(t) {
  const msg = t || "";
  msgErro.textContent = msg;
  msgErro.hidden = !msg;
  if (liveErro) liveErro.textContent = msg;
}

function setAnuncioStatus(t) {
  if (!statusConsulta) return;
  if (t) {
    statusConsulta.textContent = t;
    statusConsulta.removeAttribute("hidden");
  } else {
    statusConsulta.textContent = "";
    statusConsulta.setAttribute("hidden", "");
  }
}

function setLoading(loading) {
  btnBuscar.disabled = loading;
  btnBuscar.setAttribute("aria-busy", loading ? "true" : "false");
  btnBuscar.textContent = loading ? "Buscando…" : "Consultar";
}

function atualizarEmptyState() {
  const temResultado = appRoot.classList.contains("app--com-resultado");
  if (temResultado) {
    msgVazio.setAttribute("hidden", "");
  } else {
    msgVazio.removeAttribute("hidden");
  }
}

function setTemResultado(on) {
  if (on) {
    appRoot.classList.add("app--com-resultado");
  } else {
    appRoot.classList.remove("app--com-resultado");
  }
  atualizarEmptyState();
}

function scrollToResultado() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  resultado.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function scrollToSearch() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (searchCard) searchCard.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

const tabIndexMap = () => {
  const buttons = tabButtons();
  return buttons.map((b) => document.getElementById(b.getAttribute("aria-controls") || ""));
};

function selectTab(index) {
  const buttons = tabButtons();
  const panels = tabIndexMap();
  if (index < 0) index = buttons.length - 1;
  if (index >= buttons.length) index = 0;
  buttons.forEach((tab, i) => {
    const selected = i === index;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const p = panels[i];
    if (p) {
      p.hidden = !selected;
      p.classList.toggle("is-hidden", !selected);
    }
  });
}

function currentTabIndex() {
  return tabButtons().findIndex((t) => t.getAttribute("aria-selected") === "true");
}

function focusTab(i) {
  const buttons = tabButtons();
  if (buttons[i]) buttons[i].focus();
}

function limparDadosExibidos() {
  el("out-nome").textContent = "";
  el("out-chips").innerHTML = "";
  el("hero-avatar").textContent = "—";
  ["dl-id", "dl-demo", "dl-doc", "dl-nat", "dl-end", "dl-cont", "dl-sit"].forEach((id) => {
    const d = el(id);
    if (d) d.innerHTML = "";
  });
  if (resumoLines) resumoLines.textContent = "";
  if (heroBadges) heroBadges.innerHTML = "";
  if (comparacaoMsg) {
    comparacaoMsg.textContent = "";
    comparacaoMsg.setAttribute("hidden", "");
  }
  pacienteAtual = null;
}

function ocultarDadosPaciente() {
  aborter?.abort();
  buscarSeq += 1;
  setLoading(false);
  setTemResultado(false);
  setAnuncioStatus("");
  limparDadosExibidos();
  resultado.setAttribute("hidden", "");
  skel.setAttribute("hidden", "");
  conteudo.setAttribute("hidden", "");
  setResultadoBusy(false);
  selectTab(0);
  atualizarEmptyState();
}

function novaConsulta() {
  scrollToSearch();
  setAnuncioStatus("");
  if (modoAtual() === "cns") {
    inputCns.focus();
  } else {
    inputCpf.focus();
  }
  selectTab(0);
}

tablist.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.getAttribute("role") === "tab") {
    const i = tabButtons().indexOf(t);
    if (i >= 0) selectTab(i);
  }
});

tablist.addEventListener("keydown", (e) => {
  const key = e.key;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
  e.preventDefault();
  let i = currentTabIndex();
  const n = tabButtons().length;
  if (key === "ArrowRight") i = (i + 1) % n;
  else if (key === "ArrowLeft") i = (i - 1 + n) % n;
  else if (key === "Home") i = 0;
  else if (key === "End") i = n - 1;
  selectTab(i);
  focusTab(i);
});

function limparTudo() {
  aborter?.abort();
  buscarSeq += 1;
  setTemResultado(false);
  mostrarErro("");
  setAnuncioStatus("");
  setLoading(false);
  resultado.setAttribute("hidden", "");
  skel.setAttribute("hidden", "");
  conteudo.setAttribute("hidden", "");
  setResultadoBusy(false);
  inputCns.value = "";
  inputCpf.value = "";
  limparDadosExibidos();
  ultimoSnapshot = null;
  historicoSessao = [];
  if (sessionRecent) sessionRecent.setAttribute("hidden", "");
  if (sessionRecentList) sessionRecentList.innerHTML = "";
  syncModoUI();
  selectTab(0);
  atualizarEmptyState();
  setFieldValidity(true);
}

function showLoadingResultado() {
  resultado.removeAttribute("hidden");
  setResultadoBusy(true);
  skel.removeAttribute("hidden");
  conteudo.setAttribute("hidden", "");
}

function showDadosResultado() {
  setResultadoBusy(false);
  skel.setAttribute("hidden", "");
  conteudo.removeAttribute("hidden");
}

function isAbortError(e) {
  if (!e) return false;
  if (e.name === "AbortError") return true;
  if (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") return true;
  return false;
}

async function buscar() {
  mostrarErro("");
  setAnuncioStatus("");
  syncModoUI();

  const modo = modoAtual();
  const cnsD = onlyDigits(inputCns.value);
  const cpfD = onlyDigits(inputCpf.value);
  const doc = modo === "cns" ? cnsD : cpfD;

  if (!doc) {
    setFieldValidity(false);
    mostrarErro(modo === "cns" ? "Informe o CNS (15 dígitos)." : "Informe o CPF (11 dígitos).");
    return;
  }
  if (modo === "cns" && cnsD.length < 15) {
    setFieldValidity(false);
    mostrarErro("O CNS deve ter 15 dígitos.");
    return;
  }
  if (modo === "cpf" && cpfD.length !== 11) {
    setFieldValidity(false);
    mostrarErro("O CPF deve ter 11 dígitos.");
    return;
  }
  setFieldValidity(true);

  aborter?.abort();
  aborter = new AbortController();
  const signal = aborter.signal;
  const mySeq = ++buscarSeq;

  const q = modo === "cns" ? `cns=${encodeURIComponent(cnsD)}` : `cpf=${encodeURIComponent(cpfD)}`;
  setLoading(true);
  showLoadingResultado();

  try {
    const r = await fetch(`/api/paciente?${q}`, { signal });
    if (mySeq !== buscarSeq) return;
    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error("Resposta inválida do servidor.");
    }
    if (!r.ok) {
      const det = data && (data.detail || data.message);
      throw new Error(
        typeof det === "string" ? det : det ? JSON.stringify(det) : `Erro ${r.status}`,
      );
    }
    if (mySeq !== buscarSeq) return;
    preencher(data, modo, doc);
    setTemResultado(true);
    showDadosResultado();
    setAnuncioStatus("Consulta concluída.");
    selectTab(0);
    const firstTab = tabButtons()[0];
    if (firstTab) firstTab.focus();
    requestAnimationFrame(() => scrollToResultado());
  } catch (e) {
    if (isAbortError(e)) {
      return;
    }
    if (mySeq !== buscarSeq) return;
    resultado.setAttribute("hidden", "");
    skel.setAttribute("hidden", "");
    conteudo.setAttribute("hidden", "");
    setResultadoBusy(false);
    setTemResultado(false);
    mostrarErro(e instanceof Error ? e.message : "Falha na consulta.");
  } finally {
    if (mySeq === buscarSeq) {
      setLoading(false);
    }
  }
}

function preencherChips(p) {
  const wrap = el("out-chips");
  wrap.innerHTML = "";
  const items = [];
  if (p.dataNascimento) items.push({ label: "Nasc.", value: brDate(p.dataNascimento) });
  const idade = textoIdade(p);
  if (idade) items.push({ label: "Idade", value: idade });
  if (p.descricaoSexo) items.push({ label: "Sexo", value: p.descricaoSexo });
  if (p.descricaoRacaCor) items.push({ label: "Cor", value: p.descricaoRacaCor });
  if (!items.length) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = "—";
    wrap.appendChild(c);
    return;
  }
  items.forEach((it) => {
    const c = document.createElement("span");
    c.className = "chip";
    c.setAttribute("title", it.label);
    c.textContent = it.value;
    wrap.appendChild(c);
  });
}

function preencherIdentificacao(p, cpfFmt, cnsFmt) {
  const dl = el("dl-id");
  dl.innerHTML = "";
  if (v(p.NomeCompleto) !== "—") {
    const dt = document.createElement("dt");
    dt.textContent = "Nome completo";
    const dd = document.createElement("dd");
    dd.textContent = v(p.NomeCompleto);
    dl.append(dt, dd);
  }
  if (p.NomeSocial && v(p.NomeSocial) !== "—") {
    const dt = document.createElement("dt");
    dt.textContent = "Nome social";
    const dd = document.createElement("dd");
    dd.textContent = v(p.NomeSocial);
    dl.append(dt, dd);
  }
  addRowWithCopy(dl, "CPF", cpfFmt, p.numeroCPF ?? p.CPF);
  addRowWithCopy(dl, "CNS (número)", cnsFmt, p.numeroCNS);
  if (p.dataAtribuicao) {
    const dt = document.createElement("dt");
    dt.textContent = "CNS (atribuição)";
    const dd = document.createElement("dd");
    dd.textContent = v(p.dataAtribuicao);
    dl.append(dt, dd);
  }
  if (!dl.querySelector("dt")) {
    addRows(dl, []);
  }
}

function preencherContato(p) {
  const dl = el("dl-cont");
  dl.innerHTML = "";
  const tText = formatTelFone(p);
  const tUrl = buildTelUrl(p);
  if (tText && tText !== "—") {
    addRowContato(dl, "Telefone", tText, tUrl);
  }
  const email = p.descricaoEmail || (v(p.Email) !== "—" ? v(p.Email) : null);
  if (email && email !== "—") {
    addRowContato(dl, "E-mail", email, `mailto:${encodeURIComponent(email)}`);
  }
  if (!dl.querySelector("dt")) {
    addRows(dl, []);
  }
}

function preencherSituacao(p) {
  const vipP = [strBoolish(p.Vip), strBoolish(p.protecaoTestemunha)].filter(
    (x) => x != null && x !== "—",
  );
  const rows = [
    [
      "Grau de qualidade (%)",
      p.percentualQualidade != null ? String(p.percentualQualidade) : null,
      "Indicador percentual informado no cadastro (API Datasus).",
    ],
    [
      "Cadastro alinhado à RFB",
      p.originalRFB === "true" || p.originalRFB === true
        ? "Sim"
        : p.originalRFB != null
          ? "Não"
          : null,
      "Alinhamento com a base da Receita Federal, conforme retorno do serviço.",
    ],
    ["Situação ativa", strBoolish(p.Situacao), "Situação do vínculo no cadastro."],
  ];
  if (vipP.length) {
    rows.push([
      "Proteção / restrição (VIP ou testemunha)",
      vipP.join(" · "),
      "Em caso de dúvida, confirme na instituição e siga o protocolo de privacidade.",
    ]);
  }
  addRows(el("dl-sit"), rows);
}

function preencher(p, modoBusca, docDigits) {
  preencherComparacaoMsg(p);

  const nome = v(p.NomeCompleto) || "—";
  const social = p.NomeSocial ? v(p.NomeSocial) : null;
  el("out-nome").textContent = social ? `${nome} (${social})` : nome;
  el("hero-avatar").textContent = iniciaisNome(p.NomeCompleto);
  preencherChips(p);

  const cpfFmt = formatCpf(p.numeroCPF ?? p.CPF);
  const cnsFmt = formatCns(p.numeroCNS);
  preencherResumoExec(p, cpfFmt, cnsFmt);
  preencherHeroBadges(p);
  preencherIdentificacao(p, cpfFmt, cnsFmt);

  addRows(el("dl-demo"), [
    ["Mãe", v(p.Mae)],
    ["Pai", v(p.Pai)],
    ["Sexo", p.descricaoSexo || v(p.Sexo)],
    ["Cor/raça", p.descricaoRacaCor || v(p.RacaCor)],
  ]);

  addRows(el("dl-doc"), [
    ["RG / Identidade", p.numeroIdentidade != null ? String(p.numeroIdentidade) : null],
    ["Órgão emissor", p.nomeOrgaoEmissor || v(p.OrgaoEmissor)],
    ["Data emissão", p.dataExpedicao ? brDate(p.dataExpedicao) : null],
    ["Tipo de cartão", v(p.tipoCartao)],
    [
      "Definido manualmente",
      p.manual === "true" || p.manual === true ? "Sim" : p.manual != null ? "Não" : null,
    ],
  ]);

  const munNasc = p.MunicipioNascimento ? cidadeDoBlobMunicipio(p.MunicipioNascimento) : "—";
  addRows(el("dl-nat"), [
    ["Município de nascimento", munNasc],
    ["UF (cadastro nasc.)", p.siglaUF || v(p.UF)],
    ["País", p.nomePais || v(p.PaisNascimento)],
  ]);

  const endLog =
    v(p.nomeLogradouro) !== "—"
      ? `${v(p.descricaoTipoLogradouro) !== "—" ? v(p.descricaoTipoLogradouro) + " " : ""}${v(
          p.nomeLogradouro,
        )}`.trim()
      : null;
  const munRes = p.Municipio ? cidadeDoBlobMunicipio(p.Municipio) : v(p.nomeMunicipio);
  addRows(el("dl-end"), [
    [
      "Logradouro",
      [endLog, p.numero != null && p.numero !== "" ? `nº ${p.numero}` : null, p.complemento ? v(p.complemento) : null]
        .filter(Boolean)
        .join(", ") || null,
    ],
    ["Bairro", v(p.Bairro) !== "—" ? v(p.Bairro) : v(p.descricaoBairro)],
    ["CEP", formatCep(p.CEP ?? p.numeroCEP)],
    [
      "Município (resid.) / UF",
      [munRes, p.siglaUF || ""].filter((x) => x && x !== "—").join(" / ") || null,
    ],
    ["País (resid.)", v(p.Pais) !== "—" ? v(p.Pais) : null],
  ]);

  preencherContato(p);
  preencherSituacao(p);

  pacienteAtual = p;
  if (modoBusca && docDigits) {
    registrarNoHistorico(p, modoBusca, docDigits);
  }
  ultimoSnapshot = snapshotParaComparacao(p);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  buscar();
});

btnLimpar.addEventListener("click", limparTudo);
if (btnNovaConsulta) btnNovaConsulta.addEventListener("click", novaConsulta);
if (btnOcultarDados) btnOcultarDados.addEventListener("click", ocultarDadosPaciente);

inputCns.addEventListener("input", () => {
  const cur = inputCns.value;
  inputCns.value = maskCnsInput(cur);
  updateDigitCounts();
  if (inputCns.getAttribute("aria-invalid") === "true") {
    setFieldValidity(true);
    mostrarErro("");
  }
});

inputCpf.addEventListener("input", () => {
  const cur = inputCpf.value;
  inputCpf.value = maskCpfInput(cur);
  updateDigitCounts();
  if (inputCpf.getAttribute("aria-invalid") === "true") {
    setFieldValidity(true);
    mostrarErro("");
  }
});

document.querySelectorAll('input[name="modo-busca"]').forEach((r) => {
  r.addEventListener("change", () => {
    syncModoUI();
    mostrarErro("");
    if (modoAtual() === "cns") inputCns.focus();
    else inputCpf.focus();
  });
});

/** Esc: limpa; Ctrl+Enter: consulta; Ctrl+K: foco no CNS/CPF (só com foco na aplicação). */
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape") {
      const a = document.activeElement;
      if (!a || !searchCard) return;
      if (searchCard.contains(a)) {
        e.preventDefault();
        limparTudo();
      }
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      const a = document.activeElement;
      if (form && (form.contains(a) || (searchCard && searchCard.contains(a)))) {
        e.preventDefault();
        void buscar();
      }
      return;
    }
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      const a = document.activeElement;
      if (appRoot && a && appRoot.contains(a)) {
        e.preventDefault();
        (modoAtual() === "cns" ? inputCns : inputCpf).focus();
      }
    }
  },
  true,
);

if (btnExportarTxt) {
  btnExportarTxt.addEventListener("click", () => {
    if (!pacienteAtual) return;
    const t = buildRelatorioTexto(pacienteAtual);
    downloadTextFile(`${exportFilenameStem()}.txt`, t);
  });
}
if (btnExportarPdf) {
  btnExportarPdf.addEventListener("click", () => {
    if (!pacienteAtual) return;
    void downloadRelatorioPdf(pacienteAtual);
  });
}
if (btnExportarXlsx) {
  btnExportarXlsx.addEventListener("click", () => {
    if (!pacienteAtual) return;
    downloadRelatorioXlsx(pacienteAtual);
  });
}
if (btnImprimir) {
  btnImprimir.addEventListener("click", () => {
    if (!conteudo || conteudo.hasAttribute("hidden")) return;
    window.print();
  });
}
if (btnCopiarResumo && resumoLines) {
  btnCopiarResumo.addEventListener("click", () => {
    const t = resumoLines.textContent || "";
    if (!t.trim()) return;
    void copyPlainText(t, btnCopiarResumo);
  });
}
if (btnCopiarEndereco) {
  btnCopiarEndereco.addEventListener("click", () => {
    if (!pacienteAtual) return;
    const { linha } = buildEnderecoCompleto(pacienteAtual);
    if (linha === "—" || !String(linha).trim()) return;
    void copyPlainText(linha, btnCopiarEndereco);
  });
}

syncModoUI();
selectTab(0);
atualizarEmptyState();
updateDigitCounts();
