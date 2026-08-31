const { GoogleGenAI } = require("@google/genai");
const pdfParse = require("pdf-parse");
const crypto = require("crypto");
const { pool } = require("../config/db/index.js");
const { NbaGeneratedSchema } = require("../models/nbaGeneratorModel.js");

const GEMINI_MODEL = process.env.GEMINI_MODEL;

const PO_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const PSO_CODES = [1, 2, 3, 4];

const DEFAULT_CO_CODES = [1, 2, 3, 4, 5, 6];

const toPositiveInt = (value) => {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const clampLectures = (value) => {
  const parsed = toPositiveInt(value);
  if (!parsed) {
    return null;
  }

  return Math.max(12, Math.min(parsed, 120));
};

const normalizeSyllabusForHash = (text) =>
  String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getSyllabusHash = (syllabusText) =>
  crypto.createHash("sha256").update(normalizeSyllabusForHash(syllabusText)).digest("hex");

const getGenerationHash = (syllabusText, outcomeContext) => {
  const combined = `${normalizeSyllabusForHash(syllabusText)}|${JSON.stringify(outcomeContext || {})}`;
  return crypto.createHash("sha256").update(combined).digest("hex");
};

const parseJsonArrayField = (rawValue) => {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const normalizeDescription = (value) => String(value || "").replace(/\s+/g, " ").trim();

const normalizeOutcomeContext = (reqBody) => {
  const coRowsRaw = parseJsonArrayField(reqBody?.co_rows);
  const poRowsRaw = parseJsonArrayField(reqBody?.po_rows);
  const includePsoFlag = String(reqBody?.include_pso ?? "").toLowerCase();
  const rawPsoRows = parseJsonArrayField(reqBody?.pso_rows);
  const includePso = includePsoFlag === "false"
    ? false
    : includePsoFlag === "true"
      ? true
      : rawPsoRows.length > 0;
  const psoRowsRaw = includePso ? rawPsoRows : [];

  const coMap = new Map();
  const poMap = new Map();
  const psoMap = new Map();

  for (const row of coRowsRaw) {
    const coNumber = Number.parseInt(row?.co_number, 10);
    const coDescription = normalizeDescription(row?.co_description);
    if (!coNumber || coNumber < 1 || coNumber > 6 || !coDescription) {
      continue;
    }
    coMap.set(coNumber, coDescription);
  }

  for (const row of poRowsRaw) {
    const poNumber = Number.parseInt(row?.po_number, 10);
    const title = normalizeDescription(row?.title);
    const description = normalizeDescription(row?.description);
    if (!poNumber || poNumber < 1 || poNumber > 12 || (!description && !title)) {
      continue;
    }
    poMap.set(poNumber, { title, description });
  }

  for (const row of psoRowsRaw) {
    const psoNumber = Number.parseInt(row?.pso_number, 10);
    const title = normalizeDescription(row?.title);
    const description = normalizeDescription(row?.description);
    if (!psoNumber || psoNumber < 1 || psoNumber > 4 || (!description && !title)) {
      continue;
    }
    psoMap.set(psoNumber, { title, description });
  }

  const coRows = Array.from(coMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([co_number, co_description]) => ({ co_number, co_description }));

  const poRows = Array.from(poMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([po_number, value]) => ({
      po_number,
      title: value.title,
      description: value.description
    }));

  const psoRows = Array.from(psoMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pso_number, value]) => ({
      pso_number,
      title: value.title,
      description: value.description
    }));

  const coNumbers = coRows.map((row) => row.co_number);
  const poNumbers = poRows.map((row) => row.po_number);
  const psoNumbers = psoRows.map((row) => row.pso_number);

  return {
    co_rows: coRows,
    po_rows: poRows,
    pso_rows: psoRows,
    co_numbers: coNumbers,
    po_numbers: poNumbers,
    pso_numbers: psoNumbers,
    has_co: coNumbers.length > 0,
    has_po: poNumbers.length > 0,
    has_pso: psoNumbers.length > 0,
    include_pso: includePso
  };
};

