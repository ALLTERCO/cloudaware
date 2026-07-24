import type { gcloud_inst_data_t } from "./gcloud.mts";
import type { aliyun_inst_data_t } from "./aliyun.mts";

export interface cloudaware_t{
	cloudtech:string;
	localip:string;
	localips:string[];
	extip:string;
	metadata:Record<string,unknown>
	instance_nm:string;

	update_dns(this:cloudaware_t, name:string, ip:string, ttl:number ):boolean;
	tech_inst_data:Record<string,unknown>| gcloud_inst_data_t|aliyun_inst_data_t ;
}

//thank you  https://stackoverflow.com/a/68261113
export type RemoveIndex<T> = {
	[K in keyof T as {} extends Record<K, 1> ? never : K]: T[K]
}