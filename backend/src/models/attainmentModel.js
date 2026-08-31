const calculateOfferingComponentCoAttainmentRows = async (client, offeringId) => {
  const query = `
    WITH components AS (
      SELECT *
      FROM (VALUES ('mid_sem'), ('internal'), ('external'), ('viva')) AS c(component)
    ),
    papers AS (
      SELECT
        p.paper_id,
        e.exam_type::TEXT AS component,
        p.total_students
      FROM paper p
      JOIN exam e ON e.exam_id = p.exam_id
      WHERE p.offering_id = $1
        AND p.is_deleted = FALSE
        AND e.is_deleted = FALSE
        AND e.exam_type IN ('mid_sem', 'internal', 'external', 'viva')
    ),
    mapped_co_list AS (
      SELECT DISTINCT
        cwt.co_number
      FROM co_wise_target_value cwt
      JOIN papers p ON p.paper_id = cwt.paper_id
    ),
    component_students AS (
      SELECT
        component,
        COALESCE(MAX(total_students), 0) AS total_students
      FROM papers
      GROUP BY component
    ),
    component_co_thresholds AS (
      SELECT
        p.component,
        mcl.co_number,
        COALESCE(SUM((t.total_marks * t.target_value::NUMERIC) / 100.0), 0) AS attainment_threshold,
        COALESCE(SUM(t.total_marks), 0) AS component_total_marks
      FROM papers p
      CROSS JOIN mapped_co_list mcl
      LEFT JOIN co_wise_target_value t ON t.paper_id = p.paper_id AND t.co_number = mcl.co_number
      GROUP BY p.component, mcl.co_number
    ),
    student_component_co_marks AS (
      SELECT
        p.component,
        mcl.co_number,
        cm.enrollment_no,
        COALESCE(SUM(cm.obtained_marks), 0) AS student_obtained_marks
      FROM papers p
      CROSS JOIN mapped_co_list mcl
      LEFT JOIN co_marks cm
        ON cm.paper_id = p.paper_id
       AND cm.co_number = mcl.co_number
       AND cm.is_deleted = FALSE
      GROUP BY p.component, mcl.co_number, cm.enrollment_no
    ),
    co_stats AS (
      SELECT
        c.component,
        mcl.co_number,
        COALESCE(cs.total_students, 0) AS total_students,
        COALESCE(cct.attainment_threshold, 0) AS attainment_threshold,
        COALESCE(cct.component_total_marks, 0) AS component_total_marks,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(cct.component_total_marks, 0) > 0
                   AND scm.student_obtained_marks >= COALESCE(cct.attainment_threshold, 0) THEN 1
              ELSE 0
            END
          ),
          0
        ) AS students_above_threshold
      FROM components c
      CROSS JOIN mapped_co_list mcl
      LEFT JOIN component_students cs
        ON cs.component = c.component
      LEFT JOIN component_co_thresholds cct
        ON cct.component = c.component
       AND cct.co_number = mcl.co_number
      LEFT JOIN student_component_co_marks scm
        ON scm.component = c.component
       AND scm.co_number = mcl.co_number
      GROUP BY
        c.component,
        mcl.co_number,
        cs.total_students,
        cct.attainment_threshold,
        cct.component_total_marks
    )
    SELECT
      component,
      co_number,
      component_total_marks,
      attainment_threshold,
      total_students,
      students_above_threshold,
      CASE
        WHEN total_students = 0 THEN 0
        ELSE ROUND((students_above_threshold * 100.0) / total_students, 2)
      END AS percentage,
      CASE
        WHEN total_students = 0 THEN 0
        WHEN ((students_above_threshold * 100.0) / total_students) < 60 THEN 0
        WHEN ((students_above_threshold * 100.0) / total_students) < 70 THEN 1
        WHEN ((students_above_threshold * 100.0) / total_students) < 80 THEN 2
        ELSE 3
      END AS attainment_level
    FROM co_stats
    ORDER BY component, co_number
  `;

  const result = await client.query(query, [offeringId]);
  return result.rows;
};

const replaceCoAttainmentReportByOffering = async (client, offeringId, rows) => {
  await client.query(
    `
      DELETE FROM co_attainment_report
      WHERE offering_id = $1
    `,
    [offeringId]
  );

  if (!rows.length) {
    return;
  }

  const createdAt = Date.now();
  const values = [];
  const placeholders = rows.map((row, index) => {
    const baseIndex = index * 6;
    values.push(
      offeringId,
      row.co_number,
      row.component,
      row.attainment_level,
      row.percentage,
      createdAt
    );
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
  });

  const query = `
    INSERT INTO co_attainment_report
      (offering_id, co_number, component, co_attainment_level, percentage, created_at)
    VALUES ${placeholders.join(", ")}
  `;

  await client.query(query, values);
};