const extractJsonObject = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }

  return text.slice(start, end + 1);
};

const alignGeneratedPayloadToOutcomeContext = (generated, outcomeContext, targetLectures) => {
  const coNumbers = outcomeContext?.co_numbers?.length ? outcomeContext.co_numbers : DEFAULT_CO_CODES;
  const poNumbers = outcomeContext?.po_numbers || PO_CODES;
  const psoNumbers = outcomeContext?.pso_numbers || [];

  const allowedCo = new Set(coNumbers);
  const allowedPo = new Set(poNumbers);
  const allowedPso = new Set(psoNumbers);

  const normalizedLecturePlan = (Array.isArray(generated?.lecture_plan) ? generated.lecture_plan : []).map((row, index) => {
    const unit = String(row?.unit || `Unit ${Math.floor(index / 5) + 1}`).trim() || `Unit ${Math.floor(index / 5) + 1}`;
    const lectureNo = Number.parseInt(row?.lecture_no, 10);
    const topic = String(row?.topic || "").trim() || `Lecture topic ${index + 1}`;
    const coNumber = Number.parseInt(row?.co_number, 10);
    const resolvedCo = allowedCo.has(coNumber)
      ? coNumber
      : coNumbers[index % coNumbers.length];

    return {
      unit,
      lecture_no: Number.isNaN(lectureNo) ? index + 1 : lectureNo,
      topic,
      co_number: resolvedCo
    };
  });

  const dedupMap = new Map();
  const rawMappings = Array.isArray(generated?.co_po_pso_strength_mappings)
    ? generated.co_po_pso_strength_mappings
    : [];

  for (const item of rawMappings) {
    const coNumber = Number.parseInt(item?.co_number, 10);
    const outcomeType = String(item?.outcome_type || "").toUpperCase();
    const outcomeCode = Number.parseInt(item?.outcome_code, 10);
    const strength = Number.parseInt(item?.strength, 10);
    const justification = String(item?.justification || "").trim();

    if (!allowedCo.has(coNumber)) {
      continue;
    }

    if (outcomeType === "PO") {
      if (!allowedPo.has(outcomeCode)) {
        continue;
      }
    } else if (outcomeType === "PSO") {
      if (!outcomeContext?.has_pso || !allowedPso.has(outcomeCode)) {
        continue;
      }
    } else {
      continue;
    }

    if (Number.isNaN(strength) || strength < 1 || strength > 3) {
      continue;
    }

    const key = `${coNumber}-${outcomeType}-${outcomeCode}`;
    const existing = dedupMap.get(key);
    if (!existing || strength > existing.strength) {
      dedupMap.set(key, {
        co_number: coNumber,
        outcome_type: outcomeType,
        outcome_code: outcomeCode,
        strength,
        justification
      });
    }
  }

  const normalizedMappings = Array.from(dedupMap.values());

  for (const coNumber of coNumbers) {
    const hasAny = normalizedMappings.some((item) => item.co_number === coNumber);
    if (hasAny) {
      continue;
    }

    if (poNumbers.length) {
      normalizedMappings.push({
        co_number: coNumber,
        outcome_type: "PO",
        outcome_code: poNumbers[coNumber % poNumbers.length],
        strength: 2,
        justification: "CO to PO mapping suggested by syllabus coverage; review and refine with evidence."
      });
    }
  }

  const requiredLectures = Number.parseInt(targetLectures, 10);
  const lecturePlan = normalizedLecturePlan
    .sort((a, b) => a.lecture_no - b.lecture_no)
    .map((row, index) => ({ ...row, lecture_no: index + 1 }));

  const trimmedLecturePlan = !Number.isNaN(requiredLectures) && requiredLectures > 0
    ? lecturePlan.slice(0, requiredLectures)
    : lecturePlan;

  return {
    lecture_plan: trimmedLecturePlan,
    co_po_pso_strength_mappings: normalizedMappings
  };
};

