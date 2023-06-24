export default (req, res, next) => {

	res.header("Access-Control-Allow-Origin", "*");
	//res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-client-id, x-auth-token, x-pos-id");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-auth-token, admin");
	res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

	if (req.method === 'OPTIONS') {
		res.end();
	} else
		next();
};