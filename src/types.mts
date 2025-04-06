import { gcloud_inst_data_t } from "./gcloud.mjs";

export interface cloudaware_t{
	cloudtech:string;
	localip:string;
	localips:string[];
	extip:string;
	metadata:Record<string,unknown>
	instance_nm:string;

	update_dns(this:cloudaware_t, name:string, ip:string, ttl:number ):boolean;
	tech_inst_data:Record<string,unknown>| gcloud_inst_data_t /* | aws_insta_data_t | .. */ ;
}
