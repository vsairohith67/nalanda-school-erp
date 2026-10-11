import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
if(process.env.TRIVY_ACTION_OUTCOME!=="success"||process.env.GRYPE_ACTION_OUTCOME!=="success")throw Error("SUCCESSFUL_SCANNER_STEPS_REQUIRED");
// Read the scanner databases actually used on this runner. Missing/new formats fail closed.
const trivy=JSON.parse(execFileSync('trivy',['--version','--format','json'],{encoding:'utf8',timeout:30000}));
const grype=JSON.parse(execFileSync('grype',['db','status','-o','json'],{encoding:'utf8',timeout:30000}));
const report=JSON.parse(readFileSync(process.argv[3]||'grype-results.json','utf8'));
const trivyRoot=process.env.TRIVY_CACHE_DIR||path.join(homedir(),'.cache/trivy');
const grypeRoot=grype.path ?? grype.location;
if(typeof grypeRoot!=='string'||!path.isAbsolute(grypeRoot)||grype.valid!==true||!grype.built||!trivy.VulnerabilityDB?.UpdatedAt||!trivy.Version)throw Error('SCANNER_DATABASE_METADATA_UNAVAILABLE');
const dbHash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const grypeFiles=lstatSync(grypeRoot).isFile()?[grypeRoot]:readdirSync(grypeRoot).filter(n=>/^(vulnerability|vulnerability-db)\.db$/.test(n)).map(n=>path.join(grypeRoot,n));
if(grypeFiles.length!==1)throw Error('GRYPE_DATABASE_IDENTITY_AMBIGUOUS');
const policy={ignoreUnfixed:false,severityThreshold:'HIGH',exitCode:0};
writeFileSync(process.argv[2]||'scanner-metadata.json',JSON.stringify({trivy:{...policy,version:trivy.Version,databaseUpdatedAt:trivy.VulnerabilityDB.UpdatedAt,databaseSha256:dbHash(path.join(trivyRoot,'db/trivy.db'))},grype:{...policy,version:report.descriptor.version,databaseUpdatedAt:grype.built,databaseSha256:dbHash(grypeFiles[0])}}),{flag:'wx'});
