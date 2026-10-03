// Build paired, feature-owned controls only. This script never connects to a database.
import fs from "node:fs";
const migration = "20260908220000_student_items_prior_year_concessions_1a";
const sqlite = [];
const postgres = [];
for (const table of ["PriorYearConcessionEvent", "PriorYearPaymentAttribution", "StudentItemReceiptSnapshot"]) {
  for (const operation of ["UPDATE", "DELETE"]) {
    const name = `${table}_${operation.toLowerCase()}_immutable`;
    sqlite.push(`CREATE TRIGGER "${name}" BEFORE ${operation} ON "${table}" BEGIN SELECT RAISE(ABORT, 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'); END;`);
    postgres.push(`CREATE FUNCTION "${name}_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'; END; $$;\nCREATE TRIGGER "${name}" BEFORE ${operation} ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${name}_fn"();`);
  }
}
sqlite.push(`CREATE TRIGGER "PriorYearLiability_verified_identity" BEFORE UPDATE ON "PriorYearLiability" WHEN OLD.status = 'VERIFIED' AND (NEW.studentId IS NOT OLD.studentId OR NEW.sourceYear IS NOT OLD.sourceYear OR NEW.operatingYear IS NOT OLD.operatingYear OR NEW.openingAmount IS NOT OLD.openingAmount OR NEW.existingCredits IS NOT OLD.existingCredits OR NEW.sourceEnrollmentId IS NOT OLD.sourceEnrollmentId OR NEW.sourceReferencesJson IS NOT OLD.sourceReferencesJson OR NEW.provenance IS NOT OLD.provenance OR NEW.preparerId IS NOT OLD.preparerId OR NEW.verifierId IS NOT OLD.verifierId OR NEW.verifiedAt IS NOT OLD.verifiedAt OR NEW.status IS NOT OLD.status) BEGIN SELECT RAISE(ABORT, 'VERIFIED_LIABILITY_IMMUTABLE'); END;`);
postgres.push(`CREATE FUNCTION "PriorYearLiability_verified_identity_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status = 'VERIFIED' AND ROW(NEW."studentId",NEW."sourceYear",NEW."operatingYear",NEW."openingAmount",NEW."existingCredits",NEW."sourceEnrollmentId",NEW."sourceReferencesJson",NEW.provenance,NEW."preparerId",NEW."verifierId",NEW."verifiedAt",NEW.status) IS DISTINCT FROM ROW(OLD."studentId",OLD."sourceYear",OLD."operatingYear",OLD."openingAmount",OLD."existingCredits",OLD."sourceEnrollmentId",OLD."sourceReferencesJson",OLD.provenance,OLD."preparerId",OLD."verifierId",OLD."verifiedAt",OLD.status) THEN RAISE EXCEPTION 'VERIFIED_LIABILITY_IMMUTABLE'; END IF; RETURN NEW; END; $$;\nCREATE TRIGGER "PriorYearLiability_verified_identity" BEFORE UPDATE ON "PriorYearLiability" FOR EACH ROW EXECUTE FUNCTION "PriorYearLiability_verified_identity_fn"();`);
// Any existing payment service changing this Student's payments invalidates all approvals.
for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
  const name = `Payment_prior_year_version_${operation.toLowerCase()}`;
  const conditions = operation === "INSERT" ? '"studentId" = NEW."studentId"' : operation === "DELETE" ? '"studentId" = OLD."studentId"' : '"studentId" = OLD."studentId" OR "studentId" = NEW."studentId"';
  sqlite.push(`CREATE TRIGGER "${name}" AFTER ${operation} ON "Payment" BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE ${conditions}; END;`);
  postgres.push(`CREATE FUNCTION "${name}_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE ${conditions}; RETURN ${operation === "DELETE" ? "OLD" : "NEW"}; END; $$;\nCREATE TRIGGER "${name}" AFTER ${operation} ON "Payment" FOR EACH ROW EXECUTE FUNCTION "${name}_fn"();`);
}
for (const [provider, controls] of [["", sqlite.map((sql) => sql.replace(/\b(NEW|OLD)\.([A-Za-z][A-Za-z0-9]*)/g, '$1."$2"'))], ["postgresql/", postgres]]) {
  const target = `prisma/${provider}migrations/${migration}/migration.sql`;
  const original = fs.readFileSync(target, "utf8").split("-- Prior-year immutable and concurrency controls")[0].trimEnd();
  fs.writeFileSync(target, `${original}\n\n-- Prior-year immutable and concurrency controls\n${controls.join("\n\n")}\n`);
}
