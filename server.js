var bodyParser = require('body-parser'),
    base64url = require('base64url'),
    config = require('./config'),
    cookieParser = require('cookie-parser'),
    errorhandler = require('errorhandler'),
    express = require('express'),
    FIWAREStrategy = require('passport-fiware-oauth').OAuth2Strategy,
    fs = require('fs'),
    https = require('https'),
    log = require('./lib/logger').logger.getLogger("Server"),
    passport = require('passport'),
    root = require('./controllers/root').root,
    session = require('express-session');


/////////////////////////////////////////////////////////////////////
////////////////////////// CONFIG CHECKERS //////////////////////////
/////////////////////////////////////////////////////////////////////

var checkPrefix = function(prefix, byDefault) {
  var finalPrefix = prefix === undefined ? byDefault : prefix;

  // Remove the last slash
  if (finalPrefix.slice(-1) == '/') {
    finalPrefix = finalPrefix.slice(0, -1);
  }

  // If a prefix is set, the prefix MUST start with a slash
  // When the prefix is not set, the slash is NOT required
  if (finalPrefix.length > 0 && finalPrefix.chatAt(0) !== '/') {
    finalPrefix = '/' + finalPrefix;
  }

  return finalPrefix;
}

// TODO: Add more checkers

/////////////////////////////////////////////////////////////////////
/////////////////////////////// CONFIG //////////////////////////////
/////////////////////////////////////////////////////////////////////

// Default title for GUI
var DEFAULT_TITLE = 'TM Forum Portal';

// Get preferences and set up default values
config.azf = config.azf || {};
config.https = config.https || {};
config.proxyPrefix = checkPrefix(config.proxyPrefix, '/proxy');
config.portalPrefix = checkPrefix(config.portalPrefix, '');

var PORT = config.https.enabled ? 
    config.https.port || 443 :      // HTTPS
    config.pepPort || 80;           // HTTP

// Avoid existing on uncaught Exceptions
process.on('uncaughtException', function (err) {
  log.error('Caught exception: ' + err);
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


/////////////////////////////////////////////////////////////////////
////////////////////////////// EXPRESS //////////////////////////////
/////////////////////////////////////////////////////////////////////

var app = express();
app.set('port', PORT);

app.use(errorhandler({ dumpExceptions: true, showStack: true }));

// Static files && templates
app.use(config.portalPrefix + '/', express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Session
app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true,
}));

// Generic middlewares for handle requests
app.use(cookieParser());
app.use(bodyParser.text({
  type: '*/*'
}));


/////////////////////////////////////////////////////////////////////
////////////////////////////// PASSPORT /////////////////////////////
/////////////////////////////////////////////////////////////////////

var ensureAuthenticated = function(req, res, next) {
  if (!req.isAuthenticated()) {
    var state = {'came_from_path': req.path};
    var encodedState = base64url(JSON.stringify(state));
    // This action will redirect the user the FIWARE Account portal,
    // so the next callback is not required to be called
    passport.authenticate('fiware', { scope: ['all_info'], state: encodedState })(req, res);
  } else {
    next();
  }
}

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new FIWAREStrategy({
    clientID: config.oauth2.clientID,
    clientSecret: config.oauth2.clientSecret,
    callbackURL: config.oauth2.callbackURL
  },

  function(accessToken, refreshToken, profile, done) {
    profile['accessToken'] = accessToken;
    done(null, profile);
  }
));

// Passport middlewares
app.use(passport.initialize());
app.use(passport.session());

// Handler for the callback
app.get('/auth/fiware/callback', 
  passport.authenticate('fiware', { failureRedirect: '/error' }),
  function(req, res) {
    var state = JSON.parse(base64url.decode(req.query.state));
    var redirectPath = state.came_from_path !== undefined ? state.came_from_path : '/';
    res.redirect(redirectPath);
  });


/////////////////////////////////////////////////////////////////////
/////////////////////////////// PORTAL //////////////////////////////
/////////////////////////////////////////////////////////////////////

var getProperties = function(req, content, viewName) {

  // TODO: Maybe an object with extra properties.
  // To be implemented if required!!

  var properties = {
    content: content,
    viewName: viewName,
    user: req.user,
    title: DEFAULT_TITLE,
    contextPath: config.portalPrefix,
    proxyPath: config.proxyPrefix,
    accountHost: config.accountHost
  }

  return properties;

}

app.get(config.portalPrefix + '/', ensureAuthenticated, function(req, res) {
  var properties = getProperties(req, 'home-content', 'Customer');
  res.render('base', properties);
  res.end();
});

app.get(config.portalPrefix + '/mystock', ensureAuthenticated, function(req, res) {
  var properties = getProperties(req, 'mystock-content', 'Seller');
  res.render('base', properties);
  res.end();
});


/////////////////////////////////////////////////////////////////////
//////////////////////////////// APIs ///////////////////////////////
/////////////////////////////////////////////////////////////////////

// Middleware: Add CORS headers. Handle OPTIONS requests.
app.use(function (req, res, next) {
    'use strict';
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'HEAD, POST, GET, OPTIONS, DELETE');
    res.header('Access-Control-Allow-Headers', 'origin, content-type, X-Auth-Token, Tenant-ID, Authorization');
    //log.debug("New Request: ", req.method);
    
    if (req.method == 'OPTIONS') {
        log.debug("CORS request");
        res.statusCode = 200;
        res.header('Content-Length', '0');
        res.send();
        res.end();
    } else {
        next();
    }
});

// Public Paths are not protected by the Proxy
for (var p in config.publicPaths) {
    log.debug('Public Path', config.publicPaths[p]);
    app.all(config.proxyPrefix + '/' + config.publicPaths[p], root.public);
}

app.all(config.proxyPrefix + '/*', root.pep);


/////////////////////////////////////////////////////////////////////
//////////////////////////// START SERVER ///////////////////////////
/////////////////////////////////////////////////////////////////////

log.info('Starting PEP proxy in port ' + PORT + '.');

if (config.https.enabled === true) {
    
    var options = {
        key: fs.readFileSync(config.https.keyFile),
        cert: fs.readFileSync(config.https.certFile)
    };

    https.createServer(options, function(req,res) {
        app.handle(req, res);
    }).listen(app.get('port'));

} else {
    app.listen(app.get('port'));
}