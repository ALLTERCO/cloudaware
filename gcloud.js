'use strict';
const cp=require('child_process');
const fs=require('fs');
var inst_data;
var proj_data;
var gcloud_bin;
var zones;
module.exports={
	tech:"gcloud",
	detect:function(){
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
	},
	
	get_inst_data:function(info){
		if (inst_data) return inst_data;
		if (!info.localips || !(info.localips instanceof Array)) return undefined;
		let inst=cp.execSync(gcloud_bin+" --format=json  compute instances list",{maxBuffer:2000000}).toString();
		
		inst=JSON.parse(inst);
		for (let i of inst) {
			if (i.status!='RUNNING') continue;
			for (let ni of i.networkInterfaces){
				for (let lip of info.localips) if (lip==ni.networkIP) {
					inst_data=i;
					inst_data.networkInterface=ni;
					return inst_data;
				}
			}
		}
		return undefined;

	},
	get_extip:function(info){
		if (this.get_inst_data(info)===undefined) return '';
		
		
		for (let ac of  inst_data.networkInterface.accessConfigs) {
			if (ac.natIP) return ac.natIP;
		}
		
		return '';
	},
	instance_nm:function(info){
		if (this.get_inst_data(info)===undefined) return '';
		return inst_data.name;
	},
	
	get_metadata:function(info){
		let proj=cp.execSync(gcloud_bin+" --format=json compute project-info  describe").toString();
		proj=JSON.parse(proj);
		let md={};
		if (proj && proj.commonInstanceMetadata && proj.commonInstanceMetadata.items) for (let i of proj.commonInstanceMetadata.items) {
			if(i.key=='sshKeys') continue;
			md[i.key]=i.value;
		}
		if (this.get_inst_data(info)===undefined) return md;
		if (inst_data && inst_data.metadata && inst_data.metadata.items) for (let i of inst_data.metadata.items) {
			md[i.key]=i.value;
		}
		return md;
	},
	get_zones_data() {
		if (zones) return zones;
		zones=JSON.parse(cp.execSync(gcloud_bin+" --format=json dns  managed-zones list").toString());
	},
	get_zonename(domain) {
		if (domain[domain.length-1]!='.') domain=domain+'.';
		this.get_zones_data();
		let bestzone=undefined;
		let bestzdnsname=undefined;
		for (let zone of zones) {
			if (zone.dnsName==domain) return zone.name;
			if (domain.endsWith('.'+zone.dnsName)) {
				if (bestzone===undefined) {
					bestzone=zone.name;
					bestzdnsname=zone.dnsName;
				} else {
					if (zone.dnsName>bestzdnsname){
						bestzone=zone.name;
						bestzdnsname=zone.dnsName;
					}
				}
			}
		}

		return bestzone;
	},

	update_dns:function(info,name,ip,ttl) {
		let parts=name.split('.');
		if (parts.length<2) return false;
		let domain=name.substr((parts[0].length+1)-name.length);
		let zone=this.get_zonename(domain);
		if (!zone) return false;

		ttl=parseInt(ttl,10);
		if (!ttl) ttl=300;

		if (name[name.length-1]!='.') name=name+'.';
		var dns_records=JSON.parse(cp.execSync(gcloud_bin+" --format=json dns  record-sets  list --filter='type=\"A\" AND kind=\"dns#resourceRecordSet\"' '--zone="+zone+"'").toString());
		for (let r of dns_records) if (r.name==name) { //name found
			var cur_extips='';
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
}
