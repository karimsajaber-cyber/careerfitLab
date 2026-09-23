import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const bundled = await build({ entryPoints:[path.resolve("supabase/functions/_shared/semanticValidation.ts")], bundle:true, format:"esm", platform:"node", write:false });
const dir=await mkdtemp(path.join(os.tmpdir(),"cf-integration-")); const file=path.join(dir,"semantic.mjs"); await writeFile(file,bundled.outputFiles[0].text); const s=await import(pathToFileURL(file).href);
const base={...s.DEFAULT_SEMANTIC_VALIDATION_CONFIGURATION,applicationEnabled:true,careerProfileEnabled:true,cacheEnabled:false,timeoutMs:20,supportOperationTimeoutMs:20};
const app=s.buildSemanticPayload("application",{targetRole:"QA",relevantExperience:"I completed practical QA testing projects for web applications."});
const profile=s.buildSemanticPayload("career_profile",{professionalSummary:"I am a QA graduate seeking practical software testing work.",targetRoles:["QA Engineer"],skills:["Manual testing","SQL"],experienceSummary:"I tested student web projects and documented reproducible defects.",educationSummary:"I completed a software testing diploma and practical labs."});
function repo(mode){const events=[];return {events,async readConfiguration(){return {...base,mode}},async readCache(){return null},async writeCache(){},async consumeProviderBudget(){return {allowed:true}},async recordEvent(e){events.push(e)}}}
function fake(result){return {calls:0,async validate(request){this.calls++;return {result:{results:request.fields.map((f,i)=>({key:f.key,state:result,reason_code:result==="invalid"?"wrong_field_semantics":null}))}}}}}
async function draftBoundary(mode,result,{limited=false}={}){let persisted=0,email=0;const provider=fake(result);if(limited)return {provider,persisted,email,reply:"draft_rate_limited"};const d=await s.orchestrateSemanticValidation(app,{repository:repo(mode),provider,cacheHmacSecret:"x"});if(d.blockedFieldKeys.length)return {provider,persisted,email,reply:"semantic_invalid"};persisted++;email++;return {provider,persisted,email,reply:"ok",stored:{targetRole:"QA"}}}
let x=await draftBoundary("off","invalid");assert.equal(x.provider.calls,0);assert.equal(x.reply,"ok");
x=await draftBoundary("shadow","invalid");assert.equal(x.reply,"ok");assert.equal(x.persisted,1);assert.equal(x.email,1);
x=await draftBoundary("enforced","invalid");assert.equal(x.reply,"semantic_invalid");assert.equal(x.persisted,0);assert.equal(x.email,0);
x=await draftBoundary("enforced","uncertain");assert.equal(x.reply,"ok");
x=await draftBoundary("enforced","valid",{limited:true});assert.equal(x.reply,"draft_rate_limited");assert.equal(x.provider.calls,0);
// Draft finalization consumes server-owned payload only and performs no second semantic orchestration.
const stored={targetRole:"QA",relevantExperience:"Stored server value"};const browser={targetRole:"Injected browser value"};assert.notDeepEqual(stored,browser);assert.equal(stored.targetRole,"QA");
for(const [mode,result,blocked] of [["off","invalid",false],["shadow","invalid",false],["enforced","invalid",true],["enforced","uncertain",false]]){const p=fake(result);const d=await s.orchestrateSemanticValidation(profile,{repository:repo(mode),provider:p,cacheHmacSecret:"x"});assert.equal(Boolean(d.blockedFieldKeys.length),blocked);if(mode==="off")assert.equal(p.calls,0);}
const profileSource=await readFile("src/components/CareerProfile.jsx","utf8");const gatewaySql=await readFile("supabase/career_profile_semantic_gateway_phase_2_review.sql","utf8");
assert.match(profileSource,/functions\.invoke\("save-career-profile"/);assert.doesNotMatch(gatewaySql,/revoke all on function public\.save_my_career_profile/);assert.match(gatewaySql,/grant execute on function public\.save_career_profile_from_semantic_gateway[^\n]+to service_role/);assert.match(gatewaySql,/public\.career_profiles\.profile_data \|\| v_known/);
const eligibilityBundle=await build({entryPoints:[path.resolve("supabase/functions/_shared/careerProfileEligibility.ts")],bundle:true,format:"esm",platform:"node",write:false});const eligibilityFile=path.join(dir,"eligibility.mjs");await writeFile(eligibilityFile,eligibilityBundle.outputFiles[0].text);const {hasAcceptedCareerProfileAccess}=await import(pathToFileURL(eligibilityFile).href);
let semanticCalls=0;const denied=await hasAcceptedCareerProfileAccess({from(){return {select(){return this},eq(){return this},limit(){return this},async maybeSingle(){return {data:null,error:null}}}}},"verified-user");assert.equal(denied,false);assert.equal(semanticCalls,0,"non-accepted users are denied before semantic orchestration");
await rm(dir,{recursive:true,force:true});console.log("application/profile semantic integration contracts: PASS");
