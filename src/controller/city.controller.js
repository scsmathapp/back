import https from 'https';
import async from 'async';
import fs from 'fs';
import _ from 'lodash';
import {finished} from 'stream';
import cities from '../assets/cities.js';

_.each(cities, city => {
    console.log('Reading city ' + city.name);
    fs.readFile('D:/Dev/Webstorm/SCSMath/back/src/assets/json/' + city.slug + '_540.json', 'utf8', (err, location) => {
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
    fs.writeFile('D:/Dev/Webstorm/SCSMath/front/src/assets/cal-data/location-' + city.city_id + '.js', data, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

const castEvents = (day, date) => {
    let eventStr = date['en-line'];
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
        eventStr = eventStr.replace(/(\. )/g, '---');
        eventStr = eventStr.replace(/(\<b\>)|(\<\/b\>)/g, '');

        let splitEvents = eventStr.split('---');

        _.eachRight(splitEvents, (ev, evIndex) => {
            if (ev) {
                const newEvent = removeChar(ev, day);

                if (ev.includes('Ekadashi') || ev.includes('Mahadvadashi')) {
                    day.ekadashi = newEvent;
                    splitEvents.splice(evIndex, 1);
                    return false;
                }

                if (ev.includes('No fast') || ev.toLowerCase().includes('paran')) {
                    day.special = newEvent;
                    splitEvents.splice(evIndex, 1);
                    return false;
                }

                _.each(eventImages, (lord, img) => {
                    if (newEvent.name.includes(lord)) {
                        newEvent.img = img;
                        day.img = img;
                    }
                });

                if (!_.isEmpty(newEvent)) {
                    day.events.push(newEvent);
                }
            }
        });
    }
}

function removeChar(ev, day) {
    const newEvent = {};

    if (ev.includes('<a href="') || ev.includes('<a href= "')) {
        let str;

        if (ev.includes('<a href="')) {
            str = '<a href="';
        } else if (ev.includes('<a href= "')) {
            str = '<a href= "';
        }

        let array = ev.split(str);
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
    
    return newEvent;
}