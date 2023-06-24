export default {

    //secret key used to encode token
    secretKey: 'x$snetsecret#%',
    secretKey2: '#@powpow*&',

    //webclient host
    appHost: process.env.WEBCLIENT_URL || 'http://localhost:5500',

    environment: process.env.ENVIRONMENT || 'dev',

    //port in which server is listening to
    port: process.env.SERVER_PORT || 5501,

    //mongodb
    db: {
        uri: process.env.MONGO_PATH || 'http://localhost',
        options: {}
    },

    weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
};