-- Provision the dedicated retail template and its single task atomically.
WITH added AS (
    INSERT INTO "ShiftControlTemplate" ("name", "department", "shiftCode", "updatedAt")
    SELECT 'Сдача личной кассы', 'retail', 'cash_handover', CURRENT_TIMESTAMP
    WHERE NOT EXISTS (
        SELECT 1 FROM "ShiftControlTemplate"
        WHERE "department" = 'retail' AND "shiftCode" = 'cash_handover'
    )
    RETURNING id
)
INSERT INTO "ShiftControlTemplateTask"
    ("templateId", "title", "category", "sortOrder", "required", "updatedAt")
SELECT id, 'Пересчитать и передать кассу', 'handover', 1, TRUE, CURRENT_TIMESTAMP FROM added;
