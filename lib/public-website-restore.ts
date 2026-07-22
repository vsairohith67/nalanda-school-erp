import type { Prisma } from "@prisma/client";
import type { RestoreRecord, RestoreResult, ValidatedBackup } from "@/lib/restore";

type Client = Pick<Prisma.TransactionClient,
  "publicWebsiteSettings" | "publicWebsitePage" | "publicWebsitePageVersion" |
  "publicWebsitePost" | "publicWebsitePostVersion" | "publicWebsiteNavigationItem" |
  "publicWebsiteEvent">;

export async function restorePublicWebsiteData(
  client: Client,
  backup: Pick<ValidatedBackup, "publicWebsiteSettings" | "publicWebsitePages" | "publicWebsitePageVersions" | "publicWebsitePosts" | "publicWebsitePostVersions" | "publicWebsiteNavigationItems" | "publicWebsiteEvents">,
  result: Pick<RestoreResult, "publicWebsiteSettings" | "publicWebsitePages" | "publicWebsitePageVersions" | "publicWebsitePosts" | "publicWebsitePostVersions" | "publicWebsiteNavigationItems" | "publicWebsiteEvents" | "warnings">
) {
  const pageMap = new Map<string, string>(), postMap = new Map<string, string>(), pageVersionMap = new Map<string, string>(), postVersionMap = new Map<string, string>();
  const desiredPageCurrent = new Map<string, string>(), desiredPostCurrent = new Map<string, string>();
  const backupPageVersionOwners = new Map(backup.publicWebsitePageVersions.flatMap((row) =>
    typeof row.id === "string" && typeof row.pageId === "string" ? [[row.id, row.pageId] as const] : []));
  const backupPostVersionOwners = new Map(backup.publicWebsitePostVersions.flatMap((row) =>
    typeof row.id === "string" && typeof row.postId === "string" ? [[row.id, row.postId] as const] : []));

  for (const [index, row] of backup.publicWebsiteSettings.entries()) try {
    const id = required(row.id, "Website settings ID"), settingsCode = required(row.settingsCode, "Website settings code");
    const [byId, byCode] = await Promise.all([client.publicWebsiteSettings.findUnique({ where: { id } }), client.publicWebsiteSettings.findUnique({ where: { settingsCode } })]);
    if ((byId && byId.settingsCode !== settingsCode) || (byCode && byCode.id !== id)) {
      result.publicWebsiteSettings.skipped++; result.warnings.push(`Public website settings ${settingsCode} collided with preserved local content and were isolated.`); continue;
    }
    if (byId) { result.publicWebsiteSettings.skipped++; continue; }
    await client.publicWebsiteSettings.create({ data: {
      id, settingsCode, siteName: required(row.siteName, "Website site name"), shortName: required(row.shortName, "Website short name"),
      tagline: optional(row.tagline), publicSiteUrl: optional(row.publicSiteUrl), publicAddress: optional(row.publicAddress),
      publicOfficePhone: optional(row.publicOfficePhone), publicOfficeEmail: optional(row.publicOfficeEmail),
      publicOfficeHours: optional(row.publicOfficeHours), publicDirectionsUrl: optional(row.publicDirectionsUrl),
      portalLoginPath: required(row.portalLoginPath, "Website portal path"), defaultSeoTitle: required(row.defaultSeoTitle, "Website SEO title"),
      defaultSeoDescription: required(row.defaultSeoDescription, "Website SEO description"), defaultSocialImageKey: optional(row.defaultSocialImageKey),
      themeConfigJson: required(row.themeConfigJson, "Website theme config"), contactConfigJson: required(row.contactConfigJson, "Website contact config"),
      socialLinksJson: optional(row.socialLinksJson), mandatoryDisclosureEnabled: bool(row.mandatoryDisclosureEnabled),
      status: status(row.status), reviewVersion: integer(row.reviewVersion), approvedReviewVersion: optionalInteger(row.approvedReviewVersion),
      createdByUserId: null, reviewedByUserId: null, publishedByUserId: null, reviewedAt: optionalDate(row.reviewedAt), publishedAt: optionalDate(row.publishedAt),
      createdAt: optionalDate(row.createdAt) ?? new Date(), updatedAt: optionalDate(row.updatedAt) ?? new Date()
    } }); result.publicWebsiteSettings.created++;
  } catch (error) { result.publicWebsiteSettings.errors.push(rowError("Public website settings", index, error)); }

  for (const [index, row] of backup.publicWebsitePages.entries()) try {
    const id=required(row.id,"Website page ID"),pageCode=required(row.pageCode,"Website page code"),slug=String(row.slug??"");
    const [byId,byCode,bySlug]=await Promise.all([client.publicWebsitePage.findUnique({where:{id}}),client.publicWebsitePage.findUnique({where:{pageCode}}),client.publicWebsitePage.findUnique({where:{slug}})]);
    if((byId&&(byId.pageCode!==pageCode||byId.slug!==slug))||(byCode&&byCode.id!==id)||(bySlug&&bySlug.id!==id)){result.publicWebsitePages.skipped++;result.warnings.push(`Public website page ${pageCode} collided with a different local ID or slug and was isolated.`);continue;}
    if(byId){pageMap.set(id,id);result.publicWebsitePages.skipped++;continue;}
    await client.publicWebsitePage.create({data:{id,pageCode,pageType:required(row.pageType,"Website page type"),title:required(row.title,"Website page title"),slug,navigationLabel:optional(row.navigationLabel),summary:optional(row.summary),draftContentJson:required(row.draftContentJson,"Website page blocks"),draftSeoJson:required(row.draftSeoJson,"Website page SEO"),status:status(row.status),reviewVersion:integer(row.reviewVersion),approvedReviewVersion:optionalInteger(row.approvedReviewVersion),currentPublishedVersionId:null,showInNavigation:bool(row.showInNavigation),navigationOrder:optionalInteger(row.navigationOrder),indexable:row.indexable!==false,createdByUserId:null,reviewedByUserId:null,publishedByUserId:null,archivedByUserId:null,reviewedAt:optionalDate(row.reviewedAt),publishedAt:optionalDate(row.publishedAt),archivedAt:optionalDate(row.archivedAt),createdAt:optionalDate(row.createdAt)??new Date(),updatedAt:optionalDate(row.updatedAt)??new Date()}});
    pageMap.set(id,id);if(row.currentPublishedVersionId)desiredPageCurrent.set(id,String(row.currentPublishedVersionId));result.publicWebsitePages.created++;
  }catch(error){result.publicWebsitePages.errors.push(rowError("Public website page",index,error));}

  for(const[index,row]of [...backup.publicWebsitePageVersions].sort((a,b)=>Number(a.versionNumber)-Number(b.versionNumber)).entries())try{
    const id=required(row.id,"Website page version ID"),pageId=pageMap.get(required(row.pageId,"Website page version parent"));if(!pageId){result.publicWebsitePageVersions.skipped++;continue;}
    const versionNumber=integer(row.versionNumber),[byId,byVersion]=await Promise.all([client.publicWebsitePageVersion.findUnique({where:{id}}),client.publicWebsitePageVersion.findUnique({where:{pageId_versionNumber:{pageId,versionNumber}}})]);
    if((byId&&(byId.pageId!==pageId||byId.versionNumber!==versionNumber))||(byVersion&&byVersion.id!==id)){result.publicWebsitePageVersions.skipped++;result.warnings.push(`Public page version ${pageId}/${versionNumber} collided with immutable local history and was isolated.`);continue;}
    if(byId){pageVersionMap.set(id,id);result.publicWebsitePageVersions.skipped++;continue;}
    const backupSupersedesId=row.supersedesVersionId?String(row.supersedesVersionId):null;
    if(backupSupersedesId&&backupPageVersionOwners.get(backupSupersedesId)!==String(row.pageId)){result.publicWebsitePageVersions.skipped++;result.warnings.push(`Public page version ${pageId}/${versionNumber} had an unrelated superseded-version link and was isolated.`);continue;}
    const supersedes=backupSupersedesId?pageVersionMap.get(backupSupersedesId):null;
    if(backupSupersedesId&&!supersedes){result.publicWebsitePageVersions.skipped++;result.warnings.push(`Public page version ${pageId}/${versionNumber} had an unavailable superseded-version link and was isolated.`);continue;}
    await client.publicWebsitePageVersion.create({data:{id,pageId,versionNumber,versionType:required(row.versionType,"Website page version type"),titleSnapshot:required(row.titleSnapshot,"Website page title snapshot"),slugSnapshot:String(row.slugSnapshot??""),contentSnapshotJson:required(row.contentSnapshotJson,"Website page content snapshot"),seoSnapshotJson:required(row.seoSnapshotJson,"Website page SEO snapshot"),settingsSnapshotJson:required(row.settingsSnapshotJson,"Website settings snapshot"),contentHash:required(row.contentHash,"Website page content hash"),publicationReason:optional(row.publicationReason),correctionReason:optional(row.correctionReason),publishedAt:optionalDate(row.publishedAt)??new Date(),publishedByUserId:null,supersedesVersionId:supersedes??null,createdAt:optionalDate(row.createdAt)??new Date()}});
    pageVersionMap.set(id,id);result.publicWebsitePageVersions.created++;
  }catch(error){result.publicWebsitePageVersions.errors.push(rowError("Public website page version",index,error));}
  for(const[pageId,backupVersionId]of desiredPageCurrent){const current=backupPageVersionOwners.get(backupVersionId)===pageId?pageVersionMap.get(backupVersionId):null;if(current)await client.publicWebsitePage.update({where:{id:pageId},data:{currentPublishedVersionId:current}});else result.warnings.push(`Public page ${pageId} current-version link was unrelated or unavailable and remained safely unpublished.`);}

  for(const[index,row]of backup.publicWebsitePosts.entries())try{
    const id=required(row.id,"Website post ID"),postNumber=required(row.postNumber,"Website post number"),slug=required(row.slug,"Website post slug");
    const[byId,byNumber,bySlug]=await Promise.all([client.publicWebsitePost.findUnique({where:{id}}),client.publicWebsitePost.findUnique({where:{postNumber}}),client.publicWebsitePost.findUnique({where:{slug}})]);
    if((byId&&(byId.postNumber!==postNumber||byId.slug!==slug))||(byNumber&&byNumber.id!==id)||(bySlug&&bySlug.id!==id)){result.publicWebsitePosts.skipped++;result.warnings.push(`Public website post ${postNumber} collided with a different local ID or slug and was isolated.`);continue;}
    if(byId){postMap.set(id,id);result.publicWebsitePosts.skipped++;continue;}
    await client.publicWebsitePost.create({data:{id,postNumber,postType:required(row.postType,"Website post type"),title:required(row.title,"Website post title"),slug,summary:required(row.summary,"Website post summary"),draftContentJson:required(row.draftContentJson,"Website post blocks"),draftSeoJson:required(row.draftSeoJson,"Website post SEO"),status:status(row.status),reviewVersion:integer(row.reviewVersion),approvedReviewVersion:optionalInteger(row.approvedReviewVersion),currentPublishedVersionId:null,publishAt:optionalDate(row.publishAt),expireAt:optionalDate(row.expireAt),featured:bool(row.featured),createdByUserId:null,reviewedByUserId:null,publishedByUserId:null,archivedByUserId:null,reviewedAt:optionalDate(row.reviewedAt),publishedAt:optionalDate(row.publishedAt),archivedAt:optionalDate(row.archivedAt),createdAt:optionalDate(row.createdAt)??new Date(),updatedAt:optionalDate(row.updatedAt)??new Date()}});
    postMap.set(id,id);if(row.currentPublishedVersionId)desiredPostCurrent.set(id,String(row.currentPublishedVersionId));result.publicWebsitePosts.created++;
  }catch(error){result.publicWebsitePosts.errors.push(rowError("Public website post",index,error));}
  for(const[index,row]of [...backup.publicWebsitePostVersions].sort((a,b)=>Number(a.versionNumber)-Number(b.versionNumber)).entries())try{
    const id=required(row.id,"Website post version ID"),postId=postMap.get(required(row.postId,"Website post version parent"));if(!postId){result.publicWebsitePostVersions.skipped++;continue;}const versionNumber=integer(row.versionNumber),[byId,byVersion]=await Promise.all([client.publicWebsitePostVersion.findUnique({where:{id}}),client.publicWebsitePostVersion.findUnique({where:{postId_versionNumber:{postId,versionNumber}}})]);
    if((byId&&(byId.postId!==postId||byId.versionNumber!==versionNumber))||(byVersion&&byVersion.id!==id)){result.publicWebsitePostVersions.skipped++;result.warnings.push(`Public post version ${postId}/${versionNumber} collided with immutable local history and was isolated.`);continue;}if(byId){postVersionMap.set(id,id);result.publicWebsitePostVersions.skipped++;continue;}
    const backupSupersedesId=row.supersedesVersionId?String(row.supersedesVersionId):null;
    if(backupSupersedesId&&backupPostVersionOwners.get(backupSupersedesId)!==String(row.postId)){result.publicWebsitePostVersions.skipped++;result.warnings.push(`Public post version ${postId}/${versionNumber} had an unrelated superseded-version link and was isolated.`);continue;}
    const supersedesVersionId=backupSupersedesId?postVersionMap.get(backupSupersedesId):null;
    if(backupSupersedesId&&!supersedesVersionId){result.publicWebsitePostVersions.skipped++;result.warnings.push(`Public post version ${postId}/${versionNumber} had an unavailable superseded-version link and was isolated.`);continue;}
    await client.publicWebsitePostVersion.create({data:{id,postId,versionNumber,versionType:required(row.versionType,"Website post version type"),titleSnapshot:required(row.titleSnapshot,"Website post title snapshot"),slugSnapshot:required(row.slugSnapshot,"Website post slug snapshot"),summarySnapshot:required(row.summarySnapshot,"Website post summary snapshot"),contentSnapshotJson:required(row.contentSnapshotJson,"Website post content snapshot"),seoSnapshotJson:required(row.seoSnapshotJson,"Website post SEO snapshot"),contentHash:required(row.contentHash,"Website post content hash"),publicationReason:optional(row.publicationReason),correctionReason:optional(row.correctionReason),publishAt:optionalDate(row.publishAt),expireAt:optionalDate(row.expireAt),publishedAt:optionalDate(row.publishedAt)??new Date(),publishedByUserId:null,supersedesVersionId:supersedesVersionId??null,createdAt:optionalDate(row.createdAt)??new Date()}});
    postVersionMap.set(id,id);result.publicWebsitePostVersions.created++;
  }catch(error){result.publicWebsitePostVersions.errors.push(rowError("Public website post version",index,error));}
  for(const[postId,backupVersionId]of desiredPostCurrent){const current=backupPostVersionOwners.get(backupVersionId)===postId?postVersionMap.get(backupVersionId):null;if(current)await client.publicWebsitePost.update({where:{id:postId},data:{currentPublishedVersionId:current}});else result.warnings.push(`Public post ${postId} current-version link was unrelated or unavailable and remained safely unpublished.`);}

  for(const[index,row]of backup.publicWebsiteNavigationItems.entries())try{const id=required(row.id,"Website navigation ID"),itemCode=required(row.itemCode,"Website navigation code"),pageId=row.pageId?pageMap.get(String(row.pageId)):null;if(row.pageId&&!pageId){result.publicWebsiteNavigationItems.skipped++;continue;}const[byId,byCode]=await Promise.all([client.publicWebsiteNavigationItem.findUnique({where:{id}}),client.publicWebsiteNavigationItem.findUnique({where:{itemCode}})]);if((byId&&byId.itemCode!==itemCode)||(byCode&&byCode.id!==id)){result.publicWebsiteNavigationItems.skipped++;result.warnings.push(`Public navigation item ${itemCode} collided with preserved local configuration and was isolated.`);continue;}if(byId){result.publicWebsiteNavigationItems.skipped++;continue;}await client.publicWebsiteNavigationItem.create({data:{id,itemCode,label:required(row.label,"Website navigation label"),destinationType:required(row.destinationType,"Website navigation destination"),pageId:pageId??null,safeExternalUrl:optional(row.safeExternalUrl),displayOrder:Number(row.displayOrder),placement:required(row.placement,"Website navigation placement"),enabled:row.enabled!==false,opensNewTab:bool(row.opensNewTab),createdByUserId:null,updatedByUserId:null,createdAt:optionalDate(row.createdAt)??new Date(),updatedAt:optionalDate(row.updatedAt)??new Date()}});result.publicWebsiteNavigationItems.created++;}catch(error){result.publicWebsiteNavigationItems.errors.push(rowError("Public website navigation item",index,error));}
  for(const[index,row]of backup.publicWebsiteEvents.entries())try{const id=required(row.id,"Website event ID");if(await client.publicWebsiteEvent.findUnique({where:{id}})){result.publicWebsiteEvents.skipped++;continue;}await client.publicWebsiteEvent.create({data:{id,entityType:required(row.entityType,"Website event entity type"),entityId:optional(row.entityId),eventType:required(row.eventType,"Website event type"),eventDate:optionalDate(row.eventDate)??new Date(),safeReason:optional(row.safeReason),safeMetadataJson:optional(row.safeMetadataJson),actorUserId:null,createdAt:optionalDate(row.createdAt)??new Date()}});result.publicWebsiteEvents.created++;}catch(error){result.publicWebsiteEvents.errors.push(rowError("Public website event",index,error));}
}

function required(value:unknown,label:string){if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required`);return value;}
function optional(value:unknown){return typeof value==="string"&&value.trim()?value:null;}
function integer(value:unknown){const number=Number(value);if(!Number.isInteger(number)||number<1)throw new Error("Expected a positive integer");return number;}
function optionalInteger(value:unknown){if(value==null||value==="")return null;return integer(value);}
function bool(value:unknown){return value===true;}
function optionalDate(value:unknown){if(value==null||value==="")return null;const date=new Date(String(value));if(Number.isNaN(date.getTime()))throw new Error("Invalid date");return date;}
function status(value:unknown){const text=required(value,"Website status");if(!["DRAFT","READY_FOR_REVIEW","PUBLISHED","ARCHIVED"].includes(text))throw new Error("Unsupported website status");return text;}
function rowError(entity:string,index:number,error:unknown){return `${entity} ${index+1}: ${error instanceof Error?error.message:"Unknown restore error"}`;}