const parseAndNormalizeResponse = (rawText, outcomeContext, targetLectures) => {
  const clean = rawText.replace(/```json|```/gi, "").trim();
  const jsonText = extractJsonObject(clean);
  const parsed = JSON.parse(jsonText);

  const lecturePlan = Array.isArray(parsed?.lecture_plan)
    ? parsed.lecture_plan
    : Array.isArray(parsed?.lecturePlan)
      ? parsed.lecturePlan
      : [];

  const mappings = Array.isArray(parsed?.co_po_pso_strength_mappings)
    ? parsed.co_po_pso_strength_mappings
    : Array.isArray(parsed?.mappingMatrix)
      ? parsed.mappingMatrix.flatMap((row) => {
          const coNumber = Number.parseInt(String(row?.co || "").replace(/[^0-9]/g, ""), 10);
          if (!coNumber || Number.isNaN(coNumber)) {
            return [];
          }

          const poEntries = Object.entries(row?.po || {}).map(([key, value]) => ({
            co_number: coNumber,
            outcome_type: "PO",
            outcome_code: Number.parseInt(String(key).replace(/[^0-9]/g, ""), 10),
            strength: Number(value) || 0,
            justification: String(row?.justification?.po?.[key] || row?.justification?.[key] || "").trim()
          }));

          const psoEntries = Object.entries(row?.pso || {}).map(([key, value]) => ({
            co_number: coNumber,
            outcome_type: "PSO",
            outcome_code: Number.parseInt(String(key).replace(/[^0-9]/g, ""), 10),
            strength: Number(value) || 0,
            justification: String(row?.justification?.pso?.[key] || row?.justification?.[key] || "").trim()
          }));

          return [...poEntries, ...psoEntries].filter(
            (item) => item.outcome_code && item.strength >= 0
          );
        })
      : [];

  return alignGeneratedPayloadToOutcomeContext({
    lecture_plan: lecturePlan,
    co_po_pso_strength_mappings: mappings
  }, outcomeContext, targetLectures);
};

const getSyllabusText = async (req) => {
  if (!req.file || !req.file.buffer) {
    const saved = await getSavedSyllabusByOfferingId(req.body?.offering_id);
    if (saved?.text) {
      return {
        text: saved.text,
        source: "subject",
        valid: true,
        file_name: saved.fileName
      };
    }

    return {
      text: "",
      source: "none",
      valid: false,
      reason: "Upload syllabus PDF from Create Subject before using AI generation"
    };
  }

  const mimeType = String(req.file.mimetype || "").toLowerCase();
  const fileName = String(req.file.originalname || "").toLowerCase();
  const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf");

  if (!isPdf) {
    return {
      text: "",
      source: "file",
      valid: false,
      reason: "Only PDF files are supported for syllabus upload"
    };
  }

  try {
    const parsed = await pdfParse(req.file.buffer);
    const text = String(parsed?.text || "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      return {
        text: "",
        source: "file",
        valid: false,
        reason: "Could not extract readable text from PDF"
      };
    }

    return { text, source: "file", valid: true };
  } catch {
    return {
      text: "",
      source: "file",
      valid: false,
      reason: "Failed to parse PDF. Please upload a valid text-based PDF file."
    };
  }
};

const isQuotaError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 429 || /quota|too many requests|rate limit/.test(message);
};

const isAuthOrKeyError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 401 || /api key|invalid key|unauthorized|authentication/.test(message);
};

const isPermissionOrBillingError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 403 || /permission denied|forbidden|billing|not enabled|insufficient permissions/.test(message);
};

const isNetworkFetchError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const causeCode = String(error?.cause?.code || "").toUpperCase();
  return message.includes("fetch failed") || [
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EAI_AGAIN"
  ].includes(causeCode);
};

