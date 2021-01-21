module.exports = {
    sendError: sendError,
    removeFromArray: removeFromArray,
    castItem: castItem,
    sortArray: sortArray
}

var _ = require('lodash');

function sendError(res, err) {
    res.status(500).send(err || new Error(500));
}

function sortArray(array, attribute, descending) {
    array.sort(function(a, b) {
        if (!descending) {
            return a[attribute] - b[attribute];
        } else {
            return b[attribute] - a[attribute];
        }
    })
}

function removeFromArray(array, value, attr) {
    if (attr) {
        for (var i = 0; i < array.length; i++) {
            if (_.get(array[i], attr) == value) {
                array.splice(i, 1);
            }
        }
    } else {
        for (var i = 0; i < array.length; i++) {
            if (array[i] == value) {
                array.splice(i, 1);
            }
        }
    }
}

function castItem(idea, userId) {
    if (idea.who && idea.who.id == userId) {
        idea.mine = true;
    }
    var date = idea.date || new Date(parseInt(idea.id.toString().substring(0, 8), 16) * 1000);
    idea.when = 'on ' + date.getDate() + ' / ' + (date.getMonth() + 1) + ' / ' + date.getFullYear() + ' at ' + date.getHours() + ':' + date.getMinutes();
    idea.noteCount = idea.notes.length;
    idea.reLiveCount = idea.reLives.length;
    idea.pointCount = idea.points.length;
    for (var j = 0; j < idea.points.length; j++) {
        if (idea.points[j].who === userId) {
            idea.pointGiven = true;
        }
    }
    idea.optionSection = false;
    idea.notes = null;
    idea.reLives = null;
    idea.points = null;
}