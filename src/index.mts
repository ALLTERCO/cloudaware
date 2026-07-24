import cp from 'child_process';

import type {cloudaware_t} from './types.mts'
import {
	detect as gcloud_detect,
	get_inst_data as gcloud_get_inst_data,
	instance_nm as gcloud_instance_nm,
	extip as gcloud_extip,
	metadata as gcloud_metadata,
	update_dns as gcloud_update_dns,
	tech_name as gcloud_tech_name,
} from './gcloud.mjs'

import {
	detect as aliyun_detect,
	get_inst_data as aliyun_get_inst_data,
	
	instance_nm as aliyun_instance_nm,
	extip as aliyun_extip,
	metadata as aliyun_metadata,
	update_dns as aliyun_update_dns,
	tech_name as aliyun_tech_name,
} from './aliyun.mjs'


function get_localips():string[]{
	let res=cp.execSync("ip -o -4   addr show up  |grep -o  'inet [^/]*' | cut -f2 -d' ' | grep -F -v 127.0.0.1").toString("utf-8");

	return res.substring(0,res.length-1).split("\n");

}

export function cloudaware_init(localips?:string[]):cloudaware_t|undefined{
	let inst={} as cloudaware_t;
	if (localips==undefined) localips = get_localips();

	inst.localips=localips;
	inst.localip=localips[0];




	if (gcloud_detect()){
		inst.cloudtech=gcloud_tech_name;
		let inst_data=gcloud_get_inst_data(inst);
		if (inst_data==undefined) return undefined;
		inst.tech_inst_data=inst_data;
		inst.instance_nm=gcloud_instance_nm(inst);
		inst.extip=gcloud_extip(inst);
		inst.metadata=gcloud_metadata(inst);
		inst.update_dns=gcloud_update_dns.bind(inst);

		return inst;
	}

	if (aliyun_detect()){
		inst.cloudtech=aliyun_tech_name;
		let inst_data=aliyun_get_inst_data(inst);
		if (inst_data==undefined) return undefined;
		inst.tech_inst_data=inst_data;
		inst.instance_nm=aliyun_instance_nm(inst);
		inst.extip=aliyun_extip(inst);
		
		inst.metadata=aliyun_metadata(inst);
		inst.update_dns=aliyun_update_dns.bind(inst);
		return inst;
	}

	return undefined;
}