const getStoredLectureCountByOfferingId = async (offeringId) => {
  const parsedOfferingId = toPositiveInt(offeringId);
  if (!parsedOfferingId) {
    return null;
  }

  const query = `
    SELECT
      COALESCE(
        NULLIF(MAX(asf.total_lectures), 0),
        NULLIF(MAX(os.number_of_lectures), 0)
      ) AS lecture_count
    FROM offered_subjects os
    LEFT JOIN assigned_subject_faculty asf
      ON asf.offering_id = os.id
      AND asf.is_deleted = false
    WHERE os.id = $1
      AND os.is_deleted = false
  `;

  const result = await pool.query(query, [parsedOfferingId]);
  return clampLectures(result?.rows?.[0]?.lecture_count);
};

const resolveTargetLectureCount = async (req) => {
  const byTotalLectures = clampLectures(req.body?.total_lectures);
  if (byTotalLectures) {
    return byTotalLectures;
  }

  const byNumberOfLectures = clampLectures(req.body?.number_of_lectures);
  if (byNumberOfLectures) {
    return byNumberOfLectures;
  }

  const fromDb = await getStoredLectureCountByOfferingId(req.body?.offering_id);
  if (fromDb) {
    return fromDb;
  }

  return 42;
};

const getLatestGenerationByOfferingId = async (offeringId) => {
  const parsedOfferingId = toPositiveInt(offeringId);
  if (!parsedOfferingId) {
    return null;
  }

  const query = `
    SELECT
      offering_id,
      syllabus_hash,
      subject_name,
      target_lectures,
      generated_payload,
      model_used,
      created_at,
      updated_at
    FROM nba_generation_cache
    WHERE offering_id = $1
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [parsedOfferingId]);
  return result?.rows?.[0] || null;
};

const getGenerationByOfferingAndHash = async (offeringId, syllabusHash) => {
  const parsedOfferingId = toPositiveInt(offeringId);
  if (!parsedOfferingId || !syllabusHash) {
    return null;
  }

  const query = `
    SELECT
      offering_id,
      syllabus_hash,
      subject_name,
      target_lectures,
      generated_payload,
      model_used,
      created_at,
      updated_at
    FROM nba_generation_cache
    WHERE offering_id = $1
      AND syllabus_hash = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [parsedOfferingId, syllabusHash]);
  return result?.rows?.[0] || null;
};

const upsertGenerationCache = async ({
  offeringId,
  syllabusHash,
  subjectName,
  targetLectures,
  generated,
  modelUsed
}) => {
  const parsedOfferingId = toPositiveInt(offeringId);
  if (!parsedOfferingId || !syllabusHash || !generated) {
    return;
  }

  const query = `
    INSERT INTO nba_generation_cache (
      offering_id,
      syllabus_hash,
      subject_name,
      target_lectures,
      generated_payload,
      model_used
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    ON CONFLICT (offering_id, syllabus_hash)
    DO UPDATE SET
      subject_name = EXCLUDED.subject_name,
      target_lectures = EXCLUDED.target_lectures,
      generated_payload = EXCLUDED.generated_payload,
      model_used = EXCLUDED.model_used,
      updated_at = CURRENT_TIMESTAMP
  `;

  await pool.query(query, [
    parsedOfferingId,
    syllabusHash,
    subjectName,
    toPositiveInt(targetLectures),
    JSON.stringify(generated),
    String(modelUsed || "unknown")
  ]);
};

const cleanLine = (line) =>
  String(line || "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();

const isGarbageLine = (line) => {
  const value = cleanLine(line);
  if (!value) {
    return true;
  }

  if (value.length < 4) {
    return true;
  }

  if (/^page\s*\d+\s*of\s*\d+$/i.test(value)) {
    return true;
  }

  if (/^w$|^e$|^f$/i.test(value)) {
    return true;
  }

  if (/^\d+\s+\d+%?$/.test(value)) {
    return true;
  }

  if (/^sr\.?\s*no\.?$/i.test(value) || /^hrs$/i.test(value) || /^weightage$/i.test(value)) {
    return true;
  }

  if (/^(gujarat technological university|teaching and examination scheme|teaching scheme credits examination marks total|subject code\s*:|semester\s*[\u2013\-]|type of course\s*:|prerequisite\s*:|rationale\s*:|content\s*:|reference books\s*:)/i.test(value)) {
    return true;
  }

  return false;
};

const normalizeTopic = (line) =>
  cleanLine(line)
    .replace(/^\d+[.)-]?\s+/, "")
    .replace(/\s*[\u2013\-]\s*$/, "")
    .replace(/[;:,.-]+$/, "")
    .trim();

