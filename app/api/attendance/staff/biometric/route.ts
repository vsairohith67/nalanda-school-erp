import { requireApiPermission } from "@/lib/auth";
import { biometricApiError, biometricJson, parseBiometricApiJson } from "@/lib/biometric-attendance/api";
import { requireBiometricAttendanceForApi } from "@/lib/biometric-attendance/feature-flag";
import { approveBiometricPolicy, createBiometricBridge, createBiometricPolicy, loadBiometricWorkspace, prepareBiometricMapping, registerBiometricDevice, rotateBiometricBridgeKey, transitionBiometricBridge, transitionBiometricDevice, transitionBiometricMapping } from "@/lib/biometric-attendance/governance";
import { approveBiometricReconciliation, decideBiometricCorrection, reconcileBiometricAttendanceDate, requestBiometricCorrection } from "@/lib/biometric-attendance/reconciliation";
import { prisma } from "@/lib/prisma";

const PERMISSIONS = {
  CREATE_BRIDGE: "MANAGE_BIOMETRIC_DEVICES", APPROVE_BRIDGE: "MANAGE_BIOMETRIC_DEVICES", REVOKE_BRIDGE: "MANAGE_BIOMETRIC_DEVICES", RETIRE_BRIDGE: "MANAGE_BIOMETRIC_DEVICES", ROTATE_BRIDGE_KEY: "MANAGE_BIOMETRIC_DEVICES",
  REGISTER_DEVICE: "MANAGE_BIOMETRIC_DEVICES", APPROVE_DEVICE: "MANAGE_BIOMETRIC_DEVICES", REVOKE_DEVICE: "MANAGE_BIOMETRIC_DEVICES", RETIRE_DEVICE: "MANAGE_BIOMETRIC_DEVICES", VERIFY_DEVICE_PROTOCOL: "MANAGE_BIOMETRIC_DEVICES",
  CREATE_POLICY: "MANAGE_BIOMETRIC_DEVICES", APPROVE_POLICY: "MANAGE_BIOMETRIC_DEVICES",
  PREPARE_MAPPING: "MANAGE_BIOMETRIC_STAFF_MAPPINGS", APPROVE_MAPPING: "APPROVE_BIOMETRIC_STAFF_MAPPINGS", REVOKE_MAPPING: "APPROVE_BIOMETRIC_STAFF_MAPPINGS",
  RECONCILE_DATE: "RECONCILE_BIOMETRIC_ATTENDANCE", REQUEST_CORRECTION: "RECONCILE_BIOMETRIC_ATTENDANCE", APPROVE_RECONCILIATION: "APPROVE_BIOMETRIC_ATTENDANCE", APPROVE_CORRECTION: "APPROVE_BIOMETRIC_ATTENDANCE", REJECT_CORRECTION: "APPROVE_BIOMETRIC_ATTENDANCE", ACKNOWLEDGE_SEQUENCE_GAP: "APPROVE_BIOMETRIC_ATTENDANCE"
} as const;

export async function GET() {
  const unavailable = requireBiometricAttendanceForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("VIEW_BIOMETRIC_ATTENDANCE"); if (auth.response) return auth.response;
  try { return biometricJson(await loadBiometricWorkspace()); } catch (error) { return biometricApiError(error); }
}