const getStoredCoAttainmentReportByOffering = async (client, offeringId) => {
  const query = `
    WITH component_marks AS (
      SELECT
        e.exam_type::TEXT AS component,
        cwt.co_number,
        COALESCE(SUM(cwt.total_marks), 0) AS component_total_marks
      FROM paper p
      JOIN exam e ON e.exam_id = p.exam_id
      JOIN co_wise_target_value cwt ON cwt.paper_id = p.paper_id
      WHERE p.offering_id = $1
        AND p.is_deleted = FALSE
        AND e.is_deleted = FALSE
        AND e.exam_type IN ('mid_sem', 'internal', 'external', 'viva')
      GROUP BY e.exam_type, cwt.co_number
    )
    SELECT
      r.co_number,
      r.component,
      CASE
        WHEN COALESCE(cm.component_total_marks, 0) = 0 THEN NULL
        ELSE r.co_attainment_level
      END AS attainment_level,
      CASE
        WHEN COALESCE(cm.component_total_marks, 0) = 0 THEN NULL
        ELSE r.percentage
      END AS percentage,
      co.co_description
    FROM co_attainment_report r
    LEFT JOIN component_marks cm
      ON cm.component = r.component::TEXT
     AND cm.co_number = r.co_number
    LEFT JOIN course_outcome co
      ON co.offering_id = r.offering_id
     AND co.co_number = r.co_number
     AND co.is_deleted = FALSE
    WHERE r.offering_id = $1
      AND r.is_deleted = FALSE
    ORDER BY r.component, r.co_number
  `;

  const result = await client.query(query, [offeringId]);
  return result.rows;
};

const getCourseOutcomesByOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        co_number,
        co_description
      FROM course_outcome
      WHERE offering_id = $1
        AND is_deleted = FALSE
      ORDER BY co_number
    `,
    [offeringId]
  );

  return result.rows;
};

const getProgramOutcomes = async (client) => {
  const result = await client.query(
    `
      SELECT
        po_number,
        title,
        description
      FROM program_outcome
      WHERE is_deleted = FALSE
      ORDER BY po_number
    `
  );

  return result.rows;
};

const getProgramOutcomeCompetencies = async (client) => {
  const result = await client.query(
    `
      SELECT
        po_number,
        competency_number,
        competency_text
      FROM program_outcome_competency
      WHERE is_deleted = FALSE
      ORDER BY po_number, competency_number
    `
  );

  return result.rows;
};

const getProgramOutcomeIndicators = async (client) => {
  const result = await client.query(
    `
      SELECT
        po_number,
        competency_number,
        indicator_number,
        indicator_text
      FROM program_outcome_indicator
      WHERE is_deleted = FALSE
      ORDER BY po_number, competency_number, indicator_number
    `
  );

  return result.rows;
};

const getProgramOutcomesDetailed = async (client) => {
  const poRows = await getProgramOutcomes(client);
  const competencyRows = await getProgramOutcomeCompetencies(client);
  const indicatorRows = await getProgramOutcomeIndicators(client);

  const competencyMap = new Map();
  for (const row of competencyRows) {
    const poNumber = Number(row.po_number);
    const competencyNumber = String(row.competency_number || '').trim();
    const key = `${poNumber}|${competencyNumber}`;
    competencyMap.set(key, {
      po_number: poNumber,
      competency_number: competencyNumber,
      competency_text: row.competency_text,
      indicators: []
    });
  }

  for (const row of indicatorRows) {
    const poNumber = Number(row.po_number);
    const competencyNumber = String(row.competency_number || '').trim();
    const competencyKey = `${poNumber}|${competencyNumber}`;
    const competency = competencyMap.get(competencyKey);
    if (!competency) {
      continue;
    }

    competency.indicators.push({
      indicator_number: String(row.indicator_number || '').trim(),
      indicator_text: row.indicator_text
    });
  }

  const competenciesByPo = new Map();
  for (const competency of competencyMap.values()) {
    const poNumber = Number(competency.po_number);
    if (!competenciesByPo.has(poNumber)) {
      competenciesByPo.set(poNumber, []);
    }
    competenciesByPo.get(poNumber).push({
      competency_number: competency.competency_number,
      competency_text: competency.competency_text,
      indicators: competency.indicators
    });
  }

  for (const entries of competenciesByPo.values()) {
    entries.sort((a, b) => a.competency_number.localeCompare(b.competency_number, undefined, { numeric: true }));
    for (const entry of entries) {
      entry.indicators.sort((a, b) => a.indicator_number.localeCompare(b.indicator_number, undefined, { numeric: true }));
    }
  }

  return poRows.map((row) => ({
    ...row,
    competencies: competenciesByPo.get(Number(row.po_number)) || []
  }));
};

const upsertProgramOutcomes = async (client, rows) => {
  const createdAt = Math.floor(Date.now() / 1000);

  for (const row of rows) {
    const poNumber = Number.parseInt(row.po_number, 10);
    const title = String(row.title ?? "").trim();
    const description = String(row.description ?? "").trim();

    await client.query(
      `
        INSERT INTO program_outcome (po_number, title, description, created_at, is_deleted)
        VALUES ($1, $2, $3, $4, FALSE)
        ON CONFLICT (po_number)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          created_at = EXCLUDED.created_at,
          is_deleted = FALSE
      `,
      [poNumber, title, description, createdAt]
    );
  }

  return getProgramOutcomes(client);
};

const replaceProgramOutcomesFromImport = async (client, rows) => {
  const createdAt = Math.floor(Date.now() / 1000);

  await client.query(`DELETE FROM program_outcome_indicator`);
  await client.query(`DELETE FROM program_outcome_competency`);
  await client.query(`DELETE FROM program_outcome`);

  const poMap = new Map();
  const competencyMap = new Map();
  const indicatorMap = new Map();

  for (const row of rows) {
    const poNumber = Number.parseInt(row.po_number, 10);
    if (!poNumber || Number.isNaN(poNumber) || poNumber < 1) {
      continue;
    }

    const title = String(row.title ?? '').trim();
    const description = String(row.description ?? '').trim();
    const competencyNumber = String(row.competency_number ?? '').trim();
    const competencyText = String(row.competency_text ?? '').trim();
    const indicatorNumber = String(row.indicator_number ?? '').trim();
    const indicatorText = String(row.indicator_text ?? '').trim();

    if (!poMap.has(poNumber)) {
      poMap.set(poNumber, { po_number: poNumber, title: '', description: '' });
    }
    const poEntry = poMap.get(poNumber);
    if (title) poEntry.title = title;
    if (description) poEntry.description = description;

    if (competencyNumber && competencyText) {
      competencyMap.set(`${poNumber}|${competencyNumber}`, {
        po_number: poNumber,
        competency_number: competencyNumber,
        competency_text: competencyText
      });
    }

    if (competencyNumber && indicatorNumber && indicatorText) {
      indicatorMap.set(`${poNumber}|${competencyNumber}|${indicatorNumber}`, {
        po_number: poNumber,
        competency_number: competencyNumber,
        indicator_number: indicatorNumber,
        indicator_text: indicatorText
      });
    }
  }

  const poRows = Array.from(poMap.values()).sort((a, b) => a.po_number - b.po_number);
  const competencyRows = Array.from(competencyMap.values()).sort((a, b) => {
    const poCompare = a.po_number - b.po_number;
    if (poCompare !== 0) return poCompare;
    return a.competency_number.localeCompare(b.competency_number, undefined, { numeric: true });
  });
  const indicatorRows = Array.from(indicatorMap.values()).sort((a, b) => {
    const poCompare = a.po_number - b.po_number;
    if (poCompare !== 0) return poCompare;
    const competencyCompare = a.competency_number.localeCompare(b.competency_number, undefined, { numeric: true });
    if (competencyCompare !== 0) return competencyCompare;
    return a.indicator_number.localeCompare(b.indicator_number, undefined, { numeric: true });
  });

  for (const row of poRows) {
    await client.query(
      `
        INSERT INTO program_outcome (po_number, title, description, created_at, is_deleted)
        VALUES ($1, $2, $3, $4, FALSE)
      `,
      [row.po_number, row.title, row.description, createdAt]
    );
  }

  for (const row of competencyRows) {
    await client.query(
      `
        INSERT INTO program_outcome_competency (po_number, competency_number, competency_text, created_at, is_deleted)
        VALUES ($1, $2, $3, $4, FALSE)
      `,
      [row.po_number, row.competency_number, row.competency_text, createdAt]
    );
  }

  for (const row of indicatorRows) {
    await client.query(
      `
        INSERT INTO program_outcome_indicator (po_number, competency_number, indicator_number, indicator_text, created_at, is_deleted)
        VALUES ($1, $2, $3, $4, $5, FALSE)
      `,
      [row.po_number, row.competency_number, row.indicator_number, row.indicator_text, createdAt]
    );
  }

  return getProgramOutcomesDetailed(client);
};

const getProgramSpecificOutcomesByBranch = async (client, branchCode) => {
  const result = await client.query(
    `
      SELECT
        pso_number,
        title,
        description
      FROM program_specific_outcome
      WHERE branch_code = $1
        AND is_deleted = FALSE
      ORDER BY pso_number
    `,
    [branchCode]
  );

  return result.rows;
};

const upsertProgramSpecificOutcomesByBranch = async (client, branchCode, rows) => {
  const createdAt = Math.floor(Date.now() / 1000);

  await client.query(
    `
      DELETE FROM program_specific_outcome
      WHERE branch_code = $1
    `,
    [branchCode]
  );

  for (const row of rows) {
    const psoNumber = Number.parseInt(row.pso_number, 10);
    const title = String(row.title ?? "").trim();
    const description = String(row.description ?? "").trim();

    if (!description && !title) {
      continue;
    }

    await client.query(
      `
        INSERT INTO program_specific_outcome (branch_code, pso_number, title, description, created_at, is_deleted)
        VALUES ($1, $2, $3, $4, $5, FALSE)
        ON CONFLICT (branch_code, pso_number)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          created_at = EXCLUDED.created_at,
          is_deleted = FALSE
      `,
      [branchCode, psoNumber, title, description, createdAt]
    );
  }

  return getProgramSpecificOutcomesByBranch(client, branchCode);
};

const upsertCourseOutcomesByOffering = async (client, offeringId, rows) => {
  const createdAt = Math.floor(Date.now() / 1000);

  for (const row of rows) {
    const coNumber = Number.parseInt(row.co_number, 10);
    const coDescription = String(row.co_description ?? "").trim();

    const existing = await client.query(
      `
        SELECT co_id
        FROM course_outcome
        WHERE offering_id = $1
          AND co_number = $2
        ORDER BY co_id DESC
        LIMIT 1
      `,
      [offeringId, coNumber]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `
          UPDATE course_outcome
          SET co_description = $2,
              created_at = $3,
              is_deleted = FALSE
          WHERE co_id = $1
        `,
        [existing.rows[0].co_id, coDescription, createdAt]
      );
    } else {
      await client.query(
        `
          INSERT INTO course_outcome (offering_id, co_number, co_description, created_at, is_deleted)
          VALUES ($1, $2, $3, $4, FALSE)
        `,
        [offeringId, coNumber, coDescription, createdAt]
      );
    }
  }

  return getCourseOutcomesByOffering(client, offeringId);
};

const replaceOverallCoAttainmentReportByOffering = async (client, offeringId, rows) => {
  await client.query(
    `
      DELETE FROM overall_co_attainment_report
      WHERE offering_id = $1
    `,
    [offeringId]
  );

  if (!rows.length) {
    return;
  }

  const createdAt = Date.now();
  const values = [];
  const placeholders = rows.map((row, index) => {
    const baseIndex = index * 6;
    values.push(
      offeringId,
      row.co_number,
      row.overall_internal,
      row.overall_external,
      row.overall_total,
      createdAt
    );
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
  });

  const query = `
    INSERT INTO overall_co_attainment_report
      (
        offering_id,
        co_number,
        overall_internal,
        overall_external,
        overall_total,
        created_at
      )
    VALUES ${placeholders.join(", ")}
  `;

  await client.query(query, values);
};

const getStoredOverallCoAttainmentReportByOffering = async (client, offeringId) => {
  const values = [offeringId];
  const query = `
    WITH component_levels AS (
      SELECT
        r.co_number,
        MAX(CASE WHEN r.component = 'mid_sem' THEN r.co_attainment_level END) AS mid_sem_level,
        MAX(CASE WHEN r.component = 'internal' THEN r.co_attainment_level END) AS internal_level,
        MAX(CASE WHEN r.component = 'external' THEN r.co_attainment_level END) AS external_level,
        MAX(CASE WHEN r.component = 'viva' THEN r.co_attainment_level END) AS viva_level
      FROM co_attainment_report r
      WHERE r.offering_id = $1
        AND r.is_deleted = FALSE
      GROUP BY r.co_number
    ),
    component_marks_by_co AS (
      SELECT
        cwt.co_number,
        COALESCE(SUM(CASE WHEN e.exam_type = 'mid_sem' THEN cwt.total_marks ELSE 0 END), 0) AS mid_sem_marks,
        COALESCE(SUM(CASE WHEN e.exam_type = 'internal' THEN cwt.total_marks ELSE 0 END), 0) AS internal_marks,
        COALESCE(SUM(CASE WHEN e.exam_type = 'external' THEN cwt.total_marks ELSE 0 END), 0) AS external_marks,
        COALESCE(SUM(CASE WHEN e.exam_type = 'viva' THEN cwt.total_marks ELSE 0 END), 0) AS viva_marks
      FROM paper p
      JOIN exam e ON e.exam_id = p.exam_id
      JOIN co_wise_target_value cwt ON cwt.paper_id = p.paper_id
      WHERE p.offering_id = $1
        AND p.is_deleted = FALSE
        AND e.is_deleted = FALSE
        AND e.exam_type IN ('mid_sem', 'internal', 'external', 'viva')
      GROUP BY cwt.co_number
    ),
    component_max AS (
      SELECT
        COALESCE(SUM(CASE WHEN e.exam_type = 'mid_sem' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS mid_sem_marks,
        COALESCE(SUM(CASE WHEN e.exam_type = 'internal' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS internal_marks,
        COALESCE(SUM(CASE WHEN e.exam_type = 'external' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS external_marks,
        COALESCE(SUM(CASE WHEN e.exam_type = 'viva' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS viva_marks
      FROM paper p
      JOIN exam e ON e.exam_id = p.exam_id
      WHERE p.offering_id = $1
        AND p.is_deleted = FALSE
        AND e.is_deleted = FALSE
        AND e.exam_type IN ('mid_sem', 'internal', 'external', 'viva')
    )
    SELECT
      cl.co_number,
      co.co_description,
      ROUND(
        CASE
          WHEN ((CASE WHEN COALESCE(cmc.mid_sem_marks, 0) = 0 THEN 0 ELSE cm.mid_sem_marks END) +
            (CASE WHEN COALESCE(cmc.internal_marks, 0) = 0 THEN 0 ELSE cm.internal_marks END)) = 0 THEN NULL
          ELSE (
            (COALESCE(cl.mid_sem_level, 0) * (CASE WHEN COALESCE(cmc.mid_sem_marks, 0) = 0 THEN 0 ELSE cm.mid_sem_marks END)) +
            (COALESCE(cl.internal_level, 0) * (CASE WHEN COALESCE(cmc.internal_marks, 0) = 0 THEN 0 ELSE cm.internal_marks END))
          ) / ((CASE WHEN COALESCE(cmc.mid_sem_marks, 0) = 0 THEN 0 ELSE cm.mid_sem_marks END) +
            (CASE WHEN COALESCE(cmc.internal_marks, 0) = 0 THEN 0 ELSE cm.internal_marks END))
        END,
        2
      ) AS overall_internal,
      ROUND(
        CASE
          WHEN ((CASE WHEN COALESCE(cmc.external_marks, 0) = 0 THEN 0 ELSE cm.external_marks END) +
            (CASE WHEN COALESCE(cmc.viva_marks, 0) = 0 THEN 0 ELSE cm.viva_marks END)) = 0 THEN NULL
          ELSE (
            (COALESCE(cl.external_level, 0) * (CASE WHEN COALESCE(cmc.external_marks, 0) = 0 THEN 0 ELSE cm.external_marks END)) +
            (COALESCE(cl.viva_level, 0) * (CASE WHEN COALESCE(cmc.viva_marks, 0) = 0 THEN 0 ELSE cm.viva_marks END))
          ) / ((CASE WHEN COALESCE(cmc.external_marks, 0) = 0 THEN 0 ELSE cm.external_marks END) +
            (CASE WHEN COALESCE(cmc.viva_marks, 0) = 0 THEN 0 ELSE cm.viva_marks END))
        END,
        2
      ) AS overall_external,
      ROUND(
        CASE
          WHEN ((CASE WHEN COALESCE(cmc.mid_sem_marks, 0) = 0 THEN 0 ELSE cm.mid_sem_marks END) +
            (CASE WHEN COALESCE(cmc.internal_marks, 0) = 0 THEN 0 ELSE cm.internal_marks END) +
            (CASE WHEN COALESCE(cmc.external_marks, 0) = 0 THEN 0 ELSE cm.external_marks END) +
            (CASE WHEN COALESCE(cmc.viva_marks, 0) = 0 THEN 0 ELSE cm.viva_marks END)) = 0 THEN NULL
          ELSE (
            (COALESCE(cl.mid_sem_level, 0) * (CASE WHEN COALESCE(cmc.mid_sem_marks, 0) = 0 THEN 0 ELSE cm.mid_sem_marks END)) +
            (COALESCE(cl.internal_level, 0) * (CASE WHEN COALESCE(cmc.internal_marks, 0) = 0 THEN 0 ELSE cm.internal_marks END)) +
            (COALESCE(cl.external_level, 0) * (CASE WHEN COALESCE(cmc.external_marks, 0) = 0 THEN 0 ELSE cm.external_marks END)) +
            (COALESCE(cl.viva_level, 0) * (CASE WHEN COALESCE(cmc.viva_marks, 0) = 0 THEN 0 ELSE cm.viva_marks END))
          ) / ((CASE WHEN COALESCE(cmc.mid_sem_marks, 0) = 0 THEN 0 ELSE cm.mid_sem_marks END) +
            (CASE WHEN COALESCE(cmc.internal_marks, 0) = 0 THEN 0 ELSE cm.internal_marks END) +
            (CASE WHEN COALESCE(cmc.external_marks, 0) = 0 THEN 0 ELSE cm.external_marks END) +
            (CASE WHEN COALESCE(cmc.viva_marks, 0) = 0 THEN 0 ELSE cm.viva_marks END))
        END,
        2
      ) AS overall_total
    FROM component_levels cl
    CROSS JOIN component_max cm
    LEFT JOIN component_marks_by_co cmc
      ON cmc.co_number = cl.co_number
    LEFT JOIN course_outcome co
      ON co.offering_id = $1
     AND co.co_number = cl.co_number
     AND co.is_deleted = FALSE
    ORDER BY cl.co_number
  `;

  const result = await client.query(query, values);
  return result.rows;
};

const upsertCoPoPsoStrengthMapping = async (
  client,
  offeringId,
  coNumber,
  outcomeType,
  outcomeCode,
  strength,
  justification
) => {
  const createdAt = Date.now();
  const query = `
    INSERT INTO co_po_pso_strength_mapping
      (offering_id, co_number, outcome_type, outcome_code, strength, justification, created_at, is_deleted)
    VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
    ON CONFLICT (offering_id, co_number, outcome_type, outcome_code)
    DO UPDATE SET
      strength = EXCLUDED.strength,
      justification = EXCLUDED.justification,
      created_at = EXCLUDED.created_at,
      is_deleted = FALSE
    RETURNING offering_id, co_number, outcome_type, outcome_code, strength, justification
  `;

  const result = await client.query(query, [
    offeringId,
    coNumber,
    outcomeType,
    outcomeCode,
    strength,
    justification,
    createdAt
  ]);

  return result.rows[0];
};

const updateCoPoPsoStrengthMappingByComposite = async (
  client,
  offeringId,
  coNumber,
  outcomeType,
  outcomeCode,
  strength,
  justification
) => {
  const result = await client.query(
    `
      UPDATE co_po_pso_strength_mapping
      SET strength = $1,
          justification = $2,
          is_deleted = FALSE
      WHERE offering_id = $3
        AND co_number = $4
        AND outcome_type = $5
        AND outcome_code = $6
      RETURNING offering_id, co_number, outcome_type, outcome_code, strength, justification
    `,
    [strength, justification, offeringId, coNumber, outcomeType, outcomeCode]
  );

  return result.rows[0] || null;
};

const getCoPoPsoStrengthMappingsByOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        m.co_number,
        m.outcome_type,
        m.outcome_code,
        m.strength,
        m.justification
      FROM co_po_pso_strength_mapping m
      WHERE m.offering_id = $1
        AND m.is_deleted = FALSE
      ORDER BY m.co_number, m.outcome_type, m.outcome_code
    `,
    [offeringId]
  );

  return result.rows;
};

const getCoNumbersByOfferingId = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT DISTINCT cwt.co_number
      FROM paper p
      JOIN co_wise_target_value cwt ON cwt.paper_id = p.paper_id
      WHERE p.offering_id = $1
        AND p.is_deleted = FALSE
      ORDER BY cwt.co_number
    `,
    [offeringId]
  );

  return result.rows.map((row) => Number(row.co_number));
};

const getOutcomeCodesByOfferingId = async (client, offeringId) => {
  const branchResult = await client.query(
    `
      SELECT
        COALESCE(b.branch_code, fc.branch_code) AS branch_code,
        COALESCE(o.include_pso, TRUE) AS include_pso
      FROM offered_subjects o
      LEFT JOIN batch b ON b.id = o.batch_id
      LEFT JOIN faculty fc ON fc.id = o.faculty_corrdinator_id
      WHERE o.id = $1
        AND o.is_deleted = FALSE
      LIMIT 1
    `,
    [offeringId]
  );

  const branchCode = branchResult.rows[0]?.branch_code || null;
  const includePso = Boolean(branchResult.rows[0]?.include_pso);

  const result = await client.query(
    includePso
      ? `
          SELECT 'PO'::outcome_type_enum AS outcome_type, po_number::INT AS outcome_code
          FROM program_outcome
          WHERE is_deleted = FALSE
          UNION ALL
          SELECT 'PSO'::outcome_type_enum AS outcome_type, pso_number::INT AS outcome_code
          FROM program_specific_outcome
          WHERE branch_code = $1
            AND is_deleted = FALSE
          ORDER BY outcome_type, outcome_code
        `
      : `
          SELECT 'PO'::outcome_type_enum AS outcome_type, po_number::INT AS outcome_code
          FROM program_outcome
          WHERE is_deleted = FALSE
          ORDER BY outcome_code
        `,
    includePso ? [branchCode] : []
  );

  return result.rows.map((row) => ({
    outcome_type: row.outcome_type,
    outcome_code: Number(row.outcome_code)
  }));
};

const getOfferingReportContextById = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        o.id AS offering_id,
        o.accadmic_year,
        o.session,
        o.sem_number,
        s.subject_code,
        s.name AS subject_name,
        b.name AS branch_name
      FROM offered_subjects o
      JOIN subject s ON s.subject_code = o.subject_code
      LEFT JOIN faculty f ON f.id = o.faculty_corrdinator_id
      LEFT JOIN branch b ON b.branch_code = f.branch_code
      WHERE o.id = $1
        AND o.is_deleted = FALSE
      LIMIT 1
    `,
    [offeringId]
  );

  return result.rows[0] || null;
};

const getNbaOutcomeHeadersByOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      WITH mapped_outcomes AS (
        SELECT outcome_type, outcome_code
        FROM co_po_pso_attainment_report
        WHERE offering_id = $1
          AND is_deleted = FALSE
        UNION
        SELECT outcome_type, outcome_code
        FROM co_po_pso_strength_mapping
        WHERE offering_id = $1
          AND is_deleted = FALSE
      )
      SELECT outcome_type, outcome_code
      FROM mapped_outcomes
      ORDER BY outcome_type, outcome_code
    `,
    [offeringId]
  );

  return result.rows.map((row) => ({
    outcome_type: row.outcome_type,
    outcome_code: Number(row.outcome_code)
  }));
};

const getCoAttainmentLevelsByOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      WITH component_levels AS (
        SELECT
          r.co_number,
          MAX(CASE WHEN r.component = 'mid_sem' THEN r.co_attainment_level END) AS mid_sem_level,
          MAX(CASE WHEN r.component = 'internal' THEN r.co_attainment_level END) AS internal_level,
          MAX(CASE WHEN r.component = 'external' THEN r.co_attainment_level END) AS external_level,
          MAX(CASE WHEN r.component = 'viva' THEN r.co_attainment_level END) AS viva_level
        FROM co_attainment_report r
        WHERE r.offering_id = $1
          AND r.is_deleted = FALSE
        GROUP BY r.co_number
      ),
      component_max AS (
        SELECT
          COALESCE(SUM(CASE WHEN e.exam_type = 'mid_sem' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS mid_sem_marks,
          COALESCE(SUM(CASE WHEN e.exam_type = 'internal' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS internal_marks,
          COALESCE(SUM(CASE WHEN e.exam_type = 'external' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS external_marks,
          COALESCE(SUM(CASE WHEN e.exam_type = 'viva' THEN p.max_marks ELSE 0 END), 0)::NUMERIC AS viva_marks
        FROM paper p
        JOIN exam e ON e.exam_id = p.exam_id
        WHERE p.offering_id = $1
          AND p.is_deleted = FALSE
          AND e.is_deleted = FALSE
          AND e.exam_type IN ('mid_sem', 'internal', 'external', 'viva')
      )
      SELECT
        cl.co_number,
        ROUND(
          CASE
            WHEN (cm.mid_sem_marks + cm.internal_marks + cm.external_marks + cm.viva_marks) = 0 THEN 0
            ELSE (
              (COALESCE(cl.mid_sem_level, 0) * cm.mid_sem_marks) +
              (COALESCE(cl.internal_level, 0) * cm.internal_marks) +
              (COALESCE(cl.external_level, 0) * cm.external_marks) +
              (COALESCE(cl.viva_level, 0) * cm.viva_marks)
            ) / (cm.mid_sem_marks + cm.internal_marks + cm.external_marks + cm.viva_marks)
          END,
          2
        )::NUMERIC AS co_attainment_level
      FROM component_levels cl
      CROSS JOIN component_max cm
      ORDER BY cl.co_number
    `,
    [offeringId]
  );

  return result.rows;
};

const getOverallCoAttainmentLevelsByOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        co_number,
        overall_total AS co_attainment_level
      FROM overall_co_attainment_report
      WHERE offering_id = $1
        AND is_deleted = FALSE
      ORDER BY co_number
    `,
    [offeringId]
  );

  return result.rows;
};

const getComponentMaxMarksByOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        e.exam_type::TEXT AS component,
        COALESCE(SUM(p.max_marks), 0)::NUMERIC AS component_max_marks
      FROM paper p
      JOIN exam e ON e.exam_id = p.exam_id
      WHERE p.offering_id = $1
        AND p.is_deleted = FALSE
        AND e.is_deleted = FALSE
        AND e.exam_type IN ('mid_sem', 'internal', 'external', 'viva')
      GROUP BY e.exam_type
    `,
    [offeringId]
  );

  return result.rows;
};