const normalizeForCompare = (value) =>
  normalizeTopic(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const looksLikeTopic = (line) => {
  const value = normalizeTopic(line);
  if (!value || value.length < 8) {
    return false;
  }

  if (isGarbageLine(value)) {
    return false;
  }

  if (/^(ay\s*\d{4}|bachelor of engineering|subject name\s*:)/i.test(value)) {
    return false;
  }

  return /[a-z]/i.test(value);
};

const getRelevantSyllabusSection = (syllabusText) => {
  const normalized = String(syllabusText || "").replace(/\r/g, "");
  const contentMatch = normalized.match(/content\s*:\s*([\s\S]*?)(?:reference books\s*:|course outcomes\s*:|\n\s*\d+\.\s*reference|$)/i);
  if (contentMatch && contentMatch[1]) {
    return contentMatch[1];
  }

  return normalized;
};

const buildTopicPool = (syllabusText) => {
  const section = getRelevantSyllabusSection(syllabusText);
  const rawLines = section
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.;])\s+/));

  const unique = new Set();
  const topics = [];

  for (const raw of rawLines) {
    if (!looksLikeTopic(raw)) {
      continue;
    }

    const topic = normalizeTopic(raw);
    const key = normalizeForCompare(topic);
    if (!key || unique.has(key)) {
      continue;
    }

    unique.add(key);
    topics.push(topic);
  }

  return topics;
};

const extractStructuredUnitChunks = (syllabusText) => {
  const section = getRelevantSyllabusSection(syllabusText);
  const unitRegex = /(unit\s*\d+)\s*[:\-]?\s*([\s\S]*?)(?=\n\s*unit\s*\d+\s*[:\-]?|$)/gi;
  const chunks = [];

  let match = unitRegex.exec(section);
  while (match) {
    const unit = cleanLine(match[1]).replace(/\s+/g, " ");
    const content = cleanLine(match[2]);
    if (unit && content) {
      chunks.push({ unit: unit.replace(/^unit\s*/i, "Unit "), content });
    }
    match = unitRegex.exec(section);
  }

  return chunks;
};

const extractUnitChunks = (syllabusText) => {
  const structured = extractStructuredUnitChunks(syllabusText);
  if (structured.length) {
    return structured;
  }

  const topics = buildTopicPool(syllabusText);
  if (!topics.length) {
    return [{ unit: "Unit 1", content: syllabusText }];
  }

  const chunkSize = Math.max(3, Math.ceil(topics.length / 5));
  const chunks = [];
  for (let index = 0; index < topics.length; index += chunkSize) {
    chunks.push({
      unit: `Unit ${chunks.length + 1}`,
      content: topics.slice(index, index + chunkSize).join(". ")
    });
  }

  if (!chunks.length) {
    return [{ unit: "Unit 1", content: syllabusText }];
  }

  return chunks;
};

