import express from 'express';
import fileupload from 'express-fileupload';
import bodyParser from 'body-parser';

import routes from './routes/index.js';

const app = express();

app.use(express.static('../client/build'));
app.use(fileupload({
  limits: {fileSize: 1 * 1024 * 1024 * 1024},
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use('/', routes);

app.use((req, res, next) => {
  res.status(404);
  res.end();
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.json({message: err.message, error: req.app.get('env') === 'development' ? err : {}});
});

export default app;
