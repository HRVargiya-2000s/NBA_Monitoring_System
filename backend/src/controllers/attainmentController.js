const { pool } = require("../config/db/index.js");
const xlsx = require("xlsx");
const pdfParse = require("pdf-parse");
const {
  getStoredCoAttainmentReportByOffering,
  getStoredOverallCoAttainmentReportByOffering,
  getCourseOutcomesByOffering,
  getProgramOutcomes,
  getProgramOutcomesDetailed,
  getProgramSpecificOutcomesByBranch,
  upsertCourseOutcomesByOffering,
  upsertProgramOutcomes,
  replaceProgramOutcomesFromImport,
  upsertProgramSpecificOutcomesByBranch,
  upsertCoPoPsoStrengthMapping,
  updateCoPoPsoStrengthMappingByComposite,
  getCoPoPsoStrengthMappingsByOffering,
  getStoredCoPoPsoAttainmentByOffering,
  getOfferingReportContextById,
  getNbaOutcomeHeadersByOffering,
  replaceCoPoPsoAttainmentAverageRowsByOffering,
  getOfferedSubjectsWithFacultyByYearBranch,
  getOfferedSubjectsWithFacultyByBatchBranch,
  getCoPoPsoAttainmentAverageByOfferingIds,
  getOverallCoAttainmentByOfferingIds,
  getDepartmentCodeNameList
} = require("../models/attainmentModel.js");
const {
  generateAndStoreAttainmentReports,
  generateAndStoreCoPoPsoAttainmentReports
} = require("../services/attainmentService.js");

const generateAttainmentByOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const offeringId = resolveOfferingId(req);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id. Send JSON body with offering_id." });
    }

    await client.query("BEGIN");
    const result = await generateAndStoreAttainmentReports(client, offeringId);
    const coPoPsoResult = await generateAndStoreCoPoPsoAttainmentReports(client, offeringId);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "Attainment reports generated and stored successfully",
      offering_id: offeringId,
      generated_co_rows: result.coRows.length,
      generated_overall_rows: result.overallRows.length,
      generated_copo_pso_rows: coPoPsoResult.generatedRows,
      copo_pso_mappings_count: coPoPsoResult.mappingsCount
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getStoredCoAttainmentByOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id } = req.params;
    const offeringId = Number.parseInt(offering_id, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const coRows = await getStoredCoAttainmentReportByOffering(client, offeringId);
    const overallRows = await getStoredOverallCoAttainmentReportByOffering(client, offeringId);

    if (!coRows.length && !overallRows.length) {
      return res.status(404).json({
        message: "No stored attainment report found for this offering. Generate it first."
      });
    }

    return res.status(200).json({
      message: "Stored CO attainment fetched successfully",
      offering_id: offeringId,
      component_wise: coRows,
      overall: overallRows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getCourseOutcomesByOfferingId = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id } = req.params;
    const offeringId = Number.parseInt(offering_id, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const rows = await getCourseOutcomesByOffering(client, offeringId);

    return res.status(200).json({
      message: "Course outcomes fetched successfully",
      offering_id: offeringId,
      course_outcomes: rows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const upsertCourseOutcomesForOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id } = req.params;
    const offeringId = Number.parseInt(offering_id, 10);
    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const body = resolveRequestBody(req);
    if (!Array.isArray(body?.rows)) {
      return res.status(400).json({ message: "rows array is required" });
    }

    if (body.rows.length !== 6) {
      return res.status(400).json({ message: "rows must contain exactly CO1 to CO6" });
    }

    const normalizedRows = body.rows.map((row) => {
      const coNumber = Number.parseInt(row?.co_number, 10);
      if (!coNumber || Number.isNaN(coNumber) || coNumber < 1 || coNumber > 6) {
        throw new Error("co_number must be between 1 and 6");
      }

      return {
        co_number: coNumber,
        co_description: String(row?.co_description ?? "").trim()
      };
    });

    await client.query("BEGIN");
    const updatedRows = await upsertCourseOutcomesByOffering(client, offeringId, normalizedRows);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "Course outcomes saved successfully",
      offering_id: offeringId,
      course_outcomes: updatedRows
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.message === "co_number must be between 1 and 6") {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getProgramOutcomesGlobal = async (req, res) => {
  const client = await pool.connect();

  try {
    const rows = await getProgramOutcomesDetailed(client);

    return res.status(200).json({
      message: "Program outcomes fetched successfully",
      program_outcomes: rows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const upsertProgramOutcomesGlobal = async (req, res) => {
  const client = await pool.connect();

  try {
    const body = resolveRequestBody(req);
    if (!Array.isArray(body?.rows)) {
      return res.status(400).json({ message: "rows array is required" });
    }

    const normalizedRows = body.rows.map((row) => {
      const poNumber = Number.parseInt(row?.po_number, 10);
      if (!poNumber || Number.isNaN(poNumber) || poNumber < 1 || poNumber > 11) {
        throw new Error("po_number must be between 1 and 11");
      }

      return {
        po_number: poNumber,
        title: String(row?.title ?? "").trim(),
        description: String(row?.description ?? "").trim(),
        competency_number: row?.competency_number || '',
        competency_text: row?.competency_text || '',
        indicator_number: row?.indicator_number || '',
        indicator_text: row?.indicator_text || ''
      };
    });

    // ensure no duplicate po_numbers
    const uniquePo = new Set(normalizedRows.map((row) => row.po_number));
    if (uniquePo.size !== normalizedRows.length) {
      return res.status(400).json({ message: "Duplicate po_number values are not allowed" });
    }

    await client.query("BEGIN");
    // Use replace routine so removals are persisted as well
    const updatedRows = await replaceProgramOutcomesFromImport(client, normalizedRows);
    await client.query("COMMIT");

    const detailedRows = await getProgramOutcomesDetailed(client);

    return res.status(200).json({
      message: "Program outcomes saved successfully",
      updated_rows: Array.isArray(updatedRows) ? updatedRows.length : 0,
      program_outcomes: detailedRows
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.message === "po_number must be between 1 and 11") {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const normalizeImportText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeImportHeader = (header) => normalizeImportText(header).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const STANDARD_PO_DESCRIPTIONS = {
  1: 'Apply knowledge of mathematics, natural science, computing, engineering fundamentals and an engineering specialization as specified in WK1 to WK4 respectively to develop to the solution of complex engineering problems.',
  2: 'Identify, formulate, review research literature and analyze complex engineering problems reaching substantiated conclusions with consideration for sustainable development.',
  3: 'Design creative solutions for complex engineering problems and design/develop systems/components/processes to meet identified needs with consideration for public health and safety, whole-life cost, net zero carbon, culture, society and environment as required.',
  4: 'Conduct investigations of complex engineering problems using research-based knowledge including design of experiments, modelling, analysis and interpretation of data to provide valid conclusions.',
  5: 'Create, select and apply appropriate techniques, resources and modern engineering and IT tools, including prediction and modelling, to complex engineering problems, with an understanding of their limitations.',
  6: 'Apply reasoning informed by contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to professional engineering practice.',
  7: 'Understand and evaluate the sustainability and impact of professional engineering work in the solution of complex engineering problems in societal and environmental contexts.',
  8: 'Apply ethical principles and commit to professional ethics, human values, diversity and inclusion, and norms of engineering practice.',
  9: 'Function effectively as an individual, and as a member or leader in diverse and inclusive teams and in multidisciplinary, face-to-face, remote and distributed settings.',
  10: 'Communicate effectively and inclusively on complex engineering activities with the engineering community and with society at large, including writing effective reports and design documentation, making effective presentations, and giving and receiving clear instructions.',
  11: 'Demonstrate knowledge and understanding of engineering management principles and economic decision-making and apply these to one’s own work, as a member and leader in a team, and to manage projects in multidisciplinary environments.'
};

const resolvePoDescription = (poNumber, title, description) => {
  const cleanTitle = normalizeImportText(title).toLowerCase();
  const cleanDescription = normalizeImportText(description);
  if (cleanDescription && cleanDescription.toLowerCase() !== cleanTitle) {
    return cleanDescription;
  }

  return STANDARD_PO_DESCRIPTIONS[Number(poNumber)] || cleanDescription;
};

const parseOutcomeNumber = (value) => {
  const text = normalizeImportText(value);
  const poMatch = text.match(/\bPO\s*[-:]?\s*(\d{1,2})\b/i);
  if (poMatch) {
    return Number.parseInt(poMatch[1], 10);
  }

  const leadingMatch = text.match(/^\s*(\d{1,2})\b/);
  if (leadingMatch) {
    return Number.parseInt(leadingMatch[1], 10);
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isNaN(parsed) ? NaN : parsed;
};

const parseDocumentRows = async (file) => {
  if (!file?.buffer) {
    return { rows: [], error: "Import file is required" };
  }

  const fileName = String(file.originalname || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();
  const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf");
  const isSpreadsheet = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv") || mimeType.includes("sheet") || mimeType.includes("csv");

  const acceptedHeaders = {
    po_number: ["po_number", "po_no", "po", "po_number_", "po_code", "outcome_no", "outcome_number"],
    title: ["po_title", "title", "po_title_", "outcome_title", "program_outcome_title", "programme_outcome_title", "graduate_attribute"],
    description: ["po_description", "description", "po_description_", "outcome_description", "program_outcome", "program_outcomes", "programme_outcome", "programme_outcomes", "po_statement", "statement"],
    competency_number: ["competency_number", "competency_no", "competency_code"],
    competency_text: ["competency_text", "competency_description", "competency_desc", "competency", "competencies"],
    indicator_number: ["indicator_number", "indicator_no", "indicator_code", "performance_indicator_number", "performance_indicator_no", "pi_number", "pi_no"],
    indicator_text: ["indicator_text", "indicator_description", "indicator_desc", "indicator", "indicators", "performance_indicator", "performance_indicators", "performance_indicator_text", "pi", "pi_text"]
  };

  const headerMatchesAliases = (header, aliases) => {
    if (!header) {
      return false;
    }

    return aliases.some((alias) => header === alias || header.startsWith(`${alias}_`) || header.endsWith(`_${alias}`));
  };

  const resolveHeaderKey = (header) => {
    const normalizedHeader = normalizeImportHeader(header);
    for (const [field, aliases] of Object.entries(acceptedHeaders)) {
      if (headerMatchesAliases(normalizedHeader, aliases)) {
        return field;
      }
    }

    return normalizedHeader;
  };

  const pickByAliases = (row, aliases) => {
    for (const [rawKey, rawValue] of Object.entries(row || {})) {
      const key = normalizeImportHeader(rawKey);
      if (headerMatchesAliases(key, aliases)) {
        const value = normalizeImportText(rawValue);
        if (value) {
          return value;
        }
      }
    }
    return "";
  };

  const pickLikelyDescription = (row, titleRaw, descriptionRaw) => {
    const title = normalizeImportText(titleRaw).toLowerCase();
    const description = normalizeImportText(descriptionRaw);
    if (description && description.toLowerCase() !== title) {
      return description;
    }

    const ignoredAliases = [
      ...acceptedHeaders.po_number,
      ...acceptedHeaders.title,
      ...acceptedHeaders.competency_number,
      ...acceptedHeaders.competency_text,
      ...acceptedHeaders.indicator_number,
      ...acceptedHeaders.indicator_text
    ];

    const candidates = Object.entries(row || [])
      .filter(([rawKey]) => !headerMatchesAliases(normalizeImportHeader(rawKey), ignoredAliases))
      .map(([, rawValue]) => normalizeImportText(rawValue))
      .filter((value) => value && value.toLowerCase() !== title);

    candidates.sort((a, b) => b.length - a.length);
    return candidates[0] || description;
  };

  const collectRows = (rawRows) => {
    const normalizedRows = [];
    let lastPo = "";
    let lastTitle = "";
    let lastDescription = "";
    let lastCompetency = "";
    let lastCompetencyText = "";

    for (const rawRow of rawRows) {
      const poNumberRaw = pickByAliases(rawRow, acceptedHeaders.po_number);
      const titleRaw = pickByAliases(rawRow, acceptedHeaders.title);
      const descriptionRaw = pickLikelyDescription(rawRow, titleRaw, pickByAliases(rawRow, acceptedHeaders.description));
      const competencyNumberRaw = pickByAliases(rawRow, acceptedHeaders.competency_number);
      const competencyTextRaw = pickByAliases(rawRow, acceptedHeaders.competency_text);
      const indicatorNumberRaw = pickByAliases(rawRow, acceptedHeaders.indicator_number);
      const indicatorTextRaw = pickByAliases(rawRow, acceptedHeaders.indicator_text);

      const poNumber = poNumberRaw || lastPo;
      if (!poNumber) {
        continue;
      }

      lastPo = poNumber;
      if (titleRaw) lastTitle = titleRaw;
      if (descriptionRaw) lastDescription = descriptionRaw;
      if (competencyNumberRaw) lastCompetency = competencyNumberRaw;
      if (competencyTextRaw) lastCompetencyText = competencyTextRaw;

      const competencyNumber = competencyNumberRaw || lastCompetency;
      const competencyText = competencyTextRaw || lastCompetencyText;

      normalizedRows.push({
        po_number: poNumber,
        title: titleRaw || lastTitle,
        description: descriptionRaw || lastDescription,
        competency_number: competencyNumber,
        competency_text: competencyText,
        indicator_number: indicatorNumberRaw,
        indicator_text: indicatorTextRaw
      });
    }

    return normalizedRows;
  };

  const collectRowsFromLooseLines = (lines) => {
    const rawRows = [];

    for (const line of lines) {
      const text = normalizeImportText(line);
      if (!text) {
        continue;
      }

      const match = text.match(/^(?:program(?:me)?\s+outcome\s*)?PO\s*[-:]?\s*(\d{1,2})\b\s*[:.)-]?\s*(.*)$/i)
        || text.match(/^(\d{1,2})\s*[:.)-]\s*(.+)$/);

      if (!match) {
        continue;
      }

      const poNumber = Number.parseInt(match[1], 10);
      if (!Number.isFinite(poNumber) || poNumber < 1 || poNumber > 11) {
        continue;
      }

      const remainder = normalizeImportText(match[2] || "");
      const parts = remainder.includes(" - ")
        ? remainder.split(/\s+-\s+/, 2)
        : remainder.includes(": ")
          ? remainder.split(/:\s+/, 2)
          : [];

      rawRows.push({
        po_number: poNumber,
        title: parts[0] || `PO${poNumber}`,
        description: parts[1] || remainder || STANDARD_PO_DESCRIPTIONS[poNumber] || ""
      });
    }

    return collectRows(rawRows);
  };

  const collectRowsFromMatrix = (matrixRows) => {
    if (!Array.isArray(matrixRows) || !matrixRows.length) {
      return [];
    }

    const headerAliasSet = new Set(Object.values(acceptedHeaders).flat());
    const findHeaderIndex = () => {
      for (let index = 0; index < Math.min(matrixRows.length, 10); index += 1) {
        const row = matrixRows[index];
        if (!Array.isArray(row)) {
          continue;
        }

        const normalizedHeaders = row.map((header) => normalizeImportHeader(header));
        const resolvedHeaders = row.map((header) => resolveHeaderKey(header));
        const matchedHeaders = resolvedHeaders.filter((header, headerIndex) => {
          return headerAliasSet.has(normalizedHeaders[headerIndex]) || Object.keys(acceptedHeaders).includes(header);
        });
        const requiredMatches = ["po_number", "title", "description", "competency_number", "indicator_number"]
          .filter((key) => resolvedHeaders.includes(key)).length;

        if (matchedHeaders.length >= 3 || requiredMatches >= 3) {
          return index;
        }
      }

      return 0;
    };

    const headerIndex = findHeaderIndex();
    const headerRow = Array.isArray(matrixRows[headerIndex]) ? matrixRows[headerIndex] : [];
    const normalizedHeaders = headerRow.map((header) => resolveHeaderKey(header));
    const hasRecognizedHeaders = normalizedHeaders.some((header) => Object.keys(acceptedHeaders).includes(header) || headerAliasSet.has(header));
    const dataRows = matrixRows.slice(headerIndex + 1);

    const rawRows = dataRows.map((values) => {
      if (hasRecognizedHeaders) {
        const row = {};
        normalizedHeaders.forEach((header, index) => {
          if (header) {
            row[header] = Array.isArray(values) ? values[index] ?? "" : "";
          }
        });
        return row;
      }

      return {
        po_number: Array.isArray(values) ? values[0] ?? "" : "",
        title: Array.isArray(values) ? values[1] ?? "" : "",
        description: Array.isArray(values) ? values[2] ?? "" : "",
        competency_number: Array.isArray(values) ? values[3] ?? "" : "",
        competency_text: Array.isArray(values) ? values[4] ?? "" : "",
        indicator_number: Array.isArray(values) ? values[5] ?? "" : "",
        indicator_text: Array.isArray(values) ? values[6] ?? "" : ""
      };
    });

    return collectRows(rawRows);
  };

  if (isSpreadsheet) {
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    for (const sheetName of workbook.SheetNames || []) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        continue;
      }

      const objectRows = xlsx.utils.sheet_to_json(sheet, { defval: "", blankrows: false });
      const objectParsedRows = collectRows(objectRows);
      if (objectParsedRows.length) {
        return { rows: objectParsedRows };
      }

      const matrixRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
      const matrixParsedRows = collectRowsFromMatrix(matrixRows);
      if (matrixParsedRows.length) {
        return { rows: matrixParsedRows };
      }

      const looseLines = matrixRows
        .flatMap((row) => Array.isArray(row) ? row : [])
        .map((value) => normalizeImportText(value))
        .filter(Boolean);
      const looseParsedRows = collectRowsFromLooseLines(looseLines);
      if (looseParsedRows.length) {
        return { rows: looseParsedRows };
      }
    }

    return {
      rows: [],
      error: "No valid PO rows found in the uploaded file. Use a sheet with headers like PO Number, Title, Description, Competency Number, Competency Text, Indicator Number, and Indicator Text."
    };
  }

  if (isPdf) {
    try {
      const parsed = await pdfParse(file.buffer);

      const lines = String(parsed?.text || "")
        .replace(/\r/g, "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^(po\s*no\.?|po\s*title|competency|indicators?|indicator)/i.test(line));

      const rawRows = lines.map((line) => {
        const parts = line.includes("|")
          ? line.split("|")
          : line.includes("\t")
            ? line.split("\t")
            : line.split(/\s{2,}/);

        return {
          po_number: parts[0] || "",
          title: parts[1] || "",
          description: parts[2] || "",
          competency_number: parts[3] || "",
          competency_text: parts[4] || "",
          indicator_number: parts[5] || "",
          indicator_text: parts[6] || ""
        };
      });

      const tableRows = collectRows(rawRows);
      if (tableRows.length) {
        return { rows: tableRows };
      }

      return { rows: collectRowsFromLooseLines(lines) };
    } catch (error) {
      return { rows: [], error: "Failed to parse PDF. Use a text-based PDF or Excel template." };
    }
  }

  return { rows: [], error: "Unsupported file type. Upload .xlsx, .xls, .csv, or text-based .pdf" };
};

const importProgramOutcomesFromDocument = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Import file is required" });
    }

    const parsed = await parseDocumentRows(req.file);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const normalizedRows = rows
      .map((row) => {
        const poNumber = parseOutcomeNumber(row.po_number);
        const title = normalizeImportText(row.title);
        const description = resolvePoDescription(poNumber, title, row.description);

        return {
          po_number: poNumber,
          title,
          description,
          competency_number: normalizeImportText(row.competency_number),
          competency_text: normalizeImportText(row.competency_text),
          indicator_number: normalizeImportText(row.indicator_number),
          indicator_text: normalizeImportText(row.indicator_text)
        };
      })
      .filter((row) => Number.isFinite(row.po_number) && row.po_number >= 1 && row.po_number <= 11);

    if (!normalizedRows.length) {
      return res.status(400).json({ message: "No valid PO rows found in the uploaded file" });
    }

    await client.query("BEGIN");
    const importedRows = await replaceProgramOutcomesFromImport(client, normalizedRows);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "Program outcomes imported successfully",
      imported_rows: importedRows.length,
      program_outcomes: importedRows
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: error.message || "Server error" });
  } finally {
    client.release();
  }
};

const parseProgramSpecificOutcomeRowsFromDocument = (file) => {
  if (!file?.buffer) {
    return { rows: [], error: "Import file is required" };
  }

  const fileName = String(file.originalname || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();
  const isSpreadsheet = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv") || mimeType.includes("sheet") || mimeType.includes("csv");
  if (!isSpreadsheet) {
    return { rows: [], error: "Unsupported file type. Upload .xlsx, .xls, or .csv" };
  }

  const acceptedHeaders = {
    pso_number: ["pso_number", "pso_no", "pso", "pso_code", "outcome_no", "outcome_number"],
    title: ["pso_title", "title", "outcome_title", "program_specific_outcome_title", "programme_specific_outcome_title"],
    description: ["pso_description", "description", "outcome_description", "program_specific_outcome", "program_specific_outcomes", "programme_specific_outcome", "programme_specific_outcomes", "pso_statement", "statement"]
  };

  const headerMatchesAliases = (header, aliases) => {
    if (!header) {
      return false;
    }

    return aliases.some((alias) => header === alias || header.startsWith(`${alias}_`) || header.endsWith(`_${alias}`));
  };

  const resolveHeaderKey = (header) => {
    const normalizedHeader = normalizeImportHeader(header);
    for (const [field, aliases] of Object.entries(acceptedHeaders)) {
      if (headerMatchesAliases(normalizedHeader, aliases)) {
        return field;
      }
    }

    return normalizedHeader;
  };

  const pickByAliases = (row, aliases) => {
    for (const [rawKey, rawValue] of Object.entries(row || {})) {
      if (headerMatchesAliases(normalizeImportHeader(rawKey), aliases)) {
        const value = normalizeImportText(rawValue);
        if (value) {
          return value;
        }
      }
    }
    return "";
  };

  const collectRows = (rawRows) => {
    const rows = [];
    let lastPso = "";
    let lastTitle = "";
    let lastDescription = "";

    for (const rawRow of rawRows) {
      const psoNumberRaw = pickByAliases(rawRow, acceptedHeaders.pso_number);
      const titleRaw = pickByAliases(rawRow, acceptedHeaders.title);
      const descriptionRaw = pickByAliases(rawRow, acceptedHeaders.description);
      const psoNumberMatch = normalizeImportText(psoNumberRaw || titleRaw || descriptionRaw).match(/(?:pso\s*)?(\d{1,2})/i);
      const psoNumber = psoNumberMatch?.[1] || lastPso;
      if (!psoNumber) {
        continue;
      }

      lastPso = psoNumber;
      if (titleRaw) lastTitle = titleRaw;
      if (descriptionRaw) lastDescription = descriptionRaw;

      rows.push({
        pso_number: psoNumber,
        title: titleRaw || lastTitle,
        description: descriptionRaw || lastDescription
      });
    }

    return rows;
  };

  const workbook = xlsx.read(file.buffer, { type: "buffer" });
  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const objectRows = xlsx.utils.sheet_to_json(sheet, { defval: "", blankrows: false });
    const objectParsedRows = collectRows(objectRows);
    if (objectParsedRows.length) {
      return { rows: objectParsedRows };
    }

    const matrixRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    if (!matrixRows.length) {
      continue;
    }

    const headerAliasSet = new Set(Object.values(acceptedHeaders).flat());
    let headerIndex = 0;
    for (let index = 0; index < Math.min(matrixRows.length, 10); index += 1) {
      const row = Array.isArray(matrixRows[index]) ? matrixRows[index] : [];
      const normalizedHeaders = row.map((header) => normalizeImportHeader(header));
      const resolvedHeaders = row.map((header) => resolveHeaderKey(header));
      const matchedHeaders = resolvedHeaders.filter((header, headerIndex) => headerAliasSet.has(normalizedHeaders[headerIndex]) || Object.keys(acceptedHeaders).includes(header));
      if (matchedHeaders.length >= 2) {
        headerIndex = index;
        break;
      }
    }

    const headerRow = Array.isArray(matrixRows[headerIndex]) ? matrixRows[headerIndex] : [];
    const headers = headerRow.map((header) => resolveHeaderKey(header));
    const hasRecognizedHeaders = headers.some((header) => Object.keys(acceptedHeaders).includes(header));
    const rawRows = matrixRows.slice(headerIndex + 1).map((values) => {
      if (hasRecognizedHeaders) {
        const row = {};
        headers.forEach((header, index) => {
          if (header) {
            row[header] = Array.isArray(values) ? values[index] ?? "" : "";
          }
        });
        return row;
      }

      return {
        pso_number: Array.isArray(values) ? values[0] ?? "" : "",
        title: Array.isArray(values) ? values[1] ?? "" : "",
        description: Array.isArray(values) ? values[2] ?? "" : ""
      };
    });

    const matrixParsedRows = collectRows(rawRows);
    if (matrixParsedRows.length) {
      return { rows: matrixParsedRows };
    }
  }

  return { rows: [], error: "No valid PSO rows found in the uploaded file. Use columns like PSO Number, Title, and Description." };
};

const importProgramSpecificOutcomesFromDocument = async (req, res) => {
  const client = await pool.connect();

  try {
    const branchCode = String(req.params?.branch_code || req.query?.branch_code || req.body?.branch_code || "").trim();
    if (!branchCode) {
      return res.status(400).json({ message: "branch_code is required" });
    }

    const parsed = parseProgramSpecificOutcomeRowsFromDocument(req.file);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const normalizedRows = rows
      .map((row) => ({
        pso_number: Number.parseInt(row.pso_number, 10),
        title: normalizeImportText(row.title),
        description: normalizeImportText(row.description)
      }))
      .filter((row) => Number.isFinite(row.pso_number) && row.pso_number >= 1 && row.pso_number <= 4 && (row.title || row.description));

    if (!normalizedRows.length) {
      return res.status(400).json({ message: "No valid PSO rows found in the uploaded file" });
    }

    const uniquePso = new Set(normalizedRows.map((row) => row.pso_number));
    if (uniquePso.size !== normalizedRows.length) {
      return res.status(400).json({ message: "Duplicate pso_number values are not allowed" });
    }

    await client.query("BEGIN");
    const updatedRows = await upsertProgramSpecificOutcomesByBranch(client, branchCode, normalizedRows);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "Program specific outcomes imported successfully",
      branch_code: branchCode,
      imported_rows: updatedRows.length,
      program_specific_outcomes: updatedRows
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: error.message || "Server error" });
  } finally {
    client.release();
  }
};

const getProgramSpecificOutcomesByBranchCode = async (req, res) => {
  const client = await pool.connect();

  try {
    const branchCode = String(req.params?.branch_code || req.query?.branch_code || req.body?.branch_code || "").trim();
    if (!branchCode) {
      return res.status(400).json({ message: "branch_code is required" });
    }

    const rows = await getProgramSpecificOutcomesByBranch(client, branchCode);

    return res.status(200).json({
      message: "Program specific outcomes fetched successfully",
      branch_code: branchCode,
      program_specific_outcomes: rows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const upsertProgramSpecificOutcomesByBranchCode = async (req, res) => {
  const client = await pool.connect();

  try {
    const branchCode = String(req.params?.branch_code || req.query?.branch_code || req.body?.branch_code || "").trim();
    if (!branchCode) {
      return res.status(400).json({ message: "branch_code is required" });
    }

    const body = resolveRequestBody(req);
    if (!Array.isArray(body?.rows)) {
      return res.status(400).json({ message: "rows array is required" });
    }

    const normalizedRows = body.rows.map((row) => {
      const psoNumber = Number.parseInt(row?.pso_number, 10);
      if (!psoNumber || Number.isNaN(psoNumber) || psoNumber < 1 || psoNumber > 4) {
        throw new Error("pso_number must be between 1 and 4");
      }

      return {
        pso_number: psoNumber,
        title: String(row?.title ?? "").trim(),
        description: String(row?.description ?? "").trim()
      };
    });

    const uniquePso = new Set(normalizedRows.map((row) => row.pso_number));
    if (uniquePso.size !== normalizedRows.length) {
      return res.status(400).json({ message: "Duplicate pso_number values are not allowed" });
    }

    await client.query("BEGIN");
    const updatedRows = await upsertProgramSpecificOutcomesByBranch(client, branchCode, normalizedRows);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "Program specific outcomes saved successfully",
      branch_code: branchCode,
      program_specific_outcomes: updatedRows
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.message === "pso_number must be between 1 and 4") {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const parseOutcome = (poId, psoId) => {
  if (poId && psoId) {
    return { error: "Provide only one of po_id or pso_id" };
  }

  if (!poId && !psoId) {
    return { error: "Either po_id or pso_id is required" };
  }

  if (poId) {
    const outcomeCode = Number.parseInt(poId, 10);
    if (!outcomeCode || Number.isNaN(outcomeCode)) {
      return { error: "Invalid po_id" };
    }

    return { outcomeType: "PO", outcomeCode };
  }

  const outcomeCode = Number.parseInt(psoId, 10);
  if (!outcomeCode || Number.isNaN(outcomeCode)) {
    return { error: "Invalid pso_id" };
  }

  return { outcomeType: "PSO", outcomeCode };
};

const validateStrengthJustification = (justificationRaw) => {
  const justification = String(justificationRaw ?? "").trim();

  if (!justification) {
    return {
      error:
        "justification is required. Provide a specific reason for the chosen strength based on measurable CO-PO/PSO alignment evidence."
    };
  }

  const words = justification.split(/\s+/).filter(Boolean);
  if (words.length < 8 || justification.length < 40) {
    return {
      error:
        "justification is too weak. Use at least 8 words and explain why this strength value fits (assessment depth, coverage, and attainment contribution)."
    };
  }

  return { justification };
};

const resolveRequestBody = (req) => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
};

const resolveOfferingId = (req) => {
  const parsedBody = resolveRequestBody(req);
  const rawBodyText = typeof req.body === "string" ? req.body : "";

  const offeringFromRawTextMatch = rawBodyText.match(
    /"offering_id"\s*:\s*"?(\d+)"?|"offeringId"\s*:\s*"?(\d+)"?/i
  );
  const offeringFromRawText = offeringFromRawTextMatch
    ? offeringFromRawTextMatch[1] || offeringFromRawTextMatch[2]
    : null;

  const rawCandidates = [
    req.params?.offering_id,
    req.params?.offeringId,
    req.query?.offering_id,
    req.query?.offeringId,
    parsedBody?.offering_id,
    parsedBody?.offeringId,
    parsedBody?.payload?.offering_id,
    parsedBody?.payload?.offeringId,
    parsedBody?.data?.offering_id,
    parsedBody?.data?.offeringId,
    parsedBody?.[0]?.offering_id,
    parsedBody?.[0]?.offeringId,
    parsedBody?.streangths?.offering_id,
    parsedBody?.strengths?.offering_id,
    offeringFromRawText
  ];

  const raw = rawCandidates.find((value) => value !== undefined && value !== null && `${value}`.trim() !== "");
  if (raw === undefined) {
    return null;
  }

  const offeringId = Number.parseInt(String(raw).trim(), 10);
  if (!offeringId || Number.isNaN(offeringId)) {
    return null;
  }

  return offeringId;
};

const addCoPoPsoStrengthMapping = async (req, res) => {
  const body = resolveRequestBody(req);

  // Accept grouped payloads on the single endpoint as well to keep API ergonomic.
  if (
    Array.isArray(body?.strengths) ||
    Array.isArray(body?.streangths) ||
    Array.isArray(body?.rows)
  ) {
    req.body = body;
    return addCoPoPsoStrengthMappingBulk(req, res);
  }

  const client = await pool.connect();

  try {
    const { co_number, po_id, pso_id, strength, justification } = body;
    const offeringId = resolveOfferingId(req);
    const parsedStrength = Number.parseInt(strength, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id. Send JSON body with offering_id." });
    }

    if (Number.isNaN(parsedStrength) || parsedStrength < 0 || parsedStrength > 3) {
      return res.status(400).json({ message: "strength must be between 0 and 3" });
    }

    const justificationCheck = validateStrengthJustification(justification);
    if (justificationCheck.error) {
      return res.status(400).json({ message: justificationCheck.error });
    }

    const parsedOutcome = parseOutcome(po_id, pso_id);
    if (parsedOutcome.error) {
      return res.status(400).json({ message: parsedOutcome.error });
    }

    const coNumber = Number.parseInt(co_number, 10);
    if (!coNumber || Number.isNaN(coNumber)) {
      return res.status(400).json({ message: "Valid co_number is required" });
    }

    const row = await upsertCoPoPsoStrengthMapping(
      client,
      offeringId,
      coNumber,
      parsedOutcome.outcomeType,
      parsedOutcome.outcomeCode,
      parsedStrength,
      justificationCheck.justification
    );

    return res.status(200).json({
      message: "CO-PO/PSO strength mapping saved successfully",
      mapping: row
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const addCoPoPsoStrengthMappingBulk = async (req, res) => {
  const client = await pool.connect();

  try {
    const body = resolveRequestBody(req);
    const offeringId = resolveOfferingId(req);
    const {
      co_numbers: coNumbers,
      po_ids: poIds,
      pso_ids: psoIds,
      default_strength: defaultStrength,
      default_justification: defaultJustification,
      rows,
      strengths,
      streangths
    } = body;

    if (!offeringId) {
      return res.status(400).json({ message: "Invalid offering_id. Send JSON body with offering_id." });
    }

    const expandedRows = [];

    const groupedStrengths = Array.isArray(strengths)
      ? strengths
      : Array.isArray(streangths)
        ? streangths
        : null;

    if (Array.isArray(groupedStrengths) && groupedStrengths.length > 0) {
      for (const coGroup of groupedStrengths) {
        const coNumber = Number.parseInt(coGroup?.co_number, 10);
        if (!coNumber || Number.isNaN(coNumber)) {
          return res.status(400).json({ message: "Invalid co_number in strengths/streangths block" });
        }

        if (!Array.isArray(coGroup?.strength_map) || !coGroup.strength_map.length) {
          return res.status(400).json({ message: "strength_map array is required for each co_number" });
        }

        for (const mapItem of coGroup.strength_map) {
          const poNumber = mapItem?.po_number;
          const psoNumber = mapItem?.pso_number;

          if ((poNumber && psoNumber) || (!poNumber && !psoNumber)) {
            return res.status(400).json({
              message: "Each strength_map item must contain exactly one of po_number or pso_number"
            });
          }

          const outcomeType = poNumber ? "PO" : "PSO";
          const outcomeCode = Number.parseInt(poNumber || psoNumber, 10);
          if (!outcomeCode || Number.isNaN(outcomeCode)) {
            return res.status(400).json({ message: "Invalid po_number/pso_number value in strength_map" });
          }

          const strength = Number.parseInt(
            mapItem?.strength !== undefined ? mapItem.strength : mapItem?.strenght,
            10
          );
          if (Number.isNaN(strength) || strength < 0 || strength > 3) {
            return res.status(400).json({ message: "strength must be between 0 and 3" });
          }

          const justificationCheck = validateStrengthJustification(
            mapItem?.justification ?? coGroup?.default_justification ?? defaultJustification
          );
          if (justificationCheck.error) {
            return res.status(400).json({
              message: `Invalid justification for co_number ${coNumber}, ${outcomeType}${outcomeCode}: ${justificationCheck.error}`
            });
          }

          expandedRows.push({
            coNumber,
            outcomeType,
            outcomeCode,
            strength,
            justification: justificationCheck.justification
          });
        }
      }
    } else if (Array.isArray(rows) && rows.length > 0) {
      for (const row of rows) {
        const parsedOutcome = parseOutcome(row?.po_id, row?.pso_id);
        if (parsedOutcome.error) {
          return res.status(400).json({ message: `Invalid row outcome: ${parsedOutcome.error}` });
        }

        const coNumber = Number.parseInt(row?.co_number, 10);
        if (!coNumber || Number.isNaN(coNumber)) {
          return res.status(400).json({ message: "Invalid row co_number" });
        }

        const strength = Number.parseInt(
          row?.strength !== undefined ? row.strength : defaultStrength,
          10
        );

        if (Number.isNaN(strength) || strength < 0 || strength > 3) {
          return res.status(400).json({ message: "strength must be between 0 and 3" });
        }

        const justificationCheck = validateStrengthJustification(
          row?.justification ?? defaultJustification
        );
        if (justificationCheck.error) {
          return res.status(400).json({
            message: `Invalid row justification: ${justificationCheck.error}`
          });
        }

        expandedRows.push({
          coNumber,
          outcomeType: parsedOutcome.outcomeType,
          outcomeCode: parsedOutcome.outcomeCode,
          strength,
          justification: justificationCheck.justification
        });
      }
    } else {
      if (!Array.isArray(coNumbers) || !coNumbers.length) {
        return res.status(400).json({ message: "co_numbers array is required" });
      }

      if ((!Array.isArray(poIds) || !poIds.length) && (!Array.isArray(psoIds) || !psoIds.length)) {
        return res.status(400).json({ message: "At least one of po_ids or pso_ids array is required" });
      }

      const strength = Number.parseInt(defaultStrength, 10);
      if (Number.isNaN(strength) || strength < 0 || strength > 3) {
        return res.status(400).json({ message: "default_strength must be between 0 and 3" });
      }

      const defaultJustificationCheck = validateStrengthJustification(defaultJustification);
      if (defaultJustificationCheck.error) {
        return res.status(400).json({ message: `default_justification error: ${defaultJustificationCheck.error}` });
      }

      for (const rawCo of coNumbers) {
        const coNumber = Number.parseInt(rawCo, 10);
        if (!coNumber || Number.isNaN(coNumber)) {
          return res.status(400).json({ message: "Invalid value in co_numbers" });
        }

        for (const rawPo of poIds || []) {
          const outcomeCode = Number.parseInt(rawPo, 10);
          if (!outcomeCode || Number.isNaN(outcomeCode)) {
            return res.status(400).json({ message: "Invalid value in po_ids" });
          }

          expandedRows.push({
            coNumber,
            outcomeType: "PO",
            outcomeCode,
            strength,
            justification: defaultJustificationCheck.justification
          });
        }

        for (const rawPso of psoIds || []) {
          const outcomeCode = Number.parseInt(rawPso, 10);
          if (!outcomeCode || Number.isNaN(outcomeCode)) {
            return res.status(400).json({ message: "Invalid value in pso_ids" });
          }

          expandedRows.push({
            coNumber,
            outcomeType: "PSO",
            outcomeCode,
            strength,
            justification: defaultJustificationCheck.justification
          });
        }
      }
    }

    await client.query("BEGIN");
    for (const row of expandedRows) {
      await upsertCoPoPsoStrengthMapping(
        client,
        offeringId,
        row.coNumber,
        row.outcomeType,
        row.outcomeCode,
        row.strength,
        row.justification
      );
    }
    await client.query("COMMIT");

    return res.status(200).json({
      message: "CO-PO/PSO bulk strength mappings saved successfully",
      offering_id: offeringId,
      total_saved: expandedRows.length
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const updateCoPoPsoStrengthMapping = async (req, res) => {
  const client = await pool.connect();

  try {
    const body = resolveRequestBody(req);
    const { co_number, po_id, pso_id, strength, justification } = body;
    const offeringId = resolveOfferingId(req);
    const parsedStrength = Number.parseInt(strength, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id. Send JSON body with offering_id." });
    }

    if (Number.isNaN(parsedStrength) || parsedStrength < 0 || parsedStrength > 3) {
      return res.status(400).json({ message: "strength must be between 0 and 3" });
    }

    const justificationCheck = validateStrengthJustification(justification);
    if (justificationCheck.error) {
      return res.status(400).json({ message: justificationCheck.error });
    }

    const parsedOutcome = parseOutcome(po_id, pso_id);
    if (parsedOutcome.error) {
      return res.status(400).json({ message: parsedOutcome.error });
    }

    const coNumber = Number.parseInt(co_number, 10);
    if (!coNumber || Number.isNaN(coNumber)) {
      return res.status(400).json({ message: "Valid co_number is required" });
    }

    const row = await updateCoPoPsoStrengthMappingByComposite(
      client,
      offeringId,
      coNumber,
      parsedOutcome.outcomeType,
      parsedOutcome.outcomeCode,
      parsedStrength,
      justificationCheck.justification
    );

    if (!row) {
      return res.status(404).json({
        message: "Mapping not found. Provide existing composite keys (offering_id, co_number, po_id/pso_id)."
      });
    }

    return res.status(200).json({
      message: "CO-PO/PSO strength mapping updated successfully",
      mapping: row
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const generateCoPoPsoAttainmentByOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const offeringId = resolveOfferingId(req);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id. Send JSON body with offering_id." });
    }

    await client.query("BEGIN");
    const result = await generateAndStoreCoPoPsoAttainmentReports(client, offeringId);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "CO-PO/PSO attainment report generated and stored successfully",
      offering_id: offeringId,
      mappings_count: result.mappingsCount,
      generated_rows: result.generatedRows
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: error.message || "Server error" });
  } finally {
    client.release();
  }
};

const getCoPoPsoStrengthByOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id } = req.params;
    const offeringId = Number.parseInt(offering_id, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const mappings = await getCoPoPsoStrengthMappingsByOffering(client, offeringId);

    return res.status(200).json({
      message: "Stored CO-PO/PSO strength mappings fetched successfully",
      strength_mappings: mappings
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getCoPoPsoAttainmentByOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id } = req.params;
    const offeringId = Number.parseInt(offering_id, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const report = await getStoredCoPoPsoAttainmentByOffering(client, offeringId);

    return res.status(200).json({
      message: "Stored CO-PO/PSO attainment levels fetched successfully",
      attainment_levels: report
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Number(toNumber(value).toFixed(2));

const formatDisplay = (value) => {
  const n = toNumber(value);
  return n === 0 ? "" : n.toFixed(2);
};

const getDepartmentList = async (req, res) => {
  const client = await pool.connect();

  try {
    const departments = await getDepartmentCodeNameList(client);
    return res.status(200).json({
      message: "Departments fetched successfully",
      departments
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const parseAcademicYearBranchFromQuery = (req) => {
  const accadmicYear = String(
    req.query?.accadmic_year || req.query?.academic_session || req.query?.academic_year || ""
  ).trim();

  const branchCode = String(req.query?.branch_code || "").trim();

  return { accadmicYear, branchCode };
};

const parseBatchBranchFromQuery = (req) => {
  const batchIdRaw = String(req.query?.batch_id || req.query?.batchId || "").trim();
  const branchCode = String(req.query?.branch_code || "").trim();
  const batchId = Number.parseInt(batchIdRaw, 10);

  return {
    batchId: Number.isFinite(batchId) ? batchId : null,
    branchCode
  };
};

const getOutcomeSortWeight = (outcomeType) => (outcomeType === "PO" ? 1 : 2);

const sortOutcomes = (a, b) => {
  const typeCompare = getOutcomeSortWeight(a.outcome_type) - getOutcomeSortWeight(b.outcome_type);
  if (typeCompare !== 0) {
    return typeCompare;
  }

  return Number(a.outcome_code) - Number(b.outcome_code);
};

const buildBatchCoPoPsoAverageDataset = async (client, batchId, branchCode) => {
  const offerings = await getOfferedSubjectsWithFacultyByBatchBranch(client, batchId, branchCode);
  const offeringIds = offerings
    .map((row) => Number(row.offering_id))
    .filter((value) => Number.isFinite(value));
  const averageRows = await getCoPoPsoAttainmentAverageByOfferingIds(client, offeringIds);
  const overallRows = await getOverallCoAttainmentByOfferingIds(client, offeringIds);

  const averageRowsByOffering = new Map();
  for (const row of averageRows) {
    const offeringId = Number(row.offering_id);
    if (!averageRowsByOffering.has(offeringId)) {
      averageRowsByOffering.set(offeringId, []);
    }

    averageRowsByOffering.get(offeringId).push({
      outcome_type: row.outcome_type,
      outcome_code: Number(row.outcome_code),
      average_attainment_level: round2(row.average_attainment_level)
    });
  }

  const overallRowsByOffering = new Map();
  for (const row of overallRows) {
    const offeringId = Number(row.offering_id);
    if (!overallRowsByOffering.has(offeringId)) {
      overallRowsByOffering.set(offeringId, []);
    }

    overallRowsByOffering.get(offeringId).push({
      co_number: Number(row.co_number),
      overall_total: round2(row.overall_total)
    });
  }

  const items = offerings.map((offering) => {
    const offeringId = Number(offering.offering_id);
    const rows = averageRowsByOffering.get(offeringId) || [];
    const outcomeWiseAverage = rows
      .map((row) => ({
        outcome_type: row.outcome_type,
        outcome_code: row.outcome_code,
        average_attainment_level: round2(row.average_attainment_level)
      }))
      .sort(sortOutcomes);

    const overallTotals = (overallRowsByOffering.get(offeringId) || [])
      .map((row) => Number(row.overall_total))
      .filter((value) => Number.isFinite(value) && value > 0);
    const coAverage = overallTotals.length
      ? round2(overallTotals.reduce((sum, value) => sum + value, 0) / overallTotals.length)
      : 0;
    const overallRows = (overallRowsByOffering.get(offeringId) || []).map((row) => ({
      co_number: Number(row.co_number),
      overall_total: round2(row.overall_total)
    }));

    return {
      offering_id: offeringId,
      accadmic_year: offering.accadmic_year,
      session: offering.session,
      sem_number: Number(offering.sem_number),
      subject_code: offering.subject_code,
      subject_name: offering.subject_name,
      branch_code: offering.branch_code,
      branch_name: offering.branch_name,
      coordinator_name: offering.coordinator_name,
      faculty_names: offering.faculty_names || offering.coordinator_name || "",
      outcome_wise_average: outcomeWiseAverage,
      co_average: coAverage,
      overall_rows: overallRows
    };
  });

  return {
    branch_name: offerings[0]?.branch_name || branchCode || "",
    items,
    total_rows: averageRows.length
  };
};

const parseOutcomeFromAverageRow = (row) => {
  const explicitOutcomeType = String(row?.outcome_type || "").trim().toUpperCase();
  const explicitOutcomeCode = Number.parseInt(row?.outcome_code, 10);

  if (explicitOutcomeType && explicitOutcomeCode) {
    if (explicitOutcomeType !== "PO" && explicitOutcomeType !== "PSO") {
      return { error: "outcome_type must be PO or PSO" };
    }

    return {
      outcomeType: explicitOutcomeType,
      outcomeCode: explicitOutcomeCode
    };
  }

  return parseOutcome(row?.po_id, row?.pso_id);
};

const buildYearBranchCoPoPsoAverageDataset = async (client, accadmicYear, branchCode) => {
  const offerings = await getOfferedSubjectsWithFacultyByYearBranch(client, accadmicYear, branchCode);
  const offeringIds = offerings.map((row) => Number(row.offering_id));
  const averageRows = await getCoPoPsoAttainmentAverageByOfferingIds(client, offeringIds);

  const averageRowsByOffering = new Map();
  for (const row of averageRows) {
    const offeringId = Number(row.offering_id);
    if (!averageRowsByOffering.has(offeringId)) {
      averageRowsByOffering.set(offeringId, []);
    }

    averageRowsByOffering.get(offeringId).push({
      outcome_type: row.outcome_type,
      outcome_code: Number(row.outcome_code),
      average_attainment_level: round2(row.average_attainment_level)
    });
  }

  const items = offerings.map((offering) => {
    const offeringId = Number(offering.offering_id);
    const rows = averageRowsByOffering.get(offeringId) || [];

    const outcomeWiseAverage = rows
      .map((row) => ({
        outcome_type: row.outcome_type,
        outcome_code: row.outcome_code,
        average_attainment_level: round2(row.average_attainment_level)
      }))
      .sort(sortOutcomes);

    return {
      offering_id: offeringId,
      accadmic_year: offering.accadmic_year,
      session: offering.session,
      sem_number: Number(offering.sem_number),
      subject_code: offering.subject_code,
      subject_name: offering.subject_name,
      branch_code: offering.branch_code,
      branch_name: offering.branch_name,
      coordinator_name: offering.coordinator_name,
      faculty_names: offering.faculty_names || offering.coordinator_name || "",
      co_po_pso_attainment_average: rows,
      outcome_wise_average: outcomeWiseAverage
    };
  });

  return {
    branch_name: offerings[0]?.branch_name || "",
    items,
    total_rows: averageRows.length
  };
};

const saveCoPoPsoAttainmentAverageByOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const offeringId = resolveOfferingId(req);
    const body = resolveRequestBody(req);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id. Send JSON body with offering_id." });
    }

    if (!Array.isArray(body?.rows)) {
      return res.status(400).json({ message: "rows array is required" });
    }

    const normalizedRows = body.rows.map((row) => {
      const parsedOutcome = parseOutcomeFromAverageRow(row);
      if (parsedOutcome.error) {
        throw new Error(parsedOutcome.error);
      }

      const avg = Number.parseFloat(row?.average_attainment_level);
      if (!Number.isFinite(avg) || avg < 0 || avg > 3) {
        throw new Error("average_attainment_level must be between 0 and 3");
      }

      return {
        outcome_type: parsedOutcome.outcomeType,
        outcome_code: parsedOutcome.outcomeCode,
        average_attainment_level: round2(avg)
      };
    });

    await client.query("BEGIN");
    await replaceCoPoPsoAttainmentAverageRowsByOffering(client, offeringId, normalizedRows);
    await client.query("COMMIT");

    return res.status(200).json({
      message: "CO-PO/PSO average attainment rows stored successfully",
      offering_id: offeringId,
      total_saved: normalizedRows.length
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.message) {
      const knownValidationMessages = new Set([
        "average_attainment_level must be between 0 and 3",
        "outcome_type must be PO or PSO",
        "Provide only one of po_id or pso_id",
        "Either po_id or pso_id is required",
        "Invalid po_id",
        "Invalid pso_id"
      ]);

      if (knownValidationMessages.has(error.message)) {
        return res.status(400).json({ message: error.message });
      }
    }

    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const getCoPoPsoAttainmentAverageByYearBranch = async (req, res) => {
  const client = await pool.connect();

  try {
    const { accadmicYear, branchCode } = parseAcademicYearBranchFromQuery(req);

    if (!accadmicYear || !branchCode) {
      return res.status(400).json({ message: "accadmic_year and branch_code are required query params" });
    }

    const dataset = await buildYearBranchCoPoPsoAverageDataset(client, accadmicYear, branchCode);

    return res.status(200).json({
      message: "CO-PO/PSO average attainment fetched successfully",
      accadmic_year: accadmicYear,
      academic_session: accadmicYear,
      branch_code: branchCode,
      branch_name: dataset.branch_name,
      total_offerings: dataset.items.length,
      total_attainment_rows: dataset.total_rows,
      items: dataset.items
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const downloadCoPoPsoAttainmentAverageExcelByYearBranch = async (req, res) => {
  const client = await pool.connect();

  try {
    const { accadmicYear, branchCode } = parseAcademicYearBranchFromQuery(req);

    if (!accadmicYear || !branchCode) {
      return res.status(400).json({ message: "accadmic_year and branch_code are required query params" });
    }

    const dataset = await buildYearBranchCoPoPsoAverageDataset(client, accadmicYear, branchCode);

    if (!dataset.items.length) {
      return res.status(404).json({ message: "No offered subjects found for this accadmic_year and branch_code" });
    }

    const outcomeKeyMap = new Map();
    for (const item of dataset.items) {
      for (const row of item.outcome_wise_average) {
        const key = `${row.outcome_type}|${row.outcome_code}`;
        if (!outcomeKeyMap.has(key)) {
          outcomeKeyMap.set(key, {
            outcome_type: row.outcome_type,
            outcome_code: Number(row.outcome_code)
          });
        }
      }
    }

    const defaultOutcomeHeaders = [
      ...Array.from({ length: 12 }, (_, index) => ({ outcome_type: "PO", outcome_code: index + 1 })),
      { outcome_type: "PSO", outcome_code: 1 },
      { outcome_type: "PSO", outcome_code: 2 }
    ];

    const outcomeHeaders = (outcomeKeyMap.size
      ? Array.from(outcomeKeyMap.values())
      : defaultOutcomeHeaders
    ).sort(sortOutcomes);

    const rows = [];
    rows.push([`${dataset.branch_name || branchCode} DEPARTMENT`]);
    rows.push([`PO AND PSO ATTAINMENT VALUES USING DIRECT ASSESSMENT TOOLS (${accadmicYear})`]);
    rows.push([]);

    const semesterNumbers = Array.from(
      new Set(dataset.items.map((item) => Number(item.sem_number)).filter((sem) => Number.isFinite(sem)))
    ).sort((a, b) => a - b);

    const semesterTitleRows = [];

    for (const sem of semesterNumbers) {
      semesterTitleRows.push(rows.length);
      rows.push([`Sem-${sem}`]);
      rows.push([
        "Course Code",
        "Subject Name",
        ...outcomeHeaders.map((header) => `${header.outcome_type}${header.outcome_code}`),
        "Name of the faculty"
      ]);

      const semesterItems = dataset.items
        .filter((item) => Number(item.sem_number) === sem)
        .sort((a, b) => a.subject_code.localeCompare(b.subject_code));

      for (const item of semesterItems) {
        const outcomeValueMap = new Map();
        for (const row of item.outcome_wise_average) {
          outcomeValueMap.set(
            `${row.outcome_type}|${row.outcome_code}`,
            round2(row.average_attainment_level).toFixed(2)
          );
        }

        rows.push([
          item.subject_code,
          item.subject_name,
          ...outcomeHeaders.map((header) => outcomeValueMap.get(`${header.outcome_type}|${header.outcome_code}`) || ""),
          item.faculty_names || ""
        ]);
      }

      rows.push([]);
    }

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const totalColumns = 2 + outcomeHeaders.length + 1;
    const lastColumnIndex = totalColumns - 1;

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 38 },
      ...outcomeHeaders.map(() => ({ wch: 8 })),
      { wch: 28 }
    ];

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } },
      ...semesterTitleRows.map((rowIndex) => ({
        s: { r: rowIndex, c: 0 },
        e: { r: rowIndex, c: lastColumnIndex }
      }))
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "PO-PSO Average");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    const safeToken = (value, fallback) => {
      const token = String(value ?? "").trim();
      if (!token) {
        return fallback;
      }

      return token.replace(/[\\/:*?"<>|\s]+/g, "_");
    };

    const filename = `po_pso_attainment_${safeToken(branchCode, "branch")}_${safeToken(accadmicYear, "year")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const downloadBatchAttainmentReportExcel = async (req, res) => {
  const client = await pool.connect();

  try {
    const { batchId, branchCode } = parseBatchBranchFromQuery(req);

    if (!batchId || !branchCode) {
      return res.status(400).json({ message: "batch_id and branch_code are required query params" });
    }

    const dataset = await buildBatchCoPoPsoAverageDataset(client, batchId, branchCode);

    if (!dataset.items.length) {
      return res.status(404).json({ message: "No offered subjects found for this batch and branch" });
    }

    const outcomeKeyMap = new Map();
    for (const item of dataset.items) {
      for (const row of item.outcome_wise_average) {
        const key = `${row.outcome_type}|${row.outcome_code}`;
        if (!outcomeKeyMap.has(key)) {
          outcomeKeyMap.set(key, {
            outcome_type: row.outcome_type,
            outcome_code: Number(row.outcome_code)
          });
        }
      }
    }

    const defaultOutcomeHeaders = [
      ...Array.from({ length: 12 }, (_, index) => ({ outcome_type: "PO", outcome_code: index + 1 })),
      { outcome_type: "PSO", outcome_code: 1 },
      { outcome_type: "PSO", outcome_code: 2 }
    ];

    const outcomeHeaders = (outcomeKeyMap.size
      ? Array.from(outcomeKeyMap.values())
      : defaultOutcomeHeaders
    ).sort(sortOutcomes);

    const semesterNumbers = Array.from(
      new Set(dataset.items.map((item) => Number(item.sem_number)).filter((sem) => Number.isFinite(sem)))
    ).sort((a, b) => a - b);

    const poPsoRows = [];
    poPsoRows.push([`${dataset.branch_name || branchCode} DEPARTMENT`]);
    poPsoRows.push([`PO AND PSO ATTAINMENT VALUES USING DIRECT ASSESSMENT TOOLS (Batch ${batchId})`]);
    poPsoRows.push([]);

    const poPsoSemesterTitleRows = [];
    for (const sem of semesterNumbers) {
      poPsoSemesterTitleRows.push(poPsoRows.length);
      poPsoRows.push([`Sem-${sem}`]);
      poPsoRows.push([
        "Course Code",
        "Subject Name",
        ...outcomeHeaders.map((header) => `${header.outcome_type}${header.outcome_code}`),
        "Name of the faculty"
      ]);

      const semesterItems = dataset.items
        .filter((item) => Number(item.sem_number) === sem)
        .sort((a, b) => a.subject_code.localeCompare(b.subject_code));

      for (const item of semesterItems) {
        const outcomeValueMap = new Map();
        for (const row of item.outcome_wise_average) {
          outcomeValueMap.set(
            `${row.outcome_type}|${row.outcome_code}`,
            round2(row.average_attainment_level).toFixed(2)
          );
        }

        poPsoRows.push([
          item.subject_code,
          item.subject_name,
          ...outcomeHeaders.map((header) => outcomeValueMap.get(`${header.outcome_type}|${header.outcome_code}`) || ""),
          item.faculty_names || ""
        ]);
      }

      poPsoRows.push([]);
    }

    const poPsoWorksheet = xlsx.utils.aoa_to_sheet(poPsoRows);
    const poPsoTotalColumns = 2 + outcomeHeaders.length + 1;
    const poPsoLastColumnIndex = poPsoTotalColumns - 1;

    poPsoWorksheet["!cols"] = [
      { wch: 14 },
      { wch: 38 },
      ...outcomeHeaders.map(() => ({ wch: 8 })),
      { wch: 28 }
    ];

    poPsoWorksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: poPsoLastColumnIndex } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: poPsoLastColumnIndex } },
      ...poPsoSemesterTitleRows.map((rowIndex) => ({
        s: { r: rowIndex, c: 0 },
        e: { r: rowIndex, c: poPsoLastColumnIndex }
      }))
    ];

    const coRows = [];
    coRows.push([`${dataset.branch_name || branchCode} DEPARTMENT`]);
    coRows.push([`CO ATTAINMENT (Batch ${batchId})`]);
    coRows.push([]);

    const coSemesterTitleRows = [];
    const coHeaders = ["Course Code", "Subject Name", "CO1", "CO2", "CO3", "CO4", "CO5", "CO6", "Name of the faculty"];

    for (const sem of semesterNumbers) {
      coSemesterTitleRows.push(coRows.length);
      coRows.push([`Sem-${sem}`]);
      coRows.push(coHeaders);

      const semesterItems = dataset.items
        .filter((item) => Number(item.sem_number) === sem)
        .sort((a, b) => a.subject_code.localeCompare(b.subject_code));

      for (const item of semesterItems) {
        const coValueMap = new Map();
        const overallList = Array.isArray(item.overall_rows) ? item.overall_rows : [];
        for (const row of overallList) {
          const coNumber = Number(row.co_number);
          const total = Number(row.overall_total);
          if (Number.isFinite(coNumber) && coNumber >= 1 && coNumber <= 6) {
            coValueMap.set(coNumber, Number.isFinite(total) ? round2(total).toFixed(2) : "");
          }
        }

        const coValues = [1, 2, 3, 4, 5, 6].map((co) => coValueMap.get(co) || "");

        coRows.push([
          item.subject_code,
          item.subject_name,
          ...coValues,
          item.faculty_names || ""
        ]);
      }

      coRows.push([]);
    }

    const coWorksheet = xlsx.utils.aoa_to_sheet(coRows);
    const coLastColumnIndex = coHeaders.length - 1;
    coWorksheet["!cols"] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 28 }
    ];
    coWorksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: coLastColumnIndex } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: coLastColumnIndex } },
      ...coSemesterTitleRows.map((rowIndex) => ({
        s: { r: rowIndex, c: 0 },
        e: { r: rowIndex, c: coLastColumnIndex }
      }))
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, poPsoWorksheet, "PO-PSO Average");
    xlsx.utils.book_append_sheet(workbook, coWorksheet, "CO Average");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    const safeToken = (value, fallback) => {
      const token = String(value ?? "").trim();
      if (!token) {
        return fallback;
      }

      return token.replace(/[\\/:*?"<>|\s]+/g, "_");
    };

    const filename = `batch_attainment_${safeToken(branchCode, "branch")}_${safeToken(batchId, "batch")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

const downloadNbaReportExcelByOffering = async (req, res) => {
  const client = await pool.connect();

  try {
    const { offering_id } = req.params;
    const offeringId = Number.parseInt(offering_id, 10);

    if (!offeringId || Number.isNaN(offeringId)) {
      return res.status(400).json({ message: "Invalid offering_id" });
    }

    const { generateExcelForOffering } = require("../services/excelService.js");
    const fs = require("fs");

    const outputPath = await generateExcelForOffering(client, offeringId);

    // Get context to build filename
    const contextRes = await client.query(
      `SELECT os.accadmic_year, os.session, s.name AS subject_name, s.subject_code 
       FROM offered_subjects os 
       JOIN subject s ON s.subject_code = os.subject_code 
       WHERE os.id = $1`,
      [offeringId]
    );
    const context = contextRes.rows[0] || {};

    const safeToken = (value, fallback) => {
      const token = String(value ?? "").trim();
      if (!token) {
        return fallback;
      }

      return token.replace(/[\\/:*?"<>|\s]+/g, "_");
    };

    const filename = `${safeToken(context.subject_name || context.subject_code, `offering_${offeringId}`)}_${safeToken(context.accadmic_year, "na")}_${safeToken(context.session, "na")}.xlsx`;

    res.download(outputPath, filename, (err) => {
      try {
        fs.unlinkSync(outputPath);
      } catch (unlinkErr) {
        console.error("Failed to delete temp excel report file:", unlinkErr);
      }
      if (err && !res.headersSent) {
        console.error("Download error:", err);
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

module.exports = {
  generateAttainmentByOffering,
  getStoredCoAttainmentByOffering,
  getCourseOutcomesByOfferingId,
  upsertCourseOutcomesForOffering,
  getProgramOutcomesGlobal,
  upsertProgramOutcomesGlobal,
  importProgramOutcomesFromDocument,
  importProgramSpecificOutcomesFromDocument,
  getProgramSpecificOutcomesByBranchCode,
  upsertProgramSpecificOutcomesByBranchCode,
  addCoPoPsoStrengthMapping,
  addCoPoPsoStrengthMappingBulk,
  updateCoPoPsoStrengthMapping,
  generateCoPoPsoAttainmentByOffering,
  getCoPoPsoStrengthByOffering,
  getCoPoPsoAttainmentByOffering,
  getDepartmentList,
  saveCoPoPsoAttainmentAverageByOffering,
  getCoPoPsoAttainmentAverageByYearBranch,
  downloadCoPoPsoAttainmentAverageExcelByYearBranch,
  downloadBatchAttainmentReportExcel,
  downloadNbaReportExcelByOffering
};