const buildLocalLecturePlan = (syllabusText, targetLectures = 42, coNumbers = DEFAULT_CO_CODES) => {
  const units = extractUnitChunks(syllabusText);
  const basePerUnit = Math.floor(targetLectures / units.length);
  const extra = targetLectures % units.length;

  const lecturePlan = [];
  let lectureNo = 1;

  units.forEach((unitData, index) => {
    const topicSeeds = unitData.content
      .split(/[.;\n]/)
      .map((value) => normalizeTopic(value))
      .filter((value) => looksLikeTopic(value));

    const safeSeeds = topicSeeds.length
      ? topicSeeds
      : buildTopicPool(unitData.content).slice(0, 8);

    const fallbackTopic = `${unitData.unit}: Core concepts and problem solving`;
    const cleanedUnit = /^unit\s+\d+/i.test(unitData.unit) ? unitData.unit : `Unit ${index + 1}`;

    const compactSeeds = safeSeeds
      .filter(Boolean);

    const lectureCount = basePerUnit + (index < extra ? 1 : 0);
    for (let i = 0; i < lectureCount; i += 1) {
      const seed = compactSeeds.length ? compactSeeds[i % compactSeeds.length] : fallbackTopic;
      lecturePlan.push({
        unit: cleanedUnit,
        lecture_no: lectureNo,
        topic: seed || fallbackTopic,
        co_number: coNumbers[(lectureNo - 1) % coNumbers.length]
      });
      lectureNo += 1;
    }
  });

  return lecturePlan;
};

const buildLocalStrengthMappings = (outcomeContext) => {
  const mappings = [];
  const coNumbers = outcomeContext?.co_numbers?.length ? outcomeContext.co_numbers : DEFAULT_CO_CODES;
  const poNumbers = outcomeContext?.po_numbers?.length ? outcomeContext.po_numbers : PO_CODES;
  const psoNumbers = outcomeContext?.pso_numbers?.length ? outcomeContext.pso_numbers : [];

  for (const co of coNumbers) {
    const po1 = poNumbers[(co - 1) % poNumbers.length];
    const po2 = poNumbers[(co + 2) % poNumbers.length];

    mappings.push({ co_number: co, outcome_type: "PO", outcome_code: po1, strength: 3 });

    if (poNumbers.length > 1) {
      mappings.push({ co_number: co, outcome_type: "PO", outcome_code: po2, strength: 2 });
    }

    if (psoNumbers.length) {
      const pso = psoNumbers[(co - 1) % psoNumbers.length];
      mappings.push({ co_number: co, outcome_type: "PSO", outcome_code: pso, strength: 2 });
    }
  }

  return mappings;
};

const generateLocalFallback = (subjectName, syllabusText, targetLectures, outcomeContext) => {
  const lecturePlan = buildLocalLecturePlan(
    `${subjectName}. ${syllabusText}`,
    targetLectures,
    outcomeContext?.co_numbers?.length ? outcomeContext.co_numbers : DEFAULT_CO_CODES
  );
  const mappings = buildLocalStrengthMappings(outcomeContext);

  return alignGeneratedPayloadToOutcomeContext({
    lecture_plan: lecturePlan,
    co_po_pso_strength_mappings: mappings
  }, outcomeContext, targetLectures);
};