export async function POST(request: Request) {
  const unavailable = requireBiometricAttendanceForApi(); if (unavailable) return unavailable;
  try {
    const source = await parseBiometricApiJson(request) as Record<string, unknown>;
    const action = String(source.action ?? "").trim().toUpperCase() as keyof typeof PERMISSIONS;
    const permission = PERMISSIONS[action]; if (!permission) throw new Error("BIOMETRIC_ACTION_INVALID");
    const auth = await requireApiPermission(permission); if (auth.response || !auth.user) return auth.response;
    const id = String(source.id ?? "").trim();
    if (action === "CREATE_BRIDGE") return biometricJson({ bridge: await createBiometricBridge(source, auth.user.id) }, 201);
    if (action === "APPROVE_BRIDGE") return biometricJson({ bridge: await transitionBiometricBridge(id, "APPROVE", auth.user.id) });
    if (action === "REVOKE_BRIDGE" || action === "RETIRE_BRIDGE") return biometricJson({ bridge: await transitionBiometricBridge(id, action === "RETIRE_BRIDGE" ? "RETIRE" : "REVOKE", auth.user.id, source.reason) });
    if (action === "ROTATE_BRIDGE_KEY") return biometricJson({ bridge: await rotateBiometricBridgeKey(id, source.publicSigningKey, auth.user.id) });
    if (action === "REGISTER_DEVICE") return biometricJson({ device: await registerBiometricDevice(source, auth.user.id) }, 201);
    if (action === "APPROVE_DEVICE") return biometricJson({ device: await transitionBiometricDevice(id, "APPROVE", auth.user.id) });
    if (["REVOKE_DEVICE", "RETIRE_DEVICE", "VERIFY_DEVICE_PROTOCOL"].includes(action)) return biometricJson({ device: await transitionBiometricDevice(id, action === "RETIRE_DEVICE" ? "RETIRE" : action === "VERIFY_DEVICE_PROTOCOL" ? "VERIFY_PROTOCOL" : "REVOKE", auth.user.id, source.reason) });
    if (action === "CREATE_POLICY") return biometricJson({ policy: await createBiometricPolicy(source, auth.user.id) }, 201);
    if (action === "APPROVE_POLICY") return biometricJson({ policy: await approveBiometricPolicy(id, auth.user.id) });
    if (action === "PREPARE_MAPPING") return biometricJson({ mapping: await prepareBiometricMapping(source, auth.user.id) }, 201);
    if (action === "APPROVE_MAPPING" || action === "REVOKE_MAPPING") return biometricJson({ mapping: await transitionBiometricMapping(id, action === "APPROVE_MAPPING" ? "APPROVE" : "REVOKE", auth.user.id, source.reason) });
    if (action === "RECONCILE_DATE") return biometricJson(await reconcileBiometricAttendanceDate(source.attendanceDate, auth.user.id));
    if (action === "APPROVE_RECONCILIATION") return biometricJson({ reconciliation: await approveBiometricReconciliation(id, auth.user.id) });
    if (action === "REQUEST_CORRECTION") return biometricJson({ correction: await requestBiometricCorrection(source, auth.user.id) }, 201);
    if (action === "APPROVE_CORRECTION" || action === "REJECT_CORRECTION") return biometricJson({ correction: await decideBiometricCorrection(id, action === "APPROVE_CORRECTION" ? "APPROVE" : "REJECT", auth.user.id, source.reason) });
    if (action === "ACKNOWLEDGE_SEQUENCE_GAP") {
      const note = String(source.reason ?? "").trim(); if (!note || note.length > 500) throw new Error("BIOMETRIC_SEQUENCE_GAP_NOTE_REQUIRED");
      const updated = await prisma.biometricSequenceGap.updateMany({ where: { id, status: "OPEN" }, data: { status: "ACKNOWLEDGED", acknowledgedByUserId: auth.user.id, acknowledgedAt: new Date(), acknowledgementNote: note } });
      if (updated.count !== 1) throw new Error("BIOMETRIC_SEQUENCE_GAP_NOT_FOUND");
      await prisma.biometricAuditEvent.create({ data: { entityType: "SEQUENCE_GAP", entityId: id, eventType: "SEQUENCE_GAP_ACKNOWLEDGED", actorUserId: auth.user.id, safeMetadataJson: JSON.stringify({ noteRecorded: true }) } });
      return biometricJson({ acknowledged: true });
    }
    throw new Error("BIOMETRIC_ACTION_INVALID");
  } catch (error) { return biometricApiError(error); }
}
