
import  cp from  'child_process';
import  fs from 'fs';
import { cloudaware_t } from './types.mjs';

let gcloud_bin='N/A';
export const tech_name='gcloud';

export function detect (){
	//give a chance for wrapping:
	if (fs.existsSync('/usr/local/bin/gcloud')) {
		gcloud_bin='/usr/local/bin/gcloud';
		return true;
	}
	//the "proper" location
	if (fs.existsSync('/usr/lib/google-cloud-sdk/bin/gcloud')) {
		gcloud_bin='/usr/lib/google-cloud-sdk/bin/gcloud';
		return true;
	}
	//the new "proper" location
	if (fs.existsSync('/snap/bin/gcloud')) {
		gcloud_bin='/snap/bin/gcloud';
		return true;
	}

	//just to make sure..
	if (fs.existsSync('/usr/bin/gcloud')) {
		gcloud_bin='/usr/bin/gcloud';
		return true;
	}
	if (fs.existsSync('/bin/gcloud')) {
		gcloud_bin='/bin/gcloud';
		return true;
	}
	return false;
}

interface networkInterface_t extends Record<string,unknown>{
	networkIP:string;
	accessConfigs?:Array<{natIP?:string}>
}

function is_networkInterface(o:any) :o is networkInterface_t {
	return (
		o && typeof(o) == 'object'
		&& typeof((o as networkInterface_t).networkIP)=='string'
	)
}
function is_networkInterface_arr(a:any) :a is networkInterface_t[] {
	if (Array.isArray(a)){
		for (let o of a) if (!is_networkInterface(o)) return false;
		return true;
	}
	return false;
}

interface metadata_t {
	items:Array<{key:string,value:string}>
}

function is_metadata(o:any) :o is metadata_t {
	if  (
		o && typeof(o) == 'object'
		&& Array.isArray((o as metadata_t).items)
	) {
		for (let i of (o as metadata_t).items) {
			if (
				i && typeof(i)=='object'
				&& typeof (i.key)=='string'
				&& typeof (i.value)=='string'
			) continue;

			return false;
		}
		return true;
	}
	return false;
}


export interface gcloud_inst_data_t extends Record<string,unknown>{
	name:string;
	networkInterfaces:networkInterface_t[];
	networkInterface:networkInterface_t;
	metadata:metadata_t;
	zones?:Array<gcloud_zone_info_t>;

}

export function get_inst_data (inst:cloudaware_t):Record<string,unknown>|undefined{
	if (inst.cloudtech==tech_name &&  inst.tech_inst_data!=undefined) return inst.tech_inst_data;
	if (!inst.localips || !(inst.localips instanceof Array)) return undefined;
	let insts_str=cp.execSync(gcloud_bin+" --format=json  compute instances list",{maxBuffer:2000000}).toString();

	let insts_info=JSON.parse(insts_str);
	if (!Array.isArray(insts_info)) return undefined;
	for (let i of insts_info) {
		if (!i || typeof(i)!='object') continue;
		if (i.status!='RUNNING') continue;
		if (typeof((i as gcloud_inst_data_t).name)!='string') continue;
		let nis=(i as gcloud_inst_data_t).networkInterfaces;
		if (!is_networkInterface_arr(nis)) continue;
		for (let ni of nis){
			for (let lip of inst.localips) if (lip==ni.networkIP) {
				const inst_data=i as gcloud_inst_data_t;
				inst_data.networkInterface=ni;
				return inst_data ;
			}
		}
	}
	return undefined;

}

export function instance_nm(inst:cloudaware_t):string {
	if (inst.cloudtech==tech_name && inst.instance_nm!=undefined) return inst.instance_nm;
	const inst_data=inst.tech_inst_data as gcloud_inst_data_t;

	return inst_data.name;
}

export function extip(inst:cloudaware_t):string{
	if (inst.cloudtech==tech_name && inst.extip!=undefined) return inst.extip;
	const inst_data=inst.tech_inst_data as gcloud_inst_data_t;

	if (Array.isArray(inst_data.networkInterface.accessConfigs)) {
		for (let ac of  inst_data.networkInterface.accessConfigs) {
			if (typeof(ac.natIP)=='string') return ac.natIP;
		}
	}

	return '';
}