const upsertCoPoPsoAttainmentRows = async (client, rows) => {
  if (!rows.length) {
    return;
  }

  const createdAt = Date.now();
  const values = [];
  const placeholders = rows.map((row, index) => {
    const base = index * 7;
    values.push(
      row.offering_id,
      row.co_number,
      row.outcome_type,
      row.outcome_code,
      row.attainment_level,
      createdAt,
      false
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  });

  const query = `
    INSERT INTO co_po_pso_attainment_report
      (offering_id, co_number, outcome_type, outcome_code, attainment_level, created_at, is_deleted)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (offering_id, co_number, outcome_type, outcome_code)
    DO UPDATE SET
      attainment_level = EXCLUDED.attainment_level,
      created_at = EXCLUDED.created_at,
      is_deleted = FALSE
  `;

  await client.query(query, values);
};

const markStaleCoPoPsoAttainmentRowsDeleted = async (client, offeringId) => {
  await client.query(
    `
      DELETE FROM co_po_pso_attainment_report
      WHERE offering_id = $1
    `,
    [offeringId]
  );
};

const getStoredCoPoPsoAttainmentByOffering = async (client, offeringId) => {
  const result = await client.query(
    `
      SELECT
        co_number,
        outcome_type,
        outcome_code,
        attainment_level
      FROM co_po_pso_attainment_report
      WHERE offering_id = $1
        AND is_deleted = FALSE
      ORDER BY co_number, outcome_type, outcome_code
    `,
    [offeringId]
  );

  return result.rows;
};

const replaceCoPoPsoAttainmentAverageRowsByOffering = async (client, offeringId, rows) => {
  await client.query(
    `
      DELETE FROM co_po_pso_attainment_average
      WHERE offering_id = $1
    `,
    [offeringId]
  );

  if (!rows.length) {
    return;
  }

  const createdAt = Date.now();
  const values = [];
  const placeholders = rows.map((row, index) => {
    const base = index * 6;
    values.push(
      offeringId,
      row.outcome_type,
      row.outcome_code,
      row.average_attainment_level,
      createdAt,
      false
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  const query = `
    INSERT INTO co_po_pso_attainment_average
      (
        offering_id,
        outcome_type,
        outcome_code,
        average_attainment_level,
        created_at,
        is_deleted
      )
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (offering_id, outcome_type, outcome_code)
    DO UPDATE SET
      average_attainment_level = EXCLUDED.average_attainment_level,
      created_at = EXCLUDED.created_at,
      is_deleted = FALSE
  `;

  await client.query(query, values);
};

const getOfferedSubjectsWithFacultyByYearBranch = async (client, accadmicYear, branchCode) => {
  const result = await client.query(
    `
      SELECT
        o.id AS offering_id,
        o.accadmic_year,
        o.session,
        o.sem_number,
        o.subject_code,
        s.name AS subject_name,
        fc.branch_code,
        b.name AS branch_name,
        fc.name AS coordinator_name,
        COALESCE(
          STRING_AGG(DISTINCT af.name, ', ' ORDER BY af.name) FILTER (WHERE af.name IS NOT NULL),
          fc.name
        ) AS faculty_names
      FROM offered_subjects o
      JOIN subject s
        ON s.subject_code = o.subject_code
       AND s.is_deleted = FALSE
      JOIN faculty fc
        ON fc.id = o.faculty_corrdinator_id
       AND fc.is_deleted = FALSE
      LEFT JOIN branch b
        ON b.branch_code = fc.branch_code
       AND b.is_deleted = FALSE
      LEFT JOIN assigned_subject_faculty asf
        ON asf.offering_id = o.id
       AND asf.is_deleted = FALSE
      LEFT JOIN faculty af
        ON af.id = asf.faculty_id
       AND af.is_deleted = FALSE
      WHERE o.accadmic_year = $1
        AND fc.branch_code = $2
        AND o.is_deleted = FALSE
      GROUP BY
        o.id,
        o.accadmic_year,
        o.session,
        o.sem_number,
        o.subject_code,
        s.name,
        fc.branch_code,
        b.name,
        fc.name
      ORDER BY o.sem_number, o.subject_code, o.id
    `,
    [accadmicYear, branchCode]
  );

  return result.rows;
};

const getOfferedSubjectsWithFacultyByBatchBranch = async (client, batchId, branchCode) => {
  const result = await client.query(
    `
      SELECT
        o.id AS offering_id,
        o.accadmic_year,
        o.session,
        o.sem_number,
        o.subject_code,
        o.batch_id,
        s.name AS subject_name,
        b.branch_code,
        br.name AS branch_name,
        fc.name AS coordinator_name,
        COALESCE(
          STRING_AGG(DISTINCT af.name, ', ' ORDER BY af.name) FILTER (WHERE af.name IS NOT NULL),
          fc.name
        ) AS faculty_names
      FROM offered_subjects o
      JOIN subject s
        ON s.subject_code = o.subject_code
       AND s.is_deleted = FALSE
      JOIN batch b
        ON b.id = o.batch_id
       AND b.is_deleted = FALSE
      JOIN branch br
        ON br.branch_code = b.branch_code
       AND br.is_deleted = FALSE
      LEFT JOIN faculty fc
        ON fc.id = o.faculty_corrdinator_id
       AND fc.is_deleted = FALSE
      LEFT JOIN assigned_subject_faculty asf
        ON asf.offering_id = o.id
       AND asf.is_deleted = FALSE
      LEFT JOIN faculty af
        ON af.id = asf.faculty_id
       AND af.is_deleted = FALSE
      WHERE o.batch_id = $1
        AND b.branch_code = $2
        AND o.is_deleted = FALSE
      GROUP BY
        o.id,
        o.accadmic_year,
        o.session,
        o.sem_number,
        o.subject_code,
        o.batch_id,
        s.name,
        b.branch_code,
        br.name,
        fc.name
      ORDER BY o.sem_number, o.subject_code, o.id
    `,
    [batchId, branchCode]
  );

  return result.rows;
};

const getCoPoPsoAttainmentAverageByOfferingIds = async (client, offeringIds) => {
  if (!offeringIds.length) {
    return [];
  }

  const result = await client.query(
    `
      SELECT
        offering_id,
        outcome_type,
        outcome_code,
        average_attainment_level
      FROM co_po_pso_attainment_average
      WHERE offering_id = ANY($1::INT[])
        AND is_deleted = FALSE
      ORDER BY offering_id, outcome_type, outcome_code
    `,
    [offeringIds]
  );

  return result.rows;
};

const getOverallCoAttainmentByOfferingIds = async (client, offeringIds) => {
  if (!offeringIds.length) {
    return [];
  }

  const result = await client.query(
    `
      SELECT
        offering_id,
        co_number,
        overall_total
      FROM overall_co_attainment_report
      WHERE offering_id = ANY($1::INT[])
        AND is_deleted = FALSE
      ORDER BY offering_id, co_number
    `,
    [offeringIds]
  );

  return result.rows;
};

const getDepartmentCodeNameList = async (client) => {
  const result = await client.query(
    `
      SELECT branch_code, name
      FROM branch
      WHERE is_deleted = FALSE
      ORDER BY branch_code ASC
    `
  );

  return result.rows;
};

module.exports = {
  calculateOfferingComponentCoAttainmentRows,
  replaceCoAttainmentReportByOffering,
  getStoredCoAttainmentReportByOffering,
  getCourseOutcomesByOffering,
  getProgramOutcomes,
  getProgramOutcomesDetailed,
  getProgramOutcomeCompetencies,
  getProgramOutcomeIndicators,
  getProgramSpecificOutcomesByBranch,
  upsertCourseOutcomesByOffering,
  upsertProgramOutcomes,
  replaceProgramOutcomesFromImport,
  upsertProgramSpecificOutcomesByBranch,
  replaceOverallCoAttainmentReportByOffering,
  getStoredOverallCoAttainmentReportByOffering,
  upsertCoPoPsoStrengthMapping,
  updateCoPoPsoStrengthMappingByComposite,
  getCoPoPsoStrengthMappingsByOffering,
  getCoNumbersByOfferingId,
  getOutcomeCodesByOfferingId,
  getOfferingReportContextById,
  getNbaOutcomeHeadersByOffering,
  getCoAttainmentLevelsByOffering,
  getOverallCoAttainmentLevelsByOffering,
  getComponentMaxMarksByOffering,
  markStaleCoPoPsoAttainmentRowsDeleted,
  upsertCoPoPsoAttainmentRows,
  getStoredCoPoPsoAttainmentByOffering,
  replaceCoPoPsoAttainmentAverageRowsByOffering,
  getOfferedSubjectsWithFacultyByYearBranch,
  getOfferedSubjectsWithFacultyByBatchBranch,
  getCoPoPsoAttainmentAverageByOfferingIds,
  getOverallCoAttainmentByOfferingIds,
  getDepartmentCodeNameList
};