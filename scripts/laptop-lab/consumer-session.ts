import assert from 'node:assert/strict';
import {hashSessionSecret,sessionHashMatches} from '../../lib/session-token';
export async function certificateSessionProbe(cookie:string){
 const match=/^__Host-nalanda_session=v1\.([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/i.exec(cookie);
 assert(match,'CERTIFICATE_SESSION_ENVELOPE_REQUIRED');
 // Signature is still verified by the ordinary server. Only the persisted
 // verifier is sent to its same-database read-only probe; no signing-key read.
 return {sessionId:match[1],sessionSecretSha256:await hashSessionSecret(match[2])};
}
export type ReadonlySessionRow={id:string;userId:string;tokenHash:string;revokedAt:Date|null;expiresAt:Date;credentialVersion:number;authorizationVersion:number;activeRoleAssignmentId:string|null;user:{id:string;isActive:boolean;lifecycleStatus:string;mustChangePassword:boolean;credentialVersion:number;authorizationVersion:number}};
export type ReadonlyRoleRow={id:string;userId:string;role:string;status:string;validFrom:Date;validUntil:Date|null};
/** Same persisted-session checks as resolvePersistedSession, without its
 * lastSeen write; this is target binding, not an alternate authentication API. */
export function assertReadonlyCertificateSession(session:ReadonlySessionRow|null,assignment:ReadonlyRoleRow|null,probe:{sessionId:string;sessionSecretSha256:string;userId:string},now=new Date()){
 assert(session&&assignment&&session.id===probe.sessionId&&session.userId===probe.userId&&session.user.id===probe.userId&&sessionHashMatches(session.tokenHash,probe.sessionSecretSha256),'CERTIFICATE_SESSION_ACTOR_MISMATCH');
 assert(!session.revokedAt&&session.expiresAt>now&&session.user.isActive&&session.user.lifecycleStatus==='ACTIVE'&&!session.user.mustChangePassword&&session.credentialVersion===session.user.credentialVersion&&session.authorizationVersion===session.user.authorizationVersion,'CERTIFICATE_SESSION_NOT_CURRENT');
 assert(assignment.id===session.activeRoleAssignmentId&&assignment.userId===probe.userId&&assignment.role==='SUPER_ADMIN'&&assignment.status==='ACTIVE'&&assignment.validFrom<=now&&(!assignment.validUntil||assignment.validUntil>now),'CERTIFICATE_SESSION_ROLE_MISMATCH');
}