export function metadata(inst:cloudaware_t):Record<string,unknown>{
	if (inst.cloudtech==tech_name && inst.metadata!=undefined) return inst.metadata;
	let proj_str=cp.execSync(gcloud_bin+" --format=json compute project-info  describe").toString();
	let proj:Record<string,unknown>=JSON.parse(proj_str);
	let md={} as Record<string,string>;
	if (proj && proj.commonInstanceMetadata && is_metadata(proj.commonInstanceMetadata)) for (let i of proj.commonInstanceMetadata.items) {
		if(i.key=='sshKeys') continue;
		md[i.key]=i.value;
	}

	const inst_data=inst.tech_inst_data as gcloud_inst_data_t;

	if (inst_data && inst_data.metadata && inst_data.metadata.items) for (let i of inst_data.metadata.items) {
		md[i.key]=i.value;
	}
	return md;

}

interface  gcloud_zone_info_t {
	dnsName: string,
	name: string,
};
function is_gcloud_zone_info (o:any):o is gcloud_zone_info_t {
	return (
		o && typeof(o)=='object'
		&& typeof ((o as gcloud_zone_info_t).dnsName)=='string'
		&& typeof ((o as gcloud_zone_info_t).name)=='string'
	)
}
function is_gcloud_zone_info_arr(a:any):a is Array<gcloud_zone_info_t>{
	if (Array.isArray(a)){
		for (let o of a) if (!is_gcloud_zone_info(o)) return false;
		return true;
	} else {
		return false;
	}
}

function get_zones_data(inst:gcloud_inst_data_t):Array<gcloud_zone_info_t> {
	if (inst.zones) return inst.zones;
	inst.zones=JSON.parse(cp.execSync(gcloud_bin+" --format=json dns  managed-zones list").toString());
	if (!is_gcloud_zone_info_arr(inst.zones)){
		throw new Error("failed to get gcloud zones");
	}
	return inst.zones;
}

function get_zonename(inst:gcloud_inst_data_t,domain:string):string|undefined {
	if (domain[domain.length-1]!='.') domain=domain+'.';
	let zones=get_zones_data(inst);
	let bestzone:gcloud_zone_info_t|undefined=undefined;

	for (let zone of zones) {
		if (zone.dnsName==domain) return zone.name;
		if (domain.endsWith('.'+zone.dnsName)) {
			if (bestzone===undefined) {
				bestzone=zone;
			} else {
				if (zone.dnsName.length>bestzone.dnsName.length){
					bestzone=zone;
				}
			}
		}
	}

	return bestzone?.name;
}

export function update_dns(this:cloudaware_t, name:string,ip:string,ttl:number|undefined):boolean{
	if (this.cloudtech!=tech_name ) return false;
	const inst_data=this.tech_inst_data as gcloud_inst_data_t;

	let parts=name.split('.');
	if (parts.length<2) return false;
	parts.splice(0,1);
	let domain=parts.join('.')+'.';
	let zone=get_zonename(inst_data,domain);
	if (!zone) return false;
	console.log("update_dns: name:"+name+" selected zone:",zone);
	if (ttl===undefined) ttl=300;

	if (name[name.length-1]!='.') name=name+'.';
	let dns_records=JSON.parse(cp.execSync(gcloud_bin+" --format=json dns  record-sets  list --filter='type=\"A\" AND kind=\"dns#resourceRecordSet\"' '--zone="+zone+"'",{maxBuffer:20000000}).toString());
	if (!Array.isArray(dns_records)) return false;
	for (let r of dns_records) if (r.name==name) { //name found
		let cur_extips='';
		for (let rip of r.rrdatas) {
			cur_extips=(cur_extips==''?'':cur_extips+' ')+"'"+rip+"'";
			if (ip==rip && ttl==r.ttl) { //no update needed!
				console.log("update_dns no update needed!");
				return true;
			}
		}
		//no ip match must update:
		let script=
			gcloud_bin+" dns record-sets transaction start   '-z="+zone+"' ; "+
			gcloud_bin+" dns record-sets transaction remove  '-z="+zone+"' '--name="+name+"' --type=A --ttl="+r.ttl+" "+cur_extips+" ; "+
			gcloud_bin+" dns record-sets transaction add     '-z="+zone+"' '--name="+name+"' --type=A --ttl="+ttl+" '"+ip+"' ; "+
			gcloud_bin+" dns record-sets transaction execute '-z="+zone+"' "
		;
		//console.log("update_dns update script:"+script);
		cp.execSync(script);
		return true;
	}
	//pure create
	let script=
		gcloud_bin+" dns record-sets transaction start   '-z="+zone+"' ; "+
		gcloud_bin+" dns record-sets transaction add     '-z="+zone+"' '--name="+name+"' --type=A --ttl="+ttl+" '"+ip+"' ; "+
		gcloud_bin+" dns record-sets transaction execute '-z="+zone+"' "
	;
	//console.log("update_dns create script:"+script);
	cp.execSync(script);
	return true;
}