const getSavedSyllabusByOfferingId = async (offeringId) => {
  const parsedOfferingId = toPositiveInt(offeringId);
  if (!parsedOfferingId) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT s.syllabus_text, s.syllabus_file_name
      FROM offered_subjects os
      JOIN subject s ON s.subject_code = os.subject_code AND s.is_deleted = FALSE
      WHERE os.id = $1
        AND os.is_deleted = FALSE
      LIMIT 1
    `,
    [parsedOfferingId]
  );

  const text = String(result.rows[0]?.syllabus_text || "").trim();
  if (!text) {
    return null;
  }

  return {
    text,
    fileName: result.rows[0]?.syllabus_file_name || "saved syllabus"
  };
};

// const tryGenerateWithModel = async (genAI, prompt) => {
//   const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
//   const result = await model.generateContent(prompt);
//   const response = await result.response;
//   return { text: response.text(), modelName: GEMINI_MODEL };
// };
const tryGenerateWithModel = async (ai, prompt) => {
  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  });

  if (!result?.text) {
    throw new Error("Empty response from Gemini API");
  }

  return {
    text: result.text,
    modelName: GEMINI_MODEL
  };
};

const generateNbaContent = async (req, res) => {
  try {
    const subjectName = String(req.body?.subject_name || "").trim();
    const offeringId = toPositiveInt(req.body?.offering_id);
    const outcomeContext = normalizeOutcomeContext(req.body);
    const syllabusInput = await getSyllabusText(req);
    const syllabusText = syllabusInput.text;
    const syllabusHash = syllabusText ? getGenerationHash(syllabusText, outcomeContext) : null;
    const targetLectures = await resolveTargetLectureCount(req);

    if (!subjectName || !syllabusText) {
      if (syllabusInput.source !== "none" && !syllabusInput.valid) {
        return res.status(400).json({
          message: syllabusInput.reason
        });
      }

      return res.status(400).json({
        message: "subject_name and saved syllabus are required"
      });
    }

    if (!outcomeContext.has_co || !outcomeContext.has_po) {
      return res.status(400).json({
        message: "CO and PO data are required before using AI generation. Save CO and PO tables first."
      });
    }

    if (offeringId && syllabusHash) {
      const cached = await getGenerationByOfferingAndHash(offeringId, syllabusHash);
      if (cached?.generated_payload && String(cached.model_used || "").toLowerCase() !== "local-fallback") {
        return res.status(200).json({
          message: "Generated successfully (reused previous output)",
          model: cached.model_used || "cached",
          reused: true,
          cached_for_offering_id: offeringId,
          generated: cached.generated_payload
        });
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        message: "AI generation is unavailable. Configure GEMINI_API_KEY to use this endpoint."
      });
    }

    if (!GEMINI_MODEL || !String(GEMINI_MODEL).trim()) {
      return res.status(503).json({
        message: "AI generation is unavailable. Configure GEMINI_MODEL to use this endpoint."
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
You are an expert NBA curriculum planner for engineering courses.

Task:
Create a professional semester lecture plan and CO-PO/PSO strength mapping from the syllabus.

Subject: ${subjectName}
Syllabus text:
${syllabusText}

Course outcomes for this offering (use only these CO numbers):
${JSON.stringify(outcomeContext.co_rows)}

Program outcomes for this offering (use only these PO numbers):
${JSON.stringify(outcomeContext.po_rows)}

Program specific outcomes for this offering:
${JSON.stringify(outcomeContext.pso_rows)}

Output format requirements (STRICT):
- Return ONLY valid JSON.
- No markdown, no code fences, no explanation text.
- Top-level keys must be exactly:
  1) lecture_plan
  2) co_po_pso_strength_mappings

lecture_plan rules:
- Exactly ${targetLectures} lectures total.
- Each item must have exactly:
  - unit: string like "Unit 1", "Unit 2"
  - lecture_no: integer starting at 1 and strictly increasing by 1
  - topic: concise faculty-ready lecture topic (6 to 16 words)
  - co_number: one of ${JSON.stringify(outcomeContext.co_numbers)}
- Keep topic names technical and classroom-usable.
- Follow the syllabus sequence and unit structure.
- Remove/ignore all PDF artifacts and admin text, including:
  "GUJARAT TECHNOLOGICAL UNIVERSITY", "Page X of Y", "AY 2018-19", 
  "Subject Code", "Teaching and Examination Scheme", single letters like "w/e/f",
  standalone numbers/percentages, table headers, and form metadata.
- Never output junk, page headers, broken fragments, or repeated boilerplate.

co_po_pso_strength_mappings rules:
- Each item must have exactly:
  - co_number: one of ${JSON.stringify(outcomeContext.co_numbers)}
  - outcome_type: "PO" or "PSO"
  - outcome_code: if outcome_type="PO", use only ${JSON.stringify(outcomeContext.po_numbers)}
  - outcome_code: if outcome_type="PSO", use only ${JSON.stringify(outcomeContext.pso_numbers)}
  - strength: integer 1..3 (do not use 0)
  - justification: 1-2 sentences explaining why this strength value fits (coverage, depth, assessment evidence)
- Use meaningful sparse mappings only (not dense all-to-all mapping).
- Ensure every CO has at least one mapping.
- If PSO list is empty, do not output any PSO mappings.

Validation before final output:
- JSON must parse.
- lecture_no must be continuous with no gaps.
- topic must not contain parentheses suffixes like "(Lecture X)".
- topic must not contain "Page", "Subject Code", "AY", "University", or other metadata labels.

Reference schema example:
${JSON.stringify(NbaGeneratedSchema)}
`;

    try {
      const generated = await tryGenerateWithModel(ai, prompt);
      const parsed = parseAndNormalizeResponse(generated.text, outcomeContext, targetLectures);

      await upsertGenerationCache({
        offeringId,
        syllabusHash,
        subjectName,
        targetLectures,
        generated: parsed,
        modelUsed: generated.modelName
      });

      return res.status(200).json({
        message: "Generated successfully",
        model: generated.modelName,
        generated: parsed
      });
    } catch (generationError) {
      if (isAuthOrKeyError(generationError)) {
        return res.status(401).json({
          message: "AI generation failed: GEMINI_API_KEY is missing/invalid or unauthorized."
        });
      }

      if (isPermissionOrBillingError(generationError)) {
        return res.status(403).json({
          message: "AI generation failed: Gemini API access/billing is not enabled for this key/project."
        });
      }

      if (isQuotaError(generationError)) {
        return res.status(429).json({
          message: "AI generation failed due to quota/rate limit. Please try again later."
        });
      }

      if (isNetworkFetchError(generationError)) {
        return res.status(503).json({
          message: "AI generation failed due to network/connectivity issue while contacting Gemini. Check internet, proxy, firewall, and DNS settings."
        });
      }

      throw generationError;
    }
  } catch (error) {
    console.error("Gemini generation error:", error);
    return res.status(500).json({
      message: "Failed to generate lecture plan and CO-PO/PSO mapping"
    //   details: error?.message || "Unknown error"
    });
  }
};

