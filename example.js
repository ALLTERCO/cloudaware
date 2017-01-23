'use strict'
var ca=require('./index.js')();
console.log(ca);
if (ca.metadata.cloud_domain) {
	console.log("update dns so "+ca.instance_nm+'.'+ca.metadata.cloud_domain+'='+ca.extip);
	ca.update_dns(ca.instance_nm+'.'+ca.metadata.cloud_domain,ca.extip);
}
