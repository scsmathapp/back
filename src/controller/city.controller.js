import https from 'https';
import async from 'async';
import fs from 'fs';
import _ from 'lodash';
import { finished } from 'stream';
import cities from '../assets/cities.js';

_.each(cities, city => {
	console.log('Reading city ' + city.name);
	fs.readFile('../assets/json/' + city.slug + '_538.json', 'utf8', (err, location) => {
		if (err) {
			console.log(err);
		} else {
			console.log('Casting ' + city.name);
			writeClient(city, standardizeData(JSON.parse(location)));
		}
	})
});

	const standardizeData = (calDates) => {
		let newCountry = {};
		
		_.each(calDates, (calDate, dateText) => {
			let day = {
				'lunar-day': calDate['en-masa-title'] + ' ' + calDate['en-tithi-title'],
				events: []
			}

			castEvents(day, calDate);

			if (day.ekadashi || day.special || (day.events && day.events.length)) {
				newCountry[dateText] = day;
			}
		});

		return ('export default ' + JSON.stringify(newCountry));
	}

	const writeClient = (city, data) => {
		console.log('Writing client ' + city.name);
		fs.writeFile('/home/suyash/Documents/Projects/Math/client/public/assets/cal/location-' + city.city_id + '.js', data, (err) => {
			if (err) {
				console.log(err);
			}
		});
	}

	const castEvents = (day, date) => {
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
		}, eventStr = date['en-line'];

		if (eventStr) {
			eventStr = eventStr.replace(/(\. )/g, '---');
			eventStr = eventStr.replace(/(\<b\>)|(\<\/b\>)/g, '');
			
			let splitEvents = eventStr.split('---');
			
			_.eachRight(splitEvents, (ev, evIndex) => {
				let newEvent = {};
				if (ev) {
					if (ev.includes('Ekadashi') || ev.includes('Mahadvadashi')) {
						day.ekadashi = ev;
						splitEvents.splice(evIndex, 1);
						return false;
					}
					
					if (ev.includes('No fast') || ev.toLowerCase().includes('paran')) {
						day.special = ev;
						splitEvents.splice(evIndex, 1);
						return false;
					}
	
					if (ev.includes('<a href="')) {
						let array = ev.split('<a href="');
						let array2 = array[1].split('\"');
						
						if (array2[1]) {
							array2[1] = array2[1].split('>')[1];
							newEvent.name = array[0] + array2[1];
						} else {
							newEvent.name = array[0];
						}
						
						newEvent.link = array2[0];
					} else {
						newEvent.name = ev;
					}
					
					newEvent.name = newEvent.name.replace(/(\<i\>)|(\<\/i\>)|(\<\/a\>)|(\<\/a)/g, '');
					
					_.each(eventImages, (lord, img) => {
						if (newEvent.name.includes(lord)) {
							newEvent.url = 'url(../assets/img/' + img + '.jpg)';
						}
					});

					if (!_.isEmpty(newEvent)) {
						day.events.push(newEvent);
					}
				}
			});
		}

	}