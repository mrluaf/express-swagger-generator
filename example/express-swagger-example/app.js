var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var homeRouter = require('./src/routes/home');
var usersRouter = require('./src/routes/users');
const swagger = require("../../dist");

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', homeRouter);
app.use('/users', usersRouter);

app.use(function (err, req, res, next) {
    let statusCode = err.status || 500;
    res.status(statusCode).json(err);
});

const options = {
    title: "swagger-generator-express",
    version: "1.0.0",
    host: "localhost:3000",
    basePath: "/",
    schemes: ["http", "https"],
    securityDefinitions: {
        Bearer: {
            description: 'Example value:- Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU5MmQwMGJhNTJjYjJjM',
            type: 'apiKey',
            name: 'Authorization',
            in: 'header'
        }
    },
    // security: [{
    //     Bearer: []
    // }],
    // defaultSecurity: 'Bearer'
};

swagger.serveSwagger(app, "/swagger", options, {
    routePath: '../example/express-swagger-example/src/routes/',
    requestModelPath: '../example/express-swagger-example/src/requestModel',
    responseModelPath: '../example/express-swagger-example/src/responseModel'
});

module.exports = app;