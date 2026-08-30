import { assertSyntheticPilotRoleAccessMatrixIntegrity, buildSyntheticPilotRoleAccessMatrix } from "../config/synthetic-pilot-role-access-matrix";

const matrix = process.argv.includes("--check") ? assertSyntheticPilotRoleAccessMatrixIntegrity() : buildSyntheticPilotRoleAccessMatrix();
if (process.argv.includes("--check")) {
  if (matrix.roles.length !== 12) throw new Error("SYNTHETIC_PILOT_ROLE_COUNT_MISMATCH");
  for (const role of matrix.roles) {
    if (!role.landingRoute || role.allowedPermissions.length === 0 || role.sources.length === 0) {
      throw new Error(`SYNTHETIC_PILOT_ROLE_MATRIX_INCOMPLETE:${role.role}`);
    }
  }
  console.log(JSON.stringify({ result: "SYNTHETIC_PILOT_ROLE_ACCESS_MATRIX_PASSED", roles: matrix.roles.length, criticalSurfaces: matrix.criticalSurfaces.length }));
} else {
  console.log(JSON.stringify(matrix, null, 2));
}
