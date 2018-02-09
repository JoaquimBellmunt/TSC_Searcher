/**
 * SearcherController
 *
 * @description :: Server-side logic for managing searchers
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

var async = require('async');
var fs = require('fs');
var r = require('request');
var util = require('util');

var dbpediaLookup = require('dbpedia-entity-lookup');
var WikidataSearch = require('wikidata-search').WikidataSearch;
var wikidataSearch = new WikidataSearch();
var wdk = require('wikidata-sdk')

var dbContent = {
'dbAbstract' : 'http://dbpedia.org/ontology/abstract',
'dbLabel' :'http://www.w3.org/2000/01/rdf-schema#label',
'dbComment' : 'http://www.w3.org/2000/01/rdf-schema#comment',
'dbSubject' :  'http://purl.org/dc/terms/subject',
'dbDepiction' : 'http://xmlns.com/foaf/0.1/depiction',
'dbPrimaryTopicOf' : 'http://xmlns.com/foaf/0.1/isPrimaryTopicOf',
'dbDerivedFrom' : 'http://www.w3.org/ns/prov#wasDerivedFrom',
'dbSeeAlso' : 'http://www.w3.org/2000/01/rdf-schema#seeAlso',
'dbSameAs' : 'http://www.w3.org/2002/07/owl#sameAs',
'dbType' : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
};


var self = module.exports = {
    
    index : function (req, res, next) {
		res.view({results:'Welcome'});
    },
    
    results : function (req, res, next) {
		var p = req.params.all();
		console.log('Fetching Data: '+ p.entity)
		self.fetch(p.entity, function(err, results){
			if(err) console.log(err)
			else {
			    console.log('Done')
				res.view({'rDB' : JSON.parse(results.DB), 'rWiki': results.Wiki.results});
			    }  
	    });
    },

    getMore: function(req, res, next) {
    	var param = req.params.all();
    	var entity = param.id
    	console.log('fetching more info for entity : '+ entity)
    	if(param.Type == 'Wiki'){
			self.getMoreWiki(req, res, next);
    	} else if (param.Type == 'Db') {
    		self.getMoreDb(req, res, next);
    	}
    },

    getClaimsWiki: function(entity, cb) {
    	var options = {  
		    url: wdk.getEntities({ids: [entity]}),
		    method: 'GET',
		    headers: {
			'Accept': 'application/json',
			'Accept-Charset': 'utf-8',
			'User-Agent': 'my-reddit-client'
			}
		};
		r(options, function(err, response, body){
			if(err) {
			    console.log(err.code)
			    cb(err, 'empty')
			
			} else {
				var ent = body
				var ent = JSON.parse(ent);	
    			cb(null, ent)
    		}
    	});
    },

    getWikiKeyValues: function(entities, cb){
    	var keys = {}
    	async.each(entities, function(entity, cb){
	    	var options = {  
			    url: wdk.getEntities({ids: [entity]}),
			    method: 'GET',
			    headers: {
				'Accept': 'application/json',
				'Accept-Charset': 'utf-8',
				'User-Agent': 'my-reddit-client'
				}
			};
			r(options, function(err, response, body){
				if(err) {
				    console.log(err)
				} else {
					
					var ent = body
					var ent = JSON.parse(ent);
					if (ent['error']){
						keys[entity]= entity
						cb();
					} else {
						var labels = ent['entities'][entity]['labels']
						var name = labels['en']
						keys[entity]= name
		    			cb();
	    			}
	    		}
	    	});
		}, function (err) {
    		if (err) {
    			console.error('getWikiKeyValues ' + err.message);
    			cb(err)
    		}
    		else{
		    	cb(null, keys)
		    }
		});

    },

    getMoreWiki: function(req, res, next) {
		var param = req.params.all();
    	var entity = param.id
		self.getClaimsWiki(entity, function (err, info){
			var claims = info['entities'][entity]['claims']
			var labels = info['entities'][entity]['labels']
			
			var simplyClaims =  wdk.simplify.claims(claims)
			var simplyLabels = 	wdk.simplify.labels(labels)
			var claimskeys = Object.keys(simplyClaims)
			if(claimskeys.length >100) {
				res.view("./searcher/LongRequest", {'param':param})
			} else {
				self.getWikiKeyValues(claimskeys, function(err, keys){
				var results = {}
				if(err) {
					console.log(err)
				} else {
					async.eachSeries(claimskeys, function(key, cb){
						values = simplyClaims[key]
						results[key] = {'labels':keys[key], 'values': values}
						self.getWikiKeyValues(values, function(err, data){
							if (err) {
								console.log(err.code)
								cb();
							} else {
								var dataKeys = Object.keys(data)
								_.each(dataKeys, function(dataKey){
									results[key]['values'].push(data[dataKey])
								});
								cb();
							}
						});
						}, function (err) {
				    		if (err) {
				    			console.error('getWikiKeyValues ' + err.message);
				    			res.ok ()
				    		}
				    		else{
						    	console.log('Done')
						    	res.json(results);
						    }
						});
					
					}					
				});	
			}

    	});
    },

    getMoreDb: function(req, res, next) {
    	var param = req.params.all();
    	var entity = param.id
    	console.log('fetching more info for entity : '+ entity)
    	var options = {  
		    url: param.Entity,
		    method: 'GET',
		    headers: {
			'Accept': 'application/json',
			'Accept-Charset': 'utf-8',
			'User-Agent': 'my-reddit-client'
		    }
		};
		r(options, function(err, response, body){
			if(err) {
			    console.log(err)
			} else {
				var result = {}
				var ent = body
				var ent = JSON.parse(ent);
				var content = ent[param.Entity];
				var dbKey = Object.keys(dbContent)
				async.eachSeries(dbKey, function(key, cb){
					result[key] = content[dbContent[key]]
					cb();
				}, function(err){
					if(err) console.log(err)
					res.json(result)
				});
			}
		});
    },
    
    getLabelWiki: function(value, cb) {
		var url = wdk.getEntities({ids: [value]});
		var options = {  
		    url: url,
		    method: 'GET',
		    headers: {
			'Accept': 'application/json',
			'Accept-Charset': 'utf-8',
			'User-Agent': 'my-reddit-client'
		    }
		};
		r(options, function(err, response, body){
			if(err) {
		    	console.log(err)
			} else {
					var ent = body
					var ent = JSON.parse(ent);
					var aux = ent['entities'][value]['labels']['en']['value']
					cb(null, aux)
			}
		});		
    },
    
    fetch : function (entity, cb){
    	if(entity){
			async.series({
				Wiki: function(cb) {
				    self.fetchingWiki(entity, function(err, results){
					    if(err) console.log(err)
						else {
						    cb(null, results);
						}
					});
				},
				    DB: function(cb){
				    self.fetchingDbpedia(entity, function(err, results){
					    if(err) console.log(err)
						else {
						    cb(null, results);
						}
					});
				}
			    }, function(err, results) {
				if(err) console.log(err)
				    else {
					cb(null, results)
					    }
			});
		}  else {
			console.log('Please enter a name')
		}
    },
    
    fetchingWiki : function (entity, cb) {
		console.log('Fetching Wikidata')
	    wikidataSearch.set('search', entity);
		wikidataSearch.search(function(result, error) {
			if(error) {
			    console.log(error);
			    cb(error);
			} else {
			    result;
			    cb(null, result);
			}
	    });
    },
	
	fetchingDbpedia : function (entity, cb) {
		console.log('Fetching dbpedia')
	    var options = {  
		    url: 'http://lookup.dbpedia.org/api/search/PrefixSearch?QueryClass=&MaxHits=10&QueryString='+entity,
		    method: 'GET',
		    headers: {
			'Accept': 'application/json',
			'Accept-Charset': 'utf-8',
			'User-Agent': 'my-reddit-client'
		    }
		};
		r.get(options, function(err, response, body){
		if(err) {
		    console.log(err)
			} else {
		    cb(null, body);
		}
	    });
    }   
};

