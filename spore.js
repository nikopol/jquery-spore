// SPoRE - jQuery port
// niko@rtgi

var spore = {
	
	log: function(){};
		
	debug: function(state){
		if(state) {
			if(window.console && window.console.debug) //firebug
				spore.log=window.console.debug;
			else if(window.console && window.console.log) //safari
				spore.log=window.console.log;
			else if(console && console.log) //chrome
				spore.log=console.log;
			else if(opera && opera.postError) //opera
				spore.log=opera.postError;
			else
				spore.log=alert;
		} else
			spore.log=function(){};
	},

	create: function(spec,over) {
		if(typeof(spec)=='string') {
			if(/^http:\/\//i.test(spec)) {
				//todo: spec cache
				if(!spec.callback) throw "your must provide a callback with a spec over http";
				$.get(spec,function(data){ 
					spec.callback( spore.create(data,over) ); 
				});
				return true;
			} else
				spec=$.parseJSON(spec);
		} else if(typeof(spec)!='object')
			throw "wrong spore creation parameters";

		if(over) spec=$.extend(spec,over);
		return new spore.api(spec);
	},

	new_from_string: function(spec,over) { return spore.create(spec,over); },
	new_from_spec: function(spec,over) { return spore.create(spec,over); },

	api: function(spec,widgets) {
		if(!spec.api_base_url) throw 'parameter api_base_url missing';
		this.spec=$.extend({
			api_format: 'json',
			authentication: false,
			name: 'unknow',
			version: '?.?',
		}, spec);
		this.widgets=[];
	
		spore.log('spore init api '+this.spec.name+' v'+this.spec.version);
	
		//create methods
		for(var fn as this.spec.methods) {
			var m=this.spec.methods[fn];
			if(m.path[0]=='/') m.path=m.path.substr(1);
			m.method||='GET';
			m.params||=[];
			this[fn]=function(params,onsuccess,onerror) {
				return this._call(fn,params,onsuccess,onerror);
			};
			console.log('spore: '+this.spec.name+'.'+fn+' created');
		}
	},
	
	widgets: {},
};

spore.api.prototype._call=function(fn,params,onsuccess,onerror) {
	var method=this.spec.methods[fn]
	var url=this.spec.api_base_url+method.path;
	//manage path params
	for(var n=0; n<method.required.length; ++n) {
		var p=method.required[n];
		if(typeof(params[p])=='undefined') throw 'param '+p+' missing';
		url=url
			.replace('/\:'+p+'\//g', params[p]+'/')
			.replace('/\:'+p+'$/g', params[p]);
	}
	//manage url params
	var args={};
	for(var n=0; n<method.params.length; ++n) {
		var p=method.params[n];
		if(typeof(params[p])!='undefined') args[p]=params[p];
	}
	
	
	;
	//call widgets
	for(var n=0; n<this.widgets.length; n++) {
		var w=this.widgets[n];
		try {
			var o=w.call(req);
			if(o===false) {
				spore.log('spore.'+w.name+' returned false, call stopped!');
				return false;
			} else if(typeof(o)=='function') {
				spore.log('spore.'+w.name+' returned a callback');
				w.callback=o;
			} else {
				spore.log('spore.'+w.name+' returned '+o);
			}
		} catch(e) {
			spore.log('spore.'+w.name+' error! => '+e);
		}
	}
	//webservice's call
	spore.log('spore.'+method.name+'] call '+url);
	$.ajax({
		url: url,
		type: method.method,
		data: args,
		contentType: this.api_format,
		success: function(data,status,req) {
			console.log('spore: '+this.spec.name+':'+method.name+'] return '+status);
			for(var n=this.widgets.length-1; n>=0; --n) {
				var w=this.widgets[n];
				if(w.callback) {
					try {
						var r=w.callback(data,req);
						spore.log('spore.'+w.name+' callback returned '+r);	
					} catch (e) {
						spore.log('spore.'+w.name+' callback error! => '+e);
					}
					delete w.callback;
				}
			}
			if(onsuccess) onsuccess(data);
		},
		error: function(req,status,err) {
			console.log('spore: '+this.spec.name+':'+method.name+'] return '+status);
			if(onerror) onerror(err,status,req);
		}
	});
	return true;
}

spore.api.prototype.enable=function(widgetname,params) {
	if(!spore.widgets[widgetname]) throw 'widget '+widgetname+' not found/loaded';
	this.widgets.push({
		name: widgetname,
		obj: new spore.widgets[widgetname](params)
	});
	return this;
}
