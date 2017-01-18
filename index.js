'use strict'
var cached_result;
var helpers={
	gcloud:require('./gcloud.js')
};

const EventEmitter = require('events');
const cp=require('child_process');


function detect_change_and_set(k,v){
	if (!cached_result[k] || cached_result[k]!=v){
		cached_result[k]=v;
		return true;
	} else return false;
};

function detect_change_and_set_obj(k,v){
	if (typeof(v) != 'string') v=JSON.stringify(v);
	if (!cached_result[k] || JSON.stringify(cached_result[k])!=v){
		cached_result[k]=JSON.parse(v);
		return true;
	} else return false;
}
function get_cloudtech() {
	if (helpers.gcloud.detect()) return 'gcloud';
}

function get_localips(){
	let res=cp.execSync("ip -o -4   addr show up  |grep -o  'inet [^/]*' | cut -f2 -d' ' | fgrep -v 127.0.0.1");
	res=res.toString();
	res=res.substr(0,res.length-1).split("\n");
	return res;
}
function populate_cache() {
	let change=false;
	if (detect_change_and_set('cloudtech',get_cloudtech())) change=true;
	if (cached_result.cloudtech=='unknown') {
		if (cached_result.extip) delete cached_result.extip;
		if (cached_result.tech_helper) delete cached_result.tech_helper;
		return change;
	}
	cached_result.tech_helper=helpers[cached_result.cloudtech];
	if (detect_change_and_set('localips',get_localips())) change=true;
	if (detect_change_and_set('extip',cached_result.tech_helper.get_extip(cached_result))) change=true;
	if (detect_change_and_set_obj('metadata',cached_result.tech_helper.get_metadata(cached_result))) change=true;
	
	
	return change;
}
module.exports=function(options){
	if ( (!options || !options.recheck ) && cached_result) return cached_result;
	
	if (!cached_result) cached_result = new EventEmitter ();
	
	if (populate_cache()) cached_result.emit('change');
	return cached_result;
}
