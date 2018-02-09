/**
 * DatabaseController
 *
 * @description :: Server-side logic for managing databases
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var fs = require('fs');
var path = require('path');

module.exports = {
	
	index: function(req, res, next){
		res.view();
	},

	people: function(req, res, next){
		console.log('people')
		var ExtractOrg= JSON.parse(fs.readFileSync("./Dataset_DbPedia_Org_5Feb.json", "utf8"), 1000);
		res.json(ExtractOrg);
	}, 

	org: function(req, res, next) {
		console.log('organizations')
		var file = __dirname+'/'+'Dataset_DbPedia_Org_5Feb.json'
		if (fs.existsSync(file)) {
    		try{
			console.log(file)
			var ExtractOrg= JSON.parse(fs.readFileSync(file, "utf8"), 1000);
			console.log(ExtractOrg)
			res.view('./database/index');
			} catch(error) {
	  			console.log(error); 
	  		}
		}
		
	} 
};