const copyPreviousNbaContent = async (req, res) => {
  try {
    const offeringId = toPositiveInt(req.params?.offering_id || req.body?.offering_id || req.query?.offering_id);
    if (!offeringId) {
      return res.status(400).json({ message: "offering_id is required" });
    }

    const latest = await getLatestGenerationByOfferingId(offeringId);
    if (!latest?.generated_payload) {
      return res.status(404).json({
        message: "No previously generated data found for this offering_id"
      });
    }

    return res.status(200).json({
      message: "Copied previous generated data successfully",
      copied: true,
      offering_id: offeringId,
      model: latest.model_used || "cached",
      generated: latest.generated_payload
    });
  } catch (error) {
    console.error("Copy previous NBA content error:", error);
    return res.status(500).json({
      message: "Failed to copy previous generated data"
    });
  }
};

const clearNbaCacheByOfferingId = async (req, res) => {
  try {
    const offeringId = toPositiveInt(req.params?.offering_id || req.body?.offering_id || req.query?.offering_id);
    if (!offeringId) {
      return res.status(400).json({ message: "offering_id is required" });
    }

    const deleteQuery = `
      DELETE FROM nba_generation_cache
      WHERE offering_id = $1
    `;

    const result = await pool.query(deleteQuery, [offeringId]);
    const deletedCount = Number(result?.rowCount || 0);

    if (!deletedCount) {
      return res.status(404).json({
        message: "No cache rows found for this offering_id",
        offering_id: offeringId,
        deleted_count: 0
      });
    }

    return res.status(200).json({
      message: "NBA generation cache cleared successfully",
      offering_id: offeringId,
      deleted_count: deletedCount
    });
  } catch (error) {
    console.error("Clear NBA cache error:", error);
    return res.status(500).json({
      message: "Failed to clear nba_generation_cache data"
    });
  }
};

module.exports = {
  generateNbaContent,
  copyPreviousNbaContent,
  clearNbaCacheByOfferingId
};
