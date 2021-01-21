module.exports = addcity;

function addcity(req, res) {
	let events = JSON.parse(req.body.city),
		newCountry = {},
		name = req.body.name;
	var fs = require('fs');


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

	newCountry = "export default " + JSON.stringify(newCountry);

	fs.writeFile(req.body.folderUrl + '/cal-' + name + '.js', newCountry, function(err) {
		if (err) {
			throw err;
		} else {
			console.log('Saved!');
		}
	});

	res.send({ success: true });

	function castEvents(eventStr) {
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
				}
			}
			return result;
		} else {
			return [];
		}

	}
}