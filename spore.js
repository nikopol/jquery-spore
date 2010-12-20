// SPoRE - jQuery port
// niko@rtgi

var spore = {
	
	log: function(){},
		
	debug: function(state) {
		if(state) {
			var pfx='[spore] ';
			if(window.console && window.console.debug) //firebug
				spore.log=function(m){ window.console.debug(pfx+m); };
			else if(window.console && window.console.log) //safari
				spore.log=function(m){ window.console.log(pfx+m); };
			else if(console && console.log) //chrome
				spore.log=function(m){ console.log(pfx+m); };
			else if(opera && opera.postError) //opera
				spore.log=function(m){ opera.postError(pfx+m); };
		} else
			spore.log=function(){};
	},

	create: function(spec,callback,over) {
		if(typeof(spec)=='string') {
			if(/^\s*{/.test(spec)) 
				spec=$.parseJSON(spec);
			else {
				//todo: spec cache
				if(!callback) throw "your must provide a callback with a spec over http";
				$.get(spec,function(data){ spore.create(data,callback,over) }); 
				return true;
			}
		} else if(typeof(spec)!='object')
			throw "wrong spore creation parameters";

		if(over) spec=$.extend(spec,over);
		var a=new spore.api(spec);
		if(callback) callback(a);
		return a;
	},

	api: function(spec,widgets) {
		if(!spec.base_url) throw 'parameter base_url missing';
		if(!/https?\:\/\//i.test(spec.base_url)) spec.base_url='http://'+spec.base_url;
		spec.base_url.replace(/\/$/,'');
		this.spec=$.extend({
			api_format: 'json',
			authentication: false,
			name: 'unknow',
			version: '?.?',
		}, spec);
		this.widgets=[];
	
		spore.log('spore init api '+this.spec.name+' v'+this.spec.version);
	
		//create methods
		var self=this;
		var wrapfn=function(fn){
			return function(params,onsuccess,onerror){
				self._call(fn,params,onsuccess,onerror);
			};
		};
		for(var fn in this.spec.methods) {
			if(!/^\//.test(this.spec.methods[fn].path))
				this.spec.methods[fn].path='/'+this.spec.methods[fn].path;
			this[fn]=wrapfn(fn);
			spore.log(this.spec.name+'.'+fn+' created');
		}
	},
	
	widgets: {},
};

spore.api.prototype._call=function(fn,params,onsuccess,onerror) {
	var method=this.spec.methods[fn],
		url=this.spec.base_url+method.path,
		prm=$.extend({},params),
		plog=this.spec.name+'.'+fn+' ';
		dta={};
	spore.log(plog+'init('+(params==undefined?'':(JSON?JSON.stringify(params):'...'))+')');
	//manage params
	if(method.required_params)
		for(var n=0; n<method.required_params.length; ++n) {
			var p=method.required_params[n];
			if(prm[p]==undefined) throw 'param '+p+' required';
			var r=new RegExp("(\:"+p+")(\/|$)");
			if(r.test(url)) url=url.replace(r,prm[p]+'$2');
			else dta[p]=prm[p];
		}
	if(method.optional_params)
		for(var n=0; n<method.optional_params.length; ++n) {
			var p=method.optional_params[n],
				d=(prm[p]!=undefined),
				r=new RegExp("(\:"+p+")(\/|$)");
			if(r.test(url)) url=url.replace(r,d?prm[p]+'$2':'$2');
			else if(d) dta[p]=prm[p];
		}
	//call widgets
	for(var n=0; n<this.widgets.length; n++) {
		var w=this.widgets[n], wlog=plog+'widget '+w.name+' ';
		try {
			var o=w.call(req,dta);
			if(o===false) {
				spore.log(wlog+'returned false, call stopped!');
				return false;
			} else if(typeof(o)=='function') {
				spore.log(wlog+'returned a callback');
				w.callback=o;
			} else {
				spore.log(wlog+'returned '+o);
			}
		} catch(e) {
			spore.log(wlog+'error! => '+e);
		}
	}
	//webservice's call
	spore.log(plog+'call '+url);
	var self=this;
	dta['format']='jsonp';
	$.ajax({
		url: url,
		type: method.method,
		data: dta,
		dataType: 'jsonp',
		contentType: 'json', //this.spec.formats[0]
		success: function(data,status,req) {
			spore.log(plog+'return '+(data?"datas":"nothing"));
			//call widgets backwards
			for(var n=self.widgets.length-1; n>=0; --n) {
				var w=self.widgets[n], wlog=plog+'widget '+w.name+' ';
				if(w.callback) {
					try {
						var r=w.callback(data,req);
						spore.log(wlog+'callback returned '+r);	
					} catch (e) {
						spore.log(wlog+'callback error! => '+e);
					}
					delete w.callback;
				}
			}
			if(onsuccess) onsuccess(data);
		},
		error: function(req,status,err) {
			spore.log(plog+'server returned '+req.status+':'+req.statusText);
			if(onerror) onerror(req);
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
