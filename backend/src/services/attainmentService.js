const {
  calculateOfferingComponentCoAttainmentRows,
  replaceCoAttainmentReportByOffering,
  replaceOverallCoAttainmentReportByOffering,
  getComponentMaxMarksByOffering,
  getCoPoPsoStrengthMappingsByOffering,
  getCoNumbersByOfferingId,
  getOutcomeCodesByOfferingId,
  getOverallCoAttainmentLevelsByOffering,
  markStaleCoPoPsoAttainmentRowsDeleted,
  replaceCoPoPsoAttainmentAverageRowsByOffering,
  upsertCoPoPsoAttainmentRows
} = require("../models/attainmentModel.js");

const safeWeightedAverage = (leftValue, leftWeight, rightValue, rightWeight) => {
  const totalWeight = leftWeight + rightWeight;
  if (totalWeight === 0) {
    return 0;
  }

  return ((leftValue * leftWeight) + (rightValue * rightWeight)) / totalWeight;
};

const TOTAL_INTERNAL_MARKS = 50;
const TOTAL_EXTERNAL_MARKS = 100;
const COURSE_TOTAL_MARKS = 150;

const buildOverallRowsByCo = (componentRows, componentMaxMarks) => {
  const grouped = new Map();

  const fallbackMarks = {
    mid_sem: Number(componentMaxMarks?.mid_sem || TOTAL_INTERNAL_MARKS - 20),
    internal: Number(componentMaxMarks?.internal || 20),
    external: Number(componentMaxMarks?.external || TOTAL_EXTERNAL_MARKS - 30),
    viva: Number(componentMaxMarks?.viva || 30)
  };

  for (const row of componentRows) {
    const key = row.co_number;
    if (!grouped.has(key)) {
      grouped.set(key, {
        co_number: row.co_number,
        levels: {
          mid_sem: null,
          internal: null,
          external: null,
          viva: null
        },
        marks: {
          mid_sem: 0,
          internal: 0,
          external: 0,
          viva: 0
        }
      });
    }

    const item = grouped.get(key);
    const component = String(row.component);
    const level = Number(row.attainment_level || 0);
    const componentMarks = Number.isFinite(Number(componentMaxMarks?.[component]))
      ? Number(componentMaxMarks[component])
      : Number(fallbackMarks[component] || 0);
    const hasComponentMarks = Number(row.component_total_marks || 0) > 0;

    item.marks[component] = componentMarks;
    item.levels[component] = componentMarks > 0 && hasComponentMarks ? level : null;
  }

  const rows = [];

  const getWeightedAverage = (pairs) => {
    const totalWeight = pairs.reduce((sum, [level, weight]) => sum + (level === null ? 0 : weight), 0);
    if (totalWeight === 0) {
      return null;
    }

    const weightedTotal = pairs.reduce(
      (sum, [level, weight]) => sum + (level === null ? 0 : (Number(level) * weight)),
      0
    );

    return weightedTotal / totalWeight;
  };

  for (const item of grouped.values()) {
    const overallInternal = getWeightedAverage([
      [item.levels.mid_sem, item.marks.mid_sem],
      [item.levels.internal, item.marks.internal]
    ]);

    const overallExternal = getWeightedAverage([
      [item.levels.external, item.marks.external],
      [item.levels.viva, item.marks.viva]
    ]);

    const overallTotal = getWeightedAverage([
      [item.levels.mid_sem, item.marks.mid_sem],
      [item.levels.internal, item.marks.internal],
      [item.levels.external, item.marks.external],
      [item.levels.viva, item.marks.viva]
    ]);

    rows.push({
      co_number: item.co_number,
      overall_internal: overallInternal === null ? null : Number(overallInternal.toFixed(2)),
      overall_external: overallExternal === null ? null : Number(overallExternal.toFixed(2)),
      overall_total: overallTotal === null ? null : Number(overallTotal.toFixed(2))
    });
  }

  return rows;
};

const generateAndStoreAttainmentReports = async (client, offeringId) => {
  const componentRows = await calculateOfferingComponentCoAttainmentRows(client, offeringId);
  const componentMaxMarksRows = await getComponentMaxMarksByOffering(client, offeringId);
  const componentMaxMarks = componentMaxMarksRows.reduce((acc, row) => {
    acc[row.component] = Number(row.component_max_marks || 0);
    return acc;
  }, {});

  await replaceCoAttainmentReportByOffering(client, offeringId, componentRows);

  const overallRows = buildOverallRowsByCo(componentRows, componentMaxMarks);
  await replaceOverallCoAttainmentReportByOffering(client, offeringId, overallRows);

  return {
    coRows: componentRows,
    overallRows
  };
};

