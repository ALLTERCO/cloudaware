'use strict';
const cp=require('child_process');
var inst_data;
var proj_data;
module.exports={
	tech:"gcloud",
	detect:function(){
		return true;
	},
	get_extip:function(info){
		if (!info.localips || !(info.localips instanceof Array)) return '';
		
		
		let inst=cp.execSync("gcloud --format=json  compute instances list").toString();
		
		inst=JSON.parse(inst);
		for (let ii in inst) if (inst.hasOwnProperty(ii)) {
			let i=inst[ii];
			if (i.status!='RUNNING') continue;
			for (let ni of i.networkInterfaces){
				for (let lip of info.localips) if (lip==ni.networkIP) {
					inst_data=i;
					for (let ac of  ni.accessConfigs) {
						if (ac.natIP) return ac.natIP;
					}
				}
			}
		}
		return '';
	},
	get_metadata:function(info){
		let proj=cp.execSync("gcloud --format=json compute project-info  describe").toString();
		proj=JSON.parse(proj);
		let md={};
		if (proj && proj.commonInstanceMetadata && proj.commonInstanceMetadata.items) for (let i of proj.commonInstanceMetadata.items) {
			if(i.key=='sshKeys') continue;
			md[i.key]=i.value;
		}
		if (inst_data && inst_data.metadata && inst_data.metadata.items) for (let i of inst_data.metadata.items) {
			md[i.key]=i.value;
		}
		return md;
	}
}
