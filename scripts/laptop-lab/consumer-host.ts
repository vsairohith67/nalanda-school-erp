import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {hashBytes} from '../portable/artifact-handoff';
import {boundedJson} from '../portable/product-input-contract';
import {canonicalDirectory} from './consumer-profile';
export const LOCAL_DOCKER='C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
export const LOCAL_COMPOSE_DIRECTORY='C:\\Program Files\\Docker\\Docker\\resources\\cli-plugins';
export type LocalHost={docker:string;config:string;guard():void};
export type LocalHostRegistration={dockerSha256:string;composeSha256:string;configurationSha256:string};
export function hostConfigurationIdentity(root:string){
 canonicalDirectory(root);const rows:[string,string][]= [];let nodes=0;
 const visit=(relative:string)=>{
  const file=path.join(root,relative),s=lstatSync(file);assert(!s.isSymbolicLink()&&++nodes<=64,'LOCAL_DOCKER_CONFIGURATION_UNSAFE');
  if(s.isDirectory()){canonicalDirectory(file);for(const name of readdirSync(file).sort())visit(path.join(relative,name));return;}
  assert(s.isFile()&&s.nlink===1&&s.size<=65536&&rows.length<32,'LOCAL_DOCKER_CONFIGURATION_UNSAFE');
  const name=relative.replaceAll('\\','/');assert(name==='config.json'||/^contexts\/meta\/[a-f0-9]{64}\/meta.json$/.test(name),'LOCAL_DOCKER_CONFIGURATION_UNSAFE');rows.push([name,hashBytes(readFileSync(file))]);
 };visit('');
 const config=boundedJson(readFileSync(path.join(root,'config.json')),65536);
 assert(Object.keys(config).sort().join()==='cliPluginsExtraDirs,currentContext'&&config.currentContext==='desktop-linux'&&Array.isArray(config.cliPluginsExtraDirs)&&config.cliPluginsExtraDirs.length===1&&config.cliPluginsExtraDirs[0]===LOCAL_COMPOSE_DIRECTORY,'LOCAL_DOCKER_CONFIGURATION_UNSAFE');
 assert(!existsSync(path.join(root,'cli-plugins')),'LOCAL_DOCKER_PLUGIN_OVERRIDE');return hashBytes(JSON.stringify(rows));
}
/** Read-only check of independently pinned local tools/config; never generates
 * a Docker context, plugin installation or configuration directory. */
export function registeredLocalHost(custodyDirectory:string,pins:LocalHostRegistration):LocalHost{
 assert(process.platform==='win32'&&process.arch==='x64','LOCAL_CUSTODY_PLATFORM_UNPROVEN');
 assert.equal(process.env.SystemRoot?.toLowerCase(),'c:\\windows','LOCAL_SYSTEM_ROOT_UNSUPPORTED');
 const docker=LOCAL_DOCKER,compose=path.join(LOCAL_COMPOSE_DIRECTORY,'docker-compose.exe'),config=path.join(custodyDirectory,'docker-config');
 const guard=()=>{
  for(const [file,expected] of [[docker,pins.dockerSha256],[compose,pins.composeSha256]]){canonicalDirectory(path.dirname(file));const s=lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=512*2**20&&hashBytes(readFileSync(file))===expected,'LOCAL_DOCKER_TOOL_CHANGED');}
  assert.equal(hostConfigurationIdentity(config),pins.configurationSha256,'LOCAL_DOCKER_CONFIGURATION_CHANGED');
 };guard();return Object.freeze({docker,config,guard});
}