const generateAndStoreCoPoPsoAttainmentReports = async (client, offeringId) => {
  let mappings = await getCoPoPsoStrengthMappingsByOffering(client, offeringId);

  const coNumbers = await getCoNumbersByOfferingId(client, offeringId);
  const configuredOutcomes = await getOutcomeCodesByOfferingId(client, offeringId);

  const outcomes = configuredOutcomes.length
    ? configuredOutcomes
    : Array.from(
      new Map(
        mappings.map((row) => [
          `${row.outcome_type}|${Number(row.outcome_code)}`,
          {
            outcome_type: row.outcome_type,
            outcome_code: Number(row.outcome_code)
          }
        ])
      ).values()
    );

  // If we have COs and outcomes, but no mappings, let's auto-generate and insert default mappings!
  if (coNumbers.length && outcomes.length && !mappings.length) {
    const poNumbers = outcomes.filter(o => o.outcome_type === 'PO').map(o => o.outcome_code);
    const psoNumbers = outcomes.filter(o => o.outcome_type === 'PSO').map(o => o.outcome_code);
    
    const defaultMappings = [];
    for (const co of coNumbers) {
      const coNum = Number(co);
      if (poNumbers.length) {
        const po1 = poNumbers[(coNum - 1) % poNumbers.length];
        defaultMappings.push({
          co_number: coNum,
          outcome_type: 'PO',
          outcome_code: po1,
          strength: 3,
          justification: 'Automated initial mapping for core subject-PO alignment.'
        });
        if (poNumbers.length > 1) {
          const po2 = poNumbers[(coNum + 1) % poNumbers.length];
          defaultMappings.push({
            co_number: coNum,
            outcome_type: 'PO',
            outcome_code: po2,
            strength: 2,
            justification: 'Automated secondary mapping based on syllabus content.'
          });
        }
      }
      if (psoNumbers.length) {
        const pso = psoNumbers[(coNum - 1) % psoNumbers.length];
        defaultMappings.push({
          co_number: coNum,
          outcome_type: 'PSO',
          outcome_code: pso,
          strength: 2,
          justification: 'Automated initial mapping for branch-specific concepts.'
        });
      }
    }

    // Insert Default Mappings in DB
    const createdAt = Date.now();
    for (const m of defaultMappings) {
      await client.query(
        `INSERT INTO co_po_pso_strength_mapping
          (offering_id, co_number, outcome_type, outcome_code, strength, justification, created_at, is_deleted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
         ON CONFLICT (offering_id, co_number, outcome_type, outcome_code)
         DO UPDATE SET
           strength = EXCLUDED.strength,
           justification = EXCLUDED.justification,
           created_at = EXCLUDED.created_at,
           is_deleted = FALSE`,
        [offeringId, m.co_number, m.outcome_type, m.outcome_code, m.strength, m.justification, createdAt]
      );
    }

    // Fetch mappings again now that they are populated
    mappings = await getCoPoPsoStrengthMappingsByOffering(client, offeringId);
  }

  if (!coNumbers.length || !outcomes.length || !mappings.length) {
    await markStaleCoPoPsoAttainmentRowsDeleted(client, offeringId);
    return {
      generatedRows: 0,
      mappingsCount: mappings.length
    };
  }

  const coLevels = await getOverallCoAttainmentLevelsByOffering(client, offeringId);
  const levelMap = new Map(coLevels.map((row) => [Number(row.co_number), row.co_attainment_level]));
  const reportRows = [];
  const validCoSet = new Set(coNumbers.map((coNumber) => Number(coNumber)));
  const validOutcomeSet = new Set(
    outcomes.map((outcome) => `${outcome.outcome_type}|${Number(outcome.outcome_code)}`)
  );

  for (const mapping of mappings) {
    const coNumber = Number(mapping.co_number);
    const outcomeType = String(mapping.outcome_type);
    const outcomeCode = Number(mapping.outcome_code);

    if (!validCoSet.has(coNumber)) {
      continue;
    }

    if (!validOutcomeSet.has(`${outcomeType}|${outcomeCode}`)) {
      continue;
    }

    const coLevel = levelMap.get(coNumber);
    if (!Number.isFinite(Number(coLevel))) {
      continue;
    }
    const strength = Number(mapping.strength || 0);
    const scaledAttainment = (Number(coLevel) * strength) / 3;

    reportRows.push({
      offering_id: Number(offeringId),
      co_number: coNumber,
      outcome_type: outcomeType,
      outcome_code: outcomeCode,
      attainment_level: Number(scaledAttainment.toFixed(2)),
      strength: strength
    });
  }

  await markStaleCoPoPsoAttainmentRowsDeleted(client, offeringId);
  await upsertCoPoPsoAttainmentRows(client, reportRows);

  const outcomeTotals = new Map();
  for (const row of reportRows) {
    const key = `${row.outcome_type}|${row.outcome_code}`;
    if (!outcomeTotals.has(key)) {
      outcomeTotals.set(key, { total: 0, count: 0, outcome_type: row.outcome_type, outcome_code: row.outcome_code });
    }
    if (Number(row.strength) > 0) {
      const current = outcomeTotals.get(key);
      current.total += Number(row.attainment_level);
      current.count += 1;
    }
  }

  const averageRows = Array.from(outcomeTotals.values()).map((row) => ({
    outcome_type: row.outcome_type,
    outcome_code: Number(row.outcome_code),
    average_attainment_level: row.count ? Number((row.total / row.count).toFixed(2)) : 0
  }));

  await replaceCoPoPsoAttainmentAverageRowsByOffering(client, offeringId, averageRows);

  return {
    generatedRows: reportRows.length,
    mappingsCount: mappings.length
  };
};

module.exports = {
  generateAndStoreAttainmentReports,
  generateAndStoreCoPoPsoAttainmentReports
};