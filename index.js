const express = require('express');

const routes = require('./routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.use('/', routes);

app.use( (req, res, next) => {
    res.status(404);
    res.end();
});

app.use( (err, req, res, next) => {
    res.status(err.status || 500);
    res.json({message: err.message, error: req.app.get('env') === 'development' ? err : {}});
});

module.exports = app;
