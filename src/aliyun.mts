
import  cp from  'child_process';
import  fs from 'fs';
import type { cloudaware_t, RemoveIndex } from './types.mts';

let aliyun_bin='N/A';
export const tech_name='aliyun';

export function detect (){
	//give a chance for wrapping:
	if (fs.existsSync('/usr/local/bin/aliyun')) {
		aliyun_bin='/usr/local/bin/aliyun';
		return true;
	}
	//default location
	if (fs.existsSync('/usr/bin/aliyun')) {
		aliyun_bin='/usr/bin/aliyun';
		return true;
	}
	//user installed?!
	const home=process.env['HOME'];
	if (home) {
		if (fs.existsSync(home+'/bin/aliyun')) {
			aliyun_bin=home+'/bin/aliyun';
			return true;
		}
	}
	return false;
}

interface networkInterface_t {
	PrimaryIpAddress:string;
}

function is_networkInterface(o:any) :o is networkInterface_t {
	return (
		o && typeof(o) == 'object'
		&& typeof((o as networkInterface_t).PrimaryIpAddress)=='string'
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


export interface aliyun_inst_data_t extends Record<string,unknown>{
	InstanceName:string;
	NetworkInterfaces:{NetworkInterface:networkInterface_t[]};
	VpcAttributes: { VpcId: string},
	PublicIpAddress: { IpAddress: string[]},

	networkInterface:networkInterface_t;
	metadata:metadata_t;
	
	domains?:Array<domain_info_t>;

}
type _aliyun_inst_data_t=RemoveIndex<aliyun_inst_data_t>


export function get_inst_data (inst:cloudaware_t):Record<string,unknown>|undefined{
	if (inst.cloudtech==tech_name &&  inst.tech_inst_data!=undefined) return inst.tech_inst_data;
	if (!inst.localips || !(inst.localips instanceof Array)) return undefined;

	let insts_str=cp.execSync(aliyun_bin+" ecs DescribeInstances \'--PrivateIpAddresses="+JSON.stringify(inst.localips)+"\' ",{maxBuffer:2000000}).toString();

	let insts_info=JSON.parse(insts_str);
	if (insts_info && typeof(insts_info)=='object' && typeof(insts_info['Instances'])=='object' && insts_info['Instances']){
		insts_info=insts_info['Instances']['Instance'];
	}
	if (!Array.isArray(insts_info)) return undefined;
	for (let i of insts_info) {
		//console.log("===================INSTANCE=======================\n"+JSON.stringify(i,null,2));
		if (!i || typeof(i)!='object') continue;
		if (i.Status!='Running') continue;
		if (typeof((i as _aliyun_inst_data_t).InstanceName)!='string') continue;
		if (typeof((i as _aliyun_inst_data_t).VpcAttributes)!='object' || !(i as _aliyun_inst_data_t).VpcAttributes) continue;
		if (typeof((i as _aliyun_inst_data_t).VpcAttributes.VpcId)!='string') continue;
		if (typeof((i as _aliyun_inst_data_t).PublicIpAddress)!='object' || !(i as _aliyun_inst_data_t).PublicIpAddress) continue;
		if (!Array.isArray((i as _aliyun_inst_data_t).PublicIpAddress.IpAddress) || (i as _aliyun_inst_data_t).PublicIpAddress.IpAddress.length<1) continue;

		let nis=(i as _aliyun_inst_data_t).NetworkInterfaces as unknown;
		if (nis && typeof(nis)=='object') {
			nis=(i as _aliyun_inst_data_t).NetworkInterfaces.NetworkInterface;
		}
		if (!is_networkInterface_arr(nis)) continue;
		for (let ni of nis){
			for (let lip of inst.localips) if (lip==ni.PrimaryIpAddress) {
				const inst_data=i as aliyun_inst_data_t;
				inst_data.networkInterface=ni;
				return inst_data ;
			}
		}
	}
	return undefined;

}

export function instance_nm(inst:cloudaware_t):string {
	if (inst.cloudtech==tech_name && inst.instance_nm!=undefined) return inst.instance_nm;
	const inst_data=inst.tech_inst_data as _aliyun_inst_data_t;

	return inst_data.InstanceName;
}

export function extip(inst:cloudaware_t):string{
	if (inst.cloudtech==tech_name && inst.extip!=undefined) return inst.extip;
	const inst_data=inst.tech_inst_data as _aliyun_inst_data_t;

	if (Array.isArray(inst_data.PublicIpAddress.IpAddress) &&  typeof(inst_data.PublicIpAddress.IpAddress[0])=='string' ) {
		
		return inst_data.PublicIpAddress.IpAddress[0];
		
	}

	return '';
}

export function metadata(inst:cloudaware_t):Record<string,unknown>{
	if (inst.cloudtech==tech_name && inst.metadata!=undefined) return inst.metadata;

	let proj_str=cp.execSync(aliyun_bin+" vpc DescribeTags").toString();
	
	let proj:Record<string,unknown>=JSON.parse(proj_str);

	let md={} as Record<string,string>;
	if (proj &&  typeof(proj)=='object' 
		&& proj['TagResources'] && typeof(proj['TagResources'])=='object'
		&& Array.isArray((proj['TagResources'] as any)['TagResource'])
	) for (let i of (proj['TagResources']as any)['TagResource'] as {TagKey:string,TagValue:string}[]) {
		if (i && typeof(i)=='object') {
			if (typeof(i.TagKey)=='string' && typeof(i.TagValue)=='string')
			//if(i.TagKey=='sshKeys') continue;
			md[i.TagKey]=decodeURIComponent(i.TagValue);
		}
	}


	return md;

}

interface domain_info_t {
	DomainName: string,
	AliDomain: boolean,
	DomainId:string;
};
function is_domain_info (o:any):o is domain_info_t {
	return (
		o && typeof(o)=='object'
		&& typeof ((o as domain_info_t).DomainName)=='string'
		&& typeof ((o as domain_info_t).AliDomain)=='boolean'
		&& typeof ((o as domain_info_t).DomainId)=='string'

	)
}
function is_domain_info_arr(a:any):a is Array<domain_info_t>{
	if (Array.isArray(a)){
		for (let o of a) if (!is_domain_info(o)) return false;
		return true;
	} else {
		return false;
	}
}

function get_domains_data(inst:_aliyun_inst_data_t):Array<domain_info_t> {
	if (inst.domains) return inst.domains;
	let ddata=JSON.parse(cp.execSync(aliyun_bin+" alidns DescribeDomains").toString());
	if (
		ddata && typeof(ddata)=='object'
		&& ddata["Domains"] && typeof(ddata["Domains"])=='object'
		&& is_domain_info_arr( ddata["Domains"]["Domain"])
	){
		inst.domains=ddata["Domains"]["Domain"];
		return inst.domains;
	}
	throw new Error("failed to get aliyun domains");

}

function get_zonename(inst:_aliyun_inst_data_t,domain:string):string|undefined {
	
	let domains=get_domains_data(inst);
	let bestzone:domain_info_t|undefined=undefined;

	for (let xdom of domains) {
		if (xdom.DomainName==domain) return xdom.DomainName;
		if (domain.endsWith('.'+xdom.DomainName)) {
			if (bestzone===undefined) {
				bestzone=xdom;
			} else {
				if (xdom.DomainName.length>bestzone.DomainName.length){
					bestzone=xdom;
				}
			}
		}
	}

	return bestzone?.DomainName;
}

/*
sdr@sdr-lt:~/projects/instseed$ aliyun alidns DescribeDomains
{
	"Domains": {
		"Domain": [
				{
					"AliDomain": true,
					"CreateTime": "2025-02-26T00:16Z",
					"CreateTimestamp": 1740528973292,
					"DnsServers": {
							"DnsServer": [
									"dns25.hichina.com",
									"dns26.hichina.com"
							]
					},
					"DomainId": "454e69f5fb0746a5910629e61f5e95d0",
					"DomainLoggingSwitchStatus": "CLOSE",
					"DomainName": "shelly.asia",
					"PunyCode": "shelly.asia",
					"RecordCount": 6,
					"ResourceGroupId": "rg-acfm3iuff43vduq",
					"Starmark": false,
					"Tags": {
							"Tag": []
					},
					"VersionCode": "mianfei",
					"VersionName": "Alibaba Cloud DNS"
				},
				{

*/

export function update_dns(this:cloudaware_t, name:string,ip:string,ttl:number|undefined):boolean{
	if (this.cloudtech!=tech_name ) return false;
	const inst_data=this.tech_inst_data as _aliyun_inst_data_t;

	let parts=name.split('.');
	if (parts.length<2) return false;
	parts.splice(0,1);
	let domain=parts.join('.');
	let zone=get_zonename(inst_data,domain);
	if (!zone) return false;
	let rr=name.substring(0,name.length-zone.length-1);
	console.log("update_dns: name:"+name+" selected zone:"+zone+' rr:'+rr);
	if (ttl===undefined) ttl=300;

	let dns_records=JSON.parse(cp.execSync(aliyun_bin+" alidns DescribeDomainRecords --DomainName "+zone+" --Type A --RRKeyWord "+rr,{maxBuffer:20000000}).toString());
	if (!dns_records || typeof(dns_records)!='object') return false;
	dns_records=dns_records['DomainRecords'];
	if (!dns_records || typeof(dns_records)!='object') return false;
	dns_records=dns_records['Record'];
	if (!Array.isArray(dns_records)) return false;

	for (let r of dns_records) if (r && typeof(r)=='object' && r.RR==rr) { //name found
		if (ip===r.Value && ttl===r.TTL) { //no update needed!
			console.log("update_dns no update needed!");
			return true;
		}
		const rid=r.RecordId;
		if (typeof(rid)!='string' || r.Type!=='A') return false;

		//console.log(`must update as values differ! ip(${ip})<===>r.Value(${r.Value}) ttl(${ttl})<===>r.Value(${r.TTL}) rid:${rid}`);
		
		try {
			let dns_update_res=JSON.parse(cp.execSync(aliyun_bin+" alidns UpdateDomainRecord --RecordId "+rid+" --Type A --RR "+rr+" --Value "+ip+" --TTL "+ttl,{maxBuffer:20000000}).toString());
			//console.log("UpdateDomainRecord res:"+JSON.stringify(dns_update_res));
			return (
				dns_update_res && typeof(dns_update_res)=='object'
				&& dns_update_res.RecordId==rid
			)
		} catch(err) {
			console.log("aliyun UpdateDomainRecord got err:",err);
			return false;
		}
	

	}
	//pure create
	
	try {
		let dns_addrec_res=JSON.parse(cp.execSync(aliyun_bin+" alidns AddDomainRecord --DomainName "+zone+" --Type A --RR "+rr+" --Value "+ip+" --TTL "+ttl,{maxBuffer:20000000}).toString());
		console.log("AddDomainRecord res:"+JSON.stringify(dns_addrec_res));
		return (
			dns_addrec_res && typeof(dns_addrec_res)=='object'
		)
	} catch(err) {
		console.log("aliyun AddDomainRecord got err:",err);
		return false;
	}
}
