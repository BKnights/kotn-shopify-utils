var debug = require('debug')('kotn-base');

module.exports = function(config){ // needs session for auth process so supply simplest
    config = config || {};

    var session = config.session || require('express-session')({
        secret: config.COOKIE_SECRET || process.env.COOKIE_SECRET || (Math.floor(new Date().getTime()*Math.random()) +'::'+ new Date().getTime()),
        resave: false,
        saveUninitialized: true,
        cookie:{
            secure:true,
            httpOnly:true,
            sameSite:'none'
        }
    });
    
    return function(req, res, next){
        session(req, res, ()=>{
            res.locals.ctx = res.locals.ctx || {};
            res.locals.ctx.shop = req.session && req.session.shopConfig && req.session.shopConfig.shop;
            debug('session shop is '+ res.locals.ctx.shop);
            next();
        });
    };
};