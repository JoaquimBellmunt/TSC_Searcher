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

//Array of DbPedia matching
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
		res.view();
    },
    
    results : function (req, res, next) {
		var p = req.params.all();
		console.log('Fetching Data: '+ p.entity)
		//requesting Data for DbPedia and WikiData
		self.fetch(p.entity, function(err, results){
			if(err) console.log(err)
			else {
			    console.log('Done')
			    // Response with results
				res.view({'rDB' : JSON.parse(results.DB), 'rWiki': results.Wiki.results});
			    }  
	    });
    },

    fetch : function (entity, cb){
    	//Validate the entity
    	if(entity){
    		//Request the data for both Datasets one by one
			async.series({
				//Wikidata
				Wiki: function(cb) {
				    self.fetchingWiki(entity, function(err, results){
					    if(err) console.log(err)
						else {
						    cb(null, results);
						}
					});
				},
				//DbPedia
				DB: function(cb){
				    self.fetchingDbpedia(entity, function(err, results){
					    if(err) console.log(err)
						else {
						    cb(null, results);
						}
					});
				}
			    }, function(err, results) {
			    	//Return results
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
    	//Fetching wikidata entity
		console.log('Fetching Wikidata')
		// Search entity with wide regex using wikidataSeacrh NPM Package
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
		//Request wide regex for wikipedia using lookup search
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
    },  

    getMore: function(req, res, next) {
    	// Request more information for a given entity
    	var param = req.params.all();
    	var entity = param.id
    	console.log('fetching more info for entity : '+ entity)
    	// Requets more data depending the Dataset
    	if(param.Type == 'Wiki'){
			self.getMoreWiki(req, res, next);
    	} else if (param.Type == 'Db') {
    		self.getMoreDb(req, res, next);
    	}
    },

    getMoreWiki: function(req, res, next) {
    	// First request entity claims and labels for first level information. Using weikidata-sdk NPM Package
		var param = req.params.all();
    	var entity = param.id
		self.getClaimsWiki(entity, function (err, info){
			var claims = info['entities'][entity]['claims']
			var labels = info['entities'][entity]['labels']
			// wdk.simplify.claims for a giving entity
			var simplyClaims =  wdk.simplify.claims(claims)
			// wdk.simplify.labels for a giving entity
			var simplyLabels = 	wdk.simplify.labels(labels)
			// save JSON keys for requesting human readables entities
			var claimskeys = Object.keys(simplyClaims)
			// if the number of keys is too big the http req reach the timeout. TODO
			if(claimskeys.length >100) {
				res.view("./searcher/LongRequest", {'param':param})
			// getWikiKeyValues request the labels and values (the method reads an array)
			} else {
				self.getWikiKeyValues(claimskeys, function(err, keys){
				var results = {}
				if(err) {
					console.log(err)
				} else {
					// for each claims the systems respond teh value if the value is a literal or a new entity. In any case for each claim the method request values for a second level of information
					async.eachSeries(claimskeys, function(key, cb){
						// values is the content of the Claims for each key
						values = simplyClaims[key]
						// Results content is a key JSON with human readable values after searching in getWikiKeyValues again. 
						results[key] = {'labels':keys[key], 'values': values}
						self.getWikiKeyValues(values, function(err, data){
							if (err) {
								console.log(err.code)
								cb();
							} else {
								//saving values for each key and value
								var dataKeys = Object.keys(data)
								_.each(dataKeys, function(dataKey){
									results[key]['values'].push(data[dataKey])
								});
								// cb for async.eachSeries(claimskeys, function(key, cb)
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

    getClaimsWiki: function(entity, cb) {
    	// request get
    	var options = {  
    		// wdk.getEntities with entity to get the URL, Wiidata-sdk NPM JSON
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
				//	main functin cb with entity body parsed
    			cb(null, ent)
    		}
    	});
    },

    getWikiKeyValues: function(entities, cb){
		// request get
    	var keys = {}
    	// for each entity get the infomation
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
					// if the entity is a literal the request replies an 403 error with no match. This is different from a https get error. In this case the value is teh same literal
					if (ent['error']){
						keys[entity]= entity
						// cb for async.each(entities, function(entity, cb)
						cb();
					} else {
					// Otherwise teh code explores teh JSON till Labels level
						var labels = ent['entities'][entity]['labels']
						var name = labels['en']
						keys[entity]= name
						// cb for async.each(entities, function(entity, cb)
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
    			// main cb with no eeror and results
		    	cb(null, keys)
		    }
		});

    },

    getLabelWiki: function(value, cb) {
    	// If the code request only the label for a given entity
    	// Wikidata-SDK for requesting URL
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
    } ,

    getMoreDb: function(req, res, next) {
    	// Requesting info from a DbPedia URL
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
				// Requesting info in JSON for Entity
				var content = ent[param.Entity];
				// Requesting info for Keys in DbContent JSON
				var dbKey = Object.keys(dbContent)
				//For each key request info
				async.eachSeries(dbKey, function(key, cb){
					// New JSON for Key
					result[key] = content[dbContent[key]]
					// cb for async.eachSeries(dbKey, function(key, cb)
					cb();
				}, function(err){
					if(err) console.log(err)
					res.json(result)
				});
			}
		});
    }   
};

