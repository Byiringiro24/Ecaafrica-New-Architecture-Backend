-- Keep school and fee currencies aligned with the school's country.
UPDATE "schools"
SET "currency" = CASE LOWER(TRIM("country"))
  WHEN 'rwanda' THEN 'RWF'
  WHEN 'uganda' THEN 'UGX'
  WHEN 'kenya' THEN 'KES'
  WHEN 'tanzania' THEN 'TZS'
  WHEN 'burundi' THEN 'BIF'
  WHEN 'democratic republic of the congo' THEN 'CDF'
  WHEN 'south sudan' THEN 'SSP'
  WHEN 'ghana' THEN 'GHS'
  WHEN 'nigeria' THEN 'NGN'
  WHEN 'south africa' THEN 'ZAR'
  WHEN 'united states' THEN 'USD'
  WHEN 'united states of america' THEN 'USD'
  WHEN 'united kingdom' THEN 'GBP'
  WHEN 'canada' THEN 'CAD'
  WHEN 'australia' THEN 'AUD'
  WHEN 'india' THEN 'INR'
  WHEN 'eurozone' THEN 'EUR'
  ELSE "currency"
END
WHERE "country" IS NOT NULL;

UPDATE "fee_structures" AS fees
SET "currency" = schools."currency"
FROM "schools" AS schools
WHERE fees."school_id" = schools."id";
