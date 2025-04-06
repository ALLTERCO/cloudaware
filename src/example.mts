/*
var ca=require('./index.js')();
console.log(ca);
if (ca.metadata.cloud_domain) {
	console.log("update dns so "+ca.instance_nm+'.'+ca.metadata.cloud_domain+'='+ca.extip);
	ca.update_dns(ca.instance_nm+'.'+ca.metadata.cloud_domain,ca.extip);
}
*/
import {cloudaware_init} from './index.mjs';
let inst=cloudaware_init();
if (inst==undefined){
	console.error("failed to init any tech?!")
	process.exit(-1);
}
console.log(`inst:${inst.instance_nm} local_ip:${inst.localip} ext_ip:${inst.extip} tech:${inst.cloudtech}`);
if (inst.update_dns("omg.example.com",inst.extip,5000)==false){
	console.log("update_dns failed, as expected!");
} else {
	console.log("update_dns suceeded  UNexpectedly!");
};

if (inst.update_dns("sdr.mini.shelly.cloud",inst.extip,5000)==false){
	console.log("update_dns failed UNexpectedly!");
} else {
	console.log("update_dns suceeded, as expected!");
};

process.exit(0);