var http = require('http-request');
var async = require('async');
var cities = require('../../../front/src/assets/js/cities');
var fs = require('fs');

module.exports = addcity;

function addcity(req, res) {
	if (cities[req.params.id]) {
    async.waterfall([
			function(callback) {
				console.log('Fetching ' + cities[req.params.id].slug);
				http.get(`https://vaishnavacalendar.org/json/${cities[req.params.id].slug}/${req.body.gaurabda}/en`, function(err, response) {
					if (err) {
						callback(null, { error: true, details: err });
					} else {
						console.log('Fetched ' + cities[req.params.id].slug);
						callback(null, JSON.parse(response.buffer));
					}
				})
			},
			function(events, callback) {
				console.log('Casting ' + cities[req.params.id].slug);
				let newCountry = {};
				if (!events.error) {
					for (var i = 0; i < events.length; i++) {
						let day = {
							'lunar-day': events[i]['masa_str'] + ' ' + events[i]['tithi_str'],
							events: []
						}
				
						if (events[i]['shv_str'] && events[i]['shv_str'].includes('Fast')) {
							let ekadashi = events[i]['shv_str'].replace(/(\<strong\>)|(\<\/strong\>)/g, '');
							ekadashi = ekadashi.replace(/\s\(in.*\)/g, '');
							day.ekadashi = ekadashi;
						} else if (events[i]['shv_str']) {
							day.special = events[i]['shv_str'];
							day.special = day.special.replace(/(\<em\>)|(\<\/em\>)/g, '');
						}
				
						day.events = day.events.concat(castEvents(events[i]['festivals_str']), castEvents(events[i]['holydays_str']), castEvents(events[i]['notes_str']))
				
						newCountry[events[i].date] = day;
					}
					callback(null, newCountry);
				} else {
					callback(events.error);
				}
			},
			function(location, callback) {
				console.log('Writing server ' + cities[req.params.id].slug);
				location = JSON.stringify(location);
				fs.writeFile(req.body.urlServer + '/location-' + cities[req.params.id]['city_id'] + '.json', location, function(err) {
					if (err) {
						callback(err);
					} else {
						callback(null, location);
					}
				});
			},
			function(location, callback) {
				console.log('Writing client ' + cities[req.params.id].slug);
				location = 'export default ' + location;
				fs.writeFile(req.body.urlClient + '/location-' + cities[req.params.id]['city_id'] + '.js', location, function(err) {
					if (err) {
						callback(err);
					} else {
						callback(null, { success: true });
					}
				});
			},
    ], function (err, result) {
        res.send(err || result);
    });
	} else {
		res.send({ error: 'Location not found!' });
	}

	function castEvents(eventStr) {
		let eventImages = {
			AcharyaMhj: 'Nirmal Acharya',
			GovindaMhj: 'Sundar Govinda',
			SwamiMhj: 'Bhaktivedanta',
			SridharMhj: 'Raksak Sridhar',
			SaraswatiMhj: 'Siddhanta Saraswati',
			GauraKisoraMhj: 'Paramahamsa Sri Srila Gaura Kishor',
			BhaktivinodaThakur: 'Sachchidananda Bhakti Vinod',
			JagannathMhj: 'Srila Jagannath Das Babaji',
			SriBalaram: 'Sri Baladev',
			SriKrishna: 'Janmashtami',
			SriRadha: 'Radhashtami',
			SriGaura: 'Gaura Purnima',
			SriNitai: 'Sri Nityananda Prabhu'
		};

		if (eventStr) {
			eventStr = eventStr.replace(/(B\.S\. )/, 'B.S.');
			eventStr = eventStr.replace(/(\. )|(\.\&\#32\;)/g, '---');
			let splitEvents = eventStr.split('---'),
				result = [];
			for (var i = 0; i < splitEvents.length; i++) {
				if (splitEvents[i]) {
					result.push({});
					splitEvents[i] = splitEvents[i].replace(/(\<strong\>)|(\<\/strong\>)/g, '');
					splitEvents[i] = splitEvents[i].replace('&#32;', ' ');
					if (splitEvents[i].includes("<a href='")) {
						let array = splitEvents[i].split("<a href='");
						let array2 = array[1].split(".html'");
						if (array2[1]) {
							array2[1] = array2[1].split('>')[1];
							result[i].name = array[0] + array2[1];
						} else {
							result[i].name = array[0];
						}
						result[i].link = array2[0] + '.html';
					} else if (splitEvents[i].includes('<a href="')) {
						let array = splitEvents[i].split('<a href="');
						let array2 = array[1].split('.html\"');
						if (array2[1]) {
							array2[1] = array2[1].split('>')[1];
							result[i].name = array[0] + array2[1];
						} else {
							result[i].name = array[0];
						}
						result[i].link = array2[0] + '.html';
					} else {
						result[i].name = splitEvents[i];
					}
					result[i].name = result[i].name.replace(/(\<\/a\>)|(\<\/a)/g, '');
					for(let j in eventImages) {
						if (result[i].name.includes(eventImages[i])) {
							result[i].img = i;
						}
					}
				}
			}
			return result;
		} else {
			return [];
		}

	}
}